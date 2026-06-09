import {
  buildOpyCheckpointRestorePreview,
  formatOpyRollbackSummary,
  selectLatestOpyAgentCheckpoint,
} from "@/core/effects/agent-rollback.runtime";
import type { RigC4BoardSummary } from "@/core/effects/agent-tools/contracts";
import type { OpyAgentCheckpoint } from "@/core/effects/opy-chat.persistence";
import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";

const createCheckpointNode = (
  id: string,
  overrides?: Partial<Node>,
): Node => ({
  id,
  type: "component",
  position: { x: 0, y: 0 },
  data: {
    label: id,
    description: "",
    technology: "",
    c4Type: "component",
    teamOwnership: "",
  },
  ...overrides,
});

const createCheckpointEdge = (
  id: string,
  source: string,
  target: string,
  overrides?: Partial<Edge>,
): Edge => ({
  id,
  source,
  target,
  ...overrides,
});

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
    nodes: [createCheckpointNode("node-1")],
    edges: [createCheckpointEdge("edge-1", "node-1", "node-2")],
    savedAt: 1_900,
  },
  createdAt: 2_100,
  ...overrides,
});

const createBoardSummary = (overrides?: Partial<RigC4BoardSummary>): RigC4BoardSummary => ({
  diagramId: "diagram-1",
  diagramName: "Payments Context",
  nodeCount: 1,
  edgeCount: 1,
  nodes: [{
    id: "node-1",
    label: "node-1",
    nodeType: "component",
    description: null,
    technology: null,
    teamOwnership: null,
  }],
  edges: [{
    id: "edge-1",
    sourceId: "node-1",
    targetId: "node-2",
    sourceLabel: "node-1",
    targetLabel: "node-2",
    label: null,
  }],
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

  it("builds a restore preview with restore, revert, and remove impacts", () => {
    const checkpoint = createCheckpoint({
      snapshot: {
        id: "diagram-1",
        name: "Payments Context",
        nodes: [
          createCheckpointNode("node-1", {
            data: {
              label: "Payments API",
              description: "Checkpoint description",
              technology: "Rust",
              c4Type: "component",
              teamOwnership: "platform",
            },
          }),
          createCheckpointNode("node-3", {
            type: "container",
            data: {
              label: "Checkout UI",
              description: "",
              technology: "Astro",
              c4Type: "container",
              teamOwnership: "web",
            },
          }),
        ],
        edges: [
          createCheckpointEdge("edge-1", "node-1", "node-3", { label: "serves" }),
          createCheckpointEdge("edge-3", "node-3", "node-1", { label: "calls" }),
        ],
        savedAt: 1_900,
      },
    });
    const currentBoard = createBoardSummary({
      nodeCount: 2,
      edgeCount: 2,
      nodes: [
        {
          id: "node-1",
          label: "Payments API",
          nodeType: "component",
          description: "Current description",
          technology: "Rust",
          teamOwnership: "platform",
        },
        {
          id: "node-2",
          label: "Ledger",
          nodeType: "system",
          description: null,
          technology: null,
          teamOwnership: null,
        },
      ],
      edges: [
        {
          id: "edge-1",
          sourceId: "node-1",
          targetId: "node-2",
          sourceLabel: "Payments API",
          targetLabel: "Ledger",
          label: "writes to",
        },
        {
          id: "edge-2",
          sourceId: "node-2",
          targetId: "node-1",
          sourceLabel: "Ledger",
          targetLabel: "Payments API",
          label: null,
        },
      ],
    });

    const preview = buildOpyCheckpointRestorePreview(checkpoint, currentBoard);

    expect(preview).not.toBeNull();
    expect(preview?.counts).toEqual({
      restoreNodes: 1,
      revertNodes: 1,
      removeNodes: 1,
      restoreEdges: 1,
      revertEdges: 1,
      removeEdges: 1,
    });
    expect(preview?.hasChanges).toBe(true);
    expect(preview?.impactedEntities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "node",
          status: "restore",
          title: "CONTAINER Checkout UI",
        }),
        expect.objectContaining({
          category: "node",
          status: "revert",
          detail: "Revert node fields: DESCRIPTION.",
        }),
        expect.objectContaining({
          category: "node",
          status: "remove",
          title: "SYSTEM Ledger",
        }),
        expect.objectContaining({
          category: "edge",
          status: "restore",
          title: "Checkout UI -> Payments API (calls)",
        }),
        expect.objectContaining({
          category: "edge",
          status: "revert",
          detail: "Revert relationship fields: TARGET | LABEL.",
        }),
        expect.objectContaining({
          category: "edge",
          status: "remove",
          title: "Ledger -> Payments API",
        }),
      ]),
    );
  });

  it("builds a no-op restore preview when the checkpoint already matches the current board", () => {
    const currentBoard = createBoardSummary();

    const preview = buildOpyCheckpointRestorePreview(createCheckpoint(), currentBoard);

    expect(preview).not.toBeNull();
    expect(preview?.hasChanges).toBe(false);
    expect(preview?.impactedEntities).toEqual([]);
    expect(preview?.counts).toEqual({
      restoreNodes: 0,
      revertNodes: 0,
      removeNodes: 0,
      restoreEdges: 0,
      revertEdges: 0,
      removeEdges: 0,
    });
  });

  it("returns null when the current board summary is unavailable", () => {
    expect(buildOpyCheckpointRestorePreview(createCheckpoint(), null)).toBeNull();
  });
});
