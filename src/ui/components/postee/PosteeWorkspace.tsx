/**
 * PosteeWorkspace - HTTP Client Workspace (Orchestrator)
 *
 * Orchestrates the Postee HTTP client workspace by:
 * - Managing XState machine state
 * - Coordinating extracted components (Sidebar, RequestBuilder, ResponsePanel, EnvironmentPanel)
 * - Handling layout and responsive behavior
 * - Dispatching events to the state machine
 */

import { useMemo, useCallback, useEffect, useState } from "react";
import { useMachine } from "@xstate/react";
import { nanoid } from "nanoid";
import { ToggleButton } from "react-aria-components";
import { CaretRightIcon } from "@phosphor-icons/react";
import {
	createPosteeWorkspaceMachine,
	type PosteeEvent,
} from "../../machines/postee.machine";
import {
	CollectionId as CollectionIdBrand,
	RequestId as RequestIdBrand,
	EnvironmentId as EnvironmentIdBrand,
	type HttpMethod,
	durationToMillis,
} from "../../../core/effects/postee/types";
import { PosteeSidebar } from "./PosteeSidebar";
import { PosteeRequestBuilder } from "./PosteeRequestBuilder";
import { PosteeResponsePanel } from "./PosteeResponsePanel";
import { Tooltip } from "./Tooltip";
import type {
	PosteeCollection,
	PosteeRequest,
} from "@/core/effects/database.postee";

import * as styles from "./PosteeWorkspace.css";
import * as layoutStyles from "../styles.css";

