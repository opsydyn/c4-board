import type { OpyAgentLifecycleReplay, OpyAgentLifecycleRequest } from "./opy-agent.lifecycle";
import type { OpyAgentArtifactKind, OpyAgentToolCallName, OpyAgentToolCallStatus } from "./opy-agent.trace";

export interface OpyAgentTaskLineageShape {
  readonly id: string;
  readonly sessionId: string;
  readonly request: OpyAgentLifecycleRequest;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly lineageKey?: string | null;
  readonly parentTaskId?: string | null;
}

export interface OpyAgentTaskLineageToolCallShape {
  readonly taskId: string;
  readonly name: OpyAgentToolCallName;
  readonly status: OpyAgentToolCallStatus;
}

export interface OpyAgentTaskLineageArtifactShape {
  readonly taskId: string;
  readonly kind: OpyAgentArtifactKind;
  readonly payload?: unknown;
  readonly createdAt?: number;
}

export interface OpyAgentTaskLineageResumeOutcomeRollup {
  readonly taskCount: number;
  readonly boundaryCount: number;
  readonly reusedCurrentSessionCount: number;
  readonly reusedInheritedSessionCount: number;
  readonly reranCount: number;
  readonly pendingCount: number;
}

export interface OpyAgentTaskLineageDiagnostics {
  readonly continuityKey: string;
  readonly lineageKey: string;
  readonly segmentCount: number;
  readonly inheritedSegmentCount: number;
  readonly sessionCount: number;
  readonly sessionIds: ReadonlyArray<string>;
  readonly crossSessionSegmentCount: number;
  readonly completedStepNames: ReadonlyArray<OpyAgentToolCallName>;
  readonly artifactKinds: ReadonlyArray<OpyAgentArtifactKind>;
  readonly resumeOutcomeRollup: OpyAgentTaskLineageResumeOutcomeRollup;
}

export interface OpyAgentTaskLineageCollectionEntry {
  readonly continuityKey: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly sessionIds: ReadonlyArray<string>;
  readonly crossSessionSegmentCount: number;
  readonly status: "running" | "interrupted" | "completed" | "failed" | "cancelled";
  readonly resumeOutcomeRollup: OpyAgentTaskLineageResumeOutcomeRollup;
}

export interface OpyAgentTaskLineageCollectionSummary {
  readonly chainCount: number;
  readonly sessionCount: number;
  readonly crossSessionChainCount: number;
  readonly interruptedChainCount: number;
  readonly activeChainCount: number;
  readonly pendingChainCount: number;
  readonly boundaryCount: number;
  readonly resolvedBoundaryCount: number;
  readonly reusedCurrentSessionCount: number;
  readonly reusedInheritedSessionCount: number;
  readonly reranCount: number;
  readonly pendingCount: number;
  readonly reuseEfficiencyRatio: number | null;
}

const normalizeLineageSegment = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, " ");

const sortByRecencyDesc = <T extends Pick<OpyAgentTaskLineageShape, "updatedAt" | "createdAt">>(
  left: T,
  right: T,
): number => right.updatedAt - left.updatedAt || right.createdAt - left.createdAt;

const sortByTimelineAsc = <T extends Pick<OpyAgentTaskLineageShape, "createdAt" | "updatedAt">>(
  left: T,
  right: T,
): number => left.createdAt - right.createdAt || left.updatedAt - right.updatedAt;

type PersistedResumeBoundaryOutcome = "reused-current-session" | "reused-inherited-session" | "reran" | "pending";

interface PersistedResumeBoundaryOutcomeItem {
  readonly outcome: PersistedResumeBoundaryOutcome;
}

interface PersistedResumeBoundaryOutcomePayload {
  readonly boundaries: ReadonlyArray<PersistedResumeBoundaryOutcomeItem>;
}

