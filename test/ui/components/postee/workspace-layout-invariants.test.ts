import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ADR-011 Phase 1. The workspace must fill the viewport exactly and never scroll
 * as a page.
 *
 * These assertions read the stylesheet source rather than computed geometry,
 * deliberately: jsdom has no layout engine, so a rendered assertion here would be
 * theatre. The invariants below are the ones whose violation silently reintroduces
 * a page scrollbar, and each has a specific failure mode worth naming.
 */

const stylesheet = readFileSync(
  resolve(__dirname, "../../../../src/ui/components/postee/PosteeWorkspace.css.ts"),
  "utf8",
);

const styleBlock = (name: string): string => {
  const start = stylesheet.indexOf(`export const ${name} = style({`);
  if (start === -1) throw new Error(`No style named ${name}`);
  const end = stylesheet.indexOf("});", start);
  return stylesheet.slice(start, end);
};

describe("workspace layout invariants", () => {
  it("binds the shell to the viewport instead of merely flooring it", () => {
    const workspace = styleBlock("workspace");

    // `minHeight: 100vh` is the regression: it permits growth past the viewport,
    // and then the page scrolls no matter what the children do.
    expect(workspace).not.toContain("minHeight: \"100vh\"");
    expect(workspace).toContain("height: \"100dvh\"");
  });

  it("stops overflow escaping the shell", () => {
    expect(styleBlock("workspace")).toContain("overflow: \"hidden\"");
  });

  it("lets the scrolling regions shrink to their track", () => {
    // A flex/grid child without `min-height: 0` refuses to shrink below its
    // content, so the overflow travels upward and the shell grows instead.
    expect(styleBlock("mainColumn")).toContain("minHeight: 0");
    expect(styleBlock("sidebar")).toContain("minHeight: 0");
  });

  it("keeps the scroll on the region rather than the page", () => {
    expect(styleBlock("mainColumn")).toContain("overflowY: \"auto\"");
  });
});
