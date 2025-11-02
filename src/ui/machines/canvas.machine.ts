/**
 * Canvas Machine (XState)
 *
 * IMPERATIVE SHELL - Orchestrates canvas interactions and persistence.
 * Manages user flows: adding nodes, selecting, editing, connecting, saving/loading.
 *
 * This machine coordinates WHEN to run effects, but delegates all business logic
 * to the functional core (Effect services).
 */

import type { Edge, Node, NodeChange, EdgeChange } from "@xyflow/react";
import { applyNodeChanges, applyEdgeChanges } from "@xyflow/react";
import { assign, setup } from "xstate";
import { Effect } from "effect";
import { autoLayout, autoLayoutSelected, getPreset, type LayoutOptions, type LayoutPresetName } from "../../core/effects/layout";
import * as NodeOps from "../../core/effects/node-operations";
import * as EdgeOps from "../../core/effects/edge-operations";
import * as DiagramOps from "../../core/effects/diagram-operations";

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
			updates: Partial<NodeOps.NodeData>;
	  }
	| { type: "DELETE_NODE"; nodeId: string }
	| { type: "CONNECT_NODES"; source: string; target: string; label?: string }
	| { type: "UPDATE_EDGE_LABEL"; edgeId: string; label: string }
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
 * Run an Effect synchronously - XState actions must be sync
 * Extracts the value from Effect or throws if it fails
 */
function runEffectSync<A>(effect: Effect.Effect<A>): A {
	let result: A | undefined;
	let error: unknown;

	Effect.runSync(
		Effect.gen(function* () {
			try {
				result = yield* effect;
			} catch (e) {
				error = e;
				throw e;
			}
		}),
	);

	if (error) {
		throw error;
	}

	return result as A;
}

export const canvasMachine = setup({
	types: {
		context: {} as CanvasContext,
		events: {} as CanvasEvent,
	},
	actions: {
		addPerson: assign({
			nodes: ({ context }) => {
				// Use Effect service for pure business logic
				const newNode = runEffectSync(
					NodeOps.createNode({
						type: "person",
						label: "New Person",
						nodeCounter: context.nodeCounter,
						selectedNodeId: context.selectedNodeId,
						existingNodes: context.nodes,
					}),
				);

				return runEffectSync(NodeOps.addNode(context.nodes, newNode));
			},
			nodeCounter: ({ context }) => context.nodeCounter + 1,
		}),

		addSystem: assign({
			nodes: ({ context }) => {
				const newNode = runEffectSync(
					NodeOps.createNode({
						type: "system",
						label: "New System",
						nodeCounter: context.nodeCounter,
						selectedNodeId: context.selectedNodeId,
						existingNodes: context.nodes,
					}),
				);

				return runEffectSync(NodeOps.addNode(context.nodes, newNode));
			},
			nodeCounter: ({ context }) => context.nodeCounter + 1,
		}),

		addExternalSystem: assign({
			nodes: ({ context }) => {
				const newNode = runEffectSync(
					NodeOps.createNode({
						type: "externalSystem",
						label: "External System",
						nodeCounter: context.nodeCounter,
						selectedNodeId: context.selectedNodeId,
						existingNodes: context.nodes,
					}),
				);

				return runEffectSync(NodeOps.addNode(context.nodes, newNode));
			},
			nodeCounter: ({ context }) => context.nodeCounter + 1,
		}),

		addContainer: assign({
			nodes: ({ context }) => {
				const newNode = runEffectSync(
					NodeOps.createNode({
						type: "container",
						label: "Container",
						nodeCounter: context.nodeCounter,
						selectedNodeId: context.selectedNodeId,
						existingNodes: context.nodes,
					}),
				);

				return runEffectSync(NodeOps.addNode(context.nodes, newNode));
			},
			nodeCounter: ({ context }) => context.nodeCounter + 1,
		}),

		addComponent: assign({
			nodes: ({ context }) => {
				const newNode = runEffectSync(
					NodeOps.createNode({
						type: "component",
						label: "Component",
						nodeCounter: context.nodeCounter,
						selectedNodeId: context.selectedNodeId,
						existingNodes: context.nodes,
					}),
				);

				return runEffectSync(NodeOps.addNode(context.nodes, newNode));
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

				return runEffectSync(
					NodeOps.updateNodeData(context.nodes, event.nodeId, event.updates),
				);
			},
		}),

		deleteNode: assign({
			nodes: ({ context, event }) => {
				if (event.type !== "DELETE_NODE") return context.nodes;
				return runEffectSync(NodeOps.removeNode(context.nodes, event.nodeId));
			},
			edges: ({ context, event }) => {
				if (event.type !== "DELETE_NODE") return context.edges;
				// Remove edges connected to deleted node using Effect service
				return runEffectSync(
					EdgeOps.removeEdgesConnectedToNode(context.edges, event.nodeId),
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

				// Use custom label or default to "uses"
				const label = event.label ?? "uses";

				// Use Effect service for validation and creation
				// Validation errors will be caught and logged, returning unchanged edges
				const result = Effect.runSync(
					Effect.gen(function* () {
						return yield* EdgeOps.addValidatedEdge(
							context.edges,
							event.source,
							event.target,
							label,
						);
					}).pipe(
						Effect.catchAll((error) => {
							if (error instanceof EdgeOps.EdgeValidationError) {
								console.warn(`⚠️ ${error.message}`);
							}
							return Effect.succeed(context.edges); // Return unchanged edges on error
						}),
					),
				);

				return result;
			},
		}),

		updateEdgeLabel: assign({
			edges: ({ context, event }) => {
				if (event.type !== "UPDATE_EDGE_LABEL") return context.edges;

				// Use Effect service for validation and update
				const result = Effect.runSync(
					Effect.gen(function* () {
						return yield* EdgeOps.updateEdgeLabel(
							context.edges,
							event.edgeId,
							event.label,
						);
					}).pipe(
						Effect.catchAll((error) => {
							if (error instanceof EdgeOps.EdgeValidationError) {
								console.warn(`⚠️ ${error.message}`);
							}
							return Effect.succeed(context.edges); // Return unchanged edges on error
						}),
					),
				);

				return result;
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
			diagramName: ({ context, event }) => {
				if (event.type !== "UPDATE_DIAGRAM_NAME") return context.diagramName;

				const metadata = runEffectSync(
					DiagramOps.updateDiagramName(
						{
							id: context.currentDiagramId,
							name: context.diagramName,
							description: context.diagramDescription,
							sessionName: context.sessionName,
						},
						event.name,
					),
				);

				return metadata.name;
			},
		}),

		updateDiagramDescription: assign({
			diagramDescription: ({ context, event }) => {
				if (event.type !== "UPDATE_DIAGRAM_DESCRIPTION") return context.diagramDescription;

				const metadata = runEffectSync(
					DiagramOps.updateDiagramDescription(
						{
							id: context.currentDiagramId,
							name: context.diagramName,
							description: context.diagramDescription,
							sessionName: context.sessionName,
						},
						event.description,
					),
				);

				return metadata.description;
			},
		}),

		updateSessionName: assign({
			sessionName: ({ context, event }) => {
				if (event.type !== "UPDATE_SESSION_NAME") return context.sessionName;

				const metadata = runEffectSync(
					DiagramOps.updateSessionName(
						{
							id: context.currentDiagramId,
							name: context.diagramName,
							description: context.diagramDescription,
							sessionName: context.sessionName,
						},
						event.name,
					),
				);

				return metadata.sessionName;
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
		diagramName: "DIAGRAM::UNTITLED",
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
				UPDATE_EDGE_LABEL: {
					actions: "updateEdgeLabel",
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
