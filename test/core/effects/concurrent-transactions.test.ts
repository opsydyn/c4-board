/**
 * Verification test: Simulates concurrent transactions through the
 * full ensureSettingsBootstrapped → withWritePermit → BEGIN/COMMIT cycle.
 *
 * Reproduces the exact architecture from database.runtime.ts to check
 * if "cannot start a transaction within a transaction" can occur.
 */
import { describe, expect, it } from "vitest";
import { Effect, FiberRef } from "effect";

describe("Concurrent transaction serialization (reproducer)", () => {
  it("should never interleave BEGIN/COMMIT across concurrent Effect.runPromise calls", async () => {
    // Shared state simulating SQLite connection
    const writeSemaphore = Effect.runSync(Effect.makeSemaphore(1));
    const writeLockDepthRef = FiberRef.unsafeMake(0);
    const settingsBootstrapLatch = Effect.runSync(Effect.makeLatch(false));
    let settingsBootstrapStarted = false;

    const log: string[] = [];
    let activeTransaction = false;

    // Simulate executeRaw — tracks connection transaction state
    const executeRaw = (sql: string) =>
      Effect.promise(async () => {
        // Simulate async invoke round-trip
        await new Promise((r) => setTimeout(r, Math.random() * 10));

        if (sql === "BEGIN IMMEDIATE") {
          if (activeTransaction) {
            throw new Error(
              "cannot start a transaction within a transaction",
            );
          }
          activeTransaction = true;
          log.push(`BEGIN`);
        } else if (sql === "COMMIT") {
          activeTransaction = false;
          log.push(`COMMIT`);
        } else if (sql === "ROLLBACK") {
          activeTransaction = false;
          log.push(`ROLLBACK`);
        } else {
          log.push(`SQL:${sql}`);
        }
      });

    // Simulate withWritePermit
    const withWritePermit = <A, E, R>(
      effect: Effect.Effect<A, E, R>,
    ): Effect.Effect<A, E, R> =>
      Effect.gen(function* () {
        const lockDepth = yield* FiberRef.get(writeLockDepthRef);
        if (lockDepth > 0) {
          return yield* effect;
        }
        return yield* writeSemaphore.withPermits(1)(
          Effect.locally(writeLockDepthRef, 1)(effect),
        );
      }) as Effect.Effect<A, E, R>;

    // Simulate ensureSettingsBootstrapped
    const ensureSettingsBootstrapped = () =>
      Effect.gen(function* () {
        const shouldBootstrap = yield* Effect.sync(() => {
          if (settingsBootstrapStarted) {
            return false;
          }
          settingsBootstrapStarted = true;
          return true;
        });

        if (shouldBootstrap) {
          // Bootstrap: writes some settings (like the real code)
          yield* withWritePermit(
            Effect.gen(function* () {
              yield* executeRaw("INSERT INTO app_settings VALUES (...)");
              yield* executeRaw("INSERT INTO app_settings VALUES (...)");
            }),
          );
          yield* settingsBootstrapLatch.open;
        } else {
          yield* settingsBootstrapLatch.await;
        }
      });

    // Simulate service.execute (called inside transaction body)
    const execute = (sql: string) =>
      ensureSettingsBootstrapped().pipe(
        Effect.flatMap(() => withWritePermit(executeRaw(sql))),
      );

    // Simulate service.transaction
    const transaction = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
      ensureSettingsBootstrapped().pipe(
        Effect.flatMap(() =>
          withWritePermit(
            Effect.uninterruptibleMask((restore) =>
              Effect.gen(function* () {
                yield* executeRaw("BEGIN IMMEDIATE");
                const operationExit = yield* Effect.exit(restore(effect));
                if (operationExit._tag === "Success") {
                  yield* executeRaw("COMMIT");
                  return operationExit.value;
                }
                yield* Effect.catchAll(executeRaw("ROLLBACK"), () =>
                  Effect.succeed(undefined),
                );
                return yield* Effect.failCause(operationExit.cause);
              }),
            ),
          ),
        ),
      );

    // Simulate saveDiagram (uses transaction with inner executes)
    const saveDiagram = () =>
      transaction(
        Effect.gen(function* () {
          yield* execute("INSERT INTO diagrams ...");
          yield* execute("INSERT INTO nodes ...");
          yield* execute("INSERT INTO edges ...");
          return { savedAt: Date.now() };
        }),
      );

    // Simulate patchSettings (also uses transaction)
    const patchSettings = () =>
      transaction(
        Effect.gen(function* () {
          yield* execute("INSERT INTO app_settings ...");
          return { saved: true };
        }),
      );

    // Run 5 concurrent saves + 2 settings patches (simulating real app)
    const results = await Promise.allSettled([
      Effect.runPromise(saveDiagram()),
      Effect.runPromise(patchSettings()),
      Effect.runPromise(saveDiagram()),
      Effect.runPromise(patchSettings()),
      Effect.runPromise(saveDiagram()),
    ]);

    console.log("Transaction log:", log);
    console.log(
      "Results:",
      results.map((r) => r.status),
    );

    // All should succeed — no "transaction within transaction" errors
    for (const result of results) {
      expect(result.status).toBe("fulfilled");
    }

    // Verify BEGIN/COMMIT pairs are never interleaved
    let depth = 0;
    for (const entry of log) {
      if (entry === "BEGIN") {
        depth++;
        expect(depth).toBe(1); // Never nested BEGINs
      } else if (entry === "COMMIT" || entry === "ROLLBACK") {
        depth--;
        expect(depth).toBe(0);
      }
    }
  });
});
