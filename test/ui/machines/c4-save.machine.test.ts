import { type C4SaveRequest, type C4SaveSuccess, createC4SaveMachine } from "@/ui/machines/c4-save.machine";
import { describe, expect, it, vi } from "vitest";
import { createActor, waitFor } from "xstate";

const makeSuccess = (
  request: C4SaveRequest,
  savedAt: number | null = Date.now(),
): C4SaveSuccess => ({
  requestId: request.id,
  mode: request.mode,
  saved: savedAt !== null,
  savedAt,
});

describe("c4-save.machine", () => {
  it("processes a manual save and updates completion state", async () => {
    const persistRequest = vi.fn(async (request: C4SaveRequest) => makeSuccess(request, 1_700_000_000_000));

    const actor = createActor(createC4SaveMachine({ persistRequest }));
    actor.start();

    actor.send({
      type: "REQUEST_SAVE",
      request: { id: 1, mode: "manual" },
    });

    await waitFor(
      actor,
      (snapshot) =>
        snapshot.matches("idle")
        && snapshot.context.lastCompletedRequestId === 1,
    );

    const snapshot = actor.getSnapshot();
    expect(snapshot.context.lastCompletedOk).toBe(true);
    expect(snapshot.context.lastSavedAt).toBe(1_700_000_000_000);
    expect(persistRequest).toHaveBeenCalledTimes(1);
  });

  it("prioritizes queued manual saves ahead of queued autos", async () => {
    let releaseFirst: (value: C4SaveSuccess) => void = () => {
      throw new Error("First save resolver not captured");
    };
    const persistRequest = vi.fn((request: C4SaveRequest) => {
      if (request.id === 1) {
        return new Promise<C4SaveSuccess>((resolve) => {
          releaseFirst = resolve;
        });
      }

      return Promise.resolve(makeSuccess(request, request.id));
    });

    const actor = createActor(createC4SaveMachine({ persistRequest }));
    actor.start();

    actor.send({
      type: "REQUEST_SAVE",
      request: { id: 1, mode: "auto" },
    });
    actor.send({
      type: "REQUEST_SAVE",
      request: { id: 2, mode: "auto" },
    });
    actor.send({
      type: "REQUEST_SAVE",
      request: { id: 3, mode: "manual" },
    });

    expect(actor.getSnapshot().matches("saving")).toBe(true);
    expect(actor.getSnapshot().context.pendingRequests).toHaveLength(2);

    releaseFirst(makeSuccess({ id: 1, mode: "auto" }, 1));

    await waitFor(
      actor,
      (snapshot) =>
        snapshot.matches("idle")
        && snapshot.context.lastCompletedRequestId === 2,
    );

    expect(
      persistRequest.mock.calls.map(([request]) => (request as C4SaveRequest).id),
    ).toEqual([1, 3, 2]);
  });

  it("captures persist failures with normalized error state", async () => {
    const persistRequest = vi.fn(async (request: C4SaveRequest) => {
      throw `save failure ${request.id}`;
    });

    const actor = createActor(createC4SaveMachine({ persistRequest }));
    actor.start();

    actor.send({
      type: "REQUEST_SAVE",
      request: { id: 7, mode: "manual" },
    });

    await waitFor(
      actor,
      (snapshot) =>
        snapshot.matches("idle")
        && snapshot.context.lastCompletedRequestId === 7,
    );

    const snapshot = actor.getSnapshot();
    expect(snapshot.context.lastCompletedOk).toBe(false);
    expect(snapshot.context.errorMessage).toContain("save failure 7");
  });

  it("syncs saved timestamp and clears pending requests on command", async () => {
    const persistRequest = vi.fn(async (request: C4SaveRequest) => makeSuccess(request, 12));

    const actor = createActor(createC4SaveMachine({ persistRequest }));
    actor.start();

    actor.send({ type: "SYNC_LAST_SAVED_AT", savedAt: 88 });
    expect(actor.getSnapshot().context.lastSavedAt).toBe(88);

    actor.send({
      type: "REQUEST_SAVE",
      request: { id: 1, mode: "auto" },
    });
    actor.send({
      type: "REQUEST_SAVE",
      request: { id: 2, mode: "auto" },
    });

    actor.send({ type: "CLEAR_PENDING_REQUESTS" });
    expect(actor.getSnapshot().context.pendingRequests).toEqual([]);
  });
});
