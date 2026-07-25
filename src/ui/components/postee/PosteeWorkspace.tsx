/**
 * PosteeWorkspace - HTTP Client Workspace (Orchestrator)
 *
 * Orchestrates the Postee HTTP client workspace by:
 * - Managing XState machine state
 * - Coordinating extracted components (Sidebar, RequestBuilder, ResponsePanel, EnvironmentPanel)
 * - Handling layout and responsive behavior
 * - Dispatching events to the state machine
 */

import type { PosteeCollection, PosteeRequest } from "@/core/effects/database.postee";
import type { PosteeRequestDraft, PosteeScratchDraft } from "@/core/effects/postee";
import { CaretRightIcon } from "@phosphor-icons/react";
import { useMachine } from "@xstate/react";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolveActiveRequestDraft } from "@/core/effects/postee/active-request-draft";
import { parsePaneRatio, workspaceTemplateColumns } from "@/core/effects/postee/workspace-panes";
import { type PosteeRequestProposal, proposalToScratchDraft } from "@/core/effects/postee/agent-proposal";
import { buildPosteeAgentContext } from "@/core/effects/postee/agent-redaction";
import { proposePosteeRequest } from "@/core/effects/postee/agent-runtime";
import { markPosteeAgentProposalAccepted, recordPosteeAgentRun } from "@/core/effects/postee/agent-persistence";
import { ToggleButton } from "react-aria-components";
import { PaneDivider } from "./PaneDivider";
import { PosteeAgentDrawer } from "./PosteeAgentDrawer";
import {
  CollectionId as CollectionIdBrand,
  durationToMillis,
  EnvironmentId as EnvironmentIdBrand,
  type HttpMethod,
  RequestId as RequestIdBrand,
} from "../../../core/effects/postee/types";
import { useAppSettings } from "../../../core/effects/useAppSettings";
import {
  createPosteeWorkspaceMachine,
  type PosteeEvent,
  runLayeredEffect,
  type WorkspaceLayer,
} from "../../machines/postee.machine";
import { posteeUiMachine } from "../../machines/postee-ui.machine";
import { PosteeRequestBuilder } from "./PosteeRequestBuilder";
import { PosteeResponsePanel } from "./PosteeResponsePanel";
import { PosteeSidebar } from "./PosteeSidebar";
import { SaveScratchDialog } from "./SaveScratchDialog";
import { ScratchTabStrip } from "./ScratchTabStrip";
import { Tooltip } from "./Tooltip";

import * as layoutStyles from "../styles.css";
import * as styles from "./PosteeWorkspace.css";

const NAVIGATION_OVERLAY_MIN_DURATION_MS = 220;

const PANE_RATIO_KEY = "postee:pane-ratio";

export interface PosteeWorkspaceProps {
  /**
   * Services the workspace runs against. Defaults to the live layer; supplied by
   * tests so the workspace can be rendered at all — hard-wiring it here was why
   * nothing covered this component, and why a load test panel that could never
   * open reached a user (ADR-011 Phase 5).
   */
  readonly layer?: WorkspaceLayer;
}

