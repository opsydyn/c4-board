import { createC4PanelPreferencesMachine } from "@/ui/machines/c4-panel-preferences.machine";
import { describe, expect, it, vi } from "vitest";
import { createActor, waitFor } from "xstate";

describe("c4-panel-preferences.machine", () => {
  it("hydrates from settings and persists toggle updates", async () => {
    const persistPatch = vi.fn().mockResolvedValue(undefined);
    const actor = createActor(
      createC4PanelPreferencesMachine({
        persistPatch,
      }),
    );
    const emittedChanges: Array<{ key: string; value: boolean }> = [];
    const subscription = actor.on("panelPreferenceChanged", (event) => {
      emittedChanges.push({
        key: event.key,
        value: event.value,
      });
    });

    actor.start();
    actor.send({
      type: "HYDRATE",
      values: {
        azurePanelVisible: true,
        ownershipLensVisible: false,
        couplingExplainabilityVisible: true,
        opyCopilotVisible: false,
      },
    });

    expect(actor.getSnapshot().context.azurePanelVisible).toBe(true);
    expect(actor.getSnapshot().context.couplingExplainabilityVisible).toBe(true);

    actor.send({ type: "TOGGLE_AZURE_PANEL" });

    await waitFor(
      actor,
      (snapshot) => snapshot.matches("idle") && snapshot.context.activePatch === null,
    );

    expect(actor.getSnapshot().context.azurePanelVisible).toBe(false);
    expect(persistPatch).toHaveBeenCalledWith({ azurePanelVisible: false });
    expect(emittedChanges).toContainEqual({
      key: "azurePanelVisible",
      value: false,
    });

    subscription.unsubscribe();
  });

  it("persists OPY copilot visibility toggle", async () => {
    const persistPatch = vi.fn().mockResolvedValue(undefined);
    const actor = createActor(
      createC4PanelPreferencesMachine({
        persistPatch,
      }),
    );

    actor.start();
    actor.send({ type: "TOGGLE_OPY_COPILOT" });

    await waitFor(
      actor,
      (snapshot) => snapshot.matches("idle") && snapshot.context.activePatch === null,
    );

    expect(actor.getSnapshot().context.opyCopilotVisible).toBe(true);
    expect(persistPatch).toHaveBeenCalledWith({ opyCopilotVisible: true });
  });

  it("queues toggles while persistence is in-flight", async () => {
    let resolveFirstPersist: () => void = () => undefined;
    const firstPersist = new Promise<void>((resolve) => {
      resolveFirstPersist = resolve;
    });
    const persistPatch = vi
      .fn()
      .mockImplementationOnce(() => firstPersist)
      .mockResolvedValue(undefined);
    const actor = createActor(
      createC4PanelPreferencesMachine({
        persistPatch,
      }),
    );

    actor.start();
    actor.send({ type: "TOGGLE_AZURE_PANEL" });

    await waitFor(
      actor,
      (snapshot) => snapshot.matches("persisting") && persistPatch.mock.calls.length === 1,
    );

    actor.send({ type: "TOGGLE_OWNERSHIP_LENS" });
    resolveFirstPersist();

    await waitFor(
      actor,
      (snapshot) => snapshot.matches("idle") && persistPatch.mock.calls.length === 2,
    );

    expect(persistPatch.mock.calls[0]?.[0]).toEqual({
      azurePanelVisible: true,
    });
    expect(persistPatch.mock.calls[1]?.[0]).toEqual({
      ownershipLensVisible: true,
    });
    expect(actor.getSnapshot().context.azurePanelVisible).toBe(true);
    expect(actor.getSnapshot().context.ownershipLensVisible).toBe(true);
  });

  it("emits persistence failures without losing local toggle state", async () => {
    const persistPatch = vi.fn().mockRejectedValue(new Error("database is locked"));
    const actor = createActor(
      createC4PanelPreferencesMachine({
        persistPatch,
      }),
    );
    let failureEvent:
      | { patch: Record<string, boolean>; message: string }
      | null = null;
    const subscription = actor.on("panelPreferencePersistFailed", (event) => {
      failureEvent = {
        patch: event.patch as Record<string, boolean>,
        message: event.message,
      };
    });

    actor.start();
    actor.send({ type: "TOGGLE_COUPLING_EXPLAINABILITY" });

    await waitFor(
      actor,
      (snapshot) => snapshot.matches("idle") && snapshot.context.errorMessage !== null,
    );

    expect(actor.getSnapshot().context.couplingExplainabilityVisible).toBe(true);
    expect(actor.getSnapshot().context.errorMessage).toContain("database is locked");
    expect(failureEvent).toEqual({
      patch: { couplingExplainabilityVisible: true },
      message: "database is locked",
    });

    subscription.unsubscribe();
  });
});
