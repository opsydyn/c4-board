/**
 * Mermaid C4 export — the share-oriented dialect.
 *
 * ADR-014. Distinct from `export-mermaid.ts`, which emits a flowchart and is the
 * *lossless* format: it carries `@pos` and `@ovl` comments that `import-mermaid.ts`
 * reads back. This one carries C4 semantics instead, and cannot round-trip —
 * Mermaid C4 has no layout algorithm at all, so shape position follows statement
 * order. The two dialects have different jobs and neither replaces the other.
 *
 * Mermaid's element signatures are not uniform, which is the detail most likely to
 * be got wrong:
 *
 *   Person(alias, label, ?descr)
 *   System(alias, label, ?descr)          System_Ext likewise
 *   Container(alias, label, ?techn, ?descr)
 *   Component(alias, label, ?techn, ?descr)
 *   Rel(from, to, label, ?techn)
 *
 * Person and System have no `techn` slot.
 *
 * Part of the functional core: no side effects.
 */

import type { Edge, Node, Viewport } from "@xyflow/react";
import { Effect } from "effect";
import { encodeBoardMetadata } from "./board-metadata";
import type { EdgeData } from "./edge-operations";
import type { C4Type, NodeData } from "./node-operations";

export interface MermaidC4ExportOptions {
  readonly title?: string;
  /** Carried in the metadata envelope, though C4 cannot express it visually. */
  readonly viewport?: Viewport;
}

/** Elements whose signature has no technology argument. */
const WITHOUT_TECHNOLOGY = new Set<C4Type>(["person", "system", "externalSystem"]);

const ELEMENT_MACRO: Record<C4Type, string> = {
  person: "Person",
  system: "System",
  externalSystem: "System_Ext",
  container: "Container",
  component: "Component",
};

/**
 * Most specific diagram type the board's elements require. Mermaid's element
 * vocabulary differs per diagram type, so this is not cosmetic.
 */
const diagramTypeFor = (types: ReadonlySet<C4Type>): string => {
  if (types.has("component")) return "C4Component";
  if (types.has("container")) return "C4Container";
  return "C4Context";
};

const isC4Type = (value: unknown): value is C4Type =>
  value === "person"
  || value === "system"
  || value === "externalSystem"
  || value === "container"
  || value === "component";

const c4TypeOf = (node: Node): C4Type | null => {
  const c4Type = (node.data as NodeData | undefined)?.c4Type;
  return isC4Type(c4Type) ? c4Type : null;
};

