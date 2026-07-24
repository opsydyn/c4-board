import { DatabaseService } from "@/core/effects/database.base";
import type { PosteeScratchDraftRow } from "@/core/effects/database.postee";
import { makeHttpClientTestLayer } from "@/core/effects/postee/http-client";
import { createPosteeWorkspaceMachine } from "@/ui/machines/postee.machine";
import { Effect, Layer } from "effect";
import { describe, expect, it, vi } from "vitest";
import { createActor, waitFor } from "xstate";

/**
 * The machine persists scratch edits fire-and-forget and swallows the failure
 * (`.catch(() => {})`), so a write that never lands is invisible both to the user
 * and to the existing tests, which assert only in-memory context. These cover the
 * durable side: what actually reaches the database.
 */

const recoveredScratch: PosteeScratchDraftRow = {
  id: "scratch-recovered",
  name: "Recovered request",
  method: "GET",
  url: "https://api.example.test/recovered",
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
};

interface Execution {
  readonly sql: string;
  readonly values: ReadonlyArray<unknown> | undefined;
}

const makeRecordingLayer = () => {
  const executions: Execution[] = [];
  const layer = Layer.merge(
    Layer.succeed(DatabaseService, {
      query: <T>(sql: string) => {
        if (sql.includes("postee_scratch_drafts")) return Effect.succeed([recoveredScratch] as T[]);
        return Effect.succeed([] as T[]);
      },
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

const scratchUpserts = (executions: ReadonlyArray<Execution>) =>
  executions.filter((execution) => execution.sql.includes("INSERT INTO postee_scratch_drafts"));

describe("Postee scratch draft persistence", () => {
  it("writes the authored URL through to the database, not just context", async () => {
    const { layer, executions } = makeRecordingLayer();
    const actor = createActor(createPosteeWorkspaceMachine({ layer }));
    actor.start();
    await waitFor(actor, (snapshot) => snapshot.matches({ ready: "idle" }));

    const target = actor.getSnapshot().context.activeEditor;
    if (target?.kind !== "scratch") throw new Error("Expected a scratch editor");
    const draft = actor.getSnapshot().context.scratchDrafts[target.scratchId]!;

    executions.length = 0;
    actor.send({
      type: "UPDATE_SCRATCH_DRAFT",
      draft: { ...draft, url: "https://api.example.test/authored" },
    });

    await vi.waitFor(() => {
      const upserts = scratchUpserts(executions);
      expect(upserts.length).toBeGreaterThan(0);
      expect(upserts.at(-1)?.values).toContain("https://api.example.test/authored");
    });

    actor.stop();
  });

  it("persists the latest URL when edits arrive in quick succession", async () => {
    const { layer, executions } = makeRecordingLayer();
    const actor = createActor(createPosteeWorkspaceMachine({ layer }));
    actor.start();
    await waitFor(actor, (snapshot) => snapshot.matches({ ready: "idle" }));

    const target = actor.getSnapshot().context.activeEditor;
    if (target?.kind !== "scratch") throw new Error("Expected a scratch editor");
    const draft = actor.getSnapshot().context.scratchDrafts[target.scratchId]!;

    executions.length = 0;
    // Typing a URL emits one event per keystroke.
    for (const url of ["https://a", "https://ap", "https://api.example.test/typed"]) {
      actor.send({ type: "UPDATE_SCRATCH_DRAFT", draft: { ...draft, url } });
    }

    await vi.waitFor(() => {
      const upserts = scratchUpserts(executions);
      expect(upserts.at(-1)?.values).toContain("https://api.example.test/typed");
    });

    actor.stop();
  });
});
