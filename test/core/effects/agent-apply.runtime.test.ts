import {
  buildOpyCheckpointRecord,
  buildOpyCheckpointSnapshot,
  checkpointSnapshotToLoadedDiagram,
} from "@/core/effects/agent-apply.runtime";
import { describe, expect, it } from "vitest";

describe("agent-apply.runtime", () => {
  it("builds checkpoint snapshots and restorable diagram payloads", () => {
    const snapshot = buildOpyCheckpointSnapshot({
      diagramId: "diagram-1",
      diagramName: "Payments Context",
      diagramDescription: "Tracks payment orchestration",
      nodes: [{ id: "node-1", position: { x: 0, y: 0 }, data: {} }],
      edges: [{ id: "edge-1", source: "node-1", target: "node-2" }],
      savedAt: 1_234,
    });

    expect(snapshot.id).toBe("diagram-1");
    expect(snapshot.name).toBe("Payments Context");
    expect(snapshot.savedAt).toBe(1_234);

    const loadedDiagram = checkpointSnapshotToLoadedDiagram(snapshot);
    expect(loadedDiagram.id).toBe("diagram-1");
    expect(loadedDiagram.updatedAt).toBe(1_234);
    expect(loadedDiagram.description).toBe("Tracks payment orchestration");
  });

  it("builds checkpoint records tied to a proposal response", () => {
    const snapshot = buildOpyCheckpointSnapshot({
      diagramId: "diagram-1",
      diagramName: "Payments Context",
      diagramDescription: null,
      nodes: [],
      edges: [],
      savedAt: null,
    });

    const checkpoint = buildOpyCheckpointRecord({
      sessionId: "session-1",
      diagramId: "diagram-1",
      proposalRespondedAtMs: 2_000,
      snapshot,
      createdAt: 2_100,
    });

    expect(checkpoint.sessionId).toBe("session-1");
    expect(checkpoint.diagramId).toBe("diagram-1");
    expect(checkpoint.proposalRespondedAtMs).toBe(2_000);
    expect(checkpoint.checkpointType).toBe("pre-apply");
    expect(checkpoint.createdAt).toBe(2_100);
    expect(checkpoint.id.length).toBeGreaterThan(0);
  });
});