/** Mermaid C4 arguments are quoted and comma-separated, with no escape syntax. */
const toArgument = (value: string): string =>
  value
    .replace(/"/g, "'")
    .replace(/\s*\n+\s*/g, " ")
    .trim();

const sanitizeAlias = (value: string): string => {
  const cleaned = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return /^[a-z]/.test(cleaned) ? cleaned : "";
};

/**
 * Aliases are what a reader sees. Node ids are nanoids, so
 * `Person(person_2APJt5Nbv87k, "Operator")` is valid and useless in a dialect
 * whose whole purpose is being read; the label is used instead, falling back to
 * the id when it yields nothing usable. Collisions get a numeric suffix, since
 * two elements sharing an alias would silently merge in the rendered diagram.
 */
const buildAliases = (entries: ReadonlyArray<{ node: Node }>): ReadonlyMap<string, string> => {
  const taken = new Set<string>();
  const aliases = new Map<string, string>();

  for (const { node } of entries) {
    const fromLabel = sanitizeAlias((node.data as NodeData | undefined)?.label ?? "");
    const fromId = sanitizeAlias(node.id);
    const base = fromLabel || fromId || "element";

    let alias = base;
    for (let suffix = 2; taken.has(alias); suffix += 1) alias = `${base}_${suffix}`;

    taken.add(alias);
    aliases.set(node.id, alias);
  }

  return aliases;
};

/** `Macro(alias, "a", "b")` with trailing empty arguments dropped rather than emitted. */
const macro = (name: string, alias: string, args: ReadonlyArray<string>): string => {
  const trimmed = [...args];
  while (trimmed.length > 0 && trimmed[trimmed.length - 1] === "") trimmed.pop();

  const rendered = trimmed.map((argument) => `"${argument}"`).join(", ");
  return rendered.length > 0
    ? `  ${name}(${alias}, ${rendered})`
    : `  ${name}(${alias})`;
};

const elementFor = (node: Node, c4Type: C4Type, alias: string): string => {
  const data = node.data as NodeData;
  const label = toArgument(data.label ?? "Unnamed");
  const technology = toArgument(data.technology ?? "");
  const description = toArgument(data.description ?? "");

  if (WITHOUT_TECHNOLOGY.has(c4Type)) {
    // No `techn` slot. Dropping a field the user filled in would be a silent
    // loss, so it joins the description rather than disappearing.
    const merged = [technology, description].filter((part) => part.length > 0).join(" · ");
    return macro(ELEMENT_MACRO[c4Type], alias, [label, merged]);
  }

  return macro(ELEMENT_MACRO[c4Type], alias, [label, technology, description]);
};

const relationshipFor = (edge: Edge, aliases: ReadonlyMap<string, string>): string => {
  const label = toArgument(edge.label === undefined ? "" : String(edge.label)) || "uses";
  const protocol = toArgument((edge.data as EdgeData | undefined)?.metadata?.protocol ?? "");

  const args = [label, protocol].filter((argument, index) => index === 0 || argument.length > 0);
  return `  Rel(${aliases.get(edge.source) ?? edge.source}, ${aliases.get(edge.target) ?? edge.target}, ${
    args.map((argument) => `"${argument}"`).join(", ")
  })`;
};

/**
 * Export a C4 board to Mermaid's C4 dialect.
 *
 * Pure. Mermaid's C4 support is experimental by its own documentation, so the
 * output is a share artifact rather than a backup — the header says so, because
 * nothing else in the file would tell a reader their layout is gone.
 */
export const exportC4ToMermaidC4 = (
  nodes: Node[],
  edges: Edge[],
  options: MermaidC4ExportOptions = {},
): Effect.Effect<string> =>
  Effect.succeed((() => {
    const c4Nodes = nodes.flatMap((node) => {
      const c4Type = c4TypeOf(node);
      return c4Type === null ? [] : [{ node, c4Type }];
    });

    const present = new Set(c4Nodes.map((entry) => entry.c4Type));
    const ids = new Set(c4Nodes.map((entry) => entry.node.id));

    // Type first. Mermaid documents comments only within the diagram body and says
    // nothing about whether they may precede the declaration, so leading with the
    // type leaves no question about how the file is detected.
    const lines: string[] = [
      diagramTypeFor(present),
      "%% Generated by c4-board — Mermaid C4 (experimental).",
      "%% Mermaid draws C4 by statement order, so this rendering will not match the board.",
      "%% Re-importing this file into c4-board restores the board exactly, from the metadata below.",
    ];

    if (options.title !== undefined && options.title.trim().length > 0) {
      lines.push(`  title ${toArgument(options.title)}`);
    }

    const aliases = buildAliases(c4Nodes);
    for (const { node, c4Type } of c4Nodes) {
      lines.push(elementFor(node, c4Type, aliases.get(node.id) ?? node.id));
    }

    const c4Edges = edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target));
    if (c4Edges.length > 0) {
      lines.push("");
      for (const edge of c4Edges) lines.push(relationshipFor(edge, aliases));
    }

    // ADR-015. Every node, including ones this dialect cannot draw, so a shared
    // C4 export lands on another board with its layout and data intact.
    const metadata = encodeBoardMetadata(nodes, edges, options.viewport);
    if (metadata.length > 0) lines.push("", ...metadata);

    return `${lines.join("\n")}\n`;
  })());
