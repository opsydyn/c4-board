/**
 * Postee Workspace Machine
 *
 * Coordinates collections, requests, environments, and request execution
 * for the Postman-inspired "Postee" tool.
 *
 * The machine orchestrates WHEN workflows occur; Effect services provide WHAT happens.
 */

import { assign, fromPromise, setup } from "xstate";
import { nanoid } from "nanoid";
import { Duration, Effect, Layer } from "effect";
import {
	PosteeCollections,
	PosteeRequests,
	PosteeEnvironments,
	PosteeHistory,
	type PosteeCollection,
	type PosteeRequest,
	type PosteeEnvironment,
	type PosteeEnvironmentVariable,
	type PosteeHistoryEntry,
} from "../../core/effects/postee";
import {
	HttpClient,
	HttpClientLive,
	prepareRequest,
	type PreparedRequest,
	type PreparedResponse,
} from "../../core/effects/postee/http-client";
import {
	type RequestId,
	type CollectionId,
	type EnvironmentId,
	type HttpMethod,
	bodyModeToSumType,
	RequestId as RequestIdBrand,
	CollectionId as CollectionIdBrand,
	EnvironmentId as EnvironmentIdBrand,
	durationToMillis,
} from "../../core/effects/postee/types";
import { DatabaseService } from "../../core/effects/database.base";
import { DatabaseServiceLive } from "../../core/effects/database.runtime";

type WorkspaceEnv = DatabaseService | HttpClient;
type WorkspaceLayer = Layer.Layer<WorkspaceEnv, never, never>;

// =============================================================================
// Types
// =============================================================================

export interface RunnerState {
	status: "idle" | "running" | "success" | "error";
	requestId: RequestId | null;
	response: PreparedResponse | null;
	error: string | null;
	startedAt: number | null;
}

export interface PosteeContext {
	collections: PosteeCollection[];
	requestsByCollection: Record<string, PosteeRequest[]>;
	environments: PosteeEnvironment[];
	variablesByEnvironment: Record<string, PosteeEnvironmentVariable[]>;
	activeCollectionId: CollectionId | null;
	activeRequestId: RequestId | null;
	activeEnvironmentId: EnvironmentId | null;
	runner: RunnerState;
	history: PosteeHistoryEntry[];
	layer: WorkspaceLayer;
}

export type PosteeEvent =
	| { type: "REFRESH" }
	| { type: "SELECT_COLLECTION"; collectionId: CollectionId }
	| { type: "SELECT_REQUEST"; requestId: RequestId }
	| { type: "SELECT_ENVIRONMENT"; environmentId: EnvironmentId | null }
	| { type: "RUN_REQUEST" }
	| { type: "RUN_CANCEL" }
	| { type: "REFRESH_HISTORY" }
	| {
			type: "CREATE_COLLECTION";
			payload: { id: CollectionId; name: string; description?: string };
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
	| { type: "REQUEST_RUN_ERROR"; requestId: RequestId; message: string };

export interface LoadWorkspaceResult {
	collections: PosteeCollection[];
	requestMap: Record<string, PosteeRequest[]>;
	environments: PosteeEnvironment[];
	variables: Record<string, PosteeEnvironmentVariable[]>;
	history: PosteeHistoryEntry[];
	defaultCollectionId: CollectionId | null;
	defaultRequestId: RequestId | null;
	defaultEnvironmentId: EnvironmentId | null;
}

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
	error: null,
	startedAt: null,
});

// =============================================================================
// Machine
// =============================================================================

