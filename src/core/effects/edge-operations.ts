/**
 * Edge Operations (Effect-TS)
 *
 * FUNCTIONAL CORE - Pure business logic for edge operations and validation.
 * NO side effects: no invoke(), no DOM, no localStorage.
 * All functions return Effect<Env, Error, Result> for composition and testability.
 */

import type { Edge } from "@xyflow/react";
import { Effect } from "effect";

/**
 * Validation errors for edge operations
 */
export class EdgeValidationError {
	readonly _tag = "EdgeValidationError";
	constructor(readonly message: string) {}
}

/**
 * Check if a connection would create a self-loop (node connecting to itself)
 */
export const isSelfConnection = (
	source: string,
	target: string,
): Effect.Effect<boolean> => {
	return Effect.succeed(source === target);
};

/**
 * Check if an edge already exists between two nodes (bidirectional)
 * Returns true if A→B or B→A exists
 */
export const isDuplicateEdge = (
	edges: Edge[],
	source: string,
	target: string,
): Effect.Effect<boolean> => {
	return Effect.succeed(
		edges.some(
			(edge) =>
				(edge.source === source && edge.target === target) ||
				(edge.source === target && edge.target === source),
		),
	);
};

/**
 * Validate an edge connection
 * Returns Effect.fail with error if invalid, Effect.succeed(true) if valid
 */
export const validateEdgeConnection = (
	edges: Edge[],
	source: string,
	target: string,
): Effect.Effect<boolean, EdgeValidationError> => {
	return Effect.gen(function* () {
		// Check for self-connection
		const isSelf = yield* isSelfConnection(source, target);
		if (isSelf) {
			return yield* Effect.fail(
				new EdgeValidationError("Cannot connect node to itself"),
			);
		}

		// Check for duplicate edge
		const isDuplicate = yield* isDuplicateEdge(edges, source, target);
		if (isDuplicate) {
			return yield* Effect.fail(
				new EdgeValidationError("Edge already exists between these nodes"),
			);
		}

		return true;
	});
};

/**
 * Create a new edge between two nodes
 */
export const createEdge = (
	source: string,
	target: string,
	label: string = "uses",
): Effect.Effect<Edge> => {
	return Effect.succeed({
		id: `edge-${Date.now()}`,
		source,
		target,
		label,
		type: "default",
	});
};

/**
 * Add an edge to the edge list
 */
export const addEdge = (
	edges: Edge[],
	newEdge: Edge,
): Effect.Effect<Edge[]> => {
	return Effect.succeed([...edges, newEdge]);
};

/**
 * Remove edges connected to a specific node
 * Used when deleting a node - cascade delete connected edges
 */
export const removeEdgesConnectedToNode = (
	edges: Edge[],
	nodeId: string,
): Effect.Effect<Edge[]> => {
	return Effect.succeed(
		edges.filter(
			(edge) => edge.source !== nodeId && edge.target !== nodeId,
		),
	);
};

/**
 * Remove a specific edge by ID
 */
export const removeEdge = (
	edges: Edge[],
	edgeId: string,
): Effect.Effect<Edge[]> => {
	return Effect.succeed(edges.filter((edge) => edge.id !== edgeId));
};

/**
 * Find an edge by ID
 */
export const findEdgeById = (
	edges: Edge[],
	edgeId: string,
): Effect.Effect<Edge | null> => {
	return Effect.succeed(edges.find((edge) => edge.id === edgeId) ?? null);
};

/**
 * Get all edges connected to a node (as source or target)
 */
export const getEdgesForNode = (
	edges: Edge[],
	nodeId: string,
): Effect.Effect<Edge[]> => {
	return Effect.succeed(
		edges.filter(
			(edge) => edge.source === nodeId || edge.target === nodeId,
		),
	);
};

/**
 * Create and validate a new edge connection
 * Combines validation and creation into a single operation
 */
export const createValidatedEdge = (
	edges: Edge[],
	source: string,
	target: string,
	label: string = "uses",
): Effect.Effect<Edge, EdgeValidationError> => {
	return Effect.gen(function* () {
		// Validate the connection
		yield* validateEdgeConnection(edges, source, target);

		// Create the edge
		const newEdge = yield* createEdge(source, target, label);

		return newEdge;
	});
};

/**
 * Create and add a validated edge to the edge list
 * Returns updated edge list or fails with validation error
 */
export const addValidatedEdge = (
	edges: Edge[],
	source: string,
	target: string,
	label: string = "uses",
): Effect.Effect<Edge[], EdgeValidationError> => {
	return Effect.gen(function* () {
		// Create validated edge
		const newEdge = yield* createValidatedEdge(edges, source, target, label);

		// Add to edge list
		const updatedEdges = yield* addEdge(edges, newEdge);

		return updatedEdges;
	});
};
