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
import type { Actor, AnyStateMachine, StateFrom } from "xstate";
import {
	type Connection,
	type EdgeChange,
	type Node,
	type NodeChange,
} from "@xyflow/react";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { canvasMachine, type CanvasEvent } from "../machines/canvas.machine";
import { C4Canvas, type C4CanvasRef } from "./C4Canvas";
import { PropertiesPanel } from "./PropertiesPanel";
import { Toolbar } from "./Toolbar";
import { DDDToolbar } from "./DDDToolbar";
import { DomainToggle } from "./DomainToggle";
import * as styles from "./styles.css";
import { BalancedMudChart } from "./BalancedMudChart";
import { DiagramEvolutionChart } from "./DiagramEvolutionChart";
import { DataBar } from "./DataBar";
import { useDatabase } from "../../core/effects/useDatabase";
import {
	saveDiagram,
	loadDiagram,
	createNewDiagram,
	listAllDiagrams,
} from "../../core/effects/canvas-persistence";
import type { LayoutPresetName } from "../../core/effects/layout";
import { emit } from "@tauri-apps/api/event";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { NodeData } from "../../core/effects/node-operations";
import { ToggleButton } from "react-aria-components";
import { CaretLeftIcon, CaretRightIcon, CaretUpIcon } from "@phosphor-icons/react";

type UseMachineParam = Parameters<typeof useMachine>[0];

type UseMachineTuple<TMachine extends AnyStateMachine> = [
	StateFrom<TMachine>,
	Actor<TMachine>["send"],
	Actor<TMachine>,
];

