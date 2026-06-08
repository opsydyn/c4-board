import {
  buildOpyReplayEvalDashboard,
  buildOpyReplayEvalPlans,
  calculateOpyLatencyDistribution,
} from "@/core/effects/opy-agent.evals";
import type { OpyAgentArtifact, OpyAgentToolCall } from "@/core/effects/opy-agent.trace";
import type { OpyAgentTask } from "@/core/effects/opy-chat.persistence";
import { describe, expect, it } from "vitest";

const createTask = (overrides?: Partial<OpyAgentTask>): OpyAgentTask => ({
  id: "task-1",
  sessionId: "session-1",
  request: {
    confirmation: null,
    id: "request-1",
    mode: "read",
    kind: "review",
    label: "REVIEW",
    requiresConfirmation: false,
    replay: {
      kind: "review",
      focus: "Payments API",
      sessionId: "session-1",
    },
  },
  lineageKey: "review:session-1:payments api",
  parentTaskId: null,
  lifecycleMetadata: null,
  snapshotRef: {
    version: 1,
    kind: "current_board",
    diagramId: "diagram-1",
    diagramName: "Payments",
    nodeCount: 4,
    edgeCount: 3,
    capturedAt: 1_000,
  },
  stage: "completed",
  status: "completed",
  createdAt: 1_000,
  updatedAt: 1_800,
  completedAt: 2_000,
  errorSummary: null,
  ...overrides,
});

const createArtifact = (
  overrides?: Partial<OpyAgentArtifact>,
): OpyAgentArtifact => ({
  id: "artifact-1",
  taskId: "task-1",
  sessionId: "session-1",
  toolCallId: null,
  kind: "context_bundle",
  summary: "Context ready.",
  payload: {},
  createdAt: 1_100,
  ...overrides,
});

const createToolCall = (
  overrides?: Partial<OpyAgentToolCall>,
): OpyAgentToolCall => ({
  id: "tool-1",
  taskId: "task-1",
  sessionId: "session-1",
  name: "invoke_analyst",
  status: "completed",
  startedAt: 1_200,
  updatedAt: 1_500,
  completedAt: 1_500,
  inputSummary: "Review board.",
  outputSummary: "Review ready.",
  errorSummary: null,
  ...overrides,
});

describe("opy-agent.evals", () => {
  it("calculates deterministic latency distributions", () => {
    expect(calculateOpyLatencyDistribution([100, 200, 300, 400, null, -1])).toEqual({
      count: 4,
      averageMs: 250,
      p50Ms: 200,
      p95Ms: 400,
      maxMs: 400,
    });
  });

  it("classifies replay readiness from request kind, artifacts, and snapshot refs", () => {
    const replayable = createTask();
    const partial = createTask({
      id: "task-2",
      request: {
        confirmation: null,
        id: "request-2",
        mode: "action",
        kind: "apply-proposal",
        label: "APPLY PROPOSAL",
        requiresConfirmation: true,
        replay: {
          kind: "apply-proposal",
          proposalRespondedAtMs: 2_000,
          sessionId: "session-1",
        },
      },
      snapshotRef: null,
    });
    const blocked = createTask({
      id: "task-3",
      status: "failed",
      stage: "failed",
      errorSummary: "Provider failed.",
    });

    const plans = buildOpyReplayEvalPlans({
      tasks: [replayable, partial, blocked],
      artifacts: [
        createArtifact({ taskId: "task-1", kind: "context_bundle" }),
        createArtifact({ id: "artifact-2", taskId: "task-1", kind: "board_review" }),
        createArtifact({ id: "artifact-3", taskId: "task-2", kind: "mutation_plan" }),
      ],
      toolCalls: [],
    });

    expect(plans.map((plan) => [plan.taskId, plan.readiness])).toEqual([
      ["task-3", "blocked"],
      ["task-2", "partial"],
      ["task-1", "replayable"],
    ]);
    expect(plans.find((plan) => plan.taskId === "task-2")?.missingArtifactKinds).toEqual(["action_descriptor"]);
  });

  it("builds dashboard counts, percentiles, and tool success rate", () => {
    const dashboard = buildOpyReplayEvalDashboard({
      tasks: [
        createTask({ id: "task-1", completedAt: 1_100 }),
        createTask({ id: "task-2", completedAt: 1_500 }),
        createTask({ id: "task-3", completedAt: 2_500 }),
      ],
      artifacts: [
        createArtifact({ taskId: "task-1", kind: "context_bundle" }),
        createArtifact({ id: "artifact-2", taskId: "task-1", kind: "board_review" }),
      ],
      toolCalls: [
        createToolCall({ id: "tool-1", completedAt: 1_300 }),
        createToolCall({ id: "tool-2", status: "failed", completedAt: 1_900 }),
      ],
    });

    expect(dashboard.taskCount).toBe(3);
    expect(dashboard.taskLatency).toMatchObject({
      count: 3,
      p50Ms: 500,
      p95Ms: 1_500,
    });
    expect(dashboard.toolCallLatency).toMatchObject({
      count: 2,
      p95Ms: 700,
    });
    expect(dashboard.toolSuccessRate).toBe(0.5);
  });
});
