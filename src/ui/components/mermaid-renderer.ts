/**
 * The imperative shell around Mermaid.
 *
 * ADR-014 Phase 3. Mermaid is 79.7 MB unpacked with 21 direct dependencies, so it
 * is loaded by dynamic import the first time a preview is opened and never at all
 * for anyone who only copies the code. Keeping this in its own module is what
 * makes that split real: importing it does not import Mermaid.
 *
 * `securityLevel: "strict"` because node labels are user-supplied and Mermaid
 * renders HTML in them. Bundled locally rather than fetched, because the app is a
 * desktop app and has to work offline.
 */

import type { MermaidRenderer } from "../../core/effects/mermaid-preview";

/** Initialised once per session; `mermaid.initialize` is global and idempotent-ish. */
let ready: Promise<typeof import("mermaid").default> | null = null;

const loadMermaid = async () => {
  if (ready === null) {
    ready = import("mermaid").then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        // User data reaches the renderer, so no HTML escapes the sanitiser.
        securityLevel: "strict",
        theme: "dark",
        fontFamily: "'Berkeley Mono', ui-monospace, monospace",
      });
      return mermaid;
    });
  }

  return ready;
};

export const renderMermaid: MermaidRenderer = async (code, id) => {
  const mermaid = await loadMermaid();

  // `parse` reports a bad diagram as a thrown error rather than rendering an
  // error graphic into the page, which is what we want to show the operator.
  await mermaid.parse(code);

  const { svg } = await mermaid.render(id, code);
  return svg;
};
