import { type PosteeRequestProposal, proposalToScratchDraft } from "@/core/effects/postee/agent-proposal";
import { isPristinePosteeScratchDraft } from "@/core/effects/postee/scratch-draft";
import { describe, expect, it } from "vitest";

/**
 * ADR-012 Phase 3. A proposal is never applied — it becomes a scratch draft the
 * operator can read, edit, run, or discard. That is the whole approval boundary:
 * the scratch-first workspace already provides it, so nothing new gates the agent.
 */

const proposal = (over: Partial<PosteeRequestProposal> = {}): PosteeRequestProposal => ({
  summary: "Fetch systems",
  rationale: "Grounded in the cached schema",
  warnings: [],
  name: "Fetch systems",
  method: "POST",
  url: "https://api.example.test/graphql",
  headers: [{ key: "Authorization", value: "Bearer {{API_TOKEN}}" }],
  bodyMode: "graphql",
  body: null,
  graphqlDocument: "query Systems { systems { id } }",
  graphqlVariablesJson: "{}",
  graphqlOperationName: "Systems",
  ...over,
});

describe("proposalToScratchDraft", () => {
  it("produces a draft carrying the proposed request", () => {
    const draft = proposalToScratchDraft(proposal(), { id: "scratch-1", tabOrder: 0, now: 1_000 });

    expect(draft.id).toBe("scratch-1");
    expect(draft.name).toBe("Fetch systems");
    expect(draft.method).toBe("POST");
    expect(draft.url).toBe("https://api.example.test/graphql");
    expect(draft.body.mode).toBe("graphql");
    expect(draft.graphql?.document).toBe("query Systems { systems { id } }");
    expect(draft.graphql?.operation_name).toBe("Systems");
  });

  it("opens the draft so the operator sees what was proposed", () => {
    const draft = proposalToScratchDraft(proposal(), { id: "scratch-1", tabOrder: 2, now: 1_000 });

    expect(draft.isOpen).toBe(true);
    expect(draft.tabOrder).toBe(2);
  });

  it("is never mistaken for an untouched draft", () => {
    const draft = proposalToScratchDraft(proposal(), { id: "scratch-1", tabOrder: 0, now: 1_000 });

    // Otherwise the sprawl reclaimer would delete a proposal on the next launch.
    expect(isPristinePosteeScratchDraft(draft)).toBe(false);
  });

  it("carries proposed headers as enabled draft headers", () => {
    const draft = proposalToScratchDraft(proposal(), { id: "scratch-1", tabOrder: 0, now: 1_000 });

    expect(draft.headers).toHaveLength(1);
    expect(draft.headers[0]).toMatchObject({
      key: "Authorization",
      value: "Bearer {{API_TOKEN}}",
      enabled: true,
    });
  });

  it("keeps a non-GraphQL body and leaves graphql empty", () => {
    const draft = proposalToScratchDraft(
      proposal({
        bodyMode: "json",
        body: "{\"a\":1}",
        graphqlDocument: null,
        graphqlVariablesJson: null,
        graphqlOperationName: null,
      }),
      { id: "scratch-2", tabOrder: 0, now: 1_000 },
    );

    expect(draft.body.mode).toBe("json");
    expect(draft.body.raw).toBe("{\"a\":1}");
    expect(draft.graphql).toBeNull();
  });

  it("does not attach a collection, so nothing is saved by accepting a proposal", () => {
    const draft = proposalToScratchDraft(proposal(), { id: "scratch-1", tabOrder: 0, now: 1_000 });

    // A scratch has no collection until the operator promotes it.
    expect(draft).not.toHaveProperty("collection_id");
    expect(draft.environmentId).toBeNull();
  });

  it("survives a proposal with no headers or body", () => {
    const draft = proposalToScratchDraft(
      proposal({
        method: "GET",
        bodyMode: "json",
        headers: [],
        body: null,
        graphqlDocument: null,
        graphqlVariablesJson: null,
        graphqlOperationName: null,
      }),
      { id: "scratch-3", tabOrder: 0, now: 1_000 },
    );

    expect(draft.headers).toEqual([]);
    expect(draft.body.raw).toBeNull();
    expect(draft.graphql).toBeNull();
  });
});
