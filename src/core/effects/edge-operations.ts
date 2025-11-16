/**
 * Edge Operations (Effect-TS)
 *
 * FUNCTIONAL CORE - Pure business logic for edge operations and validation.
 * NO side effects: no invoke(), no DOM, no localStorage.
 * All functions return Effect<Env, Error, Result> for composition and testability.
 *
 * Idiomatic Effect patterns:
 * - Pattern matching with Match module
 * - Flow composition with pipe
 * - filterOrFail for validation
 * - forEach for async iterations
 */

import type { Edge } from "@xyflow/react";
import { Data, Effect,  pipe } from "effect";

/**
 * Communication protocols supported by edges
 */
export type EdgeProtocol =
	| "http"
	| "https"
	| "grpc"
	| "graphql"
	| "websocket"
	| "kafka"
	| "rabbitmq"
	| "redis"
	| "rest"
	| "soap"
	| "tcp"
	| "udp"
	| "custom";

/**
 * Edge communication style
 */
export type EdgeCommunicationStyle = "synchronous" | "asynchronous" | "optional";

/**
 * Visual style mapping for edge communication
 */
export const EDGE_STYLE_MAP: Record<EdgeCommunicationStyle, string> = {
	synchronous: "0", // Solid line
	asynchronous: "5,5", // Dashed line
	optional: "2,2", // Dotted line
};

/**
 * Protocol color coding for better visual distinction
 */
export const PROTOCOL_COLOR_MAP: Record<EdgeProtocol, string> = {
	http: "#4CAF50",
	https: "#2E7D32",
	grpc: "#1976D2",
	graphql: "#E91E63",
	websocket: "#9C27B0",
	kafka: "#000000",
	rabbitmq: "#FF6600",
	redis: "#DC382D",
	rest: "#4CAF50",
	soap: "#607D8B",
	tcp: "#795548",
	udp: "#FF9800",
	custom: "#9E9E9E",
};

/**
 * Edge metadata for smart edges
 */
export interface EdgeMetadata {
	protocol?: EdgeProtocol;
	communicationStyle?: EdgeCommunicationStyle;
	requestVolume?: number; // Requests per second
	latency?: number; // Average latency in ms
	notes?: string; // Additional notes
}

/**
 * Extended edge data with metadata
 */
export interface EdgeData {
	createdAt: number;
	metadata?: EdgeMetadata;
}

/**
 * Validation errors for edge operations
 */
export class EdgeValidationError extends Data.TaggedError("EdgeValidationError")<{
	message: string;
}> {}

/**
 * Check if a connection would create a self-loop (node connecting to itself)
 * Simplified: no need to wrap in Effect since it's a pure boolean check
 */
const isSelfConnection = (source: string, target: string): boolean =>
	source === target;

/**
 * Check if an edge already exists between two nodes (bidirectional)
 * Returns true if A→B or B→A exists
 * Simplified: no need to wrap in Effect since it's a pure boolean check
 */
const isDuplicateEdge = (
	edges: Edge[],
	source: string,
	target: string,
): boolean =>
	edges.some(
		(edge) =>
			(edge.source === source && edge.target === target) ||
			(edge.source === target && edge.target === source),
	);

/**
 * Validate an edge connection using Effect.filterOrFail for cleaner validation
 * Returns Effect.fail with error if invalid, Effect.succeed(void) if valid
 */
export const validateEdgeConnection = (
	edges: Edge[],
	source: string,
	target: string,
): Effect.Effect<void, EdgeValidationError> => {
	return pipe(
		Effect.succeed({ edges, source, target }),
		Effect.filterOrFail(
			({ source, target }) => !isSelfConnection(source, target),
			() => new EdgeValidationError({ message: "Cannot connect node to itself" }),
		),
		Effect.filterOrFail(
			({ edges, source, target }) => !isDuplicateEdge(edges, source, target),
			() =>
				new EdgeValidationError({
					message: "Edge already exists between these nodes",
				}),
		),
		Effect.asVoid,
	);
};

/**
 * Create a new edge between two nodes
 * Pure function - no Effect wrapper needed
 */
const createEdge = (source: string, target: string, label: string = "uses", metadata?: EdgeMetadata): Edge => {
	const createdAt = Date.now();
	return {
		id: `edge-${Date.now()}`,
		source,
		target,
		label,
		type: "default",
		data: {
			createdAt,
			metadata,
		} as EdgeData,
	};
};

/**
 * Find an edge by ID using Option pattern
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
export const getEdgesForNode = (edges: Edge[], nodeId: string): Edge[] =>
	edges.filter((edge) => edge.source === nodeId || edge.target === nodeId);

/**
 * Remove edges connected to a specific node
 * Used when deleting a node - cascade delete connected edges
 */
export const removeEdgesConnectedToNode = (edges: Edge[], nodeId: string): Effect.Effect<Edge[]> =>
	Effect.succeed(edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));

/**
 * Remove a specific edge by ID
 */
export const removeEdge = (edges: Edge[], edgeId: string): Effect.Effect<Edge[]> =>
	Effect.succeed(edges.filter((edge) => edge.id !== edgeId));

/**
 * Create and validate a new edge connection using pipe composition
 * Combines validation and creation into a single operation
 */
export const createValidatedEdge = (
	edges: Edge[],
	source: string,
	target: string,
	label: string = "uses",
): Effect.Effect<Edge, EdgeValidationError> =>
	pipe(
		validateEdgeConnection(edges, source, target),
		Effect.map(() => createEdge(source, target, label)),
	);

/**
 * Create and add a validated edge to the edge list using pipe composition
 * Returns updated edge list or fails with validation error
 */
export const addValidatedEdge = (
	edges: Edge[],
	source: string,
	target: string,
	label: string = "uses",
): Effect.Effect<Edge[], EdgeValidationError> =>
	pipe(
		createValidatedEdge(edges, source, target, label),
		Effect.map((newEdge) => [...edges, newEdge]),
	);

/**
 * Validate an edge label using pipe and filterOrFail for cleaner composition
 * Returns Effect.fail with error if invalid, Effect.succeed(label) if valid
 */
export const validateEdgeLabel = (
	label: string,
): Effect.Effect<string, EdgeValidationError> => {
	const trimmed = label.trim();

	return pipe(
		Effect.succeed(trimmed),
		Effect.filterOrFail(
			(label) => label.length > 0,
			() => new EdgeValidationError({ message: "Edge label cannot be empty" }),
		),
		Effect.filterOrFail(
			(label) => label.length <= 100,
			() =>
				new EdgeValidationError({
					message: "Edge label too long (max 100 characters)",
				}),
		),
	);
};

/**
 * Update the label of an existing edge using pipe composition
 * Validates the label and returns updated edges array
 */
export const updateEdgeLabel = (
	edges: Edge[],
	edgeId: string,
	label: string,
): Effect.Effect<Edge[], EdgeValidationError> =>
	pipe(
		// Find the edge and fail if not found
		findEdgeById(edges, edgeId),
		Effect.filterOrFail(
			(edge): edge is Edge => edge !== null,
			() =>
				new EdgeValidationError({
					message: `Edge with ID ${edgeId} not found`,
				}),
		),
		// Validate the new label
		Effect.flatMap(() => validateEdgeLabel(label)),
		// Update the edge in the array
		Effect.map((validatedLabel) =>
			edges.map((e) => (e.id === edgeId ? { ...e, label: validatedLabel } : e)),
		),
	);
