import { ResponseBody, contentTypeCharset, decodeBodyText } from "@/core/effects/postee/response-body";
import { Option } from "effect";
import { describe, expect, it } from "vitest";

/**
 * ADR-010 Phase 2. Decoding is a pure concern kept out of the client: the client
 * obtains bytes, this decides whether those bytes are text. A response body that
 * is not valid text is a fact worth reporting, not something to paper over with
 * replacement characters.
 */

const utf8 = (text: string) => new TextEncoder().encode(text);

/** 0x80 is a continuation byte with no lead byte — never valid UTF-8. */
const invalidUtf8 = () => new Uint8Array([0x7b, 0x80, 0x7d]);

describe("decodeBodyText", () => {
  it("decodes valid UTF-8 bytes", () => {
    const body = ResponseBody.Decoded({ bytes: utf8("{\"search\":\"red bmw\"}") });

    expect(decodeBodyText(body, "application/json")).toEqual(Option.some("{\"search\":\"red bmw\"}"));
  });

  it("decodes non-ASCII content without mangling it", () => {
    const body = ResponseBody.Decoded({ bytes: utf8("café — 日本語") });

    expect(decodeBodyText(body, "text/plain; charset=utf-8")).toEqual(Option.some("café — 日本語"));
  });

  it("reports bytes that are not valid text rather than substituting replacement characters", () => {
    const body = ResponseBody.Decoded({ bytes: invalidUtf8() });

    expect(decodeBodyText(body, "application/json")).toEqual(Option.none());
  });

  it("honours an explicit charset", () => {
    // 0xE9 is é in latin1 and invalid on its own in UTF-8.
    const body = ResponseBody.Decoded({ bytes: new Uint8Array([0x63, 0x61, 0x66, 0xe9]) });

    expect(decodeBodyText(body, "text/plain; charset=iso-8859-1")).toEqual(Option.some("café"));
    expect(decodeBodyText(body, "text/plain")).toEqual(Option.none());
  });

  it("has no text to offer when the body never arrived", () => {
    const body = ResponseBody.DecodeFailure({
      partial: Option.none(),
      message: "stream closed",
      cause: new Error("stream closed"),
    });

    expect(decodeBodyText(body, "application/json")).toEqual(Option.none());
  });

  it("decodes the partial bytes of a failed body when they are valid text", () => {
    const body = ResponseBody.DecodeFailure({
      partial: Option.some(utf8("{\"partial\":true")),
      message: "stream closed",
      cause: new Error("stream closed"),
    });

    expect(decodeBodyText(body, "application/json")).toEqual(Option.some("{\"partial\":true"));
  });

  it("treats an empty body as empty text, not as a failure", () => {
    const body = ResponseBody.Decoded({ bytes: new Uint8Array() });

    expect(decodeBodyText(body, "application/json")).toEqual(Option.some(""));
  });
});

describe("contentTypeCharset", () => {
  it("extracts a quoted or bare charset", () => {
    expect(contentTypeCharset("text/plain; charset=utf-8")).toBe("utf-8");
    expect(contentTypeCharset("text/plain; charset=\"ISO-8859-1\"")).toBe("iso-8859-1");
  });

  it("defaults to utf-8 when absent or unparseable", () => {
    expect(contentTypeCharset("application/json")).toBe("utf-8");
    expect(contentTypeCharset(null)).toBe("utf-8");
  });
});
