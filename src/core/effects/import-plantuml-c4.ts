/**
 * PlantUML C4 Import - Pure functional parser
 *
 * Parses PlantUML C4 diagrams back into ReactFlow nodes and edges.
 * This is part of the functional core - no side effects.
 */

import type { Edge, Node, Viewport } from "@xyflow/react";
import { Effect } from "effect";
import type {
  EdgeAnimationSpeed,
  EdgeCommunicationStyle,
  EdgeData,
  EdgeMetadata,
  EdgeProtocol,
} from "./edge-operations";
import type { C4Type, NodeData } from "./node-operations";

/**
 * PlantUML C4 macro to C4Type mapping
 */
const PLANTUML_TO_C4TYPE: Record<string, C4Type> = {
  Person: "person",
  Person_Ext: "person",
  System: "system",
  System_Ext: "externalSystem",
  SystemDb: "system",
  SystemQueue: "system",
  Container: "container",
  ContainerDb: "container",
  ContainerQueue: "container",
  Component: "component",
  ComponentDb: "component",
  ComponentQueue: "component",
};

interface ParsedElement {
  id: string;
  type: C4Type;
  label: string;
  technology?: string;
  description?: string;
  position?: { x: number; y: number };
  width?: number;
  height?: number;
}

interface ParsedRelationship {
  source: string;
  target: string;
  label: string;
  metadata?: EdgeMetadata | undefined;
}

export interface ImportResult {
  nodes: Node[];
  edges: Edge[];
  viewport?: Viewport;
}

/**
 * Parse a PlantUML element line
 * Examples:
 *   Person(user, "User", "A user of the system")
 *   System(api, "API", "REST API", "Handles requests")
 *   Container(db, "Database", "PostgreSQL")
 */
function parseElement(line: string): ParsedElement | null {
  // Match: MacroName(id, "label", ...)
  const match = line.match(/^(\w+)\(([^,]+),\s*"([^"]+)"(?:,\s*"([^"]+)")?(?:,\s*"([^"]+)")?\)/);

  if (!match) return null;

  const [, macro, id, label, param1, param2] = match;

  if (!macro || !id || !label) return null;

  const c4Type = PLANTUML_TO_C4TYPE[macro];

  if (!c4Type) return null;

  // Determine if param1 is technology or description
  // Convention: if there's param2, param1 is tech, param2 is description
  // Otherwise, param1 is description
  let technology: string | undefined;
  let description: string | undefined;

  if (param2) {
    technology = param1;
    description = param2;
  } else if (param1) {
    description = param1;
  }

  const result: ParsedElement = {
    id: id.trim(),
    type: c4Type,
    label,
    ...(technology && { technology }),
    ...(description && { description }),
  };

  return result;
}

/**
 * Parse a PlantUML relationship line
 * Examples:
 *   Rel(user, api, "Uses", "HTTPS")
 *   Rel_D(api, db, "Reads/Writes")
 */
