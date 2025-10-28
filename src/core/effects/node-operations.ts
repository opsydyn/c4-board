/**
 * Node Operations (Effect-TS)
 *
 * FUNCTIONAL CORE - Pure business logic for node operations.
 * NO side effects: no invoke(), no DOM, no localStorage.
 * All functions return Effect<Env, Error, Result> for composition and testability.
 */

import type { Node } from "@xyflow/react";
import { Effect } from "effect";
import { nanoid } from "nanoid";

/**
 * C4 model node types
 */
export type C4Type = "person" | "system" | "externalSystem" | "container" | "component";

/**
 * Node data shape
 * Extends Record<string, unknown> to be compatible with ReactFlow's Node data type
 */
export interface NodeData extends Record<string, unknown> {
	label: string;
	description: string;
	technology: string;
	c4Type: C4Type;
}

/**
 * Position for a new node
 */
export interface NodePosition {
	x: number;
	y: number;
}

/**
 * Options for creating a new node
 */
export interface CreateNodeOptions {
	type: C4Type;
	label: string;
	nodeCounter: number;
	selectedNodeId: string | null;
	existingNodes: Node[];
}

/**
 * Generate a stable unique node id
 */
const generateNodeId = (prefix: string): string => `${prefix}-${nanoid(12)}`;

/**
 * Calculate initial position for a new node
 * Uses simple offset positioning - users will use Dagre auto-layout for final arrangement
 */
export const calculateInitialPosition = (nodeCount: number): Effect.Effect<NodePosition> => {
	const OFFSET = 80; // Spacing between each new node
	const START_X = 400;
	const START_Y = 300;

	return Effect.succeed({
		x: START_X + (nodeCount * OFFSET),
		y: START_Y + (nodeCount * OFFSET),
	});
};

/**
 * Check if a node is a container type
 */
export const isContainerNode = (node: Node | null): Effect.Effect<boolean> => {
	return Effect.succeed(node?.type === "container");
};

/**
 * Get position for a node inside a container
 */
export const getChildPosition = (): Effect.Effect<NodePosition> => {
	return Effect.succeed({ x: 20, y: 60 });
};

/**
 * Get position for a node at the root level
 */
export const getRootPosition = (nodeCount: number): Effect.Effect<NodePosition> => {
	return calculateInitialPosition(nodeCount);
};

/**
 * Determine the position for a new node based on parent context
 */
export const determineNodePosition = (
	nodeCount: number,
	selectedNode: Node | null,
): Effect.Effect<NodePosition> => {
	return Effect.gen(function* () {
		const isContainer = yield* isContainerNode(selectedNode);

		if (isContainer) {
			return yield* getChildPosition();
		}

		return yield* getRootPosition(nodeCount);
	});
};

/**
 * Create parent relationship properties if parent is a container
 */
export const createParentRelationship = (
	selectedNode: Node | null,
): Effect.Effect<{ parentId: string; extent: "parent"; expandParent: boolean } | null> => {
	return Effect.gen(function* () {
		const isContainer = yield* isContainerNode(selectedNode);

		if (!isContainer || !selectedNode) {
			return null;
		}

		return {
			parentId: selectedNode.id,
			extent: "parent" as const,
			expandParent: true,
		};
	});
};

/**
 * Get default label for a node type
 */
export const getDefaultLabel = (type: C4Type): Effect.Effect<string> => {
	const labels: Record<C4Type, string> = {
		person: "New Person",
		system: "New System",
		externalSystem: "External System",
		container: "Container",
		component: "Component",
	};

	return Effect.succeed(labels[type]);
};

/**
 * Get default size for a node type
 */
export const getDefaultSize = (type: C4Type): Effect.Effect<{ width: number; height: number } | null> => {
	if (type === "container") {
		return Effect.succeed({ width: 400, height: 300 });
	}
	return Effect.succeed(null);
};

/**
 * Create a new node with all necessary properties
 */
export const createNode = (options: CreateNodeOptions): Effect.Effect<Node> => {
	return Effect.gen(function* () {
		const { type, label, nodeCounter, selectedNodeId, existingNodes } = options;

		// Find selected node
		const selectedNode = selectedNodeId
			? existingNodes.find((n) => n.id === selectedNodeId) ?? null
			: null;

		// Generate ID based on type
		const typePrefix = type === "externalSystem" ? "external" : type;
		const id = generateNodeId(typePrefix);

		// Determine position
		const position = yield* determineNodePosition(nodeCounter, selectedNode);

		// Create parent relationship if applicable
		const parentRelationship = yield* createParentRelationship(selectedNode);

		// Get default label if not provided
		const defaultLabel = yield* getDefaultLabel(type);
		const finalLabel = label || defaultLabel;

		// Get default size
		const size = yield* getDefaultSize(type);

		// Build node
		const node: Node = {
			id,
			type: type === "externalSystem" ? "externalSystem" : type,
			position,
			data: {
				label: finalLabel,
				description: "",
				technology: "",
				c4Type: type,
			} as NodeData,
			...(size && { style: size }),
			...(parentRelationship && parentRelationship),
		};

		return node;
	});
};

/**
 * Add a new node to the node list
 */
export const addNode = (
	nodes: Node[],
	newNode: Node,
): Effect.Effect<Node[]> => {
	return Effect.succeed([...nodes, newNode]);
};

/**
 * Update a node's data
 */
export const updateNodeData = (
	nodes: Node[],
	nodeId: string,
	updates: Partial<NodeData>,
): Effect.Effect<Node[]> => {
	return Effect.succeed(
		nodes.map((node) =>
			node.id === nodeId
				? { ...node, data: { ...node.data, ...updates } }
				: node,
		),
	);
};

/**
 * Remove a node from the node list
 */
export const removeNode = (
	nodes: Node[],
	nodeId: string,
): Effect.Effect<Node[]> => {
	return Effect.succeed(nodes.filter((node) => node.id !== nodeId));
};

/**
 * Find a node by ID
 */
export const findNodeById = (
	nodes: Node[],
	nodeId: string,
): Effect.Effect<Node | null> => {
	return Effect.succeed(nodes.find((node) => node.id === nodeId) ?? null);
};
