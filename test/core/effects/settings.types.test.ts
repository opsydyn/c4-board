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
    expect(isAppSettingKey("azurePanelVisible")).toBe(true);
    expect(isAppSettingKey("ownershipLensVisible")).toBe(true);
    expect(isAppSettingKey("couplingExplainabilityVisible")).toBe(true);
    expect(isAppSettingKey("opyCopilotVisible")).toBe(true);
    expect(isAppSettingKey("openAiApiKey")).toBe(true);
    expect(isAppSettingKey("aiSettings")).toBe(true);
    expect(isAppSettingKey("rigAgentRolloutPreference")).toBe(true);
    expect(isAppSettingKey("rigExecutionPolicy")).toBe(true);
    expect(isAppSettingKey("agentPolicy")).toBe(true);
    expect(isAppSettingKey("not_a_real_setting")).toBe(false);
  });

  it("defaults panel toggles to hidden", () => {
    expect(DEFAULT_APP_SETTINGS.azurePanelVisible).toBe(false);
    expect(DEFAULT_APP_SETTINGS.ownershipLensVisible).toBe(false);
    expect(DEFAULT_APP_SETTINGS.couplingExplainabilityVisible).toBe(false);
    expect(DEFAULT_APP_SETTINGS.opyCopilotVisible).toBe(false);
  });

  it("rejects oversized OpenAI API key values", () => {
    expect(() =>
      Schema.decodeUnknownSync(AppSettingsSchema)({
        ...DEFAULT_APP_SETTINGS,
        openAiApiKey: "x".repeat(4_097),
      })
    ).toThrow();
  });

  it("rejects invalid aiSettings.actionMode values", () => {
    expect(() =>
      Schema.decodeUnknownSync(AppSettingsSchema)({
        ...DEFAULT_APP_SETTINGS,
        aiSettings: {
          ...DEFAULT_APP_SETTINGS.aiSettings,
          actionMode: "auto-apply",
        },
      })
    ).toThrow();
  });

  it("rejects invalid aiSettings.temperature values", () => {
    expect(() =>
      Schema.decodeUnknownSync(AppSettingsSchema)({
        ...DEFAULT_APP_SETTINGS,
        aiSettings: {
          ...DEFAULT_APP_SETTINGS.aiSettings,
          temperature: 2.5,
        },
      })
    ).toThrow();
  });

  it("rejects invalid rig rollout preference values", () => {
    expect(() =>
      Schema.decodeUnknownSync(AppSettingsSchema)({
        ...DEFAULT_APP_SETTINGS,
        rigAgentRolloutPreference: "enabled",
      })
    ).toThrow();
  });

  it("rejects invalid agentPolicy values", () => {
    expect(() =>
      Schema.decodeUnknownSync(AppSettingsSchema)({
        ...DEFAULT_APP_SETTINGS,
        agentPolicy: {
          ...DEFAULT_APP_SETTINGS.agentPolicy,
          maxActionsPerBatch: -1,
        },
      })
    ).toThrow();

    expect(() =>
      Schema.decodeUnknownSync(AppSettingsSchema)({
        ...DEFAULT_APP_SETTINGS,
        agentPolicy: {
          ...DEFAULT_APP_SETTINGS.agentPolicy,
          maxNodesCreatedPerRun: 999,
        },
      })
    ).toThrow();
  });

  it("rejects invalid rigExecutionPolicy values", () => {
    expect(() =>
      Schema.decodeUnknownSync(AppSettingsSchema)({
        ...DEFAULT_APP_SETTINGS,
        rigExecutionPolicy: {
          ...DEFAULT_APP_SETTINGS.rigExecutionPolicy,
          allowedProviders: ["azure-openai"],
        },
      })
    ).toThrow();

    expect(() =>
      Schema.decodeUnknownSync(AppSettingsSchema)({
        ...DEFAULT_APP_SETTINGS,
        rigExecutionPolicy: {
          ...DEFAULT_APP_SETTINGS.rigExecutionPolicy,
          allowedModels: [""],
        },
      })
    ).toThrow();
  });
});
