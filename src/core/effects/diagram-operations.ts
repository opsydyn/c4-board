/**
 * Diagram Operations (Effect-TS)
 *
 * FUNCTIONAL CORE - Pure business logic for diagram metadata operations.
 * NO side effects: no invoke(), no DOM, no localStorage.
 * All functions return Effect<Env, Error, Result> for composition and testability.
 */

import type { Edge, Node } from "@xyflow/react";
import { Data, Effect } from "effect";

/**
 * Error for diagram validation failures
 */
export class DiagramNameError extends Data.TaggedError("DiagramNameError")<{
  message: string;
}> {}

/**
 * Diagram metadata
 */
export interface DiagramMetadata {
  id: string | null;
  name: string;
  description: string | null;
  sessionName: string;
}

/**
 * Complete diagram state
 */
export interface Diagram {
  id: string;
  name: string;
  description: string | null;
  nodes: Node[];
  edges: Edge[];
  updatedAt: number;
}

/**
 * Update diagram name
 */
export const updateDiagramName = (
  metadata: DiagramMetadata,
  name: string,
): Effect.Effect<DiagramMetadata> => {
  return Effect.succeed({
    ...metadata,
    name,
  });
};

/**
 * Update diagram description
 */
export const updateDiagramDescription = (
  metadata: DiagramMetadata,
  description: string | null,
): Effect.Effect<DiagramMetadata> => {
  return Effect.succeed({
    ...metadata,
    description,
  });
};

/**
 * Update session name
 */
export const updateSessionName = (
  metadata: DiagramMetadata,
  sessionName: string,
): Effect.Effect<DiagramMetadata> => {
  return Effect.succeed({
    ...metadata,
    sessionName,
  });
};

/**
 * Create a new empty diagram
 */
export const createEmptyDiagram = (
  name: string,
  description: string | null = null,
): Effect.Effect<DiagramMetadata> => {
  return Effect.succeed({
    id: null, // Will be assigned by persistence layer
    name,
    description,
    sessionName: "",
  });
};

/**
 * Validate diagram name (non-empty)
 */
export const validateDiagramName = (
  name: string,
): Effect.Effect<boolean, DiagramNameError> => {
  if (!name || name.trim().length === 0) {
    return Effect.fail(new DiagramNameError({ message: "Diagram name cannot be empty" }));
  }
  return Effect.succeed(true);
};

/**
 * Create diagram from loaded data
 */
export const createDiagramFromLoaded = (
  diagram: Diagram,
): Effect.Effect<{
  metadata: DiagramMetadata;
  nodes: Node[];
  edges: Edge[];
  lastSaved: number;
}> => {
  return Effect.succeed({
    metadata: {
      id: diagram.id,
      name: diagram.name,
      description: diagram.description,
      sessionName: "",
    },
    nodes: diagram.nodes,
    edges: diagram.edges,
    lastSaved: diagram.updatedAt,
  });
};

/**
 * Get selected nodes from node list
 */
export const getSelectedNodes = (
  nodes: Node[],
): Effect.Effect<string[]> => {
  return Effect.succeed(
    nodes.filter((node) => node.selected).map((node) => node.id),
  );
};

/**
 * Check if there are any selected nodes
 */
export const hasSelectedNodes = (
  nodes: Node[],
): Effect.Effect<boolean> => {
  return Effect.gen(function*() {
    const selectedIds = yield* getSelectedNodes(nodes);
    return selectedIds.length > 0;
  });
};
