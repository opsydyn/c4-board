import { Data, Effect, Layer } from "effect";

export type HttpClientErrorType = {
  readonly _tag: "HttpClientError";
  readonly error: unknown;
};

export const HttpClientError =
  Data.tagged<HttpClientErrorType>("HttpClientError");

export type HttpClientType = {
  readonly request: (
    input: RequestInfo,
    init?: RequestInit
  ) => Effect.Effect<Response, HttpClientErrorType>;
};

export class HttpClient extends Effect.Service<HttpClientType>()("HttpClient", {
  sync: () => ({
    request: (input: string | Request | URL, init: RequestInit | undefined) =>
      Effect.tryPromise<Response, HttpClientErrorType>({
        try: () => fetch(input, init),
        catch: (error) => HttpClientError({ error }),
      }),
  }),
}) {}

export const HttpClientLive = Layer.succeed(
  HttpClient,
  HttpClient.of({
    request: (input, init) =>
      Effect.tryPromise<Response, HttpClientErrorType>({
        try: () => fetch(input, init),
        catch: (error) => HttpClientError({ error }),
      }),
  })
);

export const makeHttpClientTestLayer = (
  handler: (
    input: RequestInfo,
    init?: RequestInit
  ) => Effect.Effect<Response, HttpClientErrorType>
) =>
  Layer.succeed(
    HttpClient,
    HttpClient.of({
      request: handler,
    })
  );
