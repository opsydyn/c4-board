import { describe, expect, test } from "vitest";
import type { OpyAgentTaskLineageDiagnostics } from "./opy-agent.task-lineage";
import {
  buildResumeBoundaryDrilldownFromOutcome,
  buildResumeBoundaryDrilldownFromPlan,
  formatLineageResumeOutcomeRollup,
  summarizeOpyTaskLineageAttention,
  summarizeResumeBoundaryHealthDrivers,
  type OpyPersistedResumeBoundaryOutcomePayload,
  type OpyResumeBoundaryPlanItem,
} from "./opy-agent.resume";

const createLineageDiagnostics = (
  overrides: Partial<OpyAgentTaskLineageDiagnostics> = {},
): OpyAgentTaskLineageDiagnostics => ({
  continuityKey: "proposal:new-payment-service",
  lineageKey: "proposal:session-1:new-payment-service",
  segmentCount: 3,
  inheritedSegmentCount: 1,
  sessionCount: 2,
  sessionIds: ["session-1", "session-2"],
  crossSessionSegmentCount: 1,
  completedStepNames: ["assemble_context", "invoke_agent"],
  artifactKinds: ["context_bundle", "diagram_proposal"],
  resumeOutcomeRollup: {
    taskCount: 2,
    boundaryCount: 4,
    reusedCurrentSessionCount: 1,
    reusedInheritedSessionCount: 1,
    reranCount: 1,
    pendingCount: 1,
  },
  ...overrides,
});

describe("opy agent resume diagnostics", () => {
  test("formats resume outcome rollups in full and compact forms", () => {
    const rollup = createLineageDiagnostics().resumeOutcomeRollup;

    expect(formatLineageResumeOutcomeRollup(rollup)).toBe(
      "CHAIN OUTCOME::LOCAL 1 · INHERITED 1 · RERAN 1 · PENDING 1",
    );
    expect(formatLineageResumeOutcomeRollup(rollup, { compact: true })).toBe(
      "ROLLUP::L1 · I1 · R1 · P1",
    );
  });

  test("prioritizes interrupted resumable chains in spotlight attention", () => {
    const summary = summarizeOpyTaskLineageAttention({
      hasResumableTask: true,
      status: "interrupted",
      lineageDiagnostics: createLineageDiagnostics(),
    });

    expect(summary.headline).toBe("INTERRUPTED RESUME CHAIN");
    expect(summary.reasons).toEqual([
      "RESUME READY",
      "CROSS-SESSION::1",
      "PENDING::1",
      "INHERITS::1",
    ]);
    expect(summary.score).toBe(142);
  });

  test("derives drilldown states and health drivers from plan and outcome payloads", () => {
    const plan: ReadonlyArray<OpyResumeBoundaryPlanItem> = [
      {
        name: "assemble_context",
        origin: "current-session",
      },
      {
        name: "invoke_agent",
        origin: "inherited-session",
      },
      {
        name: "persist_assistant_message",
        origin: "fresh",
      },
    ];
    const payload: OpyPersistedResumeBoundaryOutcomePayload = {
      boundaries: [
        {
          name: "assemble_context",
          outcome: "reused-current-session",
        },
        {
          name: "invoke_agent",
          outcome: "reran",
        },
        {
          name: "persist_assistant_message",
          outcome: "pending",
        },
      ],
      requestKind: "chat",
      updatedAt: 123,
    };

    expect(buildResumeBoundaryDrilldownFromPlan(plan)).toEqual([
      {
        name: "assemble_context",
        label: "CONTEXT",
        status: "LOCAL",
      },
      {
        name: "invoke_agent",
        label: "RESULT",
        status: "INHERITED",
      },
      {
        name: "persist_assistant_message",
        label: "MESSAGE",
        status: "PENDING",
      },
    ]);

    const outcomeDrilldown = buildResumeBoundaryDrilldownFromOutcome(payload);
    expect(outcomeDrilldown).toEqual([
      {
        name: "assemble_context",
        label: "CONTEXT",
        status: "LOCAL",
      },
      {
        name: "invoke_agent",
        label: "RESULT",
        status: "RERAN",
      },
      {
        name: "persist_assistant_message",
        label: "MESSAGE",
        status: "PENDING",
      },
    ]);
    expect(summarizeResumeBoundaryHealthDrivers(outcomeDrilldown)).toBe(
      "RESULT::RERAN · MESSAGE::PENDING",
    );
  });
});
