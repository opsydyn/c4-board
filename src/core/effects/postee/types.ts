/**
 * Postee Domain Types with Effect Branded Types
 *
 * Using branded types provides compile-time guarantees that we don't mix up
 * different kinds of IDs, URLs, or other domain values.
 *
 * @see https://effect.website/docs/code-style/branded-types/
 */

import { Brand, Data, Schema, DateTime, Duration } from "effect";

// =============================================================================
// ID Types (Branded)
// =============================================================================

/**
 * Request ID - uniquely identifies a saved HTTP request
 */
export type RequestId = string & Brand.Brand<"RequestId">;
export const RequestId = Brand.nominal<RequestId>();

/**
 * Collection ID - uniquely identifies a collection of requests
 */
export type CollectionId = string & Brand.Brand<"CollectionId">;
export const CollectionId = Brand.nominal<CollectionId>();

/**
 * Environment ID - uniquely identifies an environment with variables
 */
export type EnvironmentId = string & Brand.Brand<"EnvironmentId">;
export const EnvironmentId = Brand.nominal<EnvironmentId>();

/**
 * History Entry ID - uniquely identifies a request execution record
 */
export type HistoryEntryId = string & Brand.Brand<"HistoryEntryId">;
export const HistoryEntryId = Brand.nominal<HistoryEntryId>();

/**
 * Variable ID - uniquely identifies an environment variable
 */
export type VariableId = string & Brand.Brand<"VariableId">;
export const VariableId = Brand.nominal<VariableId>();

/**
 * Header ID - uniquely identifies a request header
 */
export type HeaderId = string & Brand.Brand<"HeaderId">;
export const HeaderId = Brand.nominal<HeaderId>();

/**
 * Span ID - uniquely identifies a request span (timing trace)
 */
export type SpanId = string & Brand.Brand<"SpanId">;
export const SpanId = Brand.nominal<SpanId>();

/**
 * Request UID - stable identifier for a request template (not execution)
 */
export type RequestUid = string & Brand.Brand<"RequestUid">;
export const RequestUid = Brand.nominal<RequestUid>();

/**
 * Endpoint UID - stable identifier for an API endpoint
 */
export type EndpointUid = string & Brand.Brand<"EndpointUid">;
export const EndpointUid = Brand.nominal<EndpointUid>();

/**
 * Service UID - stable identifier for a service
 */
export type ServiceUid = string & Brand.Brand<"ServiceUid">;
export const ServiceUid = Brand.nominal<ServiceUid>();

/**
 * Plan Hash - hash of execution plan for caching/comparison
 */
export type PlanHash = string & Brand.Brand<"PlanHash">;
export const PlanHash = Brand.nominal<PlanHash>();

// =============================================================================
// HTTP Method (Schema-based validation)
// =============================================================================

/**
 * Valid HTTP methods
 * Using Schema.Literal ensures only these values are accepted
 */
export const HttpMethodSchema = Schema.Literal(
	"GET",
	"POST",
	"PUT",
	"PATCH",
	"DELETE",
	"HEAD",
	"OPTIONS",
	"TRACE",
);
export type HttpMethod = Schema.Schema.Type<typeof HttpMethodSchema>;

/**
 * Check if a string is a valid HTTP method
 */
export const isHttpMethod = (s: string): s is HttpMethod =>
	Schema.is(HttpMethodSchema)(s);

// =============================================================================
// URL Type (Branded with validation)
// =============================================================================

/**
 * HTTP URL - branded string that represents a valid URL or relative path
 *
 * Note: We allow relative URLs for template variables like {{baseUrl}}/api/users
 */
export type HttpUrl = string & Brand.Brand<"HttpUrl">;

/**
 * Create a branded HttpUrl from a string
 * Validates that it's a valid URL format or relative path
 */
export const HttpUrl = Brand.refined<HttpUrl>(
	(s): s is string & Brand.Brand<"HttpUrl"> => {
		// Allow template variables
		if (s.includes("{{") && s.includes("}}")) {
			return true;
		}

		// Allow relative URLs
		if (s.startsWith("/")) {
			return true;
		}

		// Validate absolute URLs
		try {
			new URL(s);
			return true;
		} catch {
			return false;
		}
	},
	(s) => Brand.error(`Invalid HTTP URL: ${s}`),
);

/**
 * Create an HttpUrl without validation (use with caution)
 */
export const unsafeHttpUrl = (s: string): HttpUrl => s as HttpUrl;

// =============================================================================
// Request Body (Sum Type / Tagged Union)
// =============================================================================

/**
 * Request body types using Effect's Data.TaggedEnum
 *
 * This provides exhaustiveness checking and pattern matching support
 */
export type RequestBody = Data.TaggedEnum<{
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	None: {};
	Raw: { readonly content: string };
	Json: { readonly content: string };
	Form: { readonly entries: ReadonlyArray<readonly [string, string]> };
}>;

