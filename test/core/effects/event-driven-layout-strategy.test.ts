import { dagreLayoutStrategy } from "@/core/effects/dagre-layout-strategy";
import { eventDrivenLayoutStrategy } from "@/core/effects/event-driven-layout-strategy";
import { calculateLayout, getPreset } from "@/core/effects/layout";
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
  it("routes the Event-Driven preset to custom semantic geometry", () => {
    const graph = singleBusGraph();
    const options = getPreset("eventDriven");
    const result = calculateLayout(graph.nodes, graph.edges, options);
    const baseline = dagreLayoutStrategy.layout({ ...graph, options });

    expect(options.strategyId).toBe("event-driven");
    expect(result).toMatchObject({ strategyId: "event-driven", engine: "custom" });
    expect(result.nodes.map(({ position }) => position)).not.toEqual(
      baseline.nodes.map(({ position }) => position),
    );
    expect(result.diagnostics.map(({ code }) => code)).not.toContain("layout-strategy-fallback");
  });

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

  it("reserves grid cells for mixed-height bands, support, and review lanes", () => {
    const graph = {
      nodes: [
        { ...node("a-bus", "event-bus"), style: { width: 160, height: 39 } },
        { ...node("b-bus", "event-bus"), style: { width: 160, height: 21 } },
        { ...node("support", "infrastructure"), style: { width: 1, height: 1 } },
        { ...node("review", "unclassified"), style: { width: 1, height: 1 } },
      ],
      edges: [],
      options: { nodeSpacing: 0, rankSpacing: 0, snapToGrid: true, gridSize: 20 },
    };
    const forward = eventDrivenLayoutStrategy.layout(graph);
    const reversed = eventDrivenLayoutStrategy.layout({
      nodes: [...graph.nodes].reverse(),
      edges: [...graph.edges].reverse(),
      options: graph.options,
    });

    expect(forward.quality.nodeOverlapCount).toBe(0);
    expect(forward.quality.nodeOverlapArea).toBe(0);
    expect(forward.nodes.every(({ position }) => position.x % 20 === 0 && position.y % 20 === 0)).toBe(true);
    expect(positions(reversed.nodes)).toEqual(positions(forward.nodes));
  });

  it("places a tiny local processor and adjacent bridge processor in distinct grid cells", () => {
    const graph = {
      nodes: [
        { ...node("publisher", "publisher"), style: { width: 1, height: 1 } },
        { ...node("orders-bus", "event-bus"), style: { width: 1, height: 1 } },
        { ...node("local-processor", "processor"), style: { width: 1, height: 1 } },
        { ...node("bridge-processor", "processor"), style: { width: 1, height: 1 } },
        { ...node("risk-bus", "event-bus"), style: { width: 1, height: 1 } },
        { ...node("subscriber", "subscriber"), style: { width: 1, height: 1 } },
      ],
      edges: [
        edge("publisher", "orders-bus", "event"),
        edge("orders-bus", "local-processor", "event"),
        edge("orders-bus", "bridge-processor", "event"),
        edge("bridge-processor", "risk-bus", "event"),
        edge("risk-bus", "subscriber", "event"),
      ],
      options: { nodeSpacing: 0, rankSpacing: 0, snapToGrid: true, gridSize: 20 },
    };
    const result = eventDrivenLayoutStrategy.layout(graph);
    const byId = new Map(result.nodes.map((value) => [value.id, value]));

    expect(byId.get("local-processor")!.position).not.toEqual(byId.get("bridge-processor")!.position);
    expect(result.quality.nodeOverlapCount).toBe(0);
    expect(result.nodes.every(({ position }) => position.x % 20 === 0 && position.y % 20 === 0)).toBe(true);
  });

  it("normalizes reserved cells with a non-default grid size", () => {
    const result = eventDrivenLayoutStrategy.layout({
      nodes: [
        { ...node("a-bus", "event-bus"), style: { width: 31, height: 31 } },
        { ...node("b-bus", "event-bus"), style: { width: 16, height: 16 } },
        { ...node("support", "infrastructure"), style: { width: 1, height: 1 } },
        { ...node("review", "unclassified"), style: { width: 1, height: 1 } },
      ],
      edges: [],
      options: { nodeSpacing: 0, rankSpacing: 0, snapToGrid: true, gridSize: 15 },
    });

    expect(result.quality.nodeOverlapCount).toBe(0);
    expect(result.nodes.every(({ position }) => position.x % 15 === 0 && position.y % 15 === 0)).toBe(true);
    expect(Math.min(...result.nodes.map(({ position }) => position.x))).toBeGreaterThanOrEqual(40);
    expect(Math.min(...result.nodes.map(({ position }) => position.y))).toBeGreaterThanOrEqual(40);
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

  it("places measured support and review stacks in separate lanes", () => {
    const graph = {
      nodes: [
        node("orders-bus", "event-bus"),
        { ...node("audit-log", "infrastructure"), style: { width: 160, height: 140 } },
        { ...node("external-feed", "external-dependency"), style: { width: 180, height: 260 } },
        { ...node("metrics", "infrastructure"), style: { width: 160, height: 180 } },
        { ...node("review-a", "unclassified"), style: { width: 160, height: 150 } },
        { ...node("review-b", "unclassified"), style: { width: 160, height: 240 } },
        { ...node("review-c", "unclassified"), style: { width: 160, height: 170 } },
      ],
      edges: [],
    };
    const forward = eventDrivenLayoutStrategy.layout(graph);
    const reversed = eventDrivenLayoutStrategy.layout({
      nodes: [...graph.nodes].reverse(),
      edges: [...graph.edges].reverse(),
    });
    const byId = new Map(forward.nodes.map((value) => [value.id, value]));
    const bus = byId.get("orders-bus")!;
    const supportNodes = ["audit-log", "external-feed", "metrics"].map((id) => byId.get(id)!);
    const reviewNodes = ["review-a", "review-b", "review-c"].map((id) => byId.get(id)!);
    const supportTop = Math.min(...supportNodes.map((value) => value.position.y));
    const supportBottom = Math.max(...supportNodes.map((value) => value.position.y + getNodeDimensions(value).height));
    const reviewTop = Math.min(...reviewNodes.map((value) => value.position.y));

    expect(supportTop).toBeGreaterThanOrEqual(bus.position.y + getNodeDimensions(bus).height + 200);
    expect(reviewTop).toBeGreaterThanOrEqual(supportBottom + 200);
    expect(forward.quality.nodeOverlapCount).toBe(0);
    expect(positions(reversed.nodes)).toEqual(positions(forward.nodes));
    expect(reversed.diagnostics).toEqual(forward.diagnostics);
  });

  it("keeps snapped bus and support lane boundaries non-overlapping", () => {
    const graph = {
      nodes: [
        { ...node("a-bus", "event-bus"), style: { width: 160, height: 101 } },
        { ...node("b-bus", "event-bus"), style: { width: 160, height: 101 } },
        { ...node("telemetry", "infrastructure"), style: { width: 160, height: 101 } },
      ],
      edges: [],
      options: { nodeSpacing: 0, rankSpacing: 0, snapToGrid: true, gridSize: 20 },
    };
    const forward = eventDrivenLayoutStrategy.layout(graph);
    const reversed = eventDrivenLayoutStrategy.layout({
      nodes: [...graph.nodes].reverse(),
      edges: [...graph.edges].reverse(),
      options: graph.options,
    });

    expect(forward.quality.nodeOverlapCount).toBe(0);
    expect(forward.quality.nodeOverlapArea).toBe(0);
    expect(forward.nodes.every(({ position }) =>
      Number.isFinite(position.x) && Number.isFinite(position.y)
      && position.x % 20 === 0 && position.y % 20 === 0
    )).toBe(true);
    expect(positions(reversed.nodes)).toEqual(positions(forward.nodes));
    expect(reversed.diagnostics).toEqual(forward.diagnostics);
  });

  it("recovers invalid geometry inputs before layout arithmetic", () => {
    const result = eventDrivenLayoutStrategy.layout({
      nodes: [
        { ...node("publisher", "publisher"), style: { width: -160, height: Number.POSITIVE_INFINITY } },
        { ...node("bus", "event-bus"), style: { width: Number.NEGATIVE_INFINITY, height: -100 } },
        { ...node("subscriber", "subscriber"), style: { width: -180, height: Number.NEGATIVE_INFINITY } },
      ],
      edges: [
        edge("publisher", "bus", "event"),
        edge("bus", "subscriber", "event"),
      ],
      options: {
        nodeSpacing: -1,
        rankSpacing: Number.POSITIVE_INFINITY,
        snapToGrid: true,
        gridSize: 0,
      },
    });
    const diagnostic = result.diagnostics.find(({ code }) => code === "event-driven-invalid-geometry-input");

    expect(result.nodes.every(({ position }) =>
      Number.isFinite(position.x) && Number.isFinite(position.y)
      && position.x > 0 && position.y > 0
    )).toBe(true);
    expect(result.quality.nodeOverlapCount).toBe(0);
    expect(diagnostic).toMatchObject({
      severity: "warning",
      nodeIds: ["bus", "publisher", "subscriber"],
    });
    expect(diagnostic?.message).toContain("nodeSpacing");
    expect(diagnostic?.message).toContain("rankSpacing");
    expect(diagnostic?.message).toContain("grid snapping");
  });

  it("reports invalid geometry for child-only graphs before the no-top-level return", () => {
    const graph = {
      nodes: [{
        ...node("child", "unclassified"),
        parentId: "missing-parent",
        position: { x: 25, y: 35 },
        style: { width: -160, height: Number.POSITIVE_INFINITY },
      }],
      edges: [edge("child", "missing-target", "hierarchy event")],
      options: { nodeSpacing: -1, rankSpacing: Number.POSITIVE_INFINITY, snapToGrid: true, gridSize: 0 },
    };
    const forward = eventDrivenLayoutStrategy.layout(graph);
    const reversed = eventDrivenLayoutStrategy.layout({
      nodes: [...graph.nodes].reverse(),
      edges: [...graph.edges].reverse(),
      options: graph.options,
    });

    expect(forward.diagnostics.find(({ code }) => code === "event-driven-invalid-geometry-input"))
      .toMatchObject({ severity: "warning", nodeIds: ["child"] });
    expect(forward.diagnostics.map(({ code }) => code)).toEqual([
      "event-driven-child-positions-preserved",
      "event-driven-hierarchy-edges-excluded",
      "event-driven-no-top-level-nodes",
      "event-driven-invalid-geometry-input",
    ]);
    expect(forward.nodes[0]!.position).toEqual({ x: 25, y: 35 });
    expect(forward.diagnostics).toEqual(reversed.diagnostics);
  });

  it("does not count explicit unclassified nodes as confident event-driven roles", () => {
    const graph = {
      nodes: [
        node("bus", "event-bus"),
        ...Array.from({ length: 9 }, (_, index) => node(`unclassified-${index}`, "unclassified")),
      ],
      edges: [],
    };
    const analysis = eventDrivenLayoutStrategy.analyse(graph);

    expect(analysis.score).toBeLessThan(0.2);
    expect(analysis.reasons[0]).not.toContain("10 of 10");
    expect(analysis.reasons[0]).toContain("1 of 10");
  });

  it("summarizes external dependencies and describes deterministic ambiguous placement", () => {
    const graph = singleBusGraph();
    graph.nodes.push(
      node("secondary-bus", "event-bus"),
      { ...node("external-feed", "external-dependency"), style: { width: 180, height: 140 } },
    );
    graph.edges.push(
      edge("secondary-bus", "fraud", "secondary event"),
      edge("fraud", "secondary-bus", "continued event"),
    );
    const result = eventDrivenLayoutStrategy.layout(graph);
    const byId = new Map(result.nodes.map((value) => [value.id, center(value)]));
    const summary = result.diagnostics.find(({ code }) => code === "event-driven-role-summary");
    const ambiguous = result.diagnostics.find(({ code }) => code === "event-driven-ambiguous-processor");

    expect(summary?.message).toContain("1 external dependency");
    expect(byId.get("external-feed")!.y).toBeGreaterThan(byId.get("orders-bus")!.y);
    expect(ambiguous?.message).toContain("deterministic primary available bus band");
  });

  it("emits the no-bus diagnostic while placing flow roles in review", () => {
    const result = eventDrivenLayoutStrategy.layout({
      nodes: [
        node("publisher", "publisher"),
        node("processor", "processor"),
        node("subscriber", "subscriber"),
      ],
      edges: [],
    });

    expect(result.diagnostics.find(({ code }) => code === "event-driven-no-bus"))
      .toMatchObject({ severity: "warning" });
    expect(result.quality.nodeOverlapCount).toBe(0);
  });

  it("breaks equal bus-affinity ties by lexical bus ID", () => {
    const graph = {
      nodes: [
        node("a-bus", "event-bus"),
        node("b-bus", "event-bus"),
        node("worker", "processor"),
      ],
      edges: [
        edge("a-bus", "worker", "a event"),
        edge("b-bus", "worker", "b event"),
      ],
    };
    const forward = eventDrivenLayoutStrategy.layout(graph);
    const reversed = eventDrivenLayoutStrategy.layout({
      nodes: [...graph.nodes].reverse(),
      edges: [...graph.edges].reverse(),
    });
    const byId = new Map(forward.nodes.map((value) => [value.id, center(value)]));

    expect(byId.get("worker")!.y).toBe(byId.get("a-bus")!.y);
    expect(byId.get("worker")!.y).toBeLessThan(byId.get("b-bus")!.y);
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
