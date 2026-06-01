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

import {
  CaretLeftIcon,
  CaretRightIcon,
  CaretUpIcon,
  CloudIcon,
  GearSixIcon,
  RobotIcon,
  UsersFourIcon,
} from "@phosphor-icons/react";
import { emit } from "@tauri-apps/api/event";
import { useMachine } from "@xstate/react";
import { type Connection, type Edge, type EdgeChange, type Node, type NodeChange } from "@xyflow/react";
import { Duration, Effect } from "effect";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ToggleButton } from "react-aria-components";
import * as Tone from "tone";
import type { Actor, AnyStateMachine, StateFrom } from "xstate";
import { waitFor } from "xstate";
import { mergeAzureMappedGraphIntoCanvas } from "../../core/effects/azure-sync.apply";
import type { AzureSyncDryRunOutput } from "../../core/effects/azure-sync.runtime";
import {
  createNewDiagram,
  listAllDiagrams,
  loadDiagram,
  reactFlowNodeToDb,
  saveDiagram,
} from "../../core/effects/canvas-persistence";
import { patchSettings } from "../../core/effects/database";
import type { RigC4BoardNode, RigC4BoardNodeType, RigC4BoardSummary } from "../../core/effects/ai-agent.runtime";
import * as EdgeOps from "../../core/effects/edge-operations";
import type { EdgeMetadata } from "../../core/effects/edge-operations";
import type { LayoutPresetName } from "../../core/effects/layout";
import * as NodeOps from "../../core/effects/node-operations";
import type { NodeData } from "../../core/effects/node-operations";
import { buildGroundedProposalDiff, summarizeGroundedProposalDiff } from "../../core/effects/opy-c4-proposals";
import { useAppSettings } from "../../core/effects/useAppSettings";
import { useDatabase } from "../../core/effects/useDatabase";
import { flex } from "../../styles/sprinkles.css";
import { useC4AutosaveMachine } from "../hooks/useC4AutosaveMachine";
import { useC4CommandsMachine } from "../hooks/useC4CommandsMachine";
import { useC4NavigationMachine } from "../hooks/useC4NavigationMachine";
import { useC4PanelPreferencesMachine } from "../hooks/useC4PanelPreferencesMachine";
import type { C4PanelPreferencePatch } from "../machines/c4-panel-preferences.machine";
import {
  type C4SaveMachineEvent,
  type C4SaveMode,
  type C4SaveRequest,
  type C4SaveSuccess,
  createC4SaveMachine,
} from "../machines/c4-save.machine";
import { type CanvasEvent, canvasMachine } from "../machines/canvas.machine";
import type { ContextMenuAction } from "../utils/contextMenu";
import { AzureSyncPanel } from "./AzureSyncPanel";
import { BalancedMudChart } from "./BalancedMudChart";
import { C4Canvas, type C4CanvasRef } from "./C4Canvas";
import { DataBar } from "./DataBar";
import { DDDToolbar } from "./DDDToolbar";
import { DiagramEvolutionChart } from "./DiagramEvolutionChart";
import { DomainToggle } from "./DomainToggle";
import { ExportModal } from "./ExportModal";
import { OpyAvatar } from "./OpyAvatar";
import { type OpyBoardAction, OpyCopilotPanel } from "./OpyCopilotPanel";
import { PropertiesPanel } from "./PropertiesPanel";
import * as styles from "./styles.css";
import { TacticalSelect, type TacticalSelectOption } from "./TacticalSelect";
import { Toolbar } from "./Toolbar";

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

const AUTO_SAVE_SOUND_COOLDOWN = Duration.seconds(5);
const SAVE_REQUEST_TIMEOUT_MS = 20_000;
const toSaveSynthVolumeDb = (masterVolume: number): number =>
  masterVolume <= 0
    ? -60
    : -24 + Math.max(0, Math.min(1, masterVolume)) * 20;
const OWNERSHIP_FILTER_ALL = "__all__";
const OWNERSHIP_FILTER_UNASSIGNED = "__unassigned__";

const isRigC4BoardNodeType = (value: unknown): value is RigC4BoardNodeType =>
  value === "person" ||
  value === "system" ||
  value === "externalSystem" ||
  value === "container" ||
  value === "component";

const normalizeTeamOwnership = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed.toLowerCase();
};

const mergeOwnershipTeams = (
  existingTeams: readonly string[],
  incomingTeams: Iterable<string>,
): string[] => {
  const byNormalized = new Map<string, string>();

  for (const team of existingTeams) {
    const normalized = normalizeTeamOwnership(team);
    if (!normalized) {
      continue;
    }
    if (!byNormalized.has(normalized)) {
      byNormalized.set(normalized, team.trim());
    }
  }

  for (const team of incomingTeams) {
    const normalized = normalizeTeamOwnership(team);
    if (!normalized) {
      continue;
    }
    if (!byNormalized.has(normalized)) {
      byNormalized.set(normalized, team.trim());
    }
  }

  return Array.from(byNormalized.values());
};

const toNullableTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toRigC4BoardNode = (node: Node<NodeData>): RigC4BoardNode | null => {
  const data = (node.data ?? {}) as Partial<NodeData>;
  const nodeType = data.c4Type ?? (typeof node.type === "string" ? node.type : undefined);

  if (!isRigC4BoardNodeType(nodeType)) {
    return null;
  }

  return {
    id: node.id,
    label: toNullableTrimmedString(data.label) ?? node.id,
    nodeType,
    description: toNullableTrimmedString(data.description),
    technology: toNullableTrimmedString(data.technology),
    teamOwnership: toNullableTrimmedString(data.teamOwnership),
  };
};

const buildRigC4BoardSummary = (input: {
  domain: "c4" | "ddd";
  diagramId: string | null;
  diagramName: string;
  nodes: readonly Node[];
  edges: readonly Edge[];
}): RigC4BoardSummary | null => {
  if (input.domain !== "c4") {
    return null;
  }

  const nodes = input.nodes
    .map((node: Node) => toRigC4BoardNode(node as Node<NodeData>))
    .filter((node: RigC4BoardNode | null): node is RigC4BoardNode => node !== null);
  const nodeLabelById = new Map(nodes.map((node: RigC4BoardNode) => [node.id, node.label] as const));
  const edges = input.edges.map((edge: Edge) => ({
    id: edge.id,
    sourceId: edge.source,
    targetId: edge.target,
    sourceLabel: nodeLabelById.get(edge.source) ?? edge.source,
    targetLabel: nodeLabelById.get(edge.target) ?? edge.target,
    label: typeof edge.label === "string" && edge.label.trim().length > 0
      ? edge.label.trim()
      : null,
  }));

  return {
    diagramId: input.diagramId,
    diagramName: toNullableTrimmedString(input.diagramName),
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodes,
    edges,
  };
};