export function PosteeWorkspace() {
	const machine = useMemo(() => createPosteeWorkspaceMachine(), []);
	const [state, send] = useMachine(machine);

	const {
		collections,
		requestsByCollection,
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

	// Active response tab state (local UI state, not in machine)
	const [activeResponseTab, setActiveResponseTab] = useState<"Execution" | "LoadTest" | "History">("Execution");

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

	const currentEnvironmentId = activeEnvironmentId
		? (activeEnvironmentId as unknown as string)
		: environments[0]?.id ?? "";

	const currentVariables = currentEnvironmentId
		? variablesByEnvironment[currentEnvironmentId] ?? []
		: [];

	// Local state for response panel toggle (replaces machine's isResponseOpen)
	const [isResponsePanelOpen, setIsResponsePanelOpen] = useState(true);

	// Auto-open response panel when request completes
	useEffect(() => {
		if (lastResponse || lastError) {
			setIsResponsePanelOpen(true);
			setActiveResponseTab("Execution");
		}
	}, [lastResponse, lastError]);

	// UI toggle callbacks
	const handleToggleSidebar = useCallback(() => {
		send({ type: "UI_TOGGLE_SIDEBAR" });
	}, [send]);

	const handleToggleResponse = useCallback(() => {
		setIsResponsePanelOpen((prev) => !prev);
	}, []);

	const handleToggleDiff = useCallback(() => {
		send({ type: "UI_TOGGLE_DIFF" });
	}, [send]);

	const handleLoadTestToggle = useCallback(
		(selected: boolean) => {
			if (!isResponsePanelOpen) {
				setIsResponsePanelOpen(true);
			}
			setActiveResponseTab(selected ? "LoadTest" : "Execution");
		},
		[isResponsePanelOpen],
	);

	// Sidebar handlers
	const handleCreateCollection = useCallback(
		(name: string) => {
			const id = nanoid();
			send({
				type: "CREATE_COLLECTION",
				payload: {
					id: CollectionIdBrand(id),
					name,
				},
			} satisfies PosteeEvent);
		},
		[send],
	);

	const handleSelectCollection = useCallback(
		(collectionId: string) => {
			send({
				type: "SELECT_COLLECTION",
				collectionId: CollectionIdBrand(collectionId),
			} satisfies PosteeEvent);
		},
		[send],
	);

	const handleSelectRequest = useCallback(
		(requestId: string) => {
			send({
				type: "SELECT_REQUEST",
				requestId: RequestIdBrand(requestId),
			} satisfies PosteeEvent);
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

			send({
				type: "CREATE_REQUEST",
				payload: {
					collectionId: CollectionIdBrand(activeCollectionKey),
					id: RequestIdBrand(nanoid()),
					name,
					method,
					url,
				},
			} satisfies PosteeEvent);
		},
		[activeCollectionKey, send],
	);

	const handleUpdateRequest = useCallback(
		(name: string, method: HttpMethod, url: string) => {
			if (!selectedRequest) return;

			send({
				type: "UPDATE_REQUEST_METADATA",
				payload: {
					id: RequestIdBrand(selectedRequest.id),
					name,
					method,
					url,
				},
			} satisfies PosteeEvent);
		},
		[selectedRequest, send],
	);

	const handleRunRequest = useCallback(() => {
		if (!selectedRequest || state.matches({ ready: "running" })) return;
		send({ type: "RUN_REQUEST" });
	}, [selectedRequest, state, send]);

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
			send({
				type: "CREATE_ENVIRONMENT",
				payload: {
					id,
					name,
					description: null,
					is_default: environments.length === 0 ? 1 : 0,
				},
			} satisfies PosteeEvent);
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

			send({
				type: "UPDATE_ENVIRONMENT_VARIABLES",
				payload: {
					environmentId: currentEnvironmentId as unknown as ReturnType<
						typeof EnvironmentIdBrand
					>,
					variables,
				},
			} satisfies PosteeEvent);
		},
		[currentEnvironmentId, send],
	);

	// Layout calculations
	const leftTrack = isSidebarOpen ? "minmax(260px, 320px)" : "0px";
	const templateColumns = `${leftTrack} 1fr`;
	const templateRows = "1fr";

	const responsePanelContent = (
		<PosteeResponsePanel
			isOpen={isResponsePanelOpen}
			onToggleOpen={handleToggleResponse}
			activeTab={activeResponseTab}
			onTabChange={setActiveResponseTab}
			selectedRequest={selectedRequest}
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
		/>
	);

	return (
		<div
			className={styles.workspace}
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
					onCreateCollection={handleCreateCollection}
					onSelectCollection={handleSelectCollection}
					onSelectRequest={handleSelectRequest}
					onDeleteCollections={handleDeleteCollections}
					onRenameCollection={handleRenameCollection}
					onToggleSidebar={handleToggleSidebar}
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
								aria-label={
									isResponsePanelOpen ? "Hide response panel" : "Show response panel"
								}
							>
								<CaretRightIcon size={16} weight="bold" />
								Response
							</ToggleButton>
						</Tooltip>
						<Tooltip content={selectedRequest ? "View load testing panel" : "Select a request first"}>
							<ToggleButton
								isSelected={activeResponseTab === "LoadTest"}
								onChange={handleLoadTestToggle}
								className={layoutStyles.collapseToggle}
								isDisabled={!selectedRequest}
								aria-label="Open load test panel"
							>
								<CaretRightIcon size={16} weight="bold" />
								Load Test
							</ToggleButton>
						</Tooltip>
					</div>
				</header>

				<PosteeRequestBuilder
					activeCollectionId={activeCollectionKey}
					selectedRequest={selectedRequest}
					isInitialising={isInitialising}
					isRunning={isRunning}
					canRunRequest={canRunRequest}
					lastResponseStatus={lastResponse?.status}
					lastResponseDurationMs={lastResponseDurationMs}
					environments={environments}
					currentEnvironmentId={currentEnvironmentId}
					currentVariables={currentVariables}
					onCreateRequest={handleCreateRequest}
					onUpdateRequest={handleUpdateRequest}
					onRunRequest={handleRunRequest}
					onCancelRequest={handleCancelRequest}
					onCreateEnvironment={handleCreateEnvironment}
					onEnvironmentChange={handleEnvironmentChange}
					onVariablesChange={handleVariablesChange}
				/>

				{isResponsePanelOpen && (
					<section className={styles.responseInline} aria-label="Response panel">
						{responsePanelContent}
					</section>
				)}
			</main>
		</div>
	);
}
