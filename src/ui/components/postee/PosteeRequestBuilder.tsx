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

import type { PosteeEnvironment, PosteeEnvironmentVariable, PosteeRequest } from "@/core/effects/database.postee";
import {
  evaluateRequestSemantics,
  type PosteeRequestDraft,
  type PosteeScratchDraft,
  prepareGraphqlDraft,
} from "@/core/effects/postee";
import { bodyModeToSumType, HTTP_METHODS, type HttpMethod, type RequestBodyMode } from "@/core/effects/postee/types";
import { type UrlValidationResult, validateUrl } from "@/core/effects/postee/url-validation";
import type { GraphqlSchemaState, RequestDraftSaveState } from "@/ui/machines/postee.machine";
import {
  ArrowClockwiseIcon,
  CheckCircleIcon as CheckCircle,
  SpinnerGapIcon as SpinnerGap,
  WarningIcon as Warning,
} from "@phosphor-icons/react";
import { buildClientSchema, type GraphQLSchema, type IntrospectionQuery } from "graphql";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { TabPanel } from "react-aria-components";
import { EnvironmentEditor } from "./EnvironmentEditor";
import { type Header, HeadersEditor } from "./HeadersEditor";
import { scratchAsRequest, scratchAsRequestDraft } from "@/core/effects/postee/scratch-draft";
import { MonacoGraphqlEditor } from "./MonacoGraphqlEditor";
import { MonacoJsonEditor } from "./MonacoJsonEditor";
import { Select } from "./Select";
import { TabBar } from "./TabBar";
import { Tooltip } from "./Tooltip";

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
  selectedRequestDraft: PosteeRequestDraft | null;
  activeScratchDraft: PosteeScratchDraft | null;
  requestDraftSave: RequestDraftSaveState;
  graphqlSchemaState: GraphqlSchemaState;

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
  onSaveRequestDraft: (draft: PosteeRequestDraft) => void;
  onScratchDraftChange: (draft: PosteeScratchDraft) => void;
  onSaveScratch: () => void;
  onRunRequest: () => void;
  onCancelRequest: () => void;
  onCreateEnvironment: (name: string) => void;
  onEnvironmentChange: (environmentId: string) => void;
  onVariablesChange: (variables: PosteeEnvironmentVariable[]) => void;
  onRefreshGraphqlSchema: () => void;
}

interface PendingRequestDraftSave {
  readonly requestId: string;
  readonly serverRevision: number;
  readonly editVersion: number;
}

interface RequestEditorLocalState {
  readonly requestUrl: string;
  readonly requestMethod: string;
  readonly requestHeaders: ReadonlyArray<Header>;
  readonly requestBody: string;
  readonly requestBodyMode: string;
}

interface RequestEditorPresentationInput {
  readonly selectedRequest: PosteeRequest | null;
  readonly selectedRequestDraft: PosteeRequestDraft | null;
  readonly hydratedRequestId: string | null;
  readonly pendingSave: PendingRequestDraftSave | null;
  readonly requestDraftSave: RequestDraftSaveState;
  readonly currentEditVersion: number;
  readonly local: RequestEditorLocalState;
}

interface RequestEditorPresentation extends RequestEditorLocalState {
  readonly synchronized: boolean;
}

const GRAPHQL_BODY_MODES: ReadonlyArray<RequestBodyMode> = ["json", "raw", "form", "graphql"];

