import { DatabaseService } from "@/core/effects/database.base";
import type { PosteeRequest, PosteeRequestBody } from "@/core/effects/database.postee";
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

const persistedBody: PosteeRequestBody = {
  request_id: request.id,
  mode: "json",
  raw: "{\"hello\":\"world\"}",
  form_values: null,
};

const draft: PosteeRequestDraft = {
  request,
  headers: [
    { id: "41", key: "Accept", value: "application/json", enabled: true },
    { id: "new-header", key: "", value: "discarded", enabled: false },
  ],
  body: persistedBody,
};

interface DatabaseRecorder {
  readonly transactionCalls: () => number;
  readonly executedSql: () => ReadonlyArray<string>;
}

const makeDatabaseService = (body: PosteeRequestBody | null): [typeof DatabaseService.Service, DatabaseRecorder] => {
  let transactionCalls = 0;
  const executedSql: string[] = [];

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

      return Effect.succeed([] as T[]);
    },
    execute: (sql: string) => {
      executedSql.push(sql);
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
    },
  ];
};

const runWithDatabase = <A, E>(effect: Effect.Effect<A, E, DatabaseService>, service: typeof DatabaseService.Service) =>
  Effect.runPromise(effect.pipe(Effect.provide(Layer.succeed(DatabaseService, service))));

describe("Postee request drafts", () => {
  it("hydrates persisted headers and body into a complete request draft", async () => {
    const [service] = makeDatabaseService(persistedBody);

    const loaded = await runWithDatabase(loadPosteeRequestDraft(request), service);

    expect(loaded.headers).toEqual([
      { id: "41", key: "Accept", value: "application/json", enabled: true },
    ]);
    expect(loaded.body).toEqual(persistedBody);
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
  });

  it("saves metadata headers and body in one transaction", async () => {
    const [service, recorder] = makeDatabaseService(persistedBody);

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
    expect(saved).toEqual(draft);
  });
});
