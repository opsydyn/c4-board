/**
 * Diagram Operations Tests
 *
 * Tests for diagram metadata management and validation.
 */

import type { Edge, Node } from "@xyflow/react";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import {
  createDiagramFromLoaded,
  createEmptyDiagram,
  type Diagram,
  type DiagramMetadata,
  getSelectedNodes,
  hasSelectedNodes,
  updateDiagramDescription,
  updateDiagramName,
  updateSessionName,
  validateDiagramName,
} from "./diagram-operations";

describe("updateDiagramName", () => {
  it("should update diagram name", () => {
    const metadata: DiagramMetadata = {
      id: "diagram-1",
      name: "Old Name",
      description: "Test diagram",
      sessionName: "session-1",
    };

    const effect = updateDiagramName(metadata, "New Name");
    const result = Effect.runSync(effect);

    expect(result.name).toBe("New Name");
    expect(result.id).toBe("diagram-1");
    expect(result.description).toBe("Test diagram");
    expect(result.sessionName).toBe("session-1");
  });

  it("should preserve other fields when updating name", () => {
    const metadata: DiagramMetadata = {
      id: null,
      name: "Original",
      description: null,
      sessionName: "",
    };

    const effect = updateDiagramName(metadata, "Updated");
    const result = Effect.runSync(effect);

    expect(result.name).toBe("Updated");
    expect(result.id).toBeNull();
    expect(result.description).toBeNull();
    expect(result.sessionName).toBe("");
  });
});

describe("updateDiagramDescription", () => {
  it("should update diagram description", () => {
    const metadata: DiagramMetadata = {
      id: "diagram-1",
      name: "Test Diagram",
      description: "Old description",
      sessionName: "",
    };

    const effect = updateDiagramDescription(metadata, "New description");
    const result = Effect.runSync(effect);

    expect(result.description).toBe("New description");
    expect(result.name).toBe("Test Diagram");
  });

  it("should allow setting description to null", () => {
    const metadata: DiagramMetadata = {
      id: "diagram-1",
      name: "Test Diagram",
      description: "Has description",
      sessionName: "",
    };

    const effect = updateDiagramDescription(metadata, null);
    const result = Effect.runSync(effect);

    expect(result.description).toBeNull();
  });
});

describe("updateSessionName", () => {
  it("should update session name", () => {
    const metadata: DiagramMetadata = {
      id: "diagram-1",
      name: "Test Diagram",
      description: null,
      sessionName: "old-session",
    };

    const effect = updateSessionName(metadata, "new-session");
    const result = Effect.runSync(effect);

    expect(result.sessionName).toBe("new-session");
    expect(result.name).toBe("Test Diagram");
  });

  it("should allow empty session name", () => {
    const metadata: DiagramMetadata = {
      id: "diagram-1",
      name: "Test Diagram",
      description: null,
      sessionName: "session-1",
    };

    const effect = updateSessionName(metadata, "");
    const result = Effect.runSync(effect);

    expect(result.sessionName).toBe("");
  });
});

describe("createEmptyDiagram", () => {
  it("should create diagram with name only", () => {
    const effect = createEmptyDiagram("My Diagram");
    const result = Effect.runSync(effect);

    expect(result.name).toBe("My Diagram");
    expect(result.id).toBeNull();
    expect(result.description).toBeNull();
    expect(result.sessionName).toBe("");
  });

  it("should create diagram with name and description", () => {
    const effect = createEmptyDiagram("My Diagram", "This is a test diagram");
    const result = Effect.runSync(effect);

    expect(result.name).toBe("My Diagram");
    expect(result.description).toBe("This is a test diagram");
    expect(result.id).toBeNull();
    expect(result.sessionName).toBe("");
  });

  it("should create diagram with null description", () => {
    const effect = createEmptyDiagram("My Diagram", null);
    const result = Effect.runSync(effect);

    expect(result.name).toBe("My Diagram");
    expect(result.description).toBeNull();
  });
});

describe("validateDiagramName", () => {
  it("should accept valid diagram name", () => {
    const effect = validateDiagramName("Valid Diagram");
    const result = Effect.runSync(effect);

    expect(result).toBe(true);
  });

  it("should accept diagram name with special characters", () => {
    const effect = validateDiagramName("C4 - System Architecture (v2.0)");
    const result = Effect.runSync(effect);

    expect(result).toBe(true);
  });

  it("should accept diagram name with only whitespace preserved", () => {
    const effect = validateDiagramName("  Diagram  ");
    const result = Effect.runSync(effect);

    expect(result).toBe(true);
  });

  it("should fail for empty string", async () => {
    const effect = validateDiagramName("");
    await expect(Effect.runPromise(effect)).rejects.toThrow("Diagram name cannot be empty");
  });

  it("should fail for whitespace-only string", async () => {
    const effect = validateDiagramName("   ");
    await expect(Effect.runPromise(effect)).rejects.toThrow("Diagram name cannot be empty");
  });

  it("should fail for null-like values", async () => {
    const effect = validateDiagramName("");
    await expect(Effect.runPromise(effect)).rejects.toThrow("Diagram name cannot be empty");
  });
});

