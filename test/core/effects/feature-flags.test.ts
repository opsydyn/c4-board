import {
  resolveEffectiveRigAgentV1Rollout,
  resolveRigAgentV1Flag,
  resolveSettingsV1Flag,
} from "@/core/effects/feature-flags";
import { describe, expect, it } from "vitest";

describe("resolveSettingsV1Flag", () => {
  it("uses fallback when no flag is present", () => {
    const result = resolveSettingsV1Flag({
      importMetaEnv: {},
      processEnv: {},
      fallback: false,
    });

    expect(result).toEqual({
      enabled: false,
      source: "default",
      envKey: null,
      rawValue: null,
    });
  });

  it("reads truthy import-meta env values", () => {
    const result = resolveSettingsV1Flag({
      importMetaEnv: {
        PUBLIC_SETTINGS_V1: "true",
      },
      processEnv: {},
    });

    expect(result.enabled).toBe(true);
    expect(result.source).toBe("env");
    expect(result.envKey).toBe("PUBLIC_SETTINGS_V1");
  });

  it("reads falsy process env values", () => {
    const result = resolveSettingsV1Flag({
      importMetaEnv: {},
      processEnv: {
        SETTINGS_V1: "0",
      },
    });

    expect(result.enabled).toBe(false);
    expect(result.source).toBe("env");
    expect(result.envKey).toBe("SETTINGS_V1");
  });

  it("ignores unparseable values and continues scanning keys", () => {
    const result = resolveSettingsV1Flag({
      importMetaEnv: {
        PUBLIC_SETTINGS_V1: "maybe",
        VITE_SETTINGS_V1: "yes",
      },
      processEnv: {},
      fallback: false,
    });

    expect(result.enabled).toBe(true);
    expect(result.envKey).toBe("VITE_SETTINGS_V1");
  });

  it("parses values case-insensitively with whitespace", () => {
    const result = resolveSettingsV1Flag({
      importMetaEnv: {
        PUBLIC_SETTINGS_V1: "  EnAbLeD  ",
      },
      processEnv: {},
      fallback: false,
    });

    expect(result.enabled).toBe(true);
    expect(result.source).toBe("env");
    expect(result.envKey).toBe("PUBLIC_SETTINGS_V1");
    expect(result.rawValue).toBe("  EnAbLeD  ");
  });

  it("falls back to process env when import-meta value is invalid", () => {
    const result = resolveSettingsV1Flag({
      importMetaEnv: {
        PUBLIC_SETTINGS_V1: "not-a-bool",
      },
      processEnv: {
        SETTINGS_V1: "false",
      },
      fallback: true,
    });

    expect(result.enabled).toBe(false);
    expect(result.source).toBe("env");
    expect(result.envKey).toBe("SETTINGS_V1");
    expect(result.rawValue).toBe("false");
  });
});

describe("resolveRigAgentV1Flag", () => {
  it("defaults to disabled when no rollout flag is present", () => {
    const result = resolveRigAgentV1Flag({
      importMetaEnv: {},
      processEnv: {},
    });

    expect(result).toEqual({
      mode: "disabled",
      source: "default",
      envKey: null,
      rawValue: null,
    });
  });

  it("reads canary env values", () => {
    const result = resolveRigAgentV1Flag({
      importMetaEnv: {
        PUBLIC_RIG_AGENT_V1: "canary",
      },
      processEnv: {},
    });

    expect(result.mode).toBe("canary");
    expect(result.source).toBe("env");
    expect(result.envKey).toBe("PUBLIC_RIG_AGENT_V1");
  });

  it("maps boolean-like truthy values to enabled", () => {
    const result = resolveRigAgentV1Flag({
      importMetaEnv: {},
      processEnv: {
        RIG_AGENT_V1: "true",
      },
    });

    expect(result.mode).toBe("enabled");
    expect(result.source).toBe("env");
    expect(result.envKey).toBe("RIG_AGENT_V1");
  });

  it("ignores invalid rollout values until a supported key is found", () => {
    const result = resolveRigAgentV1Flag({
      importMetaEnv: {
        PUBLIC_RIG_AGENT_V1: "later",
        VITE_RIG_AGENT_V1: "preview",
      },
      processEnv: {},
    });

    expect(result.mode).toBe("canary");
    expect(result.envKey).toBe("VITE_RIG_AGENT_V1");
  });
});

describe("resolveEffectiveRigAgentV1Rollout", () => {
  it("keeps canary disabled until the workstation opts in", () => {
    const result = resolveEffectiveRigAgentV1Rollout(
      {
        mode: "canary",
        source: "env",
        envKey: "RIG_AGENT_V1",
        rawValue: "canary",
      },
      "inherit",
    );

    expect(result.mode).toBe("disabled");
    expect(result.baseMode).toBe("canary");
    expect(result.source).toBe("default");
    expect(result.isEnabled).toBe(false);
  });

  it("activates canary once the workstation opts in", () => {
    const result = resolveEffectiveRigAgentV1Rollout(
      {
        mode: "canary",
        source: "env",
        envKey: "RIG_AGENT_V1",
        rawValue: "canary",
      },
      "canary",
    );

    expect(result.mode).toBe("canary");
    expect(result.source).toBe("settings");
    expect(result.isEnabled).toBe(true);
    expect(result.isCanary).toBe(true);
  });

  it("treats enabled env rollout as globally active", () => {
    const result = resolveEffectiveRigAgentV1Rollout(
      {
        mode: "enabled",
        source: "env",
        envKey: "RIG_AGENT_V1",
        rawValue: "enabled",
      },
      "inherit",
    );

    expect(result.mode).toBe("enabled");
    expect(result.source).toBe("env");
    expect(result.isEnabled).toBe(true);
  });
});
