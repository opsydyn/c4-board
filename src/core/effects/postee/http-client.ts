import { fetch as TauriFetch } from "@tauri-apps/plugin-http";
import { Context, Data, Duration, Effect, Layer, Match } from "effect";
import {
  evaluateRequestSemantics,
  getEffectiveRequestContent,
  getEffectiveRequestPayload,
  hasRequestContent,
  normalizeRequestContent,
} from "./http-method-policy";
import type { EnvironmentVariable, RequestHeader } from "./schema";
import {
  type Bytes,
  Bytes as BytesBrand,
  durationFromMillis,
  durationToMillis,
  type HttpMethod,
  type HttpUrl,
  HttpUrl as HttpUrlBrand,
  type PreparedBody,
  RequestBody,
  type RequestId,
  type StatusCode,
  StatusCode as StatusCodeBrand,
  type TimeDuration,
} from "./types";

// =============================================================================
// HTTP Service (Effect.Service based)
// =============================================================================

export interface PreparedRequest {
  readonly id: RequestId;
  readonly method: HttpMethod;
  readonly url: HttpUrl;
  readonly headers: ReadonlyArray<{ readonly key: string; readonly value: string }>;
  readonly body: PreparedBody;
  readonly timeout: TimeDuration;
}

export interface PreparedResponse {
  readonly status: StatusCode;
  readonly statusText: string;
  readonly headers: Record<string, string>;
  readonly bodyText: string;
  /**
   * Why the body could not be decoded, or `null` when it decoded cleanly.
   *
   * A response that reached the status line is delivered even when its body is
   * unreadable — status, headers, and timing are real information and must not be
   * discarded. `bodyText` is empty in that case, so this field is the only way to
   * tell "the server sent nothing" apart from "we could not read what it sent".
   *
   * Interim shim per ADR-010: superseded in Phase 2 by a tagged `ResponseBody`
   * that carries the raw bytes.
   */
  readonly bodyDecodeError: string | null;
  readonly duration: TimeDuration;
  readonly rawSize: Bytes;
}

export type HttpClientErrorType = {
  readonly _tag: "HttpClientError";
  readonly message: string;
  readonly cause?: unknown;
  readonly request?: {
    readonly method: HttpMethod;
    readonly url: string;
  };
};

export type HttpClientTimeoutErrorType = {
  readonly _tag: "HttpClientTimeoutError";
  readonly message: string;
  readonly elapsed: TimeDuration;
};

export type HttpClientAbortedErrorType = {
  readonly _tag: "HttpClientAbortedError";
  readonly message: string;
};

export const HttpClientError = Data.tagged<HttpClientErrorType>(
  "HttpClientError",
);
export const HttpClientTimeoutError = Data.tagged<HttpClientTimeoutErrorType>("HttpClientTimeoutError");
export const HttpClientAbortedError = Data.tagged<HttpClientAbortedErrorType>(
  "HttpClientAbortedError",
);

export type HttpClientFailure =
  | HttpClientErrorType
  | HttpClientTimeoutErrorType
  | HttpClientAbortedErrorType;

export type HttpClientDriver = {
  readonly send: (
    request: PreparedRequest,
  ) => Effect.Effect<PreparedResponse, HttpClientFailure>;
  readonly sendWith: <A>(
    request: PreparedRequest,
    mapper: (response: PreparedResponse) => A,
  ) => Effect.Effect<A, HttpClientFailure>;
  readonly abort: (requestId: RequestId) => Effect.Effect<boolean, never>;
};

export class HttpClient extends Context.Tag("Postee/HttpClient")<
  HttpClient,
  HttpClientDriver
>() {}

// =============================================================================
// Environment helpers
// =============================================================================

const VARIABLE_PATTERN = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g;

export interface EnvironmentSnapshot {
  variables: ReadonlyArray<EnvironmentVariable>;
}

export const resolveTemplate = (
  value: string,
  env: EnvironmentSnapshot,
): string =>
  value.replace(VARIABLE_PATTERN, (_, rawKey: string) => {
    const key = rawKey.trim();
    const match = env.variables.find(
      (variable) => variable.is_enabled === 1 && variable.key === key,
    );
    return match?.value ?? "";
  });

export const resolveHeaders = (
  headers: ReadonlyArray<RequestHeader>,
  env: EnvironmentSnapshot,
): ReadonlyArray<{ key: string; value: string }> =>
  headers
    .filter((header) => header.is_enabled === 1)
    .map((header) => ({
      key: resolveTemplate(header.key, env),
      value: resolveTemplate(header.value ?? "", env),
    }))
    .filter((header) => header.key.length > 0);

