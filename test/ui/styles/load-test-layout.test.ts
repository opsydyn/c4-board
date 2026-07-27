import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The load test button row.
 *
 * It began as three buttons and grew to six — Abort Run, Export CSV and Export
 * JSON all landed in it — but the row was `display: flex` with no `flex-wrap`,
 * so the extras did not move to a second line. They pushed out of the panel
 * instead: the siren toggle hung past the right edge and the container gained a
 * horizontal scrollbar.
 *
 * The truncated label is the same growth from the other side. `submitButton` has
 * a fixed `height: 36px`, so when the row squeezed it, "Initiate Load Test"
 * wrapped onto three lines inside a box tall enough for one and the rest was
 * clipped.
 *
 * Layout cannot be measured here — jsdom does not lay out, and the Postee
 * workspace needs the Tauri database so the browser preview cannot reach this
 * panel at all. These assert the two declarations that keep the row honest, so
 * the seventh button does not repeat it.
 */

const styles = () => readFileSync(join(process.cwd(), "src/ui/components/postee/PosteeWorkspace.css.ts"), "utf8");

/** The `loadTestButtonRow` style block. */
const buttonRow = (): string => {
  const source = styles();
  const start = source.indexOf("export const loadTestButtonRow = style({");
  expect(start, "loadTestButtonRow has moved or been renamed").toBeGreaterThan(-1);
  return source.slice(start, source.indexOf("});", start));
};

describe("the load test button row", () => {
  it("wraps rather than pushing its buttons out of the panel", () => {
    expect(buttonRow()).toMatch(/flexWrap:\s*"wrap"/);
  });

  it("may shrink below its content width, so a flex parent cannot be blown out", () => {
    // Without this a flex item refuses to go under its min-content size, which is
    // what turns a too-wide row into a scrollbar on an ancestor.
    expect(buttonRow()).toMatch(/minWidth:\s*0/);
  });

  it("keeps button labels on one line inside their fixed height", () => {
    // The buttons are 36px tall by design; a wrapped label is clipped rather than
    // growing the button.
    expect(styles()).toMatch(/loadTestButtonRow\}\s*button[^)]*\)/);
    expect(styles()).toMatch(/whiteSpace:\s*"nowrap"/);
  });
});

describe("the panel responds to its pane, not the window", () => {
  it("sizes against the response pane container", () => {
    // A viewport media query never fires for a narrow pane inside a wide window,
    // which is exactly the case here — the panel lives in a resizable column.
    // `loadTestControls` already uses the container; the row must agree with it.
    expect(buttonRow()).toContain("responsePane");
  });
});
