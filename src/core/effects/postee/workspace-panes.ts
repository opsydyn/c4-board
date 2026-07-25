/**
 * Geometry for the request/response split — ADR-011.
 *
 * The workspace shell is a fixed-height grid, so the split between the two panes
 * is load-bearing: a ratio outside its bounds collapses one pane to nothing, and
 * a collapsed pane has no handle left to drag back. Every value that reaches the
 * grid passes through `clampPaneRatio` for that reason.
 */

/** An even split — what the workspace opens with and falls back to. */
export const DEFAULT_PANE_RATIO = 0.5;

/** Neither pane may take less than this share, so both stay usable and grabbable. */
const MIN_PANE_RATIO = 0.2;
const MAX_PANE_RATIO = 1 - MIN_PANE_RATIO;

export const clampPaneRatio = (ratio: number): number => {
  if (!Number.isFinite(ratio)) return DEFAULT_PANE_RATIO;
  return Math.min(MAX_PANE_RATIO, Math.max(MIN_PANE_RATIO, ratio));
};

/**
 * Grid tracks for the shell: sidebar, request, response.
 *
 * `minmax(0, …)` rather than a bare `fr` is deliberate — a grid track's automatic
 * minimum is its content, so without the explicit `0` a wide response refuses to
 * shrink and pushes the shell past the viewport, undoing Phase 1.
 */
export const workspaceTemplateColumns = (
  leftTrack: string,
  ratio: number,
  options: { readonly responseOpen?: boolean } = {},
): string => {
  if (options.responseOpen === false) return `${leftTrack} minmax(0, 1fr)`;
  const request = Math.round(clampPaneRatio(ratio) * 100);
  // The `auto` track is the divider itself, which sits between the panes rather
  // than overlaying them so it can never cover pane content.
  return `${leftTrack} minmax(0, ${request}fr) auto minmax(0, ${100 - request}fr)`;
};

/** Ratio implied by a pointer at `pointerX` within the split area. */
export const paneRatioFromDrag = (input: {
  readonly pointerX: number;
  readonly splitLeft: number;
  readonly splitWidth: number;
}): number => {
  if (input.splitWidth <= 0) return DEFAULT_PANE_RATIO;
  return clampPaneRatio((input.pointerX - input.splitLeft) / input.splitWidth);
};

/** Restores a persisted ratio, tolerating anything a stored string might hold. */
export const parsePaneRatio = (stored: string | null | undefined): number => {
  if (!stored) return DEFAULT_PANE_RATIO;
  const parsed = Number.parseFloat(stored);
  return Number.isFinite(parsed) ? clampPaneRatio(parsed) : DEFAULT_PANE_RATIO;
};
