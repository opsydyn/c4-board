/**
 * Postee Workspace Machine
 *
 * Coordinates collections, requests, environments, and request execution
 * for the Postman-inspired "Postee" tool.
 *
 * The machine orchestrates WHEN workflows occur; Effect services provide WHAT happens.
 */

import { Duration, Effect, Layer } from "effect";
import { nanoid } from "nanoid";
import { assign, fromPromise, setup } from "xstate";
import type { DoneActorEvent, ErrorActorEvent } from "xstate";
import { DatabaseService } from "../../core/effects/database.base";
import { DatabaseServiceLive } from "../../core/effects/database.runtime";
import {
  closePosteeScratchDraft,
  loadGraphqlSchemaSnapshot,
  loadPosteeRequestDraft,
  loadPosteeScratchDrafts,
  newPosteeScratchDraft,
  type PosteeCollection,
  PosteeCollections,
  type PosteeEnvironment,
  PosteeEnvironments,
  type PosteeEnvironmentVariable,
  type PosteeGraphqlSchemaSnapshot,
  PosteeHistory,
  type PosteeHistoryEntry,
  type PosteeRequest,
  type PosteeRequestDraft,
  PosteeRequests,
  type PosteeScratchDraft,
  preparePosteeDraftBody,
  preparePosteeDraftHeaders,
  promotePosteeScratchDraft,
  refreshGraphqlSchema,
  reopenPosteeScratchDraft,
  savePosteeRequestDraft,
  savePosteeScratchDraft,
} from "../../core/effects/postee";
import {
  HttpClient,
  HttpClientError,
  HttpClientLive,
  type PreparedRequest,
  type PreparedResponse,
  prepareRequest,
  resolveTemplate,
} from "../../core/effects/postee/http-client";
import type { EffectiveRequestHeader } from "../../core/effects/postee/http-method-policy";
import { deriveRequestStatuses, type RequestStatus } from "../../core/effects/postee/status-derivation";
import {
  type CollectionId,
  CollectionId as CollectionIdBrand,
  durationToMillis,
  type EnvironmentId,
  EnvironmentId as EnvironmentIdBrand,
  type HttpMethod,
  type RequestId,
  RequestId as RequestIdBrand,
} from "../../core/effects/postee/types";
import { type DerivedUIState, deriveUIState, type UIStateInput } from "../../core/effects/postee/ui-state";
import { type DerivedWorkspaceState, deriveWorkspaceState } from "../../core/effects/postee/workspace-state";

type WorkspaceEnv = DatabaseService | HttpClient;
type WorkspaceLayer = Layer.Layer<WorkspaceEnv, never, never>;

// =============================================================================
// Types
// =============================================================================

export interface RunnerState {
  status: "idle" | "running" | "success" | "error";
  requestId: RequestId | null;
  response: PreparedResponse | null;
  baselineResponse: PreparedResponse | null; // For diff comparison
  error: string | null;
  startedAt: number | null;
}

export interface RequestDraftSaveState {
  readonly status: "idle" | "saving" | "success" | "error";
  readonly requestId: RequestId | null;
  readonly error: string | null;
  readonly revision: number;
}

export interface ScratchPromotionState {
  readonly status: "idle" | "promoting" | "error";
  readonly scratchId: string | null;
  readonly collectionId: CollectionId | null;
  readonly error: string | null;
}

export type GraphqlSchemaUiState = "NoSchema" | "Cached" | "Stale" | "Refreshing" | "Unavailable";

export interface GraphqlSchemaState {
  readonly status: GraphqlSchemaUiState;
  readonly snapshot: PosteeGraphqlSchemaSnapshot | null;
  readonly error: string | null;
}

export type PosteeEditorTarget =
  | { readonly kind: "scratch"; readonly scratchId: string }
  | { readonly kind: "saved"; readonly requestId: RequestId }
  | null;

export interface PosteeContext {
  collections: PosteeCollection[];
  requestsByCollection: Record<string, PosteeRequest[]>;
  requestDrafts: Record<string, PosteeRequestDraft>;
  scratchDrafts: Record<string, PosteeScratchDraft>;
  openScratchIds: string[];
  closedScratchIds: string[];
  activeEditor: PosteeEditorTarget;
  pendingScratchPromotion: {
    readonly scratchId: string;
    readonly collectionId: CollectionId;
    readonly requestId: RequestId;
  } | null;
  scratchPromotion: ScratchPromotionState;
  pendingRequestDraft: PosteeRequestDraft | null;
  requestDraftSave: RequestDraftSaveState;
  graphqlSchema: GraphqlSchemaState;
  environments: PosteeEnvironment[];
  variablesByEnvironment: Record<string, PosteeEnvironmentVariable[]>;
  activeCollectionId: CollectionId | null;
  activeRequestId: RequestId | null;
  activeEnvironmentId: EnvironmentId | null;
  runner: RunnerState;
  history: PosteeHistoryEntry[];
  layer: WorkspaceLayer;

  // State flags for derived state
  isInitialising: boolean;
  isFailure: boolean;

  // Phase 2: Derived state from Effect services
  requestStatuses: Map<string, RequestStatus>; // Derived from history
  uiState: DerivedUIState; // Derived from UI flags
  uiFlags: UIStateInput; // Input flags for UI state derivation
  workspaceState: DerivedWorkspaceState; // Derived from workspace context
}

export type PosteeEvent =
  | { type: "REFRESH" }
  | { type: "CREATE_SCRATCH" }
  | { type: "SELECT_SCRATCH"; scratchId: string }
  | { type: "CLOSE_SCRATCH"; scratchId: string }
  | { type: "REOPEN_SCRATCH"; scratchId: string }
  | { type: "UPDATE_SCRATCH_DRAFT"; draft: PosteeScratchDraft }
  | { type: "PROMOTE_SCRATCH"; scratchId: string; collectionId: CollectionId; requestId: RequestId }
  | { type: "SELECT_COLLECTION"; collectionId: CollectionId }
  | { type: "SELECT_REQUEST"; requestId: RequestId }
  | { type: "SELECT_ENVIRONMENT"; environmentId: EnvironmentId | null }
  | { type: "RUN_REQUEST" }
  | { type: "RUN_CANCEL" }
  | { type: "REFRESH_HISTORY" }
  | { type: "REFRESH_GRAPHQL_SCHEMA" }
  | { type: "SAVE_REQUEST_DRAFT"; draft: PosteeRequestDraft }
  | { type: "SET_BASELINE_RESPONSE" } // Set current response as baseline for diff
  | { type: "CLEAR_BASELINE_RESPONSE" } // Clear baseline
  | {
    type: "CREATE_COLLECTION";
    payload: { id: CollectionId; name: string; description?: string };
  }
  | {
    type: "RENAME_COLLECTION";
    payload: { id: CollectionId; name: string };
  }
  | {
    type: "DELETE_COLLECTIONS";
    payload: { ids: CollectionId[] };
  }
  | {
    type: "CREATE_REQUEST";
    payload: {
      collectionId: CollectionId;
      id: RequestId;
      name: string;
      method: HttpMethod;
      url: string;
    };
  }
  | {
    type: "UPDATE_REQUEST_METADATA";
    payload: {
      id: RequestId;
      name?: string;
      method?: HttpMethod;
      url?: string;
      description?: string;
    };
  }
  | { type: "TOGGLE_FAVORITE"; payload: { id: RequestId; favorite: boolean } }
  | {
    type: "REQUEST_RUN_RESULT";
    requestId: RequestId;
    response: PreparedResponse;
  }
  | { type: "REQUEST_RUN_ERROR"; requestId: RequestId; message: string }
  | {
    type: "CREATE_ENVIRONMENT";
    payload: {
      id: string;
      name: string;
      description: string | null;
      is_default: number;
    };
  }
  | {
    type: "UPDATE_ENVIRONMENT_VARIABLES";
    payload: {
      environmentId: EnvironmentId;
      variables: PosteeEnvironmentVariable[];
    };
  }
  // Phase 2: UI state events
  | { type: "UI_TOGGLE_SIDEBAR" }
  | { type: "UI_TOGGLE_RESPONSE" }
  | { type: "UI_TOGGLE_ENVIRONMENT" }
  | { type: "UI_SET_COMPACT_LAYOUT"; compact: boolean }
  | { type: "UI_TOGGLE_DIFF" };

