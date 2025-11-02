/**
 * Canvas Persistence Effect Services (Functional Core)
 *
 * Pure functions for saving/loading C4 diagrams to/from database
 * Handles conversion between ReactFlow format and database schema
 *
 * Architecture:
 * - Effect functions describe WHAT to do (pure logic)
 * - DatabaseService provides HOW to do it (I/O)
 * - XState machines orchestrate WHEN to do it (flow control)
 *
 * Idiomatic Effect patterns:
 * - Effect.forEach for async iterations (replaces imperative for loops)
 * - Either.match for pattern matching on Result types
 * - pipe for composition and readability
 * - Extracted reusable upsert patterns
 */

import { Effect, Either, pipe } from "effect";
import type { Node as ReactFlowNode, Edge as ReactFlowEdge } from "@xyflow/react";
import {
	type Node as DbNode,
	type Edge as DbEdge,
	type CreateDiagramInput,
	type CreateNodeInput,
	type CreateEdgeInput,
	type UpdateDiagramInput,
	type UpdateNodeInput,
	createDiagram,
	getDiagram,
	listDiagrams,
	updateDiagram,
	deleteDiagram,
	createNode,
	getNodesByDiagram,
	updateNode,
	deleteNode,
	createEdge,
	getEdgesByDiagram,
	updateEdgeLabel,
	deleteEdge,
	NotFoundError,
} from "./database";
import { getDefaultIconId, type C4Type, type NodeIconId } from "./node-operations";

// ============================================================================
// Type Definitions
// ============================================================================

export interface CanvasDiagram {
	id: string;
	name: string;
	description?: string;
	nodes: ReactFlowNode[];
	edges: ReactFlowEdge[];
	createdAt: number;
	updatedAt: number;
}

export interface SaveDiagramInput {
	id: string;
	name: string;
	description?: string;
	nodes: ReactFlowNode[];
	edges: ReactFlowEdge[];
}

// ============================================================================
// Conversion Utilities (Pure Functions)
// ============================================================================

/**
 * Helper: Add optional field if value is not null/undefined (pure function)
 * Returns a NEW object, never mutates the input
 */
const addOptional =
	<K extends string, V>(key: K, value: V | null | undefined) =>
	<T extends Record<string, unknown>>(obj: T): T => {
		if (value !== null && value !== undefined) {
			return { ...obj, [key]: value } as T;
		}
		return obj;
	};

/**
 * Helper: Build style object from optional dimensions
 */
const buildStyle = (width: number | null, height: number | null) => {
	if (width === null && height === null) return undefined;
	return {
		...(width !== null ? { width } : {}),
		...(height !== null ? { height } : {}),
	};
};

/**
 * Helper: Build partial object from optional value
 * Returns empty object if value is undefined, otherwise returns {key: value}
 */
const optional = <K extends string, V>(
	key: K,
	value: V | undefined,
): Record<K, V> | Record<string, never> => {
	return value !== undefined ? ({ [key]: value } as Record<K, V>) : {};
};

/**
 * Convert database node to ReactFlow node format using PURE functional composition
 * Uses pipe to chain transformations - no mutations!
 */
export function dbNodeToReactFlow(dbNode: DbNode): ReactFlowNode {
	const fallbackIcon = getDefaultIconId(dbNode.type as C4Type);

	// Base node (always present fields)
	const baseNode: ReactFlowNode = {
		id: dbNode.id,
		type: dbNode.type,
		position: {
			x: dbNode.position_x,
			y: dbNode.position_y,
		},
		data: {
			label: dbNode.label,
			technology: dbNode.technology ?? undefined,
			description: dbNode.description ?? undefined,
			c4Type: dbNode.type,
			createdAt: dbNode.created_at,
			iconId: (dbNode.icon_id as NodeIconId | null) ?? fallbackIcon,
		},
	};

	// Pure functional composition - each function returns a NEW object
	return pipe(
		baseNode,
		addOptional("width", dbNode.width),
		addOptional("height", dbNode.height),
		addOptional("style", buildStyle(dbNode.width, dbNode.height)),
		addOptional("parentId", dbNode.parent_id),
		addOptional("extent", dbNode.extent),
		addOptional("expandParent", dbNode.expand_parent === 1 ? true : undefined),
	);
}

