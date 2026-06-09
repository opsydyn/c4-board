import { buildRigMutationPlanDiff } from "@/core/effects/agent-plan-diff";
import type { RigC4BoardSummary, RigC4DiagramProposal } from "@/core/effects/ai-agent.runtime";
import { buildGroundedProposalDiff } from "@/core/effects/opy-c4-proposals";
import { describe, expect, it } from "vitest";

const createBoardSummary = (overrides?: Partial<RigC4BoardSummary>): RigC4BoardSummary => ({
  diagramId: "diagram-1",
  diagramName: "Payments Context",
  nodeCount: 2,
  edgeCount: 1,
  nodes: [
    {
      id: "person-customer",
      label: "Customer",
      nodeType: "person",
      description: null,
      technology: null,
      teamOwnership: null,
    },
    {
      id: "system-payments",
      label: "Payments API",
      nodeType: "system",
      description: null,
      technology: null,
      teamOwnership: null,
    },
  ],
  edges: [
    {
      id: "edge-customer-payments",
      sourceId: "person-customer",
      targetId: "system-payments",
      sourceLabel: "Customer",
      targetLabel: "Payments API",
      label: "uses",
    },
  ],
  ...overrides,
});

const createProposal = (overrides?: Partial<RigC4DiagramProposal>): RigC4DiagramProposal => ({
  summary: "Customer uses Payments API and Ledger Service records charges.",
  rationale: "Reuse current actors and add one new downstream dependency.",
  warnings: [],
  nodes: [
    {
      key: "customer",
      nodeType: "person",
      label: "Customer",
      description: null,
    },
    {
      key: "payments-api",
      nodeType: "system",
      label: "Payments API",
      description: null,
    },
    {
      key: "ledger-service",
      nodeType: "system",
      label: "Ledger Service",
      description: "Records financial events",
    },
  ],
  edges: [
    {
      sourceKey: "customer",
      targetKey: "payments-api",
      label: "uses",
    },
    {
      sourceKey: "payments-api",
      targetKey: "ledger-service",
      label: "records",
    },
  ],
  provider: "openai",
  model: "gpt-5",
  respondedAtMs: 1,
  ...overrides,
});

describe("agent-plan-diff", () => {
  it("builds a typed mutation plan for safe proposal diffs", () => {
    const groundedDiff = buildGroundedProposalDiff(createProposal(), createBoardSummary());
    const rendered = buildRigMutationPlanDiff(createProposal(), groundedDiff);

    expect(rendered).not.toBeNull();
    expect(rendered?.canApprove).toBe(true);
    expect(rendered?.plan.totalActions).toBe(2);
    expect(rendered?.plan.totalNodesCreated).toBe(1);
    expect(rendered?.plan.totalEdgesCreated).toBe(1);
    expect(rendered?.plan.highestRisk).toBe("high");
    expect(rendered?.impactedEntities.filter((entity) => entity.status === "create")).toHaveLength(2);
  });

  it("surfaces ambiguous blockers and prevents approval", () => {
    const proposal = createProposal({
      edges: [
        {
          sourceKey: "customer",
          targetKey: "payments-api",
          label: "submits orders to",
        },
      ],
    });
    const groundedDiff = buildGroundedProposalDiff(proposal, createBoardSummary());
    const rendered = buildRigMutationPlanDiff(proposal, groundedDiff);

    expect(rendered).not.toBeNull();
    expect(rendered?.canApprove).toBe(false);
    expect(rendered?.issues).toHaveLength(1);
    expect(rendered?.issues[0]?.kind).toBe("ambiguous-edge");
  });
});