export interface LoadWorkspaceResult {
  collections: PosteeCollection[];
  requestMap: Record<string, PosteeRequest[]>;
  requestDrafts: Record<string, PosteeRequestDraft>;
  scratchDrafts: Record<string, PosteeScratchDraft>;
  openScratchIds: string[];
  closedScratchIds: string[];
  activeEditor: PosteeEditorTarget;
  environments: PosteeEnvironment[];
  variables: Record<string, PosteeEnvironmentVariable[]>;
  history: PosteeHistoryEntry[];
  defaultCollectionId: CollectionId | null;
  defaultRequestId: RequestId | null;
  defaultEnvironmentId: EnvironmentId | null;
}

export interface RunRequestResult {
  requestId: RequestId | null;
  response: PreparedResponse;
  prepared: PreparedRequest;
  historyEntry: PosteeHistoryEntry;
}

interface PromoteScratchResult {
  readonly scratchId: string;
  readonly collectionId: CollectionId;
  readonly requestId: RequestId;
  readonly draft: PosteeRequestDraft;
}

type LoadWorkspaceDoneEvent = DoneActorEvent<LoadWorkspaceResult, "loadWorkspace">;
type SaveRequestDraftDoneEvent = DoneActorEvent<PosteeRequestDraft, "saveRequestDraft">;
type SaveRequestDraftErrorEvent = ErrorActorEvent<unknown, "saveRequestDraft">;
type RunRequestDoneEvent = DoneActorEvent<RunRequestResult, "runRequest">;
type RunRequestErrorEvent = ErrorActorEvent<unknown, "runRequest">;
type PromoteScratchDoneEvent = DoneActorEvent<PromoteScratchResult, "promoteScratch">;
type PromoteScratchErrorEvent = ErrorActorEvent<unknown, "promoteScratch">;
type LoadGraphqlSchemaDoneEvent = DoneActorEvent<PosteeGraphqlSchemaSnapshot | null, "loadGraphqlSchema">;
type LoadGraphqlSchemaErrorEvent = ErrorActorEvent<unknown, "loadGraphqlSchema">;
type RefreshGraphqlSchemaDoneEvent = DoneActorEvent<PosteeGraphqlSchemaSnapshot, "refreshGraphqlSchema">;
type RefreshGraphqlSchemaErrorEvent = ErrorActorEvent<unknown, "refreshGraphqlSchema">;

type PosteeMachineEvent =
  | PosteeEvent
  | LoadWorkspaceDoneEvent
  | SaveRequestDraftDoneEvent
  | SaveRequestDraftErrorEvent
  | RunRequestDoneEvent
  | RunRequestErrorEvent
  | PromoteScratchDoneEvent
  | PromoteScratchErrorEvent
  | LoadGraphqlSchemaDoneEvent
  | LoadGraphqlSchemaErrorEvent
  | RefreshGraphqlSchemaDoneEvent
  | RefreshGraphqlSchemaErrorEvent;

// =============================================================================
// Helpers
// =============================================================================

/**
 * Run an Effect with the provided layer
 * This is idiomatic Effect - just provide the layer to the effect
 */
const runLayeredEffect = <A, E>(
  layer: WorkspaceLayer,
  effect: Effect.Effect<A, E, WorkspaceEnv>,
): Promise<A> => Effect.runPromise(Effect.provide(effect, layer));

const initialRunner = (): RunnerState => ({
  status: "idle",
  requestId: null,
  response: null,
  baselineResponse: null,
  error: null,
  startedAt: null,
});

const initialRequestDraftSave = (): RequestDraftSaveState => ({
  status: "idle",
  requestId: null,
  error: null,
  revision: 0,
});

const initialScratchPromotion = (): ScratchPromotionState => ({
  status: "idle",
  scratchId: null,
  collectionId: null,
  error: null,
});

const initialGraphqlSchema = (): GraphqlSchemaState => ({
  status: "NoSchema",
  snapshot: null,
  error: null,
});

const activeScratchDraft = (context: PosteeContext): PosteeScratchDraft | null =>
  context.activeEditor?.kind === "scratch"
    ? context.scratchDrafts[context.activeEditor.scratchId] ?? null
    : null;

const activeSavedRequestId = (context: PosteeContext): RequestId | null =>
  context.activeEditor?.kind === "scratch"
    ? null
    : context.activeEditor?.kind === "saved"
    ? context.activeEditor.requestId
    : context.activeRequestId;

const activeExecutionRequestId = (context: PosteeContext): RequestId | null => {
  const scratch = activeScratchDraft(context);
  return scratch ? RequestIdBrand(scratch.id) : activeSavedRequestId(context);
};

const graphqlSchemaContext = (context: PosteeContext) => {
  const requestId = context.activeRequestId as unknown as string | null;
  const draft = requestId ? context.requestDrafts[requestId] : null;
  if (!draft || draft.body.mode !== "graphql" || draft.graphql === null) {
    return null;
  }

  const variables = context.activeEnvironmentId
    ? context.variablesByEnvironment[context.activeEnvironmentId as unknown as string] ?? []
    : [];
  const environment = { variables };
  const headers: ReadonlyArray<EffectiveRequestHeader> = draft.headers
    .filter((header) => header.enabled)
    .map((header) => ({
      key: resolveTemplate(header.key, environment),
      value: resolveTemplate(header.value, environment),
    }))
    .filter((header) => header.key.trim().length > 0);

  return {
    endpointUrl: resolveTemplate(draft.request.url, environment),
    headers,
  };
};

const defaultRequestDraft = (request: PosteeRequest): PosteeRequestDraft => ({
  request,
  headers: [],
  body: {
    request_id: request.id,
    mode: "json",
    raw: "{}",
    form_values: null,
  },
  graphql: null,
});

// =============================================================================
// Machine
// =============================================================================

