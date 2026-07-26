/**
 * Which view the app opens in.
 *
 * Leaving the app in Postee and reopening it put you on the board: Tauri loads
 * the entry page and nothing recorded where you had been.
 *
 * The subtlety is that this is a multi-page app. Every navigation is a full page
 * load, so from the page's point of view "the app just started" is
 * indistinguishable from "the user clicked through to the board" — and a restore
 * that cannot tell them apart makes the board unreachable from Postee. A session
 * marker separates them: it survives navigation within the app and dies with the
 * window, so exactly one page load per launch sees it missing.
 *
 * Part of the functional core: no storage access, no navigation.
 */

/** The workspaces. Utility pages are somewhere you visit and come back from. */
export const RESUMABLE_ROUTES = ["/", "/postee"] as const;

export type ResumableRoute = (typeof RESUMABLE_ROUTES)[number];

/** Where the last view is kept, so it outlives the process. */
export const LAST_VIEW_KEY = "c4b:last-view";

/** Set on the first page load of a launch, and gone once the window closes. */
export const SESSION_KEY = "c4b:session-started";

/** `/postee/` and `/postee` are the same view; the server may serve either. */
const normalise = (path: string): string => {
  const trimmed = path.trim();
  if (trimmed.length > 1 && trimmed.endsWith("/")) return trimmed.slice(0, -1);
  return trimmed;
};

const isResumable = (path: string): path is ResumableRoute =>
  (RESUMABLE_ROUTES as ReadonlyArray<string>).includes(path);

/**
 * The route worth recording as the landing view, or null to leave the previous
 * one alone. Visiting Settings should not change where the app opens.
 */
export const rememberableRoute = (path: string): ResumableRoute | null => {
  const normalised = normalise(path);
  return isResumable(normalised) ? normalised : null;
};

export interface LaunchRouteInput {
  readonly currentPath: string;
  readonly savedRoute: string | null;
  /** False once this launch has already resolved its landing view. */
  readonly isFirstLoadOfSession: boolean;
}

/**
 * Where to send this page load, or null to stay. Null is the common answer: it
 * only redirects on the first load of a launch that landed on the entry page and
 * has somewhere else recorded.
 */
export const resolveLaunchRoute = (
  { currentPath, savedRoute, isFirstLoadOfSession }: LaunchRouteInput,
): ResumableRoute | null => {
  if (!isFirstLoadOfSession) return null;

  // Anything but the entry page was asked for deliberately — a deep link, or a
  // reload of the page they were already on.
  if (normalise(currentPath) !== "/") return null;

  if (savedRoute === null) return null;

  const target = rememberableRoute(savedRoute);
  // A route retired by an update must not strand anyone on a 404.
  return target === null || target === "/" ? null : target;
};
