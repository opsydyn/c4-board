import { assembleRigAgentContextWithTools, scoreRigAgentGroundingConfidence } from "@/core/effects/agent-context";
import { buildOpyCheckpointRestorePreview } from "@/core/effects/agent-rollback.runtime";
import { executeRigReadTool } from "@/core/effects/agent-tools/read-tools";
import type {
  RigC4BoardEdge,
  RigC4BoardNode,
  RigC4BoardSummary,
  RigReadToolInputByName,
  RigReadToolName,
  RigReadToolResultByName,
} from "@/core/effects/ai-agent.runtime";
import { resolveOpyApplyProposalActionFlow, resolveOpyRollbackActionFlow } from "@/core/effects/opy-action.runtime";
import { buildOpyReplayEvalDashboard } from "@/core/effects/opy-agent.evals";
import type { OpyAgentArtifact, OpyAgentToolCall } from "@/core/effects/opy-agent.trace";
import { buildOpyBoardContextRegistry } from "@/core/effects/opy-board-context";
import { buildGroundedProposalDiff, summarizeGroundedProposalDiff } from "@/core/effects/opy-c4-proposals";
import type { OpyAgentCheckpoint, OpyAgentTask } from "@/core/effects/opy-chat.persistence";
import { DEFAULT_APP_SETTINGS } from "@/core/effects/settings.types";
import type { Edge, Node } from "@xyflow/react";
import { Effect } from "effect";
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
): Effect.Effect<RigReadToolResultByName[TTool]> => Effect.sync(() => executeRigReadTool(tool, input, boardSummary));

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

const createEvalTask = (overrides?: Partial<OpyAgentTask>): OpyAgentTask => ({
  id: "eval-task-review",
  sessionId: "eval-session",
  request: {
    confirmation: null,
    id: "eval-request-review",
    mode: "read",
    kind: "review",
    label: "REVIEW",
    requiresConfirmation: false,
    replay: {
      kind: "review",
      focus: "Whole board",
      sessionId: "eval-session",
    },
  },
  lineageKey: "review:eval-session:whole board",
  parentTaskId: null,
  lifecycleMetadata: null,
  snapshotRef: {
    version: 1,
    kind: "current_board",
    diagramId: "eval-board",
    diagramName: "Eval Board",
    nodeCount: 4,
    edgeCount: 3,
    capturedAt: 1_700_000_000_000,
  },
  stage: "completed",
  status: "completed",
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_001_000,
  completedAt: 1_700_000_001_000,
  errorSummary: null,
  ...overrides,
});

const createEvalArtifact = (overrides?: Partial<OpyAgentArtifact>): OpyAgentArtifact => ({
  id: "eval-artifact-context",
  taskId: "eval-task-review",
  sessionId: "eval-session",
  toolCallId: null,
  kind: "context_bundle",
  summary: "Context bundle ready.",
  payload: {},
  createdAt: 1_700_000_000_100,
  ...overrides,
});

