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

import type { PosteeEnvironmentVariable } from "../database.postee";
import type { RedactionMode } from "../settings.types";

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

export interface PosteeAgentContextInput {
  readonly request: PosteeAgentRequestInput;
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

  return {
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
