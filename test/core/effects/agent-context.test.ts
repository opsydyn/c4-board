import { assembleRigAgentContextWithTools, formatRigAgentCitationBlock } from "@/core/effects/agent-context";
import { executeRigReadTool } from "@/core/effects/agent-tools/read-tools";
import type { RigC4BoardSummary } from "@/core/effects/ai-agent.runtime";
import type { OpyBoardContextRegistry } from "@/core/effects/opy-board-context";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const createBoardSummary = (): RigC4BoardSummary => ({
  diagramId: "diagram-1",
  diagramName: "Payments Context",
  nodeCount: 3,
  edgeCount: 2,
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
      description: "Accepts payment requests",
      technology: "Rust",
      teamOwnership: "Core Platform",
    },
    {
      id: "system-ledger",
      label: "Ledger Service",
      nodeType: "system",
      description: null,
      technology: "Postgres",
      teamOwnership: "Core Platform",
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
    {
      id: "edge-payments-ledger",
      sourceId: "system-payments",
      targetId: "system-ledger",
      sourceLabel: "Payments API",
      targetLabel: "Ledger Service",
      label: "records",
    },
  ],
});

const createBoardContext = (): OpyBoardContextRegistry => ({
  diagramId: "diagram-1",
  diagramName: "Payments Context",
  nodeCount: 3,
  edgeCount: 2,
  ownershipTeamCount: 1,
  selectedNode: {
    id: "system-payments",
    label: "Payments API",
    nodeType: "system",
    relationshipCount: 2,
    teamOwnership: "Core Platform",
    description: "Accepts payment requests",
    technology: "Rust",
  },
  hotspotNode: {
    id: "system-payments",
    label: "Payments API",
    nodeType: "system",
    relationshipCount: 2,
    teamOwnership: "Core Platform",
    description: "Accepts payment requests",
    technology: "Rust",
  },
  scopes: [],
  promptContext: "",
});

describe("agent-context", () => {
  it("builds a high-confidence citation bundle from read tools", async () => {
    const boardSummary = createBoardSummary();
    const context = await Effect.runPromise(
      assembleRigAgentContextWithTools({
        boardSummary,
        boardContext: createBoardContext(),
        focus: "payments",
        runReadTool: (tool, input, snapshot) =>
          Effect.succeed(executeRigReadTool(tool, input as never, snapshot) as never),
      }),
    );

    expect(context.confidence).toBe("high");
    expect(context.citations.length).toBeGreaterThanOrEqual(3);
    expect(formatRigAgentCitationBlock(context)).toContain("CITATION::[BOARD_SUMMARY]");
    expect(formatRigAgentCitationBlock(context)).toContain("CONFIDENCE::HIGH");
  });

  it("drops to low confidence when no board evidence exists", async () => {
    const context = await Effect.runPromise(
      assembleRigAgentContextWithTools({
        boardSummary: null,
        boardContext: null,
        focus: null,
        runReadTool: () => Effect.die("should not be called"),
      }),
    );

    expect(context.confidence).toBe("low");
    expect(context.citations).toHaveLength(0);
    expect(context.promptContext).toContain("CONFIDENCE=LOW");
  });
});
