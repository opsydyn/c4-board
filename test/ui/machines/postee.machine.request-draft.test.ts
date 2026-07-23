import { DatabaseError, DatabaseService } from "@/core/effects/database.base";
import type {
  PosteeCollection,
  PosteeRequest,
  PosteeRequestBody,
  PosteeRequestHeader,
} from "@/core/effects/database.postee";
import type { PosteeRequestDraft } from "@/core/effects/postee";
import { makeHttpClientTestLayer } from "@/core/effects/postee/http-client";
import { CollectionId, RequestId } from "@/core/effects/postee/types";
import { createPosteeWorkspaceMachine } from "@/ui/machines/postee.machine";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { createActor, waitFor } from "xstate";

const collection: PosteeCollection = {
  id: "collection-1",
  name: "Examples",
  description: null,
  sort_order: 0,
  created_at: 1,
  updated_at: 1,
};

const request: PosteeRequest = {
  id: "request-1",
  collection_id: collection.id,
  name: "Get profile",
  method: "GET",
  url: "https://api.example.test/profile",
  description: null,
  favorite: 0,
  sort_order: 0,
  created_at: 1,
  updated_at: 1,
};

const originalBody: PosteeRequestBody = {
  request_id: request.id,
  mode: "json",
  raw: "{\"before\":true}",
  form_values: null,
};

const originalHeaders: PosteeRequestHeader[] = [
  {
    id: 41,
    request_id: request.id,
    key: "Accept",
    value: "application/json",
    is_enabled: 1,
    sort_order: 0,
  },
];

const originalDraft: PosteeRequestDraft = {
  request,
  headers: [
    {
      id: "41",
      key: "Accept",
      value: "application/json",
      enabled: true,
    },
  ],
  body: originalBody,
};

const changedDraft: PosteeRequestDraft = {
  request: {
    ...request,
    name: "Update profile",
    method: "PUT",
    updated_at: 2,
  },
  headers: [
    {
      id: "41",
      key: "Content-Type",
      value: "application/json",
      enabled: true,
    },
  ],
  body: {
    ...originalBody,
    raw: "{\"after\":true}",
  },
};

interface TransactionGate {
  readonly promise: Promise<void>;
  readonly release: () => void;
}

const makeTransactionGate = (): TransactionGate => {
  let release = (): void => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });

  return { promise, release };
};

const makeLayer = (options?: {
  readonly transactionGate?: TransactionGate;
  readonly transactionError?: DatabaseError;
}) => {
  const database = Layer.succeed(DatabaseService, {
    query: <T>(sql: string) => {
      if (sql.includes("postee_collections")) {
        return Effect.succeed([collection] as T[]);
      }
      if (sql.includes("postee_requests")) {
        return Effect.succeed([request] as T[]);
      }
      if (sql.includes("postee_request_headers")) {
        return Effect.succeed(originalHeaders as T[]);
      }
      if (sql.includes("postee_request_bodies")) {
        return Effect.succeed([originalBody] as T[]);
      }
      return Effect.succeed([] as T[]);
    },
    execute: () => Effect.void,
    transaction: <A, E, R>(effect: Effect.Effect<A, E, R>) => {
      if (options?.transactionError) {
        return Effect.fail(options.transactionError);
      }
      if (options?.transactionGate) {
        return Effect.zipRight(
          Effect.promise(() => options.transactionGate?.promise ?? Promise.resolve()),
          effect,
        );
      }
      return effect;
    },
  });
  const httpClient = makeHttpClientTestLayer(() => Effect.die("HTTP client must not be called by request draft tests"));

  return Layer.merge(database, httpClient);
};

describe("Postee machine request drafts", () => {
  it("hydrates request drafts while loading the workspace", async () => {
    const actor = createActor(createPosteeWorkspaceMachine({ layer: makeLayer() }));
    actor.start();

    await waitFor(actor, (snapshot) => snapshot.matches({ ready: "idle" }));

    expect(actor.getSnapshot().context.requestDrafts["request-1"]).toMatchObject({
      headers: [{ key: "Accept", value: "application/json", enabled: true }],
      body: { mode: "json", raw: "{\"before\":true}" },
    });

    actor.stop();
  });

  it("creates an in-memory default JSON draft for a new request", async () => {
    const actor = createActor(createPosteeWorkspaceMachine({ layer: makeLayer() }));
    actor.start();
    await waitFor(actor, (snapshot) => snapshot.matches({ ready: "idle" }));

    actor.send({
      type: "CREATE_REQUEST",
      payload: {
        collectionId: CollectionId(collection.id),
        id: RequestId("request-2"),
        name: "Create profile",
        method: "POST",
        url: "https://api.example.test/profile",
      },
    });

    expect(actor.getSnapshot().context.requestDrafts["request-2"]).toMatchObject({
      request: { id: "request-2" },
      headers: [],
      body: {
        request_id: "request-2",
        mode: "json",
        raw: "{}",
        form_values: null,
      },
    });

    actor.stop();
  });

  it("publishes a saved draft only after transactional persistence succeeds", async () => {
    const transactionGate = makeTransactionGate();
    const actor = createActor(
      createPosteeWorkspaceMachine({ layer: makeLayer({ transactionGate }) }),
    );
    actor.start();
    await waitFor(actor, (snapshot) => snapshot.matches({ ready: "idle" }));

    actor.send({ type: "SAVE_REQUEST_DRAFT", draft: changedDraft });
    await waitFor(
      actor,
      (snapshot) => snapshot.context.requestDraftSave.status === "saving",
    );

    expect(actor.getSnapshot().context.requestDrafts["request-1"]).toEqual(
      originalDraft,
    );
    expect(actor.getSnapshot().context.pendingRequestDraft).toEqual(changedDraft);

    transactionGate.release();
    await waitFor(
      actor,
      (snapshot) => snapshot.context.requestDraftSave.status === "success",
    );

    expect(actor.getSnapshot().context.requestDrafts["request-1"]).toEqual(
      changedDraft,
    );
    expect(
      actor.getSnapshot().context.requestsByCollection["collection-1"]?.[0],
    ).toEqual(changedDraft.request);
    expect(actor.getSnapshot().context.pendingRequestDraft).toBeNull();
    expect(actor.getSnapshot().context.requestDraftSave.revision).toBe(1);

    actor.stop();
  });

  it("retains the previous confirmed draft and exposes the error when save fails", async () => {
    const actor = createActor(
      createPosteeWorkspaceMachine({
        layer: makeLayer({
          transactionError: new DatabaseError({ message: "save failed" }),
        }),
      }),
    );
    actor.start();
    await waitFor(actor, (snapshot) => snapshot.matches({ ready: "idle" }));

    actor.send({ type: "SAVE_REQUEST_DRAFT", draft: changedDraft });
    await waitFor(
      actor,
      (snapshot) => snapshot.context.requestDraftSave.status === "error",
    );

    expect(actor.getSnapshot().context.requestDrafts["request-1"]).toEqual(
      originalDraft,
    );
    expect(actor.getSnapshot().context.pendingRequestDraft).toBeNull();
    expect(actor.getSnapshot().context.requestDraftSave.error).toContain(
      "save failed",
    );
    expect(actor.getSnapshot().context.requestDraftSave.revision).toBe(0);

    actor.stop();
  });
});
