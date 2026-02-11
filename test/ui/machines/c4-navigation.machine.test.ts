import { createC4NavigationMachine } from "@/ui/machines/c4-navigation.machine";
import { describe, expect, it, vi } from "vitest";
import { createActor, waitFor } from "xstate";

describe("c4-navigation.machine", () => {
  it("saves before navigation when save-on-navigate is enabled", async () => {
    const flushPendingInlineEdits = vi.fn(async () => undefined);
    const requestManualSave = vi.fn(async () => true);
    const navigateTo = vi.fn();

    const actor = createActor(
      createC4NavigationMachine({
        flushPendingInlineEdits,
        requestManualSave,
        navigateTo,
      }),
    );
    actor.start();

    actor.send({
      type: "NAVIGATE",
      href: "/postee",
      saveOnNavigate: true,
    });

    await waitFor(
      actor,
      (snapshot) =>
        snapshot.context.targetHref === "/postee"
        && snapshot.context.lastSaveCompleted,
    );

    expect(flushPendingInlineEdits).toHaveBeenCalledTimes(1);
    expect(requestManualSave).toHaveBeenCalledTimes(1);
    expect(navigateTo).toHaveBeenCalledWith("/postee");
    expect(actor.getSnapshot().context.lastSaveCompleted).toBe(true);
  });

  it("navigates directly when save-on-navigate is disabled", async () => {
    const flushPendingInlineEdits = vi.fn(async () => undefined);
    const requestManualSave = vi.fn(async () => true);
    const navigateTo = vi.fn();

    const actor = createActor(
      createC4NavigationMachine({
        flushPendingInlineEdits,
        requestManualSave,
        navigateTo,
      }),
    );
    actor.start();

    actor.send({
      type: "NAVIGATE",
      href: "/saved-diagrams",
      saveOnNavigate: false,
    });

    await waitFor(
      actor,
      (snapshot) => snapshot.context.targetHref === "/saved-diagrams",
    );

    expect(flushPendingInlineEdits).toHaveBeenCalledTimes(0);
    expect(requestManualSave).toHaveBeenCalledTimes(0);
    expect(navigateTo).toHaveBeenCalledWith("/saved-diagrams");
    expect(actor.getSnapshot().context.lastSaveCompleted).toBe(false);
  });

  it("returns to idle state when navigation pipeline fails", async () => {
    const flushPendingInlineEdits = vi.fn(async () => undefined);
    const requestManualSave = vi.fn(async () => {
      throw new Error("save exploded");
    });
    const navigateTo = vi.fn();

    const actor = createActor(
      createC4NavigationMachine({
        flushPendingInlineEdits,
        requestManualSave,
        navigateTo,
      }),
    );
    actor.start();

    actor.send({
      type: "NAVIGATE",
      href: "/settings",
      saveOnNavigate: true,
    });

    await waitFor(
      actor,
      (snapshot) =>
        snapshot.matches("idle")
        && snapshot.context.errorMessage?.includes("save exploded") === true,
    );

    expect(navigateTo).toHaveBeenCalledTimes(0);
  });
});
