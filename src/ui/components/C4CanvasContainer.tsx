/**
 * C4CanvasContainer - Stateful Canvas Component
 *
 * Connects XState machine to React components.
 * This is the imperative shell that coordinates the UI.
 */

import { useMachine } from "@xstate/react";
import {
	addEdge,
	applyEdgeChanges,
	applyNodeChanges,
	type Connection,
	type EdgeChange,
	type Node,
	type NodeChange,
} from "@xyflow/react";
import { useCallback } from "react";
import { canvasMachine } from "../machines/canvas.machine";
import { C4Canvas } from "./C4Canvas";
import { PropertiesPanel } from "./PropertiesPanel";
import { Toolbar } from "./Toolbar";

export function C4CanvasContainer() {
	const [state, send] = useMachine(canvasMachine);

	// Handle node position/selection changes from ReactFlow
	const onNodesChange = useCallback(
		(changes: NodeChange[]) => {
			const updatedNodes = applyNodeChanges(changes, state.context.nodes);
			send({ type: "NODES_CHANGED", changes: updatedNodes });
		},
		[state.context.nodes, send],
	);

	// Handle edge changes from ReactFlow
	const onEdgesChange = useCallback(
		(changes: EdgeChange[]) => {
			const updatedEdges = applyEdgeChanges(changes, state.context.edges);
			send({ type: "EDGES_CHANGED", changes: updatedEdges });
		},
		[state.context.edges, send],
	);

	// Handle new connections between nodes
	const onConnect = useCallback(
		(connection: Connection) => {
			if (!connection.source || !connection.target) return;

			const updatedEdges = addEdge(connection, state.context.edges);
			send({ type: "EDGES_CHANGED", changes: updatedEdges });
		},
		[state.context.edges, send],
	);

	// Handle node clicks for selection
	const onNodeClick = useCallback(
		(_event: React.MouseEvent, node: Node) => {
			send({ type: "SELECT_NODE", nodeId: node.id });
		},
		[send],
	);

	// Get selected node object
	const selectedNode =
		state.context.nodes.find((n) => n.id === state.context.selectedNodeId) ||
		null;

	return (
		<>
			<Toolbar
				onAddPerson={() => send({ type: "ADD_PERSON" })}
				onAddSystem={() => send({ type: "ADD_SYSTEM" })}
				onAddExternalSystem={() => send({ type: "ADD_EXTERNAL_SYSTEM" })}
			/>

			<PropertiesPanel
				selectedNode={selectedNode}
				onUpdateNode={(nodeId, updates) =>
					send({ type: "UPDATE_NODE", nodeId, updates })
				}
			/>

			<C4Canvas
				nodes={state.context.nodes}
				edges={state.context.edges}
				onNodesChange={onNodesChange}
				onEdgesChange={onEdgesChange}
				onConnect={onConnect}
				onNodeClick={onNodeClick}
			/>
		</>
	);
}
