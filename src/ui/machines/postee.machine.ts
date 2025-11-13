/**
 * Postee Workspace Machine
 *
 * Coordinates collections, requests, environments, and request execution
 * for the Postman-inspired "Postee" tool.
 *
 * The machine orchestrates WHEN workflows occur; Effect services provide WHAT happens.
 */

import { assign, fromPromise, setup } from "xstate";
import type { DoneActorEvent, ErrorActorEvent } from "xstate";
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
	baselineResponse: PreparedResponse | null; // For diff comparison
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
	  };

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

export interface RunRequestResult {
	response: PreparedResponse;
	prepared: PreparedRequest;
	historyEntry: PosteeHistoryEntry;
}

type LoadWorkspaceDoneEvent = DoneActorEvent<LoadWorkspaceResult, "loadWorkspace">;
type RunRequestDoneEvent = DoneActorEvent<RunRequestResult, "runRequest">;
type RunRequestErrorEvent = ErrorActorEvent<unknown, "runRequest">;

type PosteeMachineEvent =
	| PosteeEvent
	| LoadWorkspaceDoneEvent
	| RunRequestDoneEvent
	| RunRequestErrorEvent;

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
			RunRequestResult,
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
						context.variablesByEnvironment[environmentId as unknown as string]) ||
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
					response_body: response.bodyText, // ✅ Save response body as JSON
					response_headers: JSON.stringify(response.headers), // ✅ Save headers as JSON
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
					collection.id === collectionId ? updatedCollection : collection,
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
				!nextActiveCollectionId ||
				deletedSet.has(nextActiveCollectionId as unknown as string)
			) {
				const first = remainingCollections[0];
				nextActiveCollectionId = first ? CollectionIdBrand(first.id) : null;
			}

			let nextActiveRequestId: RequestId | null = context.activeRequestId;
			if (nextActiveCollectionId) {
				const collectionKey = nextActiveCollectionId as unknown as string;
				const requests = nextRequestsByCollection[collectionKey] ?? [];
				if (
					!nextActiveRequestId ||
					!requests.some(
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
				activeCollectionId: nextActiveCollectionId,
				activeRequestId: nextActiveRequestId,
			};
		}),
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
					sort_order:
						(context.requestsByCollection[collectionKey]?.length ?? 0) + 1,
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
				sort_order:
					(context.requestsByCollection[collectionKey]?.length ?? 0) + 1,
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
				activeCollectionId: event.payload.collectionId,
				activeRequestId: event.payload.id,
			};
		}),
		updateRequestMetadata: assign(({ context, event }) => {
			if (!event || event.type !== "UPDATE_REQUEST_METADATA") {
				return context;
			}

			const requestId = event.payload.id as unknown as string;
			let targetCollectionKey: string | null = null;
			let existingRequest: PosteeRequest | undefined;

			for (const [key, requests] of Object.entries(
				context.requestsByCollection,
			)) {
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
				description:
					event.payload.description ?? existingRequest.description,
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
			};
		}),
		assignWorkspace: assign(({ context, event }) => {
			if (event.type !== "xstate.done.actor.loadWorkspace") {
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
			} = event.output;

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
				const { response, prepared } = event.output;
				return {
					status: "success" as const,
					requestId: prepared.id,
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
					requestId: context.activeRequestId,
					response: null,
					baselineResponse: context.runner.baselineResponse, // Preserve baseline
					error: errorText,
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
});

const initialisingState = posteeWorkspaceSetup.createStateConfig({
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
});

const readyState = posteeWorkspaceSetup.createStateConfig({
	initial: "idle",
	states: {
		idle: {
			on: {
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
					actions: "createRequest",
				},
				UPDATE_REQUEST_METADATA: {
					actions: "updateRequestMetadata",
				},
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
});

const failureState = posteeWorkspaceSetup.createStateConfig({
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
			initialising: initialisingState,
			ready: readyState,
			failure: failureState,
		},
	});
