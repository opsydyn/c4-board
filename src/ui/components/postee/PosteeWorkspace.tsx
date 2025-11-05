import {
	useMemo,
	useCallback,
	useState,
	useEffect,
	type FormEvent,
} from "react";
import { useMachine } from "@xstate/react";
import { nanoid } from "nanoid";
import Fuse from "fuse.js";
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
import { SearchInput } from "../SearchInput";
import { TabPanel } from "react-aria-components";
import type { PosteeEnvironmentVariable } from "@/core/effects/database.postee";

import {
	workspace,
	sidebar,
	branding,
	collectionList,
	collectionButton,
	collectionButtonActive,
	requestList,
	requestButton,
	requestButtonActive,
	mainColumn,
	mainHeader,
	statusPill,
	panel,
	responseColumn,
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
} from "./PosteeWorkspace.css";

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

	// Environment editor state
	const [showEnvironmentEditor, setShowEnvironmentEditor] = useState(true);
	const [newEnvironmentName, setNewEnvironmentName] = useState("");

	// Search state
	const [historySearchQuery, setHistorySearchQuery] = useState("");

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

	const requestsForActiveCollection = activeCollectionKey
		? requestsByCollection[activeCollectionKey] ?? []
		: [];

	const selectedRequest = requestsForActiveCollection.find(
		(request) => request.id === (activeRequestId as unknown as string),
	);

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

	const canRunRequest = Boolean(selectedRequest) && !isInitialising && !isRunning;
	const lastResponse = runner.response;
	const lastError = runner.status === "error" ? runner.error ?? "Request failed" : null;
	const lastResponseDurationMs = lastResponse ? durationToMillis(lastResponse.duration) : null;

	// Fuse.js search for history
	const filteredHistory = useMemo(() => {
		if (!historySearchQuery.trim()) {
			return history;
		}

		const fuse = new Fuse(history, {
			keys: [
				"response_body",
				"response_headers",
				"request_snapshot",
				{ name: "response_status", weight: 2 },
			],
			threshold: 0.3,
			includeScore: true,
			minMatchCharLength: 2,
		});

		const results = fuse.search(historySearchQuery);
		return results.map((result) => result.item);
	}, [history, historySearchQuery]);

	return (
		<div className={workspace}>
			<aside className={sidebar}>
				<header className={branding}>
					<span>Postee Collections</span>
						<span><a href="/">C4:BOARD</a></span>
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
					{collections.length === 0 && (
						<div className={emptyState}>
							<strong>No collections yet</strong>
							<span>Use the upcoming controls to create your first workspace.</span>
						</div>
					)}
					{collections.map((collection) => {
						const isActive =
							activeCollectionKey === collection.id;
						return (
							<button
								key={collection.id}
								type="button"
								className={
									isActive ? collectionButtonActive : collectionButton
								}
								onClick={() => handleSelectCollection(collection.id)}
							>
								<span>{collection.name}</span>
								<small>
									{requestsByCollection[collection.id]?.length ?? 0} requests
								</small>
							</button>
						);
					})}
				</div>

				{requestsForActiveCollection.length > 0 && (
					<div className={requestList}>
						<span className={sectionTitle}>Requests</span>
						{requestsForActiveCollection.map((request) => {
							const isActive =
								(activeRequestId as unknown as string | null) ===
								request.id;
							return (
								<button
									key={request.id}
									type="button"
									className={
										isActive ? requestButtonActive : requestButton
									}
									onClick={() => handleSelectRequest(request.id)}
								>
									<span>{request.method}</span>
									<span>{request.name}</span>
								</button>
							);
						})}
					</div>
				)}
			</aside>

			<main className={mainColumn}>
				<header className={mainHeader}>
					<h1>Request Builder</h1>
					<span className={statusPill}>{statusLabel}</span>
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

		<section className={panel}>
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
				<h2 className={sectionTitle}>Environment Variables</h2>
				<button
					type="button"
					className={submitButton}
					onClick={() => setShowEnvironmentEditor(!showEnvironmentEditor)}
				>
					{showEnvironmentEditor ? "Hide" : "Show"} Editor
				</button>
			</div>

			{showEnvironmentEditor && (
				<>
					{environments.length === 0 ? (
						<div className={emptyState}>
							<strong>No environments yet</strong>
							<span>Create your first environment to start managing environment variables (e.g., Development, Staging, Production).</span>
							<form className={createForm} onSubmit={handleCreateEnvironment} style={{ marginTop: "1rem" }}>
								<input
									className={textInput}
									type="text"
									placeholder="Environment name (e.g., Development)"
									value={newEnvironmentName}
									onChange={(event) => setNewEnvironmentName(event.target.value)}
									required
									aria-label="Environment name"
								/>
								<button
									className={submitButton}
									type="submit"
								>
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
				</>
			)}
		</section>
	</section>
</main>

<aside className={responseColumn}>
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
			defaultExpanded={true}
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

	<h2 className={sectionTitle}>Recent Activity</h2>

	{history.length > 0 && (
		<SearchInput
			value={historySearchQuery}
			onChange={setHistorySearchQuery}
			placeholder="Search responses by status, body, headers..."
		/>
	)}

	{history.length === 0 ? (
		<div className={emptyState}>
			<strong>No history yet</strong>
			<span>Executed requests will appear here once the runner is wired up.</span>
		</div>
	) : filteredHistory.length === 0 ? (
		<div className={emptyState}>
			<strong>No results found</strong>
			<span>Try a different search query.</span>
		</div>
	) : (
		filteredHistory.slice(0, 10).map((entry) => (
			<div key={entry.id} className={panel}>
				<div>
					<strong>Status:</strong>{" "}
					{entry.response_status ?? "Unknown"}
				</div>
				<div>
					<strong>Duration:</strong>{" "}
					{entry.response_time_ms ?? 0}ms
				</div>
				<div>
					<strong>Size:</strong>{" "}
					{entry.response_size_bytes ? `${entry.response_size_bytes} bytes` : "N/A"}
				</div>
				<div>
					<strong>Executed:</strong>{" "}
					{new Date(entry.executed_at).toLocaleString()}
				</div>
				{entry.response_body && (
					<ResponseViewer
						body={entry.response_body}
						headers={entry.response_headers ?? undefined}
						status={entry.response_status ?? undefined}
						duration={entry.response_time_ms ?? undefined}
						size={entry.response_size_bytes ?? undefined}
						defaultExpanded={false}
					/>
				)}
			</div>
		))
	)}
</aside>
		</div>
	);
}
