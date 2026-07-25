/**
 * The redaction boundary for Postee agent context — ADR-012 Phase 1.
 *
 * Postee holds credentials; the C4 board does not. The board's worst-case
 * disclosure is a service name, Postee's is a bearer token, an API key, or
 * customer data in a response body. So these rules are properties of this layer
 * rather than instructions in a prompt: a prompt asking a model not to repeat a
 * secret is not a control, a function that never returns the secret is.
 *
 * Nothing here consults the model, and nothing downstream may re-add what this
 * removes. Ships before any agent tool exists, so the tools have nowhere to leak
 * from.
 */

import { Option } from "effect";
import type { PosteeEnvironmentVariable } from "../database.postee";
import type { RedactionMode } from "../settings.types";

const parseJson = Option.liftThrowable((text: string) => JSON.parse(text) as unknown);

export interface PosteeRedactionPolicy {
  readonly mode: RedactionMode;
  /** Header values are withheld unless a request explicitly opts in. */
  readonly includeHeaderValues: boolean;
  /** Bodies leave the process only with per-run consent — this is data egress. */
  readonly includeBodies: boolean;
}

export interface PosteeAgentRequestInput {
  readonly name: string;
  readonly method: string;
  readonly url: string;
  readonly headers: ReadonlyArray<{ readonly id: string; readonly key: string; readonly value: string; readonly enabled: boolean }>;
  readonly bodyMode: string;
  readonly body: string | null;
}

export interface PosteeAgentSavedRequestInput {
  readonly name: string;
  readonly method: string;
  readonly url: string;
  /**
   * The same header shape the active request uses, values included. The boundary's
   * job is not to be handed pre-cleaned input — it is to receive what callers
   * actually hold and emit only names.
   */
  readonly headers: ReadonlyArray<PosteeAgentRequestInput["headers"][number]>;
}

export interface PosteeAgentCollectionInput {
  readonly name: string;
  readonly requests: ReadonlyArray<PosteeAgentSavedRequestInput>;
}

export interface PosteeAgentGraphqlSchemaInput {
  readonly endpointUrl: string;
  readonly capturedAt: number;
  readonly introspectionJson: string;
}

export interface PosteeAgentContextInput {
  readonly request: PosteeAgentRequestInput;
  readonly collections?: ReadonlyArray<PosteeAgentCollectionInput>;
  readonly graphqlSchema?: PosteeAgentGraphqlSchemaInput;
  readonly environment?: {
    readonly name: string;
    readonly variables: ReadonlyArray<PosteeEnvironmentVariable>;
  };
  readonly lastResponse?: {
    readonly status: number;
    readonly durationMs: number;
    readonly sizeBytes: number;
    readonly body: string | null;
  };
}

export interface PosteeAgentContext {
  readonly request: {
    readonly name: string;
    readonly method: string;
    readonly url: string;
    readonly headers: ReadonlyArray<{ readonly key: string; readonly value: string | null }>;
    readonly bodyMode: string;
    readonly body: string | null;
  };
  readonly collections: ReadonlyArray<{
    readonly name: string;
    readonly requests: ReadonlyArray<{
      readonly name: string;
      readonly method: string;
      readonly url: string;
      /** Header names only — a saved request is never the one opted into. */
      readonly headerKeys: ReadonlyArray<string>;
    }>;
  }>;
  readonly graphqlSchema: PosteeGraphqlSchemaSummary | null;
  readonly environment: {
    readonly name: string;
    /** Keys only. An agent can reason about `{{API_TOKEN}}` without its value. */
    readonly variableKeys: ReadonlyArray<string>;
  } | null;
  readonly lastResponse: {
    readonly status: number;
    readonly durationMs: number;
    readonly sizeBytes: number;
    readonly body: string | null;
  } | null;
  /** What was withheld, so the omission is visible rather than silent. */
  readonly withheld: ReadonlyArray<string>;
}

/**
 * Removes credentials from a URL.
 *
 * `strict` drops the query entirely; `standard` keeps parameter names and drops
 * their values, which is enough to reason about an endpoint's shape. A URL that
 * will not parse is reduced to the part before `?` rather than passed through:
 * failing to parse must not mean failing open.
 */
const redactUrl = (url: string, mode: RedactionMode): string => {
  if (mode === "off" || url.trim() === "") return url;

  const [beforeQuery = ""] = url.split("?");
  let parsed: URL | null = null;
  try {
    parsed = new URL(url);
  } catch {
    parsed = null;
  }

  if (parsed === null) return beforeQuery;
  if (mode === "strict") return `${parsed.origin}${parsed.pathname}`;

  const names = Array.from(parsed.searchParams.keys());
  const query = names.map((name) => `${name}=`).join("&");
  return query.length > 0 ? `${parsed.origin}${parsed.pathname}?${query}` : `${parsed.origin}${parsed.pathname}`;
};

