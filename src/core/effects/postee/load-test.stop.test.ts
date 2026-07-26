import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stopLoadTest } from "./load-test";

/**
 * ADR-019. Stopping a run.
 *
 * There was no way to stop a load test: `start_load_test` was the only command,
 * and the engine's workers checked nothing but elapsed time. A mistyped duration
 * or a wrong URL kept sending real traffic until it chose to finish.
 *
 * Stopping is idempotent on both sides. The button is enabled while a run is in
 * flight, but a run can finish between the render and the click, so "stop
 * nothing" has to be a no-op rather than an error — otherwise aborting would
 * sometimes show a failure for having worked.
 */

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

/** The runtime guard reads this injection; without it every call waits for detection. */
const tauriWindow = globalThis.window as unknown as { __TAURI_INTERNALS__?: unknown };

beforeEach(() => {
  tauriWindow.__TAURI_INTERNALS__ = {};
});

afterEach(() => {
  delete tauriWindow.__TAURI_INTERNALS__;
  invokeMock.mockReset();
});

describe("stopLoadTest", () => {
  it("asks the backend to stop the run", async () => {
    invokeMock.mockResolvedValue(undefined);

    await Effect.runPromise(stopLoadTest());

    expect(invokeMock).toHaveBeenCalledWith("stop_load_test");
  });

  it("succeeds when there is no run to stop", async () => {
    // The backend treats an absent handle as a no-op; this pins that the effect
    // does not invent a failure the user would have to dismiss.
    invokeMock.mockResolvedValue(undefined);

    await expect(Effect.runPromise(stopLoadTest())).resolves.toBeUndefined();
  });

  it("can be called twice", async () => {
    invokeMock.mockResolvedValue(undefined);

    await Effect.runPromise(stopLoadTest());
    await Effect.runPromise(stopLoadTest());

    expect(invokeMock).toHaveBeenCalledTimes(2);
  });

  it("reports a runtime failure as a typed error rather than throwing", async () => {
    invokeMock.mockRejectedValue(new Error("ipc exploded"));

    const exit = await Effect.runPromiseExit(stopLoadTest());

    expect(exit._tag).toBe("Failure");
  });
});
