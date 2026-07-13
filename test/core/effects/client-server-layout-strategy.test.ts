import { clientServerLayoutStrategy } from "@/core/effects/client-server-layout-strategy";
import { dagreLayoutStrategy } from "@/core/effects/dagre-layout-strategy";
import { calculateLayout, getPreset } from "@/core/effects/layout";
import { getNodeDimensions } from "@/core/effects/layout-node-size";
import type { Edge, Node, XYPosition } from "@xyflow/react";
import { describe, expect, it } from "vitest";

const node = (
  id: string,
  layoutRole: string,
  type = "component",
  dimensions: { width: number; height: number } = { width: 160, height: 100 },
): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  style: dimensions,
  data: { label: id, layoutRole },
});

const edge = (source: string, target: string): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
});

const center = (value: Node): XYPosition => {
  const dimensions = getNodeDimensions(value);
  return {
    x: value.position.x + dimensions.width / 2,
    y: value.position.y + dimensions.height / 2,
  };
};

const positionRecord = (nodes: Node[]) =>
  Object.fromEntries(
    [...nodes].sort((left, right) => left.id.localeCompare(right.id))
      .map((value) => [value.id, value.position]),
  );

const clientServerGraph = () => ({
  nodes: [
    node("web-client", "client", "person"),
    node("api-server", "service", "container"),
    node("customer-domain", "domain", "aggregate"),
    node("customer-repository", "persistence", "repository"),
    node("identity-provider", "external-dependency", "externalSystem"),
    node("unknown", "unclassified"),
  ],
  edges: [
    edge("web-client", "api-server"),
    edge("api-server", "customer-domain"),
    edge("customer-domain", "customer-repository"),
    edge("api-server", "identity-provider"),
  ],
});

const clientServerGraphWithoutDomain = () => ({
  nodes: [
    node("web-client", "client", "person"),
    node("api-server", "service", "container"),
    node("customer-repository", "persistence", "repository"),
  ],
  edges: [
    edge("web-client", "api-server"),
    edge("api-server", "customer-repository"),
  ],
});

const multiCallerAndOrphanGraph = () => ({
  nodes: [
    node("api-a", "service"),
    node("api-b", "service"),
    node("customer-domain", "domain"),
    node("ambiguous-external", "external-dependency", "externalSystem"),
    node("orphan-external", "external-dependency", "externalSystem"),
  ],
  edges: [
    edge("api-a", "ambiguous-external"),
    edge("api-b", "ambiguous-external"),
    edge("customer-domain", "ambiguous-external"),
  ],
});

const clientServerGraphWithChildAndInvalidDimensions = () => ({
  nodes: [
    node("web-client", "client", "person"),
    {
      ...node("api-server", "service", "container"),
      style: { width: -160, height: Number.POSITIVE_INFINITY },
    },
    node("customer-domain", "domain", "aggregate"),
    node("customer-repository", "persistence", "repository"),
    {
      ...node("domain-child", "unclassified"),
      parentId: "customer-domain",
      position: { x: 20, y: 30 },
    },
  ],
  edges: [
    edge("web-client", "api-server"),
    edge("api-server", "customer-domain"),
    edge("customer-domain", "customer-repository"),
    edge("domain-child", "customer-repository"),
  ],
  options: { nodeSpacing: -1, rankSpacing: Number.POSITIVE_INFINITY, snapToGrid: true, gridSize: 0 },
});

