import { rememberableRoute, resolveLaunchRoute, RESUMABLE_ROUTES } from "@/core/effects/launch-route";
import { describe, expect, it } from "vitest";

/**
 * Where the app lands when it opens.
 *
 * Leaving the app in Postee and reopening it put you on the board, because Tauri
 * always loads the entry page and nothing recorded where you had been.
 *
 * The awkward part is that this is a multi-page app: every navigation is a full
 * page load, so "the app just started" and "the user clicked through to the
 * board" look identical from the page's point of view. A session marker tells
 * them apart — it survives navigation and dies with the window — and without it
 * a restore would fight every deliberate trip back to the board.
 */

const resolve = (over: Partial<Parameters<typeof resolveLaunchRoute>[0]> = {}) =>
  resolveLaunchRoute({
    currentPath: "/",
    savedRoute: "/postee",
    isFirstLoadOfSession: true,
    ...over,
  });

describe("resolveLaunchRoute", () => {
  it("resumes the view the app was left in", () => {
    expect(resolve()).toBe("/postee");
  });

  it("stays put once the session has already started", () => {
    // The user clicked through to the board on purpose. Redirecting here would
    // make the board unreachable from Postee.
    expect(resolve({ isFirstLoadOfSession: false })).toBeNull();
  });

  it("does not redirect away from a page the app opened directly", () => {
    // Launched into Settings by a deep link or a reload — that is where they are.
    expect(resolve({ currentPath: "/settings" })).toBeNull();
  });

  it("stays on the board when that is where the app was left", () => {
    expect(resolve({ savedRoute: "/" })).toBeNull();
  });

  it("stays on the board when nothing was recorded", () => {
    expect(resolve({ savedRoute: null })).toBeNull();
  });

  it("ignores a recorded route the app no longer serves", () => {
    // A route removed in an update must not strand someone on a 404.
    expect(resolve({ savedRoute: "/retired-page" })).toBeNull();
  });

  it("tolerates a trailing slash, which the server may add", () => {
    expect(resolve({ savedRoute: "/postee/" })).toBe("/postee");
    expect(resolve({ currentPath: "/", savedRoute: "/postee" })).toBe("/postee");
  });
});

describe("rememberableRoute", () => {
  it("remembers the two workspaces", () => {
    expect(rememberableRoute("/")).toBe("/");
    expect(rememberableRoute("/postee")).toBe("/postee");
  });

  it("does not let a utility page become the landing view", () => {
    // Reopening into Settings or the diagram list is not resuming work; those are
    // somewhere you visit and come back from.
    for (const path of ["/settings", "/saved-diagrams", "/splashscreen", "/db-test"]) {
      expect(rememberableRoute(path), `${path} should not be remembered`).toBeNull();
    }
  });

  it("normalises a trailing slash so one view is not recorded two ways", () => {
    expect(rememberableRoute("/postee/")).toBe("/postee");
  });

  it("ignores an unknown path", () => {
    expect(rememberableRoute("/nope")).toBeNull();
  });
});

describe("RESUMABLE_ROUTES", () => {
  it("is the set of workspaces, board first", () => {
    expect(RESUMABLE_ROUTES).toEqual(["/", "/postee"]);
  });
});
