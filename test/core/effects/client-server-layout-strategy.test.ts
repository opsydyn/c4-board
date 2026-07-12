import { clientServerLayoutStrategy } from "@/core/effects/client-server-layout-strategy";
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

  it("leaves a missing domain tier empty and reports it", () => {
    const graph = clientServerGraphWithoutDomain();
    const result = clientServerLayoutStrategy.layout(graph);

    expect(result.semanticRoles?.some(({ role }) => role === "domain")).toBe(false);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "client-server-domain-missing",
      severity: "warning",
    }));
  });

  it("diagnoses multiple and orphan external affinities deterministically", () => {
    const result = clientServerLayoutStrategy.layout(multiCallerAndOrphanGraph());

    expect(result.diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
      "client-server-external-affinity-ambiguous",
      "client-server-external-orphan",
    ]));
  });

  it("preserves children, recovers invalid dimensions, and remains deterministic", () => {
    const graph = clientServerGraphWithChildAndInvalidDimensions();
    const before = structuredClone(graph);
    const forward = clientServerLayoutStrategy.layout(graph);
    const reversed = clientServerLayoutStrategy.layout({
      nodes: [...graph.nodes].reverse(),
      edges: [...graph.edges].reverse(),
      options: graph.options,
    });

    expect(graph).toEqual(before);
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
});
