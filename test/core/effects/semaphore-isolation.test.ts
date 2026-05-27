/**
 * Verification test: Does an Effect.Semaphore serialize across
 * separate Effect.runPromise() calls?
 *
 * If it does NOT, two concurrent runPromise calls will interleave
 * and the log will show overlapping critical sections.
 */
import { describe, expect, it } from "vitest";
import { Effect } from "effect";

describe("Effect.Semaphore cross-fiber isolation", () => {
  it("should serialize critical sections across separate Effect.runPromise calls", async () => {
    const semaphore = Effect.runSync(Effect.makeSemaphore(1));
    const log: string[] = [];

    const criticalSection = (id: string) =>
      semaphore.withPermits(1)(
        Effect.gen(function* () {
          log.push(`${id}:enter`);
          // Yield to event loop to allow interleaving if semaphore doesn't work
          yield* Effect.promise(() => new Promise((r) => setTimeout(r, 50)));
          log.push(`${id}:exit`);
        }),
      );

    // Launch two concurrent Effect.runPromise calls (separate fibers)
    const [, ] = await Promise.all([
      Effect.runPromise(criticalSection("A")),
      Effect.runPromise(criticalSection("B")),
    ]);

    // If semaphore works: A:enter, A:exit, B:enter, B:exit (or B first)
    // If semaphore DOESN'T work: A:enter, B:enter, A:exit, B:exit (interleaved)
    const aEnter = log.indexOf("A:enter");
    const aExit = log.indexOf("A:exit");
    const bEnter = log.indexOf("B:enter");
    const bExit = log.indexOf("B:exit");

    expect(log).toHaveLength(4);

    // Check no interleaving: one must fully complete before the other starts
    const aFullyBeforeB = aExit < bEnter;
    const bFullyBeforeA = bExit < aEnter;
    const serialized = aFullyBeforeB || bFullyBeforeA;

    expect(serialized).toBe(true);
  });
});