// @ts-nocheck - XState v5 has deep type inference that can cause stack overflow in tsc
// The types are still checked by ESLint and the IDE
const posteeWorkspaceSetup = setup({
  types: {
    context: {} as PosteeContext,
    events: {} as PosteeMachineEvent,
  },
  actors: {
    loadWorkspace: fromPromise<
      LoadWorkspaceResult,
      { layer: WorkspaceLayer }
    >(async ({ input }) => {
      const layer = input.layer;
      return runLayeredEffect(
        layer,
        Effect.gen(function*() {
          const collections = yield* PosteeCollections.list();

          const requestPairs = yield* Effect.forEach(
            collections,
            (collection) =>
              Effect.map(PosteeRequests.list(collection.id), (requests) =>
                [
                  collection.id,
                  requests,
                ] as const),
            { batching: true },
          );

          const requestMap = Object.fromEntries(requestPairs);
          const requestDraftEntries = yield* Effect.forEach(
            Object.values(requestMap).flat(),
            (request) =>
              Effect.map(
                loadPosteeRequestDraft(request),
                (draft) => [request.id, draft] as const,
              ),
            { batching: true },
          );

          const environments = yield* PosteeEnvironments.list();

          const variableEntries = yield* Effect.forEach(
            environments,
            (environment) =>
              Effect.map(
                PosteeEnvironments.listVariables(environment.id),
                (variables) => [environment.id, variables] as const,
              ),
            { batching: true },
          );

          const history = yield* PosteeHistory.list(50);
          const recoveredScratchDrafts = yield* loadPosteeScratchDrafts();
          const freshScratch = newPosteeScratchDraft({
            id: nanoid(),
            tabOrder: 0,
            now: Date.now(),
          });
          yield* savePosteeScratchDraft(freshScratch);

          const requestDrafts = Object.fromEntries(requestDraftEntries);
          const variables = Object.fromEntries(variableEntries);
          const scratchDrafts = Object.fromEntries([
            ...recoveredScratchDrafts.map((draft) => [draft.id, { ...draft, isOpen: false }] as const),
            [freshScratch.id, freshScratch] as const,
          ]);

          // Brand IDs from database strings
          const firstCollectionId = collections[0]?.id;
          const firstCollection = firstCollectionId
            ? CollectionIdBrand(firstCollectionId)
            : null;

          const firstRequestId = firstCollectionId && requestMap[firstCollectionId]?.[0]?.id;
          const firstRequest = firstRequestId
            ? RequestIdBrand(firstRequestId)
            : null;

          const defaultEnvironmentId = environments.find((env) => env.is_default === 1)?.id
            ?? environments[0]?.id;
          const defaultEnvironment = defaultEnvironmentId
            ? EnvironmentIdBrand(defaultEnvironmentId)
            : null;

          return {
            collections,
            requestMap,
            requestDrafts,
            scratchDrafts,
            openScratchIds: [freshScratch.id],
            closedScratchIds: recoveredScratchDrafts.map((draft) => draft.id),
            activeEditor: { kind: "scratch", scratchId: freshScratch.id },
            environments,
            variables,
            history,
            defaultCollectionId: firstCollection,
            defaultRequestId: firstRequest,
            defaultEnvironmentId: defaultEnvironment,
          } satisfies LoadWorkspaceResult;
        }),
      );
    }),

    saveRequestDraft: fromPromise<
      PosteeRequestDraft,
      {
        layer: WorkspaceLayer;
        draft: PosteeRequestDraft | null;
      }
    >(async ({ input }) => {
      if (!input.draft) {
        throw new Error("No request draft staged for save");
      }
      return runLayeredEffect(
        input.layer,
        savePosteeRequestDraft(input.draft),
      );
    }),

    loadGraphqlSchema: fromPromise<
      PosteeGraphqlSchemaSnapshot | null,
      { layer: WorkspaceLayer; context: PosteeContext }
    >(async ({ input }) => {
      const schemaContext = graphqlSchemaContext(input.context);
      if (schemaContext === null) return null;
      return runLayeredEffect(
        input.layer,
        loadGraphqlSchemaSnapshot(schemaContext),
      );
    }),

    refreshGraphqlSchema: fromPromise<
      PosteeGraphqlSchemaSnapshot,
      { layer: WorkspaceLayer; context: PosteeContext }
    >(async ({ input }) => {
      const schemaContext = graphqlSchemaContext(input.context);
      if (schemaContext === null) {
        throw new Error("No saved GraphQL request is selected");
      }
      return runLayeredEffect(
        input.layer,
        refreshGraphqlSchema(schemaContext),
      );
    }),

    runRequest: fromPromise<
      RunRequestResult,
      {
        layer: WorkspaceLayer;
        context: PosteeContext;
      }
    >(async ({ input }) => {
      const { layer, context } = input;
      const scratch = activeScratchDraft(context);
      const savedRequestId = activeSavedRequestId(context);
      if (!scratch && !savedRequestId) {
        throw new Error("No active request selected");
      }

      const environmentId = scratch?.environmentId
        ? EnvironmentIdBrand(scratch.environmentId)
        : context.activeEnvironmentId;

      const requestEffect = Effect.gen(function*() {
        const request = scratch
          ? {
            id: scratch.id,
            collection_id: "",
            name: scratch.name,
            method: scratch.method,
            url: scratch.url,
            description: scratch.description,
            favorite: 0,
            sort_order: scratch.tabOrder,
            created_at: scratch.createdAt,
            updated_at: scratch.updatedAt,
          }
          : yield* PosteeRequests.get(savedRequestId as unknown as string);
        if (!request) {
          throw new Error(`Request ${savedRequestId} not found`);
        }

        const headers = scratch
          ? scratch.headers.map((header, index) => ({
            id: index,
            request_id: scratch.id,
            key: header.key,
            value: header.value,
            is_enabled: header.enabled ? 1 : 0,
            sort_order: index,
          }))
          : yield* PosteeRequests.listHeaders(savedRequestId as unknown as string);
        const body = scratch
          ? { ...scratch.body, request_id: scratch.id }
          : yield* PosteeRequests.getBody(savedRequestId as unknown as string);
        const graphql = scratch
          ? scratch.graphql === null ? null : { ...scratch.graphql, request_id: scratch.id }
          : yield* PosteeRequests.getGraphql(savedRequestId as unknown as string);

        // Lookup variables by environment (need string key for Record)
        const variables = (environmentId
          && context.variablesByEnvironment[environmentId as unknown as string])
          || [];

        const draft: PosteeRequestDraft = {
          request,
          headers: scratch
            ? scratch.headers
            : headers.map((header) => ({
              id: String(header.id),
              key: header.key,
              value: header.value ?? "",
              enabled: header.is_enabled === 1,
            })),
          body: body ?? {
            request_id: request.id,
            mode: "raw",
            raw: null,
            form_values: null,
          },
          graphql,
        };
        const requestBody = yield* preparePosteeDraftBody(draft).pipe(
          Effect.mapError((message) => HttpClientError({ message })),
        );
        const requestHeaders = preparePosteeDraftHeaders(draft).map((header, index) => ({
          id: index,
          request_id: request.id,
          key: header.key,
          value: header.value,
          is_enabled: 1,
          sort_order: index,
        }));

        const prepared = yield* prepareRequest({
          id: RequestIdBrand(request.id),
          method: request.method as HttpMethod,
          url: request.url,
          headers: requestHeaders,
          body: requestBody,
          env: { variables },
          timeout: Duration.seconds(30),
        });

        const client = yield* HttpClient;
        const response = yield* client.send(prepared);

        const historyId = nanoid();

        const historyEntry: PosteeHistoryEntry = {
          id: historyId,
          request_id: savedRequestId as unknown as string ?? null,
          request_snapshot: JSON.stringify(
            {
              request,
              headers: draft.body.mode === "graphql"
                ? headers.map((header) => ({ ...header, value: header.value === null ? null : "[redacted]" }))
                : headers,
              body,
              environmentId,
              prepared: draft.body.mode === "graphql"
                ? { ...prepared, headers: prepared.headers.map((header) => ({ ...header, value: "[redacted]" })) }
                : prepared,
            },
            null,
            2,
          ),
          response_status: response.status,
          response_time_ms: durationToMillis(response.duration),
          response_size_bytes: response.rawSize,
          response_body: response.bodyText, // ✅ Save response body as JSON
          response_headers: JSON.stringify(response.headers), // ✅ Save headers as JSON
          error_message: null,
          executed_at: Date.now(),
        };

        yield* PosteeHistory.record(historyEntry);

        return { requestId: savedRequestId, prepared, response, historyEntry };
      });

      return runLayeredEffect(layer, requestEffect);
    }),

    promoteScratch: fromPromise<
      PromoteScratchResult,
      { layer: WorkspaceLayer; context: PosteeContext }
    >(async ({ input }) => {
      const pending = input.context.pendingScratchPromotion;
      if (!pending) {
        throw new Error("No scratch promotion is pending");
      }
      const scratch = input.context.scratchDrafts[pending.scratchId];
      if (!scratch) {
        throw new Error("Scratch draft is no longer available");
      }
      const draft = await runLayeredEffect(
        input.layer,
        promotePosteeScratchDraft({
          scratch,
          collectionId: pending.collectionId as unknown as string,
          requestId: pending.requestId as unknown as string,
        }),
      );
      return { ...pending, draft };
    }),
  },
  guards: {
    hasActiveRequest: ({ context }) => activeExecutionRequestId(context) !== null,
    hasActiveGraphqlRequest: ({ context }) => graphqlSchemaContext(context) !== null,
  },
  actions: {
    createScratch: assign(({ context }) => {
      const tabOrder = context.openScratchIds.length;
      const scratch = newPosteeScratchDraft({
        id: nanoid(),
        tabOrder,
        now: Date.now(),
      });

      runLayeredEffect(context.layer, savePosteeScratchDraft(scratch)).catch(() => {
        // Scratch remains available in memory when durable persistence fails.
      });

      return {
        ...context,
        scratchDrafts: {
          ...context.scratchDrafts,
          [scratch.id]: scratch,
        },
        openScratchIds: [...context.openScratchIds, scratch.id],
        activeEditor: { kind: "scratch", scratchId: scratch.id },
        runner: initialRunner(),
      };
    }),
    selectScratch: assign(({ context, event }) => {
      if (event.type !== "SELECT_SCRATCH" || !context.openScratchIds.includes(event.scratchId)) {
        return context;
      }
      return {
        ...context,
        activeEditor: { kind: "scratch" as const, scratchId: event.scratchId },
        runner: initialRunner(),
      };
    }),
    closeScratch: assign(({ context, event }) => {
      if (event.type !== "CLOSE_SCRATCH" || !context.openScratchIds.includes(event.scratchId)) {
        return context;
      }

      runLayeredEffect(context.layer, closePosteeScratchDraft(event.scratchId)).catch(() => {
        // Scratch remains in memory when durable persistence fails.
      });

      return {
        ...context,
        openScratchIds: context.openScratchIds.filter((id) => id !== event.scratchId),
        closedScratchIds: [...context.closedScratchIds.filter((id) => id !== event.scratchId), event.scratchId],
        activeEditor: context.activeEditor?.kind === "scratch" && context.activeEditor.scratchId === event.scratchId
          ? null
          : context.activeEditor,
        runner: initialRunner(),
      };
    }),
    reopenScratch: assign(({ context, event }) => {
      if (event.type !== "REOPEN_SCRATCH" || !context.closedScratchIds.includes(event.scratchId)) {
        return context;
      }

      runLayeredEffect(context.layer, reopenPosteeScratchDraft(event.scratchId)).catch(() => {
        // Scratch remains reopenable in memory when durable persistence fails.
      });

      return {
        ...context,
        openScratchIds: [...context.openScratchIds, event.scratchId],
        closedScratchIds: context.closedScratchIds.filter((id) => id !== event.scratchId),
        activeEditor: { kind: "scratch", scratchId: event.scratchId },
        runner: initialRunner(),
      };
    }),
    updateScratchDraft: assign(({ context, event }) => {
      if (event.type !== "UPDATE_SCRATCH_DRAFT" || context.scratchDrafts[event.draft.id] === undefined) {
        return context;
      }

      const draft = { ...event.draft, updatedAt: Date.now() };
      runLayeredEffect(context.layer, savePosteeScratchDraft(draft)).catch(() => {
        // Scratch remains available in memory when durable persistence fails.
      });

      return {
        ...context,
        scratchDrafts: {
          ...context.scratchDrafts,
          [draft.id]: draft,
        },
      };
    }),
    stageScratchPromotion: assign(({ context, event }) => {
      if (event.type !== "PROMOTE_SCRATCH" || !context.scratchDrafts[event.scratchId]) {
        return context;
      }
      return {
        ...context,
        pendingScratchPromotion: {
          scratchId: event.scratchId,
          collectionId: event.collectionId,
          requestId: event.requestId,
        },
        scratchPromotion: {
          status: "promoting" as const,
          scratchId: event.scratchId,
          collectionId: event.collectionId,
          error: null,
        },
      };
    }),
    publishPromotedScratch: assign(({ context, event }) => {
      if (event.type !== "xstate.done.actor.promoteScratch") {
        return context;
      }
      const { scratchId, collectionId, requestId, draft } = event.output;
      const { [scratchId]: _discarded, ...scratchDrafts } = context.scratchDrafts;
      const collectionKey = collectionId as unknown as string;
      return {
        ...context,
        scratchDrafts,
        openScratchIds: context.openScratchIds.filter((id) => id !== scratchId),
        closedScratchIds: context.closedScratchIds.filter((id) => id !== scratchId),
        pendingScratchPromotion: null,
        scratchPromotion: initialScratchPromotion(),
        requestDrafts: {
          ...context.requestDrafts,
          [requestId]: draft,
        },
        requestsByCollection: {
          ...context.requestsByCollection,
          [collectionKey]: [
            draft.request,
            ...(context.requestsByCollection[collectionKey] ?? []),
          ],
        },
        activeCollectionId: collectionId,
        activeRequestId: requestId,
        activeEditor: { kind: "saved" as const, requestId },
      };
    }),
    failScratchPromotion: assign(({ context, event }) => {
      if (event.type !== "xstate.error.actor.promoteScratch") {
        return context;
      }
      return {
        ...context,
        scratchPromotion: {
          ...context.scratchPromotion,
          status: "error" as const,
          error: "Unable to save scratch request. Try again.",
        },
      };
    }),
    createCollection: assign(({ context, event }) => {
      if (!event || event.type !== "CREATE_COLLECTION") {
        return context;
      }

      const collectionId = event.payload.id as unknown as string;
      const now = Date.now();

      runLayeredEffect(
        context.layer,
        PosteeCollections.create({
          id: collectionId,
          name: event.payload.name,
          description: event.payload.description ?? null,
          sort_order: context.collections.length + 1,
        }),
      ).catch(() => {
        // TODO: surface error to user once notifications are wired up
      });

      const newCollection: PosteeCollection = {
        id: collectionId,
        name: event.payload.name,
        description: event.payload.description ?? null,
        sort_order: context.collections.length + 1,
        created_at: now,
        updated_at: now,
      };

      return {
        ...context,
        collections: [newCollection, ...context.collections],
        requestsByCollection: {
          ...context.requestsByCollection,
          [collectionId]: [],
        },
        activeCollectionId: event.payload.id,
        activeRequestId: null,
      };
    }),
    renameCollection: assign(({ context, event }) => {
      if (!event || event.type !== "RENAME_COLLECTION") {
        return context;
      }

      const collectionId = event.payload.id as unknown as string;
      const existing = context.collections.find(
        (collection) => collection.id === collectionId,
      );

      if (!existing) {
        return context;
      }

      const updatedAt = Date.now();
      const updatedCollection: PosteeCollection = {
        ...existing,
        name: event.payload.name,
        updated_at: updatedAt,
      };

      runLayeredEffect(
        context.layer,
        PosteeCollections.update(updatedCollection),
      ).catch(() => {
        // TODO: surface error to user once notifications are wired up
      });

      return {
        ...context,
        collections: context.collections.map((collection) =>
          collection.id === collectionId ? updatedCollection : collection
        ),
      };
    }),
    deleteCollections: assign(({ context, event }) => {
      if (!event || event.type !== "DELETE_COLLECTIONS" || event.payload.ids.length === 0) {
        return context;
      }

      const ids = event.payload.ids.map((id) => id as unknown as string);
      const deletedSet = new Set(ids);

      const remainingCollections = context.collections.filter(
        (collection) => !deletedSet.has(collection.id),
      );

      const nextRequestsByCollection = Object.fromEntries(
        Object.entries(context.requestsByCollection).filter(
          ([collectionId]) => !deletedSet.has(collectionId),
        ),
      );
      const nextRequestDrafts = Object.fromEntries(
        Object.entries(context.requestDrafts).filter(
          ([, draft]) => !deletedSet.has(draft.request.collection_id),
        ),
      );

      runLayeredEffect(
        context.layer,
        ids.length === 1 && ids[0]
          ? PosteeCollections.remove(ids[0])
          : PosteeCollections.removeMany(ids),
      ).catch(() => {
        // TODO: surface error to user once notifications are wired up
      });

      let nextActiveCollectionId = context.activeCollectionId;
      if (
        !nextActiveCollectionId
        || deletedSet.has(nextActiveCollectionId as unknown as string)
      ) {
        const first = remainingCollections[0];
        nextActiveCollectionId = first ? CollectionIdBrand(first.id) : null;
      }

      let nextActiveRequestId: RequestId | null = context.activeRequestId;
      if (nextActiveCollectionId) {
        const collectionKey = nextActiveCollectionId as unknown as string;
        const requests = nextRequestsByCollection[collectionKey] ?? [];
        if (
          !nextActiveRequestId
          || !requests.some(
            (request) => request.id === (nextActiveRequestId as unknown as string),
          )
        ) {
          nextActiveRequestId = requests[0]
            ? RequestIdBrand(requests[0].id)
            : null;
        }
      } else {
        nextActiveRequestId = null;
      }

      return {
        ...context,
        collections: remainingCollections,
        requestsByCollection: nextRequestsByCollection,
        requestDrafts: nextRequestDrafts,
        activeCollectionId: nextActiveCollectionId,
        activeRequestId: nextActiveRequestId,
      };
    }),
    selectCollection: assign({
      activeCollectionId: ({ event }) => event.type === "SELECT_COLLECTION" ? event.collectionId : null,
      activeRequestId: ({ context, event }) => {
        if (event.type !== "SELECT_COLLECTION") {
          return context.activeRequestId;
        }
        // Need to look up by the raw string ID from database
        const collectionId = event.collectionId as unknown as string;
        const nextRequests = context.requestsByCollection[collectionId] ?? [];
        const firstRequestId = nextRequests[0]?.id;
        return firstRequestId ? RequestIdBrand(firstRequestId) : null;
      },
      activeEditor: ({ context, event }) => {
        if (event.type !== "SELECT_COLLECTION") return context.activeEditor;
        const firstRequest = context.requestsByCollection[event.collectionId as unknown as string]?.[0];
        return firstRequest ? { kind: "saved" as const, requestId: RequestIdBrand(firstRequest.id) } : null;
      },
      runner: () => initialRunner(),
    }),
    selectRequest: assign({
      activeRequestId: ({ event }) => event.type === "SELECT_REQUEST" ? event.requestId : null,
      activeEditor: ({ context, event }) =>
        event.type === "SELECT_REQUEST"
          ? { kind: "saved" as const, requestId: event.requestId }
          : context.activeEditor,
      runner: () => initialRunner(),
    }),
    selectEnvironment: assign({
      activeEnvironmentId: ({ context, event }) => {
        if (event.type !== "SELECT_ENVIRONMENT") {
          return context.activeEnvironmentId;
        }
        return event.environmentId;
      },
    }),
    createEnvironment: assign(({ context, event }) => {
      if (!event || event.type !== "CREATE_ENVIRONMENT") {
        return context;
      }

      const now = Date.now();

      runLayeredEffect(
        context.layer,
        PosteeEnvironments.create({
          id: event.payload.id,
          name: event.payload.name,
          description: event.payload.description,
          is_default: event.payload.is_default,
        }),
      ).catch(() => {
        // TODO: surface error to user once notifications are wired up
      });

      const newEnvironment: PosteeEnvironment = {
        id: event.payload.id,
        name: event.payload.name,
        description: event.payload.description,
        is_default: event.payload.is_default,
        created_at: now,
        updated_at: now,
      };

      return {
        ...context,
        environments: [...context.environments, newEnvironment],
        activeEnvironmentId: EnvironmentIdBrand(event.payload.id),
      };
    }),
    updateEnvironmentVariables: assign(({ context, event }) => {
      if (!event || event.type !== "UPDATE_ENVIRONMENT_VARIABLES") {
        return context;
      }

      const envId = event.payload.environmentId as unknown as string;

      // Run the Effect to persist to database
      runLayeredEffect(
        context.layer,
        PosteeEnvironments.saveVariables(
          envId,
          event.payload.variables.map((v) => ({
            environment_id: v.environment_id,
            key: v.key,
            value: v.value,
            is_secret: v.is_secret,
            is_enabled: v.is_enabled,
            sort_order: v.sort_order,
          })),
        ),
      ).catch(() => {
        // TODO: surface error to user once notifications are wired up
      });

      // Update local context
      return {
        ...context,
        variablesByEnvironment: {
          ...context.variablesByEnvironment,
          [envId]: event.payload.variables,
        },
      };
    }),
    createRequest: assign(({ context, event }) => {
      if (!event || event.type !== "CREATE_REQUEST") {
        return context;
      }

      const collectionKey = event.payload.collectionId as unknown as string;
      const requestId = event.payload.id as unknown as string;
      const now = Date.now();

      runLayeredEffect(
        context.layer,
        PosteeRequests.create({
          id: requestId,
          collection_id: collectionKey,
          name: event.payload.name,
          method: event.payload.method,
          url: event.payload.url,
          description: null,
          favorite: 0,
          sort_order: (context.requestsByCollection[collectionKey]?.length ?? 0) + 1,
        }),
      ).catch(() => {
        // TODO: surface error to user once notifications are wired up
      });

      const nextRequest: PosteeRequest = {
        id: requestId,
        collection_id: collectionKey,
        name: event.payload.name,
        method: event.payload.method,
        url: event.payload.url,
        description: null,
        favorite: 0,
        sort_order: (context.requestsByCollection[collectionKey]?.length ?? 0) + 1,
        created_at: now,
        updated_at: now,
      };

      const nextRequests = [
        nextRequest,
        ...(context.requestsByCollection[collectionKey] ?? []),
      ];

      return {
        ...context,
        requestsByCollection: {
          ...context.requestsByCollection,
          [collectionKey]: nextRequests,
        },
        requestDrafts: {
          ...context.requestDrafts,
          [requestId]: defaultRequestDraft(nextRequest),
        },
        activeCollectionId: event.payload.collectionId,
        activeRequestId: event.payload.id,
        activeEditor: { kind: "saved" as const, requestId: event.payload.id },
      };
    }),
    updateRequestMetadata: assign(({ context, event }) => {
      if (!event || event.type !== "UPDATE_REQUEST_METADATA") {
        return context;
      }

      const requestId = event.payload.id as unknown as string;
      let targetCollectionKey: string | null = null;
      let existingRequest: PosteeRequest | undefined;

      for (
        const [key, requests] of Object.entries(
          context.requestsByCollection,
        )
      ) {
        const match = requests.find((request) => request.id === requestId);
        if (match) {
          targetCollectionKey = key;
          existingRequest = match;
          break;
        }
      }

      if (!targetCollectionKey || !existingRequest) {
        return context;
      }

      const updatedAt = Date.now();
      const updatedRequest: PosteeRequest = {
        ...existingRequest,
        name: event.payload.name ?? existingRequest.name,
        method: event.payload.method ?? existingRequest.method,
        url: event.payload.url ?? existingRequest.url,
        description: event.payload.description ?? existingRequest.description,
        updated_at: updatedAt,
      };

      runLayeredEffect(
        context.layer,
        PosteeRequests.update(updatedRequest),
      ).catch(() => {
        // TODO: surface error to user once notifications are wired up
      });

      return {
        ...context,
        requestsByCollection: {
          ...context.requestsByCollection,
          [targetCollectionKey]: context.requestsByCollection[targetCollectionKey]?.map(
            (request) => (request.id === requestId ? updatedRequest : request),
          ) ?? [],
        },
        activeRequestId: event.payload.id,
        activeEditor: { kind: "saved" as const, requestId: event.payload.id },
      };
    }),
    assignWorkspace: assign(({ context, event }) => {
      if (event.type !== "xstate.done.actor.loadWorkspace") {
        return context;
      }

      const {
        collections,
        requestMap,
        requestDrafts,
        scratchDrafts,
        openScratchIds,
        closedScratchIds,
        activeEditor,
        environments,
        variables,
        history,
        defaultCollectionId,
        defaultRequestId,
        defaultEnvironmentId,
      } = event.output;

      return {
        ...context,
        collections,
        requestsByCollection: requestMap,
        requestDrafts,
        scratchDrafts,
        openScratchIds,
        closedScratchIds,
        activeEditor,
        environments,
        variablesByEnvironment: variables,
        history,
        activeCollectionId: defaultCollectionId,
        activeRequestId: defaultRequestId,
        activeEnvironmentId: defaultEnvironmentId,
        runner: initialRunner(),
      };
    }),
    stageRequestDraft: assign(({ context, event }) => {
      if (event.type !== "SAVE_REQUEST_DRAFT") {
        return context;
      }

      return {
        ...context,
        pendingRequestDraft: event.draft,
        requestDraftSave: {
          status: "saving",
          requestId: RequestIdBrand(event.draft.request.id),
          error: null,
          revision: context.requestDraftSave.revision,
        },
      };
    }),
    publishSavedRequestDraft: assign(({ context, event }) => {
      if (event.type !== "xstate.done.actor.saveRequestDraft") {
        return context;
      }

      const draft = event.output;
      const requestId = draft.request.id;
      const collectionId = draft.request.collection_id;

      return {
        ...context,
        requestsByCollection: {
          ...context.requestsByCollection,
          [collectionId]: context.requestsByCollection[collectionId]?.map(
            (request) => request.id === requestId ? draft.request : request,
          ) ?? [],
        },
        requestDrafts: {
          ...context.requestDrafts,
          [requestId]: draft,
        },
        pendingRequestDraft: null,
        requestDraftSave: {
          status: "success",
          requestId: RequestIdBrand(requestId),
          error: null,
          revision: context.requestDraftSave.revision + 1,
        },
      };
    }),
    failRequestDraftSave: assign(({ context, event }) => {
      if (event.type !== "xstate.error.actor.saveRequestDraft") {
        return context;
      }

      return {
        ...context,
        pendingRequestDraft: null,
        requestDraftSave: {
          ...context.requestDraftSave,
          status: "error",
          error: "Request draft save failed. Try again.",
        },
      };
    }),
    startGraphqlSchemaLoad: assign({
      graphqlSchema: () => ({
        status: "Refreshing",
        snapshot: null,
        error: null,
      }),
    }),
    publishLoadedGraphqlSchema: assign(({ context, event }) => {
      if (event.type !== "xstate.done.actor.loadGraphqlSchema") {
        return context;
      }
      return {
        ...context,
        graphqlSchema: event.output === null
          ? initialGraphqlSchema()
          : {
            status: "Cached" as const,
            snapshot: event.output,
            error: null,
          },
      };
    }),
    failGraphqlSchemaLoad: assign(({ context, event }) => {
      if (event.type !== "xstate.error.actor.loadGraphqlSchema") {
        return context;
      }
      return {
        ...context,
        graphqlSchema: {
          status: "Unavailable" as const,
          snapshot: null,
          error: "Unable to load the cached GraphQL schema.",
        },
      };
    }),
    startGraphqlSchemaRefresh: assign(({ context }) => ({
      ...context,
      graphqlSchema: {
        status: "Refreshing" as const,
        snapshot: context.graphqlSchema.snapshot,
        error: null,
      },
    })),
    publishRefreshedGraphqlSchema: assign(({ context, event }) => {
      if (event.type !== "xstate.done.actor.refreshGraphqlSchema") {
        return context;
      }
      return {
        ...context,
        graphqlSchema: {
          status: "Cached" as const,
          snapshot: event.output,
          error: null,
        },
      };
    }),
    failGraphqlSchemaRefresh: assign(({ context, event }) => {
      if (event.type !== "xstate.error.actor.refreshGraphqlSchema") {
        return context;
      }
      return {
        ...context,
        graphqlSchema: {
          status: context.graphqlSchema.snapshot === null ? "Unavailable" as const : "Stale" as const,
          snapshot: context.graphqlSchema.snapshot,
          error: "Unable to refresh the GraphQL schema.",
        },
      };
    }),
    rejectGraphqlSchemaRefresh: assign(({ context }) => ({
      ...context,
      graphqlSchema: {
        status: context.graphqlSchema.snapshot === null ? "Unavailable" as const : "Stale" as const,
        snapshot: context.graphqlSchema.snapshot,
        error: "Select a saved GraphQL request before refreshing its schema.",
      },
    })),
    markRunnerIdle: assign({
      runner: () => initialRunner(),
    }),
    markRunnerRunning: assign({
      runner: ({ context }) => ({
        ...context.runner,
        status: "running" as const,
        requestId: activeSavedRequestId(context),
        error: null,
        startedAt: Date.now(),
      }),
    }),
    markRunnerSuccess: assign({
      runner: ({ context, event }) => {
        if (!event || event.type !== "REQUEST_RUN_RESULT") {
          return context.runner;
        }

        return {
          status: "success" as const,
          requestId: event.requestId,
          response: event.response,
          baselineResponse: context.runner.baselineResponse, // Preserve baseline
          error: null,
          startedAt: context.runner.startedAt,
        };
      },
    }),
    markRunnerError: assign({
      runner: ({ context, event }) => {
        if (!event || event.type !== "REQUEST_RUN_ERROR") {
          return context.runner;
        }

        const errorText = (() => {
          const message = event.message;
          if (typeof message === "string" && message.length > 0) {
            return message;
          }
          try {
            return JSON.stringify(message, null, 2);
          } catch {
            return String(message ?? "Request failed");
          }
        })();

        return {
          status: "error" as const,
          requestId: event.requestId,
          response: null,
          baselineResponse: context.runner.baselineResponse, // Preserve baseline
          error: errorText,
          startedAt: context.runner.startedAt,
        };
      },
    }),
    setBaselineResponse: assign({
      runner: ({ context }) => ({
        ...context.runner,
        baselineResponse: context.runner.response,
      }),
    }),
    clearBaselineResponse: assign({
      runner: ({ context }) => ({
        ...context.runner,
        baselineResponse: null,
      }),
    }),
    updateRunnerOnSuccess: assign({
      runner: ({ context, event }) => {
        if (event.type !== "xstate.done.actor.runRequest") {
          return context.runner;
        }
        const { response, requestId } = event.output;
        return {
          status: "success" as const,
          requestId,
          response,
          baselineResponse: context.runner.baselineResponse, // Preserve baseline
          error: null,
          startedAt: context.runner.startedAt,
        };
      },
    }),
    updateHistoryOnSuccess: assign({
      history: ({ context, event }) => {
        if (event.type !== "xstate.done.actor.runRequest") {
          return context.history;
        }
        const entry = event.output.historyEntry;
        return [entry, ...context.history].slice(0, 50);
      },
    }),
    updateRunnerOnError: assign({
      runner: ({ context, event }) => {
        if (event.type !== "xstate.error.actor.runRequest") {
          return context.runner;
        }
        const rawError = event.error ?? null;
        const errorText = (() => {
          if (!rawError) {
            return "Request failed";
          }
          if (typeof rawError === "string") {
            return rawError;
          }
          if (rawError instanceof Error) {
            const base = rawError.stack ?? rawError.message;
            const cause = rawError.cause;
            const causeText = cause
              ? `\nCause: ${JSON.stringify(cause, null, 2)}`
              : "";
            return `${base}${causeText}`;
          }
          try {
            return JSON.stringify(rawError, null, 2);
          } catch {
            return String(rawError);
          }
        })();
        return {
          status: "error" as const,
          requestId: activeSavedRequestId(context),
          response: null,
          baselineResponse: context.runner.baselineResponse, // Preserve baseline
          error: errorText,
          startedAt: context.runner.startedAt,
        };
      },
    }),
    recordErrorHistory: assign({
      history: ({ context, event }) => {
        if (event.type !== "xstate.error.actor.runRequest") {
          return context.history;
        }

        const scratch = activeScratchDraft(context);
        const requestId = activeSavedRequestId(context);
        const request = scratch ?? (requestId
          ? Object.values(context.requestsByCollection)
            .flat()
            .find((candidate) => candidate.id === requestId)
          : null);
        if (!request) {
          return context.history;
        }

        // Get the error text (same logic as updateRunnerOnError)
        const rawError = event.error ?? null;
        const errorText = (() => {
          if (!rawError) {
            return "Request failed";
          }
          if (typeof rawError === "string") {
            return rawError;
          }
          if (rawError instanceof Error) {
            const base = rawError.stack ?? rawError.message;
            const cause = rawError.cause;
            const causeText = cause
              ? `\nCause: ${JSON.stringify(cause, null, 2)}`
              : "";
            return `${base}${causeText}`;
          }
          try {
            return JSON.stringify(rawError, null, 2);
          } catch {
            return String(rawError);
          }
        })();

        // Get current environment variables
        const environmentId = scratch?.environmentId
          ? EnvironmentIdBrand(scratch.environmentId)
          : context.activeEnvironmentId;
        const variables = environmentId
          ? context.variablesByEnvironment[environmentId as unknown as string] ?? []
          : [];

        // Calculate duration if we have a start time
        const durationMs = context.runner.startedAt
          ? Date.now() - context.runner.startedAt
          : null;

        // Create history entry for the error
        const historyEntry: PosteeHistoryEntry = {
          id: nanoid(),
          request_id: requestId as unknown as string ?? null,
          request_snapshot: JSON.stringify(
            {
              request,
              environmentId,
              variables,
            },
            null,
            2,
          ),
          response_status: null, // No status code on error
          response_time_ms: durationMs,
          response_size_bytes: null,
          response_body: null, // No response body on error
          response_headers: null, // No headers on error
          error_message: errorText,
          executed_at: Date.now(),
        };

        // Run the effect to save to database (fire and forget)
        runLayeredEffect(
          context.layer,
          PosteeHistory.record(historyEntry),
        );

        // Add to history array (same as updateHistoryOnSuccess)
        return [historyEntry, ...context.history].slice(0, 50);
      },
    }),
    abortInFlight: ({ context }) => {
      const requestId = activeExecutionRequestId(context);
      if (!requestId) {
        return;
      }

      // Fire and forget - we don't await the abort
      // This is idiomatic for XState actions that trigger side effects
      runLayeredEffect(
        context.layer,
        Effect.flatMap(HttpClient, (client) => client.abort(requestId)),
      ).catch(() => {
        // Ignore abort errors
      });
    },

    // Phase 2: UI state actions
    toggleSidebar: assign(({ context }) => {
      const newFlags = {
        ...context.uiFlags,
        isSidebarOpen: !context.uiFlags.isSidebarOpen,
      };
      return {
        uiFlags: newFlags,
        uiState: Effect.runSync(deriveUIState(newFlags)),
      };
    }),

    toggleResponse: assign(({ context }) => {
      console.log("[Machine] toggleResponse action called");
      console.log("[Machine] current isResponseOpen:", context.uiFlags.isResponseOpen);

      const newFlags = {
        ...context.uiFlags,
        isResponseOpen: !context.uiFlags.isResponseOpen,
      };

      console.log("[Machine] new isResponseOpen:", newFlags.isResponseOpen);

      return {
        uiFlags: newFlags,
        uiState: Effect.runSync(deriveUIState(newFlags)),
      };
    }),

    toggleEnvironment: assign(({ context }) => {
      const newFlags = {
        ...context.uiFlags,
        isEnvironmentOpen: !context.uiFlags.isEnvironmentOpen,
      };
      return {
        uiFlags: newFlags,
        uiState: Effect.runSync(deriveUIState(newFlags)),
      };
    }),

    toggleDiff: assign(({ context }) => {
      const newFlags = {
        ...context.uiFlags,
        showDiff: !context.uiFlags.showDiff,
      };
      return {
        uiFlags: newFlags,
        uiState: Effect.runSync(deriveUIState(newFlags)),
      };
    }),

    setCompactLayout: assign(({ context, event }) => {
      if (!event || event.type !== "UI_SET_COMPACT_LAYOUT") {
        return {};
      }
      const newFlags = {
        ...context.uiFlags,
        isCompactLayout: event.compact,
      };
      return {
        uiFlags: newFlags,
        uiState: Effect.runSync(deriveUIState(newFlags)),
      };
    }),

    // Derive request statuses from history
    deriveRequestStatuses: assign(({ context }) => {
      const statusMap = Effect.runSync(deriveRequestStatuses(context.history));

      return {
        ...context,
        requestStatuses: statusMap,
      };
    }),

    // Derive workspace state from context
    deriveWorkspaceState: assign(({ context }) => {
      const input = {
        isInitialising: context.isInitialising,
        isRunning: context.runner.status === "running",
        isFailure: context.isFailure,
        runner: context.runner,
        activeCollectionId: context.activeCollectionId,
        activeRequestId: context.activeRequestId,
        requestsByCollection: context.requestsByCollection,
      };

      const newWorkspaceState = Effect.runSync(deriveWorkspaceState(input));

      return {
        ...context,
        workspaceState: newWorkspaceState,
      };
    }),

    // Set state flags
    markInitialising: assign({ isInitialising: true, isFailure: false }),
    markReady: assign({ isInitialising: false, isFailure: false }),
    markFailure: assign({ isInitialising: false, isFailure: true }),
  },
});

