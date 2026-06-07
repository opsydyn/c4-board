import type { Edge, Node } from "@xyflow/react";
import { Effect } from "effect";
import { executeRigReadTool } from "@/core/effects/agent-tools/read-tools";
import { assembleRigAgentContextWithTools } from "@/core/effects/agent-context";
import { resolveOpyApplyProposalActionFlow } from "@/core/effects/opy-action.runtime";
import { buildOpyCheckpointRestorePreview } from "@/core/effects/agent-rollback.runtime";
import type {
  RigC4BoardEdge,
  RigC4BoardNode,
  RigC4BoardSummary,
  RigReadToolInputByName,
  RigReadToolName,
  RigReadToolResultByName,
} from "@/core/effects/ai-agent.runtime";
import type { OpyAgentCheckpoint } from "@/core/effects/opy-chat.persistence";
import { buildOpyBoardContextRegistry } from "@/core/effects/opy-board-context";
import { DEFAULT_APP_SETTINGS } from "@/core/effects/settings.types";
import { describe, expect, it } from "vitest";
import { rigAgentEvalScenarios } from "./fixtures";

const defaultAgentPolicy = DEFAULT_APP_SETTINGS.agentPolicy;

const getScenario = (scenarioId: (typeof rigAgentEvalScenarios)[number]["id"]) => {
  const scenario = rigAgentEvalScenarios.find((candidate) => candidate.id === scenarioId);
  expect(scenario).toBeDefined();
  if (!scenario) {
    throw new Error(`Missing rig agent eval scenario: ${scenarioId}`);
  }
  return scenario;
};

const runLocalReadTool = <TTool extends RigReadToolName>(
  tool: TTool,
  input: RigReadToolInputByName[TTool],
  boardSummary: RigC4BoardSummary,
): Effect.Effect<RigReadToolResultByName[TTool]> =>
  Effect.sync(() => executeRigReadTool(tool, input, boardSummary));

const toCheckpointNode = (node: RigC4BoardNode): Node => ({
  id: node.id,
  type: node.nodeType,
  position: { x: 0, y: 0 },
  data: {
    label: node.label,
    description: node.description ?? "",
    technology: node.technology ?? "",
    c4Type: node.nodeType,
    teamOwnership: node.teamOwnership ?? "",
  },
});

const toCheckpointEdge = (edge: RigC4BoardEdge): Edge => ({
  id: edge.id,
  source: edge.sourceId,
  target: edge.targetId,
  type: "default",
  ...(edge.label ? { label: edge.label } : {}),
});

const toCheckpoint = (
  boardSummary: RigC4BoardSummary,
  overrides?: Partial<OpyAgentCheckpoint>,
): OpyAgentCheckpoint => ({
  id: `checkpoint-${boardSummary.diagramId ?? "eval"}`,
  sessionId: `session-${boardSummary.diagramId ?? "eval"}`,
  diagramId: boardSummary.diagramId ?? "eval-diagram",
  proposalRespondedAtMs: 1_700_000_100_000,
  checkpointType: "pre-apply",
  snapshot: {
    id: boardSummary.diagramId ?? "eval-diagram",
    name: boardSummary.diagramName ?? "Eval Diagram",
    nodes: boardSummary.nodes.map(toCheckpointNode),
    edges: boardSummary.edges.map(toCheckpointEdge),
    savedAt: 1_700_000_100_100,
  },
  createdAt: 1_700_000_100_200,
  ...overrides,
});

