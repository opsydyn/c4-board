import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildLoadTestRequestPayload, startLoadTest } from "./load-test";
import type { PosteeRequestDraft } from "./request-draft";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

const queryJsonDraft: PosteeRequestDraft = {
  request: {
    id: "query-1",
    collection_id: "collection-1",
    name: "Query JSON",
    method: "QUERY",
    url: "https://example.com/feed",
    description: null,
    favorite: 0,
    sort_order: 0,
    created_at: 1,
    updated_at: 1,
  },
  headers: [],
  body: {
    request_id: "query-1",
    mode: "json",
    raw: "{\"q\":\"opsy\"}",
    form_values: null,
  },
};

const rawQueryDraft: PosteeRequestDraft = {
  ...queryJsonDraft,
  body: {
    ...queryJsonDraft.body,
    mode: "raw",
    raw: "select * from systems",
  },
};

const formQueryDraft: PosteeRequestDraft = {
  ...queryJsonDraft,
  body: {
    ...queryJsonDraft.body,
    mode: "form",
    raw: null,
    form_values: JSON.stringify([
      { key: "q", value: "opsy" },
      { key: "disabled", value: "ignored", enabled: false },
    ]),
  },
};

const rawQueryWithContentTypeDraft: PosteeRequestDraft = {
  ...rawQueryDraft,
  headers: [{
    id: "content-type",
    key: "Content-Type",
    value: "application/sql",
    enabled: true,
  }],
};

const blankContentTypeQueryDraft: PosteeRequestDraft = {
  ...queryJsonDraft,
  headers: [{
    id: "blank-content-type",
    key: "cOnTeNt-TyPe",
    value: "  ",
    enabled: true,
  }],
};

const tauriWindow = window as typeof window & {
  __TAURI_INTERNALS__?: unknown;
};

const startPayload = async (draft: PosteeRequestDraft) => {
  const payload = buildLoadTestRequestPayload("QUERY", draft);
  if (payload._tag === "Invalid") {
    throw new Error(payload.message);
  }

  await Effect.runPromise(
    startLoadTest({
      url: draft.request.url,
      method: payload.method,
      headers: [...payload.headers],
      body: payload.body,
    }),
  );
};

afterEach(() => {
  delete tauriWindow.__TAURI_INTERNALS__;
});

describe("buildLoadTestRequestPayload", () => {
  it("builds a QUERY load-test payload with generated JSON media type", () => {
    expect(buildLoadTestRequestPayload("QUERY", queryJsonDraft)).toEqual({
      _tag: "Valid",
      method: "QUERY",
      headers: [{
        key: "content-type",
        value: "application/json; charset=utf-8",
      }],
      body: "{\"q\":\"opsy\"}",
    });
  });

  it("rejects a raw QUERY load-test payload without Content-Type", () => {
    expect(buildLoadTestRequestPayload("QUERY", rawQueryDraft)).toEqual({
      _tag: "Invalid",
      message: "QUERY requires a Content-Type for its request content.",
    });
  });

  it("replaces a blank mixed-case Content-Type with the inferred QUERY JSON type", () => {
    expect(buildLoadTestRequestPayload("QUERY", blankContentTypeQueryDraft)).toEqual({
      _tag: "Valid",
      method: "QUERY",
      headers: [{
        key: "content-type",
        value: "application/json; charset=utf-8",
      }],
      body: "{\"q\":\"opsy\"}",
    });
  });

  it.each(["GET", "HEAD", "TRACE"] as const)(
    "omits a JSON body and inferred Content-Type from the %s load-test payload",
    (method) => {
      expect(
        buildLoadTestRequestPayload(method, {
          ...queryJsonDraft,
          request: { ...queryJsonDraft.request, method },
        }),
      ).toEqual({
        _tag: "Valid",
        method,
        headers: [],
        body: null,
      });
    },
  );

  it("invokes the native runner with a form QUERY payload", async () => {
    tauriWindow.__TAURI_INTERNALS__ = {};
    invokeMock.mockResolvedValue(undefined);

    await startPayload(formQueryDraft);

    expect(invokeMock).toHaveBeenCalledWith("start_load_test", {
      config: {
        url: "https://example.com/feed",
        method: "QUERY",
        headers: [["content-type", "application/x-www-form-urlencoded"]],
        body: "q=opsy",
        duration_secs: 10,
        concurrency: 10,
        rps_limit: null,
        timeout_ms: 30_000,
      },
    });
  });

  it("invokes the native runner with an explicit raw QUERY Content-Type", async () => {
    tauriWindow.__TAURI_INTERNALS__ = {};
    invokeMock.mockResolvedValue(undefined);

    await startPayload(rawQueryWithContentTypeDraft);

    expect(invokeMock).toHaveBeenCalledWith("start_load_test", {
      config: {
        url: "https://example.com/feed",
        method: "QUERY",
        headers: [["Content-Type", "application/sql"]],
        body: "select * from systems",
        duration_secs: 10,
        concurrency: 10,
        rps_limit: null,
        timeout_ms: 30_000,
      },
    });
  });
});