/**
 * Convert ReactFlow node to database node format using helper functions
 */
export function reactFlowNodeToDb(
	node: ReactFlowNode,
	diagramId: string,
): CreateNodeInput {
	const rawData =
		typeof node.data === "object" && node.data !== null ? node.data : {};
	const dataRecord = rawData as Record<string, unknown>;
	const labelValue = dataRecord.label;
	const technologyValue = dataRecord.technology;
	const descriptionValue = dataRecord.description;
	const explicitType =
		typeof node.type === "string" && node.type.length > 0 ? node.type : undefined;
	const dataType =
		typeof dataRecord.c4Type === "string" && dataRecord.c4Type.length > 0
			? (dataRecord.c4Type as string)
			: undefined;
	const resolvedType = (explicitType ?? dataType ?? "system") as CreateNodeInput["type"];
	const styleWidth = extractNumericDimension(node.style?.width);
	const styleHeight = extractNumericDimension(node.style?.height);
	const widthValue = typeof node.width === "number" ? node.width : styleWidth;
	const heightValue = typeof node.height === "number" ? node.height : styleHeight;

	const technology =
		typeof technologyValue === "string" ? technologyValue : undefined;
	const description =
		typeof descriptionValue === "string" ? descriptionValue : undefined;
	const iconValue =
		typeof dataRecord.iconId === "string" && dataRecord.iconId.length > 0
			? (dataRecord.iconId as string)
			: undefined;
	const resolvedIconId = iconValue ?? getDefaultIconId(resolvedType as C4Type);
	const label =
		typeof labelValue === "string" && labelValue.length > 0 ? labelValue : "Unnamed";

	return {
		id: node.id,
		diagram_id: diagramId,
		type: resolvedType,
		label,
		...optional("technology", technology),
		...optional("description", description),
		position_x: node.position.x,
		position_y: node.position.y,
		...optional("width", widthValue),
		...optional("height", heightValue),
		// Parent-child relationship fields for sub-flows
		...optional("parent_id", node.parentId),
		...optional("extent", node.extent as "parent" | undefined),
		...optional("expand_parent", node.expandParent),
		...optional("icon_id", resolvedIconId),
	};
}

/**
 * Convert database edge to ReactFlow edge format
 */
function dbEdgeToReactFlow(dbEdge: DbEdge): ReactFlowEdge {
	return {
		id: dbEdge.id,
		source: dbEdge.source,
		target: dbEdge.target,
		label: dbEdge.label ?? undefined,
		type: "default",
		data: {
			createdAt: dbEdge.created_at,
		},
	};
}

/**
 * Convert ReactFlow edge to database edge format using helper
 */
function reactFlowEdgeToDb(
	edge: ReactFlowEdge,
	diagramId: string,
): CreateEdgeInput {
	const labelValue = typeof edge.label === "string" ? edge.label : undefined;

	return {
		id: edge.id,
		diagram_id: diagramId,
		source: edge.source,
		target: edge.target,
		...optional("label", labelValue),
	};
}

// ============================================================================
// Effect Services (Functional Core)
// ============================================================================

/**
 * Save complete diagram state (diagram + nodes + edges)
 * Uses transactional approach with Effect.forEach for iterations
 */
