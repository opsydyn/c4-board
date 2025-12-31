/**
 * PosteeRequestBuilder Component
 *
 * Handles request creation and editing:
 * - Create new HTTP requests (method, name, URL)
 * - Edit selected request metadata
 * - Request body editor (JSON)
 * - Request headers editor
 * - Send/Cancel request buttons
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { TabBar } from "./TabBar";
import { TabPanel } from "react-aria-components";
import { Select } from "./Select";
import { HeadersEditor, type Header } from "./HeadersEditor";
import { MonacoJsonEditor } from "./MonacoJsonEditor";
import { EnvironmentEditor } from "./EnvironmentEditor";
import { Tooltip } from "./Tooltip";
import { SpinnerGap, Warning, CheckCircle } from "@phosphor-icons/react";
import type { HttpMethod } from "@/core/effects/postee/types";
import type { PosteeRequest, PosteeEnvironment, PosteeEnvironmentVariable } from "@/core/effects/database.postee";
import { validateUrl, type UrlValidationResult } from "@/core/effects/postee/url-validation";

import * as styles from "./PosteeWorkspace.css";

/**
 * Get status type for color coding
 */
function getStatusType(status: number): "success" | "redirect" | "client-error" | "server-error" | "info" {
	if (status >= 200 && status < 300) return "success";
	if (status >= 300 && status < 400) return "redirect";
	if (status >= 400 && status < 500) return "client-error";
	if (status >= 500) return "server-error";
	return "info";
}

/**
 * Get human-readable status text
 */
function getStatusText(status: number): string {
	const statusTexts: Record<number, string> = {
		200: "OK",
		201: "Created",
		204: "No Content",
		301: "Moved Permanently",
		302: "Found",
		304: "Not Modified",
		400: "Bad Request",
		401: "Unauthorized",
		403: "Forbidden",
		404: "Not Found",
		429: "Too Many Requests",
		500: "Internal Server Error",
		502: "Bad Gateway",
		503: "Service Unavailable",
	};
	return statusTexts[status] ?? "";
}

export interface PosteeRequestBuilderProps {
	// Collection state
	activeCollectionId: string | null;

	// Request state
	selectedRequest: PosteeRequest | null;

	// Request execution state
	isInitialising: boolean;
	isRunning: boolean;
	canRunRequest: boolean;

	// Response status (for display near Send button)
	lastResponseStatus?: number | undefined;
	lastResponseDurationMs?: number | null | undefined;

	// Environment state
	environments: PosteeEnvironment[];
	currentEnvironmentId: string;
	currentVariables: PosteeEnvironmentVariable[];

	// Callbacks
	onCreateRequest: (method: HttpMethod, name: string, url: string) => void;
	onUpdateRequest: (name: string, method: HttpMethod, url: string) => void;
	onRunRequest: () => void;
	onCancelRequest: () => void;
	onCreateEnvironment: (name: string) => void;
	onEnvironmentChange: (environmentId: string) => void;
	onVariablesChange: (variables: PosteeEnvironmentVariable[]) => void;
}

