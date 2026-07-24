import { Data, Effect } from "effect";
import { buildClientSchema, getIntrospectionQuery, type IntrospectionQuery } from "graphql";
import {
  getPosteeGraphqlSchemaSnapshot,
  touchPosteeGraphqlSchemaSnapshot,
  upsertPosteeGraphqlSchemaSnapshot,
} from "../database";
import type { DatabaseService, PosteeGraphqlSchemaSnapshot } from "../database";
import { prepareGraphqlDraft } from "./graphql";
import { HttpClient, prepareRequest } from "./http-client";
import type { EffectiveRequestHeader } from "./http-method-policy";
import type { RequestHeader } from "./schema";
import { RequestId } from "./types";

export interface GraphqlSchemaContext {
  readonly endpointUrl: string;
  readonly headers: ReadonlyArray<EffectiveRequestHeader>;
  readonly introspectionEnabled?: boolean;
}

export type GraphqlSchemaErrorCategory =
  | "Disabled"
  | "Fingerprint"
  | "Request"
  | "Transport"
  | "Response"
  | "Introspection"
  | "Storage";

export class GraphqlSchemaError extends Data.TaggedError("GraphqlSchemaError")<{
  readonly category: GraphqlSchemaErrorCategory;
  readonly message: string;
}> {}

const protocolHeaderNames = new Set(["accept", "content-type"]);

const normalizeEndpointUrl = (endpointUrl: string): string => new URL(endpointUrl.trim()).toString();

const canonicalizeHeaders = (headers: ReadonlyArray<EffectiveRequestHeader>): string =>
  headers
    .map((header) => ({ key: header.key.trim().toLowerCase(), value: header.value.trim() }))
    .sort((left, right) => left.key.localeCompare(right.key) || left.value.localeCompare(right.value))
    .map((header) => `${JSON.stringify(header.key)}:${JSON.stringify(header.value)}`)
    .join("\n");

const sha256Hex = async (value: string): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const canonicalizeJson = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeJson).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${
    Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalizeJson(record[key])}`).join(",")
  }}`;
};

const schemaError = (category: GraphqlSchemaErrorCategory, message: string) =>
  new GraphqlSchemaError({ category, message });

const fingerprintContext = async (context: GraphqlSchemaContext): Promise<string> =>
  sha256Hex(`${normalizeEndpointUrl(context.endpointUrl)}\n${canonicalizeHeaders(context.headers)}`);

export const fingerprintGraphqlSchemaContext = (context: GraphqlSchemaContext): Promise<string> =>
  fingerprintContext(context);

const cacheKey = (context: GraphqlSchemaContext) =>
  Effect.tryPromise({
    try: async () => ({
      endpointUrl: normalizeEndpointUrl(context.endpointUrl),
      contextFingerprint: await fingerprintContext(context),
    }),
    catch: () => schemaError("Fingerprint", "Unable to identify the GraphQL schema context."),
  });

export const loadGraphqlSchemaSnapshot = (
  context: GraphqlSchemaContext,
): Effect.Effect<PosteeGraphqlSchemaSnapshot | null, GraphqlSchemaError, DatabaseService> =>
  Effect.gen(function*() {
    const key = yield* cacheKey(context);
    const snapshot = yield* getPosteeGraphqlSchemaSnapshot(key.endpointUrl, key.contextFingerprint).pipe(
      Effect.mapError(() => schemaError("Storage", "Unable to load the cached GraphQL schema.")),
    );
    if (snapshot !== null) {
      yield* touchPosteeGraphqlSchemaSnapshot(snapshot.id, Date.now()).pipe(
        Effect.mapError(() => schemaError("Storage", "Unable to load the cached GraphQL schema.")),
      );
    }
    return snapshot;
  });

const introspectionHeaders = (context: GraphqlSchemaContext): ReadonlyArray<RequestHeader> => {
  const preparation = prepareGraphqlDraft({
    document: getIntrospectionQuery(),
    variablesJson: "",
    operationName: null,
  });
  return [
    ...context.headers.filter((header) => !protocolHeaderNames.has(header.key.trim().toLowerCase())),
    ...preparation.protocolHeaders,
  ].map((header, index) => ({
    id: index,
    request_id: "graphql-schema",
    key: header.key,
    value: header.value,
    is_enabled: 1,
    sort_order: index,
  }));
};