export interface PrepareRequestParams {
  readonly id: RequestId;
  readonly method: HttpMethod;
  readonly url: string; // Raw string, will be validated
  readonly headers: ReadonlyArray<RequestHeader>;
  readonly body: RequestBody;
  readonly timeout?: TimeDuration;
  readonly env: EnvironmentSnapshot;
}

export const prepareRequest = (
  params: PrepareRequestParams,
): Effect.Effect<PreparedRequest, HttpClientErrorType> =>
  Effect.gen(function*() {
    // Resolve URL template and validate
    const resolvedUrl = resolveTemplate(params.url, params.env);
    const url = yield* Effect.try({
      try: () => HttpUrlBrand(resolvedUrl),
      catch: () =>
        HttpClientError({
          message: `Invalid URL: ${resolvedUrl}`,
          request: {
            method: params.method,
            url: resolvedUrl,
          },
        }),
    });

    // Resolve headers
    const headers = resolveHeaders(params.headers, params.env);

    // Default timeout: 30 seconds
    const timeout = params.timeout ?? Duration.seconds(30);

    // Prepare body using pattern matching
    const body = yield* Match.value(params.body).pipe(
      // GET and HEAD should never have a body
      Match.when({ _tag: "None" }, () => Effect.succeed(RequestBody.None())),
      // Raw body - just resolve templates
      Match.when({ _tag: "Raw" }, ({ content }) =>
        Effect.succeed(
          RequestBody.Raw({
            content: resolveTemplate(content, params.env),
          }),
        )),
      // JSON body - resolve templates and validate JSON
      Match.when({ _tag: "Json" }, ({ content }) =>
        Effect.gen(function*() {
          const resolved = resolveTemplate(content, params.env);
          const normalizedBody = normalizeRequestContent(
            RequestBody.Json({ content: resolved }),
          );

          if (!hasRequestContent(normalizedBody)) {
            return normalizedBody;
          }

          // Validate JSON syntax
          yield* Effect.try({
            try: () => JSON.parse(resolved),
            catch: (cause) =>
              HttpClientError({
                message: "Invalid JSON body",
                cause,
                request: {
                  method: params.method,
                  url: resolvedUrl,
                },
              }),
          });

          return normalizedBody;
        })),
      // Form body - resolve each entry
      Match.when({ _tag: "Form" }, ({ entries }) =>
        Effect.succeed(
          RequestBody.Form({
            entries: entries.map(
              ([k, v]) =>
                [
                  resolveTemplate(k, params.env),
                  resolveTemplate(v, params.env),
                ] as const,
            ),
          }),
        )),
      Match.exhaustive,
    );

    const issue = evaluateRequestSemantics(params.method, headers, body);
    if (issue) {
      return yield* Effect.fail(
        HttpClientError({
          message: issue,
          request: {
            method: params.method,
            url: resolvedUrl,
          },
        }),
      );
    }

    const effectivePayload = getEffectiveRequestPayload(
      params.method,
      headers,
      body,
    );
    const effectiveBody = getEffectiveRequestContent(params.method, body);

    return {
      id: params.id,
      method: params.method,
      url,
      headers: effectivePayload.headers,
      body: effectiveBody,
      timeout,
    };
  });

// =============================================================================
// Live Layer
// =============================================================================

export const toRequestInit = (request: PreparedRequest): RequestInit => {
  const payload = getEffectiveRequestPayload(
    request.method,
    request.headers,
    request.body,
  );
  const headers = payload.headers.reduce(
    (record, header) => ({ ...record, [header.key]: header.value }),
    {} as Record<string, string>,
  );

  return payload.body !== null
    ? { method: request.method, headers, body: payload.body }
    : { method: request.method, headers };
};

const renderCause = (cause: unknown): string => cause instanceof Error ? cause.message : String(cause);

interface DecodedBody {
  readonly text: string;
  readonly decodeError: string | null;
  readonly size: number;
}

/**
 * Reads the response body without ever rejecting.
 *
 * Decoding is attempted separately from the transport so a failure here cannot
 * reach the request's `.catch` and take the whole response — status, headers, and
 * timing included — down with it (ADR-010).
 */
const readResponseBody = (response: { readonly text: () => Promise<string> }): Promise<DecodedBody> =>
  response.text().then(
    (text) => ({ text, decodeError: null, size: new TextEncoder().encode(text).byteLength }),
    (cause: unknown) => ({ text: "", decodeError: renderCause(cause), size: 0 }),
  );

const responseHeadersToRecord = (headers: Headers): Record<string, string> => {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
};

const makeAbortController = () => new AbortController();

