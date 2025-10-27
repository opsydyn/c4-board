/**
 * Layout Effects - Functional Core
 *
 * Auto-layout logic using Dagre for hierarchical graph layouts.
 * Pure functions - no side effects.
 *
 * Tactical layouts for military/engineering diagrams:
 * - Orthogonal routing (90° angles only)
 * - Grid snapping (20px tactical grid)
 * - Hierarchical layer separation
 * - Minimal edge crossings
 */

import dagre from "dagre";
import type { Node, Edge } from "@xyflow/react";

/**
 * Layout configuration options
 */
export interface LayoutOptions {
	direction: "TB" | "LR" | "BT" | "RL"; // Top-Bottom, Left-Right, Bottom-Top, Right-Left
	nodeSpacing: number; // Horizontal spacing between nodes
	rankSpacing: number; // Vertical spacing between layers
	edgeSpacing: number; // Spacing between edges
	snapToGrid?: boolean; // Snap to tactical grid
	gridSize?: number; // Grid size in pixels
}

/**
 * Default layout configuration - Tactical command chain style
 */
const DEFAULT_OPTIONS: LayoutOptions = {
	direction: "TB", // Top-to-bottom (command chain)
	nodeSpacing: 80, // Horizontal spacing
	rankSpacing: 120, // Vertical layer spacing
	edgeSpacing: 20, // Edge separation
	snapToGrid: true, // Snap to grid
	gridSize: 20, // 20px tactical grid
};

/**
 * Auto-layout nodes using Dagre algorithm
 * Pure function - takes nodes and edges, returns new node positions
 *
 * Only layouts top-level nodes - child nodes (with parentId) maintain their relative positions
 */
export function autoLayout(
	nodes: Node[],
	edges: Edge[],
	options: Partial<LayoutOptions> = {},
): Node[] {
	const opts = { ...DEFAULT_OPTIONS, ...options };

	// Separate top-level nodes from child nodes
	const topLevelNodes = nodes.filter((node) => !node.parentId);
	const childNodes = nodes.filter((node) => node.parentId);

	// Create Dagre graph
	const graph = new dagre.graphlib.Graph();
	graph.setDefaultEdgeLabel(() => ({}));

	// Configure layout algorithm
	graph.setGraph({
		rankdir: opts.direction,
		nodesep: opts.nodeSpacing,
		ranksep: opts.rankSpacing,
		edgesep: opts.edgeSpacing,
		marginx: 40,
		marginy: 40,
	});

	// Only add top-level nodes to graph
	topLevelNodes.forEach((node) => {
		const styleWidth = typeof node.style?.width === "number" ? node.style.width : undefined;
		const styleHeight = typeof node.style?.height === "number" ? node.style.height : undefined;

		const width = node.measured?.width || styleWidth || getDefaultNodeWidth(node.type);
		const height = node.measured?.height || styleHeight || getDefaultNodeHeight(node.type);

		graph.setNode(node.id, {
			width,
			height,
		});
	});

	// Only add edges between top-level nodes
	edges.forEach((edge) => {
		const sourceNode = nodes.find((n) => n.id === edge.source);
		const targetNode = nodes.find((n) => n.id === edge.target);

		// Only include edge if both nodes are top-level
		if (sourceNode && targetNode && !sourceNode.parentId && !targetNode.parentId) {
			graph.setEdge(edge.source, edge.target);
		}
	});

	// Run Dagre layout algorithm
	dagre.layout(graph);

	// Apply calculated positions to top-level nodes
	const layoutedTopLevelNodes = topLevelNodes.map((node) => {
		const position = graph.node(node.id);
		const styleWidth = typeof node.style?.width === "number" ? node.style.width : undefined;
		const styleHeight = typeof node.style?.height === "number" ? node.style.height : undefined;

		const width = node.measured?.width || styleWidth || getDefaultNodeWidth(node.type);
		const height = node.measured?.height || styleHeight || getDefaultNodeHeight(node.type);

		// Center the node at the calculated position
		let x = position.x - width / 2;
		let y = position.y - height / 2;

		// Snap to grid if enabled
		if (opts.snapToGrid && opts.gridSize) {
			x = Math.round(x / opts.gridSize) * opts.gridSize;
			y = Math.round(y / opts.gridSize) * opts.gridSize;
		}

		return {
			...node,
			position: { x, y },
		};
	});

	// Merge top-level nodes with child nodes (preserve child relative positions)
	return [...layoutedTopLevelNodes, ...childNodes];
}

/**
 * Auto-layout only selected nodes
 * Keeps unselected nodes in their current positions
 *
 * This creates a subgraph of selected nodes and their interconnecting edges,
 * layouts the subgraph, then merges back with unselected nodes.
 */
