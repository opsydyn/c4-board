import { DatabaseService } from "@/core/effects/database.base";
import type {
  PosteeCollection,
  PosteeEnvironment,
  PosteeEnvironmentVariable,
  PosteeGraphqlRequest,
  PosteeGraphqlSchemaSnapshot,
  PosteeRequest,
  PosteeRequestBody,
} from "@/core/effects/database.postee";
import {
  HttpClientError,
  makeHttpClientTestLayer,
  type PreparedRequest,
  type PreparedResponse,
} from "@/core/effects/postee/http-client";
import { ResponseBody } from "@/core/effects/postee/response-body";
import { Bytes, StatusCode } from "@/core/effects/postee/types";
import { createPosteeWorkspaceMachine } from "@/ui/machines/postee.machine";
import { Duration, Effect, Layer } from "effect";
import { buildSchema, getIntrospectionQuery, graphqlSync } from "graphql";
import { describe, expect, it } from "vitest";
import { createActor, waitFor } from "xstate";

const collection: PosteeCollection = {
  id: "collection-graphql",
  name: "GraphQL",
  description: null,
  sort_order: 0,
  created_at: 1,
  updated_at: 1,
};

const request: PosteeRequest = {
  id: "request-graphql",
  collection_id: collection.id,
  name: "Systems",
  method: "POST",
  url: "{{endpoint}}",
  description: null,
  favorite: 0,
  sort_order: 0,
  created_at: 1,
  updated_at: 1,
};

const body: PosteeRequestBody = {
  request_id: request.id,
  mode: "graphql",
  raw: null,
  form_values: null,
};

const graphqlRequest: PosteeGraphqlRequest = {
  request_id: request.id,
  document: "query Systems { systems { id } }",
  variables_json: "{}",
  operation_name: "Systems",
};

const environment: PosteeEnvironment = {
  id: "environment-graphql",
  name: "Development",
  description: null,
  is_default: 1,
  created_at: 1,
  updated_at: 1,
};

const introspectionResult = graphqlSync({
  schema: buildSchema("type System { id: ID! } type Query { systems: [System!]! }"),
  source: getIntrospectionQuery(),
});

if (introspectionResult.data === undefined) {
  throw new Error("GraphQL fixture introspection must produce data.");
}

const introspectionJson = JSON.stringify({ data: introspectionResult.data });

interface GraphqlLifecycleRecorder {
  readonly capturedRequests: () => ReadonlyArray<PreparedRequest>;
  readonly historyWrites: () => number;
  readonly snapshots: Map<string, PosteeGraphqlSchemaSnapshot>;
}

