import { normalizeAppSettingsCandidate } from "@/core/effects/settings.runtime";
import { DEFAULT_APP_SETTINGS } from "@/core/effects/settings.types";
import { describe, expect, it } from "vitest";

describe("settings.runtime", () => {
  it("normalizes invalid OPY surface mode values to the fallback setting", () => {
    const normalized = normalizeAppSettingsCandidate(
      {
        ...DEFAULT_APP_SETTINGS,
        opySurfaceMode: "fullscreen",
      },
      DEFAULT_APP_SETTINGS,
    );

    expect(normalized.opySurfaceMode).toBe("drawer");
  });

  it("normalizes legacy OPY persisted settings into schema-safe values", () => {
    const normalized = normalizeAppSettingsCandidate(
      {
        ...DEFAULT_APP_SETTINGS,
        opyWidgetPresence: "surface",
        opyWidgetLayout: {
          placement: "custom",
          mode: "mission",
          snapTarget: "free",
          x: -40,
          y: 20_000,
          width: 8_200,
          height: 40,
        },
        opyWidgetModeLayouts: {
          field: {
            placement: "centered",
            mode: "field",
            snapTarget: "center",
            x: -200,
            y: 32,
            width: 120,
            height: 8_000,
          },
          mission: {
            placement: "custom",
            mode: "mission",
            snapTarget: "right-rail",
            x: 18_000,
            y: 72,
            width: 2_048,
            height: 1_024,
          },
        },
        opyViewportSections: {
          control: true,
          diagnostics: "yes",
          checkpoints: false,
          review: null,
          proposal: true,
        },
        opyTaskHistoryFiltersBySession: {
          "session-a": {
            chain: "   ",
            boundary: "unknown",
            chainScope: "also-unknown",
          },
        },
      },
      DEFAULT_APP_SETTINGS,
    );

    expect(normalized.opyWidgetPresence).toBe("field");
    expect(normalized.opyWidgetLayout).toMatchObject({
      x: 0,
      y: 16_384,
      width: 4_096,
      height: 420,
    });
    expect(normalized.opyWidgetModeLayouts).toMatchObject({
      field: {
        x: 0,
        width: 360,
        height: 4_096,
      },
      mission: {
        x: 16_384,
        width: 2_048,
        height: 1_024,
      },
    });
    expect(normalized.opyViewportSections).toEqual({
      control: true,
      diagnostics: false,
      checkpoints: false,
      review: false,
      proposal: true,
    });
    expect(normalized.opyTaskHistoryFiltersBySession).toEqual({
      "session-a": {
        chain: "all",
        boundary: "all",
        chainScope: "all",
      },
    });
  });
});
