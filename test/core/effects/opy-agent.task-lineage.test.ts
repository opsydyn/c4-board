import {
  buildOpyAgentTaskLineage,
  deriveOpyAgentTaskLineageKey,
  findOpyAgentTaskLineagePredecessor,
  selectLatestOpyAgentTasksByLineage,
  summarizeOpyAgentTaskLineage,
} from "@/core/effects/opy-agent.task-lineage";
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
  stage: "planning",
  status: "running",
  createdAt: 1_000,
  updatedAt: 1_050,
  completedAt: null,
  errorSummary: null,
  ...overrides,
});

describe("opy-agent.task-lineage", () => {
  it("derives stable lineage keys from replay payloads", () => {
    const key = deriveOpyAgentTaskLineageKey(createTask().request);
    expect(key).toBe("review:session-1:payments api");
  });

  it("finds the most recent predecessor in the same lineage", () => {
    const oldest = createTask({
      id: "task-oldest",
      createdAt: 1_000,
      updatedAt: 1_050,
    });
    const latest = createTask({
      id: "task-latest",
      createdAt: 2_000,
      updatedAt: 2_050,
    });
    const candidate = createTask({
      id: "task-candidate",
      createdAt: 3_000,
      updatedAt: 3_050,
    });

    expect(findOpyAgentTaskLineagePredecessor([oldest, latest], candidate)?.id).toBe("task-latest");
  });

  it("walks explicit lineage parents before falling back to chronology", () => {
    const root = createTask({
      id: "task-root",
      createdAt: 1_000,
      updatedAt: 1_050,
    });
    const middle = createTask({
      id: "task-middle",
      createdAt: 2_000,
      updatedAt: 2_050,
      parentTaskId: "task-root",
    });
    const head = createTask({
      id: "task-head",
      createdAt: 3_000,
      updatedAt: 3_050,
      parentTaskId: "task-middle",
    });

    expect(buildOpyAgentTaskLineage([root, middle, head], head).map((task) => task.id)).toEqual([
      "task-root",
      "task-middle",
      "task-head",
    ]);
  });

  it("selects the newest interrupted task for each lineage chain", () => {
    const reviewOlder = createTask({
      id: "review-older",
      status: "interrupted",
      createdAt: 1_000,
      updatedAt: 1_050,
    });
    const reviewNewer = createTask({
      id: "review-newer",
      status: "interrupted",
      createdAt: 2_000,
      updatedAt: 2_050,
    });
    const proposal = createTask({
      id: "proposal-1",
      request: {
        confirmation: null,
        id: "request-proposal",
        mode: "read",
        kind: "proposal",
        label: "PROPOSAL",
        requiresConfirmation: false,
        replay: {
          kind: "proposal",
          description: "Add a ledger service",
          sessionId: "session-1",
        },
      },
      lineageKey: "proposal:session-1:add a ledger service",
      status: "interrupted",
      createdAt: 3_000,
      updatedAt: 3_050,
    });

    expect(selectLatestOpyAgentTasksByLineage([reviewOlder, reviewNewer, proposal]).map((task) => task.id)).toEqual([
      "proposal-1",
      "review-newer",
    ]);
  });

  it("summarizes completed lineage boundaries across chained segments", () => {
    const root = createTask({
      id: "task-root",
      createdAt: 1_000,
      updatedAt: 1_050,
    });
    const head = createTask({
      id: "task-head",
      createdAt: 2_000,
      updatedAt: 2_050,
      parentTaskId: "task-root",
      status: "interrupted",
    });

    const summary = summarizeOpyAgentTaskLineage(
      [root, head],
      head,
      [
        {
          taskId: "task-root",
          name: "assemble_context",
          status: "completed",
        },
        {
          taskId: "task-root",
          name: "invoke_agent",
          status: "completed",
        },
        {
          taskId: "task-head",
          name: "persist_assistant_message",
          status: "running",
        },
      ],
      [
        {
          taskId: "task-root",
          kind: "context_bundle",
        },
        {
          taskId: "task-head",
          kind: "chat_response",
        },
      ],
    );

    expect(summary.segmentCount).toBe(2);
    expect(summary.inheritedSegmentCount).toBe(1);
    expect(summary.completedStepNames).toEqual(["assemble_context", "invoke_agent"]);
    expect(summary.artifactKinds).toEqual(["context_bundle", "chat_response"]);
  });
});
