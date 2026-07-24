import { DatabaseService } from "@/core/effects/database.base";
import type { PosteeScratchDraftRow } from "@/core/effects/database.postee";
import { createPosteeWorkspaceMachine } from "@/ui/machines/postee.machine";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { createActor, waitFor } from "xstate";

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

const layer = Layer.succeed(DatabaseService, {
  query: <T>(sql: string) => {
    if (sql.includes("postee_scratch_drafts")) {
      return Effect.succeed([recoveredScratch] as T[]);
    }
    return Effect.succeed([] as T[]);
  },
  execute: () => Effect.void,
  transaction: <A, E, R>(effect: Effect.Effect<A, E, R>) => effect,
});

describe("Postee scratch workspace machine", () => {
  it("opens a fresh scratch while retaining recovered drafts for reopening", async () => {
    const actor = createActor(createPosteeWorkspaceMachine({ layer }));
    actor.start();
    await waitFor(actor, (snapshot) => snapshot.matches({ ready: "idle" }));

    expect(actor.getSnapshot().context.activeEditor).toMatchObject({ kind: "scratch" });
    expect(actor.getSnapshot().context.openScratchIds).toHaveLength(1);
    expect(actor.getSnapshot().context.closedScratchIds).toEqual(["scratch-recovered"]);
    actor.stop();
  });
});
