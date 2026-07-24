import { DatabaseError, DatabaseService } from "@/core/effects/database.base";
import type { PosteeCollection, PosteeRequest, PosteeRequestBody } from "@/core/effects/database.postee";
import type { PosteeRequestDraft } from "@/core/effects/postee";
import {
  HttpClientError,
  makeHttpClientTestLayer,
  type PreparedRequest,
  type PreparedResponse,
} from "@/core/effects/postee/http-client";
import { Bytes, CollectionId, RequestBody, RequestId, StatusCode } from "@/core/effects/postee/types";
import { createPosteeWorkspaceMachine } from "@/ui/machines/postee.machine";
import { Duration, Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { createActor, SimulatedClock, waitFor } from "xstate";

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

const changedHeader = {
  id: "41",
  key: "Content-Type",
  value: "application/json",
  enabled: true,
} as const;

const changedDraft: PosteeRequestDraft = {
  request: {
    ...request,
    name: "Update profile",
    method: "PUT",
    updated_at: 2,
  },
  headers: [
    changedHeader,
    { id: "blank-header", key: " ", value: "discarded", enabled: false },
  ],
  body: {
    ...originalBody,
    request_id: "different-request",
    raw: "{\"after\":true}",
  },
};

interface TransactionGate {
  readonly promise: Promise<void>;
  readonly started: Promise<void>;
  readonly markStarted: () => void;
  readonly release: () => void;
}

const makeTransactionGate = (): TransactionGate => {
  let release = (): void => {};
  let markStarted = (): void => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });

  return { promise, started, markStarted, release };
};

interface MachineRecorder {
  readonly transactionCalls: () => number;
  readonly httpCalls: () => number;
  readonly capturedRequest: () => PreparedRequest | undefined;
}

const makeLayer = (options?: {
  readonly body?: PosteeRequestBody;
  readonly draft?: PosteeRequestDraft;
  readonly httpFailure?: boolean;
  readonly transactionGate?: TransactionGate;
  readonly transactionError?: DatabaseError;
}) => {
  let transactionCalls = 0;
  let httpCalls = 0;
  let capturedRequest: PreparedRequest | undefined;
  const persistedDraft = options?.draft ?? originalDraft;
  const database = Layer.succeed(DatabaseService, {
    query: <T>(sql: string) => {
      if (sql.includes("postee_collections")) {
        return Effect.succeed([collection] as T[]);
      }
      if (sql.includes("postee_requests")) {
        return Effect.succeed([persistedDraft.request] as T[]);
      }
      if (sql.includes("postee_request_headers")) {
        return Effect.succeed(
          persistedDraft.headers.map((header, sort_order) => ({
            id: Number(header.id) || sort_order + 1,
            request_id: persistedDraft.request.id,
            key: header.key,
            value: header.value,
            is_enabled: header.enabled ? 1 : 0,
            sort_order,
          })) as T[],
        );
      }
      if (sql.includes("postee_request_bodies")) {
        return Effect.succeed([options?.body ?? persistedDraft.body] as T[]);
      }
      return Effect.succeed([] as T[]);
    },
    execute: () => Effect.void,
    transaction: <A, E, R>(effect: Effect.Effect<A, E, R>) => {
      transactionCalls += 1;
      if (options?.transactionError) {
        return Effect.fail(options.transactionError);
      }
      if (options?.transactionGate) {
        options.transactionGate.markStarted();
        return Effect.zipRight(
          Effect.promise(() => options.transactionGate?.promise ?? Promise.resolve()),
          effect,
        );
      }
      return effect;
    },
  });
  const successfulResponse: PreparedResponse = {
    status: StatusCode(200),
    statusText: "OK",
    headers: {},
    bodyText: "{}",
    duration: Duration.millis(5),
    rawSize: Bytes(2),
  };
  const httpClient = makeHttpClientTestLayer((prepared) => {
    httpCalls += 1;
    capturedRequest = prepared;
    return options?.httpFailure
      ? Effect.fail(HttpClientError({ message: "run failed" }))
      : Effect.succeed(successfulResponse);
  });
  const recorder: MachineRecorder = {
    transactionCalls: () => transactionCalls,
    httpCalls: () => httpCalls,
    capturedRequest: () => capturedRequest,
  };

  return {
    layer: Layer.merge(database, httpClient),
    recorder,
  };
};

const expectCommittedDraft = (draft: PosteeRequestDraft | undefined) => {
  expect(draft).toEqual({
    request: {
      ...changedDraft.request,
      updated_at: expect.any(Number),
    },
    headers: [changedHeader],
    body: {
      ...changedDraft.body,
      request_id: request.id,
    },
  });
  expect(draft?.request.updated_at).toBeGreaterThan(
    changedDraft.request.updated_at,
  );
};