const isPersistedResumeBoundaryOutcomePayload = (
  value: unknown,
): value is PersistedResumeBoundaryOutcomePayload =>
  typeof value === "object"
  && value !== null
  && "boundaries" in value
  && Array.isArray(value.boundaries)
  && value.boundaries.every((item) =>
    typeof item === "object"
    && item !== null
    && "outcome" in item
    && (
      item.outcome === "reused-current-session"
      || item.outcome === "reused-inherited-session"
      || item.outcome === "reran"
      || item.outcome === "pending"
    )
  );

export const deriveOpyAgentTaskContinuityKeyFromReplay = (replay: OpyAgentLifecycleReplay): string => {
  switch (replay.kind) {
    case "chat":
      return `chat:${normalizeLineageSegment(replay.prompt)}`;
    case "proposal":
      return `proposal:${normalizeLineageSegment(replay.description)}`;
    case "review":
      return `review:${normalizeLineageSegment(replay.focus ?? "whole-board")}`;
    case "add-node":
      return `add-node:${replay.nodeType}:${normalizeLineageSegment(replay.label)}`;
    case "apply-proposal":
      return `apply-proposal:${replay.proposalRespondedAtMs}`;
    case "rollback":
      return `rollback:${replay.checkpointId}`;
  }
};

export const deriveOpyAgentTaskLineageKeyFromReplay = (replay: OpyAgentLifecycleReplay): string => {
  switch (replay.kind) {
    case "chat":
      return `chat:${replay.sessionId}:${normalizeLineageSegment(replay.prompt)}`;
    case "proposal":
      return `proposal:${replay.sessionId}:${normalizeLineageSegment(replay.description)}`;
    case "review":
      return `review:${replay.sessionId}:${normalizeLineageSegment(replay.focus ?? "whole-board")}`;
    case "add-node":
      return `add-node:${replay.sessionId}:${replay.nodeType}:${normalizeLineageSegment(replay.label)}`;
    case "apply-proposal":
      return `apply-proposal:${replay.sessionId}:${replay.proposalRespondedAtMs}`;
    case "rollback":
      return `rollback:${replay.sessionId}:${replay.checkpointId}`;
  }
};

export const deriveOpyAgentTaskLineageKey = (request: OpyAgentLifecycleRequest): string =>
  deriveOpyAgentTaskLineageKeyFromReplay(request.replay);

export const deriveOpyAgentTaskContinuityKey = (request: OpyAgentLifecycleRequest): string =>
  deriveOpyAgentTaskContinuityKeyFromReplay(request.replay);

export const getOpyAgentTaskLineageKey = <T extends OpyAgentTaskLineageShape>(task: T): string =>
  task.lineageKey ?? deriveOpyAgentTaskLineageKey(task.request);

export const getOpyAgentTaskContinuityKey = <T extends OpyAgentTaskLineageShape>(task: T): string =>
  deriveOpyAgentTaskContinuityKey(task.request);

export const findOpyAgentTaskLineagePredecessor = <T extends OpyAgentTaskLineageShape>(
  tasks: readonly T[],
  task: T,
): T | null => {
  const continuityKey = getOpyAgentTaskContinuityKey(task);
  return tasks
    .filter((candidate) => (
      candidate.id !== task.id
      && getOpyAgentTaskContinuityKey(candidate) === continuityKey
      && (
        candidate.createdAt < task.createdAt
        || (
          candidate.createdAt === task.createdAt
          && candidate.updatedAt <= task.updatedAt
        )
      )
    ))
    .sort(sortByRecencyDesc)[0] ?? null;
};

export const buildOpyAgentTaskLineage = <T extends OpyAgentTaskLineageShape>(
  tasks: readonly T[],
  task: T,
): ReadonlyArray<T> => {
  const taskById = new Map(tasks.map((candidate) => [candidate.id, candidate] as const));
  if (task.parentTaskId) {
    const chain: T[] = [];
    const seen = new Set<string>();
    let current: T | undefined = task;

    while (current && !seen.has(current.id)) {
      chain.unshift(current);
      seen.add(current.id);
      current = current.parentTaskId ? taskById.get(current.parentTaskId) : undefined;
    }

    if (chain.length > 0) {
      return chain;
    }
  }

  const continuityKey = getOpyAgentTaskContinuityKey(task);
  const fallbackChain = tasks
    .filter((candidate) =>
      getOpyAgentTaskContinuityKey(candidate) === continuityKey
      && (
        candidate.createdAt < task.createdAt
        || (
          candidate.createdAt === task.createdAt
          && candidate.updatedAt <= task.updatedAt
        )
      )
    )
    .sort(sortByTimelineAsc);

  return fallbackChain.some((candidate) => candidate.id === task.id)
    ? fallbackChain
    : [...fallbackChain, task];
};

