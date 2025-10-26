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
 */

import { Effect } from "effect";
import type { Node as ReactFlowNode, Edge as ReactFlowEdge } from "@xyflow/react";
import {
	DatabaseService,
	type Diagram,
	type Node as DbNode,
	type Edge as DbEdge,
	type CreateDiagramInput,
	type CreateNodeInput,
	type CreateEdgeInput,
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
	deleteEdge,
	NotFoundError,
	DatabaseError,
} from "./database";

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
 * Convert database node to ReactFlow node format
 */
function dbNodeToReactFlow(dbNode: DbNode): ReactFlowNode {
	return {
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
		},
	};
}

/**
 * Convert ReactFlow node to database node format
 */
function reactFlowNodeToDb(
	node: ReactFlowNode,
	diagramId: string,
): CreateNodeInput {
	return {
		id: node.id,
		diagram_id: diagramId,
		type: (node.type || "system") as "person" | "system" | "externalSystem",
		label: (node.data?.label as string) || "Unnamed",
		technology: (node.data?.technology as string) || undefined,
		description: (node.data?.description as string) || undefined,
		position_x: node.position.x,
		position_y: node.position.y,
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
	};
}

/**
 * Convert ReactFlow edge to database edge format
 */
function reactFlowEdgeToDb(
	edge: ReactFlowEdge,
	diagramId: string,
): CreateEdgeInput {
	return {
		id: edge.id,
		diagram_id: diagramId,
		source: edge.source,
		target: edge.target,
		label: edge.label as string | undefined,
	};
}

// ============================================================================
// Effect Services (Functional Core)
// ============================================================================

/**
 * Save complete diagram state (diagram + nodes + edges)
 * Uses transactional approach: save diagram, then nodes, then edges
 */
export const saveDiagram = (input: SaveDiagramInput) =>
	Effect.gen(function* () {
		const service = yield* DatabaseService;

		// 1. Check if diagram exists, create or update
		const existingDiagram = yield* Effect.either(getDiagram(input.id));

		if (existingDiagram._tag === "Left") {
			// Create new diagram
			yield* createDiagram({
				id: input.id,
				name: input.name,
				description: input.description,
			});
		} else {
			// Update existing diagram
			yield* updateDiagram(input.id, {
				name: input.name,
				description: input.description,
			});
		}

		// 2. Get existing nodes and edges to determine what to delete
		const existingNodes = yield* getNodesByDiagram(input.id);
		const existingEdges = yield* getEdgesByDiagram(input.id);

		const currentNodeIds = new Set(input.nodes.map((n) => n.id));
		const currentEdgeIds = new Set(input.edges.map((e) => e.id));

		// 3. Delete nodes that no longer exist
		for (const existingNode of existingNodes) {
			if (!currentNodeIds.has(existingNode.id)) {
				yield* deleteNode(existingNode.id);
			}
		}

		// 4. Delete edges that no longer exist
		for (const existingEdge of existingEdges) {
			if (!currentEdgeIds.has(existingEdge.id)) {
				yield* deleteEdge(existingEdge.id);
			}
		}

		// 5. Upsert all current nodes
		for (const node of input.nodes) {
			const dbNodeInput = reactFlowNodeToDb(node, input.id);

			// Check if node exists
			const nodeExists = existingNodes.some((n) => n.id === node.id);

			if (nodeExists) {
				// Update existing node
				yield* updateNode(node.id, {
					label: dbNodeInput.label,
					technology: dbNodeInput.technology,
					description: dbNodeInput.description,
					position_x: dbNodeInput.position_x,
					position_y: dbNodeInput.position_y,
				});
			} else {
				// Create new node
				yield* createNode(dbNodeInput);
			}
		}

		// 6. Upsert all current edges (delete and recreate is simpler for edges)
		for (const edge of input.edges) {
			const dbEdgeInput = reactFlowEdgeToDb(edge, input.id);

			// Check if edge exists
			const edgeExists = existingEdges.some((e) => e.id === edge.id);

			if (!edgeExists) {
				// Create new edge (edges don't have update, so we only create new ones)
				yield* createEdge(dbEdgeInput);
			}
		}

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
		const diagram = yield* getDiagram(diagramId);

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
			description: diagram.description ?? undefined,
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

		yield* createDiagram({
			id,
			name,
			description,
		});

		return {
			id,
			name,
			description,
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
			description: d.description ?? undefined,
			createdAt: d.created_at,
			updatedAt: d.updated_at,
		}));
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
		yield* saveDiagram({
			id: newId,
			name: newName,
			description: source.description,
			nodes: newNodes,
			edges: newEdges,
		});

		return {
			id: newId,
			name: newName,
			description: source.description,
			nodes: newNodes,
			edges: newEdges,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		} satisfies CanvasDiagram;
	});
