import type { OpyAgentLifecycleRequest } from "./opy-agent.lifecycle";
import type { OpyAgentTaskLineageDiagnostics, OpyAgentTaskLineageResumeOutcomeRollup } from "./opy-agent.task-lineage";
import type { OpyAgentToolCallName } from "./opy-agent.trace";

export type OpyResumeBoundaryOrigin = "current-session" | "inherited-session" | "fresh";

export interface OpyResumeBoundaryPlanItem {
  readonly name: OpyAgentToolCallName;
  readonly origin: OpyResumeBoundaryOrigin;
}

export type OpyResumeBoundaryOutcome =
  | "reused-current-session"
  | "reused-inherited-session"
  | "reran"
  | "pending";

export interface OpyPersistedResumeBoundaryOutcomeItem {
  readonly name: OpyAgentToolCallName;
  readonly outcome: OpyResumeBoundaryOutcome;
}

export interface OpyPersistedResumeBoundaryOutcomePayload {
  readonly boundaries: ReadonlyArray<OpyPersistedResumeBoundaryOutcomeItem>;
  readonly requestKind: OpyAgentLifecycleRequest["kind"];
  readonly updatedAt: number;
}

export interface OpyResumeBoundaryDrilldownItem {
  readonly name: OpyAgentToolCallName;
  readonly label: string;
  readonly status: "LOCAL" | "INHERITED" | "RERAN" | "PENDING";
}

export interface OpyTaskLineageAttentionInput {
  readonly hasResumableTask: boolean;
  readonly status: "running" | "interrupted" | "completed" | "failed" | "cancelled";
  readonly lineageDiagnostics: OpyAgentTaskLineageDiagnostics;
}

export interface OpyTaskLineageAttentionSummary {
  readonly headline: string;
  readonly reasons: ReadonlyArray<string>;
  readonly score: number;
}

export const LOW_EFFICIENCY_REUSE_RATIO_THRESHOLD = 0.5;

const RESUME_BOUNDARY_LABEL: Record<OpyAgentToolCallName, string> = {
  assemble_context: "CONTEXT",
  invoke_agent: "RESULT",
  invoke_analyst: "ANALYST",
  invoke_planner: "PLANNER",
  invoke_verifier: "VERIFIER",
  persist_assistant_message: "MESSAGE",
  resolve_action: "ACTION",
  execute_board_action: "APPLY",
  refresh_checkpoints: "CHECKPOINTS",
};

export const formatLineageResumeOutcomeRollup = (
  rollup: OpyAgentTaskLineageResumeOutcomeRollup,
  options?: {
    readonly compact?: boolean;
  },
): string => {
  if (rollup.taskCount === 0 || rollup.boundaryCount === 0) {
    return options?.compact ? "ROLLUP::PENDING" : "CHAIN OUTCOME::PENDING";
  }

  const parts = [
    rollup.reusedCurrentSessionCount > 0
      ? `${options?.compact ? "L" : "LOCAL"}${options?.compact ? "" : " "}${rollup.reusedCurrentSessionCount}`
      : null,
    rollup.reusedInheritedSessionCount > 0
      ? `${options?.compact ? "I" : "INHERITED"}${options?.compact ? "" : " "}${rollup.reusedInheritedSessionCount}`
      : null,
    rollup.reranCount > 0
      ? `${options?.compact ? "R" : "RERAN"}${options?.compact ? "" : " "}${rollup.reranCount}`
      : null,
    rollup.pendingCount > 0
      ? `${options?.compact ? "P" : "PENDING"}${options?.compact ? "" : " "}${rollup.pendingCount}`
      : null,
  ].filter((part): part is string => part !== null);

  if (parts.length === 0) {
    return options?.compact ? "ROLLUP::PENDING" : "CHAIN OUTCOME::PENDING";
  }

  return `${options?.compact ? "ROLLUP" : "CHAIN OUTCOME"}::${parts.join(" · ")}`;
};

