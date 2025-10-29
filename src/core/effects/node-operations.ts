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

const GRID_SIZE = 20;
const DEFAULT_PLACEMENT_CENTER = { x: 360, y: 280 };

const DEFAULT_DIMENSIONS: Record<C4Type | "default", { width: number; height: number }> = {
	person: { width: 220, height: 160 },
	system: { width: 240, height: 170 },
	externalSystem: { width: 240, height: 170 },
	container: { width: 400, height: 300 },
	component: { width: 200, height: 140 },
	default: { width: 240, height: 170 },
};

const snapToGrid = (value: number): number =>
	Math.round(value / GRID_SIZE) * GRID_SIZE;

const resolveType = (node: Node): C4Type => {
	const data = node.data as NodeData | undefined;
	const inferred = (data?.c4Type as C4Type | undefined) ?? (node.type as C4Type | undefined);
	return inferred ?? "system";
};

const getTypeDimensions = (type: C4Type): { width: number; height: number } =>
	DEFAULT_DIMENSIONS[type] ?? DEFAULT_DIMENSIONS.default;

const getNodeDimensions = (node: Node): { width: number; height: number } => {
	const type = resolveType(node);
	const fallback = getTypeDimensions(type);

	const width =
		typeof node.measured?.width === "number"
			? node.measured.width
			: typeof node.width === "number"
				? node.width
				: typeof (node.style as { width?: number } | undefined)?.width === "number"
					? (node.style as { width?: number }).width!
					: fallback.width;

	const height =
		typeof node.measured?.height === "number"
			? node.measured.height
			: typeof node.height === "number"
				? node.height
				: typeof (node.style as { height?: number } | undefined)?.height === "number"
					? (node.style as { height?: number }).height!
					: fallback.height;

	return { width, height };
};

interface Bounds {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
	width: number;
	height: number;
	centerX: number;
	centerY: number;
}

const calculateBounds = (nodes: Node[]): Bounds | null => {
	if (nodes.length === 0) {
		return null;
	}

	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;

	nodes.forEach((node) => {
		const { width, height } = getNodeDimensions(node);
		const x = node.position.x;
		const y = node.position.y;

		minX = Math.min(minX, x);
		minY = Math.min(minY, y);
		maxX = Math.max(maxX, x + width);
		maxY = Math.max(maxY, y + height);
	});

	const boundsWidth = maxX - minX;
	const boundsHeight = maxY - minY;

	return {
		minX,
		maxX,
		minY,
		maxY,
		width: boundsWidth,
		height: boundsHeight,
		centerX: minX + boundsWidth / 2,
		centerY: minY + boundsHeight / 2,
	};
};

/**
 * Generate a stable unique node id
 */
const generateNodeId = (prefix: string): string => `${prefix}-${nanoid(12)}`;

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
 * Determine the position for a new node based on parent context
 */
export const determineNodePosition = (
	nodeCount: number,
	selectedNode: Node | null,
	existingNodes: Node[],
	newNodeType: C4Type,
): Effect.Effect<NodePosition> => {
	return Effect.gen(function* () {
		const isContainer = yield* isContainerNode(selectedNode);

		if (isContainer) {
			return yield* getChildPosition();
		}

		const rootNodes = existingNodes.filter((node) => !node.parentId);
		const bounds = calculateBounds(rootNodes);
		const { width, height } = getTypeDimensions(newNodeType);

		if (!bounds) {
			return {
				x: snapToGrid(DEFAULT_PLACEMENT_CENTER.x - width / 2),
				y: snapToGrid(DEFAULT_PLACEMENT_CENTER.y - height / 2),
			};
		}

		const maxSpan = Math.max(bounds.width, bounds.height);
		const baseRadius = Math.max(maxSpan / 2, 160) + 120;
		const ringIndex = Math.floor(nodeCount / 6);
		const radius = baseRadius + ringIndex * 80;
		const angle = (Math.PI / 3) * (nodeCount % 6);

		const rawX = bounds.centerX + Math.cos(angle) * radius - width / 2;
		const rawY = bounds.centerY + Math.sin(angle) * radius - height / 2;

		return {
			x: snapToGrid(rawX),
			y: snapToGrid(rawY),
		};
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
		const position = yield* determineNodePosition(
			nodeCounter,
			selectedNode,
			existingNodes,
			type,
		);

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
