import { resolveSettingsV1Flag } from "@/core/effects/feature-flags";
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
