import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Two production-only regressions, both from the same root cause: CSS whose
 * correctness depended on which stylesheet the bundler happened to emit last.
 *
 * The canvas mesh and the mode tint are painted by `canvasContainer` as
 * background-image. ReactFlow's `<Background>` renders an SVG sibling *inside*
 * that container at `z-index: -1`, and a negative-z child paints above its
 * parent's background but below its content — so if that SVG has an opaque
 * background-color, it hides the mesh and tint completely.
 *
 * We set exactly that: `.react-flow__background { background-color: base }`,
 * which duplicates a colour the container already paints. ReactFlow ships its own
 * rule for the same selector at identical specificity, resolving to `transparent`.
 * Two same-specificity rules means source order decides, and the Vite dev server
 * ordered them the opposite way to the production bundle. So the board looked
 * right in dev for as long as the bug existed in prod.
 *
 * The fix is not to reorder anything — that just moves the coin toss. It is to
 * stop painting an opaque colour we do not need, so neither order can break it.
 *
 * The grey scrollbar is the same shape of bug one layer down: the app never
 * declared `color-scheme`, so the UA drew its light-mode scrollbar over a dark UI.
 *
 * These assert on source rather than rendered output because the cascade needs a
 * browser to observe, and CI runs tests before the build. Same approach as
 * test/config/release-workflow.test.ts.
 */

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

describe("the ReactFlow background must not paint over the canvas", () => {
  const source = read("src/ui/components/styles.css.ts");

  /** The `globalStyle(".react-flow__background", { ... })` block, braces included. */
  const backgroundBlock = (): string => {
    const start = source.indexOf("globalStyle(\".react-flow__background\", {");
    expect(start, "the .react-flow__background rule has moved or been renamed")
      .toBeGreaterThan(-1);
    return source.slice(start, source.indexOf("});", start));
  };

  it("is transparent, so the mesh and tint below it show through", () => {
    expect(backgroundBlock()).toContain("transparent");
  });

  it("paints no opaque colour, whichever stylesheet the bundler emits last", () => {
    // Any theme colour here is opaque enough to hide the container beneath it.
    expect(backgroundBlock()).not.toMatch(/backgroundColor:\s*theme\.color/);
  });
});

describe("the app declares itself a dark UI", () => {
  it("sets color-scheme, so form controls and pickers render dark", () => {
    expect(read("src/styles/global.css.ts")).toMatch(/colorScheme:\s*"dark"/);
  });
});

describe("scrollbars are painted, not left to the platform", () => {
  const source = read("src/styles/global.css.ts");

  /**
   * `color-scheme: dark` alone did not fix this. It ships in the bundle and
   * Chromium honours it, but the packaged macOS app still drew a light grey
   * scrollbar: WKWebView hands overlay scrollbars to AppKit, which follows the
   * window's appearance rather than the document's `color-scheme`.
   *
   * So the colour has to be ours rather than the platform's. `::-webkit-scrollbar`
   * replaces the overlay scrollbar with one WebKit paints from CSS, which is
   * deterministic in both the dev server and the packaged app — the same move as
   * the ReactFlow background: stop depending on the environment's default.
   */
  it("paints the WebKit thumb, which is what the packaged app actually uses", () => {
    expect(source).toContain("::-webkit-scrollbar-thumb");
    expect(source).toMatch(/::-webkit-scrollbar-thumb[\s\S]{0,200}theme\.color/);
  });

  it("paints the track too, so no light gutter shows behind the thumb", () => {
    expect(source).toContain("::-webkit-scrollbar-track");
  });

  it("also sets scrollbar-color for engines that do not use the WebKit pseudos", () => {
    expect(source).toMatch(/scrollbarColor:/);
  });
});
