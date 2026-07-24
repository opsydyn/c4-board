import { DatabaseService } from "@/core/effects/database.base";
import type { PosteeGraphqlSchemaSnapshot } from "@/core/effects/database.postee";
import { Effect, Exit, Layer } from "effect";
import { buildSchema, getIntrospectionQuery, graphqlSync } from "graphql";
import { describe, expect, it } from "vitest";
import {
  fingerprintGraphqlSchemaContext,
  type GraphqlSchemaContext,
  loadGraphqlSchemaSnapshot,
  refreshGraphqlSchema,
} from "./graphql-schema";
import {
  HttpClientError,
  type HttpClientFailure,
  makeHttpClientTestLayer,
  type PreparedRequest,
  type PreparedResponse,
} from "./http-client";
import { Bytes, durationFromMillis, StatusCode } from "./types";

const schema = buildSchema(`
  type Query { viewer: Viewer }
  type Viewer { id: ID! }
`);
const introspection = graphqlSync({ schema, source: getIntrospectionQuery() }).data;
const endpointUrl = "https://api.example.test/graphql";

const context: GraphqlSchemaContext = {
  endpointUrl,
  headers: [
    { key: "Authorization", value: "Bearer secret-value" },
    { key: "X-Workspace", value: "opsydyn" },
  ],
};

const response = (bodyText: string, status = 200): PreparedResponse => ({
  status: StatusCode(status),
  statusText: status === 200 ? "OK" : "Bad Request",
  headers: {},
  bodyText,
  duration: durationFromMillis(5),
  rawSize: Bytes(new TextEncoder().encode(bodyText).byteLength),
});

interface DatabaseRecorder {
  readonly executions: () => ReadonlyArray<{
    readonly sql: string;
    readonly values: ReadonlyArray<unknown> | undefined;
  }>;
}

const makeDatabaseLayer = (cachedSnapshot: PosteeGraphqlSchemaSnapshot | null = null) => {
  const executions: Array<{ sql: string; values: ReadonlyArray<unknown> | undefined }> = [];
  const layer = Layer.succeed(DatabaseService, {
    query: <T>(sql: string, values?: unknown[]) => {
      if (
        !sql.includes("postee_graphql_schema_snapshots")
        || cachedSnapshot === null
        || values?.[0] !== cachedSnapshot.endpoint_url
        || values[1] !== cachedSnapshot.context_fingerprint
      ) {
        return Effect.succeed([] as T[]);
      }
      return Effect.succeed([cachedSnapshot] as T[]);
    },
    execute: (sql: string, values?: unknown[]) => {
      executions.push({ sql, values });
      return Effect.void;
    },
    transaction: (effect) => effect,
  });

  return {
    layer,
    recorder: {
      executions: () => executions,
    } satisfies DatabaseRecorder,
  };
};

const runWithServices = <A, E>(
  effect: Effect.Effect<A, E, DatabaseService | import("./http-client").HttpClient>,
  database: ReturnType<typeof makeDatabaseLayer>["layer"],
  handler: (request: PreparedRequest) => Effect.Effect<PreparedResponse, HttpClientFailure>,
) => Effect.runPromise(effect.pipe(Effect.provide(Layer.merge(database, makeHttpClientTestLayer(handler)))));

describe("GraphQL schema snapshots", () => {
  it("fingerprints canonical header order and casing without exposing credential values", async () => {
    const reorderedContext: GraphqlSchemaContext = {
      endpointUrl,
      headers: [
        { key: "x-workspace", value: "opsydyn" },
        { key: "authorization", value: "Bearer secret-value" },
      ],
    };

    const first = await fingerprintGraphqlSchemaContext(context);
    const second = await fingerprintGraphqlSchemaContext(reorderedContext);

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toContain("secret");
  });

  it("loads and touches only the snapshot matching the active cache key", async () => {
    const fingerprint = await fingerprintGraphqlSchemaContext(context);
    const snapshot: PosteeGraphqlSchemaSnapshot = {
      id: "cached-schema",
      endpoint_url: endpointUrl,
      context_fingerprint: fingerprint,
      introspection_json: JSON.stringify(introspection),
      schema_digest: "schema-digest",
      fetched_at: 100,
      last_used_at: 100,
    };
    const { layer, recorder } = makeDatabaseLayer(snapshot);

    const loaded = await Effect.runPromise(
      loadGraphqlSchemaSnapshot(context).pipe(Effect.provide(layer)),
    );

    expect(loaded).toEqual(snapshot);
    expect(recorder.executions()).toEqual([
      expect.objectContaining({
        sql: expect.stringContaining("UPDATE postee_graphql_schema_snapshots SET last_used_at"),
        values: [expect.any(Number), snapshot.id],
      }),
    ]);
  });

  it("refreshes a schema through a JSON POST and persists the validated result", async () => {
    const { layer, recorder } = makeDatabaseLayer();
    const prepared: PreparedRequest[] = [];

    const refreshed = await runWithServices(
      refreshGraphqlSchema(context),
      layer,
      (request) => {
        prepared.push(request);
        return Effect.succeed(response(JSON.stringify({ data: introspection })));
      },
    );

    const introspectionRequest = prepared[0];
    if (introspectionRequest === undefined) {
      throw new Error("Expected an introspection request.");
    }

    expect(introspectionRequest).toMatchObject({
      method: "POST",
      url: endpointUrl,
      body: { _tag: "Json" },
    });
    expect(introspectionRequest.headers).toEqual(expect.arrayContaining([
      { key: "Content-Type", value: "application/json; charset=utf-8" },
      { key: "Accept", value: "application/graphql-response+json, application/json;q=0.9" },
    ]));
    expect(refreshed).toMatchObject({
      endpoint_url: endpointUrl,
      introspection_json: JSON.stringify(introspection),
    });
    expect(recorder.executions()).toHaveLength(1);
    expect(recorder.executions()[0]?.sql).toContain("INSERT INTO postee_graphql_schema_snapshots");
  });

  it.each([
    ["transport", () => Effect.fail(HttpClientError({ message: "connection failed" }))],
    ["HTTP status", () => Effect.succeed(response("{}", 500))],
    ["GraphQL errors", () => Effect.succeed(response(JSON.stringify({ errors: [{ message: "nope" }] })))],
    ["malformed introspection", () => Effect.succeed(response(JSON.stringify({ data: { __schema: null } })))],
  ])("does not replace cached data after a %s refresh failure", async (_scenario, handler) => {
    const { layer, recorder } = makeDatabaseLayer();

    const exit = await Effect.runPromiseExit(
      refreshGraphqlSchema(context).pipe(
        Effect.provide(Layer.merge(layer, makeHttpClientTestLayer(handler))),
      ),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(recorder.executions()).toEqual([]);
    expect(Exit.isFailure(exit) ? JSON.stringify(exit.cause) : "").not.toContain("secret-value");
  });

  it("does not send or persist when introspection is disabled", async () => {
    const { layer, recorder } = makeDatabaseLayer();
    let sends = 0;

    const exit = await Effect.runPromiseExit(
      refreshGraphqlSchema({ ...context, introspectionEnabled: false }).pipe(
        Effect.provide(Layer.merge(
          layer,
          makeHttpClientTestLayer(() => {
            sends += 1;
            return Effect.succeed(response("{}"));
          }),
        )),
      ),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(sends).toBe(0);
    expect(recorder.executions()).toEqual([]);
  });
});