// @ts-nocheck - XState v5 has deep type inference that can cause stack overflow in tsc
// The types are still checked by ESLint and the IDE
export const createPosteeWorkspaceMachine = (options?: {
	layer?: WorkspaceLayer;
}) =>
	setup({
		types: {
			context: {} as PosteeContext,
			events: {} as PosteeEvent,
		},
		actors: {
			loadWorkspace: fromPromise<
				LoadWorkspaceResult,
				{ layer: WorkspaceLayer }
			>(async ({ input }) => {
				const layer = input.layer;
				return runLayeredEffect(
					layer,
					Effect.gen(function* () {
						const collections = yield* PosteeCollections.list();

						const requestPairs = yield* Effect.forEach(
							collections,
							(collection) =>
								Effect.map(PosteeRequests.list(collection.id), (requests) => [
									collection.id,
									requests,
								] as const),
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

						const requestMap = Object.fromEntries(requestPairs);
						const variables = Object.fromEntries(variableEntries);

						// Brand IDs from database strings
						const firstCollectionId = collections[0]?.id;
						const firstCollection = firstCollectionId
							? CollectionIdBrand(firstCollectionId)
							: null;

						const firstRequestId =
							firstCollectionId && requestMap[firstCollectionId]?.[0]?.id;
						const firstRequest = firstRequestId
							? RequestIdBrand(firstRequestId)
							: null;

						const defaultEnvironmentId =
							environments.find((env) => env.is_default === 1)?.id ??
							environments[0]?.id;
						const defaultEnvironment = defaultEnvironmentId
							? EnvironmentIdBrand(defaultEnvironmentId)
							: null;

						return {
							collections,
							requestMap,
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

			runRequest: fromPromise<
				{
					response: PreparedResponse;
					prepared: PreparedRequest;
					historyEntry: PosteeHistoryEntry;
				},
				{
					layer: WorkspaceLayer;
					context: PosteeContext;
				}
			>(async ({ input }) => {
				const { layer, context } = input;
				const requestId = context.activeRequestId;
				if (!requestId) {
					throw new Error("No active request selected");
				}

				const environmentId = context.activeEnvironmentId;

				const requestEffect = Effect.gen(function* () {
					// Convert branded ID to string for database lookup
					const requestIdString = requestId as unknown as string;

					const request = yield* PosteeRequests.get(requestIdString);
					if (!request) {
						throw new Error(`Request ${requestId} not found`);
					}

					const headers = yield* PosteeRequests.listHeaders(requestIdString);
					const body = yield* PosteeRequests.getBody(requestIdString);

					// Lookup variables by environment (need string key for Record)
					const variables =
						(environmentId &&
							context.variablesByEnvironment[
								environmentId as unknown as string
							]) ||
						[];

					// Convert database body format to sum type
					const bodyMode = body?.mode ?? "raw";
					const requestBody = bodyModeToSumType(
						bodyMode as "raw" | "json" | "form",
						body?.raw ?? null,
						body?.form_values ?? null,
					);

					const prepared = yield* prepareRequest({
						id: RequestIdBrand(request.id),
						method: request.method as HttpMethod,
						url: request.url,
						headers,
						body: requestBody,
						env: { variables },
						timeout: Duration.seconds(30),
					});

					const client = yield* HttpClient;
					const response = yield* client.send(prepared);

					const historyEntry: PosteeHistoryEntry = {
						id: nanoid(),
						request_id: request.id,
						request_snapshot: JSON.stringify(
							{
								request,
								headers,
								body,
								environmentId,
								prepared,
							},
							null,
							2,
						),
						response_status: response.status,
						response_time_ms: durationToMillis(response.duration),
						response_size_bytes: response.rawSize,
						error_message: null,
						executed_at: Date.now(),
					};

					yield* PosteeHistory.record(historyEntry);

					return { prepared, response, historyEntry };
				});

				return runLayeredEffect(layer, requestEffect);
			}),
		},
		guards: {
			hasActiveRequest: ({ context }) => context.activeRequestId !== null,
		},
		actions: {
			selectCollection: assign({
				activeCollectionId: ({ event }) =>
					event.type === "SELECT_COLLECTION" ? event.collectionId : null,
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
				runner: () => initialRunner(),
			}),
			selectRequest: assign({
				activeRequestId: ({ event }) =>
					event.type === "SELECT_REQUEST" ? event.requestId : null,
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
			assignWorkspace: assign(({ context, event }) => {
				// XState done events are not in the union type
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const doneEvent = event as any;
				if (!doneEvent || doneEvent.type !== "xstate.done.actor.loadWorkspace") {
					return context;
				}

				const {
					collections,
					requestMap,
					environments,
					variables,
					history,
					defaultCollectionId,
					defaultRequestId,
					defaultEnvironmentId,
				} = doneEvent.output as LoadWorkspaceResult;

				return {
					...context,
					collections,
					requestsByCollection: requestMap,
					environments,
					variablesByEnvironment: variables,
					history,
					activeCollectionId: defaultCollectionId,
					activeRequestId: defaultRequestId,
					activeEnvironmentId: defaultEnvironmentId,
					runner: initialRunner(),
				};
			}),
			markRunnerIdle: assign({
				runner: () => initialRunner(),
			}),
			markRunnerRunning: assign({
				runner: ({ context }) => ({
					...context.runner,
					status: "running" as const,
					requestId: context.activeRequestId,
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

					return {
						status: "error" as const,
						requestId: event.requestId,
						response: null,
						error: event.message,
						startedAt: context.runner.startedAt,
					};
				},
			}),
			updateRunnerOnSuccess: assign({
				runner: ({ context, event }) => {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const doneEvent = event as any;
					if (!doneEvent?.output) return context.runner;
					const { response, prepared } = doneEvent.output;
					return {
						status: "success" as const,
						requestId: prepared.id,
						response,
						error: null,
						startedAt: context.runner.startedAt,
					};
				},
			}),
			updateHistoryOnSuccess: assign({
				history: ({ context, event }) => {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const doneEvent = event as any;
					if (!doneEvent?.output?.historyEntry) return context.history;
					const entry = doneEvent.output.historyEntry;
					return [entry, ...context.history].slice(0, 50);
				},
			}),
			updateRunnerOnError: assign({
				runner: ({ context, event }) => {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const errorEvent = event as any;
					return {
						status: "error" as const,
						requestId: context.activeRequestId,
						response: null,
						error:
							errorEvent?.error instanceof Error
								? errorEvent.error.message
								: "Request failed",
						startedAt: context.runner.startedAt,
					};
				},
			}),
			abortInFlight: ({ context }) => {
				const requestId = context.activeRequestId;
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
		},
	}).createMachine({
		id: "posteeWorkspace",
		context: {
			collections: [],
			requestsByCollection: {},
			environments: [],
			variablesByEnvironment: {},
			activeCollectionId: null,
			activeRequestId: null,
			activeEnvironmentId: null,
			history: [],
			runner: initialRunner(),
			layer: options?.layer ?? Layer.merge(DatabaseServiceLive, HttpClientLive),
		},
		initial: "initialising",
		states: {
			initialising: {
				entry: "markRunnerIdle",
				invoke: {
					id: "loadWorkspace",
					src: "loadWorkspace",
					input: ({ context }) => ({ layer: context.layer }),
					onDone: {
						target: "ready",
						actions: "assignWorkspace",
					},
					onError: {
						target: "failure",
					},
				},
			},

			ready: {
				initial: "idle",
				states: {
					idle: {
						on: {
							RUN_REQUEST: {
								target: "running",
								guard: "hasActiveRequest",
							},
							SELECT_COLLECTION: {
								actions: "selectCollection",
							},
							SELECT_REQUEST: {
								actions: "selectRequest",
							},
							SELECT_ENVIRONMENT: {
								actions: "selectEnvironment",
							},
						},
					},
					running: {
						entry: "markRunnerRunning",
						exit: "markRunnerIdle",
						invoke: {
							id: "runRequest",
							src: "runRequest",
							input: ({ context }) => ({
								layer: context.layer,
								context,
							}),
							onDone: {
								target: "success",
								actions: ["updateRunnerOnSuccess", "updateHistoryOnSuccess"],
							},
							onError: {
								target: "error",
								actions: "updateRunnerOnError",
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
							RUN_REQUEST: {
								target: "running",
								guard: "hasActiveRequest",
							},
						},
					},
					error: {
						on: {
							RUN_REQUEST: {
								target: "running",
								guard: "hasActiveRequest",
							},
						},
					},
				},
			},

			failure: {
				on: {
					REFRESH: "initialising",
				},
			},
		},
	});
