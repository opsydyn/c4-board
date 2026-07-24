import { DatabaseService } from "@/core/effects/database.base";
import type { PosteeGraphqlRequest, PosteeRequest, PosteeRequestBody } from "@/core/effects/database.postee";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { loadPosteeRequestDraft, type PosteeRequestDraft, savePosteeRequestDraft } from "./request-draft";

const request: PosteeRequest = {
  id: "request-1",
  collection_id: "collection-1",
  name: "Get profile",
  method: "GET",
  url: "https://api.example.test/profile",
  description: null,
  favorite: 0,
  sort_order: 0,
  created_at: 1,
  updated_at: 1,
};

const pre031JsonBody: PosteeRequestBody = {
  request_id: request.id,
  mode: "json",
  raw: "{\"hello\":\"world\"}",
  form_values: null,
};

const rawBody: PosteeRequestBody = {
  request_id: request.id,
  mode: "raw",
  raw: "plain text",
  form_values: null,
};

const formBody: PosteeRequestBody = {
  request_id: request.id,
  mode: "form",
  raw: null,
  form_values: JSON.stringify([["name", "Ada"]]),
};

const graphqlRequest: PosteeGraphqlRequest = {
  request_id: request.id,
  document: "query Viewer { viewer { id } }",
  variables_json: "{\"includeEmail\":true}",
  operation_name: "Viewer",
};

const draft: PosteeRequestDraft = {
  request,
  headers: [
    { id: "41", key: "Accept", value: "application/json", enabled: true },
    { id: "new-header", key: "", value: "discarded", enabled: false },
  ],
  body: pre031JsonBody,
  graphql: null,
};

const graphqlDraft: PosteeRequestDraft = {
  ...draft,
  body: {
    request_id: request.id,
    mode: "graphql",
    raw: null,
    form_values: null,
  },
  graphql: graphqlRequest,
};

interface DatabaseRecorder {
  readonly transactionCalls: () => number;
  readonly executedSql: () => ReadonlyArray<string>;
  readonly executedBindValues: () => ReadonlyArray<ReadonlyArray<unknown> | undefined>;
}

const makeDatabaseService = (
  body: PosteeRequestBody | null,
  graphql: PosteeGraphqlRequest | null = null,
): [typeof DatabaseService.Service, DatabaseRecorder] => {
  let transactionCalls = 0;
  const executedSql: string[] = [];
  const executedBindValues: Array<ReadonlyArray<unknown> | undefined> = [];

  const service: typeof DatabaseService.Service = {
    query: <T>(sql: string) => {
      if (sql.includes("postee_request_headers")) {
        return Effect.succeed([
          {
            id: 41,
            request_id: request.id,
            key: "Accept",
            value: "application/json",
            is_enabled: 1,
            sort_order: 0,
          },
        ] as T[]);
      }

      if (sql.includes("postee_request_bodies")) {
        return Effect.succeed((body === null ? [] : [body]) as T[]);
      }

      if (sql.includes("postee_graphql_requests")) {
        return Effect.succeed((graphql === null ? [] : [graphql]) as T[]);
      }

      return Effect.succeed([] as T[]);
    },
    execute: (sql: string, bindValues?: unknown[]) => {
      executedSql.push(sql);
      executedBindValues.push(bindValues);
      return Effect.void;
    },
    transaction: (effect) => {
      transactionCalls += 1;
      return effect;
    },
  };

  return [
    service,
    {
      transactionCalls: () => transactionCalls,
      executedSql: () => executedSql,
      executedBindValues: () => executedBindValues,
    },
  ];
};

const runWithDatabase = <A, E>(effect: Effect.Effect<A, E, DatabaseService>, service: typeof DatabaseService.Service) =>
  Effect.runPromise(effect.pipe(Effect.provide(Layer.succeed(DatabaseService, service))));

