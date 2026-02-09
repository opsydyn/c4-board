/**
 * C4CanvasContainer - Stateful Canvas Component with Persistence
 *
 * Connects XState machine to React components with explicit save.
 * This is the imperative shell that coordinates the UI and I/O.
 *
 * Architecture:
 * - XState machine manages canvas state
 * - Effect services handle database operations
 * - Manual save + debounced auto-save
 * - Load diagram on mount or create new
 */

import { useMachine } from "@xstate/react";
import type { Actor, AnyStateMachine, StateFrom } from "xstate";
import {
	type Connection,
	type Edge,
	type EdgeChange,
	type Node,
	type NodeChange,
} from "@xyflow/react";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { Duration } from "effect";
import * as Tone from "tone";
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
import { ExportModal } from "./ExportModal";
import { useDatabase } from "../../core/effects/useDatabase";
import {
	saveDiagram,
	loadDiagram,
	createNewDiagram,
	listAllDiagrams,
	reactFlowNodeToDb,
} from "../../core/effects/canvas-persistence";
import type { LayoutPresetName } from "../../core/effects/layout";
import { emit } from "@tauri-apps/api/event";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { NodeData } from "../../core/effects/node-operations";
import { ToggleButton } from "react-aria-components";
import {
	CaretLeftIcon,
	CaretRightIcon,
	CaretUpIcon,
	GearSixIcon,
} from "@phosphor-icons/react";
import type { ContextMenuAction } from "../utils/contextMenu";
import type { EdgeMetadata } from "../../core/effects/edge-operations";
import { flex } from "../../styles/sprinkles.css";

const sidebarBrandMetaClass = flex({
	direction: "column",
	align: "start",
	gap: "1",
});

type UseMachineParam = Parameters<typeof useMachine>[0];

type UseMachineTuple<TMachine extends AnyStateMachine> = [
	StateFrom<TMachine>,
	Actor<TMachine>["send"],
	Actor<TMachine>,
];

type SaveDiagramPayload = Parameters<typeof saveDiagram>[0];
type SaveMode = "manual" | "auto";

const AUTO_SAVE_DELAY = Duration.millis(1500);
const AUTO_SAVE_SOUND_COOLDOWN = Duration.seconds(5);

