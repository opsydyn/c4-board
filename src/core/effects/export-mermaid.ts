/**
 * Mermaid Export - Pure functional export logic
 *
 * Exports ReactFlow C4 diagrams to Mermaid flowchart format.
 * This is part of the functional core - no side effects.
 */

import type { Edge, Node, Viewport } from "@xyflow/react";
import { Effect } from "effect";
import { encodeBoardMetadata } from "./board-metadata";
import type { EdgeData } from "./edge-operations";
import { undrawnNotice } from "./export-notices";
import type { C4Type, NodeData } from "./node-operations";

/**
 * Mermaid shape syntax for C4 element types
 */
const MERMAID_SHAPES: Record<C4Type, { start: string; end: string }> = {
  person: { start: "([", end: "])" }, // Stadium shape for people
  system: { start: "[", end: "]" }, // Rectangle for systems
  externalSystem: { start: "[[", end: "]]" }, // Subroutine shape for external
  container: { start: "[(", end: ")]" }, // Cylindrical for containers
  component: { start: "{{", end: "}}" }, // Hexagon for components
};

export interface MermaidExportOptions {
  includeDescriptions?: boolean;
  includeTechnology?: boolean;
  direction?: "TB" | "LR" | "BT" | "RL"; // Top-Bottom, Left-Right, etc.
  title?: string;
  /** ReactFlow viewport state (pan/zoom) to preserve */
  viewport?: Viewport;
}

/**
 * Convert node ID to valid Mermaid identifier
 */
function toMermaidId(id: string): string {
  const cleaned = id.replace(/[^a-zA-Z0-9_]/g, "_");
  return /^[a-zA-Z]/.test(cleaned) ? cleaned : `n_${cleaned}`;
}

/**
 * Escape special characters in Mermaid strings
 */
