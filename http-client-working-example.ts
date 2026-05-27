import { Data, Effect, Layer } from "effect";

export type HttpClientErrorType = {
  readonly _tag: "HttpClientError";
  readonly error: unknown;
};

export const HttpClientError = Data.tagged<HttpClientErrorType>("HttpClientError");

export type HttpClientRequest = RequestInfo | URL;

export type HttpClientType = {
  readonly request: (
    input: HttpClientRequest,
    init?: RequestInit,
  ) => Effect.Effect<Response, HttpClientErrorType>;
};

export class HttpClient extends Effect.Service<HttpClient>()("HttpClient", {
  sync: () => ({
    request: (input: HttpClientRequest, init?: RequestInit) =>
      Effect.tryPromise<Response, HttpClientErrorType>({
        try: () => fetch(input, init),
        catch: (error) => HttpClientError({ error }),
      }),
  }),
}) {}

export const HttpClientLive = Layer.succeed(
  HttpClient,
  HttpClient.make({
    request: (input, init) =>
      Effect.tryPromise<Response, HttpClientErrorType>({
        try: () => fetch(input, init),
        catch: (error) => HttpClientError({ error }),
      }),
  }),
);

export const makeHttpClientTestLayer = (
  handler: (
    input: HttpClientRequest,
    init?: RequestInit,
  ) => Effect.Effect<Response, HttpClientErrorType>,
) =>
  Layer.succeed(
    HttpClient,
    HttpClient.make({
      request: handler,
    }),
  );
