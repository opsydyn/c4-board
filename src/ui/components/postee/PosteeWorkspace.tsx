import {
	useMemo,
	useCallback,
	useState,
	useEffect,
	type FormEvent,
} from "react";
import { useMachine } from "@xstate/react";
import { nanoid } from "nanoid";
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
import { Select } from "./Select";
import { TabBar } from "./TabBar";
import { HeadersEditor, type Header } from "./HeadersEditor";
import { MonacoJsonEditor } from "./MonacoJsonEditor";
import { EnvironmentEditor } from "./EnvironmentEditor";
import { ResponseViewer } from "./ResponseViewer";
import {
	TabPanel,
	ToggleButton,
	Tree,
	TreeItem,
	TreeItemContent,
	Button,
} from "react-aria-components";
import type { Key, Selection } from "@react-types/shared";
import type {
	PosteeEnvironmentVariable,
	PosteeHistoryEntry,
} from "@/core/effects/database.postee";
import { LoadTestPanel } from "./LoadTestPanel";
import { PosteeHistoryTable } from "./PosteeHistoryTable";
import {
	CaretDownIcon,
	CaretLeftIcon,
	CaretRightIcon,
	CaretUpIcon,
	Folder,
	File,
	TrashSimple,
	PencilLine,
} from "@phosphor-icons/react";
import { InlineEditor } from "../nodes/InlineEditor";

import * as styles from "./PosteeWorkspace.css";
import * as layoutStyles from "../styles.css";

