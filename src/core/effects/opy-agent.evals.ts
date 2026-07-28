import type { OpyAgentArtifact, OpyAgentArtifactKind, OpyAgentToolCall } from "./opy-agent.trace";
import type { OpyAgentRun, OpyAgentTask } from "./opy-chat.persistence";

export type OpyReplayReadiness = "replayable" | "partial" | "blocked";

export interface OpyReplayEvalPlan {
  readonly taskId: string;
  readonly sessionId: string;
  readonly requestId: string;
  readonly replayKind: OpyAgentTask["request"]["replay"]["kind"];
  readonly status: OpyAgentTask["status"];
  readonly stage: OpyAgentTask["stage"];
  readonly readiness: OpyReplayReadiness;
  readonly requiredArtifactKinds: ReadonlyArray<OpyAgentArtifactKind>;
  readonly availableArtifactKinds: ReadonlyArray<OpyAgentArtifactKind>;
  readonly missingArtifactKinds: ReadonlyArray<OpyAgentArtifactKind>;
  readonly snapshotLinked: boolean;
  readonly terminalDurationMs: number | null;
  readonly toolCallCount: number;
  readonly completedToolCallCount: number;
  readonly failedToolCallCount: number;
}

export interface OpyLatencyDistribution {
  readonly count: number;
  readonly averageMs: number | null;
  readonly p50Ms: number | null;
  readonly p95Ms: number | null;
  readonly maxMs: number | null;
}

export interface OpyReplayEvalDashboard {
  readonly taskCount: number;
  readonly replayableTaskCount: number;
  readonly partialTaskCount: number;
  readonly blockedTaskCount: number;
  readonly taskLatency: OpyLatencyDistribution;
  readonly toolCallLatency: OpyLatencyDistribution;
  readonly toolCallCount: number;
  readonly completedToolCallCount: number;
  readonly failedToolCallCount: number;
  readonly toolSuccessRate: number | null;
  readonly plans: ReadonlyArray<OpyReplayEvalPlan>;
}

const uniqueArtifactKinds = (
  artifacts: ReadonlyArray<OpyAgentArtifact>,
): ReadonlyArray<OpyAgentArtifactKind> => [...new Set(artifacts.map((artifact) => artifact.kind))].sort();

export const getOpyReplayRequiredArtifactKinds = (
  replayKind: OpyAgentTask["request"]["replay"]["kind"],
): ReadonlyArray<OpyAgentArtifactKind> => {
  switch (replayKind) {
    case "chat":
      return ["context_bundle", "chat_response"];
    case "review":
      return ["context_bundle", "board_review"];
    case "proposal":
      return ["context_bundle", "diagram_proposal", "mutation_plan"];
    case "add-node":
      return ["action_descriptor"];
    case "apply-proposal":
      return ["mutation_plan", "action_descriptor"];
    case "rollback":
      return ["checkpoint_restore_preview", "action_descriptor"];
  }
};

const toDuration = (start: number, end: number | null): number | null =>
  typeof end === "number" && Number.isFinite(end) && end >= start
    ? end - start
    : null;

const percentile = (values: ReadonlyArray<number>, percentileRank: number): number | null => {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileRank / 100) * sorted.length) - 1),
  );
  return sorted[index] ?? null;
};

export const calculateOpyLatencyDistribution = (
  durationsMs: ReadonlyArray<number | null>,
): OpyLatencyDistribution => {
  const values = durationsMs.filter((value): value is number =>
    typeof value === "number" && Number.isFinite(value) && value >= 0
  );
  if (values.length === 0) {
    return {
      count: 0,
      averageMs: null,
      p50Ms: null,
      p95Ms: null,
      maxMs: null,
    };
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    count: values.length,
    averageMs: total / values.length,
    p50Ms: percentile(values, 50),
    p95Ms: percentile(values, 95),
    maxMs: Math.max(...values),
  };
};

export const buildOpyReplayEvalPlans = (input: {
  readonly tasks: ReadonlyArray<OpyAgentTask>;
  readonly artifacts: ReadonlyArray<OpyAgentArtifact>;
  readonly toolCalls: ReadonlyArray<OpyAgentToolCall>;
}): ReadonlyArray<OpyReplayEvalPlan> => {
  const artifactsByTaskId = new Map<string, OpyAgentArtifact[]>();
  for (const artifact of input.artifacts) {
    artifactsByTaskId.set(artifact.taskId, [
      ...(artifactsByTaskId.get(artifact.taskId) ?? []),
      artifact,
    ]);
  }

  const toolCallsByTaskId = new Map<string, OpyAgentToolCall[]>();
  for (const toolCall of input.toolCalls) {
    toolCallsByTaskId.set(toolCall.taskId, [
      ...(toolCallsByTaskId.get(toolCall.taskId) ?? []),
      toolCall,
    ]);
  }

  return input.tasks
    .map((task): OpyReplayEvalPlan => {
      const taskArtifacts = artifactsByTaskId.get(task.id) ?? [];
      const taskToolCalls = toolCallsByTaskId.get(task.id) ?? [];
      const requiredArtifactKinds = getOpyReplayRequiredArtifactKinds(task.request.replay.kind);
      const availableArtifactKinds = uniqueArtifactKinds(taskArtifacts);
      const missingArtifactKinds = requiredArtifactKinds.filter((kind) => !availableArtifactKinds.includes(kind));
      const snapshotLinked = task.snapshotRef !== null && typeof task.snapshotRef !== "undefined";
      const terminalDurationMs = toDuration(task.createdAt, task.completedAt);
      const completedToolCallCount = taskToolCalls.filter((toolCall) => toolCall.status === "completed").length;
      const failedToolCallCount = taskToolCalls.filter((toolCall) => toolCall.status === "failed").length;
      const terminalBlocked = task.status === "failed" || task.status === "cancelled";
      const missingReplayArtifacts = missingArtifactKinds.length > 0;
      const actionNeedsSnapshot = task.request.mode === "action" && !snapshotLinked;
      const readiness: OpyReplayReadiness = terminalBlocked
        ? "blocked"
        : missingReplayArtifacts || actionNeedsSnapshot
        ? "partial"
        : "replayable";

      return {
        taskId: task.id,
        sessionId: task.sessionId,
        requestId: task.request.id,
        replayKind: task.request.replay.kind,
        status: task.status,
        stage: task.stage,
        readiness,
        requiredArtifactKinds,
        availableArtifactKinds,
        missingArtifactKinds,
        snapshotLinked,
        terminalDurationMs,
        toolCallCount: taskToolCalls.length,
        completedToolCallCount,
        failedToolCallCount,
      };
    })
    .sort((left, right) => {
      if (left.readiness !== right.readiness) {
        const order: Record<OpyReplayReadiness, number> = {
          blocked: 0,
          partial: 1,
          replayable: 2,
        };
        return order[left.readiness] - order[right.readiness];
      }
      return right.taskId.localeCompare(left.taskId);
    });
};

