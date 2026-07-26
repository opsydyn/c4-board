import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * An unlayered rule beats a layered one no matter how specific the layered one
 * is. That is the whole point of `@layer`, and it is easy to get backwards.
 *
 * `global.css.ts` declared `*, *::before, *::after { padding: 0 }` outside every
 * layer, so 69 padding declarations across 15 component stylesheets — all written
 * inside `@layer components` — silently computed to zero. The export modal, the
 * layout menu, the environment editor and the drawers all rendered with no
 * padding at all, and nothing in the styles hinted at why.
 *
 * layers.css.ts already declares "reset, theme, base, components, …" in the right
 * order. The reset simply was not in it.
 */

const globalCss = readFileSync(join(process.cwd(), "src/styles/global.css.ts"), "utf8");

/** The universal reset block, whatever whitespace it is written with. */
const universalReset = /globalStyle\(\s*["']\*, \*::before, \*::after["']\s*,\s*\{([\s\S]*?)\n\}\);/;

describe("global style cascade", () => {
  it("declares the universal reset", () => {
    expect(globalCss).toMatch(universalReset);
  });

  it("puts the universal reset in the reset layer", () => {
    const block = globalCss.match(universalReset)?.[1] ?? "";

    // Without this, every `padding` inside `@layer components` is dead.
    expect(block, "the universal reset is unlayered and will outrank component styles")
      .toContain("resetLayer");
  });

  it("imports the layer it uses", () => {
    expect(globalCss).toMatch(/import\s*\{[^}]*resetLayer[^}]*\}\s*from\s*["']\.\/layers\.css["']/);
  });

  it("keeps the reset before components in the declared order", () => {
    const layers = readFileSync(join(process.cwd(), "src/styles/layers.css.ts"), "utf8");
    const order = layers.match(/globalLayer\(\s*["']([^"']+)["']/)?.[1] ?? "";
    const names = order.split(",").map((name) => name.trim());

    // Earlier in the list means lower priority, so reset must precede components.
    expect(names.indexOf("reset")).toBeGreaterThanOrEqual(0);
    expect(names.indexOf("reset")).toBeLessThan(names.indexOf("components"));
  });
});
