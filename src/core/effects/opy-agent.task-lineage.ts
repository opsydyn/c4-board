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
}

const normalizeLineageSegment = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

const sortByRecencyDesc = <T extends Pick<OpyAgentTaskLineageShape, "updatedAt" | "createdAt">>(
  left: T,
  right: T,
): number => right.updatedAt - left.updatedAt || right.createdAt - left.createdAt;

const sortByTimelineAsc = <T extends Pick<OpyAgentTaskLineageShape, "createdAt" | "updatedAt">>(
  left: T,
  right: T,
): number => left.createdAt - right.createdAt || left.updatedAt - right.updatedAt;

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
      ),
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

  return {
    continuityKey: getOpyAgentTaskContinuityKey(task),
    lineageKey: getOpyAgentTaskLineageKey(task),
    segmentCount: lineageTasks.length,
    inheritedSegmentCount: Math.max(0, lineageTasks.length - 1),
    sessionCount: sessionIds.size,
    sessionIds: [...sessionIds],
    crossSessionSegmentCount: Math.max(0, lineageTasks.filter((lineageTask) => lineageTask.sessionId !== task.sessionId).length),
    completedStepNames,
    artifactKinds,
  };
};
