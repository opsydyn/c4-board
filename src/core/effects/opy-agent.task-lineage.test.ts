import { describe, expect, test } from "vitest";
import type { OpyAgentLifecycleRequest } from "./opy-agent.lifecycle";
import {
  buildOpyAgentTaskLineage,
  type OpyAgentTaskLineageShape,
  selectLatestOpyAgentTaskLineageCollectionEntries,
  summarizeOpyAgentTaskLineageCollection,
} from "./opy-agent.task-lineage";

const createChatRequest = (sessionId: string, prompt: string): OpyAgentLifecycleRequest => ({
  confirmation: null,
  id: `${sessionId}-${prompt}`,
  mode: "read",
  kind: "chat",
  label: "CHAT",
  requiresConfirmation: false,
  replay: {
    kind: "chat",
    prompt,
    sessionId,
  },
});

const createTask = (input: {
  id: string;
  sessionId: string;
  prompt: string;
  createdAt: number;
  updatedAt: number;
  parentTaskId?: string | null;
}): OpyAgentTaskLineageShape => ({
  id: input.id,
  sessionId: input.sessionId,
  request: createChatRequest(input.sessionId, input.prompt),
  createdAt: input.createdAt,
  updatedAt: input.updatedAt,
  lineageKey: null,
  parentTaskId: input.parentTaskId ?? null,
});

describe("opy agent task lineage", () => {
  test("builds a parent-linked chain in timeline order", () => {
    const root = createTask({
      id: "task-root",
      sessionId: "session-a",
      prompt: "review login edge",
      createdAt: 10,
      updatedAt: 10,
    });
    const child = createTask({
      id: "task-child",
      sessionId: "session-b",
      prompt: "review login edge",
      createdAt: 20,
      updatedAt: 21,
      parentTaskId: "task-root",
    });
    const leaf = createTask({
      id: "task-leaf",
      sessionId: "session-b",
      prompt: "review login edge",
      createdAt: 30,
      updatedAt: 31,
      parentTaskId: "task-child",
    });

    expect(buildOpyAgentTaskLineage([leaf, child, root], leaf).map((task) => task.id)).toEqual([
      "task-root",
      "task-child",
      "task-leaf",
    ]);
  });

  test("summarizes only the latest segment per continuity chain", () => {
    const entries = [
      {
        continuityKey: "chat:review login edge",
        createdAt: 10,
        updatedAt: 10,
        sessionIds: ["session-a"],
        crossSessionSegmentCount: 0,
        status: "completed",
        resumeOutcomeRollup: {
          taskCount: 1,
          boundaryCount: 2,
          reusedCurrentSessionCount: 1,
          reusedInheritedSessionCount: 0,
          reranCount: 1,
          pendingCount: 0,
        },
      },
      {
        continuityKey: "chat:review login edge",
        createdAt: 20,
        updatedAt: 30,
        sessionIds: ["session-a", "session-b"],
        crossSessionSegmentCount: 1,
        status: "interrupted",
        resumeOutcomeRollup: {
          taskCount: 2,
          boundaryCount: 5,
          reusedCurrentSessionCount: 2,
          reusedInheritedSessionCount: 1,
          reranCount: 1,
          pendingCount: 1,
        },
      },
      {
        continuityKey: "proposal:new payment service",
        createdAt: 40,
        updatedAt: 41,
        sessionIds: ["session-b"],
        crossSessionSegmentCount: 0,
        status: "running",
        resumeOutcomeRollup: {
          taskCount: 0,
          boundaryCount: 0,
          reusedCurrentSessionCount: 0,
          reusedInheritedSessionCount: 0,
          reranCount: 0,
          pendingCount: 0,
        },
      },
    ] as const;

    expect(selectLatestOpyAgentTaskLineageCollectionEntries(entries).map((entry) => entry.continuityKey)).toEqual([
      "proposal:new payment service",
      "chat:review login edge",
    ]);

    const summary = summarizeOpyAgentTaskLineageCollection(entries);

    expect(summary.chainCount).toBe(2);
    expect(summary.sessionCount).toBe(2);
    expect(summary.crossSessionChainCount).toBe(1);
    expect(summary.interruptedChainCount).toBe(1);
    expect(summary.activeChainCount).toBe(2);
    expect(summary.pendingChainCount).toBe(2);
    expect(summary.boundaryCount).toBe(5);
    expect(summary.resolvedBoundaryCount).toBe(4);
    expect(summary.reusedCurrentSessionCount).toBe(2);
    expect(summary.reusedInheritedSessionCount).toBe(1);
    expect(summary.reranCount).toBe(1);
    expect(summary.pendingCount).toBe(1);
    expect(summary.reuseEfficiencyRatio).toBe(0.75);
  });
});
