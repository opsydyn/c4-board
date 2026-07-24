import { Effect, Exit } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ADR-010 Phase 1: a response that reached the status line must survive a body
 * that cannot be decoded. Previously `response.text()` was awaited inside the
 * success continuation, so a decode rejection landed in the same `.catch` as a
 * connection failure and the status, headers, and timing were discarded.
 */

const fetchMock = vi.fn();
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: (...args: unknown[]) => fetchMock(...args) }));

const { HttpClient, HttpClientLive, prepareRequest } = await import("@/core/effects/postee/http-client");
const { RequestBody, RequestId } = await import("@/core/effects/postee/types");

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

/** A response whose status line arrived but whose body cannot be decoded. */
const undecodableResponse = (init: { status: number; headers: ReadonlyArray<readonly [string, string]> }) => ({
  status: init.status,
  statusText: "Internal Server Error",
  headers: new Headers([...init.headers] as Array<[string, string]>),
  text: () => Promise.reject(new TypeError("The string did not match the expected pattern.")),
});

beforeEach(() => {
  fetchMock.mockReset();
});

describe("HTTP response integrity", () => {
  it("keeps the response when the body cannot be decoded", async () => {
    fetchMock.mockResolvedValue(
      undecodableResponse({ status: 500, headers: [["retry-after", "30"]] }),
    );

    const response = await Effect.runPromise(send(await preparedRequest()));

    expect(response.status).toBe(500);
    expect(response.statusText).toBe("Internal Server Error");
    expect(response.headers["retry-after"]).toBe("30");
  });

  it("reports why the body could not be decoded", async () => {
    fetchMock.mockResolvedValue(undecodableResponse({ status: 200, headers: [] }));

    const response = await Effect.runPromise(send(await preparedRequest()));

    expect(response.bodyDecodeError).toBeTruthy();
    expect(response.bodyDecodeError).toContain("did not match the expected pattern");
    expect(response.bodyText).toBe("");
    expect(response.rawSize).toBe(0);
  });

  it("leaves a decodable response untouched", async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: new Headers([["content-type", "application/json"]]),
      text: () => Promise.resolve("{\"args\":{\"search\":\"red bmw\"}}"),
    });

    const response = await Effect.runPromise(send(await preparedRequest()));

    expect(response.status).toBe(200);
    expect(response.bodyText).toBe("{\"args\":{\"search\":\"red bmw\"}}");
    expect(response.bodyDecodeError).toBeNull();
    expect(response.rawSize).toBeGreaterThan(0);
  });

  it("still fails when no response was received at all", async () => {
    fetchMock.mockRejectedValue(new Error("error sending request for url"));

    const exit = await Effect.runPromiseExit(send(await preparedRequest()));

    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("names the underlying cause in the transport error message", async () => {
    fetchMock.mockRejectedValue(new Error("error sending request for url"));

    const exit = await Effect.runPromiseExit(send(await preparedRequest()));

    if (!Exit.isFailure(exit)) throw new Error("Expected a transport failure");
    const failure = JSON.stringify(exit.cause);
    // `cause` serialises to {} — the message must carry the detail itself.
    expect(failure).toContain("error sending request for url");
  });
});
