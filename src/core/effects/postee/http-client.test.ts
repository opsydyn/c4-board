import { Cause, Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import { prepareRequest, toRequestInit } from "./http-client";
import { RequestBody, RequestId } from "./types";

describe("prepareRequest", () => {
  it("prepares QUERY JSON with a generated media type", async () => {
    const prepared = await Effect.runPromise(
      prepareRequest({
        id: RequestId("query-1"),
        method: "QUERY",
        url: "https://example.com/feed",
        headers: [],
        body: RequestBody.Json({ content: "{\"q\":\"opsy\"}" }),
        env: { variables: [] },
      }),
    );

    expect(prepared.method).toBe("QUERY");
    expect(prepared.headers).toContainEqual({
      key: "content-type",
      value: "application/json; charset=utf-8",
    });
    expect(toRequestInit(prepared)).toMatchObject({
      method: "QUERY",
      body: "{\"q\":\"opsy\"}",
    });
  });

  it("preserves an explicit QUERY media type without duplication", async () => {
    const prepared = await Effect.runPromise(
      prepareRequest({
        id: RequestId("query-2"),
        method: "QUERY",
        url: "https://example.com/sql",
        headers: [{
          id: 1,
          request_id: "query-2",
          key: "Content-Type",
          value: "application/sql",
          is_enabled: 1,
          sort_order: 0,
        }],
        body: RequestBody.Raw({ content: "select * from systems" }),
        env: { variables: [] },
      }),
    );

    expect(
      prepared.headers.filter(
        (header) => header.key.toLowerCase() === "content-type",
      ),
    ).toEqual([{ key: "Content-Type", value: "application/sql" }]);
  });

  it("replaces a blank mixed-case Content-Type with the inferred QUERY JSON type", async () => {
    const prepared = await Effect.runPromise(
      prepareRequest({
        id: RequestId("query-blank-content-type"),
        method: "QUERY",
        url: "https://example.com/feed",
        headers: [{
          id: 1,
          request_id: "query-blank-content-type",
          key: "cOnTeNt-TyPe",
          value: "   ",
          is_enabled: 1,
          sort_order: 0,
        }],
        body: RequestBody.Json({ content: "{\"q\":\"opsy\"}" }),
        env: { variables: [] },
      }),
    );

    expect(prepared.headers).toEqual([
      { key: "content-type", value: "application/json; charset=utf-8" },
    ]);
  });

  it.each(["GET", "HEAD", "TRACE"] as const)(
    "omits a JSON body and inferred Content-Type when preparing %s",
    async (method) => {
      const prepared = await Effect.runPromise(
        prepareRequest({
          id: RequestId(`forbidden-${method.toLowerCase()}`),
          method,
          url: "https://example.com/feed",
          headers: [],
          body: RequestBody.Json({ content: "{\"q\":\"opsy\"}" }),
          env: { variables: [] },
        }),
      );

      expect(prepared.body).toMatchObject({ _tag: "None" });
      expect(prepared.headers).toEqual([]);
      expect(toRequestInit(prepared)).toEqual({
        method,
        headers: {},
      });
    },
  );

  it.each([
    [RequestBody.None(), "QUERY requires request content."],
    [
      RequestBody.Raw({ content: "select * from systems" }),
      "QUERY requires a Content-Type for its request content.",
    ],
    [
      RequestBody.Json({ content: " \n\t " }),
      "QUERY requires request content.",
    ],
  ])("rejects invalid QUERY content before transport", async (body, message) => {
    const exit = await Effect.runPromiseExit(
      prepareRequest({
        id: RequestId("query-invalid"),
        method: "QUERY",
        url: "https://example.com/query",
        headers: [],
        body,
        env: { variables: [] },
      }),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (!Exit.isFailure(exit)) {
      throw new Error("Expected prepareRequest to fail");
    }
    expect(Cause.pretty(exit.cause)).toContain(message);
  });
});