export const selectLatestOpyAgentTasksByLineage = <T extends OpyAgentTaskLineageShape>(
  tasks: readonly T[],
): ReadonlyArray<T> => {
  const latestByLineage = new Map<string, T>();

  for (const task of tasks) {
    const continuityKey = getOpyAgentTaskContinuityKey(task);
    const existing = latestByLineage.get(continuityKey);
    if (!existing || sortByRecencyDesc(task, existing) < 0) {
      latestByLineage.set(continuityKey, task);
    }
  }

  return [...latestByLineage.values()].sort(sortByRecencyDesc);
};

export const summarizeOpyAgentTaskLineage = <
  TTask extends OpyAgentTaskLineageShape,
  TToolCall extends OpyAgentTaskLineageToolCallShape,
  TArtifact extends OpyAgentTaskLineageArtifactShape,
>(
  tasks: readonly TTask[],
  task: TTask,
  toolCalls: readonly TToolCall[],
  artifacts: readonly TArtifact[],
): OpyAgentTaskLineageDiagnostics => {
  const lineageTasks = buildOpyAgentTaskLineage(tasks, task);
  const lineageTaskIds = new Set(lineageTasks.map((lineageTask) => lineageTask.id));
  const sessionIds = new Set(lineageTasks.map((lineageTask) => lineageTask.sessionId));

  const completedStepNames: OpyAgentToolCallName[] = [];
  const seenStepNames = new Set<OpyAgentToolCallName>();
  for (const toolCall of toolCalls) {
    if (!lineageTaskIds.has(toolCall.taskId) || toolCall.status !== "completed" || seenStepNames.has(toolCall.name)) {
      continue;
    }

    seenStepNames.add(toolCall.name);
    completedStepNames.push(toolCall.name);
  }

  const artifactKinds: OpyAgentArtifactKind[] = [];
  const seenArtifactKinds = new Set<OpyAgentArtifactKind>();
  for (const artifact of artifacts) {
    if (!lineageTaskIds.has(artifact.taskId) || seenArtifactKinds.has(artifact.kind)) {
      continue;
    }

    seenArtifactKinds.add(artifact.kind);
    artifactKinds.push(artifact.kind);
  }

  const latestResumeOutcomeByTask = new Map<string, TArtifact>();
  for (const artifact of artifacts) {
    if (!lineageTaskIds.has(artifact.taskId) || artifact.kind !== "resume_boundary_outcome") {
      continue;
    }

    const existing = latestResumeOutcomeByTask.get(artifact.taskId);
    if (!existing || (artifact.createdAt ?? 0) >= (existing.createdAt ?? 0)) {
      latestResumeOutcomeByTask.set(artifact.taskId, artifact);
    }
  }

  const resumeOutcomeRollup = {
    taskCount: 0,
    boundaryCount: 0,
    reusedCurrentSessionCount: 0,
    reusedInheritedSessionCount: 0,
    reranCount: 0,
    pendingCount: 0,
  } satisfies OpyAgentTaskLineageResumeOutcomeRollup;

  for (const artifact of latestResumeOutcomeByTask.values()) {
    if (!isPersistedResumeBoundaryOutcomePayload(artifact.payload)) {
      continue;
    }

    resumeOutcomeRollup.taskCount += 1;
    for (const boundary of artifact.payload.boundaries) {
      resumeOutcomeRollup.boundaryCount += 1;
      switch (boundary.outcome) {
        case "reused-current-session":
          resumeOutcomeRollup.reusedCurrentSessionCount += 1;
          break;
        case "reused-inherited-session":
          resumeOutcomeRollup.reusedInheritedSessionCount += 1;
          break;
        case "reran":
          resumeOutcomeRollup.reranCount += 1;
          break;
        case "pending":
          resumeOutcomeRollup.pendingCount += 1;
          break;
      }
    }
  }

  return {
    continuityKey: getOpyAgentTaskContinuityKey(task),
    lineageKey: getOpyAgentTaskLineageKey(task),
    segmentCount: lineageTasks.length,
    inheritedSegmentCount: Math.max(0, lineageTasks.length - 1),
    sessionCount: sessionIds.size,
    sessionIds: [...sessionIds],
    crossSessionSegmentCount: Math.max(
      0,
      lineageTasks.filter((lineageTask) => lineageTask.sessionId !== task.sessionId).length,
    ),
    completedStepNames,
    artifactKinds,
    resumeOutcomeRollup,
  };
};

