import type { PosteeEnvironmentVariable } from "@/core/effects/database.postee";
import {
  buildPosteeAgentContext,
  type PosteeAgentContextInput,
  type PosteeRedactionPolicy,
} from "@/core/effects/postee/agent-redaction";
import { describe, expect, it } from "vitest";

/**
 * ADR-012 Phase 1. Postee holds credentials; the board does not. These are written
 * adversarially — a distinct secret is planted in every field that could carry one,
 * and the assertion is that none of them appear anywhere in the assembled context.
 *
 * Asserting the happy path looks right would not catch a leak: a leak is something
 * appearing that nobody asserted about.
 */

const SECRETS = {
  bearer: "sk-live-BEARER-b3a7f1",
  apiKeyHeader: "AKIA-HEADER-9f21cc",
  envValue: "env-secret-VALUE-77d0aa",
  urlToken: "url-token-QUERY-51ce9b",
  bodySecret: "body-secret-PAYLOAD-2ad914",
  responseSecret: "response-secret-BODY-8bc023",
} as const;

const envVar = (over: Partial<PosteeEnvironmentVariable>): PosteeEnvironmentVariable => ({
  id: 1,
  environment_id: "env-1",
  key: "API_TOKEN",
  value: SECRETS.envValue,
  is_secret: 1,
  is_enabled: 1,
  sort_order: 0,
  created_at: 0,
  updated_at: 0,
  ...over,
} as PosteeEnvironmentVariable);

const input = (): PosteeAgentContextInput => ({
  request: {
    name: "Fetch account",
    method: "POST",
    url: `https://api.example.test/accounts?access_token=${SECRETS.urlToken}&page=2`,
    headers: [
      { id: "h1", key: "Authorization", value: `Bearer ${SECRETS.bearer}`, enabled: true },
      { id: "h2", key: "X-Api-Key", value: SECRETS.apiKeyHeader, enabled: true },
      { id: "h3", key: "Accept", value: "application/json", enabled: true },
    ],
    bodyMode: "json",
    body: `{"password":"${SECRETS.bodySecret}"}`,
  },
  environment: {
    name: "Production",
    variables: [
      envVar({}),
      envVar({ id: 2, key: "PUBLIC_BASE_URL", value: "https://api.example.test", is_secret: 0 }),
    ],
  },
  lastResponse: {
    status: 200,
    durationMs: 120,
    sizeBytes: 512,
    body: `{"token":"${SECRETS.responseSecret}"}`,
  },
});

const policy = (over: Partial<PosteeRedactionPolicy> = {}): PosteeRedactionPolicy => ({
  mode: "strict",
  includeHeaderValues: false,
  includeBodies: false,
  ...over,
});

/** Every planted secret, checked against the whole serialised context. */
const assertNoSecrets = (context: unknown, allowed: ReadonlyArray<string> = []) => {
  const serialised = JSON.stringify(context);
  for (const [name, secret] of Object.entries(SECRETS)) {
    if (allowed.includes(secret)) continue;
    expect(serialised, `leaked ${name}`).not.toContain(secret);
  }
};

describe("Postee agent context redaction", () => {
  it("leaks nothing under the default policy", () => {
    assertNoSecrets(buildPosteeAgentContext(input(), policy()));
  });

  it("never emits environment variable values, in any mode", () => {
    for (const mode of ["off", "standard", "strict"] as const) {
      const context = buildPosteeAgentContext(input(), policy({ mode }));
      expect(JSON.stringify(context), `mode ${mode}`).not.toContain(SECRETS.envValue);
    }
  });

  it("still names the environment variables it withheld", () => {
    const context = buildPosteeAgentContext(input(), policy());

    // Keys are the useful part: an agent can reason about {{API_TOKEN}} without
    // ever seeing what it stands for.
    expect(context.environment?.variableKeys).toContain("API_TOKEN");
    expect(context.environment?.variableKeys).toContain("PUBLIC_BASE_URL");
  });

  it("withholds header values by default but keeps the header names", () => {
    const context = buildPosteeAgentContext(input(), policy());

    const authorization = context.request.headers.find((header) => header.key === "Authorization");
    expect(authorization).toBeDefined();
    expect(authorization?.value).toBeNull();
    assertNoSecrets(context);
  });

  it("includes header values only on explicit opt-in", () => {
    const context = buildPosteeAgentContext(input(), policy({ includeHeaderValues: true }));

    const authorization = context.request.headers.find((header) => header.key === "Authorization");
    expect(authorization?.value).toContain(SECRETS.bearer);
  });

  it("strips the query string under strict, where tokens routinely hide", () => {
    const context = buildPosteeAgentContext(input(), policy({ mode: "strict" }));

    expect(context.request.url).toBe("https://api.example.test/accounts");
    expect(context.request.url).not.toContain(SECRETS.urlToken);
  });

  it("keeps query parameter names but not their values under standard", () => {
    const context = buildPosteeAgentContext(input(), policy({ mode: "standard" }));

    expect(context.request.url).toContain("access_token");
    expect(context.request.url).not.toContain(SECRETS.urlToken);
  });

  it("excludes request and response bodies without consent", () => {
    const context = buildPosteeAgentContext(input(), policy());

    expect(context.request.body).toBeNull();
    expect(context.lastResponse?.body).toBeNull();
    // The shape of the response is still useful without its contents.
    expect(context.lastResponse?.status).toBe(200);
    expect(context.lastResponse?.sizeBytes).toBe(512);
  });

  it("includes bodies only with per-run consent", () => {
    const context = buildPosteeAgentContext(input(), policy({ includeBodies: true }));

    expect(context.request.body).toContain(SECRETS.bodySecret);
    expect(context.lastResponse?.body).toContain(SECRETS.responseSecret);
  });

  it("reports what it withheld, so the omission is visible rather than silent", () => {
    const context = buildPosteeAgentContext(input(), policy());

    expect(context.withheld).toContain("header values");
    expect(context.withheld).toContain("request body");
    expect(context.withheld).toContain("environment variable values");
  });

  it("survives a request with nothing in it", () => {
    const context = buildPosteeAgentContext(
      { request: { name: "", method: "GET", url: "", headers: [], bodyMode: "json", body: null } },
      policy(),
    );

    expect(context.request.url).toBe("");
    expect(context.environment).toBeNull();
    expect(context.lastResponse).toBeNull();
  });

  it("does not treat a malformed URL as an excuse to pass it through", () => {
    const context = buildPosteeAgentContext(
      {
        request: {
          name: "broken",
          method: "GET",
          url: `not-a-url?access_token=${SECRETS.urlToken}`,
          headers: [],
          bodyMode: "json",
          body: null,
        },
      },
      policy({ mode: "strict" }),
    );

    // Failing to parse must not mean failing open.
    expect(context.request.url).not.toContain(SECRETS.urlToken);
  });
});
