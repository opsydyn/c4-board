import { eventDrivenLayoutStrategy } from "@/core/effects/event-driven-layout-strategy";
import { getNodeDimensions } from "@/core/effects/layout-node-size";
import type { Edge, Node, XYPosition } from "@xyflow/react";
import { describe, expect, it } from "vitest";

const node = (id: string, layoutRole: string): Node => ({
  id,
  type: "component",
  position: { x: 0, y: 0 },
  style: { width: 160, height: 100 },
  data: { label: id, layoutRole },
});

const edge = (source: string, target: string, label: string): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
  label,
});

const center = (value: Node): XYPosition => {
  const dimensions = getNodeDimensions(value);
  return {
    x: value.position.x + dimensions.width / 2,
    y: value.position.y + dimensions.height / 2,
  };
};

const positions = (nodes: Node[]) =>
  Object.fromEntries(
    [...nodes].sort((left, right) => left.id.localeCompare(right.id))
      .map((value) => [value.id, value.position]),
  );

const singleBusGraph = () => ({
  nodes: [
    node("orders", "publisher"),
    node("orders-bus", "event-bus"),
    node("fraud", "processor"),
    node("audit", "subscriber"),
    node("telemetry", "infrastructure"),
    node("unknown", "unclassified"),
  ],
  edges: [
    edge("orders", "orders-bus", "order event"),
    edge("orders-bus", "fraud", "order event"),
    edge("fraud", "audit", "audit event"),
  ],
});

describe("Event-Driven layout strategy", () => {
  it("places one event flow in semantic columns and support lanes", () => {
    const graph = singleBusGraph();
    const result = eventDrivenLayoutStrategy.layout(graph);
    const byId = new Map(result.nodes.map((value) => [value.id, center(value)]));

    expect(result).toMatchObject({ strategyId: "event-driven", engine: "custom" });
    expect(byId.get("orders")!.x).toBeLessThan(byId.get("orders-bus")!.x);
    expect(byId.get("orders-bus")!.x).toBeLessThan(byId.get("fraud")!.x);
    expect(byId.get("fraud")!.x).toBeLessThan(byId.get("audit")!.x);
    expect(byId.get("telemetry")!.y).toBeGreaterThan(byId.get("orders-bus")!.y);
    expect(byId.get("unknown")!.y).toBeGreaterThan(byId.get("telemetry")!.y);
    expect(result.semanticRoles?.map(({ nodeId, role }) => ({ nodeId, role }))).toEqual([
      { nodeId: "audit", role: "subscriber" },
      { nodeId: "fraud", role: "processor" },
      { nodeId: "orders", role: "publisher" },
      { nodeId: "orders-bus", role: "event-bus" },
      { nodeId: "telemetry", role: "infrastructure" },
      { nodeId: "unknown", role: "unclassified" },
    ]);
    expect(result.quality.nodeOverlapCount).toBe(0);
  });

  it("stacks bus bands and bridges a one-source one-destination processor", () => {
    const nodes = [
      node("orders", "publisher"),
      node("orders-bus", "event-bus"),
      node("fraud", "processor"),
      node("risk-bus", "event-bus"),
      node("review", "subscriber"),
    ];
    const edges = [
      edge("orders", "orders-bus", "order event"),
      edge("orders-bus", "fraud", "order event"),
      edge("fraud", "risk-bus", "risk event"),
      edge("risk-bus", "review", "risk event"),
    ];
    const result = eventDrivenLayoutStrategy.layout({ nodes, edges });
    const byId = new Map(result.nodes.map((value) => [value.id, center(value)]));

    expect(byId.get("orders-bus")!.y).toBeLessThan(byId.get("risk-bus")!.y);
    expect(byId.get("fraud")!.y).toBeGreaterThan(byId.get("orders-bus")!.y);
    expect(byId.get("fraud")!.y).toBeLessThan(byId.get("risk-bus")!.y);
    expect(result.diagnostics.map(({ code }) => code)).toContain("event-driven-multiple-bands");
    expect(result.quality.nodeOverlapCount).toBe(0);
  });

  it("keeps an ambiguous processor in its primary source band", () => {
    const graph = singleBusGraph();
    graph.nodes.push(node("secondary-bus", "event-bus"));
    graph.edges.push(
      edge("secondary-bus", "fraud", "secondary event"),
      edge("fraud", "secondary-bus", "continued event"),
    );
    const result = eventDrivenLayoutStrategy.layout(graph);

    expect(result.diagnostics.find(({ code }) => code === "event-driven-ambiguous-processor"))
      .toMatchObject({ severity: "warning", nodeIds: ["fraud"] });
    expect(result.quality.nodeOverlapCount).toBe(0);
  });

  it("is deterministic while preserving hierarchy and measured geometry", () => {
    const graph = singleBusGraph();
    const orders = graph.nodes.find(({ id }) => id === "orders")!;
    const fraud = graph.nodes.find(({ id }) => id === "fraud")!;
    orders.style = { width: 240, height: 140 };
    fraud.style = { width: 180, height: 160 };
    graph.nodes.push({
      ...node("orders-child", "unclassified"),
      parentId: "orders",
      position: { x: 25, y: 35 },
      style: { width: 80, height: 60 },
    });
    graph.edges.push(edge("orders-child", "audit", "hierarchy event"));

    const forward = eventDrivenLayoutStrategy.layout(graph);
    const reversed = eventDrivenLayoutStrategy.layout({
      nodes: [...graph.nodes].reverse(),
      edges: [...graph.edges].reverse(),
    });
    const topLevelNodes = forward.nodes.filter((value) => !value.parentId);

    expect(positions(reversed.nodes)).toEqual(positions(forward.nodes));
    expect(reversed.diagnostics).toEqual(forward.diagnostics);
    expect(forward.nodes.find(({ id }) => id === "orders-child")!.position).toEqual({ x: 25, y: 35 });
    expect(forward.diagnostics.map(({ code }) => code)).toContain("event-driven-hierarchy-edges-excluded");
    expect(topLevelNodes.every(({ position }) => position.x > 0 && position.y > 0)).toBe(true);
    expect(topLevelNodes.every(({ position }) => position.x % 20 === 0 && position.y % 20 === 0)).toBe(true);
    expect(forward.quality.nodeOverlapCount).toBe(0);
  });

  it("scores a confident graph with a bus higher than the same graph without one", () => {
    const graph = singleBusGraph();
    const withoutBus = {
      nodes: graph.nodes.filter(({ id }) => id !== "orders-bus"),
      edges: graph.edges.filter(({ source, target }) => source !== "orders-bus" && target !== "orders-bus"),
    };

    expect(eventDrivenLayoutStrategy.analyse(graph).score)
      .toBeGreaterThan(eventDrivenLayoutStrategy.analyse(withoutBus).score);
  });
});
