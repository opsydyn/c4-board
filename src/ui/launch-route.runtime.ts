/**
 * Applies the landing view on page load.
 *
 * The imperative half of `launch-route.ts`: reads storage, redirects, records.
 * Runs from the shared layout so it covers every page, and runs before the app
 * mounts so a resume is a redirect rather than a visible flash of the board.
 */

import { LAST_VIEW_KEY, rememberableRoute, resolveLaunchRoute, SESSION_KEY } from "../core/effects/launch-route";

/** Storage throws in some webview configurations; a landing view is not worth failing over. */
const safely = <T>(read: () => T, fallback: T): T => {
  try {
    return read();
  } catch {
    return fallback;
  }
};

export const applyLaunchRoute = (): void => {
  if (typeof window === "undefined") return;

  const isFirstLoadOfSession = safely(
    () => window.sessionStorage.getItem(SESSION_KEY) === null,
    false,
  );
  // Marked before any redirect, so the page we land on does not try to resume again.
  safely(() => window.sessionStorage.setItem(SESSION_KEY, "1"), undefined);

  const target = resolveLaunchRoute({
    currentPath: window.location.pathname,
    savedRoute: safely(() => window.localStorage.getItem(LAST_VIEW_KEY), null),
    isFirstLoadOfSession,
  });

  if (target !== null) {
    // `replace`, not `assign`: the entry page should not sit in history as a
    // step to go "back" to.
    window.location.replace(target);
    return;
  }

  // Only workspaces are recorded, so a trip through Settings does not become the
  // view the app reopens in.
  const remembered = rememberableRoute(window.location.pathname);
  if (remembered !== null) {
    safely(() => window.localStorage.setItem(LAST_VIEW_KEY, remembered), undefined);
  }
};
