import { DatabaseService } from "@/core/effects/database.base";
import {
  deletePosteeScratchDraft,
  listPosteeScratchDrafts,
  type PosteeScratchDraftRow,
  setPosteeScratchDraftOpen,
  upsertPosteeScratchDraft,
} from "@/core/effects/database.postee";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

const scratch: PosteeScratchDraftRow = {
  id: "scratch-1",
  name: "Untitled request",
  method: "POST",
  url: "https://api.example.test/{{resource}}",
  description: null,
  headers_json: JSON.stringify([{
    id: "header-1",
    key: "Authorization",
    value: "Bearer {{token}}",
    enabled: true,
  }]),
  body_mode: "json",
  body_raw: "{\"name\":\"Ada\"}",
  form_values: null,
  graphql_document: null,
  graphql_variables_json: null,
  graphql_operation_name: null,
  environment_id: "environment-1",
  tab_order: 2,
  is_open: 1,
  created_at: 100,
  updated_at: 200,
};

interface Recorder {
  readonly queries: () => ReadonlyArray<{ readonly sql: string; readonly values: ReadonlyArray<unknown> | undefined }>;
  readonly executions: () => ReadonlyArray<
    { readonly sql: string; readonly values: ReadonlyArray<unknown> | undefined }
  >;
}

const makeDatabaseService = (): [typeof DatabaseService.Service, Recorder] => {
  const queries: Array<{ sql: string; values: ReadonlyArray<unknown> | undefined }> = [];
  const executions: Array<{ sql: string; values: ReadonlyArray<unknown> | undefined }> = [];

  return [
    {
      query: <T>(sql: string, values?: unknown[]) => {
        queries.push({ sql, values });
        return Effect.succeed([scratch] as T[]);
      },
      execute: (sql: string, values?: unknown[]) => {
        executions.push({ sql, values });
        return Effect.void;
      },
      transaction: <A, E, R>(effect: Effect.Effect<A, E, R>) => effect,
    },
    {
      queries: () => queries,
      executions: () => executions,
    },
  ];
};

const runWithDatabase = <A, E>(effect: Effect.Effect<A, E, DatabaseService>, service: typeof DatabaseService.Service) =>
  Effect.runPromise(effect.pipe(Effect.provide(Layer.succeed(DatabaseService, service))));

describe("Postee scratch draft storage", () => {
  it("persists authored templates and keeps closed drafts recoverable", async () => {
    const [service, recorder] = makeDatabaseService();

    await runWithDatabase(upsertPosteeScratchDraft(scratch), service);
    await runWithDatabase(setPosteeScratchDraftOpen(scratch.id, false), service);
    await expect(runWithDatabase(listPosteeScratchDrafts(false), service)).resolves.toEqual([scratch]);

    expect(recorder.executions()).toEqual([
      expect.objectContaining({
        sql: expect.stringContaining("INSERT INTO postee_scratch_drafts"),
        values: expect.arrayContaining([
          scratch.id,
          scratch.url,
          scratch.headers_json,
          scratch.environment_id,
        ]),
      }),
      expect.objectContaining({
        sql: expect.stringContaining("SET is_open = ?"),
        values: [0, expect.any(Number), scratch.id],
      }),
    ]);
    expect(recorder.queries()).toEqual([
      expect.objectContaining({
        sql: expect.stringContaining("WHERE is_open = ?"),
        values: [0],
      }),
    ]);
  });

  it("deletes a discarded scratch without touching saved requests", async () => {
    const [service, recorder] = makeDatabaseService();

    await runWithDatabase(deletePosteeScratchDraft(scratch.id), service);

    expect(recorder.executions()).toEqual([
      expect.objectContaining({
        sql: "DELETE FROM postee_scratch_drafts WHERE id = ?",
        values: [scratch.id],
      }),
    ]);
  });
});
