import { describe, expect, it } from "vitest";
import {
  completeContentTypeHeaders,
  evaluateRequestSemantics,
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

  it("serializes enabled form entries in stable order", () => {
    expect(
      serializeRequestBody(
        RequestBody.Form({
          entries: [["q", "foo"], ["limit", "10"]],
        }),
      ),
    ).toBe("q=foo&limit=10");
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
});
