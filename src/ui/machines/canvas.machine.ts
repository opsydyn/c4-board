/**
 * Canvas Machine (XState)
 *
 * IMPERATIVE SHELL - Orchestrates canvas interactions and persistence.
 * Manages user flows: adding nodes, selecting, editing, connecting, saving/loading.
 */

import type { Edge, Node, NodeChange, EdgeChange } from "@xyflow/react";
import { applyNodeChanges, applyEdgeChanges } from "@xyflow/react";
import { assign, setup } from "xstate";
import { autoLayout, autoLayoutSelected, getPreset, type LayoutOptions, type LayoutPresetName } from "../../core/effects/layout";

export type CanvasEvent =
	| { type: "ADD_PERSON" }
	| { type: "ADD_SYSTEM" }
	| { type: "ADD_EXTERNAL_SYSTEM" }
	| { type: "ADD_CONTAINER" }
	| { type: "ADD_COMPONENT" }
	| { type: "SELECT_NODE"; nodeId: string }
	| { type: "DESELECT_NODE" }
	| { type: "AUTO_LAYOUT"; preset?: LayoutPresetName; options?: Partial<LayoutOptions> }
	| { type: "AUTO_LAYOUT_SELECTED"; preset?: LayoutPresetName; options?: Partial<LayoutOptions> }
	| {
			type: "UPDATE_NODE";
			nodeId: string;
			updates: Partial<{
				label: string;
				description: string;
				technology: string;
				c4Type: string;
			}>;
	  }
	| { type: "DELETE_NODE"; nodeId: string }
	| { type: "CONNECT_NODES"; source: string; target: string }
	| { type: "NODES_CHANGED"; changes: NodeChange[] }
	| { type: "EDGES_CHANGED"; changes: EdgeChange[] }
	// Persistence events
	| { type: "CREATE_NEW_DIAGRAM"; name: string; description?: string }
	| { type: "CREATE_NEW_BOARD" }
	| { type: "LOAD_DIAGRAM"; diagramId: string }
	| { type: "SWITCH_BOARD"; diagramId: string }
	| {
			type: "LOAD_DIAGRAM_SUCCESS";
			diagram: {
				id: string;
				name: string;
				description?: string;
				nodes: Node[];
				edges: Edge[];
				updatedAt: number;
			};
	  }
	| { type: "SAVE_DIAGRAM" }
	| { type: "SAVE_SUCCESS" }
	| { type: "SAVE_ERROR"; error: string }
	| { type: "AUTO_SAVE" }
	| { type: "UPDATE_DIAGRAM_NAME"; name: string }
	| { type: "UPDATE_DIAGRAM_DESCRIPTION"; description: string }
	| { type: "UPDATE_SESSION_NAME"; name: string };

export interface CanvasContext {
	// Canvas state
	nodes: Node[];
	edges: Edge[];
	selectedNodeId: string | null;
	nodeCounter: number;

	// Diagram metadata
	currentDiagramId: string | null;
	diagramName: string;
	diagramDescription: string | null;
	sessionName: string;

	// Persistence state
	isSaving: boolean;
	lastSaved: number | null;
	saveError: string | null;

	// Layout state
	previousLayout: Node[] | null; // For undo functionality
	currentLayout: LayoutPresetName | null; // Track currently applied layout preset
}

/**
 * Calculate initial position for a new node
 * Uses simple offset positioning - users will use Dagre auto-layout for final arrangement
 * This just ensures nodes don't stack on top of each other initially
 */
function getInitialNodePosition(nodeCount: number): { x: number; y: number } {
	// Simple diagonal offset - spreads nodes apart initially
	// User will apply auto-layout (Dagre) for intelligent positioning
	const OFFSET = 80; // Spacing between each new node
	const START_X = 400;
	const START_Y = 300;

	return {
		x: START_X + (nodeCount * OFFSET),
		y: START_Y + (nodeCount * OFFSET),
	};
}

