/**
 * Grid tracks for the C4 workspace shell.
 *
 * Four columns, always present so that opening a panel is a track resize rather
 * than a reflow: sidebar, canvas, details, OPY. A closed panel is `0px`, which
 * keeps the canvas in column 2 whatever else is open — components can hard-code
 * their column and never care what their neighbours are doing.
 *
 * OPY is a column, not a row. It was docked across the bottom, which read as a
 * different product from the OPY drawer in Postee; a right-hand column is the
 * same gesture on both surfaces.
 */

/** Closed panels keep their track so column indices never shift. */
const CLOSED = "0px";

const SIDEBAR = "minmax(260px, 320px)";
const DETAILS = "minmax(340px, 420px)";
const OPY = "minmax(340px, 440px)";
/** A compact viewport has no details column, but the canvas still needs room. */
const OPY_COMPACT = "minmax(280px, 360px)";

export interface CanvasWorkspaceColumnsInput {
  readonly isSidebarOpen: boolean;
  readonly isDetailsOpen: boolean;
  readonly isCompactLayout: boolean;
  readonly isOpyDrawerOpen: boolean;
}

export const canvasWorkspaceTemplateColumns = (
  { isSidebarOpen, isDetailsOpen, isCompactLayout, isOpyDrawerOpen }: CanvasWorkspaceColumnsInput,
): string => {
  const sidebar = isSidebarOpen ? SIDEBAR : CLOSED;
  // Compact viewports drop the details panel entirely, open or not.
  const details = isDetailsOpen && !isCompactLayout ? DETAILS : CLOSED;
  const opy = isOpyDrawerOpen ? (isCompactLayout ? OPY_COMPACT : OPY) : CLOSED;

  return `${sidebar} 1fr ${details} ${opy}`;
};

export interface CanvasWorkspaceRowsInput {
  readonly isLayoutPreviewOpen: boolean;
  readonly isDataBarOpen: boolean;
}

/** The bottom row is for surfaces that genuinely span the width. OPY no longer does. */
export const canvasWorkspaceTemplateRows = (
  { isLayoutPreviewOpen, isDataBarOpen }: CanvasWorkspaceRowsInput,
): string => (isLayoutPreviewOpen || isDataBarOpen ? "1fr auto" : "1fr");
