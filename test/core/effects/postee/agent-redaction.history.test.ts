import {
  buildPosteeAgentContext,
  type PosteeAgentContextInput,
  type PosteeRedactionPolicy,
  redactErrorMessage,
} from "@/core/effects/postee/agent-redaction";
import { describe, expect, it } from "vitest";

/**
 * ADR-012 Phase 4. History is a leak surface the earlier phases did not have:
 * failures embed the URL that failed, and an HTTP client error message routinely
 * carries the whole request URI — query string included.
 *
 * "Failed to perform HTTP request: error sending request for url
 *  (https://api.example.test/v1?access_token=…)"
 *
 * That string is written by the client, stored in history, and would otherwise be
 * handed to a model verbatim.
 */

const SECRETS = {
  historyUrlToken: "history-url-token-3e91af",
  errorUrlToken: "error-url-token-c4d208",
  historyBody: "history-body-secret-70bb15",
} as const;

const input = (): PosteeAgentContextInput => ({
  request: { name: "Active", method: "GET", url: "https://api.example.test/x", headers: [], bodyMode: "json", body: null },
  history: [
    {
      id: "hist-1",
      requestName: "List accounts",
      method: "GET",
      url: `https://api.example.test/accounts?access_token=${SECRETS.historyUrlToken}`,
      status: 500,
      durationMs: 412,
      sizeBytes: 88,
      errorMessage: null,
      executedAt: 1_700_000_000_000,
      body: `{"leaked":"${SECRETS.historyBody}"}`,
    },
    {
      id: "hist-2",
      requestName: "Broken call",
      method: "POST",
      url: "https://api.example.test/broken",
      status: null,
      durationMs: null,
      sizeBytes: null,
      errorMessage:
        `Failed to perform HTTP request: error sending request for url (https://api.example.test/v1?key=${SECRETS.errorUrlToken})`,
      executedAt: 1_700_000_001_000,
      body: null,
    },
  ],
});

const policy = (over: Partial<PosteeRedactionPolicy> = {}): PosteeRedactionPolicy => ({
  mode: "strict",
  includeHeaderValues: false,
  includeBodies: false,
  ...over,
});

const assertNoSecrets = (context: unknown, allowed: ReadonlyArray<string> = []) => {
  const serialised = JSON.stringify(context);
  for (const [name, secret] of Object.entries(SECRETS)) {
    if (allowed.includes(secret)) continue;
    expect(serialised, `leaked ${name}`).not.toContain(secret);
  }
};

describe("history redaction", () => {
  it("leaks nothing from history under the default policy", () => {
    assertNoSecrets(buildPosteeAgentContext(input(), policy()));
  });

  it("redacts URLs on history entries", () => {
    const context = buildPosteeAgentContext(input(), policy());

    expect(context.history[0]?.url).toBe("https://api.example.test/accounts");
  });

  it("redacts URLs embedded in an error message", () => {
    const context = buildPosteeAgentContext(input(), policy());

    const message = context.history[1]?.errorMessage ?? "";
    // The diagnostic value is the failure, not the credential in the URI.
    expect(message).toContain("error sending request for url");
    expect(message).not.toContain(SECRETS.errorUrlToken);
  });

  it("keeps the outcome of each execution, which is the diagnostic value", () => {
    const context = buildPosteeAgentContext(input(), policy());

    expect(context.history[0]).toMatchObject({
      requestName: "List accounts",
      method: "GET",
      status: 500,
      durationMs: 412,
      sizeBytes: 88,
    });
  });

  it("withholds history bodies without consent", () => {
    const context = buildPosteeAgentContext(input(), policy());

    expect(context.history[0]?.body).toBeNull();
  });

  it("includes history bodies only with per-run consent", () => {
    const context = buildPosteeAgentContext(input(), policy({ includeBodies: true }));

    expect(context.history[0]?.body).toContain(SECRETS.historyBody);
    // Consent covers bodies; it never unlocks a URL credential.
    assertNoSecrets(context, [SECRETS.historyBody]);
  });

  it("has no history when none was supplied", () => {
    const context = buildPosteeAgentContext(
      { request: { name: "", method: "GET", url: "", headers: [], bodyMode: "json", body: null } },
      policy(),
    );

    expect(context.history).toEqual([]);
  });
});

describe("redactErrorMessage", () => {
  it("replaces a URL while keeping the surrounding diagnosis", () => {
    const message = redactErrorMessage(
      `connect ECONNREFUSED https://api.example.test/v1?key=${SECRETS.errorUrlToken} after 3 retries`,
      "strict",
    );

    expect(message).toContain("connect ECONNREFUSED");
    expect(message).toContain("after 3 retries");
    expect(message).not.toContain(SECRETS.errorUrlToken);
  });

  it("handles several URLs in one message", () => {
    const message = redactErrorMessage(
      `redirected https://a.example.test/x?t=${SECRETS.errorUrlToken} to https://b.example.test/y?t=${SECRETS.historyUrlToken}`,
      "strict",
    );

    expect(message).not.toContain(SECRETS.errorUrlToken);
    expect(message).not.toContain(SECRETS.historyUrlToken);
  });

  it("leaves a message with no URL alone", () => {
    expect(redactErrorMessage("timed out after 30s", "strict")).toBe("timed out after 30s");
  });

  it("passes messages through untouched when redaction is off", () => {
    const raw = `https://api.example.test/v1?key=${SECRETS.errorUrlToken}`;
    expect(redactErrorMessage(raw, "off")).toBe(raw);
  });

  it("tolerates an absent message", () => {
    expect(redactErrorMessage(null, "strict")).toBeNull();
  });
});
