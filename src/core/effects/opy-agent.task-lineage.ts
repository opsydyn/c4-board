import type { OpyAgentLifecycleReplay, OpyAgentLifecycleRequest } from "./opy-agent.lifecycle";

export interface OpyAgentTaskLineageShape {
  readonly id: string;
  readonly sessionId: string;
  readonly request: OpyAgentLifecycleRequest;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly lineageKey?: string | null;
  readonly parentTaskId?: string | null;
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

export const getOpyAgentTaskLineageKey = <T extends OpyAgentTaskLineageShape>(task: T): string =>
  task.lineageKey ?? deriveOpyAgentTaskLineageKey(task.request);

export const findOpyAgentTaskLineagePredecessor = <T extends OpyAgentTaskLineageShape>(
  tasks: readonly T[],
  task: T,
): T | null => {
  const lineageKey = getOpyAgentTaskLineageKey(task);
  return tasks
    .filter((candidate) =>
      candidate.sessionId === task.sessionId
      && candidate.id !== task.id
      && getOpyAgentTaskLineageKey(candidate) === lineageKey,
    )
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

  const lineageKey = getOpyAgentTaskLineageKey(task);
  const fallbackChain = tasks
    .filter((candidate) =>
      candidate.sessionId === task.sessionId
      && getOpyAgentTaskLineageKey(candidate) === lineageKey
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
    const lineageKey = getOpyAgentTaskLineageKey(task);
    const existing = latestByLineage.get(lineageKey);
    if (!existing || sortByRecencyDesc(task, existing) < 0) {
      latestByLineage.set(lineageKey, task);
    }
  }

  return [...latestByLineage.values()].sort(sortByRecencyDesc);
};
