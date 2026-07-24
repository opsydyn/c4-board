import {
  isPristinePosteeScratchDraft,
  newPosteeScratchDraft,
  type PosteeScratchDraft,
} from "@/core/effects/postee/scratch-draft";
import { describe, expect, it } from "vitest";

/**
 * Postee opens a scratch on every launch and persists it immediately, so an
 * untouched draft is indistinguishable from one the user meant to keep. That is
 * what fills "Reopen drafts" with identical `Untitled request` entries. A draft is
 * pristine when it still matches exactly what a fresh one looks like — identity,
 * ordering, and timestamps aside.
 */

const fresh = (): PosteeScratchDraft => newPosteeScratchDraft({ id: "scratch-1", tabOrder: 0, now: 1_000 });

describe("isPristinePosteeScratchDraft", () => {
  it("treats a newly created draft as pristine", () => {
    expect(isPristinePosteeScratchDraft(fresh())).toBe(true);
  });

  it("ignores identity, tab position, open state, and timestamps", () => {
    const moved: PosteeScratchDraft = {
      ...fresh(),
      id: "scratch-9",
      tabOrder: 7,
      isOpen: false,
      createdAt: 1,
      updatedAt: 9_999,
    };

    expect(isPristinePosteeScratchDraft(moved)).toBe(true);
  });

  it.each([
    ["a URL", { url: "https://api.example.test" }],
    ["a method", { method: "POST" as const }],
    ["a name", { name: "Health check" }],
    ["a description", { description: "checks health" }],
    ["a header", { headers: [{ id: "h1", key: "Accept", value: "application/json", enabled: true }] }],
    ["a body", { body: { mode: "json" as const, raw: "{\"a\":1}", form_values: null } }],
    ["a body mode", { body: { mode: "raw" as const, raw: "{}", form_values: null } }],
    ["an environment", { environmentId: "env-1" }],
    ["a GraphQL document", {
      graphql: { document: "query { me }", variables_json: "{}", operation_name: null },
    }],
  ])("is not pristine once it has %s", (_label, overrides) => {
    expect(isPristinePosteeScratchDraft({ ...fresh(), ...overrides })).toBe(false);
  });

  it("tolerates an empty body written as null rather than {}", () => {
    const emptied: PosteeScratchDraft = {
      ...fresh(),
      body: { mode: "json", raw: null, form_values: null },
    };

    expect(isPristinePosteeScratchDraft(emptied)).toBe(true);
  });
});
