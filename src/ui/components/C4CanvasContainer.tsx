/**
 * C4CanvasContainer - Stateful Canvas Component with Persistence
 *
 * Connects XState machine to React components with explicit save.
 * This is the imperative shell that coordinates the UI and I/O.
 *
 * Architecture:
 * - XState machine manages canvas state
 * - Effect services handle database operations
 * - Explicit save via button (no auto-save)
 * - Load diagram on mount or create new
 */

import { useMachine } from "@xstate/react";
import {
	addEdge,
	applyNodeChanges,
	type Connection,
	type EdgeChange,
	type Node,
	type NodeChange,
} from "@xyflow/react";
import { useCallback, useEffect } from "react";
import { canvasMachine } from "../machines/canvas.machine";
import { C4Canvas } from "./C4Canvas";
import { PropertiesPanel } from "./PropertiesPanel";
import { Toolbar } from "./Toolbar";
import { useDatabase } from "../../core/effects/useDatabase";
import {
	saveDiagram,
	loadDiagram,
	createNewDiagram,
	listAllDiagrams,
} from "../../core/effects/canvas-persistence";

export function C4CanvasContainer() {
	const [state, send] = useMachine(canvasMachine);
	const { runEffect } = useDatabase();

	// Initialize: Load most recent diagram or create new one
	useEffect(() => {
		const initializeDiagram = async () => {
			try {
				// Try to load the most recent diagram
				const diagrams = await runEffect(listAllDiagrams());

				if (diagrams.length > 0) {
					// Load most recently updated diagram
					const mostRecent = diagrams.sort((a, b) => b.updatedAt - a.updatedAt)[0];
					if (!mostRecent) {
						throw new Error("No diagram found");
					}
					const diagram = await runEffect(loadDiagram(mostRecent.id));

					// Update machine state with loaded diagram
					send({
						type: "LOAD_DIAGRAM",
						diagramId: diagram.id,
					});

					// Manually update context (since we're not using invoke in machine)
					// This is a temporary approach - ideally machine would handle this
					Object.assign(state.context, {
						currentDiagramId: diagram.id,
						diagramName: diagram.name,
						diagramDescription: diagram.description ?? null,
						nodes: diagram.nodes,
						edges: diagram.edges,
						lastSaved: diagram.updatedAt,
					});
				} else {
					// No diagrams exist, create a new one
					const diagram = await runEffect(
						createNewDiagram("My First Diagram", "Getting started with C4"),
					);

					send({
						type: "CREATE_NEW_DIAGRAM",
						name: diagram.name,
						description: diagram.description ?? "",
					});

					Object.assign(state.context, {
						currentDiagramId: diagram.id,
						diagramName: diagram.name,
						diagramDescription: diagram.description ?? null,
						nodes: [],
						edges: [],
						lastSaved: diagram.createdAt,
					});
				}
			} catch (error) {
				console.error("Failed to initialize diagram:", error);
				// Create new diagram on error
				const diagram = await runEffect(
					createNewDiagram("Untitled Diagram"),
				);

				Object.assign(state.context, {
					currentDiagramId: diagram.id,
					diagramName: diagram.name,
					diagramDescription: null,
					nodes: [],
					edges: [],
					lastSaved: diagram.createdAt,
				});
			}
		};

		initializeDiagram();
	}, []); // Only run on mount

	// Handle explicit save action
	const handleSave = useCallback(async () => {
		if (!state.context.currentDiagramId) {
			console.warn("No diagram to save");
			return;
		}

		// Send SAVE_DIAGRAM event to transition to saving state
		send({ type: "SAVE_DIAGRAM" });

		try {
			const saveInput: Parameters<typeof saveDiagram>[0] = {
				id: state.context.currentDiagramId,
				name: state.context.diagramName,
				nodes: state.context.nodes,
				edges: state.context.edges,
			};

			if (state.context.diagramDescription) {
				saveInput.description = state.context.diagramDescription;
			}

			await runEffect(saveDiagram(saveInput));

			// Send success event to update lastSaved and transition back to idle
			send({ type: "SAVE_SUCCESS" });
			console.log("✅ Saved diagram");
		} catch (error) {
			console.error("❌ Save failed:", error);
			// Send error event to update error state and transition back to idle
			send({
				type: "SAVE_ERROR",
				error: error instanceof Error ? error.message : "Save failed"
			});
		}
	}, [state.context.currentDiagramId, state.context.diagramName, state.context.diagramDescription, state.context.nodes, state.context.edges, runEffect, send]);

	// Handle node position/selection changes from ReactFlow
	const onNodesChange = useCallback(
		(changes: NodeChange[]) => {
			// PERFORMANCE: Check if these are only position changes during drag
			const hasOnlyPositionChanges = changes.every((c) => c.type === "position");
			const isDragging = changes.some((c) => c.type === "position" && (c as any).dragging !== false);

			if (hasOnlyPositionChanges && isDragging) {
				// OPTIMIZATION: During drag, directly mutate context to avoid XState overhead
				// This bypasses the event system for smoother dragging performance
				state.context.nodes = applyNodeChanges(changes, state.context.nodes);
			} else {
				// For other changes (selection, add, remove, drag end), use proper XState events
				send({ type: "NODES_CHANGED", changes });
			}
		},
		[send, state.context],
	);

	// Handle edge changes from ReactFlow
	const onEdgesChange = useCallback(
		(changes: EdgeChange[]) => {
			// Send event to XState machine - let it handle the logic
			send({ type: "EDGES_CHANGED", changes });
		},
		[send],
	);

	// Handle new connections between nodes
	const onConnect = useCallback(
		(connection: Connection) => {
			if (!connection.source || !connection.target) return;

			const updatedEdges = addEdge(
				{
					...connection,
					id: `edge-${Date.now()}`,
					type: "default",
					label: "uses",
				},
				state.context.edges,
			);

			// Manually update edges
			// TODO: Convert this to use XState event
			state.context.edges = updatedEdges;
		},
		[state.context],
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
				onSave={handleSave}
				onSessionNameChange={(name) => send({ type: "UPDATE_SESSION_NAME", name })}
				sessionName={state.context.sessionName}
				isSaving={state.context.isSaving}
				lastSaved={state.context.lastSaved}
				diagramName={state.context.diagramName}
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
