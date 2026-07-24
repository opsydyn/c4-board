import { DatabaseError, DatabaseService } from "@/core/effects/database.base";
import type { PosteeScratchDraftRow } from "@/core/effects/database.postee";
import {
  makeHttpClientTestLayer,
  type PreparedRequest,
  type PreparedResponse,
} from "@/core/effects/postee/http-client";
import { Bytes, CollectionId, RequestId, StatusCode } from "@/core/effects/postee/types";
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

const databaseService = {
  query: <T>(sql: string) => {
    if (sql.includes("postee_collections")) {
      return Effect.succeed([{
        id: "collection-1",
        name: "Examples",
        description: null,
        sort_order: 0,
        created_at: 1,
        updated_at: 1,
      }] as T[]);
    }
    if (sql.includes("postee_scratch_drafts")) {
      return Effect.succeed([recoveredScratch] as T[]);
    }
    return Effect.succeed([] as T[]);
  },
  execute: () => Effect.void,
  transaction: <A, E, R>(effect: Effect.Effect<A, E, R>) => effect,
};

const databaseLayer = Layer.succeed(DatabaseService, databaseService);

const layer = Layer.merge(
  databaseLayer,
  makeHttpClientTestLayer(() => Effect.die("Unexpected HTTP request")),
);

const failingPromotionLayer = Layer.merge(
  Layer.succeed(DatabaseService, {
    ...databaseService,
    transaction: <A, E, R>(_effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | DatabaseError, R> =>
      Effect.fail(new DatabaseError({ message: "Promotion failed" })),
  }),
  makeHttpClientTestLayer(() => Effect.die("Unexpected HTTP request")),
);

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

    const firstTarget = actor.getSnapshot().context.activeEditor;
    const firstScratchId = firstTarget?.kind === "scratch" ? firstTarget.scratchId : null;
    actor.send({ type: "CREATE_SCRATCH" });

    expect(actor.getSnapshot().context.openScratchIds).toHaveLength(2);
    expect(actor.getSnapshot().context.activeEditor).toMatchObject({ kind: "scratch" });
    expect(actor.getSnapshot().context.activeEditor).not.toEqual({ kind: "scratch", scratchId: firstScratchId });
    actor.stop();
  });

  it("selects an existing open scratch without mutating its authored state", async () => {
    const actor = createActor(createPosteeWorkspaceMachine({ layer }));
    actor.start();
    await waitFor(actor, (snapshot) => snapshot.matches({ ready: "idle" }));

    const firstTarget = actor.getSnapshot().context.activeEditor;
    if (firstTarget?.kind !== "scratch") throw new Error("Expected a scratch editor");
    actor.send({ type: "CREATE_SCRATCH" });
    actor.send({ type: "SELECT_SCRATCH", scratchId: firstTarget.scratchId });

    expect(actor.getSnapshot().context.activeEditor).toEqual(firstTarget);
    expect(actor.getSnapshot().context.scratchDrafts[firstTarget.scratchId]).toBeDefined();
    actor.stop();
  });

  it("closes a scratch into the reopenable set and restores it on demand", async () => {
    const actor = createActor(createPosteeWorkspaceMachine({ layer }));
    actor.start();
    await waitFor(actor, (snapshot) => snapshot.matches({ ready: "idle" }));

    const activeEditor = actor.getSnapshot().context.activeEditor;
    const scratchId = activeEditor?.kind === "scratch" ? activeEditor.scratchId : "";
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
      bodyDecodeError: null,
      duration: Duration.millis(5),
      rawSize: Bytes(16),
    };
    const executionLayer = Layer.merge(
      databaseLayer,
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

  it("promotes a scratch into the selected collection and selects the saved request", async () => {
    const actor = createActor(createPosteeWorkspaceMachine({ layer }));
    actor.start();
    await waitFor(actor, (snapshot) => snapshot.matches({ ready: "idle" }));

    const target = actor.getSnapshot().context.activeEditor;
    if (target?.kind !== "scratch") throw new Error("Expected a scratch editor");
    const scratch = actor.getSnapshot().context.scratchDrafts[target.scratchId]!;
    actor.send({
      type: "PROMOTE_SCRATCH",
      scratchId: scratch.id,
      collectionId: CollectionId("collection-1"),
      requestId: RequestId("request-promoted"),
    });

    await waitFor(
      actor,
      (snapshot) => snapshot.context.activeEditor?.kind === "saved",
    );

    expect(actor.getSnapshot().context.activeEditor).toEqual({
      kind: "saved",
      requestId: "request-promoted",
    });
    expect(actor.getSnapshot().context.scratchDrafts[scratch.id]).toBeUndefined();
    expect(actor.getSnapshot().context.openScratchIds).not.toContain(scratch.id);
    expect(actor.getSnapshot().context.requestDrafts["request-promoted"]?.request).toMatchObject({
      collection_id: "collection-1",
      name: scratch.name,
    });
    expect(actor.getSnapshot().context.requestsByCollection["collection-1"])
      .toEqual(expect.arrayContaining([expect.objectContaining({ id: "request-promoted" })]));
    actor.stop();
  });

  it("retains a scratch when promotion fails", async () => {
    const actor = createActor(createPosteeWorkspaceMachine({ layer: failingPromotionLayer }));
    actor.start();
    await waitFor(actor, (snapshot) => snapshot.matches({ ready: "idle" }));

    const target = actor.getSnapshot().context.activeEditor;
    if (target?.kind !== "scratch") throw new Error("Expected a scratch editor");
    actor.send({
      type: "PROMOTE_SCRATCH",
      scratchId: target.scratchId,
      collectionId: CollectionId("collection-1"),
      requestId: RequestId("request-failed"),
    });

    await waitFor(actor, (snapshot) => snapshot.context.scratchPromotion.status === "error");

    expect(actor.getSnapshot().context.activeEditor).toEqual(target);
    expect(actor.getSnapshot().context.scratchDrafts[target.scratchId]).toBeDefined();
    expect(actor.getSnapshot().context.requestsByCollection["collection-1"] ?? []).not
      .toEqual(expect.arrayContaining([expect.objectContaining({ id: "request-failed" })]));
    actor.stop();
  });
});
