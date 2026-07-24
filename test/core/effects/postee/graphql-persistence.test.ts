import { DatabaseService } from "@/core/effects/database.base";
import {
  getPosteeGraphqlSchemaSnapshot,
  type PosteeGraphqlSchemaSnapshot,
  touchPosteeGraphqlSchemaSnapshot,
  upsertPosteeGraphqlSchemaSnapshot,
} from "@/core/effects/database.postee";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

const snapshot: PosteeGraphqlSchemaSnapshot = {
  id: "schema-1",
  endpoint_url: "https://api.example.test/graphql",
  context_fingerprint: "fingerprint-a",
  introspection_json: "{\"__schema\":{}}",
  schema_digest: "schema-digest-a",
  fetched_at: 100,
  last_used_at: 100,
};

interface DatabaseRecorder {
  readonly queries: () => ReadonlyArray<{ readonly sql: string; readonly values: ReadonlyArray<unknown> | undefined }>;
  readonly executions: () => ReadonlyArray<
    { readonly sql: string; readonly values: ReadonlyArray<unknown> | undefined }
  >;
}

const makeDatabaseService = (): [typeof DatabaseService.Service, DatabaseRecorder] => {
  const queries: Array<{ sql: string; values: ReadonlyArray<unknown> | undefined }> = [];
  const executions: Array<{ sql: string; values: ReadonlyArray<unknown> | undefined }> = [];

  return [
    {
      query: <T>(sql: string, values?: unknown[]) => {
        queries.push({ sql, values });
        const matchingSnapshot = sql.includes("postee_graphql_schema_snapshots")
          && values?.[0] === snapshot.endpoint_url
          && values[1] === snapshot.context_fingerprint;

        return Effect.succeed((matchingSnapshot ? [snapshot] : []) as T[]);
      },
      execute: (sql: string, values?: unknown[]) => {
        executions.push({ sql, values });
        return Effect.void;
      },
      transaction: (effect) => effect,
    },
    {
      queries: () => queries,
      executions: () => executions,
    },
  ];
};

const runWithDatabase = <A, E>(effect: Effect.Effect<A, E, DatabaseService>, service: typeof DatabaseService.Service) =>
  Effect.runPromise(effect.pipe(Effect.provide(Layer.succeed(DatabaseService, service))));

describe("Postee GraphQL schema snapshots", () => {
  it("loads a snapshot only for the exact endpoint and context fingerprint", async () => {
    const [service, recorder] = makeDatabaseService();

    await expect(
      runWithDatabase(
        getPosteeGraphqlSchemaSnapshot(snapshot.endpoint_url, "different-fingerprint"),
        service,
      ),
    ).resolves.toBeNull();
    await expect(
      runWithDatabase(
        getPosteeGraphqlSchemaSnapshot(snapshot.endpoint_url, snapshot.context_fingerprint),
        service,
      ),
    ).resolves.toEqual(snapshot);

    expect(recorder.queries()).toEqual([
      expect.objectContaining({
        sql: expect.stringContaining("endpoint_url = ? AND context_fingerprint = ?"),
        values: [snapshot.endpoint_url, "different-fingerprint"],
      }),
      expect.objectContaining({
        sql: expect.stringContaining("endpoint_url = ? AND context_fingerprint = ?"),
        values: [snapshot.endpoint_url, snapshot.context_fingerprint],
      }),
    ]);
  });

  it("upserts and touches local schema snapshots without storing credentials", async () => {
    const [service, recorder] = makeDatabaseService();

    await runWithDatabase(upsertPosteeGraphqlSchemaSnapshot(snapshot), service);
    await runWithDatabase(touchPosteeGraphqlSchemaSnapshot(snapshot.id, 200), service);

    expect(recorder.executions()).toEqual([
      expect.objectContaining({
        sql: expect.stringContaining("INSERT INTO postee_graphql_schema_snapshots"),
        values: [
          snapshot.id,
          snapshot.endpoint_url,
          snapshot.context_fingerprint,
          snapshot.introspection_json,
          snapshot.schema_digest,
          snapshot.fetched_at,
          snapshot.last_used_at,
        ],
      }),
      expect.objectContaining({
        sql: expect.stringContaining("UPDATE postee_graphql_schema_snapshots SET last_used_at = ? WHERE id = ?"),
        values: [200, snapshot.id],
      }),
    ]);
  });
});