type RequestStatus = "success" | "error" | "unknown";

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
	} = state.context;

	const statusColors: Record<RequestStatus, string> = {
		success: "var(--icon-success, #4CC38A)",
		error: "var(--icon-error, #FF6B6B)",
		unknown: "var(--icon-neutral, #8FD6FF)",
	};

	const methodOptions: HttpMethod[] = [
		"GET",
		"POST",
		"PUT",
		"PATCH",
		"DELETE",
		"HEAD",
		"OPTIONS",
		"TRACE",
	];
 
	const [newCollectionName, setNewCollectionName] = useState("");
	const [newRequestName, setNewRequestName] = useState("");
	const [newRequestUrl, setNewRequestUrl] = useState("");
	const [newRequestMethod, setNewRequestMethod] = useState<HttpMethod>("GET");
	const [editRequestName, setEditRequestName] = useState("");
	const [editRequestUrl, setEditRequestUrl] = useState("");
	const [editRequestMethod, setEditRequestMethod] = useState<HttpMethod>("GET");

	// Request details state (headers, body, tabs)
	const [activeTab, setActiveTab] = useState<"Body" | "Headers">("Body");
	const [requestHeaders, setRequestHeaders] = useState<Header[]>([]);
	const [requestBody, setRequestBody] = useState<string>("{}");

	// Diff comparison state
	const [showDiff, setShowDiff] = useState(false);

	// Layout chrome state
	const [isSidebarOpen, setSidebarOpen] = useState(true);
	const [isResponseOpen, setResponseOpen] = useState(true);
	const [isEnvironmentOpen, setEnvironmentOpen] = useState(false);
	const [isCompactLayout, setCompactLayout] = useState(false);
	const [activeResponseTab, setActiveResponseTab] = useState<"Execution" | "LoadTest" | "History">("Execution");
	const [expandedKeys, setExpandedKeys] = useState<Set<Key> | "all">(
		() => new Set<Key>(),
	);
	const [selectedTreeKeys, setSelectedTreeKeys] = useState<Selection>(
		() => new Set<Key>(),
	);
	const [isRenamingCollectionId, setRenamingCollectionId] = useState<string | null>(null);
	const [newEnvironmentName, setNewEnvironmentName] = useState("");
	const [inspectedHistoryEntry, setInspectedHistoryEntry] = useState<PosteeHistoryEntry | null>(null);

	// Search state

	const activeCollectionKey = activeCollectionId
		? (activeCollectionId as unknown as string)
		: null;

	const handleCreateCollection = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			const trimmed = newCollectionName.trim();
			const name = trimmed.length > 0 ? trimmed : "Untitled Collection";
			const id = nanoid();

			send({
				type: "CREATE_COLLECTION",
				payload: {
					id: CollectionIdBrand(id),
					name,
				},
			} satisfies PosteeEvent);

			setNewCollectionName("");
		},
		[newCollectionName, send],
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

	const requestCollectionMap = useMemo(() => {
		const map = new Map<string, string>();
		for (const collection of collections) {
			for (const request of requestsByCollection[collection.id] ?? []) {
				map.set(request.id, collection.id);
			}
		}
		return map;
	}, [collections, requestsByCollection]);

	const handleTreeSelectionChange = useCallback(
		(keys: Selection) => {
			if (keys === "all") {
				setSelectedTreeKeys(keys);
				return;
			}

			setSelectedTreeKeys(keys);

			const iterator = keys.values();
			const first = iterator.next();
			if (first.done) {
				return;
			}

			const key = String(first.value);
			if (key.startsWith("collection:")) {
				const collectionId = key.replace("collection:", "");
				handleSelectCollection(collectionId);
				setRenamingCollectionId(null);
			} else if (key.startsWith("request:")) {
				const requestId = key.replace("request:", "");
				const collectionId = requestCollectionMap.get(requestId);
				if (collectionId && collectionId !== activeCollectionKey) {
					handleSelectCollection(collectionId);
				}
				handleSelectRequest(requestId);
				setRenamingCollectionId(null);
			}
		},
		[
			handleSelectCollection,
			handleSelectRequest,
			requestCollectionMap,
			activeCollectionKey,
		],
	);

	const handleExpandedChange = useCallback((keys: Iterable<Key> | "all") => {
		if (keys === "all") {
			setExpandedKeys("all");
			return;
		}

		setExpandedKeys(new Set(keys));
	}, []);

	const selectedCollectionIds = useMemo(() => {
		if (selectedTreeKeys === "all") {
			return collections.map((collection: { id: string }) => collection.id);
		}

		const ids: string[] = [];
		selectedTreeKeys.forEach((key) => {
			if (typeof key === "string" && key.startsWith("collection:")) {
				ids.push(key.replace("collection:", ""));
			}
		});
		return ids;
	}, [selectedTreeKeys, collections]);

	const canRenameCollection = selectedCollectionIds.length === 1;
	const canDeleteCollections = selectedCollectionIds.length > 0;
	const selectionCount = selectedCollectionIds.length;

	const handleStartRename = useCallback(() => {
		if (!canRenameCollection) {
			return;
		}

		const targetId = selectedCollectionIds[0];
		if (!targetId) {
			return;
		}

		setRenamingCollectionId(targetId);
	}, [canRenameCollection, selectedCollectionIds]);

	const handleRenameSave = useCallback(
		(collectionId: string, name: string) => {
			send({
				type: "RENAME_COLLECTION",
				payload: {
					id: CollectionIdBrand(collectionId),
					name,
				},
			});
			setRenamingCollectionId(null);
		},
		[send],
	);

	const handleRenameCancel = useCallback(() => {
		setRenamingCollectionId(null);
	}, []);

	useEffect(() => {
		if (
			isRenamingCollectionId &&
			(!canRenameCollection ||
				selectedCollectionIds[0] !== isRenamingCollectionId)
		) {
			setRenamingCollectionId(null);
		}
	}, [canRenameCollection, isRenamingCollectionId, selectedCollectionIds]);

	const handleDeleteCollections = useCallback(() => {
		if (!canDeleteCollections) {
			return;
		}

		const label =
			selectionCount === 1
				? "this collection"
				: `${selectionCount} collections`;
		const confirmed = window.confirm(
			`Delete ${label}? This will remove all nested requests and history.`,
		);
		if (!confirmed) {
			return;
		}

		const payloadIds = selectedCollectionIds.map((id: string) => CollectionIdBrand(id));
		send({
			type: "DELETE_COLLECTIONS",
			payload: { ids: payloadIds },
		});

		setSelectedTreeKeys(new Set<Key>());
		setRenamingCollectionId(null);
	}, [canDeleteCollections, selectionCount, selectedCollectionIds, send]);

	const handleLoadTestToggle = useCallback(
		(selected: boolean) => {
			setResponseOpen(true);
			setActiveResponseTab(selected ? "LoadTest" : "Execution");
		},
		[],
	);

	const handleCreateRequest = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (!activeCollectionKey) {
				return;
			}

			const name = newRequestName.trim() || "Untitled Request";
			const url = newRequestUrl.trim() || "/";

			send({
				type: "CREATE_REQUEST",
				payload: {
					collectionId: CollectionIdBrand(activeCollectionKey),
					id: RequestIdBrand(nanoid()),
					name,
					method: newRequestMethod,
					url,
				},
			} satisfies PosteeEvent);

			setNewRequestName("");
			setNewRequestUrl("");
			setNewRequestMethod("GET");
		},
		[
			activeCollectionKey,
			newRequestMethod,
			newRequestName,
			newRequestUrl,
			send,
		],
	);

	const requestStatusMap = useMemo(() => {
		const latestStatuses = new Map<
			string,
			{ status: RequestStatus; executedAt: number }
		>();

		for (const entry of history) {
			if (!entry.request_id) {
				continue;
			}

			const status: RequestStatus =
				entry.error_message ||
				(entry.response_status !== null && entry.response_status >= 400)
					? "error"
					: entry.response_status !== null
						? "success"
						: "unknown";

			const previous = latestStatuses.get(entry.request_id);
			if (!previous || entry.executed_at > previous.executedAt) {
				latestStatuses.set(entry.request_id, {
					status,
					executedAt: entry.executed_at,
				});
			}
		}

		return new Map(
			Array.from(latestStatuses.entries()).map(([key, value]) => [
				key,
				value.status,
			]),
		);
	}, [history]);

	const collectionStatusMap = useMemo(() => {
		const map = new Map<string, RequestStatus>();

		for (const collection of collections) {
			const requests = requestsByCollection[collection.id] ?? [];
			let collectionStatus: RequestStatus = "unknown";

			for (const request of requests) {
				const requestStatus = requestStatusMap.get(request.id) ?? "unknown";
				if (requestStatus === "error") {
					collectionStatus = "error";
					break;
				}
				if (requestStatus === "success" && collectionStatus === "unknown") {
					collectionStatus = "success";
				}
			}

			map.set(collection.id, collectionStatus);
		}

		return map;
	}, [collections, requestsByCollection, requestStatusMap]);

	const requestsForActiveCollection = activeCollectionKey
		? requestsByCollection[activeCollectionKey] ?? []
		: [];

	const selectedRequest = requestsForActiveCollection.find(
		(request: { id: string }) => request.id === (activeRequestId as unknown as string),
	);

