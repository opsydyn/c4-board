import { describe, expect, it } from "vitest";
import {
  completeContentTypeHeaders,
  evaluateRequestSemantics,
  getEffectiveRequestPayload,
  getHttpMethodPolicy,
  serializeRequestBody,
} from "./http-method-policy";
import { HTTP_METHODS, PreparedBody, RequestBody } from "./types";

describe("HTTP QUERY method policy", () => {
  it("classifies QUERY as safe, idempotent, and content-required", () => {
    expect(HTTP_METHODS).toContain("QUERY");
    expect(getHttpMethodPolicy("QUERY")).toEqual({
      safe: true,
      idempotent: true,
      content: "required",
      requiresContentType: true,
    });
  });

  it("rejects raw QUERY content without an explicit media type", () => {
    expect(
      evaluateRequestSemantics(
        "QUERY",
        [],
        RequestBody.Raw({ content: "select * from systems" }),
      ),
    ).toBe("QUERY requires a Content-Type for its request content.");
  });

  it("rejects empty QUERY content", () => {
    expect(
      evaluateRequestSemantics("QUERY", [], RequestBody.Json({ content: "" })),
    ).toBe("QUERY requires request content.");
  });

  it("infers one JSON content type without duplicating explicit casing", () => {
    expect(
      completeContentTypeHeaders(
        [],
        RequestBody.Json({ content: "{\"name\":\"opsy\"}" }),
      ),
    ).toEqual([
      { key: "content-type", value: "application/json; charset=utf-8" },
    ]);

    expect(
      completeContentTypeHeaders(
        [{ key: "Content-Type", value: "application/query+json" }],
        RequestBody.Json({ content: "{}" }),
      ),
    ).toEqual([
      { key: "Content-Type", value: "application/query+json" },
    ]);
  });

  it("replaces blank mixed-case Content-Type headers with one inferred JSON type", () => {
    expect(
      completeContentTypeHeaders(
        [
          { key: "Accept", value: "application/json" },
          { key: "cOnTeNt-TyPe", value: "   " },
        ],
        RequestBody.Json({ content: "{}" }),
      ),
    ).toEqual([
      { key: "Accept", value: "application/json" },
      { key: "content-type", value: "application/json; charset=utf-8" },
    ]);
  });

  it("serializes enabled form entries in stable order", () => {
    expect(
      serializeRequestBody(
        RequestBody.Form({
          entries: [["q", "foo"], ["limit", "10"]],
        }),
      ),
    ).toBe("q=foo&limit=10");
  });

  it("infers form content type and accepts a non-empty QUERY", () => {
    const body = RequestBody.Form({ entries: [["q", "foo"]] });

    expect(evaluateRequestSemantics("QUERY", [], body)).toBeNull();
    expect(completeContentTypeHeaders([], body)).toEqual([
      { key: "content-type", value: "application/x-www-form-urlencoded" },
    ]);
  });

  it("accepts raw QUERY content with a case-insensitive explicit Content-Type", () => {
    const headers = [{ key: "cOnTeNt-TyPe", value: "application/sql" }];
    const body = RequestBody.Raw({ content: "select * from systems" });

    expect(evaluateRequestSemantics("QUERY", headers, body)).toBeNull();
    expect(completeContentTypeHeaders(headers, body)).toEqual(headers);
  });

  it("applies QUERY content semantics to prepared bodies", () => {
    expect(
      evaluateRequestSemantics("QUERY", [], PreparedBody.Json({ content: "" })),
    ).toBe("QUERY requires request content.");
    expect(
      completeContentTypeHeaders([], PreparedBody.Json({ content: "" })),
    ).toEqual([]);
    expect(serializeRequestBody(PreparedBody.Json({ content: "" }))).toBeNull();
  });

  it.each(["GET", "HEAD", "TRACE"] as const)(
    "omits content from the effective %s payload",
    (method) => {
      expect(
        getEffectiveRequestPayload(
          method,
          [],
          RequestBody.Json({ content: "{\"q\":\"opsy\"}" }),
        ),
      ).toEqual({
        headers: [],
        body: null,
      });
    },
  );
});
