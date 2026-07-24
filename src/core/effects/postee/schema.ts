import * as S from "effect/Schema";
import { HTTP_METHODS } from "./types";

const NonEmptyString = S.String.pipe(S.minLength(1));
const NullableString = S.optional(S.Union(S.String, S.Null));

// =============================================================================
// HTTP
// =============================================================================

export const HttpMethodSchema = S.Literal(...HTTP_METHODS);

export type HttpMethod = S.Schema.Type<typeof HttpMethodSchema>;

// =============================================================================
// Collections & Requests
// =============================================================================

export const CollectionSchema = S.Struct({
  id: NonEmptyString,
  name: NonEmptyString,
  description: NullableString,
  sort_order: S.Number,
  created_at: S.Number,
  updated_at: S.Number,
});

export type Collection = S.Schema.Type<typeof CollectionSchema>;

export const CollectionInsertSchema = S.Struct({
  id: NonEmptyString,
  name: NonEmptyString,
  description: NullableString,
  sort_order: S.optional(S.Number).pipe(
    S.withDefaults({ constructor: () => 0, decoding: () => 0 }),
  ),
});

export type CollectionInsert = S.Schema.Type<typeof CollectionInsertSchema>;

export const RequestSchema = S.Struct({
  id: NonEmptyString,
  collection_id: NonEmptyString,
  name: NonEmptyString,
  method: HttpMethodSchema,
  url: NonEmptyString,
  description: NullableString,
  favorite: S.Number,
  sort_order: S.Number,
  created_at: S.Number,
  updated_at: S.Number,
});

export type Request = S.Schema.Type<typeof RequestSchema>;

export const RequestInsertSchema = S.Struct({
  id: NonEmptyString,
  collection_id: NonEmptyString,
  name: NonEmptyString,
  method: HttpMethodSchema,
  url: NonEmptyString,
  description: NullableString,
  favorite: S.optional(S.Number).pipe(
    S.withDefaults({ constructor: () => 0, decoding: () => 0 }),
  ),
  sort_order: S.optional(S.Number).pipe(
    S.withDefaults({ constructor: () => 0, decoding: () => 0 }),
  ),
});

export type RequestInsert = S.Schema.Type<typeof RequestInsertSchema>;

export const RequestHeaderSchema = S.Struct({
  id: S.Number,
  request_id: NonEmptyString,
  key: NonEmptyString,
  value: NullableString,
  is_enabled: S.Number,
  sort_order: S.Number,
});

export type RequestHeader = S.Schema.Type<typeof RequestHeaderSchema>;

export const RequestHeaderUpsertSchema = S.Struct({
  request_id: NonEmptyString,
  key: NonEmptyString,
  value: NullableString,
  is_enabled: S.optional(S.Number).pipe(
    S.withDefaults({ constructor: () => 1, decoding: () => 1 }),
  ),
  sort_order: S.optional(S.Number).pipe(
    S.withDefaults({ constructor: () => 0, decoding: () => 0 }),
  ),
});

export type RequestHeaderUpsert = S.Schema.Type<typeof RequestHeaderUpsertSchema>;

export const RequestBodyModeSchema = S.Union(
  S.Literal("raw" as const),
  S.Literal("json" as const),
  S.Literal("form" as const),
);

export type RequestBodyMode = S.Schema.Type<typeof RequestBodyModeSchema>;

export const RequestBodySchema = S.Struct({
  request_id: NonEmptyString,
  mode: RequestBodyModeSchema,
  raw: NullableString,
  form_values: NullableString,
});

export type RequestBody = S.Schema.Type<typeof RequestBodySchema>;

export const RequestBodyUpsertSchema = S.Struct({
  request_id: NonEmptyString,
  mode: RequestBodyModeSchema,
  raw: NullableString,
  form_values: NullableString,
});

export type RequestBodyUpsert = S.Schema.Type<typeof RequestBodyUpsertSchema>;

// =============================================================================
// Environments
// =============================================================================

export const EnvironmentSchema = S.Struct({
  id: NonEmptyString,
  name: NonEmptyString,
  description: NullableString,
  is_default: S.Number,
  created_at: S.Number,
  updated_at: S.Number,
});

export type Environment = S.Schema.Type<typeof EnvironmentSchema>;

export const EnvironmentInsertSchema = S.Struct({
  id: NonEmptyString,
  name: NonEmptyString,
  description: NullableString,
  is_default: S.optional(S.Number).pipe(
    S.withDefaults({ constructor: () => 0, decoding: () => 0 }),
  ),
});

export type EnvironmentInsert = S.Schema.Type<typeof EnvironmentInsertSchema>;

export const EnvironmentVariableSchema = S.Struct({
  id: S.Number,
  environment_id: NonEmptyString,
  key: NonEmptyString,
  value: NullableString,
  is_secret: S.Number,
  is_enabled: S.Number,
  sort_order: S.Number,
  created_at: S.Number,
  updated_at: S.Number,
});

export type EnvironmentVariable = S.Schema.Type<typeof EnvironmentVariableSchema>;

export const EnvironmentVariableUpsertSchema = S.Struct({
  environment_id: NonEmptyString,
  key: NonEmptyString,
  value: NullableString,
  is_secret: S.optional(S.Number).pipe(
    S.withDefaults({ constructor: () => 0, decoding: () => 0 }),
  ),
  is_enabled: S.optional(S.Number).pipe(
    S.withDefaults({ constructor: () => 1, decoding: () => 1 }),
  ),
  sort_order: S.optional(S.Number).pipe(
    S.withDefaults({ constructor: () => 0, decoding: () => 0 }),
  ),
});

export type EnvironmentVariableUpsert = S.Schema.Type<typeof EnvironmentVariableUpsertSchema>;

// =============================================================================
// History
// =============================================================================

export const HistoryEntrySchema = S.Struct({
  id: NonEmptyString,
  request_id: S.optional(S.String),
  request_snapshot: S.String,
  response_status: S.optional(S.Number),
  response_time_ms: S.optional(S.Number),
  response_size_bytes: S.optional(S.Number),
  error_message: NullableString,
  executed_at: S.Number,
});

export type HistoryEntry = S.Schema.Type<typeof HistoryEntrySchema>;

export const HistoryInsertSchema = S.Struct({
  id: NonEmptyString,
  request_id: S.optional(S.String),
  request_snapshot: S.String,
  response_status: S.optional(S.Number),
  response_time_ms: S.optional(S.Number),
  response_size_bytes: S.optional(S.Number),
  error_message: NullableString,
  executed_at: S.Number,
});

export type HistoryInsert = S.Schema.Type<typeof HistoryInsertSchema>;

// =============================================================================
// Aggregated Views
// =============================================================================

export const RequestWithHeadersSchema = S.Struct({
  request: RequestSchema,
  headers: S.Array(RequestHeaderSchema),
  body: S.optional(RequestBodySchema),
});

export type RequestWithHeaders = S.Schema.Type<typeof RequestWithHeadersSchema>;

export const CollectionWithRequestsSchema = S.Struct({
  collection: CollectionSchema,
  requests: S.Array(RequestSchema),
});

export type CollectionWithRequests = S.Schema.Type<typeof CollectionWithRequestsSchema>;
