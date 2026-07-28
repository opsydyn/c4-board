/**
 * Release readiness (Gate 2).
 *
 * The dangerous failure mode for a gate like this is not a wrong threshold — it
 * is a green light computed from nothing. Most of these tests exist to pin the
 * distinction between "the evidence says this is healthy" and "there is no
 * evidence", which a naive share-of-total calculation collapses into 100%.
 */

import type { OpyAgentArtifact, OpyAgentToolCall } from "@/core/effects/opy-agent.trace";
import type { OpyAgentTask, OpyPersistedDiagramProposal } from "@/core/effects/opy-chat.persistence";
import {
  assessOpyReleaseReadiness,
  OPY_RELEASE_MIN_DECISION_SAMPLE,
  OPY_RELEASE_MIN_TASK_SAMPLE,
} from "@/core/effects/opy-release-readiness";
import { describe, expect, it } from "vitest";

const task = (overrides?: Partial<OpyAgentTask>): OpyAgentTask => ({
  id: "task-1",
  sessionId: "session-1",
  request: {
    confirmation: null,
    id: "request-1",
    mode: "read",
    kind: "review",
    label: "REVIEW",
    requiresConfirmation: false,
    replay: { kind: "review", focus: "Payments", sessionId: "session-1" },
  },
  lineageKey: "review:session-1:payments",
  parentTaskId: null,
  stage: "completed",
  status: "completed",
  createdAt: 1_000,
  updatedAt: 1_500,
  completedAt: 1_500,
  errorSummary: null,
  ...overrides,
});

/** A task whose replay artifacts are all present, so replay readiness is clean. */
const healthyTask = (index: number, overrides?: Partial<OpyAgentTask>): OpyAgentTask =>
  task({
    id: `task-${index}`,
    request: {
      confirmation: null,
      id: `request-${index}`,
      mode: "read",
      kind: "review",
      label: "REVIEW",
      requiresConfirmation: false,
      replay: { kind: "review", focus: "Payments", sessionId: "session-1" },
    },
    ...overrides,
  });

const artifactsFor = (
  taskId: string,
  confidence: "high" | "medium" | "low" = "high",
): ReadonlyArray<OpyAgentArtifact> => [
  {
    id: `${taskId}-context`,
    taskId,
    sessionId: "session-1",
    toolCallId: null,
    kind: "context_bundle",
    summary: "Context ready.",
    payload: { promptContext: "", citations: [], confidence, confidenceReason: "" },
    createdAt: 1_100,
  },
  {
    id: `${taskId}-review`,
    taskId,
    sessionId: "session-1",
    toolCallId: null,
    kind: "board_review",
    summary: "Review ready.",
    payload: {},
    createdAt: 1_200,
  },
];

const anomalyArtifact = (
  taskId: string,
  severity: "caution" | "critical",
  blocked: boolean,
): OpyAgentArtifact => ({
  id: `${taskId}-anomaly`,
  taskId,
  sessionId: "session-1",
  toolCallId: null,
  kind: "anomaly_assessment",
  summary: "Anomaly screened.",
  payload: {
    assessment: {
      requestKind: "chat",
      severity,
      blocked,
      score: severity === "critical" ? 90 : 40,
      summary: "",
      recommendedAction: "",
      signals: [],
    },
    requestText: "",
  },
  createdAt: 1_050,
});

const proposal = (
  decisionStatus: OpyPersistedDiagramProposal["decisionStatus"],
  decidedAt: number,
): OpyPersistedDiagramProposal => ({
  sessionId: "session-1",
  commandDescription: "Add a service",
  proposal: {} as never,
  context: {} as never,
  decisionStatus,
  decidedAt,
});

/**
 * A fleet healthy enough to widen mutation defaults on — which means it must
 * include a track record of operators *accepting* proposals. Clean read-only
 * traffic alone is not evidence that the agent's mutations are trusted.
 */
const healthyFleet = (count: number = OPY_RELEASE_MIN_TASK_SAMPLE) => {
  const tasks = Array.from({ length: count }, (_, index) => healthyTask(index));
  return {
    tasks,
    artifacts: tasks.flatMap((entry) => artifactsFor(entry.id)),
    toolCalls: [] as ReadonlyArray<OpyAgentToolCall>,
    proposals: Array.from(
      { length: OPY_RELEASE_MIN_DECISION_SAMPLE },
      (_, index) => proposal("approved", 2_000 + index),
    ),
  };
};

const signal = (readiness: ReturnType<typeof assessOpyReleaseReadiness>, id: string) =>
  readiness.signals.find((entry) => entry.id === id);

