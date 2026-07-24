import { findHeader, formatHeaderBlock, headerEntriesFromStored } from "@/core/effects/postee/response-headers";
import { Option } from "effect";
import { describe, expect, it } from "vitest";

/**
 * ADR-010 Phase 4. Headers travel as entries so repeated field lines survive.
 * History rows written before that change hold a JSON object instead, so reading
 * has to cope with both shapes rather than rendering old rows as an indexed array.
 */

describe("headerEntriesFromStored", () => {
  it("reads entries written as pairs", () => {
    const stored = JSON.stringify([["content-type", "application/json"], ["set-cookie", "a=1"], ["set-cookie", "b=2"]]);

    expect(headerEntriesFromStored(stored)).toEqual([
      ["content-type", "application/json"],
      ["set-cookie", "a=1"],
      ["set-cookie", "b=2"],
    ]);
  });

  it("reads legacy rows written as an object", () => {
    const stored = JSON.stringify({ "content-type": "application/json", "x-request-id": "abc" });

    expect(headerEntriesFromStored(stored)).toEqual([
      ["content-type", "application/json"],
      ["x-request-id", "abc"],
    ]);
  });

  it("yields nothing for absent or unparseable values", () => {
    expect(headerEntriesFromStored(null)).toEqual([]);
    expect(headerEntriesFromStored("")).toEqual([]);
    expect(headerEntriesFromStored("not json")).toEqual([]);
  });
});

describe("findHeader", () => {
  const entries = [["Content-Type", "application/json"], ["set-cookie", "a=1"]] as const;

  it("matches case-insensitively, as field names are", () => {
    expect(findHeader(entries, "content-type")).toEqual(Option.some("application/json"));
    expect(findHeader(entries, "CONTENT-TYPE")).toEqual(Option.some("application/json"));
  });

  it("is None when the field is absent", () => {
    expect(findHeader(entries, "retry-after")).toEqual(Option.none());
  });
});

describe("formatHeaderBlock", () => {
  it("renders one field line per entry, repeats included", () => {
    const block = formatHeaderBlock([
      ["content-type", "application/json"],
      ["set-cookie", "a=1"],
      ["set-cookie", "b=2"],
    ]);

    expect(block).toBe("content-type: application/json\nset-cookie: a=1\nset-cookie: b=2");
  });
});
