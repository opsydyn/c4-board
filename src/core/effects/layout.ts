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
 * Get default node width based on type (C4 + DDD)
 */
function getDefaultNodeWidth(nodeType: string | undefined): number {
	switch (nodeType) {
		// C4 types
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

		// DDD Strategic types (larger)
		case "boundedContext":
			return 500;
		case "aggregate":
			return 320;
		case "domainEvent":
			return 180;

		// DDD Tactical types (medium)
		case "entity":
			return 220;
		case "valueObject":
			return 180;
		case "domainService":
			return 200;
		case "repository":
			return 200;
		case "factory":
			return 200;

		// DDD Application types (medium)
		case "command":
			return 180;
		case "query":
			return 180;
		case "applicationService":
			return 240;

		// DDD Infrastructure types (medium to large)
		case "integrationEvent":
			return 200;
		case "antiCorruptionLayer":
			return 280;
		case "saga":
			return 300;

		default:
			return 220;
	}
}

/**
 * Get default node height based on type (C4 + DDD)
 */
function getDefaultNodeHeight(nodeType: string | undefined): number {
	switch (nodeType) {
		// C4 types
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

		// DDD Strategic types (larger)
		case "boundedContext":
			return 400;
		case "aggregate":
			return 240;
		case "domainEvent":
			return 120;

		// DDD Tactical types (medium)
		case "entity":
			return 160;
		case "valueObject":
			return 140;
		case "domainService":
			return 150;
		case "repository":
			return 150;
		case "factory":
			return 150;

		// DDD Application types (medium)
		case "command":
			return 120;
		case "query":
			return 120;
		case "applicationService":
			return 170;

		// DDD Infrastructure types (medium to large)
		case "integrationEvent":
			return 140;
		case "antiCorruptionLayer":
			return 200;
		case "saga":
			return 200;

		default:
			return 140;
	}
}

/**
 * C4-optimized layout presets for different architectural patterns
 */
export const C4_LAYOUT_PRESETS = {
	// ============================================================================
	// ESSENTIAL LAYOUTS (Phase 1)
	// ============================================================================

	/**
	 * Command Hierarchy (Default)
	 * Top-down organizational chart, command chain
	 * Use for: Reporting structures, process flows
	 */
	command: {
		direction: "TB" as const,
		rankSpacing: 120,
		nodeSpacing: 80,
	},

	/**
	 * Data Flow (Left-to-Right)
	 * Sequential processing, data pipelines
	 * Use for: ETL processes, request flows, pipeline stages
	 */
	dataFlow: {
		direction: "LR" as const,
		rankSpacing: 120,
		nodeSpacing: 100,
	},

	/**
	 * Layered Architecture (3-Tier)
	 * Presentation → Business → Data layers
	 * Use for: Web applications, traditional n-tier systems
	 */
	layered: {
		direction: "TB" as const,
		rankSpacing: 150,
		nodeSpacing: 100,
	},

	/**
	 * Microservices Mesh
	 * Service-oriented architecture with gateway
	 * Use for: Distributed systems, microservices, API gateway patterns
	 */
	microservices: {
		direction: "LR" as const,
		rankSpacing: 180,
		nodeSpacing: 100,
	},

	/**
	 * System Context (Radial)
	 * Main system with external systems and users
	 * Use for: C4 Level 1 - System Context diagrams
	 */
	systemContext: {
		direction: "TB" as const,
		rankSpacing: 200,
		nodeSpacing: 120,
	},

	// ============================================================================
	// ADVANCED LAYOUTS (Phase 2)
	// ============================================================================

	/**
	 * Hexagonal Architecture (Ports & Adapters)
	 * Core domain with input/output adapters
	 * Use for: Clean architecture, DDD, hexagonal patterns
	 */
	hexagonal: {
		direction: "TB" as const,
		rankSpacing: 140,
		nodeSpacing: 90,
	},

	/**
	 * Event-Driven Flow
	 * Publishers → Event Bus → Subscribers
	 * Use for: Event sourcing, message queues, pub/sub systems
	 */
	eventDriven: {
		direction: "LR" as const,
		rankSpacing: 200,
		nodeSpacing: 120,
	},

	/**
	 * Client-Server Tiers
	 * Client → Server → Database layers
	 * Use for: Traditional web apps, mobile backends
	 */
	clientServer: {
		direction: "TB" as const,
		rankSpacing: 180,
		nodeSpacing: 120,
	},

	/**
	 * Pipeline / Sequential
	 * Strict left-to-right sequential stages
	 * Use for: CI/CD pipelines, data processing stages
	 */
	pipeline: {
		direction: "LR" as const,
		rankSpacing: 160,
		nodeSpacing: 80,
	},

	/**
	 * Hub-Spoke (Star Pattern)
	 * Central integration hub with satellite services
	 * Use for: ESB, integration platforms, API aggregators
	 */
	hubSpoke: {
		direction: "TB" as const,
		rankSpacing: 160,
		nodeSpacing: 100,
	},

	// ============================================================================
	// UTILITY LAYOUTS
	// ============================================================================

	/**
	 * Dependency Tree (Bottom-Up)
	 * Dependencies at bottom, dependents flow upward
	 * Use for: Module dependencies, package graphs
	 */
	dependencies: {
		direction: "BT" as const,
		rankSpacing: 120,
		nodeSpacing: 80,
	},

	/**
	 * Compact (Minimal Spacing)
	 * Dense layout for large diagrams
	 * Use for: Overview diagrams, many nodes
	 */
	compact: {
		direction: "TB" as const,
		nodeSpacing: 50,
		rankSpacing: 80,
	},

	/**
	 * Presentation (Spacious)
	 * Wide spacing for readability
	 * Use for: Presentations, documentation, posters
	 */
	presentation: {
		direction: "TB" as const,
		nodeSpacing: 100,
		rankSpacing: 160,
	},
} as const;

