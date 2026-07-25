import {
  clampPaneRatio,
  DEFAULT_PANE_RATIO,
  paneRatioFromDrag,
  parsePaneRatio,
  workspaceTemplateColumns,
} from "@/core/effects/postee/workspace-panes";
import { describe, expect, it } from "vitest";

/**
 * ADR-011 Phase 2. Request and response are peers in a fixed shell, so the split
 * between them is geometry the layout depends on: a ratio that escapes its bounds
 * collapses one pane to nothing with no way back.
 */

describe("clampPaneRatio", () => {
  it("keeps a sensible ratio untouched", () => {
    expect(clampPaneRatio(0.5)).toBe(0.5);
    expect(clampPaneRatio(0.34)).toBe(0.34);
  });

  it("never lets either pane collapse out of reach", () => {
    expect(clampPaneRatio(0)).toBeGreaterThan(0);
    expect(clampPaneRatio(1)).toBeLessThan(1);
    expect(clampPaneRatio(-5)).toBe(clampPaneRatio(0));
    expect(clampPaneRatio(5)).toBe(clampPaneRatio(1));
  });

  it("falls back to an even split for values that are not numbers", () => {
    expect(clampPaneRatio(Number.NaN)).toBe(DEFAULT_PANE_RATIO);
    expect(clampPaneRatio(Number.POSITIVE_INFINITY)).toBeLessThan(1);
  });
});

describe("workspaceTemplateColumns", () => {
  it("gives request and response the remaining width in the chosen ratio, with a track for the divider", () => {
    expect(workspaceTemplateColumns("240px", 0.5)).toBe("240px minmax(0, 50fr) auto minmax(0, 50fr)");
  });

  it("shifts width between the panes as the ratio moves", () => {
    expect(workspaceTemplateColumns("0px", 0.7)).toBe("0px minmax(0, 70fr) auto minmax(0, 30fr)");
  });

  it("drops the response track entirely when the pane is closed", () => {
    expect(workspaceTemplateColumns("240px", 0.5, { responseOpen: false })).toBe("240px minmax(0, 1fr)");
  });

  it("uses minmax(0, …) so a pane can shrink below its content", () => {
    // Without the 0 minimum a grid track refuses to shrink and the shell overflows.
    expect(workspaceTemplateColumns("0px", 0.5)).toContain("minmax(0,");
  });
});

describe("paneRatioFromDrag", () => {
  it("derives the ratio from the pointer position within the split area", () => {
    expect(paneRatioFromDrag({ pointerX: 600, splitLeft: 200, splitWidth: 800 })).toBeCloseTo(0.5);
  });

  it("clamps a drag past either edge", () => {
    expect(paneRatioFromDrag({ pointerX: 0, splitLeft: 200, splitWidth: 800 })).toBe(clampPaneRatio(0));
    expect(paneRatioFromDrag({ pointerX: 9_999, splitLeft: 200, splitWidth: 800 })).toBe(clampPaneRatio(1));
  });

  it("is an even split when the split area has no width yet", () => {
    expect(paneRatioFromDrag({ pointerX: 100, splitLeft: 0, splitWidth: 0 })).toBe(DEFAULT_PANE_RATIO);
  });
});

describe("parsePaneRatio", () => {
  it("restores a persisted ratio", () => {
    expect(parsePaneRatio("0.62")).toBeCloseTo(0.62);
  });

  it("falls back to an even split for anything unusable", () => {
    expect(parsePaneRatio(null)).toBe(DEFAULT_PANE_RATIO);
    expect(parsePaneRatio("")).toBe(DEFAULT_PANE_RATIO);
    expect(parsePaneRatio("not a number")).toBe(DEFAULT_PANE_RATIO);
  });

  it("clamps a persisted value that would collapse a pane", () => {
    expect(parsePaneRatio("0.99")).toBe(clampPaneRatio(1));
  });
});
