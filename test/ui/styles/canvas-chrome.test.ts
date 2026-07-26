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
  it("sets color-scheme, so the UA draws dark scrollbars and form controls", () => {
    // Without this the sidebar's overflow scrollbar renders in the OS light
    // style — the grey bar down the edge of the board.
    expect(read("src/styles/global.css.ts")).toMatch(/colorScheme:\s*"dark"/);
  });
});