/**
 * DDD-optimized layout presets for domain modeling
 */
export const DDD_LAYOUT_PRESETS = {
	// ============================================================================
	// STRATEGIC DDD LAYOUTS
	// ============================================================================

	/**
	 * Context Map (Strategic)
	 * Bounded contexts with relationships
	 * Use for: Strategic DDD, context mapping, team boundaries
	 */
	contextMap: {
		direction: "TB" as const,
		rankSpacing: 200,
		nodeSpacing: 150,
	},

	/**
	 * Domain Model (Hierarchical)
	 * Bounded Contexts → Aggregates → Entities
	 * Use for: Domain model exploration, aggregate design
	 */
	domainModel: {
		direction: "TB" as const,
		rankSpacing: 140,
		nodeSpacing: 100,
	},

	/**
	 * Subdomain Classification
	 * Core → Supporting → Generic domains
	 * Use for: Strategic planning, domain prioritization
	 */
	subdomain: {
		direction: "LR" as const,
		rankSpacing: 180,
		nodeSpacing: 120,
	},

	// ============================================================================
	// TACTICAL DDD LAYOUTS
	// ============================================================================

	/**
	 * Aggregate Design
	 * Aggregate roots with entities and value objects
	 * Use for: Tactical DDD, aggregate boundaries
	 */
	aggregate: {
		direction: "TB" as const,
		rankSpacing: 120,
		nodeSpacing: 80,
	},

	/**
	 * CQRS Flow
	 * Commands → Aggregates → Events → Queries
	 * Use for: CQRS patterns, command/query separation
	 */
	cqrs: {
		direction: "LR" as const,
		rankSpacing: 150,
		nodeSpacing: 100,
	},

	/**
	 * Event Storming
	 * Domain events with commands and policies
	 * Use for: Event storming workshops, event modeling
	 */
	eventStorming: {
		direction: "LR" as const,
		rankSpacing: 180,
		nodeSpacing: 90,
	},

	// ============================================================================
	// APPLICATION LAYER LAYOUTS
	// ============================================================================

	/**
	 * Use Case Flow
	 * Application services orchestrating domain
	 * Use for: Application layer design, use case modeling
	 */
	useCase: {
		direction: "TB" as const,
		rankSpacing: 140,
		nodeSpacing: 100,
	},

	/**
	 * Onion Architecture
	 * Domain core with application and infrastructure layers
	 * Use for: Clean architecture, dependency inversion
	 */
	onion: {
		direction: "TB" as const,
		rankSpacing: 160,
		nodeSpacing: 100,
	},

	// ============================================================================
	// INTEGRATION PATTERNS
	// ============================================================================

	/**
	 * Anti-Corruption Layer
	 * Context translation and integration
	 * Use for: Legacy integration, context boundaries
	 */
	acl: {
		direction: "LR" as const,
		rankSpacing: 180,
		nodeSpacing: 120,
	},

	/**
	 * Saga Pattern
	 * Long-running transactions with compensation
	 * Use for: Distributed transactions, process managers
	 */
	saga: {
		direction: "LR" as const,
		rankSpacing: 160,
		nodeSpacing: 100,
	},
} as const;

/**
 * Combined layout presets (C4 + DDD)
 */
export const ALL_LAYOUT_PRESETS = {
	...C4_LAYOUT_PRESETS,
	...DDD_LAYOUT_PRESETS,
} as const;

/**
 * Layout preset names for type safety
 */