export const saveDiagram = (input: SaveDiagramInput) =>
	Effect.gen(function* () {
		// 1. Check if diagram exists, create or update using Either.match
		const existingDiagram = yield* Effect.either(getDiagram(input.id));

		yield* Either.match(existingDiagram, {
			// Left: diagram not found or error
			onLeft: (error) => {
				if (error instanceof NotFoundError) {
					// Create new diagram
					const createPayload: CreateDiagramInput = {
						id: input.id,
						name: input.name,
						...(input.description !== undefined
							? { description: input.description }
							: {}),
					};
					return createDiagram(createPayload);
				}
				// Re-throw other errors
				return Effect.fail(error);
			},
			// Right: diagram exists, update it
			onRight: () => {
				const updatePayload: UpdateDiagramInput = {
					name: input.name,
					...(input.description !== undefined
						? { description: input.description }
						: {}),
				};
				return updateDiagram(input.id, updatePayload);
			},
		});

		// 2. Get existing nodes and edges to determine what to delete
		const existingNodes = yield* getNodesByDiagram(input.id);
		const existingEdges = yield* getEdgesByDiagram(input.id);

		const currentNodeIds = new Set(input.nodes.map((n) => n.id));
		const currentEdgeIds = new Set(input.edges.map((e) => e.id));

		// 3. Delete nodes that no longer exist using Effect.forEach
		const nodesToDelete = existingNodes.filter((n) => !currentNodeIds.has(n.id));
		yield* Effect.forEach(nodesToDelete, (node) => deleteNode(node.id), {
			concurrency: "unbounded",
		});

		// 4. Delete edges that no longer exist using Effect.forEach
		const edgesToDelete = existingEdges.filter((e) => !currentEdgeIds.has(e.id));
		yield* Effect.forEach(edgesToDelete, (edge) => deleteEdge(edge.id), {
			concurrency: "unbounded",
		});

		// 5. Upsert all current nodes using Effect.forEach
		yield* Effect.forEach(
			input.nodes,
			(node) => {
				const dbNodeInput = reactFlowNodeToDb(node, input.id);
				const nodeExists = existingNodes.some((n) => n.id === node.id);

				if (nodeExists) {
					// Update existing node
					const updateNodePayload: UpdateNodeInput = {
						label: dbNodeInput.label,
						position_x: dbNodeInput.position_x,
						position_y: dbNodeInput.position_y,
						...(dbNodeInput.technology !== undefined
							? { technology: dbNodeInput.technology }
							: {}),
						...(dbNodeInput.description !== undefined
							? { description: dbNodeInput.description }
							: {}),
						...(dbNodeInput.width !== undefined ? { width: dbNodeInput.width } : {}),
						...(dbNodeInput.height !== undefined ? { height: dbNodeInput.height } : {}),
						...(dbNodeInput.parent_id !== undefined
							? { parent_id: dbNodeInput.parent_id }
							: {}),
						...(dbNodeInput.extent !== undefined ? { extent: dbNodeInput.extent } : {}),
						...(dbNodeInput.expand_parent !== undefined
							? { expand_parent: dbNodeInput.expand_parent }
							: {}),
						...(dbNodeInput.icon_id !== undefined ? { icon_id: dbNodeInput.icon_id } : {}),
					};
					return updateNode(node.id, updateNodePayload);
				}
				// Create new node
				return createNode(dbNodeInput);
			},
			{ concurrency: "unbounded" },
		);

		// 6. Upsert all current edges using Effect.forEach
		yield* Effect.forEach(
			input.edges,
			(edge) => {
				const dbEdgeInput = reactFlowEdgeToDb(edge, input.id);
				const existingEdge = existingEdges.find((e) => e.id === edge.id);

				if (existingEdge) {
					// Update existing edge if label has changed
					const newLabel = dbEdgeInput.label ?? "uses";
					const currentLabel = existingEdge.label ?? "uses";

					return newLabel !== currentLabel
						? updateEdgeLabel(edge.id, newLabel)
						: Effect.succeed(undefined);
				}
				// Create new edge
				return createEdge(dbEdgeInput);
			},
			{ concurrency: "unbounded" },
		);

		return {
			diagramId: input.id,
			savedAt: Date.now(),
		};
	});

/**
 * Load complete diagram state (diagram + nodes + edges)
 */
export const loadDiagram = (diagramId: string) =>
	Effect.gen(function* () {
		// 1. Load diagram metadata
		const diagram = (yield* getDiagram(diagramId))!;

		// 2. Load all nodes for this diagram
		const dbNodes = yield* getNodesByDiagram(diagramId);

		// 3. Load all edges for this diagram
		const dbEdges = yield* getEdgesByDiagram(diagramId);

		// 4. Convert to ReactFlow format
		const nodes = dbNodes.map(dbNodeToReactFlow);
		const edges = dbEdges.map(dbEdgeToReactFlow);

		return {
			id: diagram.id,
			name: diagram.name,
			...(diagram.description !== null
				? { description: diagram.description }
				: {}),
			nodes,
			edges,
			createdAt: diagram.created_at,
			updatedAt: diagram.updated_at,
		} satisfies CanvasDiagram;
	});