const prepareIntrospectionRequest = (
  context: GraphqlSchemaContext,
) => {
  const preparation = prepareGraphqlDraft({
    document: getIntrospectionQuery(),
    variablesJson: "",
    operationName: null,
  });
  if (preparation.issue !== null || preparation.body === null) {
    return Effect.fail(schemaError("Request", "Unable to prepare GraphQL schema introspection."));
  }

  return prepareRequest({
    id: RequestId(`graphql-schema-${globalThis.crypto.randomUUID()}`),
    method: "POST",
    url: normalizeEndpointUrl(context.endpointUrl),
    headers: introspectionHeaders(context),
    body: preparation.body,
    env: { variables: [] },
  }).pipe(Effect.mapError(() => schemaError("Request", "Unable to prepare GraphQL schema introspection.")));
};

const parseIntrospection = (bodyText: string): Effect.Effect<IntrospectionQuery, GraphqlSchemaError> =>
  Effect.try({
    try: () => JSON.parse(bodyText) as unknown,
    catch: () => schemaError("Response", "The GraphQL schema response was not valid JSON."),
  }).pipe(
    Effect.flatMap((payload) => {
      if (payload === null || typeof payload !== "object") {
        return Effect.fail(schemaError("Response", "The GraphQL schema response was not an object."));
      }
      const record = payload as { readonly data?: unknown; readonly errors?: unknown };
      if (Array.isArray(record.errors) && record.errors.length > 0) {
        return Effect.fail(schemaError("Response", "The GraphQL server rejected schema introspection."));
      }
      if (record.data === undefined) {
        return Effect.fail(schemaError("Response", "The GraphQL schema response did not include data."));
      }
      return Effect.try({
        try: () => {
          buildClientSchema(record.data as IntrospectionQuery);
          return record.data as IntrospectionQuery;
        },
        catch: () => schemaError("Introspection", "The GraphQL schema response was invalid."),
      });
    }),
  );

export const refreshGraphqlSchema = (
  context: GraphqlSchemaContext,
): Effect.Effect<PosteeGraphqlSchemaSnapshot, GraphqlSchemaError, DatabaseService | HttpClient> =>
  Effect.gen(function*() {
    if (context.introspectionEnabled === false) {
      return yield* Effect.fail(schemaError("Disabled", "GraphQL schema introspection is disabled."));
    }

    const key = yield* cacheKey(context);
    const request = yield* prepareIntrospectionRequest(context);
    const client = yield* HttpClient;
    const response = yield* client.send(request).pipe(
      Effect.mapError(() => schemaError("Transport", "Unable to refresh the GraphQL schema.")),
    );
    if (response.status < 200 || response.status >= 300) {
      return yield* Effect.fail(schemaError("Transport", "Unable to refresh the GraphQL schema."));
    }

    // A body that never decoded is not "invalid JSON" — saying so would send the
    // reader looking for a syntax error that isn't there (ADR-010).
    if (response.bodyDecodeError !== null) {
      return yield* Effect.fail(
        schemaError("Response", `The GraphQL schema response body could not be decoded: ${response.bodyDecodeError}`),
      );
    }

    const introspection = yield* parseIntrospection(response.bodyText);
    const snapshot: PosteeGraphqlSchemaSnapshot = {
      id: globalThis.crypto.randomUUID(),
      endpoint_url: key.endpointUrl,
      context_fingerprint: key.contextFingerprint,
      introspection_json: JSON.stringify(introspection),
      schema_digest: yield* Effect.tryPromise({
        try: () => sha256Hex(canonicalizeJson(introspection)),
        catch: () => schemaError("Fingerprint", "Unable to identify the GraphQL schema context."),
      }),
      fetched_at: Date.now(),
      last_used_at: Date.now(),
    };
    yield* upsertPosteeGraphqlSchemaSnapshot(snapshot).pipe(
      Effect.mapError(() => schemaError("Storage", "Unable to cache the GraphQL schema.")),
    );
    return snapshot;
  });