function escapeString(str: string): string {
  return str
    .replace(/"/g, "#quot;")
    .replace(/\n/g, "<br/>")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Get C4 type from node data
 */
function getNodeC4Type(node: Node): C4Type | null {
  const data = node.data as NodeData;
  const c4Type = data.c4Type;

  if (
    c4Type === "person"
    || c4Type === "system"
    || c4Type === "externalSystem"
    || c4Type === "container"
    || c4Type === "component"
  ) {
    return c4Type;
  }

  // Fall back to node type
  if (
    node.type === "person"
    || node.type === "system"
    || node.type === "externalSystem"
    || node.type === "container"
    || node.type === "component"
  ) {
    return node.type;
  }

  return null;
}

/**
 * Get node data safely
 */
function getNodeData(node: Node): NodeData {
  return (node.data ?? {}) as NodeData;
}

/**
 * Convert a node to Mermaid syntax with position metadata
 */
function nodeToMermaid(node: Node, options: MermaidExportOptions): string | null {
  const c4Type = getNodeC4Type(node);
  if (!c4Type) return null;

  const data = getNodeData(node);
  const shape = MERMAID_SHAPES[c4Type];
  const id = toMermaidId(node.id);
  const label = escapeString(data.label ?? "Unnamed");

  // Build label with optional tech and description
  let fullLabel = label;

  if (options.includeTechnology && data.technology) {
    fullLabel += `<br/><em>${escapeString(data.technology)}</em>`;
  }

  if (options.includeDescriptions && data.description) {
    const desc = escapeString(data.description);
    fullLabel += `<br/><small>${desc}</small>`;
  }

  const nodeLine = `    ${id}${shape.start}"${fullLabel}"${shape.end}`;

  // Add position metadata as comment for round-trip preservation
  // Format: %% @pos(x,y,width,height)
  const posMetadata = `    %% @pos(${node.position.x},${node.position.y},${node.width ?? 0},${node.height ?? 0})`;

  return `${nodeLine}\n${posMetadata}`;
}

/**
 * Convert an edge to Mermaid relationship syntax with metadata
 */
function edgeToMermaid(edge: Edge, nodes: Node[]): string | null {
  // Find source and target nodes
  const sourceNode = nodes.find((n) => n.id === edge.source);
  const targetNode = nodes.find((n) => n.id === edge.target);

  // Only export edges between C4 nodes
  if (!sourceNode || !targetNode) return null;
  if (!getNodeC4Type(sourceNode) || !getNodeC4Type(targetNode)) return null;

  const sourceId = toMermaidId(edge.source);
  const targetId = toMermaidId(edge.target);

  // Edge label (default to "uses" if not provided)
  const label = edge.label ? escapeString(String(edge.label)) : "uses";

  // Get edge metadata
  const edgeData = edge.data as EdgeData | undefined;
  const metadata = edgeData?.metadata;

  const lines: string[] = [];

  // Main relationship line
  lines.push(`    ${sourceId} -->|"${label}"| ${targetId}`);

  // Add OVL metadata as comment for round-trip preservation
  if (metadata) {
    const metaParts: string[] = [];

    if (metadata.protocol) metaParts.push(`protocol=${metadata.protocol}`);
    if (metadata.communicationStyle) metaParts.push(`style=${metadata.communicationStyle}`);
    if (metadata.requestVolume !== undefined) metaParts.push(`volume=${metadata.requestVolume}`);
    if (metadata.latency !== undefined) metaParts.push(`latency=${metadata.latency}`);
    if (metadata.animationSpeed) metaParts.push(`animation=${metadata.animationSpeed}`);
    if (metadata.notes) metaParts.push(`notes=${escapeString(metadata.notes)}`);

    if (metaParts.length > 0) {
      lines.push(`    %% @ovl: ${metaParts.join(", ")}`);
    }
  }

  return lines.join("\n");
}

/**
 * Export C4 diagram to Mermaid flowchart format
 *
 * Pure function that transforms nodes and edges into Mermaid syntax.
 * Returns an Effect that yields the Mermaid code string.
 */
export const exportC4ToMermaid = (
  nodes: Node[],
  edges: Edge[],
  options: MermaidExportOptions = {},
): Effect.Effect<string> =>
  Effect.succeed((() => {
    const lines: string[] = [];

    // Start flowchart with direction
    const direction = options.direction ?? "TB";
    lines.push(`flowchart ${direction}`);

    // Add title as comment if provided
    if (options.title) {
      lines.push(`    %% ${options.title}`);
    }

    // ReactFlow viewport metadata (preserved as comment for round-trip import)
    if (options.viewport) {
      lines.push(`    %% ReactFlow Viewport: ${JSON.stringify(options.viewport)}`);
    }

    // Filter to only C4 nodes
    const c4Nodes = nodes.filter((n) => getNodeC4Type(n) !== null);

    // Convert nodes
    if (c4Nodes.length > 0) {
      lines.push("", "    %% C4 Elements");
      for (const node of c4Nodes) {
        const element = nodeToMermaid(node, options);
        if (element) lines.push(element);
      }
    }

    // Convert edges
    const c4Edges = edges.filter((edge) => {
      const source = nodes.find((n) => n.id === edge.source);
      const target = nodes.find((n) => n.id === edge.target);
      return (
        source
        && target
        && getNodeC4Type(source) !== null
        && getNodeC4Type(target) !== null
      );
    });

    if (c4Edges.length > 0) {
      lines.push("", "    %% Relationships");
      for (const edge of c4Edges) {
        const relationship = edgeToMermaid(edge, nodes);
        if (relationship) lines.push(relationship);
      }
    }

    lines.push(...undrawnNotice({ total: nodes.length, drawn: c4Nodes.length, marker: "%%" }));

    // ADR-015. The authoritative record; the @pos/@ovl comments above remain so
    // a file exported now still reads on an older build.
    const metadata = encodeBoardMetadata(nodes, edges, options.viewport);
    if (metadata.length > 0) lines.push("", ...metadata);

    return lines.join("\n");
  })());
