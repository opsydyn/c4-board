import { DatabaseService } from "@/core/effects/database.base";
import type { PosteeScratchDraftRow } from "@/core/effects/database.postee";
import {
  makeHttpClientTestLayer,
  type PreparedRequest,
  type PreparedResponse,
} from "@/core/effects/postee/http-client";
import { Bytes, StatusCode } from "@/core/effects/postee/types";
import { createPosteeWorkspaceMachine } from "@/ui/machines/postee.machine";
import { Duration, Effect, Layer } from "effect";
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

  it("creates and selects an additional scratch without replacing the current draft", async () => {
    const actor = createActor(createPosteeWorkspaceMachine({ layer }));
    actor.start();
    await waitFor(actor, (snapshot) => snapshot.matches({ ready: "idle" }));

    const firstScratchId = actor.getSnapshot().context.activeEditor?.kind === "scratch"
      ? actor.getSnapshot().context.activeEditor.scratchId
      : null;
    actor.send({ type: "CREATE_SCRATCH" });

    expect(actor.getSnapshot().context.openScratchIds).toHaveLength(2);
    expect(actor.getSnapshot().context.activeEditor).toMatchObject({ kind: "scratch" });
    expect(actor.getSnapshot().context.activeEditor).not.toEqual({ kind: "scratch", scratchId: firstScratchId });
    actor.stop();
  });

  it("closes a scratch into the reopenable set and restores it on demand", async () => {
    const actor = createActor(createPosteeWorkspaceMachine({ layer }));
    actor.start();
    await waitFor(actor, (snapshot) => snapshot.matches({ ready: "idle" }));

    const scratchId = actor.getSnapshot().context.activeEditor?.kind === "scratch"
      ? actor.getSnapshot().context.activeEditor.scratchId
      : "";
    actor.send({ type: "CLOSE_SCRATCH", scratchId });
    expect(actor.getSnapshot().context.openScratchIds).not.toContain(scratchId);
    expect(actor.getSnapshot().context.closedScratchIds).toContain(scratchId);

    actor.send({ type: "REOPEN_SCRATCH", scratchId });
    expect(actor.getSnapshot().context.openScratchIds).toContain(scratchId);
    expect(actor.getSnapshot().context.closedScratchIds).not.toContain(scratchId);
    expect(actor.getSnapshot().context.activeEditor).toEqual({ kind: "scratch", scratchId });
    actor.stop();
  });

  it("updates the active scratch without changing its editor target", async () => {
    const actor = createActor(createPosteeWorkspaceMachine({ layer }));
    actor.start();
    await waitFor(actor, (snapshot) => snapshot.matches({ ready: "idle" }));

    const target = actor.getSnapshot().context.activeEditor;
    if (target?.kind !== "scratch") throw new Error("Expected a scratch editor");
    const draft = actor.getSnapshot().context.scratchDrafts[target.scratchId]!;
    actor.send({
      type: "UPDATE_SCRATCH_DRAFT",
      draft: { ...draft, method: "POST", url: "https://api.example.test/users" },
    });

    expect(actor.getSnapshot().context.activeEditor).toEqual(target);
    expect(actor.getSnapshot().context.scratchDrafts[target.scratchId]).toMatchObject({
      method: "POST",
      url: "https://api.example.test/users",
    });
    actor.stop();
  });

  it("executes an active scratch and records history without a saved request id", async () => {
    let capturedRequest: PreparedRequest | undefined;
    const response: PreparedResponse = {
      status: StatusCode(200),
      statusText: "OK",
      headers: {},
      bodyText: "{\"healthy\":true}",
      duration: Duration.millis(5),
      rawSize: Bytes(16),
    };
    const executionLayer = Layer.merge(
      layer,
      makeHttpClientTestLayer((prepared) => {
        capturedRequest = prepared;
        return Effect.succeed(response);
      }),
    );
    const actor = createActor(createPosteeWorkspaceMachine({ layer: executionLayer }));
    actor.start();
    await waitFor(actor, (snapshot) => snapshot.matches({ ready: "idle" }));

    const target = actor.getSnapshot().context.activeEditor;
    if (target?.kind !== "scratch") throw new Error("Expected a scratch editor");
    const draft = actor.getSnapshot().context.scratchDrafts[target.scratchId]!;
    actor.send({
      type: "UPDATE_SCRATCH_DRAFT",
      draft: { ...draft, url: "https://api.example.test/health" },
    });
    actor.send({ type: "RUN_REQUEST" });

    await waitFor(actor, (snapshot) => snapshot.matches({ ready: "success" }));

    expect(capturedRequest?.url).toBe("https://api.example.test/health");
    expect(actor.getSnapshot().context.history[0]).toMatchObject({
      request_id: null,
      response_status: 200,
    });
    actor.stop();
  });
});