const logRequestFailure = (
  request: PreparedRequest,
  error: HttpClientFailure,
) => {
  console.error("[postee][http-client] request failed", {
    id: request.id,
    method: request.method,
    url: String(request.url),
    error,
  });
};

export const HttpClientLive = Layer.sync(HttpClient, () => {
  const inflight = new Map<string, AbortController>();

  const send: HttpClientDriver["send"] = (request) =>
    Effect.async<PreparedResponse, HttpClientFailure>((resume) => {
      const controller = makeAbortController();
      inflight.set(request.id, controller);

      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        inflight.delete(request.id);
      };

      timeoutId = setTimeout(() => {
        controller.abort("timeout");
      }, durationToMillis(request.timeout));

      const init: RequestInit = {
        ...toRequestInit(request),
        signal: controller.signal,
      };

      const started = performance.now();

      TauriFetch(request.url, init)
        .then(async (response) => {
          const body = await readResponseBody(response);
          const durationMs = performance.now() - started;

          const payload: PreparedResponse = {
            status: StatusCodeBrand(response.status),
            statusText: response.statusText,
            headers: responseHeadersToRecord(response.headers),
            bodyText: body.text,
            bodyDecodeError: body.decodeError,
            duration: durationFromMillis(Math.round(durationMs)),
            rawSize: BytesBrand(body.size),
          };

          cleanup();
          resume(Effect.succeed(payload));
        })
        .catch((cause: unknown) => {
          const reason = controller.signal.reason;
          cleanup();

          // Log the raw error for debugging Tauri fetch issues
          console.error("[postee][http-client] Raw fetch error:", {
            cause,
            causeType: typeof cause,
            causeConstructor: cause?.constructor?.name,
            causeMessage: cause instanceof Error ? cause.message : String(cause),
            causeStack: cause instanceof Error ? cause.stack : undefined,
            reason,
            request: {
              method: request.method,
              url: String(request.url),
            },
          });

          // Use pattern matching for error handling
          const error = Match.value(cause).pipe(
            Match.when(
              (c: DOMException): c is DOMException => c instanceof DOMException && c.name === "AbortError",
              () =>
                Match.value(reason).pipe(
                  Match.when(
                    "timeout",
                    () =>
                      HttpClientTimeoutError({
                        message: "HTTP request timed out",
                        elapsed: request.timeout,
                      }),
                  ),
                  Match.when(
                    "cancelled",
                    () =>
                      HttpClientAbortedError({
                        message: "HTTP request was cancelled",
                      }),
                  ),
                  Match.orElse(() =>
                    HttpClientError({
                      message: "Request aborted",
                      cause,
                      request: {
                        method: request.method,
                        url: String(request.url),
                      },
                    })
                  ),
                ),
            ),
            Match.orElse(() =>
              HttpClientError({
                // `cause` serialises to {} when it is an Error, so the detail has
                // to live in the message or it is invisible to the user.
                message: `Failed to perform HTTP request: ${renderCause(cause)}`,
                cause,
                request: {
                  method: request.method,
                  url: String(request.url),
                },
              })
            ),
          );

          const enrichedError: HttpClientFailure = error._tag === "HttpClientError"
            ? HttpClientError({
              message: error.message,
              cause: error.cause,
              request: error.request ?? {
                method: request.method,
                url: String(request.url),
              },
            })
            : error;

          logRequestFailure(request, enrichedError);
          resume(Effect.fail(enrichedError));
        });

      return Effect.sync(cleanup);
    });

  const sendWith: HttpClientDriver["sendWith"] = (request, mapper) => Effect.map(send(request), mapper);

  const abort: HttpClientDriver["abort"] = (requestId) =>
    Effect.sync(() => {
      const controller = inflight.get(requestId);
      if (!controller) {
        return false;
      }

      inflight.delete(requestId);
      controller.abort("cancelled");
      return true;
    });

  return {
    send,
    sendWith,
    abort,
  };
});

export const makeHttpClientTestLayer = (
  handler: (
    request: PreparedRequest,
  ) => Effect.Effect<PreparedResponse, HttpClientFailure>,
) =>
  Layer.succeed(
    HttpClient,
    {
      send: handler,
      sendWith: (request, mapper) => Effect.map(handler(request), mapper),
      abort: () => Effect.succeed(false),
    },
  );

// =============================================================================
// Convenience helpers
// =============================================================================

export const executeWithClient = <A>(
  request: PreparedRequest,
  onSuccess: (response: PreparedResponse) => Effect.Effect<A>,
): Effect.Effect<A, HttpClientFailure, HttpClient> =>
  Effect.gen(function*() {
    const client = yield* HttpClient;
    const response = yield* client.send(request);
    return yield* onSuccess(response);
  });