export const selectLatestOpyAgentTaskLineageCollectionEntries = <
  TEntry extends OpyAgentTaskLineageCollectionEntry,
>(
  entries: readonly TEntry[],
): ReadonlyArray<TEntry> => {
  const latestByContinuity = new Map<string, TEntry>();

  for (const entry of entries) {
    const existing = latestByContinuity.get(entry.continuityKey);
    if (!existing || sortByRecencyDesc(entry, existing) < 0) {
      latestByContinuity.set(entry.continuityKey, entry);
    }
  }

  return [...latestByContinuity.values()].sort(sortByRecencyDesc);
};

export const summarizeOpyAgentTaskLineageCollection = <
  TEntry extends OpyAgentTaskLineageCollectionEntry,
>(
  entries: readonly TEntry[],
): OpyAgentTaskLineageCollectionSummary => {
  const dedupedEntries = selectLatestOpyAgentTaskLineageCollectionEntries(entries);
  const sessionIds = new Set<string>();
  let crossSessionChainCount = 0;
  let interruptedChainCount = 0;
  let activeChainCount = 0;
  let pendingChainCount = 0;
  let boundaryCount = 0;
  let reusedCurrentSessionCount = 0;
  let reusedInheritedSessionCount = 0;
  let reranCount = 0;
  let pendingCount = 0;

  for (const entry of dedupedEntries) {
    entry.sessionIds.forEach((sessionId) => {
      sessionIds.add(sessionId);
    });

    if (entry.crossSessionSegmentCount > 0) {
      crossSessionChainCount += 1;
    }

    if (entry.status === "interrupted") {
      interruptedChainCount += 1;
    }

    if (entry.status === "running" || entry.status === "interrupted") {
      activeChainCount += 1;
    }

    if (
      entry.resumeOutcomeRollup.taskCount === 0
      || entry.resumeOutcomeRollup.pendingCount > 0
    ) {
      pendingChainCount += 1;
    }

    boundaryCount += entry.resumeOutcomeRollup.boundaryCount;
    reusedCurrentSessionCount += entry.resumeOutcomeRollup.reusedCurrentSessionCount;
    reusedInheritedSessionCount += entry.resumeOutcomeRollup.reusedInheritedSessionCount;
    reranCount += entry.resumeOutcomeRollup.reranCount;
    pendingCount += entry.resumeOutcomeRollup.pendingCount;
  }

  const resolvedBoundaryCount = reusedCurrentSessionCount + reusedInheritedSessionCount + reranCount;

  return {
    chainCount: dedupedEntries.length,
    sessionCount: sessionIds.size,
    crossSessionChainCount,
    interruptedChainCount,
    activeChainCount,
    pendingChainCount,
    boundaryCount,
    resolvedBoundaryCount,
    reusedCurrentSessionCount,
    reusedInheritedSessionCount,
    reranCount,
    pendingCount,
    reuseEfficiencyRatio: resolvedBoundaryCount > 0
      ? (reusedCurrentSessionCount + reusedInheritedSessionCount) / resolvedBoundaryCount
      : null,
  };
};
