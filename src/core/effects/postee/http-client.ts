import { Context, Data, Duration, Effect, Layer, Match } from "effect";
import { Semigroup } from "@effect/typeclass";
import type { EnvironmentVariable, RequestHeader } from "./schema";
import {
	type HttpMethod,
	type HttpUrl,
	type RequestId,
	type PreparedBody,
	type TimeDuration,
	type StatusCode,
	type Bytes,
	RequestBody,
	HttpUrl as HttpUrlBrand,
	StatusCode as StatusCodeBrand,
	Bytes as BytesBrand,
	durationFromMillis,
	durationToMillis,
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
	readonly duration: TimeDuration;
	readonly rawSize: Bytes;
}

export type HttpClientErrorType = {
	readonly _tag: "HttpClientError";
	readonly message: string;
	readonly cause?: unknown;
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
export const HttpClientTimeoutError =
	Data.tagged<HttpClientTimeoutErrorType>("HttpClientTimeoutError");
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
	Effect.gen(function* () {
		// Resolve URL template and validate
		const resolvedUrl = resolveTemplate(params.url, params.env);
		const url = yield* Effect.try({
			try: () => HttpUrlBrand(resolvedUrl),
			catch: () =>
				HttpClientError({
					message: `Invalid URL: ${resolvedUrl}`,
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
				),
			),
			// JSON body - resolve templates and validate JSON
			Match.when({ _tag: "Json" }, ({ content }) =>
				Effect.gen(function* () {
					const resolved = resolveTemplate(content, params.env);

					// Empty JSON is okay
					if (resolved.trim().length === 0) {
						return RequestBody.Json({ content: "" });
					}

					// Validate JSON syntax
					yield* Effect.try({
						try: () => JSON.parse(resolved),
						catch: (cause) =>
							HttpClientError({
								message: "Invalid JSON body",
								cause,
							}),
					});

					return RequestBody.Json({ content: resolved });
				}),
			),
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
				),
			),
			Match.exhaustive,
		);

		return {
			id: params.id,
			method: params.method,
			url,
			headers,
			body,
			timeout,
		};
	});

// =============================================================================
// Live Layer
// =============================================================================

/**
 * Semigroup for combining header records (last value wins)
 */
const HeaderRecordSemigroup: Semigroup.Semigroup<Record<string, string>> =
	Semigroup.make((a, b) => ({ ...a, ...b }));

const toFetchInit = (request: PreparedRequest): RequestInit => {
	// Use Semigroup to combine headers (functional approach)
	const headers = request.headers.reduce(
		(acc, row) => HeaderRecordSemigroup.combine(acc, { [row.key]: row.value }),
		{} as Record<string, string>,
	);

	const method = request.method;

	// Use pattern matching for body handling
	return Match.value(request.body).pipe(
		Match.tag("None", () => ({
			method,
			headers,
		})),
		Match.tag("Raw", ({ content }) => ({
			method,
			headers,
			body: content,
		})),
		Match.tag("Json", ({ content }) => ({
			method,
			headers: {
				"content-type":
					headers["content-type"] ?? "application/json; charset=utf-8",
				...headers,
			},
			body: content,
		})),
		Match.tag("Form", ({ entries }) => {
			const form = new URLSearchParams();
			for (const [key, value] of entries) {
				form.append(key, value);
			}
			return {
				method,
				headers: {
					"content-type":
						headers["content-type"] ?? "application/x-www-form-urlencoded",
					...headers,
				},
				body: form,
			};
		}),
		Match.exhaustive,
	);
};

const responseHeadersToRecord = (headers: Headers): Record<string, string> => {
	const result: Record<string, string> = {};
	headers.forEach((value, key) => {
		result[key] = value;
	});
	return result;
};

const makeAbortController = () => new AbortController();

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
					...toFetchInit(request),
					signal: controller.signal,
				};

				const started = performance.now();

				fetch(request.url, init)
					.then(async (response) => {
						const durationMs = performance.now() - started;
						const bodyText = await response.text();
						const rawSize = new TextEncoder().encode(bodyText).byteLength;

						const payload: PreparedResponse = {
							status: StatusCodeBrand(response.status),
							statusText: response.statusText,
							headers: responseHeadersToRecord(response.headers),
							bodyText,
							duration: durationFromMillis(Math.round(durationMs)),
							rawSize: BytesBrand(rawSize),
						};

						cleanup();
						resume(Effect.succeed(payload));
					})
					.catch((cause: unknown) => {
						const reason = controller.signal.reason;
						cleanup();

						// Use pattern matching for error handling
						const error = Match.value(cause).pipe(
							Match.when(
								(c: DOMException): c is DOMException =>
									c instanceof DOMException && c.name === "AbortError",
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
											}),
										),
									),
							),
							Match.orElse(() =>
								HttpClientError({
									message: "Failed to perform HTTP request",
									cause,
								}),
							),
						);

						resume(Effect.fail(error));
					});

				return Effect.sync(cleanup);
			});

		const sendWith: HttpClientDriver["sendWith"] = (request, mapper) =>
			Effect.map(send(request), mapper);

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
	Effect.gen(function* () {
		const client = yield* HttpClient;
		const response = yield* client.send(request);
		return yield* onSuccess(response);
	});