describe("assessOpyReleaseReadiness", () => {
  it("reports insufficient evidence rather than a pass when there is nothing to judge", () => {
    const readiness = assessOpyReleaseReadiness({
      tasks: [],
      artifacts: [],
      toolCalls: [],
      proposals: [],
    });

    expect(readiness.verdict).toBe("insufficient-evidence");
    expect(readiness.verdict).not.toBe("pass");
    expect(readiness.taskCount).toBe(0);
  });

  it("still reports insufficient evidence one task short of the sample floor", () => {
    const readiness = assessOpyReleaseReadiness(healthyFleet(OPY_RELEASE_MIN_TASK_SAMPLE - 1));

    expect(readiness.verdict).toBe("insufficient-evidence");
  });

  it("passes a healthy fleet once the sample floor is met", () => {
    const readiness = assessOpyReleaseReadiness(healthyFleet());

    expect(readiness.verdict).toBe("pass");
    expect(readiness.blocking).toEqual([]);
  });

  it("blocks when too many tasks cannot be replayed", () => {
    const fleet = healthyFleet();
    const readiness = assessOpyReleaseReadiness({
      ...fleet,
      // Half the fleet loses its required review artifact.
      artifacts: fleet.artifacts.filter((_artifact, index) => index % 4 !== 1),
    });

    expect(signal(readiness, "replay")?.verdict).toBe("block");
    expect(readiness.verdict).toBe("block");
    expect(readiness.blocking).toContain("replay");
  });

  it("blocks when tasks are failing outright", () => {
    const fleet = healthyFleet();
    const readiness = assessOpyReleaseReadiness({
      ...fleet,
      tasks: fleet.tasks.map((entry, index) => index % 2 === 0 ? { ...entry, status: "failed" as const } : entry),
    });

    expect(signal(readiness, "failure")?.verdict).toBe("block");
    expect(readiness.verdict).toBe("block");
  });

  it("blocks on a critical anomaly that was not blocked, because the boundary failed open", () => {
    const fleet = healthyFleet();
    const readiness = assessOpyReleaseReadiness({
      ...fleet,
      artifacts: [...fleet.artifacts, anomalyArtifact("task-0", "critical", false)],
    });

    expect(signal(readiness, "anomaly")?.verdict).toBe("block");
    expect(readiness.blocking).toContain("anomaly");
  });

  it("does not blame a critical anomaly that was blocked, because that is the boundary working", () => {
    const fleet = healthyFleet();
    const readiness = assessOpyReleaseReadiness({
      ...fleet,
      artifacts: [...fleet.artifacts, anomalyArtifact("task-0", "critical", true)],
    });

    expect(signal(readiness, "anomaly")?.verdict).toBe("pass");
    expect(readiness.verdict).toBe("pass");
  });

  it("blocks when operators keep rejecting what the agent proposes", () => {
    const fleet = healthyFleet();
    const proposals = Array.from(
      { length: 10 },
      (_, index) => proposal(index < 6 ? "rejected" : "approved", 2_000 + index),
    );

    const readiness = assessOpyReleaseReadiness({ ...fleet, proposals });

    expect(signal(readiness, "approval")?.verdict).toBe("block");
    expect(readiness.blocking).toContain("approval");
  });

  it("ignores pending proposals when judging approval, since nobody has decided yet", () => {
    const fleet = healthyFleet();
    const proposals = Array.from(
      { length: 10 },
      (_, index) => proposal(index < 8 ? "pending" : "approved", 2_000 + index),
    );

    const readiness = assessOpyReleaseReadiness({ ...fleet, proposals });

    expect(signal(readiness, "approval")?.observed).toBe(0);
  });

  it("blocks when most groundings came back low confidence", () => {
    const fleet = healthyFleet();
    const readiness = assessOpyReleaseReadiness({
      ...fleet,
      artifacts: fleet.tasks.flatMap((entry, index) => artifactsFor(entry.id, index % 2 === 0 ? "low" : "high")),
    });

    expect(signal(readiness, "confidence")?.verdict).toBe("block");
  });

  it("blocks when p95 task latency is far past the budget", () => {
    const fleet = healthyFleet();
    const readiness = assessOpyReleaseReadiness({
      ...fleet,
      tasks: fleet.tasks.map((entry) => ({ ...entry, completedAt: entry.createdAt + 400_000 })),
    });

    expect(signal(readiness, "latency")?.verdict).toBe("block");
  });

  it("lets absent evidence outrank a warning, so a gap is never softer than a complaint", () => {
    const fleet = healthyFleet();
    const readiness = assessOpyReleaseReadiness({
      ...fleet,
      // Latency warns; approval has no decided proposals at all.
      proposals: [],
      tasks: fleet.tasks.map((entry) => ({ ...entry, completedAt: entry.createdAt + 45_000 })),
    });

    expect(signal(readiness, "latency")?.verdict).toBe("warn");
    expect(signal(readiness, "approval")?.verdict).toBe("insufficient-evidence");
    expect(readiness.verdict).toBe("insufficient-evidence");
  });

  it("reports every signal every time, so a clean verdict still shows its working", () => {
    const readiness = assessOpyReleaseReadiness(healthyFleet());

    expect(readiness.signals.map((entry) => entry.id).sort()).toEqual([
      "anomaly",
      "approval",
      "confidence",
      "failure",
      "latency",
      "replay",
    ]);
    for (const entry of readiness.signals) {
      expect(entry.summary.length).toBeGreaterThan(0);
    }
  });
});
