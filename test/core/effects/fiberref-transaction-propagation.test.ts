/**
 * Verification test: Does FiberRef.locally propagate through
 * Effect.uninterruptibleMask + Effect.exit(restore(effect))?
 *
 * This mimics the exact pattern in database.runtime.ts transaction():
 *   withWritePermit(                     ← sets lockDepth=1 via Effect.locally
 *     uninterruptibleMask((restore) =>
 *       gen(function*() {
 *         executeRaw("BEGIN IMMEDIATE")
 *         Effect.exit(restore(effect))   ← does the body see lockDepth=1?
 *       })
 *     )
 *   )
 */
import { Effect, FiberRef } from "effect";
import { describe, expect, it } from "vitest";

describe("FiberRef propagation through uninterruptibleMask + exit + restore", () => {
  it("should see locally-set FiberRef value inside restore(effect)", async () => {
    const depthRef = FiberRef.unsafeMake(0);
    const observations: number[] = [];

    // Simulates the transaction body (what saveDiagram passes to service.transaction)
    const transactionBody = Effect.gen(function*() {
      const depth = yield* FiberRef.get(depthRef);
      observations.push(depth);
      // Simulate async work (like an invoke call)
      yield* Effect.promise(() => new Promise((r) => setTimeout(r, 10)));
      const depthAfterAwait = yield* FiberRef.get(depthRef);
      observations.push(depthAfterAwait);
    });

    // Simulates withWritePermit → transaction flow
    const program = Effect.locally(depthRef, 1)(
      Effect.uninterruptibleMask((restore) =>
        Effect.gen(function*() {
          // Check depth before body (like BEGIN IMMEDIATE point)
          const depthBefore = yield* FiberRef.get(depthRef);
          observations.push(depthBefore);

          // Run body through exit(restore(...)) exactly like transaction() does
          const exit = yield* Effect.exit(restore(transactionBody));

          // Check depth after body (like COMMIT point)
          const depthAfter = yield* FiberRef.get(depthRef);
          observations.push(depthAfter);

          if (exit._tag === "Failure") {
            return yield* Effect.failCause(exit.cause);
          }
          return exit.value;
        })
      ),
    );

    await Effect.runPromise(program);

    // All should be 1: [beforeBody, insideBody, insideBodyAfterAwait, afterBody]
    expect(observations).toEqual([1, 1, 1, 1]);
  });

  it("should see lockDepth=1 in nested withWritePermit (simulating execute inside transaction)", async () => {
    const depthRef = FiberRef.unsafeMake(0);
    const semaphore = Effect.runSync(Effect.makeSemaphore(1));
    const log: string[] = [];

    // Simulates withWritePermit
    const withWritePermit = <A, E, R>(
      effect: Effect.Effect<A, E, R>,
    ): Effect.Effect<A, E, R> =>
      Effect.gen(function*() {
        const lockDepth = yield* FiberRef.get(depthRef);
        if (lockDepth > 0) {
          log.push("skip-semaphore");
          return yield* effect;
        }
        log.push("acquire-semaphore");
        return yield* semaphore.withPermits(1)(
          Effect.locally(depthRef, 1)(effect),
        );
      }) as Effect.Effect<A, E, R>;

    // Simulates service.execute() called from inside transaction body
    const innerExecute = Effect.gen(function*() {
      return yield* withWritePermit(
        Effect.sync(() => {
          log.push("inner-execute-ran");
        }),
      );
    });

    // Simulates service.transaction(body)
    const transaction = withWritePermit(
      Effect.uninterruptibleMask((restore) =>
        Effect.gen(function*() {
          log.push("begin-immediate");
          const bodyExit = yield* Effect.exit(restore(innerExecute));
          log.push("commit");
          if (bodyExit._tag === "Failure") {
            return yield* Effect.failCause(bodyExit.cause);
          }
          return bodyExit.value;
        })
      ),
    );

    await Effect.runPromise(transaction);

    // Expected: outer withWritePermit acquires semaphore,
    // inner withWritePermit skips semaphore (lockDepth=1)
    expect(log).toEqual([
      "acquire-semaphore", // outer withWritePermit
      "begin-immediate",
      "skip-semaphore", // inner withWritePermit sees lockDepth=1
      "inner-execute-ran",
      "commit",
    ]);
  });
});