export function PosteeRequestBuilder({
	activeCollectionId,
	selectedRequest,
	isInitialising,
	isRunning,
	canRunRequest,
	lastResponseStatus,
	lastResponseDurationMs,
	environments,
	currentEnvironmentId,
	currentVariables,
	onCreateRequest,
	onUpdateRequest,
	onRunRequest,
	onCancelRequest,
	onCreateEnvironment,
	onEnvironmentChange,
	onVariablesChange,
}: PosteeRequestBuilderProps) {
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

	// Unified request bar state (handles both create and edit modes)
	const [requestUrl, setRequestUrl] = useState("");
	const [requestMethod, setRequestMethod] = useState<HttpMethod>("GET");
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

	// Request details state (headers, body, tabs)
	const [activeTab, setActiveTab] = useState<"Body" | "Headers" | "Environment">("Body");
	const [requestHeaders, setRequestHeaders] = useState<Header[]>([]);
	const [requestBody, setRequestBody] = useState<string>("{}");

	// Environment creation state
	const [newEnvironmentName, setNewEnvironmentName] = useState("");

	// URL validation - runs on every URL change
	const urlValidation = useMemo<UrlValidationResult>(() => {
		return validateUrl(requestUrl);
	}, [requestUrl]);

	// Sync unified bar with selected request
	useEffect(() => {
		if (!selectedRequest) {
			// New request mode - clear the bar
			setRequestUrl("");
			setRequestMethod("GET");
			setHasUnsavedChanges(false);
			return;
		}

		// Edit mode - populate from selected request
		setRequestUrl(selectedRequest.url);
		setRequestMethod(selectedRequest.method as HttpMethod);
		setHasUnsavedChanges(false);
	}, [selectedRequest]);

	// Track changes to detect unsaved state
	const handleUrlChange = useCallback((newUrl: string) => {
		setRequestUrl(newUrl);
		setHasUnsavedChanges(true);
	}, []);

	const handleMethodChange = useCallback((newMethod: HttpMethod) => {
		setRequestMethod(newMethod);
		setHasUnsavedChanges(true);
	}, []);

	// Save action (create new or update existing)
	const handleSave = useCallback(() => {
		const trimmedUrl = requestUrl.trim();
		if (!trimmedUrl || !activeCollectionId) return;

		if (selectedRequest) {
			// Update existing request
			onUpdateRequest(selectedRequest.name, requestMethod, trimmedUrl);
		} else {
			// Create new request with auto-generated name
			const name = `New ${requestMethod} Request`;
			onCreateRequest(requestMethod, name, trimmedUrl);
		}

		setHasUnsavedChanges(false);
	}, [requestUrl, requestMethod, selectedRequest, activeCollectionId, onCreateRequest, onUpdateRequest]);

	// Handle environment creation
	const handleCreateEnvironment = useCallback((event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const name = newEnvironmentName.trim() || "Development";
		onCreateEnvironment(name);
		setNewEnvironmentName("");
	}, [newEnvironmentName, onCreateEnvironment]);

	// Keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
			const modKey = isMac ? event.metaKey : event.ctrlKey;

			// Cmd/Ctrl + Enter: Send request
			if (modKey && event.key === 'Enter') {
				event.preventDefault();
				if (canRunRequest && !isRunning) {
					onRunRequest();
				}
				return;
			}

			// Cmd/Ctrl + S: Save changes
			if (modKey && event.key === 's') {
				event.preventDefault();
				if (hasUnsavedChanges && requestUrl.trim() && activeCollectionId) {
					handleSave();
				}
				return;
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [canRunRequest, isRunning, hasUnsavedChanges, requestUrl, activeCollectionId, onRunRequest, handleSave]);

	return (
		<>
			{/* Unified Request Bar - Always visible, Postman-style */}
			<section className={styles.requestBar}>
				<div className={styles.requestBarRow}>
					<Select
						value={requestMethod}
						options={methodOptions}
						onChange={handleMethodChange}
						disabled={!activeCollectionId || isInitialising}
					/>
					<div className={styles.urlInputWrapper}>
						<input
							className={styles.requestUrlInput}
							type="text"
							placeholder={
								!activeCollectionId
									? "Select a collection first..."
									: selectedRequest
									? "Enter request URL"
									: "Enter URL and Save to create new request"
							}
							value={requestUrl}
							onChange={(e) => handleUrlChange(e.target.value)}
							disabled={!activeCollectionId || isInitialising}
							aria-label="Request URL"
							data-validation={urlValidation._tag.toLowerCase()}
						/>
						{urlValidation._tag === "Valid" && requestUrl.trim() !== "" && (
							<CheckCircle size={16} weight="bold" className={styles.urlValidIcon} />
						)}
						{urlValidation._tag === "Invalid" && (
							<Warning size={16} weight="bold" className={styles.urlInvalidIcon} />
						)}
					</div>
					{hasUnsavedChanges && (
						<Tooltip content={selectedRequest ? "Save changes (Cmd+S)" : "Save as new request (Cmd+S)"}>
							<button
								type="button"
								className={styles.saveButton}
								onClick={handleSave}
								disabled={!requestUrl.trim() || !activeCollectionId}
							>
								Save
							</button>
						</Tooltip>
					)}
					{selectedRequest && !hasUnsavedChanges && (
						<div className={styles.actionRow}>
							{isRunning ? (
								<Tooltip content="Stop the current request">
									<button
										type="button"
										className={styles.cancelButton}
										onClick={onCancelRequest}
									>
										<SpinnerGap size={16} weight="bold" className={styles.spinner} />
										Cancel
									</button>
								</Tooltip>
							) : (
								<Tooltip content={canRunRequest ? "Send request (Cmd+Enter)" : "Save request first"}>
									<button
										type="button"
										className={styles.runButton}
										onClick={onRunRequest}
										disabled={!canRunRequest}
									>
										Send
									</button>
								</Tooltip>
							)}
							{lastResponseStatus && lastResponseDurationMs !== null && (
								<div className={styles.statusBadge} data-status-type={getStatusType(lastResponseStatus)}>
									<span className={styles.statusCode}>{lastResponseStatus}</span>
									<span className={styles.statusText}>{getStatusText(lastResponseStatus)}</span>
									<span className={styles.statusDivider}>•</span>
									<span className={styles.statusDuration}>{lastResponseDurationMs}ms</span>
								</div>
							)}
						</div>
					)}
				</div>

				{/* URL Validation Error Message */}
				{urlValidation._tag === "Invalid" && (
					<div className={styles.validationError}>
						<Warning size={14} weight="bold" />
						<span>{urlValidation.error}</span>
						{urlValidation.suggestion && (
							<button
								type="button"
								className={styles.suggestionButton}
								onClick={() => handleUrlChange(urlValidation.suggestion!)}
							>
								Use: {urlValidation.suggestion}
							</button>
						)}
					</div>
				)}

				{!activeCollectionId && (
					<div className={styles.emptyState}>
						<strong>Select a collection</strong>
						<span>
							Pick a collection on the left to start creating requests.
						</span>
					</div>
				)}

				{isInitialising && activeCollectionId && (
					<div className={styles.emptyState}>
						<strong>Loading workspace…</strong>
						<span>Fetching collections, requests, and environments.</span>
					</div>
				)}

				{!isInitialising && activeCollectionId && !selectedRequest && requestUrl.trim() === "" && (
					<div className={styles.emptyState}>
						<strong>Enter a URL to create a new request</strong>
						<span>
							Or select an existing request from the sidebar to edit it.
						</span>
					</div>
				)}
			</section>

			{/* Request Details - Only show when request is selected */}
			{selectedRequest && (
				<section className={styles.panel}>
					<TabBar
						tabs={["Body", "Headers", "Environment"]}
						activeTab={activeTab}
						onTabChange={(tab) => setActiveTab(tab as "Body" | "Headers" | "Environment")}
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
						<TabPanel id="Environment" className={styles.tabContent}>
							{environments.length === 0 ? (
								<div className={styles.emptyState}>
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
									environments={environments.map((env) => ({
										id: env.id,
										name: env.name,
										is_default: env.is_default,
									}))}
									variables={currentVariables}
									onEnvironmentChange={onEnvironmentChange}
									onVariablesChange={onVariablesChange}
								/>
							)}
						</TabPanel>
					</TabBar>
				</section>
			)}
		</>
	);
}
