import { canvasWorkspaceTemplateColumns, canvasWorkspaceTemplateRows } from "@/core/effects/canvas-workspace-tracks";
import { describe, expect, it } from "vitest";

/**
 * The workspace grid decides where OPY lives. It used to be a full-width row
 * pinned under the canvas; it is now a column on the right, so it reads the same
 * way as the OPY drawer in Postee.
 *
 * The tracks were computed inline in a 3000-line component, which meant no test
 * could reach them. They are pure string arithmetic over four booleans — exactly
 * the kind of thing that belongs in the functional core.
 */

const columns = canvasWorkspaceTemplateColumns;
const rows = canvasWorkspaceTemplateRows;

describe("canvasWorkspaceTemplateColumns", () => {
  it("gives the canvas everything the panels do not take", () => {
    expect(columns({ isSidebarOpen: false, isDetailsOpen: false, isCompactLayout: false, isOpyDrawerOpen: false }))
      .toBe("0px 1fr 0px 0px");
  });

  it("opens the sidebar on the left and the details panel on the right", () => {
    expect(columns({ isSidebarOpen: true, isDetailsOpen: true, isCompactLayout: false, isOpyDrawerOpen: false }))
      .toBe("minmax(260px, 320px) 1fr minmax(340px, 420px) 0px");
  });

  it("collapses the details panel in a compact layout even when it is open", () => {
    expect(columns({ isSidebarOpen: false, isDetailsOpen: true, isCompactLayout: true, isOpyDrawerOpen: false }))
      .toBe("0px 1fr 0px 0px");
  });

  it("puts the OPY drawer in the last column rather than under the canvas", () => {
    const track = columns({
      isSidebarOpen: true,
      isDetailsOpen: false,
      isCompactLayout: false,
      isOpyDrawerOpen: true,
    });

    expect(track.endsWith("0px")).toBe(false);
    expect(track).toBe("minmax(260px, 320px) 1fr 0px minmax(340px, 440px)");
  });

  it("narrows the OPY column in a compact layout so the canvas survives", () => {
    expect(columns({ isSidebarOpen: false, isDetailsOpen: false, isCompactLayout: true, isOpyDrawerOpen: true }))
      .toBe("0px 1fr 0px minmax(280px, 360px)");
  });

  it("keeps the canvas flexible with every panel open", () => {
    expect(columns({ isSidebarOpen: true, isDetailsOpen: true, isCompactLayout: false, isOpyDrawerOpen: true }))
      .toContain("1fr");
  });
});

describe("canvasWorkspaceTemplateRows", () => {
  it("is a single row when nothing is docked at the bottom", () => {
    expect(rows({ isLayoutPreviewOpen: false, isDataBarOpen: false })).toBe("1fr");
  });

  it("adds a bottom row for the data bar", () => {
    expect(rows({ isLayoutPreviewOpen: false, isDataBarOpen: true })).toBe("1fr auto");
  });

  it("adds a bottom row for the layout preview", () => {
    expect(rows({ isLayoutPreviewOpen: true, isDataBarOpen: false })).toBe("1fr auto");
  });
});