const selectedTreeKey =
		activeRequestId !== null && activeRequestId !== undefined
			? `request:${activeRequestId as unknown as string}`
			: activeCollectionKey
				? `collection:${activeCollectionKey}`
				: null;

	const isInitialising = state.matches("initialising");
	const isRunning = state.matches({ ready: "running" });
	const isFailure = state.matches("failure");

	const statusLabel = (() => {
		if (isInitialising) return "Synchronising workspace";
		if (isRunning) return "Executing request";
		if (isFailure) return "Failed to load workspace";
		if (runner.status === "success") return "Last run succeeded";
		if (runner.status === "error") return "Last run errored";
		return "Idle";
	})();

	useEffect(() => {
		if (!selectedRequest) {
			setEditRequestName("");
			setEditRequestUrl("");
			setEditRequestMethod("GET");
			return;
		}

		setEditRequestName(selectedRequest.name);
		setEditRequestUrl(selectedRequest.url);
		setEditRequestMethod(selectedRequest.method as HttpMethod);
	}, [selectedRequest]);

	const handleUpdateRequest = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (!selectedRequest) {
				return;
			}

			const trimmedName = editRequestName.trim();
			const trimmedUrl = editRequestUrl.trim();
			if (!trimmedName || !trimmedUrl) {
				return;
			}

			send({
				type: "UPDATE_REQUEST_METADATA",
				payload: {
					id: RequestIdBrand(selectedRequest.id),
					name: trimmedName,
					method: editRequestMethod,
					url: trimmedUrl,
				},
			} satisfies PosteeEvent);
		},
		[editRequestMethod, editRequestName, editRequestUrl, selectedRequest, send],
	);

	const handleRunRequest = useCallback(() => {
		// Check state directly to avoid TDZ issues
		if (!selectedRequest || state.matches({ ready: "running" })) {
			return;
		}

		send({ type: "RUN_REQUEST" });
	}, [selectedRequest, state, send]);

	const handleCancelRequest = useCallback(() => {
		// Check state directly to avoid TDZ issues
		if (!state.matches({ ready: "running" })) {
			return;
		}

		send({ type: "RUN_CANCEL" });
	}, [state, send]);

	const currentEnvironmentId = activeEnvironmentId
		? (activeEnvironmentId as unknown as string)
		: environments[0]?.id ?? "";

	const currentVariables = currentEnvironmentId
		? variablesByEnvironment[currentEnvironmentId] ?? []
		: [];
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
		(variables: PosteeEnvironmentVariable[]) => {
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

	// Baseline comparison handlers
	const handleSetBaseline = useCallback(() => {
		send({ type: "SET_BASELINE_RESPONSE" });
	}, [send]);

	const handleClearBaseline = useCallback(() => {
		send({ type: "CLEAR_BASELINE_RESPONSE" });
		setShowDiff(false);
	}, [send]);

	const handleToggleDiff = useCallback(() => {
		setShowDiff((prev) => !prev);
	}, []);

	const handleCreateEnvironment = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			const name = newEnvironmentName.trim() || "Development";
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

			setNewEnvironmentName("");
		},
		[newEnvironmentName, send, environments.length],
	);