describe("rig-agent eval harness", () => {
  it.each(rigAgentEvalScenarios)(
    "grounds $id with high-confidence board evidence",
    (scenario) => {
      const boardContext = buildOpyBoardContextRegistry({
        boardSummary: scenario.boardSummary,
        selectedNodeId: scenario.selectedNodeId,
      });

      expect(boardContext).not.toBeNull();
      if (!boardContext) {
        return;
      }

      const bundle = Effect.runSync(
        assembleRigAgentContextWithTools({
          boardSummary: scenario.boardSummary,
          boardContext,
          focus: boardContext.scopes[1]?.focus ?? boardContext.scopes[0]?.focus ?? null,
          runReadTool: runLocalReadTool,
        }),
      );
      const summaryToolResult = executeRigReadTool(
        "board_summary",
        {},
        scenario.boardSummary,
      );

      expect(summaryToolResult.ownershipTeams).toHaveLength(scenario.expectedOwnershipTeams);
      expect(bundle.confidence).toBe("high");
      expect(bundle.citations.length).toBeGreaterThanOrEqual(3);
      expect(bundle.citations[0]?.tool).toBe("board_summary");
      expect(bundle.citations.some((citation) => citation.tool === "node_lookup")).toBe(true);
      expect(bundle.citations.some((citation) => citation.tool === "edge_lookup")).toBe(true);
      expect(bundle.promptContext).toContain(`FOCUS=${boardContext.scopes[1]?.focus ?? boardContext.scopes[0]?.focus ?? "WHOLE BOARD"}`);
      expect(bundle.promptContext).toContain("CONFIDENCE=HIGH");
    },
  );

  it("allows a bounded mono-team proposal inside the default policy budget", () => {
    const scenario = getScenario("mono-team");
    const resolution = resolveOpyApplyProposalActionFlow({
      actionMode: "apply-with-confirmation",
      policy: defaultAgentPolicy,
      boardSummary: scenario.boardSummary,
      proposalRecord: {
        proposal: scenario.proposal,
        decisionStatus: "approved",
      },
      sessionId: "eval-mono-team",
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) {
      return;
    }

    expect(resolution.value.proposalSummary).toMatchObject({
      newNodes: 1,
      newEdges: 1,
      canApply: true,
      hasChanges: true,
    });
    expect(resolution.value.mutationPlan.plan).toMatchObject({
      totalActions: 2,
      totalNodesCreated: 1,
      totalEdgesCreated: 1,
    });
  });

  it("blocks mutation apply across all scenarios when OPY is in read-only mode", () => {
    for (const scenario of rigAgentEvalScenarios) {
      const resolution = resolveOpyApplyProposalActionFlow({
        actionMode: "read-only",
        policy: defaultAgentPolicy,
        boardSummary: scenario.boardSummary,
        proposalRecord: {
          proposal: scenario.proposal,
          decisionStatus: "approved",
        },
        sessionId: `eval-read-only-${scenario.id}`,
      });

      expect(resolution).toEqual({
        ok: false,
        issue: expect.objectContaining({
          kind: "policy",
          message: "Proposal apply blocked by mode READ-ONLY.",
        }),
      });
    }
  });

  it("blocks cross-team proposals that exceed the configured edge budget", () => {
    const scenario = getScenario("cross-team");
    const resolution = resolveOpyApplyProposalActionFlow({
      actionMode: "apply-with-confirmation",
      policy: {
        ...defaultAgentPolicy,
        maxEdgesCreatedPerRun: 1,
      },
      boardSummary: scenario.boardSummary,
      proposalRecord: {
        proposal: scenario.proposal,
        decisionStatus: "approved",
      },
      sessionId: "eval-cross-team",
    });

    expect(resolution).toEqual({
      ok: false,
      issue: expect.objectContaining({
        kind: "policy",
        message: "Plan apply blocked by policy. Edge creation count 2 exceeds the max edge budget 1.",
      }),
    });
  });

  it("builds a rollback preview for azure-heavy topology with restore, revert, and remove impacts", () => {
    const scenario = getScenario("azure-heavy");
    const checkpoint = toCheckpoint(scenario.boardSummary);
    const currentBoard: RigC4BoardSummary = {
      ...scenario.boardSummary,
      nodeCount: 5,
      edgeCount: 4,
      nodes: scenario.boardSummary.nodes
        .filter((node) => node.id !== "azure-key-vault")
        .map((node) =>
          node.id === "azure-function"
            ? {
              ...node,
              technology: "Azure Container Apps",
              description: "Runtime drifted from the checkpoint baseline.",
            }
            : node)
        .concat([
          {
            id: "azure-redis",
            label: "Redis Cache",
            nodeType: "externalSystem",
            description: "Current-only cache tier",
            technology: "Azure Cache for Redis",
            teamOwnership: "team-platform",
          },
        ]),
      edges: scenario.boardSummary.edges
        .filter((edge) => edge.id !== "azure-edge-4")
        .concat([
          {
            id: "azure-edge-5",
            sourceId: "azure-function",
            targetId: "azure-redis",
            sourceLabel: "Orders Function",
            targetLabel: "Redis Cache",
            label: "hydrates cache",
          },
        ]),
    };
    const preview = buildOpyCheckpointRestorePreview(checkpoint, currentBoard);

    expect(preview).not.toBeNull();
    if (!preview) {
      return;
    }

    expect(preview.hasChanges).toBe(true);
    expect(preview.counts).toEqual({
      restoreNodes: 1,
      revertNodes: 1,
      removeNodes: 1,
      restoreEdges: 1,
      revertEdges: 0,
      removeEdges: 1,
    });
    expect(preview.impactedEntities.some((entity) => entity.status === "restore" && entity.title.includes("Key Vault"))).toBe(true);
    expect(preview.impactedEntities.some((entity) => entity.status === "revert" && entity.title.includes("Orders Function"))).toBe(true);
    expect(preview.impactedEntities.some((entity) => entity.status === "remove" && entity.title.includes("Redis Cache"))).toBe(true);
  });
});