export function C4CanvasContainer() {
	const [state, send, canvasActor] = useMachine(
		canvasMachine as unknown as UseMachineParam,
	) as unknown as UseMachineTuple<typeof canvasMachine>;
	const { runEffect } = useDatabase();
	const canvasRef = useRef<C4CanvasRef>(null);
	const lastDiagramIdRef = useRef<string | null>(null);
	const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const saveInFlightRef = useRef<Promise<unknown> | null>(null);
	const pendingAutoSaveRef = useRef(false);
	const lastPersistedFingerprintRef = useRef<string | null>(null);
	const seededDiagramIdRef = useRef<string | null>(null);
	const saveSynthRef = useRef<Tone.PolySynth<Tone.Synth> | null>(null);
	const audioReadyRef = useRef(false);
	const lastSaveSoundAtRef = useRef(0);
	const isNavigatingRef = useRef(false);
	const persistDiagramRef = useRef<(mode: SaveMode) => Promise<boolean>>(
		async () => false,
	);
	const [isSidebarOpen, setSidebarOpen] = useState(true);
	const [isDetailsOpen, setDetailsOpen] = useState(true);
	const [isCompactLayout, setCompactLayout] = useState(false);
	const [isCommandBarOpen, setCommandBarOpen] = useState(true);
	const [isDataBarOpen, setDataBarOpen] = useState(false);
	const [uiLastSavedAt, setUiLastSavedAt] = useState<number | null>(null);
	const [navigationTarget, setNavigationTarget] = useState<string | null>(null);

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

	const clearAutoSaveTimer = useCallback(() => {
		if (autoSaveTimerRef.current) {
			clearTimeout(autoSaveTimerRef.current);
			autoSaveTimerRef.current = null;
		}
	}, []);

	const primeSaveAudio = useCallback(async (): Promise<boolean> => {
		try {
			await Tone.start();
			audioReadyRef.current = true;
			return true;
		} catch {
			return false;
		}
	}, []);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		const handleFirstInteraction = () => {
			void primeSaveAudio();
		};

		window.addEventListener("pointerdown", handleFirstInteraction, {
			once: true,
		});
		window.addEventListener("keydown", handleFirstInteraction, {
			once: true,
		});

		return () => {
			window.removeEventListener("pointerdown", handleFirstInteraction);
			window.removeEventListener("keydown", handleFirstInteraction);
		};
	}, [primeSaveAudio]);

	const getSaveSynth = useCallback((): Tone.PolySynth<Tone.Synth> => {
		if (!saveSynthRef.current) {
			saveSynthRef.current = new Tone.PolySynth(Tone.Synth, {
				volume: -6,
				oscillator: { type: "triangle8" },
				envelope: {
					attack: 0.006,
					decay: 0.2,
					sustain: 0.12,
					release: 0.3,
				},
			}).toDestination();
		}

		return saveSynthRef.current;
	}, []);

	const playSaveChime = useCallback(
		async (mode: SaveMode): Promise<void> => {
			try {
				if (!state.context.animationsEnabled) {
					return;
				}

				const nowMs = Date.now();
				if (
					mode === "auto" &&
					Duration.lessThan(
						Duration.millis(nowMs - lastSaveSoundAtRef.current),
						AUTO_SAVE_SOUND_COOLDOWN,
					)
				) {
					return;
				}

				if (!audioReadyRef.current) {
					const ready = await primeSaveAudio();
					if (!ready) {
						return;
					}
				}

				const synth = getSaveSynth();
				const now = Tone.now();
				synth.triggerAttackRelease("C4", "16n", now);
				synth.triggerAttackRelease("E4", "16n", now + 0.08);
				synth.triggerAttackRelease("G4", "8n", now + 0.16);
				lastSaveSoundAtRef.current = nowMs;
			} catch (error) {
				console.warn("⚠️ Save chime failed", error);
			}
		},
		[getSaveSynth, primeSaveAudio, state.context.animationsEnabled],
	);

	const getLatestContext = useCallback(() => {
		return canvasActor.getSnapshot().context;
	}, [canvasActor]);

	const buildSaveInput = useCallback((): SaveDiagramPayload | null => {
		const context = getLatestContext();
		if (!context.currentDiagramId) {
			return null;
		}

		const saveInput: SaveDiagramPayload = {
			id: context.currentDiagramId,
			name: context.diagramName,
			nodes: context.nodes,
			edges: context.edges,
		};

		if (context.diagramDescription) {
			saveInput.description = context.diagramDescription;
		}

		return saveInput;
	}, [getLatestContext]);

	const createSaveFingerprint = useCallback((input: SaveDiagramPayload): string => {
		const normalizedNodes = input.nodes
			.map((node) => {
				const dbNode = reactFlowNodeToDb(node, input.id);
				return {
					id: dbNode.id,
					domain: dbNode.domain,
					type: dbNode.type,
					label: dbNode.label,
					technology: dbNode.technology ?? null,
					description: dbNode.description ?? null,
					positionX: dbNode.position_x,
					positionY: dbNode.position_y,
					width: dbNode.width ?? null,
					height: dbNode.height ?? null,
					parentId: dbNode.parent_id ?? null,
					extent: dbNode.extent ?? null,
					expandParent: dbNode.expand_parent ?? false,
					iconId: dbNode.icon_id ?? null,
				};
			})
			.sort((a, b) => a.id.localeCompare(b.id));

		const normalizedEdges = input.edges
			.map((edge) => {
				const edgeData =
					typeof edge.data === "object" && edge.data !== null
						? (edge.data as { metadata?: unknown })
						: undefined;
				const metadataValue = edgeData?.metadata;
				const metadata =
					metadataValue === undefined || metadataValue === null
						? null
						: JSON.stringify(metadataValue);

				return {
					id: edge.id,
					source: edge.source,
					target: edge.target,
					label: typeof edge.label === "string" ? edge.label : null,
					metadata,
				};
			})
			.sort((a, b) => a.id.localeCompare(b.id));

		return JSON.stringify({
			id: input.id,
			name: input.name,
			description: input.description ?? null,
			nodes: normalizedNodes,
			edges: normalizedEdges,
		});
	}, []);

	const flushPendingInlineEdits = useCallback(async (): Promise<void> => {
		if (typeof document === "undefined") {
			return;
		}

		const activeElement = document.activeElement;
		if (activeElement instanceof HTMLElement && activeElement !== document.body) {
			activeElement.blur();
			await new Promise<void>((resolve) => {
				setTimeout(resolve, 0);
			});
			await new Promise<void>((resolve) => {
				requestAnimationFrame(() => resolve());
			});
		}
	}, []);

	const waitForSaveQueueDrain = useCallback(async (): Promise<void> => {
		const waitFor = async (
			inFlightSave: Promise<unknown> | null,
		): Promise<void> => {
			if (!inFlightSave) {
				return;
			}

			try {
				await inFlightSave;
			} catch {
				// Save failures are already reflected in machine state.
			}

			const nextSave = saveInFlightRef.current;
			if (nextSave && nextSave !== inFlightSave) {
				await waitFor(nextSave);
			}
		};

		await waitFor(saveInFlightRef.current);
	}, []);

	const seedPersistedFingerprintFromDiagram = useCallback(
		(diagram: {
			id: string;
			name: string;
			description?: string | null | undefined;
			nodes: Node[];
			edges: Edge[];
			savedAt?: number;
		}) => {
			const saveInput: SaveDiagramPayload = {
				id: diagram.id,
				name: diagram.name,
				nodes: diagram.nodes,
				edges: diagram.edges,
			};

			if (diagram.description) {
				saveInput.description = diagram.description;
			}

			lastPersistedFingerprintRef.current = createSaveFingerprint(saveInput);
			seededDiagramIdRef.current = diagram.id;
			pendingAutoSaveRef.current = false;
			setUiLastSavedAt(diagram.savedAt ?? null);
			clearAutoSaveTimer();
		},
		[clearAutoSaveTimer, createSaveFingerprint],
	);

	const persistDiagram = useCallback(
		async (mode: SaveMode): Promise<boolean> => {
			if (mode === "manual") {
				clearAutoSaveTimer();
				pendingAutoSaveRef.current = false;
			}

			if (mode === "auto" && saveInFlightRef.current) {
				pendingAutoSaveRef.current = true;
				return false;
			}

			// Serialize manual saves behind any in-flight save, including autosave
			// flushes chained by prior save finalizers.
			await waitForSaveQueueDrain();

			const saveInput = buildSaveInput();
			if (!saveInput) {
				if (mode === "manual") {
					console.warn("No diagram to save");
				}
				return false;
			}

			const fingerprint = createSaveFingerprint(saveInput);
			if (mode === "auto" && fingerprint === lastPersistedFingerprintRef.current) {
				return false;
			}

			send({ type: mode === "manual" ? "SAVE_DIAGRAM" : "AUTO_SAVE" });

			const savePromise = runEffect(saveDiagram(saveInput));
			saveInFlightRef.current = savePromise;

			try {
				const saveResult = await savePromise;
				const savedAt =
					typeof saveResult === "object" &&
					saveResult !== null &&
					"savedAt" in saveResult &&
					typeof saveResult.savedAt === "number"
						? saveResult.savedAt
						: Date.now();
				lastPersistedFingerprintRef.current = fingerprint;
				seededDiagramIdRef.current = saveInput.id;
				setUiLastSavedAt(savedAt);
				send({ type: "SAVE_SUCCESS" });
				void playSaveChime(mode);
				if (mode === "manual") {
					console.log("✅ Saved diagram");
				}
				return true;
			} catch (error) {
				console.error(
					mode === "manual" ? "❌ Save failed:" : "❌ Auto-save failed:",
					error,
				);
				send({
					type: "SAVE_ERROR",
					error: error instanceof Error ? error.message : "Save failed",
				});
				return false;
			} finally {
				if (saveInFlightRef.current === savePromise) {
					saveInFlightRef.current = null;
				}

				if (pendingAutoSaveRef.current) {
					pendingAutoSaveRef.current = false;
					void persistDiagramRef.current("auto");
				}
			}
		},
		[
			buildSaveInput,
			clearAutoSaveTimer,
			createSaveFingerprint,
			playSaveChime,
			runEffect,
			send,
			waitForSaveQueueDrain,
		],
	);

	useEffect(() => {
		persistDiagramRef.current = persistDiagram;
	}, [persistDiagram]);

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
					seedPersistedFingerprintFromDiagram({
						id: diagram.id,
						name: diagram.name,
						description: diagram.description,
						nodes: diagram.nodes,
						edges: diagram.edges,
						savedAt: diagram.updatedAt,
					});
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
						}),
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
						"edges",
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
					seedPersistedFingerprintFromDiagram({
						id: diagram.id,
						name: diagram.name,
						description: diagram.description,
						nodes: diagram.nodes,
						edges: diagram.edges,
						savedAt: diagram.updatedAt,
					});
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
					seedPersistedFingerprintFromDiagram({
						id: diagram.id,
						name: diagram.name,
						description: diagram.description,
						nodes: [],
						edges: [],
						savedAt: diagram.createdAt,
					});
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
				seedPersistedFingerprintFromDiagram({
					id: diagram.id,
					name: diagram.name,
					nodes: [],
					edges: [],
					savedAt: diagram.createdAt,
				});
			}
		};

		initializeDiagram();
	}, [runEffect, seedPersistedFingerprintFromDiagram, send]);

	// Handle explicit save action
	const handleSave = useCallback(async () => {
		await primeSaveAudio();
		await flushPendingInlineEdits();
		await persistDiagram("manual");
	}, [flushPendingInlineEdits, persistDiagram, primeSaveAudio]);

	const navigateWithSave = useCallback(
		async (href: string) => {
			if (navigationTarget) {
				return;
			}

			setNavigationTarget(href);

				try {
					await flushPendingInlineEdits();
					const didSave = await persistDiagram("manual");
					if (!didSave) {
						console.warn("⚠️ Save did not complete before navigation; continuing");
					}

					isNavigatingRef.current = didSave;
					window.location.assign(href);
				} catch (error) {
					console.error("❌ Navigation blocked because save failed:", error);
				isNavigatingRef.current = false;
				setNavigationTarget(null);
			}
		},
			[flushPendingInlineEdits, navigationTarget, persistDiagram],
		);

	const handleNavigateWithSave = useCallback(
		(event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
			event.preventDefault();
			void navigateWithSave(href);
		},
		[navigateWithSave],
	);

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
			seedPersistedFingerprintFromDiagram({
				id: diagram.id,
				name: diagram.name,
				description: diagram.description,
				nodes: diagram.nodes,
				edges: diagram.edges,
				savedAt: diagram.updatedAt,
			});
			setDataBarOpen(false);
		} catch (error) {
			console.error("❌ Failed to load diagram:", error);
		}
	}, [runEffect, seedPersistedFingerprintFromDiagram, send]);

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

	// Handle edge metadata updates
	const onUpdateEdgeMetadata = useCallback(
		(edgeId: string, label: string, metadata: EdgeMetadata) => {
			// First update label
			send({ type: "UPDATE_EDGE_LABEL", edgeId, label });
			// Then update metadata
			send({ type: "UPDATE_EDGE_METADATA", edgeId, metadata });
		},
		[send],
	);

	// Handle context menu actions
	const onContextMenuAction = useCallback(
		(action: ContextMenuAction, nodeId?: string, edgeId?: string) => {
			switch (action.type) {
				case "edit":
					if (nodeId) {
						send({ type: "SELECT_NODE", nodeId });
					}
					break;

				case "duplicate":
					if (nodeId) {
						send({ type: "DUPLICATE_NODE", nodeId });
					}
					break;

				case "delete":
					if (nodeId) {
						send({ type: "DELETE_NODE", nodeId });
					}
					break;

				case "change-type":
					if (nodeId) {
						send({ type: "CHANGE_NODE_TYPE", nodeId, nodeType: action.nodeType });
					}
					break;

				case "add-node":
					send({
						type: "ADD_NODE_AT_POSITION",
						nodeType: action.nodeType,
						position: action.position ?? { x: 100, y: 100 },
					});
					break;

				case "auto-layout":
					send({ type: "AUTO_LAYOUT" });
					break;

				case "export":
					// Open export modal - use current viewport
					if (canvasRef.current) {
						send({ type: "EXPORT_PLANTUML" });
					}
					break;

				case "edit-label":
					if (edgeId) {
						send({ type: "UPDATE_EDGE_LABEL", edgeId, label: "" });
					}
					break;

				case "change-edge-style":
					if (edgeId) {
						send({ type: "CHANGE_EDGE_STYLE", edgeId, style: action.style });
					}
					break;

				case "reverse-direction":
					if (edgeId) {
						send({ type: "REVERSE_EDGE_DIRECTION", edgeId });
					}
					break;

				case "delete-edge":
					if (edgeId) {
						send({ type: "DELETE_EDGE", edgeId });
					}
					break;

				case "paste":
					// TODO: Implement paste functionality
					console.log("Paste action not yet implemented");
					break;

				case "add-connected":
					// TODO: Implement add connected node
					console.log("Add connected node not yet implemented");
					break;
			}
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
			seedPersistedFingerprintFromDiagram({
				id: diagram.id,
				name: diagram.name,
				description: diagram.description,
				nodes: diagram.nodes,
				edges: diagram.edges,
				savedAt: diagram.updatedAt,
			});

			console.log("📝 Created new board:", diagram.id);
		} catch (error) {
			console.error("❌ New board creation failed:", error);
		}
	}, [runEffect, seedPersistedFingerprintFromDiagram, send]);

	// Establish a persisted baseline whenever the active diagram changes.
	useEffect(() => {
		const currentDiagramId = state.context.currentDiagramId;
		if (!currentDiagramId) {
			seededDiagramIdRef.current = null;
			lastPersistedFingerprintRef.current = null;
			pendingAutoSaveRef.current = false;
			setUiLastSavedAt(null);
			clearAutoSaveTimer();
			return;
		}

		if (seededDiagramIdRef.current === currentDiagramId) {
			return;
		}

		const saveInput = buildSaveInput();
		if (!saveInput) {
			return;
		}

		lastPersistedFingerprintRef.current = createSaveFingerprint(saveInput);
		seededDiagramIdRef.current = currentDiagramId;
		pendingAutoSaveRef.current = false;
		clearAutoSaveTimer();
	}, [
		buildSaveInput,
		clearAutoSaveTimer,
		createSaveFingerprint,
		state.context.currentDiagramId,
	]);

	// Debounced autosave for meaningful persisted changes only.
	useEffect(() => {
		if (!state.context.currentDiagramId) {
			clearAutoSaveTimer();
			return;
		}

		clearAutoSaveTimer();
		autoSaveTimerRef.current = setTimeout(() => {
			autoSaveTimerRef.current = null;
			void persistDiagram("auto");
		}, Duration.toMillis(AUTO_SAVE_DELAY));

		return clearAutoSaveTimer;
	}, [
		clearAutoSaveTimer,
		state.context.currentDiagramId,
		state.context.diagramName,
		state.context.diagramDescription,
		state.context.nodes,
		state.context.edges,
		persistDiagram,
	]);

	useEffect(() => {
		return () => {
			clearAutoSaveTimer();
			pendingAutoSaveRef.current = false;
			saveSynthRef.current?.dispose();
			saveSynthRef.current = null;
		};
	}, [clearAutoSaveTimer]);

	useEffect(() => {
		const handlePageHide = () => {
			if (isNavigatingRef.current) {
				return;
			}
			void persistDiagramRef.current("manual");
		};

		window.addEventListener("pagehide", handlePageHide);
		return () => window.removeEventListener("pagehide", handlePageHide);
	}, []);

	const handleToggleAnimations = useCallback(() => {
		const enablingEffects = !state.context.animationsEnabled;
		send({ type: "TOGGLE_ANIMATIONS" });
		if (enablingEffects) {
			void primeSaveAudio();
		}
	}, [primeSaveAudio, send, state.context.animationsEnabled]);

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
	const navigationLabel = useMemo(() => {
		switch (navigationTarget) {
			case "/postee":
				return "LOADING POSTEE WORKSPACE";
			case "/saved-diagrams":
				return "LOADING SAVED DIAGRAMS";
			case "/settings":
				return "LOADING GLOBAL SETTINGS";
			case "/splashscreen":
				return "LOADING OPSYDYN SPLASHSCREEN";
			default:
				return "LOADING NEXT WORKSPACE";
		}
	}, [navigationTarget]);

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
						<span className={styles.sidebarBrandIdentity}>
							<img
								src="/app-icon.png"
								alt="C4 Canvas"
								className={styles.sidebarBrandIcon}
								width={50}
								height={50}
							/>
							<span className={sidebarBrandMetaClass}>
								<span>OPSYDYN HUD::9000</span>
								<span>V1.0.0</span>
							</span>
						</span>
						<a
							className={styles.sidebarBrandAction}
							href="/settings"
							aria-label="Open global settings"
							title="Open global settings"
							onClick={(event) => {
								void handleNavigateWithSave(event, "/settings");
							}}
						>
							<GearSixIcon size={16} weight="duotone" />
						</a>
					</div>
					<p className={styles.sidebarTagline}>PRECISION TOOLS FOR PROFESSIONALS</p>
					<nav className={styles.sidebarQuickActions} aria-label="Workspace shortcuts">
						<a
							className={styles.sidebarQuickActionLink}
							href="/splashscreen"
							onClick={(event) => {
								void handleNavigateWithSave(event, "/splashscreen");
							}}
						>
							VISIT OPSYDYN
						</a>
						<a
							className={styles.sidebarQuickActionLink}
							href="/postee"
							onClick={(event) => {
								void handleNavigateWithSave(event, "/postee");
							}}
						>
							USE POSTEE
						</a>
						<a
							className={styles.sidebarQuickActionLink}
							href="/saved-diagrams"
							onClick={(event) => {
								void handleNavigateWithSave(event, "/saved-diagrams");
							}}
						>
							SAVED DIAGRAMS
						</a>
					</nav>

							
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
								onOpenSavedDiagrams={() => {
									void navigateWithSave("/saved-diagrams");
								}}
								onSessionNameChange={(name) =>
									send({ type: "UPDATE_SESSION_NAME", name })
								}
							onDiagramNameChange={(name) =>
								send({ type: "UPDATE_DIAGRAM_NAME", name })
							}
								sessionName={state.context.sessionName}
								isSaving={state.context.isSaving}
								lastSaved={uiLastSavedAt ?? state.context.lastSaved}
								diagramName={state.context.diagramName}
								onToggleAnimations={handleToggleAnimations}
								animationsEnabled={state.context.animationsEnabled}
								saveError={state.context.saveError}
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
								onOpenSavedDiagrams={() => {
									void navigateWithSave("/saved-diagrams");
								}}
								onSessionNameChange={(name) =>
									send({ type: "UPDATE_SESSION_NAME", name })
								}
							onDiagramNameChange={(name) =>
								send({ type: "UPDATE_DIAGRAM_NAME", name })
							}
								sessionName={state.context.sessionName}
								isSaving={state.context.isSaving}
								lastSaved={uiLastSavedAt ?? state.context.lastSaved}
								diagramName={state.context.diagramName}
								onToggleAnimations={handleToggleAnimations}
								animationsEnabled={state.context.animationsEnabled}
								saveError={state.context.saveError}
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
					onUpdateEdgeMetadata={onUpdateEdgeMetadata}
					isCommandBarOpen={isCommandBarOpen}
					onToggleCommandBar={setCommandBarOpen}
					onSelectNode={handleSelectNode}
					onExportPlantUML={(viewport) => send({ type: "EXPORT_PLANTUML", viewport })}
					onExportMermaid={(viewport) => send({ type: "EXPORT_MERMAID", viewport })}
					onImportDiagram={(content, format, mode) =>
						send({ type: "IMPORT_DIAGRAM", content, format, mode })
					}
					viewportToApply={state.context.viewport}
					onContextMenuAction={onContextMenuAction}
					animationsEnabled={state.context.animationsEnabled}
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
				{navigationTarget && (
					<div className={styles.navigationOverlay} role="status" aria-live="polite">
						<div className={styles.navigationOverlayCard}>
							<div
								className={styles.navigationOverlayScanline}
								aria-hidden="true"
							/>
							<h1 className={styles.navigationOverlayTitle}>
								OPSYDYN // PRECISION TOOLS
							</h1>
							<p className={styles.navigationOverlayStep}>SYNCING BOARD STATE</p>
							<p className={styles.navigationOverlayTarget}>{navigationLabel}</p>
						</div>
					</div>
				)}

				{/* Export Modal */}
				<ExportModal
				isOpen={state.context.exportModalOpen}
				exportedCode={state.context.exportedCode}
				exportFormat={state.context.exportFormat}
				diagramName={state.context.diagramName}
				onClose={() => send({ type: "CLOSE_EXPORT_MODAL" })}
			/>
		</div>
	);
}