useEffect(() => {
	setSelectedTreeKeys((prev) => {
		if (prev === "all") {
			return prev;
		}
		if (prev.size > 1) {
			return prev;
		}

		if (!selectedTreeKey) {
			return prev.size === 0 ? prev : new Set<Key>();
		}

		if (prev.has(selectedTreeKey)) {
			return prev;
		}

		const next = new Set<Key>();
		next.add(selectedTreeKey);
		return next;
	});
}, [selectedTreeKey]);

useEffect(() => {
		if (
			inspectedHistoryEntry &&
			!history.some((entry: { id: string }) => entry.id === inspectedHistoryEntry.id)
		) {
			setInspectedHistoryEntry(null);
		}
	}, [history, inspectedHistoryEntry]);

	useEffect(() => {
		if (!activeCollectionKey) {
			return;
		}

		setExpandedKeys((prev) => {
			if (prev === "all") {
				return prev;
			}
			const treeKey = `collection:${activeCollectionKey}`;
			if (prev.has(treeKey)) {
				return prev;
			}
			const next = new Set(prev);
			next.add(treeKey);
			return next;
		});
	}, [activeCollectionKey]);

	useEffect(() => {
		if (typeof window === "undefined" || !window.matchMedia) {
			return;
		}

		const media = window.matchMedia("(max-width: 1360px)");
		const updateLayout = (matches: boolean) => {
			setCompactLayout(matches);
			if (matches) {
				setResponseOpen(false);
			}
		};

		updateLayout(media.matches);

		const listener = (event: MediaQueryListEvent) => updateLayout(event.matches);
		media.addEventListener("change", listener);
		return () => media.removeEventListener("change", listener);
	}, []);

	const handleInspectHistoryEntry = useCallback((entry: PosteeHistoryEntry) => {
		setInspectedHistoryEntry(entry);
	}, []);

	const inspectedHistoryResponse = useMemo(() => {
		if (!inspectedHistoryEntry) {
			return null;
		}

		const headers = (() => {
			const raw = inspectedHistoryEntry.response_headers;
			if (!raw) return undefined;
			if (typeof raw === "object") return raw as unknown as Record<string, string>;
			try {
				return JSON.parse(raw) as Record<string, string>;
			} catch {
				return raw;
			}
		})();

		const body =
			inspectedHistoryEntry.response_body ??
			inspectedHistoryEntry.error_message ??
			"";

		return {
			body,
			headers,
			status: inspectedHistoryEntry.response_status ?? undefined,
			statusText: inspectedHistoryEntry.error_message ?? undefined,
			duration: inspectedHistoryEntry.response_time_ms ?? undefined,
			size: inspectedHistoryEntry.response_size_bytes ?? undefined,
		};
	}, [inspectedHistoryEntry]);

	const clearInspectedHistoryEntry = useCallback(() => {
		setInspectedHistoryEntry(null);
	}, []);

	const canRunRequest = Boolean(selectedRequest) && !isInitialising && !isRunning;
	const lastResponse = runner.response;
	const lastError = runner.status === "error" ? runner.error ?? "Request failed" : null;
	const lastResponseDurationMs = lastResponse ? durationToMillis(lastResponse.duration) : null;

	const leftTrack = isSidebarOpen ? "minmax(260px, 320px)" : "0px";
	const rightTrackBase = "minmax(300px, 360px)";
	const rightTrack =
		!isCompactLayout && isResponseOpen ? rightTrackBase : "0px";
	const templateColumns = isCompactLayout
		? `${leftTrack} 1fr`
		: `${leftTrack} 1fr ${rightTrack}`;
	const templateRowsParts = ["minmax(0, 1fr)"];
	if (isCompactLayout && isResponseOpen) {
		templateRowsParts.push("auto");
	}
	if (isEnvironmentOpen) {
		templateRowsParts.push("auto");
	}
	const templateRows = templateRowsParts.join(" ");
	const isResponseDocked = isResponseOpen && !isCompactLayout;
	const responsePanelContent = (
		<>
				<div className={layoutStyles.panelHeader}>
				<ToggleButton
					isSelected={isResponseOpen}
					onChange={setResponseOpen}
					className={layoutStyles.collapseToggle}
					aria-label="Collapse response panel"
				>
					<CaretRightIcon size={16} weight="bold" />
					Hide
				</ToggleButton>
			</div>
				<TabBar
					tabs={[
						{ id: "Execution", label: "Execution" },
						{ id: "LoadTest", label: "Load Test" },
						{ id: "History", label: "History" },
					]}
					activeTab={activeResponseTab}
					onTabChange={(tab) => setActiveResponseTab(tab as "Execution" | "LoadTest" | "History")}
				>
				<TabPanel id="Execution" className={styles.responseTabContent}>
					<h2 className={styles.sectionTitle}>Execution</h2>
					{isRunning && (
						<div className={styles.panel}>
							<strong>Sending request…</strong>
							<span>The request is currently in-flight. You can cancel above.</span>
						</div>
					)}

					{lastResponse && (
						<ResponseViewer
							body={lastResponse.bodyText}
							headers={lastResponse.headers}
							status={lastResponse.status}
							statusText={lastResponse.statusText}
							{...(lastResponseDurationMs !== undefined && lastResponseDurationMs !== null && {
								duration: lastResponseDurationMs,
							})}
							size={Number(lastResponse.rawSize)}
							defaultExpanded
							baselineBody={runner.baselineResponse?.bodyText ?? null}
							showDiff={showDiff}
							onSetBaseline={handleSetBaseline}
							onClearBaseline={handleClearBaseline}
							onToggleDiff={handleToggleDiff}
						/>
					)}

					{lastError && (
						<div className={styles.panel}>
							<h3 className={styles.sectionTitle}>Last Error</h3>
					<pre className={styles.responseBody}>{lastError}</pre>
						</div>
					)}

				</TabPanel>
				<TabPanel id="LoadTest" className={styles.responseTabContent}>
					{selectedRequest && (
						<LoadTestPanel
							request={{
								id: selectedRequest.id,
								name: selectedRequest.name,
								method: selectedRequest.method,
								url: selectedRequest.url,
							}}
						/>
					)}
				</TabPanel>
				<TabPanel id="History" className={styles.responseTabContent}>
					<h2 className={styles.sectionTitle}>Execution History</h2>
					<PosteeHistoryTable history={history} onInspectEntry={handleInspectHistoryEntry} />

					{inspectedHistoryResponse && (
						<div className={styles.panel}>
							<div className={styles.historyDetailHeader}>
								<h2 className={styles.sectionTitle}>History Response</h2>
								<button
									type="button"
									className={styles.historyCloseButton}
									onClick={clearInspectedHistoryEntry}
								>
									Close
								</button>
							</div>
							<ResponseViewer
								body={inspectedHistoryResponse.body}
								{...(inspectedHistoryResponse.headers !== undefined && {
									headers: inspectedHistoryResponse.headers,
								})}
								{...(inspectedHistoryResponse.status !== undefined && {
									status: inspectedHistoryResponse.status,
								})}
								{...(inspectedHistoryResponse.statusText !== undefined && {
									statusText: inspectedHistoryResponse.statusText,
								})}
								{...(inspectedHistoryResponse.duration !== undefined && {
									duration: inspectedHistoryResponse.duration,
								})}
								{...(inspectedHistoryResponse.size !== undefined && {
									size: inspectedHistoryResponse.size,
								})}
								defaultExpanded
							/>
						</div>
					)}
				</TabPanel>
			</TabBar>
		</>
	);
	const responseInlineStyle = isResponseDocked
		? undefined
		: {
				gridColumn: "1 / -1",
		  };
	const environmentGridStyle = isEnvironmentOpen
		? {
				gridColumn: "1 / -1",
		  }
		: undefined;


	return (
		<div
			className={styles.workspace}
			style={{
				gridTemplateColumns: templateColumns,
				gridTemplateRows: templateRows,
			}}
		>
			{isSidebarOpen && (
				<aside className={styles.sidebar} aria-label="Collections panel">
				<div className={layoutStyles.panelHeader}>
						<ToggleButton
							isSelected={isSidebarOpen}
							onChange={setSidebarOpen}
							className={layoutStyles.collapseToggle}
							aria-label="Collapse collections panel"
						>
							<CaretLeftIcon size={16} weight="bold" />
							Hide
						</ToggleButton>
					</div>
					<header className={styles.branding}>
						<span>Postee Collections</span>
						<span>
							<a href="/">C4:BOARD</a>
						</span>
						<span>{collections.length}</span>
					</header>

				<form
					className={styles.collectionForm}
					onSubmit={handleCreateCollection}
				>
						<input
							className={styles.textInput}
							type="text"
							placeholder="New collection name"
							value={newCollectionName}
							onChange={(event) => setNewCollectionName(event.target.value)}
							aria-label="New collection name"
						/>
						<button
							className={styles.submitButton}
							type="submit"
							disabled={!newCollectionName.trim()}
						>
							Add Collection
						</button>
					</form>

				{selectionCount > 0 && (
					<div className={styles.selectionToolbar}>
							<span>
								{selectionCount} collection
								{selectionCount === 1 ? "" : "s"} selected
							</span>
							<div style={{ display: "flex", gap: "0.5rem" }}>
							<button
								type="button"
								className={styles.selectionToolbarButton}
									onClick={handleStartRename}
									disabled={!canRenameCollection}
									aria-label="Rename collection"
								>
									<PencilLine size={14} weight="bold" />
									<span>Rename</span>
								</button>
								<button
									type="button"
									className={styles.selectionToolbarButton}
									onClick={handleDeleteCollections}
									disabled={!canDeleteCollections}
									aria-label="Delete selected collections"
								>
									<TrashSimple size={14} weight="bold" />
									<span>
										Delete
										{selectionCount > 1 ? ` (${selectionCount})` : ""}
									</span>
								</button>
							</div>
						</div>
					)}

				<div className={styles.collectionList}>
						{collections.length === 0 ? (
							<div className={styles.emptyState}>
								<strong>No collections yet</strong>
								<span>Use the upcoming controls to create your first workspace.</span>
							</div>
						) : (
							<Tree
								aria-label="Postee collections"
								selectionMode="multiple"
								selectionBehavior="toggle"
								disallowEmptySelection={false}
								className={styles.collectionTree}
								selectedKeys={selectedTreeKeys}
								onSelectionChange={handleTreeSelectionChange}
								expandedKeys={expandedKeys}
								onExpandedChange={handleExpandedChange}
							>
								{collections.map((collection: { id: string; name: string }) => {
									const treeKey = `collection:${collection.id}`;
									const collectionRequests =
										requestsByCollection[collection.id] ?? [];
									const folderStatus =
										collectionStatusMap.get(collection.id) ?? "unknown";
									const folderColor = statusColors[folderStatus];
									return (
										<TreeItem
											key={treeKey}
											id={treeKey}
											textValue={collection.name}
											hasChildItems={collectionRequests.length > 0}
										>
											<TreeItemContent>
													{(itemProps) => (
														<div
															className={styles.treeCollectionRow}
															data-selected={itemProps.isSelected || undefined}
														>
															{collectionRequests.length > 0 ? (
																<Button
																	slot="chevron"
																	aria-label={
																		itemProps.isExpanded
																			? `Collapse ${collection.name}`
																			: `Expand ${collection.name}`
																	}
																	className={styles.treeChevronButton}
																	data-expanded={itemProps.isExpanded || undefined}
																>
																	<CaretRightIcon size={14} weight="bold" />
																</Button>
															) : (
																<span className={styles.treeChevronSpacer} aria-hidden="true" />
															)}
															<div className={styles.treeItemLabel}>
																<span className={styles.treeIcon}>
																	<Folder
																		size={18}
																		weight="duotone"
																		color={folderColor}
																	/>
																</span>
																<div className={styles.treeLabelContent}>
																	{isRenamingCollectionId === collection.id ? (
																		<InlineEditor
																			value={collection.name}
																			mode="plain"
																			placeholder="Collection name"
																			maxLength={120}
																			onSave={(value) =>
																				handleRenameSave(collection.id, value)
																			}
																			onCancel={handleRenameCancel}
																		/>
																	) : (
																		<button
																			type="button"
																			className={styles.treeNameButton}
																			onDoubleClick={(event) => {
																				event.stopPropagation();
																				setRenamingCollectionId(collection.id);
																			}}
																		>
																			{collection.name}
																		</button>
																	)}
																	<span className={styles.treeCountBadge}>
																		{collectionRequests.length}{" "}
																		{collectionRequests.length === 1
																			? "request"
																			: "requests"}
																	</span>
																</div>
														</div>
													</div>
												)}
											</TreeItemContent>
											{collectionRequests.map((request: { id: string; method: string; name: string }) => {
												const requestStatus =
													requestStatusMap.get(request.id) ?? "unknown";
												const requestColor =
													statusColors[requestStatus] ?? statusColors.unknown;
												return (
													<TreeItem
														key={`request:${request.id}`}
														id={`request:${request.id}`}
														textValue={`${request.method} ${request.name}`}
													>
														<TreeItemContent>
															{(itemProps) => (
																<div
																	className={styles.treeRequestRow}
																	data-selected={itemProps.isSelected || undefined}
																>
																	<span className={styles.treeIcon}>
																		<File
																			size={18}
																			weight="duotone"
																			color={requestColor}
																		/>
																	</span>
																	<span className={styles.treeMethodBadge}>
																		{request.method}
																	</span>
																	<span className={styles.treeRequestName}>
																		{request.name}
																	</span>
																</div>
															)}
														</TreeItemContent>
													</TreeItem>
												);
											})}
									</TreeItem>
								);
							})}
							</Tree>
						)}
					</div>
				</aside>
			)}

			<main className={styles.mainColumn} aria-label="Request builder">
				<header className={styles.mainHeader}>
					<div className={styles.mainHeaderTitle}>
						<h1>Request Builder</h1>
						<span className={styles.statusPill}>{statusLabel}</span>
					</div>
					<div className={styles.mainHeaderActions}>
						<ToggleButton
							isSelected={isResponseOpen}
							onChange={setResponseOpen}
							aria-label={
								isResponseOpen ? "Hide response panel" : "Show response panel"
							}
						>
							<CaretRightIcon size={16} weight="bold" />
							Response
						</ToggleButton>
						<ToggleButton
							isSelected={activeResponseTab === "LoadTest"}
							onChange={handleLoadTestToggle}
							disabled={!selectedRequest}
							aria-label="Open load test panel"
						>
							<CaretRightIcon size={16} weight="bold" />
							Load Test
						</ToggleButton>
						<ToggleButton
							isSelected={isEnvironmentOpen}
							onChange={setEnvironmentOpen}
							className={layoutStyles.collapseToggle}
							aria-label={
								isEnvironmentOpen
									? "Hide environment panel"
									: "Show environment panel"
							}
						>
							<CaretUpIcon size={16} weight="bold" />
							Environment
						</ToggleButton>
					</div>
				</header>

				<section className={styles.panel}>
					<h2 className={styles.sectionTitle}>Create HTTP Request</h2>
					<form className={styles.createForm} onSubmit={handleCreateRequest}>
						<Select
							value={newRequestMethod}
							options={methodOptions}
							onChange={setNewRequestMethod}
							disabled={!activeCollectionKey}
						/>
						<input
							className={styles.textInput}
							type="text"
							placeholder="Request name"
							value={newRequestName}
							onChange={(event) => setNewRequestName(event.target.value)}
							disabled={!activeCollectionKey}
							required
							aria-label="Request name"
						/>
						<input
							className={styles.textInput}
							type="url"
							placeholder="https://api.example.com/users"
							value={newRequestUrl}
							onChange={(event) => setNewRequestUrl(event.target.value)}
							disabled={!activeCollectionKey}
							required
							aria-label="Request URL"
						/>
						<button
							className={styles.submitButton}
							type="submit"
							disabled={
								!activeCollectionKey ||
								!newRequestName.trim() ||
								!newRequestUrl.trim()
							}
						>
							Add Request
						</button>
					</form>

					{!activeCollectionKey && (
						<div className={styles.emptyState}>
							<strong>Select a collection</strong>
							<span>
								Pick a collection on the left to add your first HTTP request.
							</span>
						</div>
					)}

					<h2 className={styles.sectionTitle}>Request Details</h2>
					{isInitialising && (
						<div className={styles.emptyState}>
							<strong>Loading workspace…</strong>
							<span>Fetching collections, requests, and environments.</span>
						</div>
					)}

					{!isInitialising && !selectedRequest && (
						<div className={styles.emptyState}>
							<strong>Select or create a request</strong>
							<span>
								Choose a collection and request on the left to start editing.
							</span>
						</div>
					)}

					{selectedRequest && (
						<form className={styles.createForm} onSubmit={handleUpdateRequest}>
							<Select
								value={editRequestMethod}
								options={methodOptions}
								onChange={setEditRequestMethod}
							/>
							<input
								className={styles.textInput}
								type="text"
								placeholder="Request name"
								value={editRequestName}
								onChange={(event) => setEditRequestName(event.target.value)}
								required
								aria-label="Selected request name"
							/>
							<input
								className={styles.textInput}
								type="url"
								placeholder="https://api.example.com/users"
								value={editRequestUrl}
								onChange={(event) => setEditRequestUrl(event.target.value)}
								required
								aria-label="Selected request URL"
							/>
							<button
								className={styles.submitButton}
								type="submit"
								disabled={!editRequestName.trim() || !editRequestUrl.trim()}
							>
								Save Changes
							</button>
						</form>
					)}
				</section>

				{selectedRequest && (
					<section className={styles.panel}>
						<TabBar
							tabs={["Body", "Headers"]}
							activeTab={activeTab}
							onTabChange={(tab) => setActiveTab(tab as "Body" | "Headers")}
						>
							<TabPanel id="Body" className={styles.tabContent}>
								<MonacoJsonEditor
									value={requestBody}
									onChange={setRequestBody}
									height="300px"
									placeholder="{}"
								/>
							</TabPanel>
							<TabPanel id="Headers" className={styles.tabContent}>
								<HeadersEditor
									headers={requestHeaders}
									onChange={setRequestHeaders}
								/>
							</TabPanel>
						</TabBar>
					</section>
				)}

				{selectedRequest && (
					<div className={styles.actionRow}>
						<button
							type="button"
							className={styles.runButton}
							onClick={handleRunRequest}
							disabled={!canRunRequest}
						>
							Send Request
						</button>
						<button
							type="button"
							className={styles.cancelButton}
							onClick={handleCancelRequest}
							disabled={!isRunning}
						>
							Cancel
						</button>
					</div>
				)}

				{!isSidebarOpen && (
					<ToggleButton
						isSelected={isSidebarOpen}
						onChange={setSidebarOpen}
						className={layoutStyles.collapseHandleLeft}
						aria-label="Expand collections panel"
					>
						<CaretRightIcon size={16} weight="bold" />
					</ToggleButton>
				)}

					{!isResponseDocked && !isCompactLayout && (
						<ToggleButton
							isSelected={isResponseOpen}
							onChange={setResponseOpen}
							className={layoutStyles.collapseHandleRight}
							aria-label="Expand response panel"
					>
						<CaretLeftIcon size={16} weight="bold" />
					</ToggleButton>
				)}

				{!isEnvironmentOpen && (
					<ToggleButton
						isSelected={isEnvironmentOpen}
						onChange={setEnvironmentOpen}
						className={layoutStyles.bottomHandle}
						aria-label="Expand environment panel"
					>
						<CaretUpIcon size={16} weight="bold" />
						Environment
					</ToggleButton>
				)}
			</main>

			{isResponseOpen &&
				(isResponseDocked ? (
					<aside className={styles.responseColumn} aria-label="Response panel">
						{responsePanelContent}
					</aside>
				) : (
					<section
						className={styles.responseInline}
						aria-label="Response panel"
						style={responseInlineStyle}
					>
						{responsePanelContent}
					</section>
				))}

			{isEnvironmentOpen && (
				<section
					className={layoutStyles.bottomPanel}
					aria-label="Environment panel"
					style={environmentGridStyle}
				>
					<div className={layoutStyles.bottomPanelHeader}>
						<h2 className={styles.sectionTitle}>Environment Variables</h2>
						<ToggleButton
							isSelected={isEnvironmentOpen}
							onChange={setEnvironmentOpen}
							className={layoutStyles.collapseToggle}
							aria-label="Collapse environment panel"
						>
							<CaretDownIcon size={16} weight="bold" />
							Hide
						</ToggleButton>
					</div>
					<div className={styles.environmentContent}>
						{environments.length === 0 ? (
							<div className={styles.environmentEmptyState}>
								<strong>No environments yet</strong>
								<span>
									Create your first environment to start managing environment
									variables (e.g., Development, Staging, Production).
								</span>
								<form
									className={styles.environmentForm}
									onSubmit={handleCreateEnvironment}
								>
									<input
										className={styles.textInput}
										type="text"
										placeholder="Environment name (e.g., Development)"
										value={newEnvironmentName}
										onChange={(event) => setNewEnvironmentName(event.target.value)}
										required
										aria-label="Environment name"
									/>
									<button className={styles.submitButton} type="submit">
										Create Environment
									</button>
								</form>
							</div>
						) : (
							<EnvironmentEditor
								environmentId={currentEnvironmentId}
								environments={environments.map((env: { id: string; name: string; is_default: number }) => ({
									id: env.id,
									name: env.name,
									is_default: env.is_default,
								}))}
								variables={currentVariables}
								onEnvironmentChange={handleEnvironmentChange}
								onVariablesChange={handleVariablesChange}
							/>
						)}
					</div>
				</section>
			)}
		</div>
	);
}