const makeLayer = (options: {
  readonly token: string;
  readonly snapshots?: Map<string, PosteeGraphqlSchemaSnapshot>;
  readonly httpFailure?: boolean;
}) => {
  const snapshots = options.snapshots ?? new Map<string, PosteeGraphqlSchemaSnapshot>();
  const capturedRequests: PreparedRequest[] = [];
  let historyWrites = 0;
  const variables: PosteeEnvironmentVariable[] = [
    {
      id: 1,
      environment_id: environment.id,
      key: "endpoint",
      value: "https://api.example.test/graphql",
      is_secret: 0,
      is_enabled: 1,
      sort_order: 0,
      created_at: 1,
      updated_at: 1,
    },
    {
      id: 2,
      environment_id: environment.id,
      key: "token",
      value: options.token,
      is_secret: 1,
      is_enabled: 1,
      sort_order: 1,
      created_at: 1,
      updated_at: 1,
    },
  ];
  const database = Layer.succeed(DatabaseService, {
    query: <T,>(sql: string, bindValues?: unknown[]) => {
      if (sql.includes("postee_graphql_schema_snapshots")) {
        const key = `${bindValues?.[0] ?? ""}|${bindValues?.[1] ?? ""}`;
        const snapshot = snapshots.get(key);
        return Effect.succeed((snapshot ? [snapshot] : []) as T[]);
      }
      if (sql.includes("postee_collections")) return Effect.succeed([collection] as T[]);
      if (sql.includes("postee_requests")) return Effect.succeed([request] as T[]);
      if (sql.includes("postee_request_headers")) {
        return Effect.succeed([{
          id: 1,
          request_id: request.id,
          key: "Authorization",
          value: "Bearer {{token}}",
          is_enabled: 1,
          sort_order: 0,
        }] as T[]);
      }
      if (sql.includes("postee_request_bodies")) return Effect.succeed([body] as T[]);
      if (sql.includes("postee_graphql_requests")) return Effect.succeed([graphqlRequest] as T[]);
      if (sql.includes("postee_environments")) return Effect.succeed([environment] as T[]);
      if (sql.includes("postee_environment_variables")) return Effect.succeed(variables as T[]);
      return Effect.succeed([] as T[]);
    },
    execute: (sql: string, bindValues?: unknown[]) => {
      if (sql.includes("INSERT INTO postee_graphql_schema_snapshots")) {
        const [id, endpointUrl, fingerprint, payload, digest, fetchedAt, lastUsedAt] = bindValues ?? [];
        snapshots.set(`${endpointUrl}|${fingerprint}`, {
          id: String(id),
          endpoint_url: String(endpointUrl),
          context_fingerprint: String(fingerprint),
          introspection_json: String(payload),
          schema_digest: String(digest),
          fetched_at: Number(fetchedAt),
          last_used_at: Number(lastUsedAt),
        });
      }
      if (sql.includes("postee_history")) historyWrites += 1;
      return Effect.void;
    },
    transaction: <A, E, R>(effect: Effect.Effect<A, E, R>) => effect,
  });
  const response: PreparedResponse = {
    status: StatusCode(200),
    statusText: "OK",
    headerEntries: [],
    body: ResponseBody.Decoded({ bytes: new TextEncoder().encode(introspectionJson) }),
    duration: Duration.millis(1),
    rawSize: Bytes(introspectionJson.length),
  };
  const http = makeHttpClientTestLayer((prepared) => {
    capturedRequests.push(prepared);
    return options.httpFailure
      ? Effect.fail(HttpClientError({ message: "transport failed for Bearer secret-value" }))
      : Effect.succeed(response);
  });
  const recorder: GraphqlLifecycleRecorder = {
    capturedRequests: () => capturedRequests,
    historyWrites: () => historyWrites,
    snapshots,
  };

  return { layer: Layer.merge(database, http), recorder };
};

