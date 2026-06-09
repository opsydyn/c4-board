/**
 * Search Effects - Functional Core
 *
 * Pure search logic using Fuse.js for fuzzy searching of canvas nodes.
 * This is the functional core - contains zero I/O operations.
 */

import type { Node } from "@xyflow/react";
import Fuse, { type IFuseOptions } from "fuse.js";

/**
 * Search result with Fuse.js score
 */
export interface SearchResult {
  node: Node;
  score: number;
}

/**
 * Fuse.js configuration for searching C4 diagram nodes
 */
const fuseOptions: IFuseOptions<Node> = {
  keys: [
    { name: "data.label", weight: 2.0 }, // Highest priority
    { name: "data.description", weight: 1.0 },
    { name: "data.technology", weight: 0.8 },
    { name: "type", weight: 0.5 }, // Lowest priority
  ],
  threshold: 0.3, // 0 = perfect match, 1 = match anything
  includeScore: true, // Include match score for sorting
  minMatchCharLength: 2, // Minimum characters to trigger search
  shouldSort: true, // Sort by relevance
  ignoreLocation: true, // Don't care where in the string the match is
};

/**
 * Create a Fuse.js instance for searching nodes
 * Pure function - no side effects
 */
export function createSearchIndex(nodes: Node[]): Fuse<Node> {
  return new Fuse(nodes, fuseOptions);
}

/**
 * Search nodes using Fuse.js fuzzy search
 * Pure function - takes query and nodes, returns results
 */
export function searchNodes(
  query: string,
  nodes: Node[],
  maxResults = 10,
): SearchResult[] {
  // Empty query returns no results
  if (!query || query.trim().length < 2) {
    return [];
  }

  const fuse = createSearchIndex(nodes);
  const results = fuse.search(query, { limit: maxResults });

  return results.map((result) => ({
    node: result.item,
    score: result.score ?? 0,
  }));
}

/**
 * Get a human-readable label for a node type
 */
export function getNodeTypeLabel(nodeType: string): string {
  const labels: Record<string, string> = {
    person: "Person",
    system: "System",
    externalSystem: "External System",
    container: "Container",
    component: "Component",
  };

  return labels[nodeType] || nodeType;
}

/**
 * Get color for a node type (matches theme colors)
 */
export function getNodeTypeColor(nodeType: string): string {
  const colors: Record<string, string> = {
    person: "#00ffff", // Cyan
    system: "#00ff00", // Green
    externalSystem: "#ffcc00", // Amber
    container: "#0088ff", // Blue
    component: "#cc88ff", // Purple
  };

  return colors[nodeType] || "#00ffaa"; // Default to primary color
}
