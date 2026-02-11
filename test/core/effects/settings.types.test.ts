import {
  APP_SETTING_KEYS,
  AppSettingsSchema,
  DEFAULT_APP_SETTINGS,
  isAppSettingKey,
} from "@/core/effects/settings.types";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("settings.types", () => {
  it("decodes default settings", () => {
    const decoded = Schema.decodeUnknownSync(AppSettingsSchema)(
      DEFAULT_APP_SETTINGS,
    );
    expect(decoded).toEqual(DEFAULT_APP_SETTINGS);
  });

  it("rejects invalid master volume", () => {
    expect(() =>
      Schema.decodeUnknownSync(AppSettingsSchema)({
        ...DEFAULT_APP_SETTINGS,
        masterVolume: 1.5,
      })
    ).toThrow();
  });

  it("rejects out-of-range autosave interval", () => {
    expect(() =>
      Schema.decodeUnknownSync(AppSettingsSchema)({
        ...DEFAULT_APP_SETTINGS,
        autosaveIntervalMs: 100,
      })
    ).toThrow();
  });

  it("rejects out-of-range mud alert threshold", () => {
    expect(() =>
      Schema.decodeUnknownSync(AppSettingsSchema)({
        ...DEFAULT_APP_SETTINGS,
        bigBallOfMudAlertThreshold: 4.9,
      })
    ).toThrow();
  });

  it("exports stable setting keys and key guard", () => {
    expect(APP_SETTING_KEYS.length).toBeGreaterThan(0);
    expect(isAppSettingKey("autosaveEnabled")).toBe(true);
    expect(isAppSettingKey("not_a_real_setting")).toBe(false);
  });
});