const initialisingState = posteeWorkspaceSetup.createStateConfig({
  entry: ["markRunnerIdle", "markInitialising", "deriveWorkspaceState"],
  invoke: {
    id: "loadWorkspace",
    src: "loadWorkspace",
    input: ({ context }) => ({ layer: context.layer }),
    onDone: {
      target: "ready.loadingGraphqlSchema",
      actions: ["assignWorkspace", "deriveRequestStatuses", "markReady", "deriveWorkspaceState"],
    },
    onError: {
      target: "failure",
      actions: ["markFailure", "deriveWorkspaceState"],
    },
  },
});

const readyState = posteeWorkspaceSetup.createStateConfig({
  initial: "idle",
  states: {
    idle: {
      on: {
        CREATE_SCRATCH: {
          actions: "createScratch",
        },
        SELECT_SCRATCH: {
          actions: "selectScratch",
        },
        CLOSE_SCRATCH: {
          actions: "closeScratch",
        },
        REOPEN_SCRATCH: {
          actions: "reopenScratch",
        },
        UPDATE_SCRATCH_DRAFT: {
          actions: "updateScratchDraft",
        },
        PROMOTE_SCRATCH: {
          target: "promotingScratch",
          actions: "stageScratchPromotion",
        },
        CREATE_COLLECTION: {
          actions: "createCollection",
        },
        RENAME_COLLECTION: {
          actions: "renameCollection",
        },
        DELETE_COLLECTIONS: {
          actions: "deleteCollections",
        },
        CREATE_REQUEST: {
          actions: ["createRequest", "deriveWorkspaceState"],
        },
        UPDATE_REQUEST_METADATA: {
          actions: ["updateRequestMetadata", "deriveWorkspaceState"],
        },
        SAVE_REQUEST_DRAFT: {
          target: "savingDraft",
          actions: "stageRequestDraft",
        },
        REFRESH_GRAPHQL_SCHEMA: [
          {
            guard: "hasActiveGraphqlRequest",
            target: "refreshingGraphqlSchema",
            actions: "startGraphqlSchemaRefresh",
          },
          {
            actions: "rejectGraphqlSchemaRefresh",
          },
        ],
        RUN_REQUEST: {
          target: "running",
          guard: "hasActiveRequest",
        },
        SELECT_COLLECTION: {
          target: "loadingGraphqlSchema",
          actions: ["selectCollection", "deriveWorkspaceState"],
        },
        SELECT_REQUEST: {
          target: "loadingGraphqlSchema",
          actions: ["selectRequest", "deriveWorkspaceState"],
        },
        SELECT_ENVIRONMENT: {
          target: "loadingGraphqlSchema",
          actions: "selectEnvironment",
        },
        CREATE_ENVIRONMENT: {
          actions: "createEnvironment",
        },
        UPDATE_ENVIRONMENT_VARIABLES: {
          actions: "updateEnvironmentVariables",
        },
        SET_BASELINE_RESPONSE: {
          actions: "setBaselineResponse",
        },
        CLEAR_BASELINE_RESPONSE: {
          actions: "clearBaselineResponse",
        },
        // Derive request statuses when history is refreshed
        REFRESH_HISTORY: {
          actions: "deriveRequestStatuses",
        },
      },
    },
    savingDraft: {
      invoke: {
        id: "saveRequestDraft",
        src: "saveRequestDraft",
        input: ({ context }) => ({
          layer: context.layer,
          draft: context.pendingRequestDraft,
        }),
        onDone: {
          target: "loadingGraphqlSchema",
          actions: ["publishSavedRequestDraft", "deriveWorkspaceState"],
        },
        onError: {
          target: "idle",
          actions: "failRequestDraftSave",
        },
      },
      on: {
        SAVE_REQUEST_DRAFT: {},
        RUN_REQUEST: {},
        SELECT_REQUEST: {
          actions: ["selectRequest", "deriveWorkspaceState"],
        },
        SELECT_COLLECTION: {
          actions: ["selectCollection", "deriveWorkspaceState"],
        },
      },
    },
    promotingScratch: {
      invoke: {
        id: "promoteScratch",
        src: "promoteScratch",
        input: ({ context }) => ({
          layer: context.layer,
          context,
        }),
        onDone: {
          target: "idle",
          actions: ["publishPromotedScratch", "deriveWorkspaceState"],
        },
        onError: {
          target: "idle",
          actions: "failScratchPromotion",
        },
      },
    },
    loadingGraphqlSchema: {
      entry: "startGraphqlSchemaLoad",
      invoke: {
        id: "loadGraphqlSchema",
        src: "loadGraphqlSchema",
        input: ({ context }) => ({
          layer: context.layer,
          context,
        }),
        onDone: {
          target: "idle",
          actions: "publishLoadedGraphqlSchema",
        },
        onError: {
          target: "idle",
          actions: "failGraphqlSchemaLoad",
        },
      },
      on: {
        SAVE_REQUEST_DRAFT: {
          target: "savingDraft",
          actions: "stageRequestDraft",
        },
        RUN_REQUEST: {
          target: "running",
          guard: "hasActiveRequest",
        },
        SELECT_COLLECTION: {
          target: "loadingGraphqlSchema",
          reenter: true,
          actions: ["selectCollection", "deriveWorkspaceState"],
        },
        SELECT_REQUEST: {
          target: "loadingGraphqlSchema",
          reenter: true,
          actions: ["selectRequest", "deriveWorkspaceState"],
        },
        SELECT_ENVIRONMENT: {
          target: "loadingGraphqlSchema",
          reenter: true,
          actions: "selectEnvironment",
        },
      },
    },
    refreshingGraphqlSchema: {
      invoke: {
        id: "refreshGraphqlSchema",
        src: "refreshGraphqlSchema",
        input: ({ context }) => ({
          layer: context.layer,
          context,
        }),
        onDone: {
          target: "idle",
          actions: "publishRefreshedGraphqlSchema",
        },
        onError: {
          target: "idle",
          actions: "failGraphqlSchemaRefresh",
        },
      },
    },
    running: {
      entry: ["markRunnerRunning", "deriveWorkspaceState"],
      exit: ["markRunnerIdle", "deriveWorkspaceState"],
      invoke: {
        id: "runRequest",
        src: "runRequest",
        input: ({ context }) => ({
          layer: context.layer,
          context,
        }),
        onDone: {
          target: "success",
          actions: ["updateRunnerOnSuccess", "updateHistoryOnSuccess", "deriveWorkspaceState"],
        },
        onError: {
          target: "error",
          actions: ["updateRunnerOnError", "recordErrorHistory", "deriveWorkspaceState"],
        },
      },
      on: {
        RUN_CANCEL: {
          target: "idle",
          actions: "abortInFlight",
        },
      },
    },
    success: {
      after: {
        10: {
          target: "idle",
          actions: assign({
            runner: ({ context }) => ({
              ...context.runner,
              status: "success" as const,
            }),
          }),
        },
      },
      on: {
        SAVE_REQUEST_DRAFT: {
          target: "savingDraft",
          actions: "stageRequestDraft",
        },
        RUN_REQUEST: {
          target: "running",
          guard: "hasActiveRequest",
        },
        SET_BASELINE_RESPONSE: {
          actions: "setBaselineResponse",
        },
        CLEAR_BASELINE_RESPONSE: {
          actions: "clearBaselineResponse",
        },
      },
    },
    error: {
      on: {
        SAVE_REQUEST_DRAFT: {
          target: "savingDraft",
          actions: "stageRequestDraft",
        },
        RUN_REQUEST: {
          target: "running",
          guard: "hasActiveRequest",
        },
        SET_BASELINE_RESPONSE: {
          actions: "setBaselineResponse",
        },
        CLEAR_BASELINE_RESPONSE: {
          actions: "clearBaselineResponse",
        },
      },
    },
  },
  // UI state events at ready state level (accessible from all substates)
  on: {
    UI_TOGGLE_SIDEBAR: {
      actions: "toggleSidebar",
    },
    UI_TOGGLE_RESPONSE: {
      actions: "toggleResponse",
    },
    UI_TOGGLE_ENVIRONMENT: {
      actions: "toggleEnvironment",
    },
    UI_SET_COMPACT_LAYOUT: {
      actions: "setCompactLayout",
    },
    UI_TOGGLE_DIFF: {
      actions: "toggleDiff",
    },
  },
});