describe("createDiagramFromLoaded", () => {
  it("should convert loaded diagram to metadata and state", () => {
    const mockNodes: Node[] = [
      {
        id: "node-1",
        type: "system",
        position: { x: 0, y: 0 },
        data: { label: "System A" },
      },
    ];

    const mockEdges: Edge[] = [
      {
        id: "edge-1",
        source: "node-1",
        target: "node-2",
        label: "uses",
      },
    ];

    const diagram: Diagram = {
      id: "diagram-123",
      name: "Loaded Diagram",
      description: "Test description",
      nodes: mockNodes,
      edges: mockEdges,
      updatedAt: 1234567890,
    };

    const effect = createDiagramFromLoaded(diagram);
    const result = Effect.runSync(effect);

    expect(result.metadata.id).toBe("diagram-123");
    expect(result.metadata.name).toBe("Loaded Diagram");
    expect(result.metadata.description).toBe("Test description");
    expect(result.metadata.sessionName).toBe("");
    expect(result.nodes).toEqual(mockNodes);
    expect(result.edges).toEqual(mockEdges);
    expect(result.lastSaved).toBe(1234567890);
  });

  it("should handle diagram with null description", () => {
    const diagram: Diagram = {
      id: "diagram-456",
      name: "Minimal Diagram",
      description: null,
      nodes: [],
      edges: [],
      updatedAt: 9876543210,
    };

    const effect = createDiagramFromLoaded(diagram);
    const result = Effect.runSync(effect);

    expect(result.metadata.description).toBeNull();
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });
});

describe("getSelectedNodes", () => {
  const mockNodes: Node[] = [
    {
      id: "node-1",
      type: "system",
      position: { x: 0, y: 0 },
      data: { label: "System A" },
      selected: true,
    },
    {
      id: "node-2",
      type: "system",
      position: { x: 100, y: 100 },
      data: { label: "System B" },
      selected: false,
    },
    {
      id: "node-3",
      type: "component",
      position: { x: 200, y: 200 },
      data: { label: "Component C" },
      selected: true,
    },
  ];

  it("should return IDs of selected nodes", () => {
    const effect = getSelectedNodes(mockNodes);
    const result = Effect.runSync(effect);

    expect(result).toEqual(["node-1", "node-3"]);
  });

  it("should return empty array when no nodes selected", () => {
    const unselectedNodes: Node[] = mockNodes.map((n) => ({ ...n, selected: false }));

    const effect = getSelectedNodes(unselectedNodes);
    const result = Effect.runSync(effect);

    expect(result).toEqual([]);
  });

  it("should return empty array for empty node list", () => {
    const effect = getSelectedNodes([]);
    const result = Effect.runSync(effect);

    expect(result).toEqual([]);
  });

  it("should handle nodes without selected property", () => {
    const nodesWithoutSelected: Node[] = [
      {
        id: "node-1",
        type: "system",
        position: { x: 0, y: 0 },
        data: { label: "System A" },
      },
    ];

    const effect = getSelectedNodes(nodesWithoutSelected);
    const result = Effect.runSync(effect);

    expect(result).toEqual([]);
  });
});

describe("hasSelectedNodes", () => {
  it("should return true when nodes are selected", () => {
    const mockNodes: Node[] = [
      {
        id: "node-1",
        type: "system",
        position: { x: 0, y: 0 },
        data: { label: "System A" },
        selected: true,
      },
      {
        id: "node-2",
        type: "system",
        position: { x: 100, y: 100 },
        data: { label: "System B" },
      },
    ];

    const effect = hasSelectedNodes(mockNodes);
    const result = Effect.runSync(effect);

    expect(result).toBe(true);
  });

  it("should return false when no nodes are selected", () => {
    const mockNodes: Node[] = [
      {
        id: "node-1",
        type: "system",
        position: { x: 0, y: 0 },
        data: { label: "System A" },
        selected: false,
      },
      {
        id: "node-2",
        type: "system",
        position: { x: 100, y: 100 },
        data: { label: "System B" },
      },
    ];

    const effect = hasSelectedNodes(mockNodes);
    const result = Effect.runSync(effect);

    expect(result).toBe(false);
  });

  it("should return false for empty node list", () => {
    const effect = hasSelectedNodes([]);
    const result = Effect.runSync(effect);

    expect(result).toBe(false);
  });
});
