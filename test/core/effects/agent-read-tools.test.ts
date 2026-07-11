import { executeRigReadTool, RigReadToolContractError } from "@/core/effects/agent-tools/read-tools";
import type { RigC4BoardSummary } from "@/core/effects/ai-agent.runtime";
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

describe("agent read tools", () => {
  it("returns deterministic board summary results for identical snapshots", () => {
    const boardSummary = createBoardSummary();

    const first = executeRigReadTool("board_summary", {}, boardSummary);
    const second = executeRigReadTool("board_summary", {}, boardSummary);

    expect(first).toEqual(second);
    expect(first.ownershipTeams).toEqual(["Core Platform"]);
    expect(first.nodes[0]?.label).toBe("Customer");
  });

  it("looks up a node with stable connected edges", () => {
    const result = executeRigReadTool(
      "node_lookup",
      { nodeId: "system-payments" },
      createBoardSummary(),
    );

    expect(result.found).toBe(true);
    expect(result.relationshipCount).toBe(2);
    expect(result.connectedEdges.map((edge) => edge.id)).toEqual([
      "edge-customer-payments",
      "edge-payments-ledger",
    ]);
  });

  it("looks up an edge with resolved endpoint nodes", () => {
    const result = executeRigReadTool(
      "edge_lookup",
      { edgeId: "edge-customer-payments" },
      createBoardSummary(),
    );

    expect(result.found).toBe(true);
    expect(result.sourceNode?.label).toBe("Customer");
    expect(result.targetNode?.label).toBe("Payments API");
  });

  it("fails fast on blank lookup identifiers", () => {
    expect(() => executeRigReadTool("node_lookup", { nodeId: "   " }, createBoardSummary())).toThrow(
      RigReadToolContractError,
    );
  });
});