const failureState = posteeWorkspaceSetup.createStateConfig({
  entry: ["markFailure", "deriveWorkspaceState"],
  on: {
    REFRESH: "initialising",
  },
});

export const createPosteeWorkspaceMachine = (options?: {
  layer?: WorkspaceLayer;
}) =>
  posteeWorkspaceSetup.createMachine({
    id: "posteeWorkspace",
    context: {
      collections: [],
      requestsByCollection: {},
      requestDrafts: {},
      scratchDrafts: {},
      openScratchIds: [],
      closedScratchIds: [],
      activeEditor: null,
      pendingScratchPromotion: null,
      scratchPromotion: initialScratchPromotion(),
      pendingRequestDraft: null,
      requestDraftSave: initialRequestDraftSave(),
      graphqlSchema: initialGraphqlSchema(),
      environments: [],
      variablesByEnvironment: {},
      activeCollectionId: null,
      activeRequestId: null,
      activeEnvironmentId: null,
      history: [],
      runner: initialRunner(),
      layer: options?.layer ?? Layer.merge(DatabaseServiceLive, HttpClientLive),

      // State flags
      isInitialising: true,
      isFailure: false,

      // Phase 2: Derived state
      requestStatuses: new Map(),
      uiFlags: {
        isSidebarOpen: true,
        isResponseOpen: false,
        isCompactLayout: false,
        isEnvironmentOpen: false,
        showDiff: false,
      },
      uiState: {
        gridTemplateColumns: "minmax(260px, 320px) 1fr",
        gridTemplateRows: "minmax(0, 1fr)",
        isResponseDocked: false,
      },
      workspaceState: {
        statusLabel: "Idle",
        activeCollectionKey: null,
        requestsForActiveCollection: [],
        selectedRequest: null,
        canRunRequest: false,
        lastError: null,
      },
    },
    initial: "initialising",
    states: {
      initialising: initialisingState,
      ready: readyState,
      failure: failureState,
    },
  });
