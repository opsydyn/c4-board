import type { PosteeRequestDraft } from "@/core/effects/postee";
import {
  newPosteeScratchDraft,
  type PosteeScratchDraft,
  scratchAsRequestDraft,
} from "@/core/effects/postee/scratch-draft";
import { resolveActiveRequestDraft } from "@/core/effects/postee/active-request-draft";
import { describe, expect, it } from "vitest";

/**
 * The load test panel renders only when a request draft is available. That draft
 * was derived from the saved request alone, so with a scratch selected — the
 * default since the scratch-first workspace landed — it was always null and the
 * panel could never appear.
 */

const scratch = (overrides: Partial<PosteeScratchDraft> = {}): PosteeScratchDraft => ({
  ...newPosteeScratchDraft({ id: "scratch-1", tabOrder: 0, now: 1 }),
  url: "https://api.example.test/health",
  ...overrides,
});

const savedRequest = { id: "req-1" } as never;
const savedDraft = { request: { id: "req-1", url: "https://saved.example.test" } } as unknown as PosteeRequestDraft;

describe("resolveActiveRequestDraft", () => {
  it("uses the saved request's draft when one is selected", () => {
    expect(resolveActiveRequestDraft(savedRequest, { "req-1": savedDraft }, scratch())).toBe(savedDraft);
  });

  it("falls back to the active scratch so load testing works without a saved request", () => {
    const active = scratch();

    const draft = resolveActiveRequestDraft(null, {}, active);

    expect(draft).not.toBeNull();
    expect(draft?.request.url).toBe("https://api.example.test/health");
    expect(draft?.request.id).toBe("scratch-1");
  });

  it("is null when nothing is selected at all", () => {
    expect(resolveActiveRequestDraft(null, {}, null)).toBeNull();
  });

  it("is null when a saved request is selected but its draft has not loaded", () => {
    expect(resolveActiveRequestDraft(savedRequest, {}, null)).toBeNull();
  });
});

describe("scratchAsRequestDraft", () => {
  it("carries the scratch id onto the body and graphql rows", () => {
    const draft = scratchAsRequestDraft(scratch({
      graphql: { document: "query { me }", variables_json: "{}", operation_name: null },
    }));

    expect(draft.body.request_id).toBe("scratch-1");
    expect(draft.graphql?.request_id).toBe("scratch-1");
  });

  it("leaves graphql null when the scratch has none", () => {
    expect(scratchAsRequestDraft(scratch()).graphql).toBeNull();
  });
});