export const deriveRequestEditorPresentation = ({
  selectedRequest,
  selectedRequestDraft,
  hydratedRequestId,
  pendingSave,
  requestDraftSave,
  currentEditVersion,
  local,
}: RequestEditorPresentationInput): RequestEditorPresentation => {
  const selectedRequestId = selectedRequest?.id ?? null;
  const confirmedDraftMatches = Boolean(
    selectedRequestId
      && selectedRequestDraft?.request.id === selectedRequestId,
  );
  const awaitingCanonicalCompletion = Boolean(
    pendingSave
      && selectedRequestId === pendingSave.requestId
      && requestDraftSave.status === "success"
      && requestDraftSave.requestId === pendingSave.requestId
      && requestDraftSave.revision > pendingSave.serverRevision
      && currentEditVersion === pendingSave.editVersion,
  );
  const identitySynchronized = selectedRequestId === null
    ? hydratedRequestId === null
    : confirmedDraftMatches && hydratedRequestId === selectedRequestId;
  const synchronized = identitySynchronized && !awaitingCanonicalCompletion;

  if (synchronized) {
    return { ...local, synchronized };
  }

  if (selectedRequest && selectedRequestDraft?.request.id === selectedRequest.id) {
    return {
      synchronized,
      requestUrl: selectedRequestDraft.request.url,
      requestMethod: selectedRequestDraft.request.method,
      requestHeaders: selectedRequestDraft.headers.map((header) => ({ ...header })),
      requestBody: selectedRequestDraft.body.raw ?? "",
      requestBodyMode: selectedRequestDraft.body.mode,
    };
  }

  if (selectedRequest) {
    return {
      synchronized,
      requestUrl: selectedRequest.url,
      requestMethod: selectedRequest.method,
      requestHeaders: [],
      requestBody: "{}",
      requestBodyMode: "json",
    };
  }

  return { ...local, synchronized };
};