describe("Postee machine request drafts", () => {
  it("hydrates request drafts while loading the workspace", async () => {
    const { layer } = makeLayer();
    const actor = createActor(createPosteeWorkspaceMachine({ layer }));
    actor.start();

    await waitFor(actor, (snapshot) => snapshot.matches({ ready: "idle" }));

    expect(actor.getSnapshot().context.requestDrafts["request-1"]).toMatchObject({
      headers: [{ key: "Accept", value: "application/json", enabled: true }],
      body: { mode: "json", raw: "{\"before\":true}" },
    });

    actor.stop();
  });

  it.each([
    [
      "raw",
      {
        ...originalBody,
        mode: "raw",
        raw: "plain text",
      },
    ],
    [
      "form",
      {
        ...originalBody,
        mode: "form",
        raw: null,
        form_values: JSON.stringify([["name", "Ada"]]),
      },
    ],
  ])("hydrates a persisted %s body unchanged", async (_mode, body) => {
    const { layer } = makeLayer({ body });
    const actor = createActor(createPosteeWorkspaceMachine({ layer }));
    actor.start();

    await waitFor(actor, (snapshot) => snapshot.matches({ ready: "idle" }));

    expect(actor.getSnapshot().context.requestDrafts["request-1"]?.body).toEqual(
      body,
    );

    actor.stop();
  });

  it("executes and records a persisted QUERY draft unchanged", async () => {
    const queryDraft = {
      request: {
        ...request,
        method: "QUERY",
        url: "https://example.com/feed",
      },
      headers: [{
        id: "header-query",
        key: "Content-Type",
        value: "application/sql",
        enabled: true,
      }],
      body: {
        request_id: request.id,
        mode: "raw",
        raw: "select * from systems",
        form_values: null,
      },
    } satisfies PosteeRequestDraft;
    const { layer, recorder } = makeLayer({ draft: queryDraft });
    const actor = createActor(createPosteeWorkspaceMachine({ layer }));
    actor.start();
    await waitFor(actor, (snapshot) => snapshot.matches({ ready: "idle" }));

    actor.send({ type: "RUN_REQUEST" });
    await waitFor(actor, (snapshot) => snapshot.matches({ ready: "success" }));

    const captured = recorder.capturedRequest();
    const history = actor.getSnapshot().context.history[0];
    expect(captured?.method).toBe("QUERY");
    expect(captured?.body).toEqual(
      RequestBody.Raw({ content: "select * from systems" }),
    );
    expect(history?.request_snapshot).toContain("\"method\": \"QUERY\"");

    actor.stop();
  });

  it("creates an in-memory default JSON draft for a new request", async () => {
    const { layer } = makeLayer();
    const actor = createActor(createPosteeWorkspaceMachine({ layer }));
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
    const { layer } = makeLayer({ transactionGate });
    const actor = createActor(
      createPosteeWorkspaceMachine({ layer }),
    );
    actor.start();
    await waitFor(actor, (snapshot) => snapshot.matches({ ready: "idle" }));

    actor.send({ type: "SAVE_REQUEST_DRAFT", draft: changedDraft });
    await transactionGate.started;

    expect(actor.getSnapshot().context.requestDrafts["request-1"]).toEqual(
      originalDraft,
    );
    expect(actor.getSnapshot().context.pendingRequestDraft).toEqual(changedDraft);

    transactionGate.release();
    await waitFor(
      actor,
      (snapshot) => snapshot.context.requestDraftSave.status === "success",
    );

    const snapshot = actor.getSnapshot();
    expectCommittedDraft(snapshot.context.requestDrafts["request-1"]);
    expect(snapshot.context.requestsByCollection["collection-1"]?.[0]).toEqual(
      snapshot.context.requestDrafts["request-1"]?.request,
    );
    expect(actor.getSnapshot().context.pendingRequestDraft).toBeNull();
    expect(actor.getSnapshot().context.requestDraftSave.revision).toBe(1);

    actor.stop();
  });

  it("retains the confirmed draft and exposes only an actionable error when save fails", async () => {
    const secret = "postgres://admin:super-secret@database.internal/postee";
    const { layer } = makeLayer({
      transactionError: new DatabaseError({
        message: `save failed for ${secret}`,
      }),
    });
    const actor = createActor(
      createPosteeWorkspaceMachine({ layer }),
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
    expect(actor.getSnapshot().context.requestDraftSave.error).toBe(
      "Request draft save failed. Try again.",
    );
    expect(actor.getSnapshot().context.requestDraftSave.error).not.toContain(secret);
    expect(actor.getSnapshot().context.requestDraftSave.error).not.toContain(
      "database.internal",
    );
    expect(actor.getSnapshot().context.requestDraftSave.revision).toBe(0);

    actor.stop();
  });

  it("saves from the transient runner success state", async () => {
    const clock = new SimulatedClock();
    const { layer } = makeLayer();
    const actor = createActor(createPosteeWorkspaceMachine({ layer }), { clock });
    actor.start();
    await waitFor(actor, (snapshot) => snapshot.matches({ ready: "idle" }));

    actor.send({ type: "RUN_REQUEST" });
    await waitFor(actor, (snapshot) => snapshot.matches({ ready: "success" }));

    actor.send({ type: "SAVE_REQUEST_DRAFT", draft: changedDraft });
    await waitFor(
      actor,
      (snapshot) => snapshot.context.requestDraftSave.status === "success",
      { timeout: 250 },
    );

    expectCommittedDraft(
      actor.getSnapshot().context.requestDrafts["request-1"],
    );
    actor.stop();
  });

  it("saves from the runner error state", async () => {
    const { layer } = makeLayer({ httpFailure: true });
    const actor = createActor(createPosteeWorkspaceMachine({ layer }));
    actor.start();
    await waitFor(actor, (snapshot) => snapshot.matches({ ready: "idle" }));

    actor.send({ type: "RUN_REQUEST" });
    await waitFor(actor, (snapshot) => snapshot.matches({ ready: "error" }));

    actor.send({ type: "SAVE_REQUEST_DRAFT", draft: changedDraft });
    await waitFor(
      actor,
      (snapshot) => snapshot.context.requestDraftSave.status === "success",
      { timeout: 250 },
    );

    expectCommittedDraft(
      actor.getSnapshot().context.requestDrafts["request-1"],
    );
    actor.stop();
  });

  it("ignores duplicate save and run events while preserving navigation during save", async () => {
    const transactionGate = makeTransactionGate();
    const { layer, recorder } = makeLayer({ transactionGate });
    const actor = createActor(createPosteeWorkspaceMachine({ layer }));
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
    actor.send({
      type: "CREATE_COLLECTION",
      payload: {
        id: CollectionId("collection-2"),
        name: "Other examples",
      },
    });
    actor.send({
      type: "SELECT_COLLECTION",
      collectionId: CollectionId(collection.id),
    });
    actor.send({ type: "SELECT_REQUEST", requestId: RequestId(request.id) });

    actor.send({ type: "SAVE_REQUEST_DRAFT", draft: changedDraft });
    await transactionGate.started;

    actor.send({
      type: "SAVE_REQUEST_DRAFT",
      draft: {
        ...changedDraft,
        body: { ...changedDraft.body, raw: "{\"duplicate\":true}" },
      },
    });
    actor.send({ type: "RUN_REQUEST" });
    actor.send({ type: "SELECT_REQUEST", requestId: RequestId("request-2") });

    expect(actor.getSnapshot().context.activeRequestId).toBe("request-2");

    actor.send({
      type: "SELECT_COLLECTION",
      collectionId: CollectionId("collection-2"),
    });

    expect(actor.getSnapshot().context.activeCollectionId).toBe("collection-2");
    expect(actor.getSnapshot().context.activeRequestId).toBeNull();
    expect(actor.getSnapshot().context.requestDrafts["request-1"]).toEqual(
      originalDraft,
    );
    expect(actor.getSnapshot().context.pendingRequestDraft).toEqual(changedDraft);
    expect(recorder.transactionCalls()).toBe(1);
    expect(recorder.httpCalls()).toBe(0);

    transactionGate.release();
    await waitFor(
      actor,
      (snapshot) => snapshot.context.requestDraftSave.status === "success",
    );

    expectCommittedDraft(
      actor.getSnapshot().context.requestDrafts["request-1"],
    );
    expect(recorder.transactionCalls()).toBe(1);
    expect(recorder.httpCalls()).toBe(0);
    actor.stop();
  });

  it("removes request drafts belonging to deleted collections", async () => {
    const { layer } = makeLayer();
    const actor = createActor(createPosteeWorkspaceMachine({ layer }));
    actor.start();
    await waitFor(actor, (snapshot) => snapshot.matches({ ready: "idle" }));

    actor.send({
      type: "DELETE_COLLECTIONS",
      payload: { ids: [CollectionId(collection.id)] },
    });

    expect(actor.getSnapshot().context.requestDrafts["request-1"]).toBeUndefined();
    actor.stop();
  });

  it("increments the draft revision monotonically across successful saves", async () => {
    const { layer } = makeLayer();
    const actor = createActor(createPosteeWorkspaceMachine({ layer }));
    actor.start();
    await waitFor(actor, (snapshot) => snapshot.matches({ ready: "idle" }));

    actor.send({ type: "SAVE_REQUEST_DRAFT", draft: changedDraft });
    await waitFor(
      actor,
      (snapshot) => snapshot.context.requestDraftSave.revision === 1,
    );

    const firstCommitted = actor.getSnapshot().context.requestDrafts["request-1"];
    const secondDraft: PosteeRequestDraft = {
      ...changedDraft,
      request: {
        ...changedDraft.request,
        name: "Update profile again",
        updated_at: firstCommitted?.request.updated_at ?? 2,
      },
      body: {
        ...changedDraft.body,
        raw: "{\"after\":2}",
      },
    };

    actor.send({ type: "SAVE_REQUEST_DRAFT", draft: secondDraft });
    await waitFor(
      actor,
      (snapshot) => snapshot.context.requestDraftSave.revision === 2,
    );

    expect(actor.getSnapshot().context.requestDraftSave.revision).toBe(2);
    expect(
      actor.getSnapshot().context.requestDrafts["request-1"]?.body.raw,
    ).toBe("{\"after\":2}");
    actor.stop();
  });
});