export const canvasMachine = setup({
	types: {
		context: {} as CanvasContext,
		events: {} as CanvasEvent,
	},
	actions: {
		addPerson: assign({
			nodes: ({ context }) => {
				const id = `person-${context.nodeCounter}`;

				// Check if a container is selected
				const selectedNode = context.selectedNodeId
					? context.nodes.find((n) => n.id === context.selectedNodeId)
					: null;

				const isParentContainer = selectedNode?.type === "container";

				const newNode: Node = {
					id,
					type: "person",
					// Position relative to parent if inside container, absolute otherwise
					position: isParentContainer
						? { x: 20, y: 60 }
						: getInitialNodePosition(context.nodeCounter),
					data: {
						label: "New Person",
						description: "",
						technology: "",
						c4Type: "person",
					},
					// Set parent relationship if container is selected
					...(isParentContainer && {
						parentId: selectedNode.id,
						extent: "parent" as const,
						expandParent: true,
					}),
				};
				return [...context.nodes, newNode];
			},
			nodeCounter: ({ context }) => context.nodeCounter + 1,
		}),

		addSystem: assign({
			nodes: ({ context }) => {
				const id = `system-${context.nodeCounter}`;

				// Check if a container is selected
				const selectedNode = context.selectedNodeId
					? context.nodes.find((n) => n.id === context.selectedNodeId)
					: null;

				const isParentContainer = selectedNode?.type === "container";

				const newNode: Node = {
					id,
					type: "system",
					// Position relative to parent if inside container, absolute otherwise
					position: isParentContainer
						? { x: 20, y: 60 }
						: getInitialNodePosition(context.nodeCounter),
					data: {
						label: "New System",
						description: "",
						technology: "",
						c4Type: "system",
					},
					// Set parent relationship if container is selected
					...(isParentContainer && {
						parentId: selectedNode.id,
						extent: "parent" as const,
						expandParent: true,
					}),
				};
				return [...context.nodes, newNode];
			},
			nodeCounter: ({ context }) => context.nodeCounter + 1,
		}),

		addExternalSystem: assign({
			nodes: ({ context }) => {
				const id = `external-${context.nodeCounter}`;

				// Check if a container is selected
				const selectedNode = context.selectedNodeId
					? context.nodes.find((n) => n.id === context.selectedNodeId)
					: null;

				const isParentContainer = selectedNode?.type === "container";

				const newNode: Node = {
					id,
					type: "externalSystem",
					// Position relative to parent if inside container, absolute otherwise
					position: isParentContainer
						? { x: 20, y: 60 }
						: getInitialNodePosition(context.nodeCounter),
					data: {
						label: "External System",
						description: "",
						technology: "",
						c4Type: "externalSystem",
					},
					// Set parent relationship if container is selected
					...(isParentContainer && {
						parentId: selectedNode.id,
						extent: "parent" as const,
						expandParent: true,
					}),
				};
				return [...context.nodes, newNode];
			},
			nodeCounter: ({ context }) => context.nodeCounter + 1,
		}),

		addContainer: assign({
			nodes: ({ context }) => {
				const id = `container-${context.nodeCounter}`;

				// Check if a container is selected - support nested containers
				const selectedNode = context.selectedNodeId
					? context.nodes.find((n) => n.id === context.selectedNodeId)
					: null;

				const isParentContainer = selectedNode?.type === "container";

				const newNode: Node = {
					id,
					type: "container",
					// Position relative to parent if nested, absolute otherwise
					position: isParentContainer
						? { x: 20, y: 60 } // Position inside parent container
						: { x: 100 + context.nodeCounter * 50, y: 100 },
					data: {
						label: "Container",
						description: "",
						technology: "",
						c4Type: "container",
					},
					style: {
						width: 400,
						height: 300,
					},
					// Set parent relationship if container is selected
					...(isParentContainer && {
						parentId: selectedNode.id,
						extent: "parent" as const,
						expandParent: true,
					}),
				};
				return [...context.nodes, newNode];
			},
			nodeCounter: ({ context }) => context.nodeCounter + 1,
		}),

		addComponent: assign({
			nodes: ({ context }) => {
				const id = `component-${context.nodeCounter}`;

				// Check if a container is selected - if so, add component as child
				const selectedNode = context.selectedNodeId
					? context.nodes.find((n) => n.id === context.selectedNodeId)
					: null;

				const isParentContainer = selectedNode?.type === "container";

				const newNode: Node = {
					id,
					type: "component",
					// Position relative to parent if inside container, absolute otherwise
					position: isParentContainer
						? { x: 20, y: 60 } // Position inside container (below header)
						: { x: 100 + context.nodeCounter * 50, y: 100 },
					data: {
						label: "Component",
						description: "",
						technology: "",
						c4Type: "component",
					},
					// Set parent relationship if container is selected
					...(isParentContainer && {
						parentId: selectedNode.id,
						extent: "parent" as const, // Keep child within parent bounds
						expandParent: true, // Auto-expand parent if needed
					}),
				};
				return [...context.nodes, newNode];
			},
			nodeCounter: ({ context }) => context.nodeCounter + 1,
		}),

		selectNode: assign({
			selectedNodeId: ({ event }) => {
				if (event.type !== "SELECT_NODE") return null;
				return event.nodeId;
			},
		}),

		deselectNode: assign({
			selectedNodeId: null,
		}),

		updateNode: assign({
			nodes: ({ context, event }) => {
				if (event.type !== "UPDATE_NODE") return context.nodes;

				return context.nodes.map((node) =>
					node.id === event.nodeId
						? { ...node, data: { ...node.data, ...event.updates } }
						: node,
				);
			},
		}),

		deleteNode: assign({
			nodes: ({ context, event }) => {
				if (event.type !== "DELETE_NODE") return context.nodes;
				return context.nodes.filter((node) => node.id !== event.nodeId);
			},
			edges: ({ context, event }) => {
				if (event.type !== "DELETE_NODE") return context.edges;
				// Remove edges connected to deleted node
				return context.edges.filter(
					(edge) => edge.source !== event.nodeId && edge.target !== event.nodeId,
				);
			},
			selectedNodeId: ({ context, event }) => {
				if (event.type !== "DELETE_NODE") return context.selectedNodeId;
				return context.selectedNodeId === event.nodeId
					? null
					: context.selectedNodeId;
			},
		}),

		connectNodes: assign({
			edges: ({ context, event }) => {
				if (event.type !== "CONNECT_NODES") return context.edges;

				// Validation: Prevent self-connections (node connecting to itself)
				if (event.source === event.target) {
					console.warn("⚠️ Cannot connect node to itself");
					return context.edges;
				}

				// Validation: Prevent duplicate edges (same source and target)
				// Check both directions to prevent A→B when B→A exists (bidirectional check)
				const isDuplicate = context.edges.some(
					(edge) =>
						(edge.source === event.source && edge.target === event.target) ||
						(edge.source === event.target && edge.target === event.source),
				);

				if (isDuplicate) {
					console.warn("⚠️ Edge already exists between these nodes");
					return context.edges;
				}

				// Create new edge
				const newEdge: Edge = {
					id: `edge-${Date.now()}`,
					source: event.source,
					target: event.target,
					label: "uses",
					type: "default",
				};

				return [...context.edges, newEdge];
			},
		}),

		updateNodesFromReactFlow: assign({
			nodes: ({ context, event }) => {
				if (event.type !== "NODES_CHANGED") return context.nodes;
				// Apply ReactFlow changes to nodes using applyNodeChanges
				return applyNodeChanges(event.changes, context.nodes);
			},
		}),

		updateEdgesFromReactFlow: assign({
			edges: ({ context, event }) => {
				if (event.type !== "EDGES_CHANGED") return context.edges;
				// Apply ReactFlow changes to edges using applyEdgeChanges
				return applyEdgeChanges(event.changes, context.edges);
			},
		}),

		updateDiagramName: assign({
			diagramName: ({ event }) => {
				if (event.type !== "UPDATE_DIAGRAM_NAME") return "";
				return event.name;
			},
		}),

		updateDiagramDescription: assign({
			diagramDescription: ({ event }) => {
				if (event.type !== "UPDATE_DIAGRAM_DESCRIPTION") return null;
				return event.description;
			},
		}),

		updateSessionName: assign({
			sessionName: ({ event }) => {
				if (event.type !== "UPDATE_SESSION_NAME") return "";
				return event.name;
			},
		}),

		applyLayout: assign({
			previousLayout: ({ context }) => context.nodes, // Save current layout for undo
			currentLayout: ({ event }) => {
				if (event.type !== "AUTO_LAYOUT") return null;
				return event.preset ?? "command"; // Default to command if no preset specified
			},
			nodes: ({ context, event }) => {
				if (event.type !== "AUTO_LAYOUT") return context.nodes;

				// Merge preset options with explicit options (explicit options take precedence)
				const presetOptions = event.preset ? getPreset(event.preset) : {};
				const mergedOptions = { ...presetOptions, ...event.options };

				return autoLayout(context.nodes, context.edges, mergedOptions);
			},
		}),

		applyLayoutSelected: assign({
			previousLayout: ({ context }) => context.nodes, // Save current layout for undo
			currentLayout: ({ event }) => {
				if (event.type !== "AUTO_LAYOUT_SELECTED") return null;
				return event.preset ?? "command"; // Default to command if no preset specified
			},
			nodes: ({ context, event }) => {
				if (event.type !== "AUTO_LAYOUT_SELECTED") return context.nodes;

				// Merge preset options with explicit options (explicit options take precedence)
				const presetOptions = event.preset ? getPreset(event.preset) : {};
				const mergedOptions = { ...presetOptions, ...event.options };

				// Get all selected nodes (ReactFlow stores selection in node.selected)
				const selectedNodeIds = context.nodes
					.filter((node) => node.selected)
					.map((node) => node.id);

				if (selectedNodeIds.length === 0) {
					// No selection, fallback to layout all
					return autoLayout(context.nodes, context.edges, mergedOptions);
				}

				return autoLayoutSelected(
					context.nodes,
					context.edges,
					selectedNodeIds,
					mergedOptions,
				);
			},
		}),

		setSaving: assign({
			isSaving: true,
			saveError: null,
		}),

		setSaveSuccess: assign({
			isSaving: false,
			lastSaved: () => Date.now(),
			saveError: null,
		}),

		setSaveError: assign({
			isSaving: false,
			saveError: ({ event }) => {
				if (event.type !== "SAVE_ERROR") return null;
				return event.error;
			},
		}),

		loadDiagramSuccess: assign({
			currentDiagramId: ({ event }) => {
				if (event.type !== "LOAD_DIAGRAM_SUCCESS") return null;
				return event.diagram.id;
			},
			diagramName: ({ event }) => {
				if (event.type !== "LOAD_DIAGRAM_SUCCESS") return "Untitled";
				return event.diagram.name;
			},
			diagramDescription: ({ event }) => {
				if (event.type !== "LOAD_DIAGRAM_SUCCESS") return null;
				return event.diagram.description ?? null;
			},
			nodes: ({ event }) => {
				if (event.type !== "LOAD_DIAGRAM_SUCCESS") return [];
				return event.diagram.nodes;
			},
			edges: ({ event }) => {
				if (event.type !== "LOAD_DIAGRAM_SUCCESS") return [];
				return event.diagram.edges;
			},
			lastSaved: ({ event }) => {
				if (event.type !== "LOAD_DIAGRAM_SUCCESS") return null;
				return event.diagram.updatedAt;
			},
		}),
	},
}).createMachine({
	id: "canvas",
	initial: "idle",
	context: {
		// Canvas state
		nodes: [],
		edges: [],
		selectedNodeId: null,
		nodeCounter: 0,

		// Diagram metadata
		currentDiagramId: null,
		diagramName: "Untitled Diagram",
		diagramDescription: null,
		sessionName: "",

		// Persistence state
		isSaving: false,
		lastSaved: null,
		saveError: null,

		// Layout state
		previousLayout: null,
		currentLayout: null,
	},
	states: {
		idle: {
			on: {
				ADD_PERSON: {
					actions: "addPerson",
				},
				ADD_SYSTEM: {
					actions: "addSystem",
				},
				ADD_EXTERNAL_SYSTEM: {
					actions: "addExternalSystem",
				},
				ADD_CONTAINER: {
					actions: "addContainer",
				},
				ADD_COMPONENT: {
					actions: "addComponent",
				},
				SELECT_NODE: {
					actions: "selectNode",
				},
				DESELECT_NODE: {
					actions: "deselectNode",
				},
				UPDATE_NODE: {
					actions: "updateNode",
				},
				DELETE_NODE: {
					actions: "deleteNode",
				},
				CONNECT_NODES: {
					actions: "connectNodes",
				},
				NODES_CHANGED: {
					actions: "updateNodesFromReactFlow",
				},
				EDGES_CHANGED: {
					actions: "updateEdgesFromReactFlow",
				},
				UPDATE_DIAGRAM_NAME: {
					actions: "updateDiagramName",
				},
				UPDATE_DIAGRAM_DESCRIPTION: {
					actions: "updateDiagramDescription",
				},
				UPDATE_SESSION_NAME: {
					actions: "updateSessionName",
				},
				AUTO_LAYOUT: {
					actions: "applyLayout",
				},
				AUTO_LAYOUT_SELECTED: {
					actions: "applyLayoutSelected",
				},
				// Persistence events
				CREATE_NEW_DIAGRAM: {
					target: "creatingDiagram",
				},
				CREATE_NEW_BOARD: {
					target: "creatingDiagram",
				},
				SWITCH_BOARD: {
					target: "loadingDiagram",
				},
				LOAD_DIAGRAM: {
					target: "loadingDiagram",
				},
				LOAD_DIAGRAM_SUCCESS: {
					actions: "loadDiagramSuccess",
				},
				SAVE_DIAGRAM: {
					target: "saving",
				},
				AUTO_SAVE: {
					target: "saving",
				},
			},
		},
		creatingDiagram: {
			// This state is managed by the container component
			// It will invoke the createDiagramActor and transition back to idle
			always: "idle",
		},
		loadingDiagram: {
			// This state is managed by the container component
			// It will invoke the loadDiagramActor and transition back to idle
			always: "idle",
		},
		saving: {
			entry: "setSaving",
			on: {
				SAVE_SUCCESS: {
					target: "idle",
					actions: "setSaveSuccess",
				},
				SAVE_ERROR: {
					target: "idle",
					actions: "setSaveError",
				},
				// Allow other actions while saving
				ADD_PERSON: {
					actions: "addPerson",
				},
				ADD_SYSTEM: {
					actions: "addSystem",
				},
				ADD_EXTERNAL_SYSTEM: {
					actions: "addExternalSystem",
				},
				ADD_CONTAINER: {
					actions: "addContainer",
				},
				ADD_COMPONENT: {
					actions: "addComponent",
				},
				SELECT_NODE: {
					actions: "selectNode",
				},
				DESELECT_NODE: {
					actions: "deselectNode",
				},
				UPDATE_NODE: {
					actions: "updateNode",
				},
				DELETE_NODE: {
					actions: "deleteNode",
				},
			},
			after: {
				// Timeout after 5 seconds
				5000: {
					target: "idle",
					actions: assign({
						isSaving: false,
						saveError: "Save timeout",
					}),
				},
			},
		},
	},
});