export function C4CanvasContainer() {
  const [state, send, canvasActor] = useMachine(
    canvasMachine as unknown as UseMachineParam,
  ) as unknown as UseMachineTuple<typeof canvasMachine>;
  const { runEffect } = useDatabase();
  const {
    settings: appSettings,
    isLoading: isSettingsLoading,
    settingsV1Enabled,
  } = useAppSettings();
  const canvasRef = useRef<C4CanvasRef>(null);
  const lastDiagramIdRef = useRef<string | null>(null);
  const lastPersistedFingerprintRef = useRef<string | null>(null);
  const seededDiagramIdRef = useRef<string | null>(null);
  const saveSynthRef = useRef<Tone.PolySynth<Tone.Synth> | null>(null);
  const audioReadyRef = useRef(false);
  const lastSaveSoundAtRef = useRef(0);
  const lastSaveVolSkipReasonRef = useRef<string | null>(null);
  const pageHideSaveCompletedRef = useRef(false);
  const settingsSeededRef = useRef(false);
  const saveRequestCounterRef = useRef(0);
  const saveInputOverridesByRequestIdRef = useRef(
    new Map<number, SaveDiagramPayload>(),
  );
  const ownershipCatalogDiagramRef = useRef<string | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isDetailsOpen, setDetailsOpen] = useState(true);
  const [isCompactLayout, setCompactLayout] = useState(false);
  const [isCommandBarOpen, setCommandBarOpen] = useState(true);
  const [isDataBarOpen, setDataBarOpen] = useState(false);
  const [ownershipTeamCatalog, setOwnershipTeamCatalog] = useState<string[]>([]);
  const [ownershipTeamFilter, setOwnershipTeamFilter] = useState<string>(
    OWNERSHIP_FILTER_ALL,
  );
  const [showCrossTeamOnly, setShowCrossTeamOnly] = useState(false);
  const [showUnknownOwnershipOnly, setShowUnknownOwnershipOnly] = useState(false);

  const persistPanelPreferencePatch = useCallback(
    async (patch: C4PanelPreferencePatch): Promise<void> => {
      if (!settingsV1Enabled) {
        return;
      }
      await runEffect(patchSettings(patch));
    },
    [runEffect, settingsV1Enabled],
  );

  const handlePanelPreferencePersistFailure = useCallback(
    (event: {
      patch: C4PanelPreferencePatch;
      message: string;
    }) => {
      console.warn("⚠️ Failed to persist panel preference", event.patch, event.message);
    },
    [],
  );

  const {
    azurePanelVisible: isAzurePanelOpen,
    ownershipLensVisible: isOwnershipLensOpen,
    couplingExplainabilityVisible: isCouplingExplainabilityVisible,
    opyCopilotVisible: isOpy9000Open,
    toggleAzurePanel,
    toggleOwnershipLens,
    toggleCouplingExplainability,
    toggleOpyCopilot,
  } = useC4PanelPreferencesMachine({
    isSettingsLoading,
    settings: {
      azurePanelVisible: appSettings.azurePanelVisible,
      ownershipLensVisible: appSettings.ownershipLensVisible,
      couplingExplainabilityVisible: appSettings.couplingExplainabilityVisible,
      opyCopilotVisible: appSettings.opyCopilotVisible,
    },
    persistPatch: persistPanelPreferencePatch,
    onPersistFailure: handlePanelPreferencePersistFailure,
  });

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

  const primeSaveAudio = useCallback(async (): Promise<boolean> => {
    if (!appSettings.masterAudioEnabled || !appSettings.saveVolEnabled) {
      audioReadyRef.current = false;
      return false;
    }

    try {
      const context = Tone.getContext();
      if (context.state !== "running") {
        await Tone.start();
      }
      audioReadyRef.current = Tone.getContext().state === "running";
      return audioReadyRef.current;
    } catch {
      audioReadyRef.current = false;
      return false;
    }
  }, [appSettings.masterAudioEnabled, appSettings.saveVolEnabled]);

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
        volume: toSaveSynthVolumeDb(appSettings.masterVolume),
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
  }, [appSettings.masterVolume]);

  useEffect(() => {
    if (!saveSynthRef.current) {
      return;
    }

    saveSynthRef.current.volume.value = toSaveSynthVolumeDb(
      appSettings.masterVolume,
    );
  }, [appSettings.masterVolume]);

  const playSaveVol = useCallback(
    async (mode: C4SaveMode): Promise<void> => {
      try {
        const skipReason = !appSettings.masterAudioEnabled
          ? "master-audio-disabled"
          : !appSettings.saveVolEnabled
          ? "save-vol-disabled"
          : appSettings.masterVolume <= 0
          ? "master-volume-zero"
          : null;

        if (skipReason !== null) {
          if (lastSaveVolSkipReasonRef.current !== skipReason) {
            console.info(`🔇 Save vol skipped: ${skipReason}`);
            lastSaveVolSkipReasonRef.current = skipReason;
          }
          return;
        }

        const nowMs = Date.now();
        if (
          mode === "auto"
          && Duration.lessThan(
            Duration.millis(nowMs - lastSaveSoundAtRef.current),
            AUTO_SAVE_SOUND_COOLDOWN,
          )
        ) {
          return;
        }

        const ready = await primeSaveAudio();
        if (!ready) {
          if (lastSaveVolSkipReasonRef.current !== "audio-not-ready") {
            console.info("🔇 Save vol skipped: audio-not-ready");
            lastSaveVolSkipReasonRef.current = "audio-not-ready";
          }
          return;
        }

        const synth = getSaveSynth();
        const now = Tone.now();
        synth.triggerAttackRelease("C4", "16n", now);
        synth.triggerAttackRelease("E4", "16n", now + 0.08);
        synth.triggerAttackRelease("G4", "8n", now + 0.16);
        lastSaveSoundAtRef.current = nowMs;
        lastSaveVolSkipReasonRef.current = null;
      } catch (error) {
        console.warn("⚠️ Save vol failed", error);
      }
    },
    [
      appSettings.masterAudioEnabled,
      appSettings.saveVolEnabled,
      appSettings.masterVolume,
      getSaveSynth,
      primeSaveAudio,
    ],
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
          teamOwnership: dbNode.team_ownership ?? null,
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id));

    const normalizedEdges = input.edges
      .map((edge) => {
        const edgeData = typeof edge.data === "object" && edge.data !== null
          ? (edge.data as { metadata?: unknown })
          : undefined;
        const metadataValue = edgeData?.metadata;
        const metadata = metadataValue === undefined || metadataValue === null
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

  const persistSingleSave = useCallback(
    async (request: C4SaveRequest): Promise<C4SaveSuccess> => {
      const mode = request.mode;
      const overriddenInput = saveInputOverridesByRequestIdRef.current.get(
        request.id,
      );
      saveInputOverridesByRequestIdRef.current.delete(request.id);
      const saveInput = overriddenInput ?? buildSaveInput();
      if (!saveInput) {
        if (mode === "manual") {
          console.warn("No diagram to save");
        }

        return {
          requestId: request.id,
          mode,
          saved: false,
          savedAt: null,
        };
      }

      const fingerprint = createSaveFingerprint(saveInput);
      if (mode === "auto" && fingerprint === lastPersistedFingerprintRef.current) {
        return {
          requestId: request.id,
          mode,
          saved: false,
          savedAt: null,
        };
      }

      send({ type: mode === "manual" ? "SAVE_DIAGRAM" : "AUTO_SAVE" });

      try {
        const saveResult = await runEffect(saveDiagram(saveInput));
        const savedAt = typeof saveResult === "object"
            && saveResult !== null
            && "savedAt" in saveResult
            && typeof saveResult.savedAt === "number"
          ? saveResult.savedAt
          : Date.now();

        lastPersistedFingerprintRef.current = fingerprint;
        seededDiagramIdRef.current = saveInput.id;
        send({ type: "SAVE_SUCCESS" });
        void playSaveVol(mode);
        if (mode === "manual") {
          console.log("✅ Saved diagram");
        }

        return {
          requestId: request.id,
          mode,
          saved: true,
          savedAt,
        };
      } catch (error) {
        // Effect's FiberFailure wraps the actual error — extract it for better diagnostics
        const causeMessage = typeof error === "object" && error !== null && "cause" in error
          ? String((error as { cause: unknown }).cause)
          : undefined;
        const errorMessage = error instanceof Error
          ? (causeMessage ? `${error.message} — ${causeMessage}` : error.message)
          : "Save failed";
        console.error(
          mode === "manual" ? "❌ Save failed:" : "❌ Auto-save failed:",
          error,
        );
        send({
          type: "SAVE_ERROR",
          error: errorMessage,
        });
        throw {
          requestId: request.id,
          message: errorMessage,
          cause: error,
        };
      }
    },
    [buildSaveInput, createSaveFingerprint, playSaveVol, runEffect, send],
  );

  const saveMachine = useMemo(
    () =>
      createC4SaveMachine({
        persistRequest: persistSingleSave,
      }),
    [persistSingleSave],
  );

  const [saveSnapshot, , saveActorRef] = useMachine(saveMachine);
  const sendSaveEvent = useCallback(
    (event: C4SaveMachineEvent) => {
      saveActorRef.send(event);
    },
    [saveActorRef],
  );

  const requestSave = useCallback(
    async (
      mode: C4SaveMode,
      options?: { overrideInput?: SaveDiagramPayload },
    ): Promise<boolean> => {
      const requestId = saveRequestCounterRef.current + 1;
      saveRequestCounterRef.current = requestId;
      if (options?.overrideInput) {
        saveInputOverridesByRequestIdRef.current.set(
          requestId,
          options.overrideInput,
        );
      }

      sendSaveEvent({
        type: "REQUEST_SAVE",
        request: {
          id: requestId,
          mode,
        },
      });

      try {
        const completed = await waitFor(
          saveActorRef,
          (snapshot) => snapshot.context.lastCompletedRequestId === requestId,
          { timeout: SAVE_REQUEST_TIMEOUT_MS },
        );
        saveInputOverridesByRequestIdRef.current.delete(requestId);

        return completed.context.lastCompletedOk;
      } catch (error) {
        saveInputOverridesByRequestIdRef.current.delete(requestId);
        console.error("❌ Save request timed out or was interrupted", error);
        send({
          type: "SAVE_ERROR",
          error: "Save request timed out before completion",
        });
        return false;
      }
    },
    [saveActorRef, send, sendSaveEvent],
  );

  const requestManualSave = useCallback(
    () => requestSave("manual"),
    [requestSave],
  );
  const requestAutoSave = useCallback(() => requestSave("auto"), [requestSave]);
  const handleBeforeNavigate = useCallback((didSave: boolean) => {
    pageHideSaveCompletedRef.current = didSave;
  }, []);

  const navigationMachineOptions = useMemo(
    () => ({
      saveOnNavigate: appSettings.saveOnNavigate,
      flushPendingInlineEdits,
      requestManualSave,
      beforeNavigate: handleBeforeNavigate,
    }),
    [
      appSettings.saveOnNavigate,
      flushPendingInlineEdits,
      handleBeforeNavigate,
      requestManualSave,
    ],
  );

  const { navigationTarget, navigateWithSave, handleNavigateWithSave } = useC4NavigationMachine(
    navigationMachineOptions,
  );

  const autosaveMachineOptions = useMemo(
    () => ({
      isSettingsLoading,
      autosaveEnabled: appSettings.autosaveEnabled,
      autosaveIntervalMs: appSettings.autosaveIntervalMs,
      currentDiagramId: state.context.currentDiagramId,
      diagramName: state.context.diagramName,
      diagramDescription: state.context.diagramDescription,
      nodes: state.context.nodes,
      edges: state.context.edges,
      requestAutoSave,
    }),
    [
      appSettings.autosaveEnabled,
      appSettings.autosaveIntervalMs,
      isSettingsLoading,
      requestAutoSave,
      state.context.currentDiagramId,
      state.context.diagramDescription,
      state.context.diagramName,
      state.context.edges,
      state.context.nodes,
    ],
  );

  const { cancelAutosave } = useC4AutosaveMachine(autosaveMachineOptions);

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
      sendSaveEvent({
        type: "SYNC_LAST_SAVED_AT",
        savedAt: diagram.savedAt ?? null,
      });
      saveInputOverridesByRequestIdRef.current.clear();
      sendSaveEvent({ type: "CLEAR_PENDING_REQUESTS" });
      cancelAutosave();
    },
    [cancelAutosave, createSaveFingerprint, sendSaveEvent],
  );

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
    await requestSave("manual");
  }, [flushPendingInlineEdits, primeSaveAudio, requestSave]);

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

  const handleApplyAzureSync = useCallback(
    async (dryRun: AzureSyncDryRunOutput) => {
      const currentDiagramId = state.context.currentDiagramId;
      if (!currentDiagramId) {
        throw new Error("No active diagram loaded for Azure sync apply.");
      }

      await flushPendingInlineEdits();

      const merged = mergeAzureMappedGraphIntoCanvas({
        nodes: state.context.nodes,
        edges: state.context.edges,
        mapped: dryRun.mapped,
        syncedAt: dryRun.snapshot.collectedAt,
      });

      const saveInput: SaveDiagramPayload = {
        id: currentDiagramId,
        name: state.context.diagramName,
        nodes: merged.nodes,
        edges: merged.edges,
      };

      if (state.context.diagramDescription) {
        saveInput.description = state.context.diagramDescription;
      }

      const loadEvent: Extract<CanvasEvent, { type: "LOAD_DIAGRAM_SUCCESS" }> = {
        type: "LOAD_DIAGRAM_SUCCESS",
        diagram: {
          id: currentDiagramId,
          name: state.context.diagramName,
          nodes: merged.nodes,
          edges: merged.edges,
          updatedAt: saveSnapshot.context.lastSavedAt
            ?? state.context.lastSaved
            ?? Date.now(),
          ...(state.context.diagramDescription
            ? { description: state.context.diagramDescription }
            : {}),
        },
      };
      send(loadEvent);

      const didSave = await requestSave("manual", {
        overrideInput: saveInput,
      });

      if (!didSave) {
        const saveError = saveActorRef.getSnapshot().context.errorMessage;
        const detail = saveError ?? "unknown cause (check browser console for ❌ Save failed log)";
        throw new Error(`Azure sync apply save failed: ${detail}`);
      }

      console.log(
        "☁️ Azure sync applied:",
        dryRun.result.runId,
        `nodes +${dryRun.result.delta.nodesToCreate} ~${dryRun.result.delta.nodesToUpdate} -${dryRun.result.delta.nodesToArchive}`,
        `edges +${dryRun.result.delta.edgesToCreate} ~${dryRun.result.delta.edgesToUpdate} -${dryRun.result.delta.edgesToArchive}`,
      );
    },
    [
      flushPendingInlineEdits,
      requestSave,
      saveSnapshot.context.lastSavedAt,
      send,
      state.context.currentDiagramId,
      state.context.diagramDescription,
      state.context.diagramName,
      state.context.edges,
      state.context.lastSaved,
      state.context.nodes,
    ],
  );

  const handleApplyOpyBoardAction = useCallback(
    async (action: OpyBoardAction): Promise<string> => {
      if (action.kind === "add-node") {
        send({
          type: "ADD_NODE_WITH_LABEL",
          nodeType: action.nodeType,
          label: action.label,
        });
        return `ACTION APPLIED:: ADD ${action.nodeType.toUpperCase()} "${action.label}"`;
      }

      if (action.kind === "apply-c4-proposal") {
        if (state.context.currentDomain !== "c4") {
          throw new Error("OPY proposal apply is currently available in C4 mode only.");
        }

        const currentDiagramId = state.context.currentDiagramId;
        if (!currentDiagramId) {
          throw new Error("No active diagram loaded for OPY proposal apply.");
        }

        await flushPendingInlineEdits();

        const currentBoardSummary = buildRigC4BoardSummary({
          domain: state.context.currentDomain,
          diagramId: currentDiagramId,
          diagramName: state.context.diagramName,
          nodes: state.context.nodes,
          edges: state.context.edges,
        });
        const groundedProposal = buildGroundedProposalDiff(action.proposal, currentBoardSummary);
        if (!groundedProposal) {
          throw new Error("Unable to ground the proposal against the current board.");
        }

        const summary = summarizeGroundedProposalDiff(groundedProposal);
        if (!summary.canApply) {
          throw new Error(
            `Proposal apply blocked by ambiguity (${summary.ambiguousNodes} node(s), ${summary.ambiguousEdges} edge(s)).`,
          );
        }

        if (!summary.hasChanges) {
          return "NO CHANGES APPLIED:: PROPOSAL ALREADY MATCHES THE CURRENT BOARD.";
        }

        let nextNodes = [...state.context.nodes];
        let nextEdges = [...state.context.edges];
        let nextNodeCounter = state.context.nodeCounter;
        const nodeIdByProposalKey = new Map<string, string>();

        for (const nodeDiff of groundedProposal.nodeDiffs) {
          if (nodeDiff.status === "existing") {
            const existingMatch = nodeDiff.matches[0];
            if (!existingMatch) {
              throw new Error(`Missing exact board match for proposal node ${nodeDiff.node.key}.`);
            }
            nodeIdByProposalKey.set(nodeDiff.node.key, existingMatch.id);
            continue;
          }

          if (nodeDiff.status !== "new") {
            throw new Error(`Proposal node ${nodeDiff.node.key} is not safe to apply.`);
          }

          const createdNode = Effect.runSync(
            NodeOps.createNode({
              type: nodeDiff.node.nodeType,
              label: nodeDiff.node.label,
              nodeCounter: nextNodeCounter,
              selectedNodeId: null,
              existingNodes: nextNodes,
            }),
          );

          const normalizedDescription = toNullableTrimmedString(nodeDiff.node.description) ?? "";
          if (normalizedDescription.length > 0) {
            createdNode.data = {
              ...(createdNode.data as NodeData),
              description: normalizedDescription,
            };
          }

          nextNodes = [...nextNodes, createdNode];
          nextNodeCounter += 1;
          nodeIdByProposalKey.set(nodeDiff.node.key, createdNode.id);
        }

        for (const edgeDiff of groundedProposal.edgeDiffs) {
          if (edgeDiff.status === "existing") {
            continue;
          }

          if (edgeDiff.status !== "new") {
            throw new Error(
              `Proposal edge ${edgeDiff.edge.sourceKey} -> ${edgeDiff.edge.targetKey} is not safe to apply.`,
            );
          }

          const sourceId = nodeIdByProposalKey.get(edgeDiff.edge.sourceKey);
          const targetId = nodeIdByProposalKey.get(edgeDiff.edge.targetKey);

          if (!sourceId || !targetId) {
            throw new Error(
              `Could not resolve edge endpoints for ${edgeDiff.edge.sourceKey} -> ${edgeDiff.edge.targetKey}.`,
            );
          }

          try {
            nextEdges = Effect.runSync(
              EdgeOps.addValidatedEdge(
                nextEdges,
                sourceId,
                targetId,
                edgeDiff.edge.label,
              ),
            );
          } catch (error) {
            throw new Error(
              `Failed to apply edge "${edgeDiff.edge.label}" (${edgeDiff.edge.sourceKey} -> ${edgeDiff.edge.targetKey}): ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }

        const saveInput: SaveDiagramPayload = {
          id: currentDiagramId,
          name: state.context.diagramName,
          nodes: nextNodes,
          edges: nextEdges,
        };

        if (state.context.diagramDescription) {
          saveInput.description = state.context.diagramDescription;
        }

        const loadEvent: Extract<CanvasEvent, { type: "LOAD_DIAGRAM_SUCCESS" }> = {
          type: "LOAD_DIAGRAM_SUCCESS",
          diagram: {
            id: currentDiagramId,
            name: state.context.diagramName,
            nodes: nextNodes,
            edges: nextEdges,
            updatedAt: saveSnapshot.context.lastSavedAt
              ?? state.context.lastSaved
              ?? Date.now(),
            ...(state.context.diagramDescription
              ? { description: state.context.diagramDescription }
              : {}),
          },
        };
        send(loadEvent);

        const didSave = await requestSave("manual", {
          overrideInput: saveInput,
        });

        if (!didSave) {
          const saveError = saveActorRef.getSnapshot().context.errorMessage;
          const detail = saveError ?? "unknown cause (check browser console for ❌ Save failed log)";
          throw new Error(`OPY proposal apply save failed: ${detail}`);
        }

        return `PROPOSAL APPLIED:: +${summary.newNodes} NODE(S) · +${summary.newEdges} EDGE(S) · REUSED ${summary.existingNodes} NODE(S) / ${summary.existingEdges} EDGE(S).`;
      }

      return "NO ACTION APPLIED.";
    },
    [
      flushPendingInlineEdits,
      requestSave,
      saveActorRef,
      saveSnapshot.context.lastSavedAt,
      send,
      state.context.currentDiagramId,
      state.context.currentDomain,
      state.context.diagramDescription,
      state.context.diagramName,
      state.context.edges,
      state.context.lastSaved,
      state.context.nodeCounter,
      state.context.nodes,
    ],
  );

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

  const normalizedTeamByNodeId = useMemo(() => {
    const teamByNodeId = new Map<string, string | null>();
    for (const node of state.context.nodes) {
      teamByNodeId.set(node.id, normalizeTeamOwnership(node.data?.teamOwnership));
    }
    return teamByNodeId;
  }, [state.context.nodes]);

  const teamDisplayByNormalized = useMemo(() => {
    const teams = new Map<string, string>();
    for (const node of state.context.nodes) {
      const rawOwnership = node.data?.teamOwnership;
      if (typeof rawOwnership !== "string") {
        continue;
      }
      const trimmed = rawOwnership.trim();
      if (trimmed.length === 0) {
        continue;
      }
      const normalized = trimmed.toLowerCase();
      if (!teams.has(normalized)) {
        teams.set(normalized, trimmed);
      }
    }
    return teams;
  }, [state.context.nodes]);

  useEffect(() => {
    const currentDiagramId = state.context.currentDiagramId;
    const discoveredTeams = Array.from(teamDisplayByNormalized.values());

    if (ownershipCatalogDiagramRef.current !== currentDiagramId) {
      ownershipCatalogDiagramRef.current = currentDiagramId;
      setOwnershipTeamCatalog(discoveredTeams);
      return;
    }

    setOwnershipTeamCatalog((existingCatalog) => {
      const merged = mergeOwnershipTeams(existingCatalog, discoveredTeams);
      return merged.length === existingCatalog.length
          && merged.every((value, index) => value === existingCatalog[index])
        ? existingCatalog
        : merged;
    });
  }, [
    state.context.currentDiagramId,
    teamDisplayByNormalized,
  ]);

  const ownershipTeamDisplayByNormalized = useMemo(() => {
    const mergedTeams = mergeOwnershipTeams(
      ownershipTeamCatalog,
      teamDisplayByNormalized.values(),
    );
    const teams = new Map<string, string>();
    for (const team of mergedTeams) {
      const normalized = normalizeTeamOwnership(team);
      if (!normalized) {
        continue;
      }
      if (!teams.has(normalized)) {
        teams.set(normalized, team.trim());
      }
    }
    return teams;
  }, [ownershipTeamCatalog, teamDisplayByNormalized]);

  const ownershipTeamOptions = useMemo<TacticalSelectOption[]>(() => {
    const dynamicTeams = Array.from(ownershipTeamDisplayByNormalized.entries())
      .sort(([teamA], [teamB]) => teamA.localeCompare(teamB))
      .map(([value, label]) => ({
        value,
        label: label.toUpperCase(),
      }));

    return [
      { value: OWNERSHIP_FILTER_ALL, label: "ALL TEAMS" },
      { value: OWNERSHIP_FILTER_UNASSIGNED, label: "UNASSIGNED" },
      ...dynamicTeams,
    ];
  }, [ownershipTeamDisplayByNormalized]);

  useEffect(() => {
    if (
      ownershipTeamFilter !== OWNERSHIP_FILTER_ALL
      && ownershipTeamFilter !== OWNERSHIP_FILTER_UNASSIGNED
      && !ownershipTeamDisplayByNormalized.has(ownershipTeamFilter)
    ) {
      setOwnershipTeamFilter(OWNERSHIP_FILTER_ALL);
    }
  }, [ownershipTeamDisplayByNormalized, ownershipTeamFilter]);

  const crossTeamEdgeCount = useMemo(() => {
    return state.context.edges.filter((edge: Edge) => {
      const sourceOwnership = normalizedTeamByNodeId.get(edge.source) ?? null;
      const targetOwnership = normalizedTeamByNodeId.get(edge.target) ?? null;
      return sourceOwnership !== targetOwnership
        && (sourceOwnership !== null || targetOwnership !== null);
    }).length;
  }, [normalizedTeamByNodeId, state.context.edges]);

  const unknownOwnershipCount = useMemo(() => {
    return state.context.nodes.filter(
      (node: Node<NodeData>) => (normalizedTeamByNodeId.get(node.id) ?? null) === null,
    ).length;
  }, [normalizedTeamByNodeId, state.context.nodes]);

  const filteredCanvas = useMemo(() => {
    if (!isOwnershipLensOpen) {
      return {
        nodes: enrichedNodes,
        edges: state.context.edges,
      };
    }

    const getEdgeOwnership = (edge: Edge): { source: string | null; target: string | null } => {
      const sourceOwnership = normalizedTeamByNodeId.get(edge.source) ?? null;
      const targetOwnership = normalizedTeamByNodeId.get(edge.target) ?? null;
      return { source: sourceOwnership, target: targetOwnership };
    };

    const isCrossTeamEdge = (edge: Edge): boolean => {
      const { source, target } = getEdgeOwnership(edge);
      return source !== target && (source !== null || target !== null);
    };

    const matchesSelectedTeam = (nodeId: string): boolean => {
      const ownership = normalizedTeamByNodeId.get(nodeId) ?? null;
      if (ownershipTeamFilter === OWNERSHIP_FILTER_ALL) {
        return true;
      }
      if (ownershipTeamFilter === OWNERSHIP_FILTER_UNASSIGNED) {
        return ownership === null;
      }
      return ownership === ownershipTeamFilter;
    };

    const edgeMatchesSelectedTeam = (edge: Edge): boolean => {
      if (ownershipTeamFilter === OWNERSHIP_FILTER_ALL) {
        return true;
      }

      const { source, target } = getEdgeOwnership(edge);
      if (ownershipTeamFilter === OWNERSHIP_FILTER_UNASSIGNED) {
        return source === null || target === null;
      }

      return source === ownershipTeamFilter || target === ownershipTeamFilter;
    };

    if (showCrossTeamOnly) {
      let candidateEdges = state.context.edges.filter(
        (edge: Edge) => isCrossTeamEdge(edge) && edgeMatchesSelectedTeam(edge),
      );

      if (showUnknownOwnershipOnly) {
        candidateEdges = candidateEdges.filter((edge: Edge) => {
          const { source, target } = getEdgeOwnership(edge);
          return source === null || target === null;
        });
      }

      const edgeNodeIds = new Set<string>();
      for (const edge of candidateEdges) {
        edgeNodeIds.add(edge.source);
        edgeNodeIds.add(edge.target);
      }

      return {
        nodes: enrichedNodes.filter((node: Node<NodeData>) => edgeNodeIds.has(node.id)),
        edges: candidateEdges,
      };
    }

    const candidateNodes = enrichedNodes.filter((node: Node<NodeData>) => {
      if (!matchesSelectedTeam(node.id)) {
        return false;
      }

      if (showUnknownOwnershipOnly) {
        return (normalizedTeamByNodeId.get(node.id) ?? null) === null;
      }

      return true;
    });

    const visibleNodeIds = new Set(candidateNodes.map((node: Node<NodeData>) => node.id));
    const candidateEdges = state.context.edges.filter(
      (edge: Edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
    );

    return {
      nodes: candidateNodes,
      edges: candidateEdges,
    };
  }, [
    enrichedNodes,
    normalizedTeamByNodeId,
    ownershipTeamFilter,
    showCrossTeamOnly,
    showUnknownOwnershipOnly,
    isOwnershipLensOpen,
    state.context.edges,
  ]);

  const isOwnershipLensAtDefault = ownershipTeamFilter === OWNERSHIP_FILTER_ALL
    && !showCrossTeamOnly
    && !showUnknownOwnershipOnly;
  const handleResetOwnershipLens = useCallback(() => {
    setOwnershipTeamFilter(OWNERSHIP_FILTER_ALL);
    setShowCrossTeamOnly(false);
    setShowUnknownOwnershipOnly(false);
  }, []);

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
      saveInputOverridesByRequestIdRef.current.clear();
      sendSaveEvent({ type: "CLEAR_PENDING_REQUESTS" });
      sendSaveEvent({ type: "SYNC_LAST_SAVED_AT", savedAt: null });
      cancelAutosave();
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
    saveInputOverridesByRequestIdRef.current.clear();
    sendSaveEvent({ type: "CLEAR_PENDING_REQUESTS" });
    cancelAutosave();
  }, [
    buildSaveInput,
    cancelAutosave,
    createSaveFingerprint,
    sendSaveEvent,
    state.context.currentDiagramId,
  ]);

  // Debounced autosave for meaningful persisted changes only.
  useEffect(() => {
    if (isSettingsLoading) {
      return;
    }

    if (settingsSeededRef.current) {
      return;
    }

    settingsSeededRef.current = true;
    if (state.context.animationsEnabled !== appSettings.animationsEnabled) {
      send({ type: "TOGGLE_ANIMATIONS" });
    }
  }, [
    appSettings.animationsEnabled,
    isSettingsLoading,
    send,
    state.context.animationsEnabled,
  ]);

  useEffect(() => {
    return () => {
      saveSynthRef.current?.dispose();
      saveSynthRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!navigationTarget) {
      pageHideSaveCompletedRef.current = false;
    }
  }, [navigationTarget]);

  useEffect(() => {
    const handlePageHide = () => {
      if (pageHideSaveCompletedRef.current || !appSettings.saveOnNavigate) {
        return;
      }
      void requestSave("manual");
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [appSettings.saveOnNavigate, requestSave]);

  const handleToggleAnimations = useCallback(() => {
    const nextAnimationsEnabled = !state.context.animationsEnabled;
    send({ type: "TOGGLE_ANIMATIONS" });
    if (!settingsV1Enabled) {
      return;
    }
    void runEffect(
      patchSettings({ animationsEnabled: nextAnimationsEnabled }),
    ).catch((error) => {
      console.warn("⚠️ Failed to persist animation preference", error);
    });
    if (
      nextAnimationsEnabled
      && appSettings.masterAudioEnabled
      && appSettings.saveVolEnabled
    ) {
      void primeSaveAudio();
    }
  }, [
    appSettings.masterAudioEnabled,
    appSettings.saveVolEnabled,
    primeSaveAudio,
    runEffect,
    send,
    settingsV1Enabled,
    state.context.animationsEnabled,
  ]);
  const saveVolStatus = useMemo(() => {
    if (!appSettings.masterAudioEnabled) {
      return {
        label: "VOL::OFF (MASTER)",
        hint: "Enable Master Audio in Settings > Audio",
      };
    }

    if (!appSettings.saveVolEnabled) {
      return {
        label: "VOL::OFF (GLOBAL)",
        hint: "Enable Save Vol in Settings > Audio",
      };
    }

    if (appSettings.masterVolume <= 0) {
      return {
        label: "VOL::MUTED (VOL 0)",
        hint: "Raise Master Volume above 0% in Settings > Audio",
      };
    }

    return {
      label: `VOL::ON (${Math.round(appSettings.masterVolume * 100)}%)`,
      hint: "Vol level is controlled by Settings > Audio Master Volume",
    };
  }, [
    appSettings.masterAudioEnabled,
    appSettings.masterVolume,
    appSettings.saveVolEnabled,
  ]);

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

  const handleCommandAddPerson = useCallback(() => {
    send({ type: "ADD_PERSON" });
  }, [send]);
  const handleCommandAddSystem = useCallback(() => {
    send({ type: "ADD_SYSTEM" });
  }, [send]);
  const handleCommandAddExternal = useCallback(() => {
    send({ type: "ADD_EXTERNAL_SYSTEM" });
  }, [send]);
  const handleCommandAddContainer = useCallback(() => {
    send({ type: "ADD_CONTAINER" });
  }, [send]);
  const handleCommandAddComponent = useCallback(() => {
    send({ type: "ADD_COMPONENT" });
  }, [send]);
  const handleCommandAutoLayout = useCallback(() => {
    handleAutoLayout("command");
  }, [handleAutoLayout]);
  const handleCommandAutoLayoutSelected = useCallback(() => {
    handleAutoLayoutSelected("command");
  }, [handleAutoLayoutSelected]);

  const commandsMachineOptions = useMemo(
    () => ({
      onSave: handleSave,
      onNewBoard: handleNewBoard,
      onAddPerson: handleCommandAddPerson,
      onAddSystem: handleCommandAddSystem,
      onAddExternal: handleCommandAddExternal,
      onAddContainer: handleCommandAddContainer,
      onAddComponent: handleCommandAddComponent,
      onAutoLayout: handleCommandAutoLayout,
      onAutoLayoutSelected: handleCommandAutoLayoutSelected,
    }),
    [
      handleCommandAddComponent,
      handleCommandAddContainer,
      handleCommandAddExternal,
      handleCommandAddPerson,
      handleCommandAddSystem,
      handleCommandAutoLayout,
      handleCommandAutoLayoutSelected,
      handleNewBoard,
      handleSave,
    ],
  );

  useC4CommandsMachine(commandsMachineOptions);

  // Get selected node object (cast to Node<NodeData> since our nodes always have NodeData)
  const selectedNode = (state.context.nodes.find(
    (n: { id: string }) => n.id === state.context.selectedNodeId,
  ) as Node<NodeData> | undefined) || null;
  const ownershipTeams = useMemo(
    () => Array.from(ownershipTeamDisplayByNormalized.values()),
    [ownershipTeamDisplayByNormalized],
  );

  const handleRegisterOwnershipTeam = useCallback(
    (team: string) => {
      const trimmed = team.trim();
      if (trimmed.length === 0) {
        return;
      }

      setOwnershipTeamCatalog((existingCatalog) => {
        const merged = mergeOwnershipTeams(existingCatalog, [trimmed]);
        return merged.length === existingCatalog.length
            && merged.every((value, index) => value === existingCatalog[index])
          ? existingCatalog
          : merged;
      });
    },
    [],
  );

  const handleRemoveOwnershipTeamFromBoard = useCallback(
    (team: string) => {
      const normalizedTarget = normalizeTeamOwnership(team);
      if (!normalizedTarget) {
        return;
      }

      setOwnershipTeamCatalog((existingCatalog) =>
        existingCatalog.filter(
          (entry) => normalizeTeamOwnership(entry) !== normalizedTarget,
        )
      );

      for (const node of state.context.nodes) {
        if (normalizeTeamOwnership(node.data?.teamOwnership) === normalizedTarget) {
          send({
            type: "UPDATE_NODE",
            nodeId: node.id,
            updates: { teamOwnership: "" },
          });
        }
      }
    },
    [send, state.context.nodes],
  );

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
  const rightTrack = !isCompactLayout && isDetailsOpen ? "minmax(340px, 420px)" : "0px";
  const rowTrack = isDataBarOpen ? "1fr auto" : "1fr";
  const canvasAmbientTone = useMemo<"c4" | "ddd" | "azure">(() => {
    if (isAzurePanelOpen) {
      return "azure";
    }
    return state.context.currentDomain === "ddd" ? "ddd" : "c4";
  }, [isAzurePanelOpen, state.context.currentDomain]);
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
  const opyBoardSummary = useMemo<RigC4BoardSummary | null>(() => {
    return buildRigC4BoardSummary({
      domain: state.context.currentDomain,
      diagramId: state.context.currentDiagramId,
      diagramName: state.context.diagramName,
      nodes: state.context.nodes,
      edges: state.context.edges,
    });
  }, [
    state.context.currentDiagramId,
    state.context.currentDomain,
    state.context.diagramName,
    state.context.edges,
    state.context.nodes,
  ]);
  const opyFlyoutDiagramName = useMemo(() => {
    const normalized = state.context.diagramName.trim();
    return normalized.length > 0 ? normalized : "UNTITLED BOARD";
  }, [state.context.diagramName]);
  const opyFlyoutDomainLabel = state.context.currentDomain.toUpperCase();
  const opyFlyoutStatsLabel = `NODES::${state.context.nodes.length} · EDGES::${state.context.edges.length}`;

  useEffect(() => {
    if (!isOpy9000Open || typeof window === "undefined") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) {
        return;
      }

      event.preventDefault();
      toggleOpyCopilot();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpy9000Open, toggleOpyCopilot]);

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
            <span className={styles.sidebarBrandActions}>
              <button
                type="button"
                className={`${styles.sidebarBrandAction} ${isAzurePanelOpen ? styles.sidebarBrandActionActive : ""}`}
                aria-label={isAzurePanelOpen ? "Hide Azure sync panel" : "Show Azure sync panel"}
                aria-pressed={isAzurePanelOpen}
                title={isAzurePanelOpen ? "Hide Azure sync panel" : "Show Azure sync panel"}
                onClick={toggleAzurePanel}
              >
                <CloudIcon size={16} weight="duotone" />
              </button>
              <button
                type="button"
                className={`${styles.sidebarBrandAction} ${isOwnershipLensOpen ? styles.sidebarBrandActionActive : ""}`}
                aria-label={isOwnershipLensOpen ? "Hide ownership lens panel" : "Show ownership lens panel"}
                aria-pressed={isOwnershipLensOpen}
                title={isOwnershipLensOpen ? "Hide ownership lens panel" : "Show ownership lens panel"}
                onClick={toggleOwnershipLens}
              >
                <UsersFourIcon size={16} weight="duotone" />
              </button>
              <button
                type="button"
                className={`${styles.sidebarBrandAction} ${isOpy9000Open ? styles.sidebarBrandActionActive : ""}`}
                aria-label={isOpy9000Open ? "Hide OPY Net assistant panel" : "Show OPY Net assistant panel"}
                aria-pressed={isOpy9000Open}
                title={isOpy9000Open ? "Hide OPY Net assistant panel" : "Show OPY Net assistant panel"}
                onClick={toggleOpyCopilot}
              >
                <RobotIcon size={16} weight="duotone" />
              </button>
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
            </span>
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
          {isOwnershipLensOpen && (
            <section className={styles.ownershipLensCard} aria-label="Ownership lens filters">
              <h3 className={styles.ownershipLensTitle}>OWNERSHIP LENS</h3>
              <p className={styles.ownershipLensHint}>
                Filter by team, isolate cross-team dependencies, and expose unknown ownership.
              </p>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="ownership-team-filter">
                  Team Filter
                </label>
                <TacticalSelect
                  id="ownership-team-filter"
                  ariaLabel="Filter nodes by team ownership"
                  value={ownershipTeamFilter}
                  options={ownershipTeamOptions}
                  onChange={setOwnershipTeamFilter}
                />
              </div>
              <div className={styles.ownershipLensToggleRow}>
                <button
                  type="button"
                  className={styles.ownershipLensToggleButton}
                  aria-pressed={showCrossTeamOnly}
                  onClick={() => setShowCrossTeamOnly((current) => !current)}
                >
                  CROSS-TEAM EDGES
                </button>
                <button
                  type="button"
                  className={styles.ownershipLensToggleButton}
                  aria-pressed={showUnknownOwnershipOnly}
                  onClick={() => setShowUnknownOwnershipOnly((current) => !current)}
                >
                  UNKNOWN OWNERSHIP
                </button>
              </div>
              <div className={styles.ownershipLensStats}>
                <span>{`VISIBLE::${filteredCanvas.nodes.length}N / ${filteredCanvas.edges.length}E`}</span>
                <span>{`TEAMS::${ownershipTeamDisplayByNormalized.size}`}</span>
                <span>{`CROSS-TEAM::${crossTeamEdgeCount}`}</span>
                <span>{`UNASSIGNED::${unknownOwnershipCount}`}</span>
              </div>
              <button
                type="button"
                className={styles.toolbarButton}
                onClick={handleResetOwnershipLens}
                disabled={isOwnershipLensAtDefault}
              >
                RESET LENS
              </button>
            </section>
          )}
          {isAzurePanelOpen && (
            <AzureSyncPanel
              nodes={state.context.nodes}
              edges={state.context.edges}
              diagramId={state.context.currentDiagramId}
              onApply={handleApplyAzureSync}
            />
          )}
          {state.context.currentDomain === "c4"
            ? (
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
                onSessionNameChange={(name) => send({ type: "UPDATE_SESSION_NAME", name })}
                onDiagramNameChange={(name) => send({ type: "UPDATE_DIAGRAM_NAME", name })}
                sessionName={state.context.sessionName}
                isSaving={state.context.isSaving}
                lastSaved={saveSnapshot.context.lastSavedAt ?? state.context.lastSaved}
                diagramName={state.context.diagramName}
                onToggleAnimations={handleToggleAnimations}
                animationsEnabled={state.context.animationsEnabled}
                saveError={state.context.saveError}
                saveVolStatusLabel={saveVolStatus.label}
                saveVolStatusHint={saveVolStatus.hint}
                {...(state.context.currentLayout && {
                  currentLayout: state.context.currentLayout,
                })}
              />
            )
            : (
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
                onSessionNameChange={(name) => send({ type: "UPDATE_SESSION_NAME", name })}
                onDiagramNameChange={(name) => send({ type: "UPDATE_DIAGRAM_NAME", name })}
                sessionName={state.context.sessionName}
                isSaving={state.context.isSaving}
                lastSaved={saveSnapshot.context.lastSavedAt ?? state.context.lastSaved}
                diagramName={state.context.diagramName}
                onToggleAnimations={handleToggleAnimations}
                animationsEnabled={state.context.animationsEnabled}
                saveError={state.context.saveError}
                saveVolStatusLabel={saveVolStatus.label}
                saveVolStatusHint={saveVolStatus.hint}
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
          nodes={filteredCanvas.nodes}
          edges={filteredCanvas.edges}
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
          onImportDiagram={(content, format, mode) => send({ type: "IMPORT_DIAGRAM", content, format, mode })}
          viewportToApply={state.context.viewport}
          onContextMenuAction={onContextMenuAction}
          animationsEnabled={state.context.animationsEnabled}
          ambientTone={canvasAmbientTone}
        />
        {!isOpy9000Open && (
          <button
            type="button"
            className={styles.opyFlyoutLauncher}
            aria-label="Open OPY Net console"
            onClick={toggleOpyCopilot}
          >
            <RobotIcon size={16} weight="duotone" />
            OPY NET
          </button>
        )}
        {isOpy9000Open && (
          <section className={styles.opyFlyoutPanel} aria-label="OPY Net assistant console" role="dialog">
            <header className={styles.opyFlyoutHeader}>
              <div className={styles.opyFlyoutIdentity}>
                <h3 className={styles.ownershipLensTitle}>
                  <span className={styles.opyHeaderRow}>
                    <OpyAvatar />
                    <span>OPY NET::UNSHACKLED</span>
                  </span>
                </h3>
                <p className={styles.opyFlyoutMeta}>
                  {`${opyFlyoutDomainLabel} BOARD · ${opyFlyoutDiagramName}`}
                </p>
                <p className={styles.opyFlyoutMeta}>
                  {opyFlyoutStatsLabel}
                </p>
              </div>
              <div className={styles.opyFlyoutMenu}>
                <span className={styles.opyFlyoutPill}>SCOPED TO CURRENT BOARD</span>
                <button
                  type="button"
                  className={styles.opyFlyoutMenuButton}
                  onClick={() => {
                    void navigateWithSave("/settings");
                  }}
                >
                  AI SETTINGS
                </button>
                <button
                  type="button"
                  className={styles.collapseToggle}
                  onClick={toggleOpyCopilot}
                  aria-label="Close OPY Net console"
                >
                  <CaretRightIcon size={16} weight="bold" />
                  ESC
                </button>
              </div>
            </header>
            <div className={styles.opyFlyoutBody}>
              <OpyCopilotPanel
                domain={state.context.currentDomain}
                diagramId={state.context.currentDiagramId}
                diagramName={state.context.diagramName}
                nodeCount={state.context.nodes.length}
                edgeCount={state.context.edges.length}
                boardSummary={opyBoardSummary}
                actionMode={appSettings.aiSettings.actionMode}
                onApplyBoardAction={handleApplyOpyBoardAction}
                onOpenAiSettings={() => {
                  void navigateWithSave("/settings");
                }}
              />
            </div>
          </section>
        )}
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
            mudAlertThreshold={appSettings.bigBallOfMudAlertThreshold}
            isExplainabilityVisible={isCouplingExplainabilityVisible}
            onToggleExplainability={toggleCouplingExplainability}
          />
          <PropertiesPanel
            selectedNode={selectedNode}
            ownershipTeams={ownershipTeams}
            onRegisterOwnershipTeam={handleRegisterOwnershipTeam}
            onRemoveOwnershipTeamFromBoard={handleRemoveOwnershipTeamFromBoard}
            onUpdateNode={(nodeId, updates) => send({ type: "UPDATE_NODE", nodeId, updates })}
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
          <div
            className={styles.navigationOverlayCard}
            style={state.context.animationsEnabled
              ? undefined
              : { animation: "none" }}
          >
            <div
              className={styles.navigationOverlayScanline}
              aria-hidden="true"
              style={state.context.animationsEnabled
                ? undefined
                : { display: "none" }}
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
