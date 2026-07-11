/**
 * Canvas Machine Tests
 *
 * Tests the refactored canvas machine with Effect-TS services.
 * Verifies that the Functional Core / Imperative Shell pattern is working correctly.
 */

import type { Node } from "@xyflow/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createActor } from "xstate";
import { canvasMachine } from "./canvas.machine";

describe("Canvas Machine", () => {
  test("commits the exact accepted layout preview", () => {
    const actor = createActor(canvasMachine);
    actor.start();
    actor.send({ type: "ADD_SYSTEM" });
    const previousNodes = actor.getSnapshot().context.nodes as Node[];
    const nodes = previousNodes.map((node) => ({ ...node, position: { x: 420, y: 240 } }));
    const edges = [{ id: "preview-edge", source: nodes[0]!.id, target: nodes[0]!.id }];
    const audit = {
      version: 1 as const,
      appliedAt: 100,
      preset: "elkLayered",
      strategyId: "elk-layered",
      engine: "elk" as const,
      selectedVariant: "recommended" as const,
      comparisonMetrics: [],
    };

    actor.send({ type: "APPLY_LAYOUT_PREVIEW", preset: "elkLayered", nodes, edges, audit });

    expect(actor.getSnapshot().context.nodes).toEqual(nodes);
    expect(actor.getSnapshot().context.edges).toEqual(edges);
    expect(actor.getSnapshot().context.previousLayout).toEqual(previousNodes);
    expect(actor.getSnapshot().context.currentLayout).toBe("elkLayered");
    expect(actor.getSnapshot().context.lastLayoutAudit).toEqual(audit);
    expect(actor.getSnapshot().context.layoutAudits).toEqual([audit]);
  });

  test("loads newest-first layout history and prepends a newly accepted audit", () => {
    const actor = createActor(canvasMachine).start();
    const olderAudit = {
      version: 1 as const,
      appliedAt: 100,
      preset: "elkLayered",
      strategyId: "elk-layered",
      engine: "elk" as const,
      selectedVariant: "original" as const,
      comparisonMetrics: [],
    };
    const latestAudit = { ...olderAudit, appliedAt: 200, selectedVariant: "recommended" as const };

    actor.send({
      type: "LOAD_DIAGRAM_SUCCESS",
      diagram: {
        id: "diagram-1",
        name: "Audit history",
        nodes: [],
        edges: [],
        updatedAt: 200,
        layoutAudit: latestAudit,
        layoutAudits: [latestAudit, olderAudit],
      },
    });
    const acceptedAudit = { ...latestAudit, appliedAt: 300 };
    actor.send({
      type: "APPLY_LAYOUT_PREVIEW",
      preset: "elkLayered",
      nodes: [],
      edges: [],
      audit: acceptedAudit,
    });

    expect(actor.getSnapshot().context.layoutAudits).toEqual([
      acceptedAudit,
      latestAudit,
      olderAudit,
    ]);
  });

  test("bounds in-memory layout history to the retention limit", () => {
    const actor = createActor(canvasMachine).start();
    const audits = Array.from({ length: 100 }, (_, index) => ({
      version: 1 as const,
      appliedAt: 200 - index,
      preset: "elkLayered",
      strategyId: "elk-layered",
      engine: "elk" as const,
      selectedVariant: "single" as const,
      comparisonMetrics: [],
    }));
    actor.send({
      type: "LOAD_DIAGRAM_SUCCESS",
      diagram: {
        id: "diagram-retention",
        name: "Retention",
        nodes: [],
        edges: [],
        updatedAt: 200,
        layoutAudit: audits[0],
        layoutAudits: audits,
      },
    });
    const acceptedAudit = { ...audits[0]!, appliedAt: 300 };

    actor.send({
      type: "APPLY_LAYOUT_PREVIEW",
      preset: "elkLayered",
      nodes: [],
      edges: [],
      audit: acceptedAudit,
    });

    expect(actor.getSnapshot().context.layoutAudits).toHaveLength(100);
    expect(actor.getSnapshot().context.layoutAudits[0]).toEqual(acceptedAudit);
    expect(actor.getSnapshot().context.layoutAudits).not.toContainEqual(audits.at(-1));
  });

  test("loads a visual fixture without a persistent diagram identity", () => {
    const actor = createActor(canvasMachine).start();
    const nodes = [{ id: "fixture-node", position: { x: 0, y: 0 }, data: {} }];

    actor.send({
      type: "LOAD_VISUAL_FIXTURE",
      name: "VISUAL::EVENT DRIVEN",
      nodes,
      edges: [],
    });

    expect(actor.getSnapshot().context).toMatchObject({
      currentDiagramId: null,
      diagramName: "VISUAL::EVENT DRIVEN",
      nodes,
      edges: [],
      lastSaved: null,
    });
  });

  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Node Operations", () => {
    test("should add a person node", () => {
      // Arrange
      const actor = createActor(canvasMachine);
      actor.start();

      // Act
      actor.send({ type: "ADD_PERSON" });

      // Assert
      const snapshot = actor.getSnapshot();
      const node = snapshot.context.nodes[0]!;
      expect(snapshot.context.nodes).toHaveLength(1);
      expect(node.type).toBe("person");
      expect(node.data.label).toBe("New Person");
      expect(node.data.c4Type).toBe("person");
      expect(snapshot.context.nodeCounter).toBe(1);
    });

    test("should add a system node", () => {
      // Arrange
      const actor = createActor(canvasMachine);
      actor.start();

      // Act
      actor.send({ type: "ADD_SYSTEM" });

      // Assert
      const snapshot = actor.getSnapshot();
      const node = snapshot.context.nodes[0]!;
      expect(snapshot.context.nodes).toHaveLength(1);
      expect(node.type).toBe("system");
      expect(node.data.label).toBe("New System");
      expect(node.data.c4Type).toBe("system");
    });

    test("should add an external system node", () => {
      // Arrange
      const actor = createActor(canvasMachine);
      actor.start();

      // Act
      actor.send({ type: "ADD_EXTERNAL_SYSTEM" });

      // Assert
      const snapshot = actor.getSnapshot();
      const node = snapshot.context.nodes[0]!;
      expect(snapshot.context.nodes).toHaveLength(1);
      expect(node.type).toBe("externalSystem");
      expect(node.data.label).toBe("External System");
      expect(node.data.c4Type).toBe("externalSystem");
    });

    test("should add a container node with default size", () => {
      // Arrange
      const actor = createActor(canvasMachine);
      actor.start();

      // Act
      actor.send({ type: "ADD_CONTAINER" });

      // Assert
      const snapshot = actor.getSnapshot();
      const node = snapshot.context.nodes[0]!;
      expect(snapshot.context.nodes).toHaveLength(1);
      expect(node.type).toBe("container");
      expect(node.data.label).toBe("Container");
      expect(node.style).toEqual({
        width: 400,
        height: 300,
      });
    });

    test("should add a component node", () => {
      // Arrange
      const actor = createActor(canvasMachine);
      actor.start();

      // Act
      actor.send({ type: "ADD_COMPONENT" });

      // Assert
      const snapshot = actor.getSnapshot();
      const node = snapshot.context.nodes[0]!;
      expect(snapshot.context.nodes).toHaveLength(1);
      expect(node.type).toBe("component");
      expect(node.data.label).toBe("Component");
    });

    test("should add multiple nodes and increment counter", () => {
      // Arrange
      const actor = createActor(canvasMachine);
      actor.start();

      // Act
      actor.send({ type: "ADD_PERSON" });
      actor.send({ type: "ADD_SYSTEM" });
      actor.send({ type: "ADD_COMPONENT" });

      // Assert
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.nodes).toHaveLength(3);
      expect(snapshot.context.nodeCounter).toBe(3);
      // Check ID prefixes (IDs use nanoid for uniqueness)
      expect(snapshot.context.nodes[0]!.id).toMatch(/^person-/);
      expect(snapshot.context.nodes[1]!.id).toMatch(/^system-/);
      expect(snapshot.context.nodes[2]!.id).toMatch(/^component-/);
    });

    test("should add child node inside selected container", () => {
      // Arrange
      const actor = createActor(canvasMachine);
      actor.start();

      // Act
      actor.send({ type: "ADD_CONTAINER" }); // Add container
      const containerId = actor.getSnapshot().context.nodes[0]!.id;
      actor.send({ type: "SELECT_NODE", nodeId: containerId }); // Select container
      actor.send({ type: "ADD_COMPONENT" }); // Add component inside

      // Assert
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.nodes).toHaveLength(2);
      const component = snapshot.context.nodes[1]!;
      expect(component.parentId).toBe(containerId);
      expect(component.extent).toBe("parent");
      expect(component.expandParent).toBe(true);
      expect(component.position).toEqual({ x: 20, y: 60 }); // Child position
    });

    test("should update node data", () => {
      // Arrange
      const actor = createActor(canvasMachine);
      actor.start();
      actor.send({ type: "ADD_PERSON" });
      const nodeId = actor.getSnapshot().context.nodes[0]!.id;

      // Act
      actor.send({
        type: "UPDATE_NODE",
        nodeId,
        updates: {
          label: "Updated Person",
          description: "A new description",
          technology: "TypeScript",
        },
      });

      // Assert
      const snapshot = actor.getSnapshot();
      const node = snapshot.context.nodes[0]!;
      expect(node.data.label).toBe("Updated Person");
      expect(node.data.description).toBe("A new description");
      expect(node.data.technology).toBe("TypeScript");
    });

    test("should delete node and connected edges", () => {
      // Arrange
      const actor = createActor(canvasMachine);
      actor.start();
      actor.send({ type: "ADD_PERSON" });
      actor.send({ type: "ADD_SYSTEM" });
      const personId = actor.getSnapshot().context.nodes[0]!.id;
      const systemId = actor.getSnapshot().context.nodes[1]!.id;
      actor.send({ type: "CONNECT_NODES", source: personId, target: systemId });

      // Act
      actor.send({ type: "DELETE_NODE", nodeId: personId });

      // Assert
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.nodes).toHaveLength(1);
      expect(snapshot.context.nodes[0]!.id).toBe(systemId);
      expect(snapshot.context.edges).toHaveLength(0); // Edge should be removed
    });

    test("should deselect node when deleted", () => {
      // Arrange
      const actor = createActor(canvasMachine);
      actor.start();
      actor.send({ type: "ADD_PERSON" });
      const nodeId = actor.getSnapshot().context.nodes[0]!.id;
      actor.send({ type: "SELECT_NODE", nodeId });

      // Act
      actor.send({ type: "DELETE_NODE", nodeId });

      // Assert
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.selectedNodeId).toBeNull();
    });
  });

  describe("Edge Operations", () => {
    test("should connect two nodes", () => {
      // Arrange
      const actor = createActor(canvasMachine);
      actor.start();
      actor.send({ type: "ADD_PERSON" });
      actor.send({ type: "ADD_SYSTEM" });
      const personId = actor.getSnapshot().context.nodes[0]!.id;
      const systemId = actor.getSnapshot().context.nodes[1]!.id;

      // Act
      actor.send({ type: "CONNECT_NODES", source: personId, target: systemId });

      // Assert
      const snapshot = actor.getSnapshot();
      const edge = snapshot.context.edges[0]!;
      expect(snapshot.context.edges).toHaveLength(1);
      expect(edge.source).toBe(personId);
      expect(edge.target).toBe(systemId);
      expect(edge.label).toBe("uses");
    });

    test("should prevent self-connection", () => {
      // Arrange
      const actor = createActor(canvasMachine);
      actor.start();
      actor.send({ type: "ADD_PERSON" });
      const nodeId = actor.getSnapshot().context.nodes[0]!.id;

      // Act
      actor.send({ type: "CONNECT_NODES", source: nodeId, target: nodeId });

      // Assert
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.edges).toHaveLength(0); // No edge created
    });

    test("should prevent duplicate edges (same direction)", () => {
      // Arrange
      const actor = createActor(canvasMachine);
      actor.start();
      actor.send({ type: "ADD_PERSON" });
      actor.send({ type: "ADD_SYSTEM" });
      const personId = actor.getSnapshot().context.nodes[0]!.id;
      const systemId = actor.getSnapshot().context.nodes[1]!.id;
      actor.send({ type: "CONNECT_NODES", source: personId, target: systemId });

      // Act - Try to create duplicate
      actor.send({ type: "CONNECT_NODES", source: personId, target: systemId });

      // Assert
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.edges).toHaveLength(1); // Only one edge
    });

    test("should prevent duplicate edges (opposite direction)", () => {
      // Arrange
      const actor = createActor(canvasMachine);
      actor.start();
      actor.send({ type: "ADD_PERSON" });
      actor.send({ type: "ADD_SYSTEM" });
      const personId = actor.getSnapshot().context.nodes[0]!.id;
      const systemId = actor.getSnapshot().context.nodes[1]!.id;
      actor.send({ type: "CONNECT_NODES", source: personId, target: systemId });

      // Act - Try to create reverse edge
      actor.send({ type: "CONNECT_NODES", source: systemId, target: personId });

      // Assert
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.edges).toHaveLength(1); // Only one edge (bidirectional check)
    });
  });

  describe("Selection Operations", () => {
    test("should select a node", () => {
      // Arrange
      const actor = createActor(canvasMachine);
      actor.start();
      actor.send({ type: "ADD_PERSON" });
      const nodeId = actor.getSnapshot().context.nodes[0]!.id;

      // Act
      actor.send({ type: "SELECT_NODE", nodeId });

      // Assert
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.selectedNodeId).toBe(nodeId);
    });

    test("should deselect a node", () => {
      // Arrange
      const actor = createActor(canvasMachine);
      actor.start();
      actor.send({ type: "ADD_PERSON" });
      const nodeId = actor.getSnapshot().context.nodes[0]!.id;
      actor.send({ type: "SELECT_NODE", nodeId });

      // Act
      actor.send({ type: "DESELECT_NODE" });

      // Assert
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.selectedNodeId).toBeNull();
    });
  });

  describe("Diagram Metadata", () => {
    test("should update diagram name", () => {
      // Arrange
      const actor = createActor(canvasMachine);
      actor.start();

      // Act
      actor.send({ type: "UPDATE_DIAGRAM_NAME", name: "My C4 Diagram" });

      // Assert
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.diagramName).toBe("My C4 Diagram");
    });

    test("should update diagram description", () => {
      // Arrange
      const actor = createActor(canvasMachine);
      actor.start();

      // Act
      actor.send({
        type: "UPDATE_DIAGRAM_DESCRIPTION",
        description: "A test description",
      });

      // Assert
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.diagramDescription).toBe("A test description");
    });

    test("should update session name", () => {
      // Arrange
      const actor = createActor(canvasMachine);
      actor.start();

      // Act
      actor.send({ type: "UPDATE_SESSION_NAME", name: "Test Session" });

      // Assert
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.sessionName).toBe("Test Session");
    });

    test("should reset selection and refresh node counter on load success", () => {
      // Arrange
      const actor = createActor(canvasMachine);
      actor.start();
      actor.send({ type: "ADD_PERSON" });
      const selectedNodeId = actor.getSnapshot().context.nodes[0]!.id;
      actor.send({ type: "SELECT_NODE", nodeId: selectedNodeId });

      // Act
      actor.send({
        type: "LOAD_DIAGRAM_SUCCESS",
        diagram: {
          id: "diagram-1",
          name: "Loaded Diagram",
          nodes: [
            {
              id: "system-1",
              type: "system",
              position: { x: 0, y: 0 },
              data: {
                label: "Payments API",
                description: "",
                technology: "",
                c4Type: "system",
              },
            },
            {
              id: "container-1",
              type: "container",
              position: { x: 240, y: 0 },
              data: {
                label: "Checkout UI",
                description: "",
                technology: "",
                c4Type: "container",
              },
            },
          ],
          edges: [],
          updatedAt: 123,
        },
      });

      // Assert
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.selectedNodeId).toBeNull();
      expect(snapshot.context.nodeCounter).toBe(2);
      expect(snapshot.context.diagramName).toBe("Loaded Diagram");
    });
  });

  describe("State Transitions", () => {
    test("should start in idle state", () => {
      // Arrange
      const actor = createActor(canvasMachine);

      // Act
      actor.start();

      // Assert
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("idle");
    });

    test("should transition to saving state", () => {
      // Arrange
      const actor = createActor(canvasMachine);
      actor.start();

      // Act
      actor.send({ type: "SAVE_DIAGRAM" });

      // Assert
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("saving");
      expect(snapshot.context.isSaving).toBe(true);
    });

    test("should return to idle after save success", () => {
      // Arrange
      const actor = createActor(canvasMachine);
      actor.start();
      actor.send({ type: "SAVE_DIAGRAM" });

      // Act
      actor.send({ type: "SAVE_SUCCESS" });

      // Assert
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("idle");
      expect(snapshot.context.isSaving).toBe(false);
      expect(snapshot.context.lastSaved).toBeGreaterThan(0);
    });

    test("should accept save success while already idle", () => {
      // Arrange
      const actor = createActor(canvasMachine);
      actor.start();
      actor.send({ type: "SAVE_ERROR", error: "Save timeout" });

      // Act
      actor.send({ type: "SAVE_SUCCESS" });

      // Assert
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("idle");
      expect(snapshot.context.isSaving).toBe(false);
      expect(snapshot.context.lastSaved).toBeGreaterThan(0);
      expect(snapshot.context.saveError).toBeNull();
    });

    test("should return to idle after save error", () => {
      // Arrange
      const actor = createActor(canvasMachine);
      actor.start();
      actor.send({ type: "SAVE_DIAGRAM" });

      // Act
      actor.send({ type: "SAVE_ERROR", error: "Test error" });

      // Assert
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("idle");
      expect(snapshot.context.isSaving).toBe(false);
      expect(snapshot.context.saveError).toBe("Test error");
    });

    test("should allow node operations while saving", () => {
      // Arrange
      const actor = createActor(canvasMachine);
      actor.start();
      actor.send({ type: "SAVE_DIAGRAM" });

      // Act
      actor.send({ type: "ADD_PERSON" });

      // Assert
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("saving");
      expect(snapshot.context.nodes).toHaveLength(1); // Node was added
    });
  });

  describe("Initial State", () => {
    test("should have correct initial context", () => {
      // Arrange
      const actor = createActor(canvasMachine);

      // Act
      actor.start();

      // Assert
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.nodes).toEqual([]);
      expect(snapshot.context.edges).toEqual([]);
      expect(snapshot.context.selectedNodeId).toBeNull();
      expect(snapshot.context.nodeCounter).toBe(0);
      expect(snapshot.context.currentDiagramId).toBeNull();
      expect(snapshot.context.diagramName).toBe("DIAGRAM::UNTITLED");
      expect(snapshot.context.diagramDescription).toBeNull();
      expect(snapshot.context.sessionName).toBe("");
      expect(snapshot.context.isSaving).toBe(false);
      expect(snapshot.context.lastSaved).toBeNull();
      expect(snapshot.context.saveError).toBeNull();
    });
  });
});