describe("Client-Server layout strategy", () => {
  it("routes the Client-Server preset without Dagre fallback", () => {
    const graph = clientServerGraph();
    const options = getPreset("clientServer");
    const result = calculateLayout(graph.nodes, graph.edges, options);
    const baseline = dagreLayoutStrategy.layout({ ...graph, options });

    expect(options.strategyId).toBe("client-server");
    expect(result).toMatchObject({ strategyId: "client-server", engine: "custom" });
    expect(result.nodes.map(({ position }) => position)).not.toEqual(
      baseline.nodes.map(({ position }) => position),
    );
    expect(result.diagnostics.map(({ code }) => code)).not.toContain("layout-strategy-fallback");
  });

  it("places the four semantic tiers in left-to-right columns", () => {
    const graph = clientServerGraph();
    const result = clientServerLayoutStrategy.layout(graph);
    const byId = new Map(result.nodes.map((value) => [value.id, center(value)]));

    expect(byId.get("web-client")!.x).toBeLessThan(byId.get("api-server")!.x);
    expect(byId.get("api-server")!.x).toBeLessThan(byId.get("customer-domain")!.x);
    expect(byId.get("customer-domain")!.x).toBeLessThan(byId.get("customer-repository")!.x);
    expect(result.quality.nodeOverlapCount).toBe(0);
  });

  it("aligns external dependencies below their deterministic caller tier", () => {
    const graph = clientServerGraph();
    const result = clientServerLayoutStrategy.layout(graph);
    const byId = new Map(result.nodes.map((value) => [value.id, center(value)]));

    expect(byId.get("identity-provider")!.x).toBe(byId.get("api-server")!.x);
    expect(byId.get("identity-provider")!.y).toBeGreaterThan(byId.get("api-server")!.y);
    expect(byId.get("unknown")!.y).toBeGreaterThan(byId.get("identity-provider")!.y);
  });

  it("keeps caller-affined support vertically stable when another primary column grows", () => {
    const baseline = clientServerGraph();
    const tallerDomain = clientServerGraph();
    tallerDomain.nodes.find(({ id }) => id === "customer-domain")!.style = { width: 240, height: 160 };

    const baselineResult = clientServerLayoutStrategy.layout(baseline);
    const tallerDomainResult = clientServerLayoutStrategy.layout(tallerDomain);
    const baselineSupport = baselineResult.nodes.find(({ id }) => id === "identity-provider")!;
    const tallerDomainSupport = tallerDomainResult.nodes.find(({ id }) => id === "identity-provider")!;
    const baselineCaller = baselineResult.nodes.find(({ id }) => id === "api-server")!;
    const tallerDomainCaller = tallerDomainResult.nodes.find(({ id }) => id === "api-server")!;

    expect(tallerDomainSupport.position.y).toBe(baselineSupport.position.y);
    expect(center(tallerDomainSupport).x).toBe(center(tallerDomainCaller).x);
    expect(center(baselineSupport).x).toBe(center(baselineCaller).x);
    expect(tallerDomainResult.quality.nodeOverlapCount).toBe(0);
  });

  it.each([
    [280, 240],
    [281, 240],
    [279, 237],
  ])("centers a %ipx service tier with %ipx external support", (serviceWidth, externalWidth) => {
    const graph = clientServerGraph();
    graph.nodes.find(({ id }) => id === "api-server")!.style = { width: serviceWidth, height: 100 };
    graph.nodes.find(({ id }) => id === "identity-provider")!.style = { width: externalWidth, height: 100 };

    const forward = clientServerLayoutStrategy.layout(graph);
    const reversed = clientServerLayoutStrategy.layout({
      nodes: [...graph.nodes].reverse(),
      edges: [...graph.edges].reverse(),
    });
    const byId = new Map(forward.nodes.map((value) => [value.id, center(value)]));

    expect(byId.get("identity-provider")!.x).toBe(byId.get("api-server")!.x);
    expect(forward.quality.nodeOverlapCount).toBe(0);
    expect(positionRecord(reversed.nodes)).toEqual(positionRecord(forward.nodes));
  });

  it("treats reverse external links as orphaned support dependencies", () => {
    const graph = clientServerGraph();
    graph.edges = graph.edges
      .filter(({ id }) => id !== "api-server-identity-provider")
      .concat(edge("identity-provider", "api-server"));

    const result = clientServerLayoutStrategy.layout(graph);

    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "client-server-external-orphan",
      nodeIds: ["identity-provider"],
    }));
  });

  it("keeps dense primary columns and support lanes overlap-free", () => {
    const graph = clientServerGraph();
    graph.nodes.push(
      node("mobile-client", "client", "person", { width: 220, height: 140 }),
      node("billing-api", "service", "container", { width: 280, height: 180 }),
      node("fulfilment-api", "service", "component", { width: 240, height: 120 }),
      node("billing-domain", "domain", "aggregate", { width: 260, height: 160 }),
      node("audit-store", "persistence", "repository", { width: 200, height: 140 }),
      node("payment-provider", "external-dependency", "externalSystem", { width: 220, height: 120 }),
    );
    graph.edges.push(edge("billing-api", "payment-provider"));

    const result = clientServerLayoutStrategy.layout(graph);

    expect(result.quality.nodeOverlapCount).toBe(0);
  });

  it("leaves a missing domain tier empty and reports it", () => {
    const graph = clientServerGraphWithoutDomain();
    const result = clientServerLayoutStrategy.layout(graph);

    expect(result.semanticRoles?.some(({ role }) => role === "domain")).toBe(false);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "client-server-domain-missing",
      severity: "warning",
    }));
  });

  it("reports a missing persistence tier as informational", () => {
    const graph = clientServerGraph();
    graph.nodes = graph.nodes.filter(({ id }) => id !== "customer-repository");
    graph.edges = graph.edges.filter(({ target }) => target !== "customer-repository");

    const result = clientServerLayoutStrategy.layout(graph);

    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "client-server-persistence-missing",
      severity: "info",
    }));
  });

  it("diagnoses multiple and orphan external affinities deterministically", () => {
    const result = clientServerLayoutStrategy.layout(multiCallerAndOrphanGraph());

    expect(result.diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
      "client-server-external-affinity-ambiguous",
      "client-server-external-orphan",
    ]));
    expect(result.diagnostics).toContainEqual({
      code: "client-server-external-affinity-ambiguous",
      severity: "warning",
      message:
        "External dependency 'ambiguous-external' selected caller 'api-a'; alternatives: api-b, customer-domain.",
      nodeIds: ["ambiguous-external"],
    });
  });

  it("preserves children, recovers invalid dimensions, and remains deterministic", () => {
    const graph = clientServerGraphWithChildAndInvalidDimensions();
    const child = graph.nodes.find(({ id }) => id === "domain-child")!;
    child.style = { width: -80, height: Number.POSITIVE_INFINITY };
    child.data = { ...child.data, metadata: { preserved: true } };
    const before = structuredClone(graph);
    const forward = clientServerLayoutStrategy.layout(graph);
    const reversed = clientServerLayoutStrategy.layout({
      nodes: [...graph.nodes].reverse(),
      edges: [...graph.edges].reverse(),
      options: graph.options,
    });

    expect(graph).toEqual(before);
    expect(forward.nodes.find(({ id }) => id === "domain-child")).toEqual(child);
    expect(forward.nodes.find(({ id }) => id === "domain-child")?.position).toEqual({ x: 20, y: 30 });
    expect(forward.diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
      "client-server-child-positions-preserved",
      "client-server-hierarchy-edges-excluded",
      "client-server-invalid-geometry-input",
    ]));
    expect(positionRecord(reversed.nodes)).toEqual(positionRecord(forward.nodes));
    expect(reversed.diagnostics).toEqual(forward.diagnostics);
    expect(forward.quality.nodeOverlapCount).toBe(0);
  });

  it("returns child-only nodes without geometry recovery changes", () => {
    const child = {
      ...node("orphan-child", "unclassified"),
      parentId: "missing-parent",
      position: { x: 25, y: 35 },
      style: { width: -80, height: Number.POSITIVE_INFINITY },
      data: { label: "orphan-child", layoutRole: "unclassified", metadata: { preserved: true } },
    };

    const result = clientServerLayoutStrategy.layout({
      nodes: [child],
      edges: [edge("orphan-child", "missing-target")],
    });

    expect(result.nodes).toEqual([child]);
    expect(result.diagnostics.map(({ code }) => code)).toEqual([
      "client-server-child-positions-preserved",
      "client-server-hierarchy-edges-excluded",
      "client-server-no-top-level-nodes",
    ]);
  });

  it("recovers extreme finite geometry before overflow reaches the result", () => {
    const result = clientServerLayoutStrategy.layout({
      nodes: [node("web-client", "client"), node("api-server", "service")],
      edges: [edge("web-client", "api-server")],
      options: {
        nodeSpacing: Number.MAX_VALUE,
        rankSpacing: Number.MAX_VALUE,
        snapToGrid: true,
        gridSize: Number.MIN_VALUE,
      },
    });
    const qualityValues = [
      result.quality.nodeOverlapCount,
      result.quality.nodeOverlapArea,
      result.quality.straightLineCrossingCount,
      result.quality.totalEdgeLength,
      result.quality.maximumEdgeLength,
      result.quality.boundingBox.x,
      result.quality.boundingBox.y,
      result.quality.boundingBox.width,
      result.quality.boundingBox.height,
      result.quality.aspectRatio,
      result.quality.occupiedArea,
      result.quality.displacedNodeCount,
      result.quality.averageNodeDisplacement,
      result.quality.maximumNodeDisplacement,
    ];

    expect(result.nodes.every(({ position }) => Number.isFinite(position.x) && Number.isFinite(position.y))).toBe(true);
    expect(qualityValues.every(Number.isFinite)).toBe(true);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "client-server-invalid-geometry-input",
      severity: "warning",
    }));
  });
});
