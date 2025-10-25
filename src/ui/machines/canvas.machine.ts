/**
 * Canvas Machine (XState)
 *
 * IMPERATIVE SHELL - Orchestrates canvas interactions.
 * Manages user flows: adding nodes, selecting, editing, connecting.
 */

import type { Edge, Node, NodeChange, EdgeChange } from "@xyflow/react";
import { assign, setup } from "xstate";

export type CanvasEvent =
	| { type: "ADD_PERSON" }
	| { type: "ADD_SYSTEM" }
	| { type: "ADD_EXTERNAL_SYSTEM" }
	| { type: "SELECT_NODE"; nodeId: string }
	| { type: "DESELECT_NODE" }
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
	| { type: "EDGES_CHANGED"; changes: EdgeChange[] };

export interface CanvasContext {
	nodes: Node[];
	edges: Edge[];
	selectedNodeId: string | null;
	nodeCounter: number;
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
				const newNode: Node = {
					id,
					type: "person",
					position: { x: 100 + context.nodeCounter * 50, y: 100 },
					data: {
						label: "New Person",
						description: "",
						technology: "",
						c4Type: "person",
					},
				};
				return [...context.nodes, newNode];
			},
			nodeCounter: ({ context }) => context.nodeCounter + 1,
		}),

		addSystem: assign({
			nodes: ({ context }) => {
				const id = `system-${context.nodeCounter}`;
				const newNode: Node = {
					id,
					type: "system",
					position: { x: 100 + context.nodeCounter * 50, y: 100 },
					data: {
						label: "New System",
						description: "",
						technology: "",
						c4Type: "system",
					},
				};
				return [...context.nodes, newNode];
			},
			nodeCounter: ({ context }) => context.nodeCounter + 1,
		}),

		addExternalSystem: assign({
			nodes: ({ context }) => {
				const id = `external-${context.nodeCounter}`;
				const newNode: Node = {
					id,
					type: "external_system",
					position: { x: 100 + context.nodeCounter * 50, y: 100 },
					data: {
						label: "External System",
						description: "",
						technology: "",
						c4Type: "external_system",
					},
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

				const newEdge: Edge = {
					id: `${event.source}-${event.target}`,
					source: event.source,
					target: event.target,
					label: "uses",
					type: "default",
				};

				return [...context.edges, newEdge];
			},
		}),

		updateNodesFromReactFlow: assign({
			nodes: ({ event }) => {
				if (event.type !== "NODES_CHANGED") return [];
				// ReactFlow manages position updates - we just store them
				return event.changes;
			},
		}),

		updateEdgesFromReactFlow: assign({
			edges: ({ event }) => {
				if (event.type !== "EDGES_CHANGED") return [];
				return event.changes;
			},
		}),
	},
}).createMachine({
	id: "canvas",
	initial: "idle",
	context: {
		nodes: [],
		edges: [],
		selectedNodeId: null,
		nodeCounter: 0,
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
			},
		},
	},
});
