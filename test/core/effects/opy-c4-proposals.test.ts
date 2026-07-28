import type { RigC4BoardSummary, RigC4DiagramProposal } from "@/core/effects/ai-agent.runtime";
import { buildGroundedProposalDiff, summarizeGroundedProposalDiff } from "@/core/effects/opy-c4-proposals";
import { describe, expect, it } from "vitest";
import { ZERO_RIG_USAGE } from "./rig-usage.fixture";

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
  summary: "Customer uses Payments API.",
  rationale: "Reuses the existing core actors and relationships.",
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
  ],
  edges: [
    {
      sourceKey: "customer",
      targetKey: "payments-api",
      label: "uses",
    },
  ],
  provider: "openai",
  model: "gpt-5",
  respondedAtMs: 1,
  usage: ZERO_RIG_USAGE,
  ...overrides,
});

describe("opy-c4-proposals", () => {
  it("marks exact node and edge matches as existing", () => {
    const diff = buildGroundedProposalDiff(createProposal(), createBoardSummary());
    expect(diff).not.toBeNull();

    const summary = summarizeGroundedProposalDiff(diff!);
    expect(summary.existingNodes).toBe(2);
    expect(summary.existingEdges).toBe(1);
    expect(summary.hasChanges).toBe(false);
    expect(summary.canApply).toBe(true);
  });

  it("marks a label-changed existing connection as ambiguous", () => {
    const diff = buildGroundedProposalDiff(
      createProposal({
        edges: [
          {
            sourceKey: "customer",
            targetKey: "payments-api",
            label: "submits orders to",
          },
        ],
      }),
      createBoardSummary(),
    );

    expect(diff).not.toBeNull();
    expect(diff!.edgeDiffs[0]?.status).toBe("ambiguous");

    const summary = summarizeGroundedProposalDiff(diff!);
    expect(summary.ambiguousEdges).toBe(1);
    expect(summary.canApply).toBe(false);
  });

  it("marks a reversed existing connection as ambiguous", () => {
    const diff = buildGroundedProposalDiff(
      createProposal({
        edges: [
          {
            sourceKey: "payments-api",
            targetKey: "customer",
            label: "notifies",
          },
        ],
      }),
      createBoardSummary(),
    );

    expect(diff).not.toBeNull();
    expect(diff!.edgeDiffs[0]?.status).toBe("ambiguous");
  });
});
