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
	FolderSimple,
	FileText,
} from "@phosphor-icons/react";

import {
	workspace,
	sidebar,
	branding,
	collectionList,
	mainColumn,
	mainHeader,
	statusPill,
	panel,
	responseColumn,
	responseInline,
	sectionTitle,
	emptyState,
	collectionForm,
	createForm,
	textInput,
	submitButton,
	actionRow,
	runButton,
	cancelButton,
	responseBody,
	tabContent,
	collectionTree,
	treeCollectionRow,
	treeIcon,
	treeItemLabel,
	treeCountBadge,
	treeChevronButton,
	treeChevronSpacer,
	treeRequestRow,
	treeMethodBadge,
	treeRequestName,
	responseTabContent,
	historyDetailHeader,
	historyCloseButton,
	mainHeaderTitle,
	mainHeaderActions,
	environmentContent,
	environmentEmptyState,
	environmentForm,
} from "./PosteeWorkspace.css";
import {
	bottomHandle,
	bottomPanel,
	bottomPanelHeader,
	collapseHandleLeft,
	collapseHandleRight,
	collapseToggle,
	panelHeader,
} from "../styles.css";

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
	const [activeResponseTab, setActiveResponseTab] = useState<"Execution" | "LoadTest">("Execution");
	const [expandedKeys, setExpandedKeys] = useState<Set<Key> | "all">(
		() => new Set<Key>(),
	);
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
				return;
			}

			const iterator = keys.values();
			const first = iterator.next();
			if (first.done) {
				return;
			}

			const key = String(first.value);
			if (key.startsWith("collection:")) {
				const collectionId = key.replace("collection:", "");
				handleSelectCollection(collectionId);
			} else if (key.startsWith("request:")) {
				const requestId = key.replace("request:", "");
				const collectionId = requestCollectionMap.get(requestId);
				if (collectionId && collectionId !== activeCollectionKey) {
					handleSelectCollection(collectionId);
				}
				handleSelectRequest(requestId);
			}
		},
		[handleSelectCollection, handleSelectRequest, requestCollectionMap, activeCollectionKey],
	);

	const handleExpandedChange = useCallback((keys: Iterable<Key> | "all") => {
		if (keys === "all") {
			setExpandedKeys("all");
			return;
		}

		setExpandedKeys(new Set(keys));
	}, []);

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
		(request) => request.id === (activeRequestId as unknown as string),
	);

	const selectedTreeKey =
		activeRequestId !== null && activeRequestId !== undefined
			? `request:${activeRequestId as unknown as string}`
			: activeCollectionKey
				? `collection:${activeCollectionKey}`
				: null;

	const treeSelectedKeys = useMemo<Selection>(() => {
		if (!selectedTreeKey) {
			return new Set<Key>();
		}
		const selection = new Set<Key>();
		selection.add(selectedTreeKey);
		return selection;
	}, [selectedTreeKey]);

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
		if (
			inspectedHistoryEntry &&
			!history.some((entry) => entry.id === inspectedHistoryEntry.id)
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
			<div className={panelHeader}>
				<ToggleButton
					isSelected={isResponseOpen}
					onChange={setResponseOpen}
					className={collapseToggle}
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
				]}
				activeTab={activeResponseTab}
				onTabChange={(tab) => setActiveResponseTab(tab as "Execution" | "LoadTest")}
			>
				<TabPanel id="Execution" className={responseTabContent}>
					<h2 className={sectionTitle}>Execution</h2>
					{isRunning && (
						<div className={panel}>
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
							duration={lastResponseDurationMs ?? undefined}
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
						<div className={panel}>
							<h3 className={sectionTitle}>Last Error</h3>
							<pre className={responseBody}>{lastError}</pre>
						</div>
					)}

					<PosteeHistoryTable history={history} onInspectEntry={handleInspectHistoryEntry} />

					{inspectedHistoryResponse && (
						<div className={panel}>
							<div className={historyDetailHeader}>
								<h2 className={sectionTitle}>History Response</h2>
								<button
									type="button"
									className={historyCloseButton}
									onClick={clearInspectedHistoryEntry}
								>
									Close
								</button>
							</div>
							<ResponseViewer
								body={inspectedHistoryResponse.body}
								headers={inspectedHistoryResponse.headers}
								status={inspectedHistoryResponse.status}
								statusText={inspectedHistoryResponse.statusText}
								duration={inspectedHistoryResponse.duration}
								size={inspectedHistoryResponse.size}
								defaultExpanded
							/>
						</div>
					)}
				</TabPanel>
				<TabPanel id="LoadTest" className={responseTabContent}>
					<LoadTestPanel
						request={
							selectedRequest
								? {
										id: selectedRequest.id,
										name: selectedRequest.name,
										method: selectedRequest.method,
										url: selectedRequest.url,
								  }
								: undefined
						}
					/>
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
			className={workspace}
			style={{
				gridTemplateColumns: templateColumns,
				gridTemplateRows: templateRows,
			}}
		>
			{isSidebarOpen && (
				<aside className={sidebar} aria-label="Collections panel">
					<div className={panelHeader}>
						<ToggleButton
							isSelected={isSidebarOpen}
							onChange={setSidebarOpen}
							className={collapseToggle}
							aria-label="Collapse collections panel"
						>
							<CaretLeftIcon size={16} weight="bold" />
							Hide
						</ToggleButton>
					</div>
					<header className={branding}>
						<span>Postee Collections</span>
						<span>
							<a href="/">C4:BOARD</a>
						</span>
						<span>{collections.length}</span>
					</header>

					<form className={collectionForm} onSubmit={handleCreateCollection}>
						<input
							className={textInput}
							type="text"
							placeholder="New collection name"
							value={newCollectionName}
							onChange={(event) => setNewCollectionName(event.target.value)}
							aria-label="New collection name"
						/>
						<button
							className={submitButton}
							type="submit"
							disabled={!newCollectionName.trim()}
						>
							Add Collection
						</button>
					</form>

					<div className={collectionList}>
						{collections.length === 0 ? (
							<div className={emptyState}>
								<strong>No collections yet</strong>
								<span>Use the upcoming controls to create your first workspace.</span>
							</div>
						) : (
							<Tree
								aria-label="Postee collections"
								selectionMode="single"
								disallowEmptySelection
								className={collectionTree}
								selectedKeys={treeSelectedKeys}
								onSelectionChange={handleTreeSelectionChange}
								expandedKeys={expandedKeys}
								onExpandedChange={handleExpandedChange}
							>
								{collections.map((collection) => {
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
															className={treeCollectionRow}
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
																	className={treeChevronButton}
																	data-expanded={itemProps.isExpanded || undefined}
																>
																	<CaretRightIcon size={14} weight="bold" />
																</Button>
															) : (
																<span className={treeChevronSpacer} aria-hidden="true" />
															)}
															<div className={treeItemLabel}>
																<span className={treeIcon}>
																	<FolderSimple
																		size={18}
																		weight="duotone"
																		color={folderColor}
																	/>
																</span>
																<span>{collection.name}</span>
																<span className={treeCountBadge}>
																	{collectionRequests.length}{" "}
																	{collectionRequests.length === 1
																		? "request"
																		: "requests"}
															</span>
														</div>
													</div>
												)}
											</TreeItemContent>
											{collectionRequests.map((request) => {
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
																	className={treeRequestRow}
																	data-selected={itemProps.isSelected || undefined}
																>
																	<span className={treeIcon}>
																		<FileText
																			size={18}
																			weight="duotone"
																			color={requestColor}
																		/>
																	</span>
																	<span className={treeMethodBadge}>
																		{request.method}
																	</span>
																	<span className={treeRequestName}>
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

			<main className={mainColumn} aria-label="Request builder">
				<header className={mainHeader}>
					<div className={mainHeaderTitle}>
						<h1>Request Builder</h1>
						<span className={statusPill}>{statusLabel}</span>
					</div>
					<div className={mainHeaderActions}>
						<ToggleButton
							isSelected={isResponseOpen}
							onChange={setResponseOpen}
							className={collapseToggle}
							aria-label={
								isResponseOpen ? "Hide response panel" : "Show response panel"
							}
						>
							<CaretRightIcon size={16} weight="bold" />
							Response
						</ToggleButton>
						<ToggleButton
							isSelected={isEnvironmentOpen}
							onChange={setEnvironmentOpen}
							className={collapseToggle}
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

				<section className={panel}>
					<h2 className={sectionTitle}>Create HTTP Request</h2>
					<form className={createForm} onSubmit={handleCreateRequest}>
						<Select
							value={newRequestMethod}
							options={methodOptions}
							onChange={setNewRequestMethod}
							disabled={!activeCollectionKey}
						/>
						<input
							className={textInput}
							type="text"
							placeholder="Request name"
							value={newRequestName}
							onChange={(event) => setNewRequestName(event.target.value)}
							disabled={!activeCollectionKey}
							required
							aria-label="Request name"
						/>
						<input
							className={textInput}
							type="url"
							placeholder="https://api.example.com/users"
							value={newRequestUrl}
							onChange={(event) => setNewRequestUrl(event.target.value)}
							disabled={!activeCollectionKey}
							required
							aria-label="Request URL"
						/>
						<button
							className={submitButton}
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
						<div className={emptyState}>
							<strong>Select a collection</strong>
							<span>
								Pick a collection on the left to add your first HTTP request.
							</span>
						</div>
					)}

					<h2 className={sectionTitle}>Request Details</h2>
					{isInitialising && (
						<div className={emptyState}>
							<strong>Loading workspace…</strong>
							<span>Fetching collections, requests, and environments.</span>
						</div>
					)}

					{!isInitialising && !selectedRequest && (
						<div className={emptyState}>
							<strong>Select or create a request</strong>
							<span>
								Choose a collection and request on the left to start editing.
							</span>
						</div>
					)}

					{selectedRequest && (
						<form className={createForm} onSubmit={handleUpdateRequest}>
							<Select
								value={editRequestMethod}
								options={methodOptions}
								onChange={setEditRequestMethod}
							/>
							<input
								className={textInput}
								type="text"
								placeholder="Request name"
								value={editRequestName}
								onChange={(event) => setEditRequestName(event.target.value)}
								required
								aria-label="Selected request name"
							/>
							<input
								className={textInput}
								type="url"
								placeholder="https://api.example.com/users"
								value={editRequestUrl}
								onChange={(event) => setEditRequestUrl(event.target.value)}
								required
								aria-label="Selected request URL"
							/>
							<button
								className={submitButton}
								type="submit"
								disabled={!editRequestName.trim() || !editRequestUrl.trim()}
							>
								Save Changes
							</button>
						</form>
					)}
				</section>

				{selectedRequest && (
					<section className={panel}>
						<TabBar
							tabs={["Body", "Headers"]}
							activeTab={activeTab}
							onTabChange={(tab) => setActiveTab(tab as "Body" | "Headers")}
						>
							<TabPanel id="Body" className={tabContent}>
								<MonacoJsonEditor
									value={requestBody}
									onChange={setRequestBody}
									height="300px"
									placeholder="{}"
								/>
							</TabPanel>
							<TabPanel id="Headers" className={tabContent}>
								<HeadersEditor
									headers={requestHeaders}
									onChange={setRequestHeaders}
								/>
							</TabPanel>
						</TabBar>
					</section>
				)}

				{selectedRequest && (
					<div className={actionRow}>
						<button
							type="button"
							className={runButton}
							onClick={handleRunRequest}
							disabled={!canRunRequest}
						>
							Send Request
						</button>
						<button
							type="button"
							className={cancelButton}
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
						className={collapseHandleLeft}
						aria-label="Expand collections panel"
					>
						<CaretRightIcon size={16} weight="bold" />
					</ToggleButton>
				)}

					{!isResponseDocked && !isCompactLayout && (
						<ToggleButton
							isSelected={isResponseOpen}
							onChange={setResponseOpen}
							className={collapseHandleRight}
							aria-label="Expand response panel"
					>
						<CaretLeftIcon size={16} weight="bold" />
					</ToggleButton>
				)}

				{!isEnvironmentOpen && (
					<ToggleButton
						isSelected={isEnvironmentOpen}
						onChange={setEnvironmentOpen}
						className={bottomHandle}
						aria-label="Expand environment panel"
					>
						<CaretUpIcon size={16} weight="bold" />
						Environment
					</ToggleButton>
				)}
			</main>

			{isResponseOpen &&
				(isResponseDocked ? (
					<aside className={responseColumn} aria-label="Response panel">
						{responsePanelContent}
					</aside>
				) : (
					<section
						className={responseInline}
						aria-label="Response panel"
						style={responseInlineStyle}
					>
						{responsePanelContent}
					</section>
				))}

			{isEnvironmentOpen && (
				<section
					className={bottomPanel}
					aria-label="Environment panel"
					style={environmentGridStyle}
				>
					<div className={bottomPanelHeader}>
						<h2 className={sectionTitle}>Environment Variables</h2>
						<ToggleButton
							isSelected={isEnvironmentOpen}
							onChange={setEnvironmentOpen}
							className={collapseToggle}
							aria-label="Collapse environment panel"
						>
							<CaretDownIcon size={16} weight="bold" />
							Hide
						</ToggleButton>
					</div>
					<div className={environmentContent}>
						{environments.length === 0 ? (
							<div className={environmentEmptyState}>
								<strong>No environments yet</strong>
								<span>
									Create your first environment to start managing environment
									variables (e.g., Development, Staging, Production).
								</span>
								<form
									className={environmentForm}
									onSubmit={handleCreateEnvironment}
								>
									<input
										className={textInput}
										type="text"
										placeholder="Environment name (e.g., Development)"
										value={newEnvironmentName}
										onChange={(event) => setNewEnvironmentName(event.target.value)}
										required
										aria-label="Environment name"
									/>
									<button className={submitButton} type="submit">
										Create Environment
									</button>
								</form>
							</div>
						) : (
							<EnvironmentEditor
								environmentId={currentEnvironmentId}
								environments={environments.map((env) => ({
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
