import { describe, expect, it } from "vitest";
import * as loadTest from "./load-test";
import type { PosteeRequestDraft } from "./request-draft";

const buildLoadTestRequestPayload = (loadTest as {
  buildLoadTestRequestPayload: (
    method: "QUERY",
    draft: PosteeRequestDraft,
  ) => unknown;
}).buildLoadTestRequestPayload;

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
});