describe("Postee GraphQL schema lifecycle", () => {
  it("rejects refresh without a selected saved GraphQL request", async () => {
    const { layer, recorder } = makeLayer({ token: "secret-one" });
    const actor = createActor(createPosteeWorkspaceMachine({ layer }));
    actor.start();
    await waitFor(actor, (snapshot) => snapshot.matches({ ready: "idle" }));

    actor.send({ type: "SELECT_REQUEST", requestId: "missing-request" as never });
    await waitFor(actor, (snapshot) => snapshot.matches({ ready: "idle" }));
    actor.send({ type: "REFRESH_GRAPHQL_SCHEMA" });

    expect(actor.getSnapshot().context.graphqlSchema).toEqual({
      status: "Unavailable",
      snapshot: null,
      error: "Select a saved GraphQL request before refreshing its schema.",
    });
    expect(recorder.capturedRequests()).toHaveLength(0);
    expect(recorder.historyWrites()).toBe(0);
    actor.stop();
  });

  it("refreshes with resolved authentication, reopens from the matching offline cache, and isolates another credential context", async () => {
    const first = makeLayer({ token: "secret-one" });
    const actor = createActor(createPosteeWorkspaceMachine({ layer: first.layer }));
    actor.start();
    await waitFor(actor, (snapshot) => snapshot.matches({ ready: "idle" }));

    actor.send({ type: "REFRESH_GRAPHQL_SCHEMA" });
    await waitFor(
      actor,
      (snapshot) => snapshot.context.graphqlSchema.status === "Cached",
    );

    expect(first.recorder.capturedRequests()).toHaveLength(1);
    expect(first.recorder.capturedRequests()[0]?.headers).toEqual(expect.arrayContaining([
      { key: "Authorization", value: "Bearer secret-one" },
    ]));
    expect(first.recorder.snapshots.size).toBe(1);
    expect(first.recorder.historyWrites()).toBe(0);
    actor.stop();

    const offline = makeLayer({
      token: "secret-one",
      snapshots: first.recorder.snapshots,
      httpFailure: true,
    });
    const offlineActor = createActor(createPosteeWorkspaceMachine({ layer: offline.layer }));
    offlineActor.start();
    await waitFor(
      offlineActor,
      (snapshot) => snapshot.matches({ ready: "idle" }) && snapshot.context.graphqlSchema.status === "Cached",
    );

    expect(offline.recorder.capturedRequests()).toHaveLength(0);
    offlineActor.stop();

    const changedContext = makeLayer({
      token: "secret-two",
      snapshots: first.recorder.snapshots,
      httpFailure: true,
    });
    const changedContextActor = createActor(createPosteeWorkspaceMachine({ layer: changedContext.layer }));
    changedContextActor.start();
    await waitFor(changedContextActor, (snapshot) => snapshot.matches({ ready: "idle" }));

    expect(changedContextActor.getSnapshot().context.graphqlSchema.status).toBe("NoSchema");
    expect(changedContextActor.getSnapshot().context.graphqlSchema.snapshot).toBeNull();
    expect(changedContext.recorder.capturedRequests()).toHaveLength(0);
    changedContextActor.stop();
  });

  it("retains a matching cached schema and redacts the refresh failure", async () => {
    const seeded = makeLayer({ token: "secret-one" });
    const seedActor = createActor(createPosteeWorkspaceMachine({ layer: seeded.layer }));
    seedActor.start();
    await waitFor(seedActor, (snapshot) => snapshot.matches({ ready: "idle" }));
    seedActor.send({ type: "REFRESH_GRAPHQL_SCHEMA" });
    await waitFor(
      seedActor,
      (snapshot) => snapshot.context.graphqlSchema.status === "Cached",
    );
    seedActor.stop();

    const failing = makeLayer({
      token: "secret-one",
      snapshots: seeded.recorder.snapshots,
      httpFailure: true,
    });
    const actor = createActor(createPosteeWorkspaceMachine({ layer: failing.layer }));
    actor.start();
    await waitFor(
      actor,
      (snapshot) => snapshot.matches({ ready: "idle" }) && snapshot.context.graphqlSchema.status === "Cached",
    );

    const cachedSnapshot = actor.getSnapshot().context.graphqlSchema.snapshot;
    actor.send({ type: "REFRESH_GRAPHQL_SCHEMA" });
    await waitFor(
      actor,
      (snapshot) => snapshot.context.graphqlSchema.status === "Stale",
    );

    expect(actor.getSnapshot().context.graphqlSchema.snapshot).toEqual(cachedSnapshot);
    expect(actor.getSnapshot().context.graphqlSchema.error).not.toContain("secret-one");
    expect(actor.getSnapshot().context.graphqlSchema.error).not.toContain("secret-value");
    expect(failing.recorder.historyWrites()).toBe(0);
    actor.stop();
  });

  it("clears the displayed schema after saving GraphQL endpoint changes until the new context has a cache entry", async () => {
    const { layer } = makeLayer({ token: "secret-one" });
    const actor = createActor(createPosteeWorkspaceMachine({ layer }));
    actor.start();
    await waitFor(actor, (snapshot) => snapshot.matches({ ready: "idle" }));
    actor.send({ type: "REFRESH_GRAPHQL_SCHEMA" });
    await waitFor(
      actor,
      (snapshot) => snapshot.context.graphqlSchema.status === "Cached",
    );

    const draft = actor.getSnapshot().context.requestDrafts[request.id]!;
    actor.send({
      type: "SAVE_REQUEST_DRAFT",
      draft: {
        ...draft,
        request: {
          ...draft.request,
          url: "https://other.example.test/graphql",
        },
      },
    });
    await waitFor(
      actor,
      (snapshot) => snapshot.matches({ ready: "idle" }) && snapshot.context.requestDraftSave.status === "success",
    );

    expect(actor.getSnapshot().context.graphqlSchema).toEqual({
      status: "NoSchema",
      snapshot: null,
      error: null,
    });
    actor.stop();
  });
});