export const RequestBody = Data.taggedEnum<RequestBody>();

/**
 * Prepared request body - the result after template resolution
 */
export type PreparedBody = Data.TaggedEnum<{
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	None: {};
	Raw: { readonly content: string };
	Json: { readonly content: string };
	Form: { readonly entries: ReadonlyArray<readonly [string, string]> };
}>;

export const PreparedBody = Data.taggedEnum<PreparedBody>();

// =============================================================================
// Request Body Mode (for database schema compatibility)
// =============================================================================

/**
 * Legacy body mode type for database schema
 * Can be converted to/from RequestBody sum type
 */
export const RequestBodyModeSchema = Schema.Literal("raw", "json", "form");
export type RequestBodyMode = Schema.Schema.Type<typeof RequestBodyModeSchema>;

/**
 * Convert RequestBodyMode to RequestBody sum type
 */
export const bodyModeToSumType = (
	mode: RequestBodyMode,
	rawBody: string | null,
	formBody: string | null,
): RequestBody => {
	switch (mode) {
		case "raw":
			return RequestBody.Raw({ content: rawBody ?? "" });
		case "json":
			return RequestBody.Json({ content: rawBody ?? "" });
		case "form": {
			if (!formBody) {
				return RequestBody.Form({ entries: [] });
			}
			try {
				const parsed = JSON.parse(formBody) as Array<{
					key: string;
					value: string;
					enabled?: boolean;
				}>;
				const entries = parsed
					.filter((e) => e.enabled !== false)
					.map((e) => [e.key, e.value] as const);
				return RequestBody.Form({ entries });
			} catch {
				return RequestBody.Form({ entries: [] });
			}
		}
	}
};

/**
 * Convert RequestBody sum type to RequestBodyMode
 */
export const bodyModeFromSumType = (body: RequestBody): RequestBodyMode => {
	switch (body._tag) {
		case "None":
			return "raw";
		case "Raw":
			return "raw";
		case "Json":
			return "json";
		case "Form":
			return "form";
	}
};

// =============================================================================
// Header Name (Common HTTP headers with validation)
// =============================================================================

/**
 * Common HTTP header names
 */
export const CommonHeaderSchema = Schema.Literal(
	"Accept",
	"Accept-Encoding",
	"Accept-Language",
	"Authorization",
	"Cache-Control",
	"Content-Type",
	"Cookie",
	"User-Agent",
);
export type CommonHeader = Schema.Schema.Type<typeof CommonHeaderSchema>;

/**
 * Any valid header name (branded string)
 */
export type HeaderName = string & Brand.Brand<"HeaderName">;

