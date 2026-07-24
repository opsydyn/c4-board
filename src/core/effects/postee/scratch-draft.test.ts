import { DatabaseService } from "@/core/effects/database.base";
import type { PosteeScratchDraftRow } from "@/core/effects/database.postee";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { newPosteeScratchDraft, type PosteeScratchDraft, promotePosteeScratchDraft } from "./scratch-draft";

const scratch: PosteeScratchDraft = {
  ...newPosteeScratchDraft({ id: "scratch-1", tabOrder: 0, now: 100 }),
  name: "Create user",
  method: "POST",
  url: "https://api.example.test/users",
  headers: [{ id: "header-1", key: "Authorization", value: "Bearer {{token}}", enabled: true }],
  body: { mode: "json", raw: "{\"name\":\"Ada\"}", form_values: null },
  environmentId: "environment-1",
};

interface Recorder {
  readonly transactionCalls: () => number;
  readonly executedSql: () => ReadonlyArray<string>;
  readonly executedValues: () => ReadonlyArray<ReadonlyArray<unknown> | undefined>;
}

const makeDatabaseService = (): [typeof DatabaseService.Service, Recorder] => {
  let transactionCalls = 0;
  const executedSql: string[] = [];
  const executedValues: Array<ReadonlyArray<unknown> | undefined> = [];

  return [
    {
      query: <T>() => Effect.succeed([] as T[]),
      execute: (sql: string, values?: unknown[]) => {
        executedSql.push(sql);
        executedValues.push(values);
        return Effect.void;
      },
      transaction: <A, E, R>(effect: Effect.Effect<A, E, R>) => {
        transactionCalls += 1;
        return effect;
      },
    },
    {
      transactionCalls: () => transactionCalls,
      executedSql: () => executedSql,
      executedValues: () => executedValues,
    },
  ];
};

const runWithDatabase = <A, E>(effect: Effect.Effect<A, E, DatabaseService>, service: typeof DatabaseService.Service) =>
  Effect.runPromise(effect.pipe(Effect.provide(Layer.succeed(DatabaseService, service))));

describe("Postee scratch drafts", () => {
  it("promotes a scratch into a collection request in one transaction", async () => {
    const [service, recorder] = makeDatabaseService();

    const promoted = await runWithDatabase(
      promotePosteeScratchDraft({
        scratch,
        collectionId: "collection-1",
        requestId: "request-1",
      }),
      service,
    );

    expect(promoted.request).toMatchObject({
      id: "request-1",
      collection_id: "collection-1",
      name: "Create user",
      method: "POST",
      url: "https://api.example.test/users",
    });
    expect(promoted.headers).toEqual(scratch.headers);
    expect(promoted.body).toEqual({ ...scratch.body, request_id: "request-1" });
    expect(recorder.transactionCalls()).toBe(1);
    expect(recorder.executedSql()).toEqual(expect.arrayContaining([
      expect.stringContaining("INSERT INTO postee_requests"),
      expect.stringContaining("INSERT INTO postee_request_bodies"),
      "DELETE FROM postee_scratch_drafts WHERE id = ?",
    ]));
    expect(recorder.executedValues()).toContainEqual(["scratch-1"]);
  });

  it("creates an authored scratch without a collection identity", () => {
    const fresh = newPosteeScratchDraft({ id: "scratch-new", tabOrder: 3, now: 123 });

    expect(fresh).toEqual({
      id: "scratch-new",
      name: "Untitled request",
      method: "GET",
      url: "",
      description: null,
      headers: [],
      body: { mode: "json", raw: "{}", form_values: null },
      graphql: null,
      environmentId: null,
      tabOrder: 3,
      isOpen: true,
      createdAt: 123,
      updatedAt: 123,
    });
  });
});

export const rowFixture = (): PosteeScratchDraftRow => ({
  id: scratch.id,
  name: scratch.name,
  method: scratch.method,
  url: scratch.url,
  description: scratch.description,
  headers_json: JSON.stringify(scratch.headers),
  body_mode: scratch.body.mode,
  body_raw: scratch.body.raw,
  form_values: scratch.body.form_values,
  graphql_document: null,
  graphql_variables_json: null,
  graphql_operation_name: null,
  environment_id: scratch.environmentId,
  tab_order: scratch.tabOrder,
  is_open: 1,
  created_at: scratch.createdAt,
  updated_at: scratch.updatedAt,
});
