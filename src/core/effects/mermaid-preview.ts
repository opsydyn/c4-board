/**
 * State and error handling for the Mermaid preview.
 *
 * ADR-014 Phase 3. The preview exists because Mermaid's C4 support is
 * experimental — its own documentation says the syntax can change between
 * releases — so output that reads correctly may not render. That is only useful
 * if failure is legible: a preview that blanks looks like an empty diagram rather
 * than a rejected one.
 *
 * Pure. The rendering itself is the imperative shell, in `mermaid-renderer.ts`.
 */

import { Data } from "effect";

/**
 * States, not flags. "rendering" and "failed" are mutually exclusive, and a
 * boolean pair permits both at once (CLAUDE.md).
 */
export type MermaidPreview = Data.TaggedEnum<{
  Idle: object;
  Rendering: object;
  Rendered: { readonly svg: string };
  Failed: { readonly message: string };
}>;

export const MermaidPreview = Data.taggedEnum<MermaidPreview>();

/** Renders Mermaid source to SVG. Injected, so tests never load the real bundle. */
export type MermaidRenderer = (code: string, id: string) => Promise<string>;

const FALLBACK = "Mermaid could not render this diagram.";

/**
 * Mermaid throws inconsistently: an `Error` from some paths, a plain `{ str, hash }`
 * from its generated parsers, occasionally a bare string. Anything unrecognised
 * must still produce words — an empty message renders as a blank error box, which
 * is the failure this whole feature exists to avoid.
 */
export const previewErrorMessage = (cause: unknown): string => {
  if (typeof cause === "string" && cause.trim().length > 0) return cause;

  if (cause instanceof Error && cause.message.trim().length > 0) return cause.message;

  if (typeof cause === "object" && cause !== null) {
    const { str, message } = cause as { str?: unknown; message?: unknown };
    if (typeof str === "string" && str.trim().length > 0) return str;
    if (typeof message === "string" && message.trim().length > 0) return message;
  }

  return FALLBACK;
};

/**
 * Mermaid injects a temporary element with this id while measuring, so it has to
 * be a valid DOM id and must differ between renders — reusing one can collide
 * with the node left by the previous attempt.
 */
export const mermaidRenderId = (sequence: number): string => `mermaid-preview-${sequence}`;