export function autoLayoutSelected(
	allNodes: Node[],
	allEdges: Edge[],
	selectedNodeIds: string[],
	options: Partial<LayoutOptions> = {},
): Node[] {
	if (selectedNodeIds.length === 0) {
		return allNodes; // No selection, return unchanged
	}

	const selectedSet = new Set(selectedNodeIds);

	// Filter selected top-level nodes only (ignore child nodes)
	const selectedNodes = allNodes.filter(
		(n) => selectedSet.has(n.id) && !n.parentId,
	);

	if (selectedNodes.length === 0) {
		return allNodes; // No top-level nodes selected, return unchanged
	}

	// Find edges that connect selected nodes
	const selectedEdges = allEdges.filter(
		(edge) => selectedSet.has(edge.source) && selectedSet.has(edge.target),
	);

	// Layout only the selected nodes
	const layoutedSelectedNodes = autoLayout(selectedNodes, selectedEdges, options);

	// Calculate the center of the original selected nodes
	const originalCenter = calculateCenter(selectedNodes);
	const newCenter = calculateCenter(layoutedSelectedNodes);

	// Offset to keep the group centered around its original position
	const offsetX = originalCenter.x - newCenter.x;
	const offsetY = originalCenter.y - newCenter.y;

	// Apply offset to layouted nodes
	const offsetLayoutedNodes = layoutedSelectedNodes.map((node) => ({
		...node,
		position: {
			x: node.position.x + offsetX,
			y: node.position.y + offsetY,
		},
	}));

	// Merge back with unselected nodes (preserve original order)
	return allNodes.map((node) => {
		const layoutedNode = offsetLayoutedNodes.find((n) => n.id === node.id);
		return layoutedNode || node;
	});
}

/**
 * Calculate the center point of a group of nodes
 */
function calculateCenter(nodes: Node[]): { x: number; y: number } {
	if (nodes.length === 0) {
		return { x: 0, y: 0 };
	}

	let sumX = 0;
	let sumY = 0;

	nodes.forEach((node) => {
		const width = node.measured?.width || getDefaultNodeWidth(node.type);
		const height = node.measured?.height || getDefaultNodeHeight(node.type);

		sumX += node.position.x + width / 2;
		sumY += node.position.y + height / 2;
	});

	return {
		x: sumX / nodes.length,
		y: sumY / nodes.length,
	};
}

/**
 * Get default node width based on type
 */
function getDefaultNodeWidth(nodeType: string | undefined): number {
	switch (nodeType) {
		case "person":
			return 220;
		case "system":
			return 240;
		case "externalSystem":
			return 240;
		case "container":
			return 280;
		case "component":
			return 200;
		default:
			return 220;
	}
}

/**
 * Get default node height based on type
 */
function getDefaultNodeHeight(nodeType: string | undefined): number {
	switch (nodeType) {
		case "person":
			return 160;
		case "system":
			return 140;
		case "externalSystem":
			return 140;
		case "container":
			return 200;
		case "component":
			return 120;
		default:
			return 140;
	}
}

/**
 * Tactical layout presets for different use cases
 */
export const TACTICAL_PRESETS = {
	// Command chain (top-down hierarchy) - DEFAULT
	command: {
		direction: "TB" as const,
		rankSpacing: 120,
		nodeSpacing: 80,
	},

	// Data flow (left-to-right)
	dataFlow: {
		direction: "LR" as const,
		nodeSpacing: 100,
		rankSpacing: 120,
	},

	// Dependency tree (bottom-up)
	dependencies: {
		direction: "BT" as const,
		rankSpacing: 120,
		nodeSpacing: 80,
	},

	// Compact (minimal spacing)
	compact: {
		direction: "TB" as const,
		nodeSpacing: 50,
		rankSpacing: 80,
	},

	// Presentation (spacious)
	presentation: {
		direction: "TB" as const,
		nodeSpacing: 100,
		rankSpacing: 160,
	},
} as const;

/**
 * Get layout preset by name
 */
export function getPreset(
	name: keyof typeof TACTICAL_PRESETS,
): Partial<LayoutOptions> {
	return TACTICAL_PRESETS[name];
}

/**
 * Calculate layout statistics
 * Useful for displaying info to user
 */
export interface LayoutStats {
	layers: number; // Number of hierarchical layers
	totalNodes: number;
	totalEdges: number;
	boundingBox: {
		width: number;
		height: number;
	};
}

export function calculateLayoutStats(
	nodes: Node[],
	edges: Edge[],
): LayoutStats {
	if (nodes.length === 0) {
		return {
			layers: 0,
			totalNodes: 0,
			totalEdges: 0,
			boundingBox: { width: 0, height: 0 },
		};
	}

	// Calculate bounding box
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	nodes.forEach((node) => {
		const width = node.measured?.width || getDefaultNodeWidth(node.type);
		const height = node.measured?.height || getDefaultNodeHeight(node.type);

		minX = Math.min(minX, node.position.x);
		minY = Math.min(minY, node.position.y);
		maxX = Math.max(maxX, node.position.x + width);
		maxY = Math.max(maxY, node.position.y + height);
	});

	// Estimate layers (rough calculation based on Y positions)
	const yPositions = nodes.map((n) => n.position.y);
	const uniqueYs = new Set(
		yPositions.map((y) => Math.round(y / 100) * 100),
	).size;

	return {
		layers: Math.max(1, uniqueYs),
		totalNodes: nodes.length,
		totalEdges: edges.length,
		boundingBox: {
			width: maxX - minX,
			height: maxY - minY,
		},
	};
}
