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
	type HttpMethod,
	durationToMillis,
} from "../../../core/effects/postee/types";

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
	methodSelect,
	textInput,
	submitButton,
	actionRow,
	runButton,
	cancelButton,
	responseBody,
} from "./PosteeWorkspace.css";

export function PosteeWorkspace() {
	const machine = useMemo(() => createPosteeWorkspaceMachine(), []);
	const [state, send] = useMachine(machine);

	const {
		collections,
		requestsByCollection,
		activeCollectionId,
		activeRequestId,
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
		if (!selectedRequest || isRunning) {
			return;
		}

		send({ type: "RUN_REQUEST" });
	}, [isRunning, selectedRequest, send]);

	const handleCancelRequest = useCallback(() => {
		if (!isRunning) {
			return;
		}

		send({ type: "RUN_CANCEL" });
	}, [isRunning, send]);

	const canRunRequest = Boolean(selectedRequest) && !isInitialising && !isRunning;
	const lastResponse = runner.response;
	const lastError = runner.status === "error" ? runner.error ?? "Request failed" : null;
	const lastResponseDurationMs = lastResponse ? durationToMillis(lastResponse.duration) : null;

	return (
		<div className={workspace}>
			<aside className={sidebar}>
				<header className={branding}>
					<span>Postee Collections</span>
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
						<select
							className={methodSelect}
							value={newRequestMethod}
							onChange={(event) =>
								setNewRequestMethod(event.target.value as HttpMethod)
							}
							disabled={!activeCollectionKey}
							aria-label="HTTP method"
						>
							{methodOptions.map((method) => (
								<option key={method} value={method}>
									{method}
								</option>
							))}
						</select>
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
				<select
					className={methodSelect}
					value={editRequestMethod}
					onChange={(event) =>
						setEditRequestMethod(event.target.value as HttpMethod)
					}
					aria-label="Selected request HTTP method"
				>
					{methodOptions.map((method) => (
						<option key={method} value={method}>
							{method}
						</option>
					))}
				</select>
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
		<div className={panel}>
			<h3 className={sectionTitle}>Last Response</h3>
			<div>
				<strong>Status:</strong> {lastResponse.status} {lastResponse.statusText}
			</div>
			<div>
				<strong>Duration:</strong> {lastResponseDurationMs ?? 0}ms
			</div>
			<div>
				<strong>Body size:</strong> {Number(lastResponse.rawSize)} bytes
			</div>
			{Object.keys(lastResponse.headers).length > 0 && (
				<div>
					<strong>Headers:</strong>
					<ul>
						{Object.entries(lastResponse.headers).map(([key, value]) => (
							<li key={key}>
								<strong>{key}:</strong> {value}
							</li>
						))}
					</ul>
				</div>
			)}
			{lastResponse.bodyText && lastResponse.bodyText.trim().length > 0 && (
				<pre className={responseBody}>{lastResponse.bodyText}</pre>
			)}
		</div>
	)}

	{lastError && (
		<div className={panel}>
			<h3 className={sectionTitle}>Last Error</h3>
			<pre className={responseBody}>{lastError}</pre>
		</div>
	)}

	<h2 className={sectionTitle}>Recent Activity</h2>
	{history.length === 0 ? (
		<div className={emptyState}>
			<strong>No history yet</strong>
			<span>Executed requests will appear here once the runner is wired up.</span>
		</div>
	) : (
		history.slice(0, 5).map((entry) => (
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
					<strong>Executed:</strong>{" "}
					{new Date(entry.executed_at).toLocaleString()}
				</div>
			</div>
		))
	)}
</aside>
		</div>
	);
}