export function PosteeRequestBuilder({
  activeCollectionId,
  selectedRequest: selectedSavedRequest,
  selectedRequestDraft: selectedSavedRequestDraft,
  activeScratchDraft = null,
  requestDraftSave,
  graphqlSchemaState,
  isInitialising,
  isRunning,
  canRunRequest,
  lastResponseStatus,
  lastResponseDurationMs,
  environments,
  currentEnvironmentId,
  currentVariables,
  onCreateRequest,
  onSaveRequestDraft,
  onScratchDraftChange = () => undefined,
  onSaveScratch = () => undefined,
  onRunRequest,
  onCancelRequest,
  onCreateEnvironment,
  onEnvironmentChange,
  onVariablesChange,
  onRefreshGraphqlSchema,
}: PosteeRequestBuilderProps) {
  const methodOptions: ReadonlyArray<HttpMethod> = HTTP_METHODS;
  const isScratch = activeScratchDraft !== null;
  const selectedRequest = useMemo(
    () => activeScratchDraft ? scratchAsRequest(activeScratchDraft) : selectedSavedRequest,
    [activeScratchDraft, selectedSavedRequest],
  );
  const selectedRequestDraft = useMemo(
    () => activeScratchDraft ? scratchAsRequestDraft(activeScratchDraft) : selectedSavedRequestDraft,
    [activeScratchDraft, selectedSavedRequestDraft],
  );

  // Unified request bar state (handles both create and edit modes)
  const [requestUrl, setRequestUrl] = useState("");
  const [requestMethod, setRequestMethod] = useState<HttpMethod>("GET");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Request details state (headers, body, tabs)
  const [activeTab, setActiveTab] = useState<"Body" | "Headers" | "Environment">("Body");
  const [requestHeaders, setRequestHeaders] = useState<Header[]>([]);
  const [requestBody, setRequestBody] = useState<string>("{}");
  const [requestBodyMode, setRequestBodyMode] = useState("json");
  const [graphqlDocument, setGraphqlDocument] = useState("");
  const [graphqlVariables, setGraphqlVariables] = useState("{}");
  const [graphqlOperationName, setGraphqlOperationName] = useState<string | null>(null);
  const [bodyWasEdited, setBodyWasEdited] = useState(false);
  const [hydratedRequestId, setHydratedRequestId] = useState<string | null>(null);
  const [pendingSave, setPendingSave] = useState<PendingRequestDraftSave | null>(null);
  const editVersionsRef = useRef<Record<string, number>>({});

  const publishScratchDraft = useCallback((next: {
    readonly url?: string;
    readonly method?: HttpMethod;
    readonly headers?: ReadonlyArray<Header>;
    readonly body?: string;
    readonly bodyMode?: RequestBodyMode;
    readonly graphqlDocument?: string;
    readonly graphqlVariables?: string;
    readonly graphqlOperationName?: string | null;
  }) => {
    if (activeScratchDraft === null) return;
    const bodyMode = next.bodyMode ?? requestBodyMode as RequestBodyMode;
    const nextGraphqlDocument = next.graphqlDocument ?? graphqlDocument;
    const nextGraphqlVariables = next.graphqlVariables ?? graphqlVariables;
    const nextGraphqlOperationName = next.graphqlOperationName ?? graphqlOperationName;
    onScratchDraftChange({
      ...activeScratchDraft,
      method: next.method ?? requestMethod,
      url: next.url ?? requestUrl,
      headers: next.headers ?? requestHeaders,
      body: {
        ...activeScratchDraft.body,
        mode: bodyMode,
        raw: bodyMode === "graphql" ? null : next.body ?? requestBody,
      },
      graphql: bodyMode === "graphql"
        ? {
          document: nextGraphqlDocument,
          variables_json: nextGraphqlVariables,
          operation_name: nextGraphqlOperationName,
        }
        : null,
    });
  }, [
    activeScratchDraft,
    graphqlDocument,
    graphqlOperationName,
    graphqlVariables,
    onScratchDraftChange,
    requestBody,
    requestBodyMode,
    requestHeaders,
    requestMethod,
    requestUrl,
  ]);

  // Environment creation state
  const [newEnvironmentName, setNewEnvironmentName] = useState("");

  const currentEditVersion = selectedRequest
    ? editVersionsRef.current[selectedRequest.id] ?? 0
    : editVersionsRef.current.__new_request__ ?? 0;
  const editorPresentation = deriveRequestEditorPresentation({
    selectedRequest,
    selectedRequestDraft,
    hydratedRequestId,
    pendingSave,
    requestDraftSave,
    currentEditVersion,
    local: {
      requestUrl,
      requestMethod,
      requestHeaders,
      requestBody,
      requestBodyMode,
    },
  });
  const isEditorSynchronized = editorPresentation.synchronized;

  // URL validation - runs on every URL change
  const urlValidation = useMemo<UrlValidationResult>(() => {
    return validateUrl(editorPresentation.requestUrl);
  }, [editorPresentation.requestUrl]);

  const applyConfirmedDraft = useCallback((draft: PosteeRequestDraft) => {
    setRequestUrl(draft.request.url);
    setRequestMethod(draft.request.method as HttpMethod);
    setRequestHeaders(draft.headers.map((header) => ({ ...header })));
    setRequestBody(draft.body.raw ?? "");
    setRequestBodyMode(draft.body.mode);
    setGraphqlDocument(draft.graphql?.document ?? "");
    setGraphqlVariables(draft.graphql?.variables_json ?? "{}");
    setGraphqlOperationName(draft.graphql?.operation_name ?? null);
    setBodyWasEdited(false);
    setHasUnsavedChanges(false);
    setHydratedRequestId(draft.request.id);
  }, []);

  // Replace the complete local editor state when request identity changes.
  useLayoutEffect(() => {
    if (!selectedRequest) {
      setRequestUrl("");
      setRequestMethod("GET");
      setRequestHeaders([]);
      setRequestBody("{}");
      setRequestBodyMode("json");
      setGraphqlDocument("");
      setGraphqlVariables("{}");
      setGraphqlOperationName(null);
      setBodyWasEdited(false);
      setHasUnsavedChanges(false);
      setHydratedRequestId(null);
      return;
    }

    if (
      !selectedRequestDraft
      || selectedRequestDraft.request.id !== selectedRequest.id
    ) {
      if (hydratedRequestId !== selectedRequest.id) {
        setRequestUrl(selectedRequest.url);
        setRequestMethod(selectedRequest.method as HttpMethod);
        setRequestHeaders([]);
        setRequestBody("{}");
        setRequestBodyMode("json");
        setGraphqlDocument("");
        setGraphqlVariables("{}");
        setGraphqlOperationName(null);
        setBodyWasEdited(false);
        setHasUnsavedChanges(false);
      }
      return;
    }

    if (hydratedRequestId === selectedRequest.id) {
      return;
    }

    applyConfirmedDraft(selectedRequestDraft);
  }, [applyConfirmedDraft, hydratedRequestId, selectedRequest, selectedRequestDraft]);

  useLayoutEffect(() => {
    if (
      !pendingSave
    ) {
      return;
    }

    if (
      requestDraftSave.status === "error"
      && requestDraftSave.requestId === pendingSave.requestId
    ) {
      setPendingSave(null);
      return;
    }

    if (
      requestDraftSave.status !== "success"
      || requestDraftSave.requestId !== pendingSave.requestId
      || requestDraftSave.revision <= pendingSave.serverRevision
    ) {
      return;
    }

    if (
      selectedRequest?.id === pendingSave.requestId
      && selectedRequestDraft?.request.id === pendingSave.requestId
      && (editVersionsRef.current[pendingSave.requestId] ?? 0) === pendingSave.editVersion
    ) {
      applyConfirmedDraft(selectedRequestDraft);
    }
    setPendingSave(null);
  }, [
    applyConfirmedDraft,
    pendingSave,
    requestDraftSave.requestId,
    requestDraftSave.revision,
    requestDraftSave.status,
    selectedRequest?.id,
    selectedRequestDraft,
  ]);

  const markDirty = useCallback(() => {
    const requestId = selectedRequest?.id ?? "__new_request__";
    editVersionsRef.current[requestId] = (editVersionsRef.current[requestId] ?? 0) + 1;
    setHasUnsavedChanges(true);
  }, [selectedRequest?.id]);

  // Track changes to detect unsaved state
  const handleUrlChange = useCallback((newUrl: string) => {
    if (isRunning || !isEditorSynchronized) return;
    setRequestUrl(newUrl);
    markDirty();
    publishScratchDraft({ url: newUrl });
  }, [isEditorSynchronized, isRunning, markDirty, publishScratchDraft]);

  const handleMethodChange = useCallback((newMethod: HttpMethod) => {
    if (isRunning || !isEditorSynchronized) return;
    setRequestMethod(newMethod);
    markDirty();
    publishScratchDraft({ method: newMethod });
  }, [isEditorSynchronized, isRunning, markDirty, publishScratchDraft]);

  const handleHeadersChange = useCallback((headers: Header[]) => {
    if (isRunning || !isEditorSynchronized) return;
    setRequestHeaders(headers);
    markDirty();
    publishScratchDraft({ headers });
  }, [isEditorSynchronized, isRunning, markDirty, publishScratchDraft]);

  const handleBodyChange = useCallback((body: string) => {
    if (isRunning || !isEditorSynchronized) return;
    setRequestBody(body);
    setBodyWasEdited(true);
    markDirty();
    publishScratchDraft({ body });
  }, [isEditorSynchronized, isRunning, markDirty, publishScratchDraft]);

  const handleBodyModeChange = useCallback((mode: RequestBodyMode) => {
    if (isRunning || !isEditorSynchronized) return;
    setRequestBodyMode(mode);
    setBodyWasEdited(false);
    if (mode === "graphql") {
      const nextDocument = graphqlDocument || "query { }";
      const nextVariables = graphqlVariables || "{}";
      setGraphqlDocument(nextDocument);
      setGraphqlVariables(nextVariables);
      setGraphqlOperationName(null);
      publishScratchDraft({
        bodyMode: mode,
        graphqlDocument: nextDocument,
        graphqlVariables: nextVariables,
        graphqlOperationName: null,
      });
    } else {
      publishScratchDraft({ bodyMode: mode });
    }
    markDirty();
  }, [graphqlDocument, graphqlVariables, isEditorSynchronized, isRunning, markDirty, publishScratchDraft]);

  const handleGraphqlDocumentChange = useCallback((document: string) => {
    if (isRunning || !isEditorSynchronized) return;
    setGraphqlDocument(document);
    setGraphqlOperationName(null);
    markDirty();
    publishScratchDraft({ graphqlDocument: document, graphqlOperationName: null });
  }, [isEditorSynchronized, isRunning, markDirty, publishScratchDraft]);

  const handleGraphqlVariablesChange = useCallback((variables: string) => {
    if (isRunning || !isEditorSynchronized) return;
    setGraphqlVariables(variables);
    markDirty();
    publishScratchDraft({ graphqlVariables: variables });
  }, [isEditorSynchronized, isRunning, markDirty, publishScratchDraft]);

  const handleGraphqlOperationChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    if (isRunning || !isEditorSynchronized) return;
    const operationName = event.target.value || null;
    setGraphqlOperationName(operationName);
    markDirty();
    publishScratchDraft({ graphqlOperationName: operationName });
  }, [isEditorSynchronized, isRunning, markDirty, publishScratchDraft]);

  const activeSaveRequestId = requestDraftSave.status === "saving"
    ? requestDraftSave.requestId
    : pendingSave?.requestId ?? null;
  const isAnySaveActive = requestDraftSave.status === "saving" || pendingSave !== null;
  const isMatchingSave = Boolean(
    selectedRequest
      && isAnySaveActive
      && activeSaveRequestId === selectedRequest.id,
  );
  const isAnotherRequestSaving = Boolean(
    selectedRequest
      && isAnySaveActive
      && activeSaveRequestId !== selectedRequest.id,
  );
  const visibleHasUnsavedChanges = isEditorSynchronized && hasUnsavedChanges;
  const isGraphqlBody = editorPresentation.requestBodyMode === "graphql";
  const graphqlPreparation = useMemo(() => (
    isGraphqlBody
      ? prepareGraphqlDraft({
        document: graphqlDocument,
        variablesJson: graphqlVariables,
        operationName: graphqlOperationName,
      })
      : null
  ), [graphqlDocument, graphqlOperationName, graphqlVariables, isGraphqlBody]);
  const graphqlSchema = useMemo<GraphQLSchema | null>(() => {
    if (graphqlSchemaState.snapshot === null) return null;
    try {
      return buildClientSchema(JSON.parse(graphqlSchemaState.snapshot.introspection_json) as IntrospectionQuery);
    } catch {
      return null;
    }
  }, [graphqlSchemaState.snapshot]);
  const semanticBodyMode = bodyWasEdited
    ? "json"
    : editorPresentation.requestBodyMode;
  const semanticBody = bodyModeToSumType(
    semanticBodyMode as RequestBodyMode,
    editorPresentation.requestBody,
    selectedRequestDraft?.body.form_values ?? null,
  );
  const requestSemanticsIssue = isGraphqlBody
    ? editorPresentation.requestMethod !== "POST"
      ? "GraphQL requests require POST."
      : graphqlPreparation?.issue ?? null
    : evaluateRequestSemantics(
      editorPresentation.requestMethod as HttpMethod,
      editorPresentation.requestHeaders
        .filter((header) => header.enabled)
        .map(({ key, value }) => ({ key, value })),
      semanticBody,
    );
  const canSendRequest = canRunRequest
    && requestSemanticsIssue === null
    && (isScratch || !hasUnsavedChanges)
    && isEditorSynchronized
    && !isAnySaveActive
    && !isRunning;

  // Save action (create new or update existing)
  const handleSave = useCallback(() => {
    const trimmedUrl = requestUrl.trim();
    if (isScratch) {
      if (!trimmedUrl || isRunning) return;
      onSaveScratch();
      return;
    }
    if (
      !trimmedUrl
      || !activeCollectionId
      || isAnySaveActive
      || !isEditorSynchronized
      || isRunning
    ) return;

    if (
      selectedRequest
      && selectedRequestDraft
      && selectedRequest.id === selectedRequestDraft.request.id
    ) {
      setPendingSave({
        requestId: selectedRequest.id,
        serverRevision: requestDraftSave.revision,
        editVersion: editVersionsRef.current[selectedRequest.id] ?? 0,
      });
      onSaveRequestDraft({
        request: {
          ...selectedRequestDraft.request,
          method: requestMethod,
          url: trimmedUrl,
        },
        headers: requestHeaders,
        body: {
          ...selectedRequestDraft.body,
          mode: requestBodyMode === "graphql" ? "graphql" : bodyWasEdited ? "json" : requestBodyMode,
          raw: requestBodyMode === "graphql" ? null : requestBody,
        },
        graphql: requestBodyMode === "graphql"
          ? {
            request_id: selectedRequest.id,
            document: graphqlDocument,
            variables_json: graphqlVariables,
            operation_name: graphqlOperationName,
          }
          : null,
      });
    } else {
      const name = `New ${requestMethod} Request`;
      onCreateRequest(requestMethod, name, trimmedUrl);
      setHasUnsavedChanges(false);
    }
  }, [
    activeCollectionId,
    bodyWasEdited,
    graphqlDocument,
    graphqlOperationName,
    graphqlVariables,
    isAnySaveActive,
    isEditorSynchronized,
    isScratch,
    isRunning,
    onCreateRequest,
    onSaveScratch,
    onSaveRequestDraft,
    requestBody,
    requestBodyMode,
    requestDraftSave.revision,
    requestHeaders,
    requestMethod,
    requestUrl,
    selectedRequest,
    selectedRequestDraft,
  ]);

  const matchingSaveError = selectedRequest
      && requestDraftSave.status === "error"
      && requestDraftSave.requestId === selectedRequest.id
    ? requestDraftSave.error
    : null;

  // Handle environment creation
  const handleCreateEnvironment = useCallback((event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newEnvironmentName.trim() || "Development";
    onCreateEnvironment(name);
    setNewEnvironmentName("");
  }, [newEnvironmentName, onCreateEnvironment]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modKey = isMac ? event.metaKey : event.ctrlKey;

      // Cmd/Ctrl + Enter: Send request
      if (modKey && event.key === "Enter") {
        event.preventDefault();
        if (canSendRequest) {
          onRunRequest();
        }
        return;
      }

      // Cmd/Ctrl + S: Save changes
      if (modKey && event.key === "s") {
        event.preventDefault();
        if (
          hasUnsavedChanges
          && requestUrl.trim()
          && (isScratch || activeCollectionId)
          && !isAnySaveActive
          && isEditorSynchronized
          && !isRunning
        ) {
          handleSave();
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeCollectionId,
    canSendRequest,
    handleSave,
    hasUnsavedChanges,
    isAnySaveActive,
    isEditorSynchronized,
    isScratch,
    isRunning,
    onRunRequest,
    requestUrl,
  ]);

  const globalSaveMessage = isAnotherRequestSaving
    ? "Another request is saving. Save and Send are temporarily unavailable."
    : "Saving request details. Save and Send are temporarily unavailable.";
  const saveCommandDescription = isAnotherRequestSaving
    ? "Another request is saving. Save is temporarily unavailable."
    : isRunning
    ? "Request is running. Save is temporarily unavailable."
    : !isEditorSynchronized
    ? "Request details are synchronising. Save is temporarily unavailable."
    : isScratch
    ? "Choose a collection to save this request (Cmd+S)"
    : selectedRequest
    ? "Save changes (Cmd+S)"
    : "Save as new request (Cmd+S)";
  const sendCommandDescription = isAnotherRequestSaving
    ? "Another request is saving. Send is temporarily unavailable."
    : isMatchingSave
    ? "This request is saving. Send is temporarily unavailable."
    : !isEditorSynchronized
    ? "Request details are synchronising. Send is temporarily unavailable."
    : requestSemanticsIssue
    ? requestSemanticsIssue
    : canRunRequest
    ? "Send request (Cmd+Enter)"
    : "Select a request first";
  const canRefreshGraphqlSchema = isGraphqlBody
    && !visibleHasUnsavedChanges
    && isEditorSynchronized
    && !isRunning
    && graphqlSchemaState.status !== "Refreshing";
  const graphqlSchemaStatusText = graphqlSchemaState.error
    ? graphqlSchemaState.error
    : graphqlSchemaState.status === "Cached"
    ? "Cached schema"
    : graphqlSchemaState.status === "Stale"
    ? "Cached schema is stale"
    : graphqlSchemaState.status === "Refreshing"
    ? "Refreshing schema"
    : graphqlSchemaState.status === "Unavailable"
    ? "Schema unavailable"
    : "No cached schema";

  return (
    <>
      {/* Unified Request Bar - Always visible, Postman-style */}
      <section className={styles.requestBar}>
        <div className={styles.requestBarRow}>
          <Select
            value={editorPresentation.requestMethod as HttpMethod}
            options={methodOptions}
            onChange={handleMethodChange}
            disabled={(!activeCollectionId && !isScratch) || isInitialising || !isEditorSynchronized || isRunning}
          />
          <div className={styles.urlInputWrapper}>
            <input
              className={styles.requestUrlInput}
              type="text"
              placeholder={!activeCollectionId && !isScratch
                ? "Select a collection first..."
                : selectedRequest
                ? "Enter request URL"
                : "Enter URL and Save to create new request"}
              value={editorPresentation.requestUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              disabled={(!activeCollectionId && !isScratch) || isInitialising || !isEditorSynchronized || isRunning}
              aria-label="Request URL"
              data-validation={urlValidation._tag.toLowerCase()}
            />
            {urlValidation._tag === "Valid" && editorPresentation.requestUrl.trim() !== "" && (
              <CheckCircle size={16} weight="bold" className={styles.urlValidIcon} />
            )}
            {urlValidation._tag === "Invalid" && <Warning size={16} weight="bold" className={styles.urlInvalidIcon} />}
          </div>
          {(visibleHasUnsavedChanges || isScratch) && (
            <Tooltip content={saveCommandDescription}>
              <button
                type="button"
                className={styles.saveButton}
                onClick={handleSave}
                disabled={!editorPresentation.requestUrl.trim()
                  || (!isScratch && !activeCollectionId)
                  || (!isScratch && isAnySaveActive)
                  || !isEditorSynchronized
                  || isRunning
                  || Boolean(!isScratch && selectedRequest && !selectedRequestDraft)}
                title={saveCommandDescription}
              >
                {isMatchingSave ? "Saving..." : "Save"}
              </button>
            </Tooltip>
          )}
          {selectedRequest && (isScratch || !visibleHasUnsavedChanges || isRunning) && (
            <div className={styles.actionRow}>
              {isRunning
                ? (
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
                )
                : (
                  <Tooltip content={sendCommandDescription}>
                    <button
                      type="button"
                      className={styles.runButton}
                      onClick={onRunRequest}
                      disabled={!canSendRequest}
                      title={sendCommandDescription}
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

        {isAnySaveActive && (
          <div className={styles.validationError} role="status" aria-live="polite">
            <SpinnerGap size={14} weight="bold" className={styles.spinner} />
            <span>{globalSaveMessage}</span>
          </div>
        )}

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
                disabled={!isEditorSynchronized || isRunning}
              >
                Use: {urlValidation.suggestion}
              </button>
            )}
          </div>
        )}

        {requestSemanticsIssue && (
          <div className={styles.validationError} role="alert">
            <Warning size={14} weight="bold" />
            <span>{requestSemanticsIssue}</span>
          </div>
        )}

        {matchingSaveError && hasUnsavedChanges && (
          <div className={styles.validationError} role="alert">
            <Warning size={14} weight="bold" />
            <span>{matchingSaveError}</span>
          </div>
        )}

        {!activeCollectionId && !isScratch && (
          <div className={styles.emptyState}>
            <strong>Select a collection</strong>
            <span>
              Pick a collection on the left to start creating requests.
            </span>
          </div>
        )}

        {isInitialising && (activeCollectionId || isScratch) && (
          <div className={styles.emptyState}>
            <strong>Loading workspace…</strong>
            <span>Fetching collections, requests, and environments.</span>
          </div>
        )}

        {!isInitialising
          && (activeCollectionId || isScratch)
          && !selectedRequest
          && editorPresentation.requestUrl.trim() === ""
          && (
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
              <div className={styles.requestBarRow}>
                <Select
                  value={editorPresentation.requestBodyMode as RequestBodyMode}
                  options={GRAPHQL_BODY_MODES}
                  onChange={handleBodyModeChange}
                  disabled={!isEditorSynchronized || isRunning}
                  ariaLabel="Request body mode"
                />
              </div>
              {isGraphqlBody
                ? (
                  <div className={styles.graphqlEditorLayout}>
                    <div className={styles.graphqlEditorSection}>
                      <div className={styles.graphqlEditorHeading}>
                        <span>Document</span>
                        <div className={styles.graphqlSchemaControls}>
                          <span className={styles.graphqlSchemaStatus} role="status" aria-live="polite">
                            {graphqlSchemaStatusText}
                          </span>
                          <Tooltip content="Refresh GraphQL schema">
                            <button
                              type="button"
                              className={styles.graphqlSchemaRefreshButton}
                              onClick={onRefreshGraphqlSchema}
                              disabled={!canRefreshGraphqlSchema}
                              aria-label="Refresh GraphQL schema"
                            >
                              <ArrowClockwiseIcon size={14} weight="bold" aria-hidden="true" />
                            </button>
                          </Tooltip>
                        </div>
                      </div>
                      <MonacoGraphqlEditor
                        value={graphqlDocument}
                        onChange={handleGraphqlDocumentChange}
                        schema={graphqlSchema}
                        readOnly={!isEditorSynchronized || isRunning}
                        height="clamp(180px, 42vh, 620px)"
                      />
                    </div>
                    <div className={styles.graphqlEditorSection}>
                      <div className={styles.graphqlEditorHeading}>
                        Variables
                      </div>
                      <MonacoJsonEditor
                        value={graphqlVariables}
                        onChange={handleGraphqlVariablesChange}
                        readOnly={!isEditorSynchronized || isRunning}
                        height="clamp(120px, 18vh, 280px)"
                        placeholder="{}"
                        ariaLabel="GraphQL variables"
                      />
                    </div>
                    {graphqlPreparation !== null && graphqlPreparation.operationNames.length > 1 && (
                      <label className={styles.graphqlOperationField}>
                        <span>Operation</span>
                        <select
                          className={styles.textInput}
                          value={graphqlOperationName ?? ""}
                          onChange={handleGraphqlOperationChange}
                          disabled={!isEditorSynchronized || isRunning}
                          aria-label="GraphQL operation"
                        >
                          <option value="">Select operation</option>
                          {graphqlPreparation.operationNames.map((operationName) => (
                            <option key={operationName} value={operationName}>{operationName}</option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                )
                : (
                  <MonacoJsonEditor
                    value={editorPresentation.requestBody}
                    onChange={handleBodyChange}
                    readOnly={!isEditorSynchronized || isRunning}
                    height="clamp(180px, 42vh, 620px)"
                    placeholder="{}"
                  />
                )}
            </TabPanel>
            <TabPanel id="Headers" className={styles.tabContent}>
              <HeadersEditor
                headers={editorPresentation.requestHeaders.map((header) => ({ ...header }))}
                onChange={handleHeadersChange}
                disabled={!isEditorSynchronized || isRunning}
              />
            </TabPanel>
            <TabPanel id="Environment" className={styles.tabContent}>
              {environments.length === 0
                ? (
                  <div className={styles.emptyState}>
                    <strong>No environments yet</strong>
                    <span>
                      Create your first environment to start managing environment variables (e.g., Development, Staging,
                      Production).
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
                )
                : (
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
