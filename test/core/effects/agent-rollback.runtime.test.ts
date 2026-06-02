import { formatOpyRollbackSummary, selectLatestOpyAgentCheckpoint } from "@/core/effects/agent-rollback.runtime";
import type { OpyAgentCheckpoint } from "@/core/effects/opy-chat.persistence";
import { describe, expect, it } from "vitest";

const createCheckpoint = (
  overrides?: Partial<OpyAgentCheckpoint>,
): OpyAgentCheckpoint => ({
  id: "checkpoint-1",
  sessionId: "session-1",
  diagramId: "diagram-1",
  proposalRespondedAtMs: 2_000,
  checkpointType: "pre-apply",
  snapshot: {
    id: "diagram-1",
    name: "Payments Context",
    nodes: [{ id: "node-1", position: { x: 0, y: 0 }, data: {} }],
    edges: [{ id: "edge-1", source: "node-1", target: "node-2" }],
    savedAt: 1_900,
  },
  createdAt: 2_100,
  ...overrides,
});

describe("agent-rollback.runtime", () => {
  it("selects the latest checkpoint from a recency-ordered list", () => {
    const latest = createCheckpoint();
    const older = createCheckpoint({
      id: "checkpoint-older",
      createdAt: 1_500,
    });

    expect(selectLatestOpyAgentCheckpoint([latest, older])).toEqual(latest);
    expect(selectLatestOpyAgentCheckpoint([])).toBeNull();
  });

  it("formats rollback summary with checkpoint counts", () => {
    expect(formatOpyRollbackSummary(createCheckpoint())).toBe(
      "ROLLBACK READY:: CHECKPOINT checkpoi · 1 NODE(S) · 1 EDGE(S)",
    );
  });
});
