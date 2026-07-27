import { resolveBoardDomain } from "@/core/effects/board-domain";
import { DIAGRAM_DOMAINS } from "@/core/effects/node-operations";
import { APP_SETTING_KEYS, DEFAULT_APP_SETTINGS } from "@/core/effects/settings.types";
import { describe, expect, it } from "vitest";

/**
 * Which mode the board opens in.
 *
 * `currentDomain` was initialised to a hardcoded `"c4"` in the canvas machine and
 * never persisted, so leaving the board for Postee and coming back always landed
 * in C4 — even from a storm. The panel toggles beside it (the Azure panel, the
 * ownership lens, the OPY drawer) have persisted in settings all along; the mode
 * itself was the one piece of board state that did not.
 *
 * Reading it back has to be defensive. A settings row can carry a domain written
 * by a newer build, or a value corrupted by hand, and neither should leave the
 * board unable to open. Anything unrecognised falls back to C4.
 */

describe("resolving the persisted board domain", () => {
  it.each(DIAGRAM_DOMAINS)("keeps %s", (domain) => {
    expect(resolveBoardDomain(domain)).toBe(domain);
  });

  it("falls back to C4 when nothing was stored", () => {
    expect(resolveBoardDomain(undefined)).toBe("c4");
    expect(resolveBoardDomain(null)).toBe("c4");
  });

  it("falls back to C4 for a domain this build does not know", () => {
    // A newer build could persist a fourth mode; opening an older one must not
    // leave the board with a domain it cannot render.
    expect(resolveBoardDomain("processModelling")).toBe("c4");
  });

  it("falls back to C4 for values that are not domains at all", () => {
    for (const value of ["", "  ", 42, {}, [], true]) {
      expect(resolveBoardDomain(value)).toBe("c4");
    }
  });

  it("does not try to be clever about case or whitespace", () => {
    // Persisted values are written by this app, not typed by a person. Accepting
    // near-misses would hide a real write bug.
    expect(resolveBoardDomain("C4")).toBe("c4");
    expect(resolveBoardDomain(" eventStorming ")).toBe("c4");
  });
});

describe("the setting itself", () => {
  it("defaults to C4, which is what the board opened in before", () => {
    expect(DEFAULT_APP_SETTINGS.boardDomain).toBe("c4");
  });

  it("is a domain the app can actually render", () => {
    expect(DIAGRAM_DOMAINS).toContain(DEFAULT_APP_SETTINGS.boardDomain);
  });

  it("is a registered setting key, so writes are stored and read back", () => {
    // Settings persist as key/value rows and the key registry is derived from the
    // defaults object. A field missing from there would be silently dropped on
    // write — the mode would appear to switch and never survive a restart.
    expect(APP_SETTING_KEYS).toContain("boardDomain");
  });

  it("survives a settings store written before this key existed", () => {
    // The upgrade path for every current user: their rows have no boardDomain.
    // Loading spreads the defaults first and overlays stored rows, so the absent
    // key resolves to C4 rather than failing to decode.
    const storedBeforeUpgrade = Object.fromEntries(
      Object.entries(DEFAULT_APP_SETTINGS).filter(([key]) => key !== "boardDomain"),
    );

    expect(resolveBoardDomain(
      (storedBeforeUpgrade as Partial<typeof DEFAULT_APP_SETTINGS>).boardDomain,
    )).toBe("c4");
  });
});