function parseRelationship(line: string): ParsedRelationship | null {
  // Match: Rel*(source, target, "label", ...)
  const match = line.match(/^Rel[^(]*\(([^,]+),\s*([^,]+),\s*"([^"]+)"/);

  if (!match) return null;

  const [, source, target, label] = match;

  if (!source || !target || !label) return null;

  return {
    source: source.trim(),
    target: target.trim(),
    label,
  };
}

/**
 * Generate ReactFlow node from parsed element
 */
function createNodeFromElement(element: ParsedElement, index: number): Node {
  const nodeData: NodeData = {
    label: element.label,
    description: element.description || "",
    technology: element.technology || "",
    c4Type: element.type,
  };

  // Use position from metadata if available, otherwise use grid layout
  let position: { x: number; y: number };
  if (element.position) {
    position = element.position;
  } else {
    // Fallback: grid layout
    const gridSize = 5;
    const col = index % gridSize;
    const row = Math.floor(index / gridSize);
    position = { x: col * 300, y: row * 250 };
  }

  const node: Node = {
    id: element.id,
    type: element.type,
    position,
    data: nodeData,
  };

  // Apply width/height if available
  if (element.width && element.height) {
    node.style = {
      width: element.width,
      height: element.height,
    };
  }

  return node;
}

/**
 * Generate ReactFlow edge from parsed relationship with metadata
 */
function createEdgeFromRelationship(relationship: ParsedRelationship, index: number): Edge {
  const edgeData: EdgeData = {
    createdAt: Date.now(),
    ...(relationship.metadata && { metadata: relationship.metadata }),
  };

  return {
    id: `edge-${relationship.source}-${relationship.target}-${index}`,
    source: relationship.source,
    target: relationship.target,
    label: relationship.label,
    type: "smoothstep",
    data: edgeData,
  };
}

/**
 * Parse OVL metadata comment
 * Example: ' @ovl: protocol=grpc, style=synchronous, volume=100, latency=50, animation=auto
 */
function parseOVLMetadata(line: string): EdgeMetadata | null {
  const match = line.match(/' @ovl:\s*(.+)/);
  if (!match) return null;

  const [, metadataStr] = match;
  if (!metadataStr) return null;

  const metadata: EdgeMetadata = {};
  const pairs = metadataStr.split(",").map((p) => p.trim());

  for (const pair of pairs) {
    const [key, value] = pair.split("=").map((s) => s.trim());
    if (!key || !value) continue;

    switch (key) {
      case "protocol":
        metadata.protocol = value as EdgeProtocol;
        break;
      case "style":
        metadata.communicationStyle = value as EdgeCommunicationStyle;
        break;
      case "volume":
        metadata.requestVolume = parseFloat(value);
        break;
      case "latency":
        metadata.latency = parseFloat(value);
        break;
      case "animation":
        metadata.animationSpeed = value as EdgeAnimationSpeed;
        break;
      case "notes":
        // Unescape notes (reverse of escapeString)
        metadata.notes = value
          .replace(/\\n/g, "\n")
          .replace(/\\"/g, "\"")
          .replace(/\\\\/g, "\\");
        break;
    }
  }

  return Object.keys(metadata).length > 0 ? metadata : null;
}

/**
 * Parse PlantUML C4 content and convert to ReactFlow nodes and edges
 *
 * Pure function that parses PlantUML text into diagram structure.
 * Returns an Effect that yields the import result.
 */
export const importPlantUMLC4 = (
  content: string,
): Effect.Effect<ImportResult, Error> =>
  Effect.gen(function*() {
    const lines = content.split("\n").map((line) => line.trim());
    const elements: ParsedElement[] = [];
    const relationships: ParsedRelationship[] = [];
    let viewport: Viewport | undefined;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      // Parse ReactFlow viewport metadata from comment
      if (line.startsWith("' ReactFlow Viewport:")) {
        try {
          const jsonStr = line.substring("' ReactFlow Viewport:".length).trim();
          viewport = JSON.parse(jsonStr) as Viewport;
        } catch {
          // Ignore invalid JSON
        }
        continue;
      }

      // Parse position metadata comment: ' @pos(x,y,width,height)
      if (line.startsWith("' @pos(")) {
        const match = line.match(/' @pos\(([^,]+),([^,]+),([^,]+),([^)]+)\)/);
        if (match && elements.length > 0) {
          const [, x, y, width, height] = match;
          const lastElement = elements[elements.length - 1];
          if (lastElement && x && y && width && height) {
            lastElement.position = { x: parseFloat(x), y: parseFloat(y) };
            lastElement.width = parseFloat(width);
            lastElement.height = parseFloat(height);
          }
        }
        continue;
      }

      // Skip empty lines, comments (except @ovl), and directives
      if (line.startsWith("@") || line.startsWith("!")) {
        continue;
      }

      // Try to parse as element
      const element = parseElement(line);
      if (element) {
        elements.push(element);
        continue;
      }

      // Try to parse as relationship
      const relationship = parseRelationship(line);
      if (relationship) {
        // Check if next line has OVL metadata
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1]?.trim();
          if (nextLine?.startsWith("' @ovl:")) {
            const metadata = parseOVLMetadata(nextLine);
            if (metadata) {
              relationship.metadata = metadata;
            }
            i++; // Skip the metadata line in next iteration
          }
        }
        relationships.push(relationship);
      }
    }

    // Validate that we found at least some elements
    if (elements.length === 0) {
      return yield* Effect.fail(
        new Error("No valid C4 elements found in PlantUML file"),
      );
    }

    // Create nodes from elements
    const nodes = elements.map((element, index) => createNodeFromElement(element, index));

    // Create edges from relationships
    // Filter out relationships that reference non-existent nodes
    const nodeIds = new Set(elements.map((e) => e.id));
    const validRelationships = relationships.filter(
      (rel) => nodeIds.has(rel.source) && nodeIds.has(rel.target),
    );

    const edges = validRelationships.map((rel, index) => createEdgeFromRelationship(rel, index));

    return { nodes, edges, ...(viewport && { viewport }) };
  });
