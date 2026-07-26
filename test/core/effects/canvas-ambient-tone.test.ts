import { canvasToneFor } from "@/core/effects/canvas-ambient-tone";
import { describe, expect, it } from "vitest";

/**
 * Which wash the board carries, so the mode you are in is visible without
 * reading the switcher (ADR-016).
 *
 * The Azure panel overrides the domain because it is a transient overlay: while
 * it is open you are looking at Azure, whatever the board is.
 */

describe("canvasToneFor", () => {
  it("gives each domain its own tone", () => {
    expect(canvasToneFor({ domain: "c4", isAzurePanelOpen: false })).toBe("c4");
    expect(canvasToneFor({ domain: "ddd", isAzurePanelOpen: false })).toBe("ddd");
    expect(canvasToneFor({ domain: "eventStorming", isAzurePanelOpen: false })).toBe("eventStorming");
  });

  it("lets the Azure panel take over whatever the domain", () => {
    for (const domain of ["c4", "ddd", "eventStorming"] as const) {
      expect(canvasToneFor({ domain, isAzurePanelOpen: true }), `${domain} lost to Azure`)
        .toBe("azure");
    }
  });
});

describe("the storm tint", () => {
  it("is defined by every theme", async () => {
    const { readFileSync } = await import("node:fs");

    for (const theme of ["dark", "dark-nord", "light"]) {
      const source = readFileSync(`src/styles/themes/${theme}.css.ts`, "utf8");

      expect(source, `${theme} has no esBoard tint`).toMatch(/esBoard:\s*"#[0-9a-fA-F]{3,8}"/);
    }
  });

  it("is declared in the contract, which is what makes a theme fail without it", async () => {
    const { readFileSync } = await import("node:fs");

    expect(readFileSync("src/styles/theme.contract.css.ts", "utf8")).toMatch(/esBoard:\s*null/);
  });
});