const createEvalToolCall = (overrides?: Partial<OpyAgentToolCall>): OpyAgentToolCall => ({
  id: "eval-tool-context",
  taskId: "eval-task-review",
  sessionId: "eval-session",
  name: "assemble_context",
  status: "completed",
  startedAt: 1_700_000_000_100,
  updatedAt: 1_700_000_000_250,
  completedAt: 1_700_000_000_250,
  inputSummary: "Assemble fixture context.",
  outputSummary: "Fixture context ready.",
  errorSummary: null,
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
      expect(bundle.promptContext).toContain(
        `FOCUS=${boardContext.scopes[1]?.focus ?? boardContext.scopes[0]?.focus ?? "WHOLE BOARD"}`,
      );
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
      plannerArtifactReady: true,
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
    expect(resolution.value.descriptor.approvalPolicy).toMatchObject({
      actionClass: "batch-mutation",
      approvalMode: "confirm-on-threshold",
      requiresConfirmation: true,
    });
  });

  it.each(rigAgentEvalScenarios)(
    "keeps $id proposal apply behind explicit approval metadata",
    (scenario) => {
      const resolution = resolveOpyApplyProposalActionFlow({
        actionMode: "apply-with-confirmation",
        policy: defaultAgentPolicy,
        boardSummary: scenario.boardSummary,
        proposalRecord: {
          proposal: scenario.proposal,
          decisionStatus: "approved",
        },
        plannerArtifactReady: true,
        sessionId: `eval-approval-${scenario.id}`,
      });

      expect(resolution.ok).toBe(true);
      if (!resolution.ok) {
        return;
      }

      expect(resolution.value.descriptor.approvalPolicy.actionClass).toBe("batch-mutation");
      expect(resolution.value.descriptor.approvalPolicy.requiresConfirmation).toBe(true);
      expect(resolution.value.descriptor.confirmationMessage).toContain("APPROVAL::BATCH MUTATION");
      expect(resolution.value.descriptor.confirmationMessage).toContain("RISK::");
    },
  );

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
        plannerArtifactReady: true,
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
      plannerArtifactReady: true,
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

  it("guards low-coverage fixture proposals with low confidence", () => {
    const scenario = getScenario("azure-heavy");
    const bundle = Effect.runSync(
      assembleRigAgentContextWithTools({
        boardSummary: scenario.boardSummary,
        boardContext: null,
        focus: "Azure event processing",
        runReadTool: runLocalReadTool,
      }),
    );
    const groundedProposal = buildGroundedProposalDiff(scenario.proposal, scenario.boardSummary);

    expect(groundedProposal).not.toBeNull();
    if (!groundedProposal) {
      return;
    }

    const confidence = scoreRigAgentGroundingConfidence({
      context: bundle,
      surface: "proposal",
      proposalSummary: summarizeGroundedProposalDiff(groundedProposal),
    });

    expect(bundle.citations).toHaveLength(1);
    expect(confidence.confidence).toBe("low");
    expect(confidence.lowCoverage).toBe(true);
    expect(confidence.reason).toContain("LOW COVERAGE");
  });

  it("classifies deterministic replay readiness for read-only, safe mutation, failure recovery, and rollback fixtures", () => {
    const dashboard = buildOpyReplayEvalDashboard({
      tasks: [
        createEvalTask({
          id: "eval-read-only-qa",
          request: {
            confirmation: null,
            id: "eval-request-read-only-qa",
            mode: "read",
            kind: "review",
            label: "READ ONLY QA",
            requiresConfirmation: false,
            replay: {
              kind: "review",
              focus: "Whole board",
              sessionId: "eval-session",
            },
          },
          lineageKey: "review:eval-session:whole board",
        }),
        createEvalTask({
          id: "eval-safe-mutation",
          request: {
            confirmation: null,
            id: "eval-request-safe-mutation",
            mode: "action",
            kind: "apply-proposal",
            label: "APPLY PROPOSAL",
            requiresConfirmation: true,
            replay: {
              kind: "apply-proposal",
              proposalRespondedAtMs: 1_700_000_000_000,
              sessionId: "eval-session",
            },
          },
          lineageKey: "apply-proposal:eval-session:1700000000000",
        }),
        createEvalTask({
          id: "eval-failure-recovery",
          request: {
            confirmation: null,
            id: "eval-request-failure-recovery",
            mode: "read",
            kind: "proposal",
            label: "FAILED PROPOSAL",
            requiresConfirmation: false,
            replay: {
              kind: "proposal",
              description: "Broken provider response",
              sessionId: "eval-session",
            },
          },
          lineageKey: "proposal:eval-session:broken provider response",
          stage: "failed",
          status: "failed",
          errorSummary: "Provider schema validation failed.",
        }),
        createEvalTask({
          id: "eval-rollback",
          request: {
            confirmation: null,
            id: "eval-request-rollback",
            mode: "action",
            kind: "rollback",
            label: "ROLLBACK",
            requiresConfirmation: true,
            replay: {
              kind: "rollback",
              checkpointId: "checkpoint-azure-heavy-board",
              sessionId: "eval-session",
            },
          },
          lineageKey: "rollback:eval-session:checkpoint-azure-heavy-board",
        }),
      ],
      artifacts: [
        createEvalArtifact({ id: "read-context", taskId: "eval-read-only-qa", kind: "context_bundle" }),
        createEvalArtifact({ id: "read-review", taskId: "eval-read-only-qa", kind: "board_review" }),
        createEvalArtifact({ id: "safe-plan", taskId: "eval-safe-mutation", kind: "mutation_plan" }),
        createEvalArtifact({ id: "safe-action", taskId: "eval-safe-mutation", kind: "action_descriptor" }),
        createEvalArtifact({ id: "rollback-preview", taskId: "eval-rollback", kind: "checkpoint_restore_preview" }),
        createEvalArtifact({ id: "rollback-action", taskId: "eval-rollback", kind: "action_descriptor" }),
      ],
      toolCalls: [
        createEvalToolCall({ id: "read-tool", taskId: "eval-read-only-qa" }),
        createEvalToolCall({ id: "safe-tool", taskId: "eval-safe-mutation", name: "resolve_action" }),
        createEvalToolCall({
          id: "failure-tool",
          taskId: "eval-failure-recovery",
          name: "invoke_planner",
          status: "failed",
          errorSummary: "Provider schema validation failed.",
          completedAt: 1_700_000_000_450,
        }),
        createEvalToolCall({ id: "rollback-tool", taskId: "eval-rollback", name: "resolve_action" }),
      ],
    });

    expect(dashboard.taskCount).toBe(4);
    expect(dashboard.replayableTaskCount).toBe(3);
    expect(dashboard.blockedTaskCount).toBe(1);
    expect(dashboard.plans.map((plan) => [plan.taskId, plan.readiness])).toEqual([
      ["eval-failure-recovery", "blocked"],
      ["eval-safe-mutation", "replayable"],
      ["eval-rollback", "replayable"],
      ["eval-read-only-qa", "replayable"],
    ]);
    expect(dashboard.toolSuccessRate).toBe(0.75);
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
            : node
        )
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
    expect(preview.impactedEntities.some((entity) => entity.status === "restore" && entity.title.includes("Key Vault")))
      .toBe(true);
    expect(
      preview.impactedEntities.some((entity) => entity.status === "revert" && entity.title.includes("Orders Function")),
    ).toBe(true);
    expect(
      preview.impactedEntities.some((entity) => entity.status === "remove" && entity.title.includes("Redis Cache")),
    ).toBe(true);
  });

  it("resolves azure-heavy rollback as a high-risk approval action", () => {
    const scenario = getScenario("azure-heavy");
    const resolution = resolveOpyRollbackActionFlow({
      actionMode: "apply-with-confirmation",
      policy: defaultAgentPolicy,
      checkpoint: toCheckpoint(scenario.boardSummary),
      sessionId: "eval-rollback-azure-heavy",
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) {
      return;
    }

    expect(resolution.value.approvalPolicy).toMatchObject({
      actionClass: "rollback",
      risk: "high",
      approvalMode: "confirm-on-threshold",
      thresholdTriggered: true,
      requiresConfirmation: true,
    });
    expect(resolution.value.confirmationMessage).toContain("APPROVAL::ROLLBACK");
  });
});
