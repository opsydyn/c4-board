import { type AppSettings, DEFAULT_APP_SETTINGS } from "@/core/effects/settings.types";
import { createSettingsMachine } from "@/ui/machines/settings.machine";
import { describe, expect, it, vi } from "vitest";
import { createActor, waitFor } from "xstate";

const enabledFlag = {
  enabled: true,
  source: "default" as const,
  envKey: null,
  rawValue: null,
};

const disabledFlag = {
  enabled: false,
  source: "default" as const,
  envKey: null,
  rawValue: null,
};

describe("settings.machine", () => {
  it("enters disabled when settings_v1 is off", () => {
    const runEffect = vi.fn().mockResolvedValue(DEFAULT_APP_SETTINGS);
    const actor = createActor(
      createSettingsMachine({
        runEffect,
        settingsV1Flag: disabledFlag,
      }),
    );

    actor.start();

    expect(actor.getSnapshot().matches("disabled")).toBe(true);
    expect(runEffect).not.toHaveBeenCalled();
  });

  it("loads settings and reaches ready.synced", async () => {
    const loadedSettings: AppSettings = {
      ...DEFAULT_APP_SETTINGS,
      autosaveIntervalMs: 2_000,
      saveOnNavigate: false,
    };
    const runEffect = vi.fn().mockResolvedValueOnce(loadedSettings);

    const actor = createActor(
      createSettingsMachine({
        runEffect,
        settingsV1Flag: enabledFlag,
      }),
    );
    actor.start();

    await waitFor(actor, (snapshot) => snapshot.matches("synced"));

    expect(actor.getSnapshot().context.settings).toEqual(loadedSettings);
    expect(runEffect).toHaveBeenCalledTimes(1);
  });

  it("serializes queued patches and applies final committed settings", async () => {
    const afterFirstPatch: AppSettings = {
      ...DEFAULT_APP_SETTINGS,
      autosaveEnabled: false,
    };
    const afterSecondPatch: AppSettings = {
      ...afterFirstPatch,
      saveOnNavigate: false,
    };

    const runEffect = vi
      .fn()
      .mockResolvedValueOnce(DEFAULT_APP_SETTINGS)
      .mockResolvedValueOnce(afterFirstPatch)
      .mockResolvedValueOnce(afterSecondPatch);

    const actor = createActor(
      createSettingsMachine({
        runEffect,
        settingsV1Flag: enabledFlag,
      }),
    );
    actor.start();

    await waitFor(actor, (snapshot) => snapshot.matches("synced"));

    actor.send({
      type: "PATCH",
      patch: { autosaveEnabled: false },
    });
    actor.send({
      type: "PATCH",
      patch: { saveOnNavigate: false },
    });

    await waitFor(
      actor,
      (snapshot) =>
        snapshot.matches("synced")
        && snapshot.context.pendingWrites === 0
        && snapshot.context.settings.saveOnNavigate === false
        && snapshot.context.settings.autosaveEnabled === false,
    );

    expect(runEffect).toHaveBeenCalledTimes(3);
    expect(actor.getSnapshot().context.lastSavedAt).not.toBeNull();
  });

  it("recovers from write failure by reloading and entering error state", async () => {
    const runEffect = vi
      .fn()
      .mockResolvedValueOnce(DEFAULT_APP_SETTINGS)
      .mockRejectedValueOnce(new Error("database is locked"))
      .mockResolvedValueOnce(DEFAULT_APP_SETTINGS);

    const actor = createActor(
      createSettingsMachine({
        runEffect,
        settingsV1Flag: enabledFlag,
      }),
    );
    actor.start();

    await waitFor(actor, (snapshot) => snapshot.matches("synced"));

    actor.send({
      type: "PATCH",
      patch: { autosaveEnabled: false },
    });

    await waitFor(actor, (snapshot) => snapshot.matches("error"));

    const snapshot = actor.getSnapshot();
    expect(snapshot.context.errorMessage).toContain("database is locked");
    expect(snapshot.context.pendingWrites).toBe(0);
  });
});
