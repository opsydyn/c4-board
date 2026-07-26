/**
 * Which Mermaid dialect an export produces.
 *
 * ADR-014. The two are not better and worse versions of the same thing:
 *
 *   flowchart — lossless. Carries `@pos` and `@ovl` comments that
 *               `import-mermaid.ts` reads back, so a board survives a round trip.
 *   c4        — readable. Real C4 macros with technology and description in their
 *               own arguments, but no layout, because Mermaid C4 has no layout
 *               algorithm at all.
 *
 * The default is flowchart, and stays there: switching it would quietly turn every
 * export into something the importer cannot read.
 */

import type { Edge, Node, Viewport } from "@xyflow/react";
import type { Effect } from "effect";
import { exportC4ToMermaid } from "./export-mermaid";
import { exportC4ToMermaidC4 } from "./export-mermaid-c4";

export type MermaidDialect = "flowchart" | "c4";

export const DEFAULT_MERMAID_DIALECT: MermaidDialect = "flowchart";

export interface MermaidDialectOption {
  readonly id: MermaidDialect;
  readonly label: string;
  /** What it is for, since the names alone do not say. */
  readonly hint: string;
  readonly isExperimental: boolean;
}

export const MERMAID_DIALECTS: ReadonlyArray<MermaidDialectOption> = [
  {
    id: "flowchart",
    label: "FLOWCHART",
    hint: "Keeps layout. Re-import this file to restore the board.",
    isExperimental: false,
  },
  {
    id: "c4",
    label: "C4",
    hint: "C4 semantics for sharing. Layout is not preserved.",
    // Mermaid's own wording: "the syntax and properties can change in future
    // releases". Someone pasting this into a doc should know.
    isExperimental: true,
  },
];

export interface MermaidDialectExportOptions {
  readonly title?: string;
  readonly viewport?: Viewport;
}

export const exportMermaidForDialect = (
  dialect: MermaidDialect,
  nodes: Node[],
  edges: Edge[],
  options: MermaidDialectExportOptions = {},
): Effect.Effect<string> => {
  if (dialect === "c4") {
    // Deliberately not given the viewport: C4 has nowhere to put it.
    return exportC4ToMermaidC4(nodes, edges, {
      ...(options.title === undefined ? {} : { title: options.title }),
    });
  }

  return exportC4ToMermaid(nodes, edges, {
    includeDescriptions: true,
    includeTechnology: true,
    direction: "TB",
    ...(options.title === undefined ? {} : { title: options.title }),
    ...(options.viewport === undefined ? {} : { viewport: options.viewport }),
  });
};