export function PosteeWorkspace({ layer }: PosteeWorkspaceProps = {}) {
  const machine = useMemo(() => createPosteeWorkspaceMachine(layer ? { layer } : undefined), [layer]);
  const [state, send] = useMachine(machine);
  const { settings: appSettings } = useAppSettings();

  const {
    collections,
    requestsByCollection,
    requestDrafts,
    requestDraftSave,
    scratchDrafts = {},
    openScratchIds = [],
    closedScratchIds = [],
    activeEditor = null,
    scratchPromotion = { status: "idle" as const, scratchId: null, collectionId: null, error: null },
    graphqlSchema,
    activeCollectionId,
    activeRequestId,
    activeEnvironmentId,
    environments,
    variablesByEnvironment,
    runner,
    history,
    uiFlags,
    workspaceState,
    requestStatuses,
  } = state.context;

  // Extract UI state from machine
  const { isSidebarOpen, showDiff } = uiFlags;

  const [isSaveScratchDialogOpen, setIsSaveScratchDialogOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  // The proposal currently on screen, so accepting it can be linked to its draft.
  const lastProposalIdRef = useRef<string | null>(null);

  // Layout is a set of states, not a set of flags (ADR-011). The ratio is a
  // preference rather than workspace data, so it is restored from local storage
  // rather than the database — read lazily so the first paint has the stored split.
  const [uiState, sendUi] = useMachine(posteeUiMachine, {
    input: {
      paneRatio: parsePaneRatio(
        typeof window === "undefined" ? null : window.localStorage.getItem(PANE_RATIO_KEY),
      ),
    },
  });
  const isResponsePanelOpen = uiState.matches({ responsePane: "open" });
  const isHistoryDrawerOpen = uiState.matches({ historyDrawer: "open" });
  const isAgentDrawerOpen = uiState.matches({ agentDrawer: "open" });
  const activeResponseTab = uiState.matches({ responseTab: "loadTest" }) ? "LoadTest" as const : "Execution" as const;
  const paneRatio = uiState.context.paneRatio;
  const setPaneRatio = useCallback((ratio: number) => sendUi({ type: "SET_PANE_RATIO", ratio }), [sendUi]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PANE_RATIO_KEY, String(paneRatio));
  }, [paneRatio]);

  // Extract derived workspace state from machine
  const {
    statusLabel,
    activeCollectionKey,
    selectedRequest,
    canRunRequest,
    lastError,
  } = workspaceState;

  // State matches for conditions
  const isInitialising = state.matches("initialising");
  const isRunning = state.matches({ ready: "running" });

  // Additional derived state (not in machine)
  const lastResponse = runner.response;
  const lastResponseDurationMs = lastResponse ? durationToMillis(lastResponse.duration) : null;
  const activeScratchDraft = activeEditor?.kind === "scratch"
    ? scratchDrafts[activeEditor.scratchId] ?? null
    : null;
  const hasActiveEditorState = "activeEditor" in state.context;
  const activeSavedRequest = activeEditor?.kind === "saved" || !hasActiveEditorState
    ? selectedRequest
    : null;
  // Falls back to the active scratch, so anything gated on a draft — the load test
  // panel in particular — works without a saved request.
  const selectedRequestDraft = resolveActiveRequestDraft(
    activeSavedRequest,
    requestDrafts,
    activeScratchDraft,
  );

  const currentEnvironmentId = activeEnvironmentId
    ? (activeEnvironmentId as unknown as string)
    : environments[0]?.id ?? "";

  const currentVariables = currentEnvironmentId
    ? variablesByEnvironment[currentEnvironmentId] ?? []
    : [];

  const [navigationTarget, setNavigationTarget] = useState<string | null>(null);

  // A finished request is worth looking at: show execution, opening the pane if the
  // user had collapsed it.
  useEffect(() => {
    if (lastResponse || lastError) {
      sendUi({ type: "SELECT_RESPONSE_TAB", tab: "execution" });
    }
  }, [lastResponse, lastError, sendUi]);

  useEffect(() => {
    if (isSaveScratchDialogOpen && activeScratchDraft === null && scratchPromotion.status === "idle") {
      setIsSaveScratchDialogOpen(false);
    }
  }, [activeScratchDraft, isSaveScratchDialogOpen, scratchPromotion.status]);

  // UI toggle callbacks
  const handleToggleSidebar = useCallback(() => {
    send({ type: "UI_TOGGLE_SIDEBAR" });
  }, [send]);

  const handleToggleResponse = useCallback(() => {
    sendUi({ type: "TOGGLE_RESPONSE" });
  }, [sendUi]);

  const handleToggleDiff = useCallback(() => {
    send({ type: "UI_TOGGLE_DIFF" });
  }, [send]);

  // Opening the pane when a tab is chosen is the machine's rule now, not this
  // handler's responsibility to remember.
  const handleLoadTestToggle = useCallback((selected: boolean) => {
    sendUi({ type: "SELECT_RESPONSE_TAB", tab: selected ? "loadTest" : "execution" });
  }, [sendUi]);

  // History overlays now, so opening it no longer disturbs the response pane.
  const handleHistoryToggle = useCallback((selected: boolean) => {
    sendUi({ type: selected ? "OPEN_HISTORY" : "CLOSE_HISTORY" });
  }, [sendUi]);
  const handleCloseHistory = useCallback(() => sendUi({ type: "CLOSE_HISTORY" }), [sendUi]);
  const handleOpenAgent = useCallback(() => sendUi({ type: "OPEN_AGENT" }), [sendUi]);
  const handleCloseAgent = useCallback(() => sendUi({ type: "CLOSE_AGENT" }), [sendUi]);

  // The agent proposes; accepting is the operator opening a tab (ADR-012).
  const handleAcceptProposal = useCallback((proposal: PosteeRequestProposal) => {
    const draft = proposalToScratchDraft(proposal, {
      id: nanoid(),
      tabOrder: openScratchIds.length,
      now: Date.now(),
    });
    send({ type: "CREATE_SCRATCH" } satisfies PosteeEvent);
    send({ type: "UPDATE_SCRATCH_DRAFT", draft } satisfies PosteeEvent);
    sendUi({ type: "CLOSE_AGENT" });

    const proposalId = lastProposalIdRef.current;
    if (proposalId !== null) {
      runLayeredEffect(state.context.layer, markPosteeAgentProposalAccepted(proposalId, draft.id, Date.now()))
        .catch((cause: unknown) => {
          console.error("[postee][agent] Failed to mark proposal accepted:", cause);
        });
    }
  }, [openScratchIds.length, send, sendUi, state.context.layer]);

  const handleProposeRequest = useCallback(
    async (input: { readonly description: string; readonly includeBodies: boolean }) => {
      const agentContext = buildPosteeAgentContext(
        {
          request: {
            name: activeScratchDraft?.name ?? "",
            method: activeScratchDraft?.method ?? "GET",
            url: activeScratchDraft?.url ?? "",
            headers: activeScratchDraft?.headers ?? [],
            bodyMode: activeScratchDraft?.body.mode ?? "json",
            body: activeScratchDraft?.body.raw ?? null,
          },
          history: history.map((entry) => ({
            id: entry.id,
            requestName: entry.request_id ?? "",
            method: "",
            url: "",
            status: entry.response_status,
            durationMs: entry.response_time_ms,
            sizeBytes: entry.response_size_bytes,
            errorMessage: entry.error_message,
            executedAt: entry.executed_at,
            body: entry.response_body,
          })),
        },
        // strict is the default everywhere; bodies are the only per-run choice.
        { mode: "strict", includeHeaderValues: false, includeBodies: input.includeBodies },
      );

      const proposal = await proposePosteeRequest({
        description: input.description,
        context: agentContext,
      });

      // A run has to leave a trace: what was asked, what the boundary withheld, and
      // what came back. Recorded before the operator decides, so a proposal that is
      // never taken up is still visible (ADR-008 replayability, ADR-012).
      const proposalId = nanoid();
      lastProposalIdRef.current = proposalId;
      await runLayeredEffect(
        state.context.layer,
        recordPosteeAgentRun({
          runId: nanoid(),
          proposalId,
          description: input.description,
          model: proposal.model ?? "unknown",
          includeBodies: input.includeBodies,
          withheld: agentContext.withheld,
          usage: proposal.usage ?? { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          proposal,
          now: Date.now(),
        }),
      ).catch((cause: unknown) => {
        // Losing the audit row must not lose the operator their proposal.
        console.error("[postee][agent] Failed to record agent run:", cause);
      });

      return proposal;
    },
    [activeScratchDraft, history, state.context.layer],
  );

  // Sidebar handlers
  const handleCreateCollection = useCallback(
    (name: string) => {
      const id = nanoid();
      send(
        {
          type: "CREATE_COLLECTION",
          payload: {
            id: CollectionIdBrand(id),
            name,
          },
        } satisfies PosteeEvent,
      );
    },
    [send],
  );

  const handleSelectCollection = useCallback(
    (collectionId: string) => {
      send(
        {
          type: "SELECT_COLLECTION",
          collectionId: CollectionIdBrand(collectionId),
        } satisfies PosteeEvent,
      );
    },
    [send],
  );

  const handleSelectRequest = useCallback(
    (requestId: string) => {
      send(
        {
          type: "SELECT_REQUEST",
          requestId: RequestIdBrand(requestId),
        } satisfies PosteeEvent,
      );
    },
    [send],
  );

  const handleDeleteCollections = useCallback(
    (collectionIds: string[]) => {
      const payloadIds = collectionIds.map((id: string) => CollectionIdBrand(id));
      send({
        type: "DELETE_COLLECTIONS",
        payload: { ids: payloadIds },
      });
    },
    [send],
  );

  const handleRenameCollection = useCallback(
    (collectionId: string, newName: string) => {
      send({
        type: "RENAME_COLLECTION",
        payload: {
          id: CollectionIdBrand(collectionId),
          name: newName,
        },
      });
    },
    [send],
  );

  // RequestBuilder handlers
  const handleCreateRequest = useCallback(
    (method: HttpMethod, name: string, url: string) => {
      if (!activeCollectionKey) return;

      send(
        {
          type: "CREATE_REQUEST",
          payload: {
            collectionId: CollectionIdBrand(activeCollectionKey),
            id: RequestIdBrand(nanoid()),
            name,
            method,
            url,
          },
        } satisfies PosteeEvent,
      );
    },
    [activeCollectionKey, send],
  );

  const handleSaveRequestDraft = useCallback(
    (draft: PosteeRequestDraft) => {
      send(
        {
          type: "SAVE_REQUEST_DRAFT",
          draft,
        } satisfies PosteeEvent,
      );
    },
    [send],
  );

  const handleScratchDraftChange = useCallback((draft: PosteeScratchDraft) => {
    send({ type: "UPDATE_SCRATCH_DRAFT", draft } satisfies PosteeEvent);
  }, [send]);

  const handleCreateScratch = useCallback(() => {
    send({ type: "CREATE_SCRATCH" } satisfies PosteeEvent);
  }, [send]);

  const handleSelectScratch = useCallback((scratchId: string) => {
    send({ type: "SELECT_SCRATCH", scratchId } satisfies PosteeEvent);
  }, [send]);

  const handleCloseScratch = useCallback((scratchId: string) => {
    send({ type: "CLOSE_SCRATCH", scratchId } satisfies PosteeEvent);
  }, [send]);

  const handleReopenScratch = useCallback((scratchId: string) => {
    send({ type: "REOPEN_SCRATCH", scratchId } satisfies PosteeEvent);
  }, [send]);

  const handleSaveScratch = useCallback(() => {
    if (activeScratchDraft !== null) {
      setIsSaveScratchDialogOpen(true);
    }
  }, [activeScratchDraft]);

  const handlePromoteScratch = useCallback((collectionId: string) => {
    if (activeScratchDraft === null) return;
    send(
      {
        type: "PROMOTE_SCRATCH",
        scratchId: activeScratchDraft.id,
        collectionId: CollectionIdBrand(collectionId),
        requestId: RequestIdBrand(nanoid()),
      } satisfies PosteeEvent,
    );
  }, [activeScratchDraft, send]);

  const handleRunRequest = useCallback(() => {
    if ((activeScratchDraft === null && activeSavedRequest === null) || state.matches({ ready: "running" })) return;
    send({ type: "RUN_REQUEST" });
  }, [activeSavedRequest, activeScratchDraft, state, send]);

  const handleRefreshGraphqlSchema = useCallback(() => {
    send({ type: "REFRESH_GRAPHQL_SCHEMA" } satisfies PosteeEvent);
  }, [send]);

  const handleCancelRequest = useCallback(() => {
    if (!state.matches({ ready: "running" })) return;
    send({ type: "RUN_CANCEL" });
  }, [state, send]);

  // ResponsePanel handlers
  const handleSetBaseline = useCallback(() => {
    send({ type: "SET_BASELINE_RESPONSE" });
  }, [send]);

  const handleClearBaseline = useCallback(() => {
    send({ type: "CLEAR_BASELINE_RESPONSE" });
    if (showDiff) {
      send({ type: "UI_TOGGLE_DIFF" });
    }
  }, [send, showDiff]);

  // EnvironmentPanel handlers
  const handleCreateEnvironment = useCallback(
    (name: string) => {
      const id = nanoid();
      send(
        {
          type: "CREATE_ENVIRONMENT",
          payload: {
            id,
            name,
            description: null,
            is_default: environments.length === 0 ? 1 : 0,
          },
        } satisfies PosteeEvent,
      );
    },
    [environments.length, send],
  );

  const handleEnvironmentChange = useCallback(
    (environmentId: string) => {
      send({
        type: "SELECT_ENVIRONMENT",
        environmentId: environmentId as unknown as ReturnType<
          typeof EnvironmentIdBrand
        >,
      });
    },
    [send],
  );

  const handleVariablesChange = useCallback(
    (variables: typeof currentVariables) => {
      if (!currentEnvironmentId) return;

      send(
        {
          type: "UPDATE_ENVIRONMENT_VARIABLES",
          payload: {
            environmentId: currentEnvironmentId as unknown as ReturnType<
              typeof EnvironmentIdBrand
            >,
            variables,
          },
        } satisfies PosteeEvent,
      );
    },
    [currentEnvironmentId, send],
  );

  const navigateWithOverlay = useCallback((targetPath: string) => {
    const navigate = async () => {
      if (navigationTarget) {
        return;
      }

      setNavigationTarget(targetPath);

      // Ensure the transition overlay renders before navigating away.
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });

      if (appSettings.animationsEnabled) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, NAVIGATION_OVERLAY_MIN_DURATION_MS);
        });
      }

      window.location.assign(targetPath);
    };

    void navigate();
  }, [appSettings.animationsEnabled, navigationTarget]);

  const handleNavigateToBoard = useCallback(() => {
    navigateWithOverlay("/");
  }, [navigateWithOverlay]);

  const handleNavigateToSettings = useCallback(() => {
    navigateWithOverlay("/settings");
  }, [navigateWithOverlay]);

  const navigationLabel = useMemo(() => {
    switch (navigationTarget) {
      case "/":
        return "LOADING C4 BOARD";
      case "/settings":
        return "LOADING GLOBAL SETTINGS";
      default:
        return "LOADING NEXT WORKSPACE";
    }
  }, [navigationTarget]);

  // Layout calculations
  const leftTrack = isSidebarOpen ? "minmax(260px, 320px)" : "0px";
  const templateColumns = workspaceTemplateColumns(leftTrack, paneRatio, {
    responseOpen: isResponsePanelOpen,
  });
  const templateRows = "1fr";

  const responsePanelContent = (
    <PosteeResponsePanel
      isOpen={isResponsePanelOpen}
      onToggleOpen={handleToggleResponse}
      activeTab={activeResponseTab}
      isHistoryOpen={isHistoryDrawerOpen}
      onCloseHistory={handleCloseHistory}
      selectedRequestDraft={selectedRequestDraft}
      isRunning={isRunning}
      lastResponse={lastResponse}
      lastError={lastError}
      lastResponseDurationMs={lastResponseDurationMs}
      baselineResponse={runner.baselineResponse ?? null}
      history={history}
      showDiff={showDiff}
      onSetBaseline={handleSetBaseline}
      onClearBaseline={handleClearBaseline}
      onToggleDiff={handleToggleDiff}
      masterAudioEnabled={appSettings.masterAudioEnabled}
      masterVolume={appSettings.masterVolume}
      sirenEnabledDefault={appSettings.sirenEnabledDefault}
      animationsEnabled={appSettings.animationsEnabled}
    />
  );

  return (
    <div
      className={styles.workspace}
      ref={shellRef}
      style={{
        gridTemplateColumns: templateColumns,
        gridTemplateRows: templateRows,
      }}
    >
      {isSidebarOpen && (
        <PosteeSidebar
          collections={collections as PosteeCollection[]}
          requestsByCollection={requestsByCollection as Record<string, PosteeRequest[]>}
          requestStatuses={requestStatuses}
          activeCollectionId={activeCollectionId}
          activeRequestId={activeRequestId}
          isAgentOpen={isAgentDrawerOpen}
          onToggleAgent={isAgentDrawerOpen ? handleCloseAgent : handleOpenAgent}
          onCreateCollection={handleCreateCollection}
          onSelectCollection={handleSelectCollection}
          onSelectRequest={handleSelectRequest}
          onDeleteCollections={handleDeleteCollections}
          onRenameCollection={handleRenameCollection}
          onToggleSidebar={handleToggleSidebar}
          onNavigateToBoard={handleNavigateToBoard}
          onNavigateToSettings={handleNavigateToSettings}
        />
      )}

      <main className={styles.mainColumn} aria-label="Request builder">
        <header className={styles.mainHeader}>
          <div className={styles.mainHeaderTitle}>
            {!isSidebarOpen && (
              <ToggleButton
                isSelected={isSidebarOpen}
                onChange={handleToggleSidebar}
                className={layoutStyles.collapseToggle}
                aria-label="Expand collections panel"
              >
                <CaretRightIcon size={16} weight="bold" />
              </ToggleButton>
            )}
            <h1>Request Builder</h1>
            <span className={styles.statusPill}>{statusLabel}</span>
          </div>
          <div className={styles.mainHeaderActions}>
            <Tooltip content={isResponsePanelOpen ? "Hide response panel" : "Show response panel"}>
              <ToggleButton
                isSelected={isResponsePanelOpen}
                onChange={handleToggleResponse}
                className={layoutStyles.collapseToggle}
                aria-label={isResponsePanelOpen ? "Hide response panel" : "Show response panel"}
              >
                <CaretRightIcon size={16} weight="bold" />
                Response
              </ToggleButton>
            </Tooltip>
            <Tooltip
              content={selectedRequestDraft ? "View load testing panel" : "Select or start a request first"}
            >
              <ToggleButton
                isSelected={activeResponseTab === "LoadTest"}
                onChange={handleLoadTestToggle}
                className={layoutStyles.collapseToggle}
                // A scratch is a request too — gating on a saved one left this
                // permanently disabled in a workspace with no collections.
                isDisabled={selectedRequestDraft === null}
                aria-label="Open load test panel"
              >
                <CaretRightIcon size={16} weight="bold" />
                Load Test
              </ToggleButton>
            </Tooltip>
            <Tooltip content="View execution history">
              <ToggleButton
                isSelected={isHistoryDrawerOpen}
                onChange={handleHistoryToggle}
                className={layoutStyles.collapseToggle}
                aria-label="Open history panel"
              >
                <CaretRightIcon size={16} weight="bold" />
                History
              </ToggleButton>
            </Tooltip>
          </div>
        </header>

        <div className={styles.scratchBar}>
          <ScratchTabStrip
            tabs={openScratchIds.map((id) => ({
              id,
              label: scratchDrafts[id]?.name ?? "Untitled request",
              dirty: false,
            }))}
            activeId={activeEditor?.kind === "scratch" ? activeEditor.scratchId : null}
            reopenable={closedScratchIds.map((id) => ({
              id,
              label: scratchDrafts[id]?.name ?? "Untitled request",
            }))}
            onSelect={handleSelectScratch}
            onClose={handleCloseScratch}
            onReopen={handleReopenScratch}
          />
          <button type="button" className={styles.newScratchButton} onClick={handleCreateScratch}>
            New request
          </button>
        </div>

        <PosteeRequestBuilder
          activeCollectionId={activeScratchDraft === null ? activeCollectionKey : null}
          selectedRequest={activeSavedRequest}
          selectedRequestDraft={selectedRequestDraft}
          activeScratchDraft={activeScratchDraft}
          requestDraftSave={requestDraftSave}
          graphqlSchemaState={graphqlSchema}
          isInitialising={isInitialising}
          isRunning={isRunning}
          canRunRequest={activeScratchDraft !== null || canRunRequest}
          lastResponseStatus={lastResponse?.status}
          lastResponseDurationMs={lastResponseDurationMs}
          environments={environments}
          currentEnvironmentId={currentEnvironmentId}
          currentVariables={currentVariables}
          onCreateRequest={handleCreateRequest}
          onSaveRequestDraft={handleSaveRequestDraft}
          onScratchDraftChange={handleScratchDraftChange}
          onSaveScratch={handleSaveScratch}
          onRunRequest={handleRunRequest}
          onCancelRequest={handleCancelRequest}
          onCreateEnvironment={handleCreateEnvironment}
          onEnvironmentChange={handleEnvironmentChange}
          onVariablesChange={handleVariablesChange}
          onRefreshGraphqlSchema={handleRefreshGraphqlSchema}
        />

        <PosteeAgentDrawer
          isOpen={isAgentDrawerOpen}
          onClose={handleCloseAgent}
          onPropose={handleProposeRequest}
          onAcceptProposal={handleAcceptProposal}
        />

        <SaveScratchDialog
          isOpen={isSaveScratchDialogOpen}
          collections={collections}
          error={scratchPromotion.status === "error" ? scratchPromotion.error : null}
          isSaving={scratchPromotion.status === "promoting"}
          onClose={() => setIsSaveScratchDialogOpen(false)}
          onConfirm={handlePromoteScratch}
        />

      </main>
      {isResponsePanelOpen && (
        <>
          <PaneDivider ratio={paneRatio} onRatioChange={setPaneRatio} splitAreaRef={shellRef} />
          <section className={styles.responseColumn} aria-label="Response panel">
            {responsePanelContent}
          </section>
        </>
      )}
      {navigationTarget && (
        <div className={layoutStyles.navigationOverlay} role="status" aria-live="polite">
          <div
            className={layoutStyles.navigationOverlayCard}
            style={appSettings.animationsEnabled
              ? undefined
              : { animation: "none" }}
          >
            <div
              className={layoutStyles.navigationOverlayScanline}
              aria-hidden="true"
              style={appSettings.animationsEnabled
                ? undefined
                : { display: "none" }}
            />
            <h1 className={layoutStyles.navigationOverlayTitle}>
              OPSYDYN // PRECISION TOOLS
            </h1>
            <p className={layoutStyles.navigationOverlayStep}>SYNCING WORKSPACE STATE</p>
            <p className={layoutStyles.navigationOverlayTarget}>{navigationLabel}</p>
          </div>
        </div>
      )}
    </div>
  );
}