/**
 * Create a new empty diagram
 */
export const createNewDiagram = (name: string, description?: string) =>
	Effect.gen(function* () {
		const id = `diagram-${Date.now()}`;

		const createPayload: CreateDiagramInput = {
			id,
			name,
			...(description !== undefined ? { description } : {}),
		};

		yield* createDiagram(createPayload);

		return {
			id,
			name,
			...(description !== undefined ? { description } : {}),
			nodes: [],
			edges: [],
			createdAt: Date.now(),
			updatedAt: Date.now(),
		} satisfies CanvasDiagram;
	});

/**
 * List all diagrams (metadata only, no nodes/edges)
 */
export const listAllDiagrams = () =>
	Effect.gen(function* () {
		const diagrams = yield* listDiagrams();

		return diagrams.map((d) => ({
			id: d.id,
			name: d.name,
			...(d.description !== null ? { description: d.description } : {}),
			createdAt: d.created_at,
			updatedAt: d.updated_at,
		}));
	});

/**
 * Get diagram statistics (node and edge counts)
 */
export const getDiagramStats = (diagramId: string) =>
	Effect.gen(function* () {
		const dbNodes = yield* getNodesByDiagram(diagramId);
		const dbEdges = yield* getEdgesByDiagram(diagramId);

		// Count nodes by type
		const nodesByType = dbNodes.reduce(
			(acc, node) => {
				const type = node.type || "unknown";
				acc[type] = (acc[type] || 0) + 1;
				return acc;
			},
			{} as Record<string, number>,
		);

		return {
			diagramId,
			nodeCount: dbNodes.length,
			edgeCount: dbEdges.length,
			nodesByType,
		};
	});

/**
 * Delete diagram and all associated nodes/edges (CASCADE)
 */
export const removeDiagram = (diagramId: string) =>
	Effect.gen(function* () {
		yield* deleteDiagram(diagramId);

		return {
			deletedId: diagramId,
			deletedAt: Date.now(),
		};
	});

/**
 * Duplicate a diagram with all its nodes and edges
 */
export const duplicateDiagram = (sourceDiagramId: string, newName: string) =>
	Effect.gen(function* () {
		// 1. Load source diagram
		const source = yield* loadDiagram(sourceDiagramId);

		// 2. Create new diagram with new ID
		const newId = `diagram-${Date.now()}`;

		// 3. Map old node IDs to new node IDs
		const nodeIdMap = new Map<string, string>();
		const newNodes = source.nodes.map((node) => {
			const newNodeId = `${node.id}-copy-${Date.now()}`;
			nodeIdMap.set(node.id, newNodeId);
			return {
				...node,
				id: newNodeId,
			};
		});

		// 4. Update edge IDs to reference new node IDs
		const newEdges = source.edges.map((edge) => ({
			...edge,
			id: `${edge.id}-copy-${Date.now()}`,
			source: nodeIdMap.get(edge.source) || edge.source,
			target: nodeIdMap.get(edge.target) || edge.target,
		}));

		// 5. Save the duplicate
		const duplicatePayload: SaveDiagramInput = {
			id: newId,
			name: newName,
			nodes: newNodes,
			edges: newEdges,
			...(source.description !== undefined
				? { description: source.description }
				: {}),
		};

		yield* saveDiagram(duplicatePayload);

		return {
			id: newId,
			name: newName,
			...(source.description !== undefined
				? { description: source.description }
				: {}),
			nodes: newNodes,
			edges: newEdges,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		} satisfies CanvasDiagram;
	});
const extractNumericDimension = (value: unknown): number | undefined => {
	if (typeof value === "number") {
		return value;
	}
	if (typeof value === "string") {
		const parsed = Number.parseFloat(value);
		return Number.isFinite(parsed) ? parsed : undefined;
	}
	return undefined;
};