export interface PosteeGraphqlSchemaSummary {
  readonly endpointUrl: string;
  readonly capturedAt: number;
  readonly queryFields: ReadonlyArray<string>;
  readonly mutationFields: ReadonlyArray<string>;
  readonly typeNames: ReadonlyArray<string>;
}

interface IntrospectionType {
  readonly kind?: string;
  readonly name?: string;
  readonly fields?: ReadonlyArray<{ readonly name?: string }> | null;
}

/** GraphQL's own meta types — noise for authoring, and always present. */
const isMetaType = (name: string): boolean => name.startsWith("__");

const fieldNamesOf = (types: ReadonlyArray<IntrospectionType>, typeName: string | undefined) => {
  if (!typeName) return [];
  const match = types.find((type) => type.name === typeName);
  return (match?.fields ?? [])
    .map((field) => field.name)
    .filter((name): name is string => typeof name === "string")
    .sort();
};

/**
 * Reduces a cached introspection result to what authoring an operation needs.
 *
 * A full introspection payload is enormous and mostly machine plumbing; the root
 * field names and type names are the part a model can actually use. Returns `null`
 * rather than a partial summary when the payload cannot be understood, so callers
 * never present guesswork as schema.
 */
export const summariseGraphqlSchema = (
  introspectionJson: string,
): Omit<PosteeGraphqlSchemaSummary, "endpointUrl" | "capturedAt"> | null => {
  const parsed = Option.isSome(parseJson(introspectionJson)) ? JSON.parse(introspectionJson) : null;
  if (parsed === null || typeof parsed !== "object") return null;

  const root = (parsed as { data?: unknown }).data ?? parsed;
  const schema = (root as { __schema?: unknown }).__schema;
  if (!schema || typeof schema !== "object") return null;

  const typed = schema as {
    queryType?: { name?: string };
    mutationType?: { name?: string } | null;
    types?: ReadonlyArray<IntrospectionType>;
  };
  const types = typed.types ?? [];

  return {
    queryFields: fieldNamesOf(types, typed.queryType?.name),
    mutationFields: fieldNamesOf(types, typed.mutationType?.name ?? undefined),
    typeNames: types
      .map((type) => type.name)
      .filter((name): name is string => typeof name === "string" && !isMetaType(name))
      .sort(),
  };
};

export const buildPosteeAgentContext = (
  input: PosteeAgentContextInput,
  policy: PosteeRedactionPolicy,
): PosteeAgentContext => {
  const withheld: string[] = [];

  const headers = input.request.headers.map((header) => ({
    key: header.key,
    value: policy.includeHeaderValues ? header.value : null,
  }));
  if (!policy.includeHeaderValues && input.request.headers.length > 0) {
    withheld.push("header values");
  }

  const requestBody = policy.includeBodies ? input.request.body : null;
  if (!policy.includeBodies && (input.request.body ?? "") !== "") {
    withheld.push("request body");
  }

  const environment = input.environment
    ? {
      name: input.environment.name,
      // Values are never emitted, in any mode. There is no policy flag for this
      // on purpose: an environment value has no legitimate reason to reach a
      // model provider, and a flag would eventually be set.
      variableKeys: input.environment.variables.map((variable) => variable.key),
    }
    : null;
  if (environment !== null && environment.variableKeys.length > 0) {
    withheld.push("environment variable values");
  }

  const lastResponse = input.lastResponse
    ? {
      status: input.lastResponse.status,
      durationMs: input.lastResponse.durationMs,
      sizeBytes: input.lastResponse.sizeBytes,
      body: policy.includeBodies ? input.lastResponse.body : null,
    }
    : null;
  if (lastResponse !== null && !policy.includeBodies && (input.lastResponse?.body ?? "") !== "") {
    withheld.push("response body");
  }

  const collections = (input.collections ?? []).map((collection) => ({
    name: collection.name,
    requests: collection.requests.map((request) => ({
      name: request.name,
      method: request.method,
      // Saved requests are redacted regardless of `includeHeaderValues`: opting
      // into the request you are looking at must not opt into every other one.
      url: redactUrl(request.url, policy.mode),
      headerKeys: request.headers.map((header) => header.key),
    })),
  }));

  const schemaSummary = input.graphqlSchema
    ? summariseGraphqlSchema(input.graphqlSchema.introspectionJson)
    : null;
  const graphqlSchema = input.graphqlSchema && schemaSummary
    ? {
      endpointUrl: redactUrl(input.graphqlSchema.endpointUrl, policy.mode),
      capturedAt: input.graphqlSchema.capturedAt,
      ...schemaSummary,
    }
    : null;

  return {
    collections,
    graphqlSchema,
    request: {
      name: input.request.name,
      method: input.request.method,
      url: redactUrl(input.request.url, policy.mode),
      headers,
      bodyMode: input.request.bodyMode,
      body: requestBody,
    },
    environment,
    lastResponse,
    withheld,
  };
};