export function C4CanvasContainer() {
	const [state, send] = useMachine(
		canvasMachine as unknown as UseMachineParam,
	) as unknown as UseMachineTuple<typeof canvasMachine>;
	const { runEffect } = useDatabase();
	const canvasRef = useRef<C4CanvasRef>(null);
	const lastDiagramIdRef = useRef<string | null>(null);
	const [isSidebarOpen, setSidebarOpen] = useState(true);
	const [isDetailsOpen, setDetailsOpen] = useState(true);
	const [isCompactLayout, setCompactLayout] = useState(false);
	const [isCommandBarOpen, setCommandBarOpen] = useState(true);
	const [isDataBarOpen, setDataBarOpen] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		if (!("__TAURI_INTERNALS__" in window)) {
			return;
		}

		emit("frontend:ready").catch((error) => {
			console.warn("⚠️ Failed to emit frontend:ready event", error);
		});
	}, []);

	// Initialize: Load most recent diagram or create new one
	useEffect(() => {
		const initializeDiagram = async () => {
			try {
				// Check for load query parameter
				const urlParams = new URLSearchParams(window.location.search);
				const loadDiagramId = urlParams.get("load");

				if (loadDiagramId) {
					// Load specific diagram from URL
					const diagram = await runEffect(loadDiagram(loadDiagramId));
					const loadEvent: Extract<CanvasEvent, { type: "LOAD_DIAGRAM_SUCCESS" }> = {
						type: "LOAD_DIAGRAM_SUCCESS",
						diagram: {
							id: diagram.id,
							name: diagram.name,
							nodes: diagram.nodes,
							edges: diagram.edges,
							updatedAt: diagram.updatedAt,
							...(diagram.description ? { description: diagram.description } : {}),
						},
					};
					send(loadEvent);
					// Clear the query parameter
					window.history.replaceState({}, "", "/");
					return;
				}

				// Load diagrams from database (single source of truth)
				const diagrams = await runEffect(listAllDiagrams());

				if (diagrams.length > 0) {
					// Load all diagrams with their content to determine which to use
					const diagramsWithContent = await Promise.all(
						diagrams.map(async (meta) => {
							const full = await runEffect(loadDiagram(meta.id));
							return {
								...meta,
								nodeCount: full.nodes.length,
								edgeCount: full.edges.length,
								fullDiagram: full,
							};
						})
					);

					// IDIOMATIC TAURI: Query database to find best diagram
					// Prioritize: diagrams with content > most recent
					const diagramToLoad = diagramsWithContent
						.sort((a, b) => {
							// First: diagrams with nodes/edges
							const aHasContent = a.nodeCount > 0 || a.edgeCount > 0 ? 1 : 0;
							const bHasContent = b.nodeCount > 0 || b.edgeCount > 0 ? 1 : 0;
							if (aHasContent !== bHasContent) {
								return bHasContent - aHasContent;
							}
							// Then: most recently updated
							return b.updatedAt - a.updatedAt;
						})[0];

					if (!diagramToLoad) {
						throw new Error("No diagram found");
					}

					const diagram = diagramToLoad.fullDiagram;

					console.log(
						"📂 Loaded diagram:",
						diagram.id,
						"with",
						diagram.nodes.length,
						"nodes,",
						diagram.edges.length,
						"edges"
					);

					// Send success event to update state and trigger re-render
					const loadEvent: Extract<CanvasEvent, { type: "LOAD_DIAGRAM_SUCCESS" }> = {
						type: "LOAD_DIAGRAM_SUCCESS",
						diagram: {
							id: diagram.id,
							name: diagram.name,
							nodes: diagram.nodes,
							edges: diagram.edges,
							updatedAt: diagram.updatedAt,
							...(diagram.description ? { description: diagram.description } : {}),
						},
					};
					send(loadEvent);
				} else {
					// No diagrams exist, create a new one
					const diagram = await runEffect(
						createNewDiagram("My First Diagram", "Getting started with C4"),
					);

					console.log("📝 Created new diagram:", diagram.id);

					const createEvent: Extract<CanvasEvent, { type: "LOAD_DIAGRAM_SUCCESS" }> = {
						type: "LOAD_DIAGRAM_SUCCESS",
						diagram: {
							id: diagram.id,
							name: diagram.name,
							nodes: [],
							edges: [],
							updatedAt: diagram.createdAt,
							...(diagram.description ? { description: diagram.description } : {}),
						},
					};
					send(createEvent);
				}
			} catch (error) {
				console.error("⚠️ Failed to initialize diagram:", error);
				// Create new diagram on error
				const diagram = await runEffect(
					createNewDiagram("DIAGRAM::UNTITLED"),
				);

				send({
					type: "LOAD_DIAGRAM_SUCCESS",
					diagram: {
						id: diagram.id,
						name: diagram.name,
						nodes: [],
						edges: [],
						updatedAt: diagram.createdAt,
					},
				});
			}
		};

		initializeDiagram();
	}, [runEffect, send]);

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

	const handleLoadDiagram = useCallback(async (diagramId: string) => {
		try {
			const diagram = await runEffect(loadDiagram(diagramId));
			send({
				type: "LOAD_DIAGRAM_SUCCESS",
				diagram: {
					id: diagram.id,
					name: diagram.name,
					nodes: diagram.nodes,
					edges: diagram.edges,
					updatedAt: diagram.updatedAt,
					...(diagram.description ? { description: diagram.description } : {}),
				},
			});
			setDataBarOpen(false);
		} catch (error) {
			console.error("❌ Failed to load diagram:", error);
		}
	}, [runEffect, send]);

	// Handle node position/selection changes from ReactFlow
	const onNodesChange = useCallback(
		(changes: NodeChange[]) => {
			send({ type: "NODES_CHANGED", changes });
		},
		[send],
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
			if (!connection.source || !connection.target) {
				return;
			}

			send({
				type: "CONNECT_NODES",
				source: connection.source,
				target: connection.target,
			});
		},
		[send],
	);

	// Handle node clicks for selection
	const onNodeClick = useCallback(
		(_event: React.MouseEvent, node: Node) => {
			send({ type: "SELECT_NODE", nodeId: node.id });
		},
		[send],
	);

	// Handle edge label updates
	const onUpdateEdgeLabel = useCallback(
		(edgeId: string, label: string) => {
			send({ type: "UPDATE_EDGE_LABEL", edgeId, label });
		},
		[send],
	);

	// Enrich nodes with onUpdate callback for inline editing
	const enrichedNodes = useMemo(() => {
		return state.context.nodes.map((node: Node<NodeData>) => ({
			...node,
			data: {
				...node.data,
				onUpdate: (updates: Partial<NodeData>) => {
					send({ type: "UPDATE_NODE", nodeId: node.id, updates });
				},
			},
		}));
	}, [state.context.nodes, send]);

	const handleNewBoard = useCallback(async () => {
		try {
			// Send CREATE_NEW_BOARD event to transition to creatingDiagram state
			send({ type: "CREATE_NEW_BOARD" });

			const diagram = await runEffect(createNewDiagram("DIAGRAM::UNTITLED"));

			send({
				type: "LOAD_DIAGRAM_SUCCESS",
				diagram: {
					id: diagram.id,
					name: diagram.name,
					nodes: diagram.nodes,
					edges: diagram.edges,
					updatedAt: diagram.updatedAt,
					...(diagram.description ? { description: diagram.description } : {}),
				},
			});

			console.log("📝 Created new board:", diagram.id);
		} catch (error) {
			console.error("❌ New board creation failed:", error);
		}
	}, [runEffect, send]);

	// Handle auto-layout action
	const handleAutoLayout = useCallback((preset: LayoutPresetName) => {
		send({ type: "AUTO_LAYOUT", preset });
		requestAnimationFrame(() => {
			canvasRef.current?.fitViewToGraph();
		});
		console.log(`🎯 Auto-layout applied: ${preset}`);
	}, [send]);

	// Handle auto-layout selected nodes
	const handleAutoLayoutSelected = useCallback((preset: LayoutPresetName) => {
		send({ type: "AUTO_LAYOUT_SELECTED", preset });
		requestAnimationFrame(() => {
			canvasRef.current?.fitViewToGraph();
		});
		console.log(`🎯 Auto-layout (selected) applied: ${preset}`);
	}, [send]);

	// Keyboard shortcuts (⌘L for auto-layout, ⌘⇧L for auto-layout selected)
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			// ⌘⇧L / Ctrl+Shift+L - Auto-layout selected nodes
			if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === "l") {
				event.preventDefault();
				handleAutoLayoutSelected("command"); // Default to command preset
				return;
			}

			// ⌘L / Ctrl+L - Auto-layout all nodes
			if ((event.metaKey || event.ctrlKey) && event.key === "l") {
				event.preventDefault();
				handleAutoLayout("command"); // Default to command preset
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleAutoLayout, handleAutoLayoutSelected]);

	// Listen directly to native menu events while on the canvas
	useEffect(() => {
		const windowHandle = getCurrentWindow();
		let isMounted = true;
		const unlistenFns: UnlistenFn[] = [];

		const register = async (
			channel: string,
			handler: () => void | Promise<void>,
		): Promise<void> => {
			const unlisten = await windowHandle.listen(channel, () => {
				if (!isMounted) {
					return;
				}
				void handler();
			});
			unlistenFns.push(unlisten);
		};

		(async () => {
			await register("menu:save", handleSave);
			await register("menu:new-board", handleNewBoard);
			await register("menu:add-person", () => send({ type: "ADD_PERSON" }));
			await register("menu:add-system", () => send({ type: "ADD_SYSTEM" }));
			await register("menu:add-external", () =>
				send({ type: "ADD_EXTERNAL_SYSTEM" }),
			);
			await register("menu:add-container", () =>
				send({ type: "ADD_CONTAINER" }),
			);
			await register("menu:add-component", () =>
				send({ type: "ADD_COMPONENT" }),
			);
		})()
			.then(() => {
				console.log("🎨 Canvas menu event listeners attached");
			})
			.catch((error) => {
				console.error("⚠️ Failed to register canvas listeners", error);
			});

		return () => {
			isMounted = false;
			unlistenFns.forEach((unlisten) => unlisten());
			console.log("🎨 Canvas menu event listeners removed");
		};
	}, [handleSave, handleNewBoard, send]);

	// Handle query string actions (used when navigation triggers a canvas command)
	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const action = params.get("action");

		if (!action) {
			return;
		}

		switch (action) {
			case "new-board":
				void handleNewBoard();
				break;
			case "save":
				void handleSave();
				break;
			case "add-person":
				send({ type: "ADD_PERSON" });
				break;
			case "add-system":
				send({ type: "ADD_SYSTEM" });
				break;
			case "add-external":
				send({ type: "ADD_EXTERNAL_SYSTEM" });
				break;
			default:
				console.warn("⚠️ Unknown canvas action requested:", action);
				break;
		}

		window.history.replaceState({}, "", "/");
	}, [handleNewBoard, handleSave, send]);

	// Get selected node object (cast to Node<NodeData> since our nodes always have NodeData)
	const selectedNode = (state.context.nodes.find(
		(n: { id: string }) => n.id === state.context.selectedNodeId,
	) as Node<NodeData> | undefined) || null;

	// Handle node selection from search
	const handleSelectNode = useCallback(
		(nodeId: string) => {
			send({ type: "SELECT_NODE", nodeId });
			// Pan and zoom to the selected node
			canvasRef.current?.fitViewToNode(nodeId);
		},
		[send],
	);

	// Fit view whenever a new diagram is loaded
	useEffect(() => {
		const currentId = state.context.currentDiagramId;
		if (!currentId) {
			return;
		}

		const hasChanged = lastDiagramIdRef.current !== currentId;
		const hasNodes = state.context.nodes.length > 0;

		if (hasChanged) {
			lastDiagramIdRef.current = currentId;
			if (hasNodes) {
				requestAnimationFrame(() => {
					canvasRef.current?.fitViewToGraph();
				});
			}
		}
	}, [state.context.currentDiagramId, state.context.nodes.length]);

	// Re-fit diagram when viewport size changes
	useEffect(() => {
		if (state.context.nodes.length === 0) {
			return;
		}

		const handleResize = () => {
			canvasRef.current?.fitViewToGraph();
		};

		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, [state.context.nodes.length]);

	useEffect(() => {
		if (state.context.nodes.length === 0) {
			return;
		}
		canvasRef.current?.fitViewToGraph();
	}, [isSidebarOpen, isDetailsOpen, state.context.nodes.length]);

	useEffect(() => {
		if (typeof window === "undefined" || !window.matchMedia) {
			return;
		}

		const media = window.matchMedia("(max-width: 1200px)");
		const update = (matches: boolean) => {
			setCompactLayout(matches);
			if (matches) {
				setDetailsOpen(false);
			}
		};

		update(media.matches);

		const listener = (event: MediaQueryListEvent) => update(event.matches);
		media.addEventListener("change", listener);
		return () => media.removeEventListener("change", listener);
	}, []);

	const leftTrack = isSidebarOpen ? "minmax(260px, 320px)" : "0px";
	const rightTrack =
		!isCompactLayout && isDetailsOpen ? "minmax(300px, 360px)" : "0px";
	const rowTrack = isDataBarOpen ? "1fr auto" : "1fr";

	return (
		<div
			className={styles.workspace}
			style={{
				gridTemplateColumns: `${leftTrack} 1fr ${rightTrack}`,
				gridTemplateRows: rowTrack,
			}}
		>
			{isSidebarOpen && (
				<aside className={styles.sidebarColumn} aria-label="Toolbar panel">
					<div className={styles.sidebarBrand}>
						<img
							src="/app-icon.png"
							alt="C4 Canvas"
							className={styles.sidebarBrandIcon}
							width={50}
							height={50}
						/>
						<span>OPSYDYN C4</span>
						<span>v1.0.0</span>
		
					</div>
							<p>PRECISION TOOLS FOR PROFESSIONALS</p>
							<a
								href="/splashscreen"
		
							>
								Visit OPSYDYN
							</a>
										<a
								href="/postee"
		
							>
								USE POSTEE API CLIENT
							</a>

								<a
								href="/saved-diagrams"
		
							>
								SAVED DIAGRAMS
							</a>

							
					<div className={styles.panelHeader}>
						<ToggleButton
							isSelected={isSidebarOpen}
							onChange={setSidebarOpen}
							className={styles.collapseToggle}
							aria-label="Collapse left panel"
						>
							<CaretLeftIcon size={16} weight="bold" />
							ESC
						</ToggleButton>
						<DomainToggle
							currentDomain={state.context.currentDomain}
							onDomainChange={(domain) => send({ type: "SET_DOMAIN", domain })}
						/>
					</div>
					{state.context.currentDomain === "c4" ? (
						<Toolbar
							onAddPerson={() => send({ type: "ADD_PERSON" })}
							onAddSystem={() => send({ type: "ADD_SYSTEM" })}
							onAddExternalSystem={() => send({ type: "ADD_EXTERNAL_SYSTEM" })}
							onAddContainer={() => send({ type: "ADD_CONTAINER" })}
							onAddComponent={() => send({ type: "ADD_COMPONENT" })}
							onSave={handleSave}
							onNewBoard={handleNewBoard}
							onAutoLayout={handleAutoLayout}
							onAutoLayoutSelected={handleAutoLayoutSelected}
							onSessionNameChange={(name) =>
								send({ type: "UPDATE_SESSION_NAME", name })
							}
							onDiagramNameChange={(name) =>
								send({ type: "UPDATE_DIAGRAM_NAME", name })
							}
							sessionName={state.context.sessionName}
							isSaving={state.context.isSaving}
							lastSaved={state.context.lastSaved}
							diagramName={state.context.diagramName}
							{...(state.context.currentLayout && {
								currentLayout: state.context.currentLayout,
							})}
						/>
					) : (
						<DDDToolbar
							onAddBoundedContext={() => send({ type: "ADD_BOUNDED_CONTEXT" })}
							onAddAggregate={() => send({ type: "ADD_AGGREGATE" })}
							onAddDomainEvent={() => send({ type: "ADD_DOMAIN_EVENT" })}
							onAddEntity={() => send({ type: "ADD_ENTITY" })}
							onAddValueObject={() => send({ type: "ADD_VALUE_OBJECT" })}
							onAddDomainService={() => send({ type: "ADD_DOMAIN_SERVICE" })}
							onAddRepository={() => send({ type: "ADD_REPOSITORY" })}
							onAddFactory={() => send({ type: "ADD_FACTORY" })}
							onAddCommand={() => send({ type: "ADD_COMMAND" })}
							onAddQuery={() => send({ type: "ADD_QUERY" })}
							onAddApplicationService={() => send({ type: "ADD_APPLICATION_SERVICE" })}
							onAddIntegrationEvent={() => send({ type: "ADD_INTEGRATION_EVENT" })}
							onAddACL={() => send({ type: "ADD_ACL" })}
							onAddSaga={() => send({ type: "ADD_SAGA" })}
							onSave={handleSave}
							onNewBoard={handleNewBoard}
							onAutoLayout={handleAutoLayout}
							onAutoLayoutSelected={handleAutoLayoutSelected}
							onSessionNameChange={(name) =>
								send({ type: "UPDATE_SESSION_NAME", name })
							}
							onDiagramNameChange={(name) =>
								send({ type: "UPDATE_DIAGRAM_NAME", name })
							}
							sessionName={state.context.sessionName}
							isSaving={state.context.isSaving}
							lastSaved={state.context.lastSaved}
							diagramName={state.context.diagramName}
							{...(state.context.currentLayout && {
								currentLayout: state.context.currentLayout,
							})}
						/>
					)}
					<DiagramEvolutionChart
						nodes={state.context.nodes}
						edges={state.context.edges}
						domain={state.context.currentDomain}
					/>
				</aside>
			)}

			<section className={styles.canvasRegion}>
				<C4Canvas
					ref={canvasRef}
					nodes={enrichedNodes}
					edges={state.context.edges}
					onNodesChange={onNodesChange}
					onEdgesChange={onEdgesChange}
					onConnect={onConnect}
					onNodeClick={onNodeClick}
					onUpdateEdgeLabel={onUpdateEdgeLabel}
					isCommandBarOpen={isCommandBarOpen}
					onToggleCommandBar={setCommandBarOpen}
					onSelectNode={handleSelectNode}
				/>
				{!isSidebarOpen && (
					<ToggleButton
						isSelected={isSidebarOpen}
						onChange={setSidebarOpen}
						className={styles.collapseHandleLeft}
						aria-label="Expand left panel"
					>
						<CaretRightIcon size={16} weight="bold" />
					</ToggleButton>
				)}
				{!isCompactLayout && !isDetailsOpen && (
					<ToggleButton
						isSelected={isDetailsOpen}
						onChange={setDetailsOpen}
						className={styles.collapseHandleRight}
						aria-label="Expand right panel"
					>
						<CaretLeftIcon size={16} weight="bold" />
					</ToggleButton>
				)}
				{!isDataBarOpen && (
					<ToggleButton
						isSelected={isDataBarOpen}
						onChange={(selected) => setDataBarOpen(selected)}
						className={styles.bottomHandle}
						aria-label="Expand data bar"
					>
						<CaretUpIcon size={16} weight="bold" />
					</ToggleButton>
				)}
			</section>

			{!isCompactLayout && isDetailsOpen && (
				<aside className={styles.detailsColumn} aria-label="Properties panel">
					<div className={styles.panelHeader}>
						<ToggleButton
							isSelected={isDetailsOpen}
							onChange={setDetailsOpen}
							className={styles.collapseToggle}
							aria-label="Collapse right panel"
						>
							<CaretRightIcon size={16} weight="bold" />
							ESC
						</ToggleButton>
					</div>
					<BalancedMudChart
						nodes={state.context.nodes}
						edges={state.context.edges}
						selectedModuleId={selectedNode?.id ?? null}
						onSelectModule={handleSelectNode}
						domain={state.context.currentDomain}
					/>
					<PropertiesPanel
						selectedNode={selectedNode}
						onUpdateNode={(nodeId, updates) =>
							send({ type: "UPDATE_NODE", nodeId, updates })
						}
					/>
				</aside>
			)}

			{isDataBarOpen && (
				<DataBar
					isOpen={isDataBarOpen}
					onToggle={setDataBarOpen}
					onLoadDiagram={handleLoadDiagram}
				/>
			)}
		</div>
	);
}
