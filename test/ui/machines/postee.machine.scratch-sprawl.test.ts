import { DatabaseService } from "@/core/effects/database.base";
import type { PosteeScratchDraftRow } from "@/core/effects/database.postee";
import { makeHttpClientTestLayer } from "@/core/effects/postee/http-client";
import { createPosteeWorkspaceMachine } from "@/ui/machines/postee.machine";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { createActor, waitFor } from "xstate";

/**
 * Postee opened and persisted a brand new scratch on every launch and never
 * reclaimed the untouched ones, so "Reopen drafts" grew by one identical
 * `Untitled request` per restart until it was useless.
 */

const draftRow = (overrides: Partial<PosteeScratchDraftRow> & { id: string }): PosteeScratchDraftRow => ({
  name: "Untitled request",
  method: "GET",
  url: "",
  description: null,
  headers_json: "[]",
  body_mode: "json",
  body_raw: "{}",
  form_values: null,
  graphql_document: null,
  graphql_variables_json: null,
  graphql_operation_name: null,
  environment_id: null,
  tab_order: 0,
  is_open: 1,
  created_at: 1,
  updated_at: 1,
  ...overrides,
});

const makeLayer = (rows: ReadonlyArray<PosteeScratchDraftRow>) => {
  const executions: Array<{ sql: string; values: ReadonlyArray<unknown> | undefined }> = [];
  const layer = Layer.merge(
    Layer.succeed(DatabaseService, {
      query: <T>(sql: string) =>
        Effect.succeed((sql.includes("postee_scratch_drafts") ? rows : []) as T[]),
      execute: (sql: string, values?: unknown[]) => {
        executions.push({ sql, values });
        return Effect.void;
      },
      transaction: <A, E, R>(effect: Effect.Effect<A, E, R>) => effect,
    }),
    makeHttpClientTestLayer(() => Effect.die("Unexpected HTTP request")),
  );
  return { layer, executions };
};

const start = async (rows: ReadonlyArray<PosteeScratchDraftRow>) => {
  const { layer, executions } = makeLayer(rows);
  const actor = createActor(createPosteeWorkspaceMachine({ layer }));
  actor.start();
  await waitFor(actor, (snapshot) => snapshot.matches({ ready: "idle" }));
  return { actor, executions, context: actor.getSnapshot().context };
};

const deletedIds = (executions: ReadonlyArray<{ sql: string; values: ReadonlyArray<unknown> | undefined }>) =>
  executions
    .filter((execution) => execution.sql.includes("DELETE FROM postee_scratch_drafts"))
    .flatMap((execution) => execution.values ?? []);

describe("scratch draft sprawl", () => {
  it("reuses an untouched draft instead of creating another one", async () => {
    const { actor, context } = await start([draftRow({ id: "pristine-1" })]);

    expect(context.activeEditor).toEqual({ kind: "scratch", scratchId: "pristine-1" });
    expect(Object.keys(context.scratchDrafts)).toEqual(["pristine-1"]);
    actor.stop();
  });

  it("discards the surplus untouched drafts that already piled up", async () => {
    const rows = Array.from({ length: 5 }, (_, index) => draftRow({ id: `pristine-${index}` }));

    const { actor, executions, context } = await start(rows);

    // One survives and is adopted; the other four are reclaimed.
    expect(deletedIds(executions).sort()).toEqual(["pristine-1", "pristine-2", "pristine-3", "pristine-4"]);
    expect(Object.keys(context.scratchDrafts)).toEqual(["pristine-0"]);
    actor.stop();
  });

  it("never discards a draft the user authored", async () => {
    const rows = [
      draftRow({ id: "authored", url: "https://api.example.test/health" }),
      draftRow({ id: "pristine-1" }),
      draftRow({ id: "pristine-2" }),
    ];

    const { actor, executions, context } = await start(rows);

    expect(deletedIds(executions)).not.toContain("authored");
    expect(Object.keys(context.scratchDrafts)).toContain("authored");
    actor.stop();
  });

  it("still opens a scratch when none was recovered", async () => {
    const { actor, context } = await start([]);

    expect(context.activeEditor?.kind).toBe("scratch");
    expect(Object.keys(context.scratchDrafts)).toHaveLength(1);
    actor.stop();
  });
});
