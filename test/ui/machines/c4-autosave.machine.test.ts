import { createC4AutosaveMachine } from "@/ui/machines/c4-autosave.machine";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createActor } from "xstate";

describe("c4-autosave.machine", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces dirty events before triggering autosave", async () => {
    vi.useFakeTimers();
    const requestAutoSave = vi.fn(async () => true);
    const actor = createActor(createC4AutosaveMachine({ requestAutoSave }));
    actor.start();

    actor.send({
      type: "CONFIGURE",
      enabled: true,
      diagramId: "diagram-1",
      debounceMs: 300,
    });
    actor.send({ type: "MARK_DIRTY" });

    await vi.advanceTimersByTimeAsync(299);
    expect(requestAutoSave).toHaveBeenCalledTimes(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(requestAutoSave).toHaveBeenCalledTimes(1);
  });

  it("resets debounce window when additional dirty events arrive", async () => {
    vi.useFakeTimers();
    const requestAutoSave = vi.fn(async () => true);
    const actor = createActor(createC4AutosaveMachine({ requestAutoSave }));
    actor.start();

    actor.send({
      type: "CONFIGURE",
      enabled: true,
      diagramId: "diagram-1",
      debounceMs: 250,
    });
    actor.send({ type: "MARK_DIRTY" });

    await vi.advanceTimersByTimeAsync(200);
    actor.send({ type: "MARK_DIRTY" });
    await vi.advanceTimersByTimeAsync(200);
    expect(requestAutoSave).toHaveBeenCalledTimes(0);

    await vi.advanceTimersByTimeAsync(50);
    expect(requestAutoSave).toHaveBeenCalledTimes(1);
  });

  it("cancels pending debounce when requested", async () => {
    vi.useFakeTimers();
    const requestAutoSave = vi.fn(async () => true);
    const actor = createActor(createC4AutosaveMachine({ requestAutoSave }));
    actor.start();

    actor.send({
      type: "CONFIGURE",
      enabled: true,
      diagramId: "diagram-1",
      debounceMs: 200,
    });
    actor.send({ type: "MARK_DIRTY" });
    actor.send({ type: "CANCEL_PENDING" });

    await vi.advanceTimersByTimeAsync(500);
    expect(requestAutoSave).toHaveBeenCalledTimes(0);
  });
});
