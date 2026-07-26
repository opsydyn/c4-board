import { MermaidPreview, mermaidRenderId, previewErrorMessage } from "@/core/effects/mermaid-preview";
import { describe, expect, it } from "vitest";

/**
 * ADR-014 Phase 3. The preview exists because Mermaid's C4 support is
 * experimental by Mermaid's own statement, so output that reads correctly may not
 * render. That only helps if a failure is legible: a preview that silently blanks
 * is worse than no preview, because it looks like an empty diagram rather than a
 * rejected one.
 *
 * Mermaid throws inconsistently — an Error, a plain object with `str`, sometimes a
 * bare string — so pulling a usable message out of it is worth pinning.
 */

describe("previewErrorMessage", () => {
  it("uses the message of a thrown Error", () => {
    expect(previewErrorMessage(new Error("Parse error on line 3"))).toBe("Parse error on line 3");
  });

  it("reads mermaid's own parse-error shape", () => {
    // mermaid throws `{ str, hash }` from its generated parsers rather than Error.
    expect(previewErrorMessage({ str: "Expecting 'PERSON', got 'EOF'" }))
      .toBe("Expecting 'PERSON', got 'EOF'");
  });

  it("passes a thrown string through", () => {
    expect(previewErrorMessage("no diagram type detected")).toBe("no diagram type detected");
  });

  it("never returns an empty message, which would render as a blank error box", () => {
    for (const cause of [null, undefined, {}, new Error("")]) {
      expect(previewErrorMessage(cause).length, `empty for ${JSON.stringify(cause)}`)
        .toBeGreaterThan(0);
    }
  });

  it("does not leak an object's stringification as [object Object]", () => {
    expect(previewErrorMessage({ unexpected: true })).not.toContain("[object Object]");
  });
});

describe("mermaidRenderId", () => {
  it("is a valid DOM id, since mermaid injects an element with it", () => {
    expect(mermaidRenderId(0)).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
  });

  it("differs per render, so a re-render cannot collide with the previous node", () => {
    expect(mermaidRenderId(1)).not.toBe(mermaidRenderId(2));
  });
});

describe("MermaidPreview state", () => {
  /**
   * States rather than booleans (CLAUDE.md): "rendering" and "failed" are mutually
   * exclusive, and a flags-based version permits both at once.
   */
  it("starts idle", () => {
    expect(MermaidPreview.$is("Idle")(MermaidPreview.Idle())).toBe(true);
  });

  it("carries the svg when rendered", () => {
    const state = MermaidPreview.Rendered({ svg: "<svg/>" });

    expect(
      MermaidPreview.$match({
        Idle: () => "",
        Rendering: () => "",
        Rendered: ({ svg }) => svg,
        Failed: () => "",
      })(state),
    ).toBe("<svg/>");
  });

  it("carries the reason when it fails", () => {
    const state = MermaidPreview.Failed({ message: "Parse error" });

    expect(
      MermaidPreview.$match({
        Idle: () => "",
        Rendering: () => "",
        Rendered: () => "",
        Failed: ({ message }) => message,
      })(state),
    ).toBe("Parse error");
  });
});