export const calculateReuseEfficiencyRatio = (
  rollup: OpyAgentTaskLineageResumeOutcomeRollup,
): number | null => {
  const resolvedBoundaryCount = rollup.reusedCurrentSessionCount
    + rollup.reusedInheritedSessionCount
    + rollup.reranCount;

  return resolvedBoundaryCount > 0
    ? (rollup.reusedCurrentSessionCount + rollup.reusedInheritedSessionCount) / resolvedBoundaryCount
    : null;
};

export const formatReuseEfficiency = (ratio: number | null): string =>
  ratio === null ? "PENDING" : `${Math.round(ratio * 100)}%`;

export const summarizeOpyTaskLineageAttention = (
  input: OpyTaskLineageAttentionInput,
): OpyTaskLineageAttentionSummary => {
  const { hasResumableTask, status, lineageDiagnostics } = input;
  const reasons: string[] = [];
  let score = 0;

  if (hasResumableTask || status === "interrupted") {
    score += 100;
    reasons.push("RESUME READY");
  } else if (status === "running") {
    score += 80;
    reasons.push("ACTIVE RUN");
  }

  if (lineageDiagnostics.crossSessionSegmentCount > 0) {
    score += 24;
    reasons.push(`CROSS-SESSION::${lineageDiagnostics.crossSessionSegmentCount}`);
  }

  const reuseEfficiencyRatio = calculateReuseEfficiencyRatio(lineageDiagnostics.resumeOutcomeRollup);
  if (reuseEfficiencyRatio !== null && reuseEfficiencyRatio < LOW_EFFICIENCY_REUSE_RATIO_THRESHOLD) {
    score += 18;
    reasons.push(`EFFICIENCY::${formatReuseEfficiency(reuseEfficiencyRatio)}`);
  }

  if (lineageDiagnostics.resumeOutcomeRollup.pendingCount > 0) {
    score += 12;
    reasons.push(`PENDING::${lineageDiagnostics.resumeOutcomeRollup.pendingCount}`);
  }

  if (lineageDiagnostics.inheritedSegmentCount > 0) {
    score += 6;
    reasons.push(`INHERITS::${lineageDiagnostics.inheritedSegmentCount}`);
  }

  const headline = hasResumableTask || status === "interrupted"
    ? "INTERRUPTED RESUME CHAIN"
    : status === "running"
    ? "ACTIVE CONTINUITY CHAIN"
    : reuseEfficiencyRatio !== null && reuseEfficiencyRatio < LOW_EFFICIENCY_REUSE_RATIO_THRESHOLD
    ? "LOW EFFICIENCY CHAIN"
    : lineageDiagnostics.crossSessionSegmentCount > 0
    ? "CROSS-SESSION CONTINUITY"
    : "STABLE CONTINUITY CHAIN";

  return {
    headline,
    reasons: reasons.length > 0 ? reasons : ["RECENT LINEAGE"],
    score,
  };
};

export const buildResumeBoundaryDrilldownFromPlan = (
  plan: readonly OpyResumeBoundaryPlanItem[],
): ReadonlyArray<OpyResumeBoundaryDrilldownItem> =>
  plan.map((item) => ({
    name: item.name,
    label: RESUME_BOUNDARY_LABEL[item.name],
    status: item.origin === "current-session"
      ? "LOCAL"
      : item.origin === "inherited-session"
      ? "INHERITED"
      : "PENDING",
  }));

export const buildResumeBoundaryDrilldownFromOutcome = (
  payload: OpyPersistedResumeBoundaryOutcomePayload,
): ReadonlyArray<OpyResumeBoundaryDrilldownItem> =>
  payload.boundaries.map((item) => ({
    name: item.name,
    label: RESUME_BOUNDARY_LABEL[item.name],
    status: item.outcome === "reused-current-session"
      ? "LOCAL"
      : item.outcome === "reused-inherited-session"
      ? "INHERITED"
      : item.outcome === "reran"
      ? "RERAN"
      : "PENDING",
  }));

export const summarizeResumeBoundaryHealthDrivers = (
  items: readonly OpyResumeBoundaryDrilldownItem[],
): string | null => {
  const drivers = items
    .filter((item) => item.status === "RERAN" || item.status === "PENDING")
    .map((item) => `${item.label}::${item.status}`);

  return drivers.length > 0 ? drivers.join(" · ") : null;
};
