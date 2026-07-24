import { Effect, Exit, Option } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ADR-010. Phase 1: a response that reached the status line survives a body that
 * cannot be read. Phase 2: the body is carried as bytes with an explicit decode
 * state, and headers keep their repeated entries.
 */

const fetchMock = vi.fn();
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: (...args: unknown[]) => fetchMock(...args) }));

const { HttpClient, HttpClientLive, prepareRequest, responseText, responseTextFailure } = await import(
  "@/core/effects/postee/http-client"
);
const { RequestBody, RequestId } = await import("@/core/effects/postee/types");
const { decodeBodyText } = await import("@/core/effects/postee/response-body");
const { findHeader } = await import("@/core/effects/postee/response-headers");

const preparedRequest = (id = "req-1") =>
  Effect.runPromise(
    prepareRequest({
      id: RequestId(id),
      method: "GET",
      url: "https://httpbin.org/anything?search=red+bmw",
      headers: [],
      body: RequestBody.None(),
      env: { variables: [] },
    }),
  );

const send = (request: Awaited<ReturnType<typeof preparedRequest>>) =>
  Effect.gen(function*() {
    const client = yield* HttpClient;
    return yield* client.send(request);
  }).pipe(Effect.provide(HttpClientLive));

const respondWith = (init: {
  status?: number;
  statusText?: string;
  headers?: ReadonlyArray<readonly [string, string]>;
  bytes?: Uint8Array;
  bodyError?: Error;
}) =>
  fetchMock.mockResolvedValue({
    status: init.status ?? 200,
    statusText: init.statusText ?? "OK",
    headers: new Headers([...(init.headers ?? [])] as Array<[string, string]>),
    arrayBuffer: () =>
      init.bodyError
        ? Promise.reject(init.bodyError)
        : Promise.resolve((init.bytes ?? new Uint8Array()).buffer),
  });

const utf8 = (text: string) => new TextEncoder().encode(text);

beforeEach(() => {
  fetchMock.mockReset();
});

describe("HTTP response integrity", () => {
  it("keeps the response when the body cannot be read", async () => {
    respondWith({
      status: 500,
      statusText: "Internal Server Error",
      headers: [["retry-after", "30"]],
      bodyError: new TypeError("stream closed"),
    });

    const response = await Effect.runPromise(send(await preparedRequest()));

    expect(response.status).toBe(500);
    expect(response.statusText).toBe("Internal Server Error");
    expect(findHeader(response.headerEntries, "retry-after")).toEqual(Option.some("30"));
    expect(response.body._tag).toBe("DecodeFailure");
  });

  it("reports why the body could not be read", async () => {
    respondWith({ bodyError: new TypeError("stream closed") });

    const response = await Effect.runPromise(send(await preparedRequest()));

    expect(responseTextFailure(response)).toContain("stream closed");
    expect(responseText(response)).toEqual(Option.none());
    expect(response.rawSize).toBe(0);
  });

  it("leaves a decodable response untouched", async () => {
    const payload = "{\"args\":{\"search\":\"red bmw\"}}";
    respondWith({ headers: [["content-type", "application/json"]], bytes: utf8(payload) });

    const response = await Effect.runPromise(send(await preparedRequest()));

    expect(responseText(response)).toEqual(Option.some(payload));
    expect(responseTextFailure(response)).toBeNull();
    expect(response.body._tag).toBe("Decoded");
  });

  it("still fails when no response was received at all", async () => {
    fetchMock.mockRejectedValue(new Error("error sending request for url"));

    expect(Exit.isFailure(await Effect.runPromiseExit(send(await preparedRequest())))).toBe(true);
  });

  it("names the underlying cause in the transport error message", async () => {
    fetchMock.mockRejectedValue(new Error("error sending request for url"));

    const exit = await Effect.runPromiseExit(send(await preparedRequest()));

    if (!Exit.isFailure(exit)) throw new Error("Expected a transport failure");
    // `cause` serialises to {} — the message must carry the detail itself.
    expect(JSON.stringify(exit.cause)).toContain("error sending request for url");
  });
});

describe("HTTP response body (ADR-010 Phase 2)", () => {
  it("carries the raw bytes so binary payloads survive intact", async () => {
    // A PNG header: valid bytes, not valid UTF-8.
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    respondWith({ headers: [["content-type", "image/png"]], bytes: png });

    const response = await Effect.runPromise(send(await preparedRequest()));

    if (response.body._tag !== "Decoded") throw new Error("Expected a decoded body");
    expect(Array.from(response.body.bytes)).toEqual(Array.from(png));
    // Not text — reported as such rather than mangled into replacement characters.
    expect(decodeBodyText(response.body, "image/png")).toEqual(Option.none());
  });

  it("measures size from the bytes received, not from a re-encoded string", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0xff, 0xfe]);
    respondWith({ headers: [["content-type", "image/png"]], bytes: png });

    const response = await Effect.runPromise(send(await preparedRequest()));

    expect(response.rawSize).toBe(png.byteLength);
  });

  it("preserves repeated Set-Cookie headers", async () => {
    respondWith({
      headers: [["set-cookie", "session=abc"], ["set-cookie", "csrf=xyz"]],
      bytes: utf8("{}"),
    });

    const response = await Effect.runPromise(send(await preparedRequest()));

    const cookies = response.headerEntries.filter(([key]) => key === "set-cookie").map(([, value]) => value);
    expect(cookies).toEqual(["session=abc", "csrf=xyz"]);
  });

  it("decodes text according to the declared charset", async () => {
    respondWith({
      headers: [["content-type", "text/plain; charset=iso-8859-1"]],
      bytes: new Uint8Array([0x63, 0x61, 0x66, 0xe9]),
    });

    const response = await Effect.runPromise(send(await preparedRequest()));

    expect(responseText(response)).toEqual(Option.some("café"));
    expect(responseTextFailure(response)).toBeNull();
  });

  it("reports a body that is not valid text in its declared charset", async () => {
    respondWith({
      headers: [["content-type", "application/json"]],
      bytes: new Uint8Array([0x7b, 0x80, 0x7d]),
    });

    const response = await Effect.runPromise(send(await preparedRequest()));

    expect(response.body._tag).toBe("Decoded"); // the bytes arrived
    expect(responseText(response)).toEqual(Option.none()); // but they are not text
    expect(responseTextFailure(response)).toBeTruthy();
  });
});