export const buildOpyReplayEvalDashboard = (input: {
  readonly tasks: ReadonlyArray<OpyAgentTask>;
  readonly artifacts: ReadonlyArray<OpyAgentArtifact>;
  readonly toolCalls: ReadonlyArray<OpyAgentToolCall>;
}): OpyReplayEvalDashboard => {
  const plans = buildOpyReplayEvalPlans(input);
  const completedToolCallCount = input.toolCalls.filter((toolCall) => toolCall.status === "completed").length;
  const failedToolCallCount = input.toolCalls.filter((toolCall) => toolCall.status === "failed").length;
  const terminalToolCallCount = completedToolCallCount + failedToolCallCount;
  const toolSuccessRate = terminalToolCallCount > 0
    ? completedToolCallCount / terminalToolCallCount
    : null;

  return {
    taskCount: input.tasks.length,
    replayableTaskCount: plans.filter((plan) => plan.readiness === "replayable").length,
    partialTaskCount: plans.filter((plan) => plan.readiness === "partial").length,
    blockedTaskCount: plans.filter((plan) => plan.readiness === "blocked").length,
    taskLatency: calculateOpyLatencyDistribution(
      input.tasks.map((task) => toDuration(task.createdAt, task.completedAt)),
    ),
    toolCallLatency: calculateOpyLatencyDistribution(
      input.toolCalls.map((toolCall) => toDuration(toolCall.startedAt, toolCall.completedAt)),
    ),
    toolCallCount: input.toolCalls.length,
    completedToolCallCount,
    failedToolCallCount,
    toolSuccessRate,
    plans,
  };
};

export interface OpyModelAttributionEntry {
  readonly provider: string;
  readonly model: string;
  /** Runs attributed to this model, whether or not they measured usage. */
  readonly runCount: number;
  /** Of those, how many actually reported a usage envelope. */
  readonly measuredRunCount: number;
  readonly totalTokens: number;
}

export interface OpyModelAttributionSummary {
  readonly models: ReadonlyArray<OpyModelAttributionEntry>;
  /** Runs recorded before attribution existed. Never folded into a model. */
  readonly unattributedRunCount: number;
  /** Observed tokens across every attributed run, or `null` when none measured. */
  readonly totalTokens: number | null;
}

/**
 * Groups runs by what answered them and totals what was observed.
 *
 * This is an audit fact, not budget tracking: it reports what was measured,
 * enforces nothing, and cannot report cost — the runtime reports tokens, not
 * money. `runCount` and `measuredRunCount` are kept apart so a total is never
 * mistaken for complete coverage; runs that predate usage capture would
 * otherwise silently deflate the figure.
 */
export const summarizeOpyModelAttribution = (
  runs: ReadonlyArray<OpyAgentRun>,
): OpyModelAttributionSummary => {
  const byModel = new Map<string, OpyModelAttributionEntry>();
  let unattributedRunCount = 0;
  let measuredAny = false;
  let totalTokens = 0;

  for (const run of runs) {
    if (run.provider === null || run.model === null) {
      unattributedRunCount += 1;
      continue;
    }

    const key = `${run.provider} ${run.model}`;
    const existing = byModel.get(key);
    const runTokens = run.usage?.totalTokens ?? 0;
    if (run.usage !== null) {
      measuredAny = true;
      totalTokens += runTokens;
    }

    byModel.set(key, {
      provider: run.provider,
      model: run.model,
      runCount: (existing?.runCount ?? 0) + 1,
      measuredRunCount: (existing?.measuredRunCount ?? 0) + (run.usage === null ? 0 : 1),
      totalTokens: (existing?.totalTokens ?? 0) + runTokens,
    });
  }

  return {
    models: [...byModel.values()].sort((left, right) =>
      right.totalTokens - left.totalTokens
      || left.model.localeCompare(right.model)
    ),
    unattributedRunCount,
    totalTokens: measuredAny ? totalTokens : null,
  };
};
