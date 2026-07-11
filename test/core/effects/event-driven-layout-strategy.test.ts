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

  it("stacks bridge processors sharing the same bus pair", () => {
    const nodes = [
      node("orders", "publisher"),
      node("orders-bus", "event-bus"),
      { ...node("alpha-bridge", "processor"), style: { width: 160, height: 140 } },
      { ...node("zeta-bridge", "processor"), style: { width: 180, height: 220 } },
      node("risk-bus", "event-bus"),
      node("review", "subscriber"),
    ];
    const edges = [
      edge("orders", "orders-bus", "order event"),
      edge("orders-bus", "alpha-bridge", "order event"),
      edge("alpha-bridge", "risk-bus", "risk event"),
      edge("orders-bus", "zeta-bridge", "order event"),
      edge("zeta-bridge", "risk-bus", "risk event"),
      edge("risk-bus", "review", "risk event"),
    ];
    const result = eventDrivenLayoutStrategy.layout({ nodes, edges });
    const byId = new Map(result.nodes.map((value) => [value.id, center(value)]));

    expect(byId.get("alpha-bridge")!.y).toBeLessThan(byId.get("zeta-bridge")!.y);
    expect(byId.get("alpha-bridge")!.y).not.toBe(byId.get("zeta-bridge")!.y);
    expect(result.quality.nodeOverlapCount).toBe(0);
  });

  it("separates a local processor from an adjacent bridge corridor", () => {
    const nodes = [
      node("orders", "publisher"),
      node("orders-bus", "event-bus"),
      { ...node("local-processor", "processor"), style: { width: 180, height: 400 } },
      { ...node("bridge-processor", "processor"), style: { width: 160, height: 400 } },
      node("risk-bus", "event-bus"),
      node("review", "subscriber"),
    ];
    const edges = [
      edge("orders", "orders-bus", "order event"),
      edge("orders-bus", "local-processor", "local event"),
      edge("orders-bus", "bridge-processor", "order event"),
      edge("bridge-processor", "risk-bus", "risk event"),
      edge("risk-bus", "review", "risk event"),
    ];
    const result = eventDrivenLayoutStrategy.layout({ nodes, edges });
    const byId = new Map(result.nodes.map((value) => [value.id, center(value)]));

    expect(byId.get("orders-bus")!.y).toBeLessThan(byId.get("bridge-processor")!.y);
    expect(byId.get("bridge-processor")!.y).toBeLessThan(byId.get("risk-bus")!.y);
    expect(result.quality.nodeOverlapCount).toBe(0);
  });

  it("places single-band flow orphans in the review lane", () => {
    const graph = singleBusGraph();
    graph.nodes.push(
      node("orphan-publisher", "publisher"),
      node("orphan-processor", "processor"),
      node("orphan-subscriber", "subscriber"),
    );
    const result = eventDrivenLayoutStrategy.layout(graph);
    const byId = new Map(result.nodes.map((value) => [value.id, center(value)]));
    const telemetryY = byId.get("telemetry")!.y;

    expect(byId.get("orphan-publisher")!.y).toBeGreaterThan(telemetryY);
    expect(byId.get("orphan-processor")!.y).toBeGreaterThan(telemetryY);
    expect(byId.get("orphan-subscriber")!.y).toBeGreaterThan(telemetryY);
    expect(result.diagnostics.find(({ code }) => code === "event-driven-orphan-role"))
      .toMatchObject({
        severity: "warning",
        nodeIds: ["audit", "orphan-processor", "orphan-publisher", "orphan-subscriber"],
      });
    expect(result.quality.nodeOverlapCount).toBe(0);
  });

  it("keeps measured publisher peers separate after grid snapping", () => {
    const nodes = [
      { ...node("alpha-publisher", "publisher"), style: { width: 160, height: 101 } },
      { ...node("beta-publisher", "publisher"), style: { width: 160, height: 101 } },
      node("orders-bus", "event-bus"),
    ];
    const edges = [
      edge("alpha-publisher", "orders-bus", "order event"),
      edge("beta-publisher", "orders-bus", "order event"),
    ];
    const result = eventDrivenLayoutStrategy.layout({
      nodes,
      edges,
      options: { nodeSpacing: 1, snapToGrid: true, gridSize: 20 },
    });

    expect(result.nodes.every(({ position }) => position.x % 20 === 0 && position.y % 20 === 0)).toBe(true);
    expect(result.quality.nodeOverlapCount).toBe(0);
  });

  it("separates a non-adjacent bridge from an intervening local processor", () => {
    const graph = {
      nodes: [
        node("a-bus", "event-bus"),
        node("b-bus", "event-bus"),
        node("c-bus", "event-bus"),
        { ...node("a-c-bridge", "processor"), style: { width: 220, height: 180 } },
        { ...node("b-local", "processor"), style: { width: 200, height: 160 } },
        { ...node("c-subscriber", "subscriber"), style: { width: 180, height: 160 } },
      ],
      edges: [
        edge("a-bus", "a-c-bridge", "cross-band event"),
        edge("a-c-bridge", "c-bus", "cross-band event"),
        edge("b-bus", "b-local", "local event"),
        edge("c-bus", "c-subscriber", "subscriber event"),
      ],
    };
    const forward = eventDrivenLayoutStrategy.layout(graph);
    const reversed = eventDrivenLayoutStrategy.layout({
      nodes: [...graph.nodes].reverse(),
      edges: [...graph.edges].reverse(),
    });
    const byId = new Map(forward.nodes.map((value) => [value.id, center(value)]));
    const forwardById = new Map(forward.nodes.map((value) => [value.id, value]));

    expect(byId.get("a-bus")!.y).toBeLessThan(byId.get("a-c-bridge")!.y);
    expect(byId.get("a-c-bridge")!.y).toBeLessThan(byId.get("c-bus")!.y);
    expect(forwardById.get("a-c-bridge")!.position).not.toEqual(forwardById.get("b-local")!.position);
    expect(byId.get("a-c-bridge")!.x).toBeLessThan(byId.get("c-subscriber")!.x);
    expect(forward.quality.nodeOverlapCount).toBe(0);
    expect(positions(reversed.nodes)).toEqual(positions(forward.nodes));
    expect(reversed.diagnostics).toEqual(forward.diagnostics);
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