describe("Postee request drafts", () => {
  it("hydrates a pre-031 JSON body into a complete request draft", async () => {
    const [service] = makeDatabaseService(pre031JsonBody);

    const loaded = await runWithDatabase(loadPosteeRequestDraft(request), service);

    expect(loaded.headers).toEqual([
      { id: "41", key: "Accept", value: "application/json", enabled: true },
    ]);
    expect(loaded.body).toEqual(pre031JsonBody);
    expect(loaded.graphql).toBeNull();
  });

  it("uses an empty JSON body when a request has no persisted body", async () => {
    const [service] = makeDatabaseService(null);

    const loaded = await runWithDatabase(loadPosteeRequestDraft(request), service);

    expect(loaded.body).toEqual({
      request_id: request.id,
      mode: "json",
      raw: "{}",
      form_values: null,
    });
    expect(loaded.graphql).toBeNull();
  });

  it.each([
    ["raw", rawBody],
    ["form", formBody],
  ])("hydrates a persisted %s body unchanged", async (_mode, body) => {
    const [service] = makeDatabaseService(body);

    const loaded = await runWithDatabase(loadPosteeRequestDraft(request), service);

    expect(loaded.body).toEqual(body);
  });

  it("saves metadata headers and body in one transaction", async () => {
    const [service, recorder] = makeDatabaseService(pre031JsonBody);

    const saved = await runWithDatabase(savePosteeRequestDraft(draft), service);

    expect(recorder.transactionCalls()).toBe(1);
    expect(recorder.executedSql()).toEqual(
      expect.arrayContaining([
        expect.stringContaining("UPDATE postee_requests"),
        expect.stringContaining("DELETE FROM postee_request_headers"),
        expect.stringContaining("INSERT INTO postee_request_headers"),
        expect.stringContaining("INSERT INTO postee_request_bodies"),
      ]),
    );
    expect(recorder.executedSql().filter((sql) => sql.includes("INSERT INTO postee_request_headers"))).toHaveLength(1);
    expect(saved.request).toEqual({
      ...draft.request,
      updated_at: expect.any(Number),
    });
    expect(saved.request.updated_at).toBeGreaterThan(draft.request.updated_at);
    expect(saved.headers).toEqual([
      { id: "41", key: "Accept", value: "application/json", enabled: true },
    ]);
    expect(saved.body).toEqual({
      ...draft.body,
      request_id: draft.request.id,
    });
  });

  it("binds the saved body to the draft request", async () => {
    const [service, recorder] = makeDatabaseService(pre031JsonBody);
    const draftWithMismatchedBody = {
      ...draft,
      body: { ...draft.body, request_id: "different-request" },
    };

    const saved = await runWithDatabase(savePosteeRequestDraft(draftWithMismatchedBody), service);

    const bodyUpsertIndex = recorder
      .executedSql()
      .findIndex((sql) => sql.includes("INSERT INTO postee_request_bodies"));

    expect(recorder.executedBindValues()[bodyUpsertIndex]?.[0]).toBe(request.id);
    expect(saved.body.request_id).toBe(request.id);
  });

  it("hydrates a persisted GraphQL draft alongside its GraphQL body mode", async () => {
    const [service] = makeDatabaseService(graphqlDraft.body, graphqlRequest);

    const loaded = await runWithDatabase(loadPosteeRequestDraft(request), service);

    expect(loaded.body).toEqual(graphqlDraft.body);
    expect(loaded.graphql).toEqual(graphqlRequest);
  });

  it("saves GraphQL data with request metadata, headers, and body in one transaction", async () => {
    const [service, recorder] = makeDatabaseService(graphqlDraft.body, graphqlRequest);

    const saved = await runWithDatabase(savePosteeRequestDraft(graphqlDraft), service);

    expect(recorder.transactionCalls()).toBe(1);
    expect(recorder.executedSql()).toEqual(
      expect.arrayContaining([
        expect.stringContaining("UPDATE postee_requests"),
        expect.stringContaining("INSERT INTO postee_request_headers"),
        expect.stringContaining("INSERT INTO postee_request_bodies"),
        expect.stringContaining("INSERT INTO postee_graphql_requests"),
      ]),
    );
    expect(saved.graphql).toEqual(graphqlRequest);
  });

  it("deletes a persisted GraphQL row when saving a non-GraphQL body", async () => {
    const [service, recorder] = makeDatabaseService(pre031JsonBody, graphqlRequest);

    await runWithDatabase(savePosteeRequestDraft({ ...draft, graphql: null }), service);

    expect(recorder.executedSql()).toEqual(
      expect.arrayContaining([expect.stringContaining("DELETE FROM postee_graphql_requests")]),
    );
  });
});