export const HeaderName = Brand.refined<HeaderName>(
	(s): s is string & Brand.Brand<"HeaderName"> => {
		// RFC 7230: field-name = token
		// token = 1*tchar
		// tchar = "!" / "#" / "$" / "%" / "&" / "'" / "*" / "+" / "-" / "." /
		//         "0"-"9" / "A"-"Z" / "^" / "_" / "`" / "a"-"z" / "|" / "~"
		return /^[!#$%&'*+\-.0-9A-Z^_`a-z|~]+$/.test(s);
	},
	(s) => Brand.error(`Invalid HTTP header name: ${s}`),
);

// =============================================================================
// Status Code (Branded number with validation)
// =============================================================================

/**
 * HTTP status code - branded number between 100-599
 */
export type StatusCode = number & Brand.Brand<"StatusCode">;

export const StatusCode = Brand.refined<StatusCode>(
	(n): n is number & Brand.Brand<"StatusCode"> => {
		return Number.isInteger(n) && n >= 100 && n < 600;
	},
	(n) => Brand.error(`Invalid HTTP status code: ${n}`),
);

/**
 * Check if status code represents success (2xx)
 */
export const isSuccessStatus = (code: StatusCode): boolean => {
	const n = code as number;
	return n >= 200 && n < 300;
};

/**
 * Check if status code represents client error (4xx)
 */
export const isClientError = (code: StatusCode): boolean => {
	const n = code as number;
	return n >= 400 && n < 500;
};

/**
 * Check if status code represents server error (5xx)
 */
export const isServerError = (code: StatusCode): boolean => {
	const n = code as number;
	return n >= 500 && n < 600;
};

// =============================================================================
// DateTime & Duration (Effect built-in types)
// =============================================================================

/**
 * UTC DateTime - timezone-agnostic timestamp
 * Use for absolute points in time (request execution, history records)
 */
export type UtcDateTime = DateTime.Utc;

/**
 * Zoned DateTime - timezone-aware timestamp
 * Use when displaying to users or working with local time
 */
export type ZonedDateTime = DateTime.Zoned;

/**
 * Duration - semantic time spans
 * Better than raw milliseconds - supports formatting, arithmetic
 */
export type TimeDuration = Duration.Duration;

/**
 * Get current UTC time (testable via Clock service)
 */
export const now = DateTime.now;

/**
 * Create DateTime from epoch milliseconds
 */
export const fromEpochMillis = (millis: number): UtcDateTime =>
	DateTime.unsafeMake(millis);

/**
 * Convert DateTime to epoch milliseconds (for database storage)
 */
export const toEpochMillis = (dt: UtcDateTime): number =>
	DateTime.toEpochMillis(dt);

/**
 * Create Duration from milliseconds
 */
export const durationFromMillis = (millis: number): TimeDuration =>
	Duration.millis(millis);

/**
 * Convert Duration to milliseconds
 */
export const durationToMillis = (duration: TimeDuration): number =>
	Duration.toMillis(duration);

/**
 * Create Duration from seconds
 */
export const fromSeconds = (seconds: number): TimeDuration =>
	Duration.seconds(seconds);

/**
 * Create Duration from minutes
 */
export const fromMinutes = (minutes: number): TimeDuration =>
	Duration.minutes(minutes);

/**
 * Calculate duration between two DateTimes
 */
export const diffDateTime = (
	start: UtcDateTime,
	end: UtcDateTime,
): TimeDuration => durationFromMillis(DateTime.distance(start, end));

/**
 * Add duration to DateTime
 */
export const addDuration = (
	dt: UtcDateTime,
	duration: TimeDuration,
): UtcDateTime => DateTime.add(dt, { millis: durationToMillis(duration) });

/**
 * Subtract duration from DateTime
 */
export const subtractDuration = (
	dt: UtcDateTime,
	duration: TimeDuration,
): UtcDateTime => DateTime.subtract(dt, { millis: durationToMillis(duration) });

// =============================================================================
// Bytes (Branded number for data sizes)
// =============================================================================

/**
 * Bytes - branded number for data sizes
 */
export type Bytes = number & Brand.Brand<"Bytes">;

export const Bytes = Brand.refined<Bytes>(
	(n): n is number & Brand.Brand<"Bytes"> => {
		return Number.isInteger(n) && n >= 0;
	},
	(n) => Brand.error(`Invalid bytes value: ${n}`),
);

/**
 * Create Bytes from kilobytes
 */
export const fromKilobytes = (kb: number): Bytes => Bytes(kb * 1024);

/**
 * Create Bytes from megabytes
 */
export const fromMegabytes = (mb: number): Bytes => Bytes(mb * 1024 * 1024);

// =============================================================================
// Legacy Compatibility (for database)
// =============================================================================

/**
 * Unix timestamp in milliseconds (for database storage)
 * @deprecated Use UtcDateTime instead. This is kept for database compatibility.
 */
export type Timestamp = number & Brand.Brand<"Timestamp">;

export const Timestamp = Brand.refined<Timestamp>(
	(n): n is number & Brand.Brand<"Timestamp"> => {
		return Number.isInteger(n) && n >= 0;
	},
	(n) => Brand.error(`Invalid timestamp: ${n}`),
);

/**
 * Convert DateTime to Timestamp (for database)
 */
export const dateTimeToTimestamp = (dt: UtcDateTime): Timestamp =>
	Timestamp(DateTime.toEpochMillis(dt));

/**
 * Convert Timestamp to DateTime (from database)
 */
export const timestampToDateTime = (ts: Timestamp): UtcDateTime =>
	DateTime.unsafeMake(ts as unknown as number);

// =============================================================================
// Exports
// =============================================================================

/**
 * Re-export all branded constructors for convenience
 */
export const BrandedTypes = {
	RequestId,
	CollectionId,
	EnvironmentId,
	HistoryEntryId,
	VariableId,
	HeaderId,
	SpanId,
	RequestUid,
	EndpointUid,
	ServiceUid,
	PlanHash,
	HttpUrl,
	HeaderName,
	StatusCode,
	Bytes,
	Timestamp, // Legacy - use DateTime instead
} as const;

// =============================================================================
// Request Span (Timing Trace)
// =============================================================================

/**
 * Timing phase within a request span
 */
export interface TimingPhase {
	readonly start_ms: number | null;
	readonly end_ms: number | null;
	readonly duration_ms: number | null;
}

/**
 * Request Span - detailed timing breakdown for HTTP request execution
 * Captures DNS, connect, TLS, request write, TTFB, and body read timings
 */
export interface RequestSpan {
	readonly id: SpanId;
	readonly history_id: HistoryEntryId;
	readonly request_uid: RequestUid;
	readonly endpoint_uid: EndpointUid | null;
	readonly service_uid: ServiceUid | null;
	readonly plan_hash: PlanHash | null;

	// Timing phases
	readonly dns: TimingPhase;
	readonly connect: TimingPhase;
	readonly tls: TimingPhase;
	readonly request_write: TimingPhase;
	readonly ttfb_ms: number | null; // Time To First Byte from request_start
	readonly body_read: TimingPhase;

	readonly total_duration_ms: number;
	readonly created_at: number;
}