export type C4LayoutPresetName = keyof typeof C4_LAYOUT_PRESETS;
export type DDDLayoutPresetName = keyof typeof DDD_LAYOUT_PRESETS;
export type LayoutPresetName = keyof typeof ALL_LAYOUT_PRESETS;

/**
 * Get layout preset by name (works for both C4 and DDD)
 */
export function getPreset(
	name: LayoutPresetName,
): Partial<LayoutOptions> {
	return ALL_LAYOUT_PRESETS[name];
}

/**
 * Get C4-specific preset
 */
export function getC4Preset(
	name: C4LayoutPresetName,
): Partial<LayoutOptions> {
	return C4_LAYOUT_PRESETS[name];
}

/**
 * Get DDD-specific preset
 */
export function getDDDPreset(
	name: DDDLayoutPresetName,
): Partial<LayoutOptions> {
	return DDD_LAYOUT_PRESETS[name];
}

/**
 * Get all available C4 layout presets
 */
export function getAllC4Presets(): Array<{
	name: C4LayoutPresetName;
	label: string;
	description: string;
	category: "essential" | "advanced" | "utility";
}> {
	return [
		// Essential
		{
			name: "command",
			label: "Command Hierarchy",
			description: "Top-down organizational chart",
			category: "essential",
		},
		{
			name: "dataFlow",
			label: "Data Flow",
			description: "Sequential left-to-right processing",
			category: "essential",
		},
		{
			name: "layered",
			label: "Layered (3-Tier)",
			description: "Presentation → Business → Data",
			category: "essential",
		},
		{
			name: "microservices",
			label: "Microservices",
			description: "Service mesh with gateway",
			category: "essential",
		},
		{
			name: "systemContext",
			label: "System Context",
			description: "Main system with externals",
			category: "essential",
		},
		// Advanced
		{
			name: "hexagonal",
			label: "Hexagonal",
			description: "Ports & Adapters pattern",
			category: "advanced",
		},
		{
			name: "eventDriven",
			label: "Event-Driven",
			description: "Publishers → Bus → Subscribers",
			category: "advanced",
		},
		{
			name: "clientServer",
			label: "Client-Server",
			description: "Client → Server → Database",
			category: "advanced",
		},
		{
			name: "pipeline",
			label: "Pipeline",
			description: "Sequential stages",
			category: "advanced",
		},
		{
			name: "hubSpoke",
			label: "Hub-Spoke",
			description: "Central hub with satellites",
			category: "advanced",
		},
		// Utility
		{
			name: "dependencies",
			label: "Dependency Tree",
			description: "Bottom-up dependencies",
			category: "utility",
		},
		{
			name: "compact",
			label: "Compact",
			description: "Minimal spacing",
			category: "utility",
		},
		{
			name: "presentation",
			label: "Presentation",
			description: "Spacious for slides",
			category: "utility",
		},
	];
}

/**
 * Get all available DDD layout presets
 */
export function getAllDDDPresets(): Array<{
	name: DDDLayoutPresetName;
	label: string;
	description: string;
	category: "strategic" | "tactical" | "application" | "integration";
}> {
	return [
		// Strategic DDD
		{
			name: "contextMap",
			label: "Context Map",
			description: "Bounded contexts with relationships",
			category: "strategic",
		},
		{
			name: "domainModel",
			label: "Domain Model",
			description: "Contexts → Aggregates → Entities",
			category: "strategic",
		},
		{
			name: "subdomain",
			label: "Subdomain Classification",
			description: "Core → Supporting → Generic",
			category: "strategic",
		},
		// Tactical DDD
		{
			name: "aggregate",
			label: "Aggregate Design",
			description: "Aggregate roots with entities",
			category: "tactical",
		},
		{
			name: "cqrs",
			label: "CQRS Flow",
			description: "Commands → Events → Queries",
			category: "tactical",
		},
		{
			name: "eventStorming",
			label: "Event Storming",
			description: "Domain events with commands",
			category: "tactical",
		},
		// Application Layer
		{
			name: "useCase",
			label: "Use Case Flow",
			description: "Application services orchestration",
			category: "application",
		},
		{
			name: "onion",
			label: "Onion Architecture",
			description: "Domain core with layers",
			category: "application",
		},
		// Integration
		{
			name: "acl",
			label: "Anti-Corruption Layer",
			description: "Context translation",
			category: "integration",
		},
		{
			name: "saga",
			label: "Saga Pattern",
			description: "Long-running transactions",
			category: "integration",
		},
	];
}

/**
 * Get all available layout presets (combined C4 + DDD)
 * @deprecated Use getAllC4Presets() or getAllDDDPresets() instead
 */
export function getAllPresets() {
	return getAllC4Presets();
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
