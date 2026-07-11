import { dagreLayoutStrategy } from "@/core/effects/dagre-layout-strategy";
import { hexagonalLayoutStrategy } from "@/core/effects/hexagonal-layout-strategy";
import { calculateLayout, getPreset } from "@/core/effects/layout";
import { getNodeDimensions } from "@/core/effects/layout-node-size";
import type { Node, XYPosition } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { cloneLayoutFixture, layoutGraphFixtures } from "../../../tests/fixtures/layoutGraphs";

const fixture = () => cloneLayoutFixture(layoutGraphFixtures.find(({ name }) => name === "hexagonal")!);

const center = (node: Node): XYPosition => {
  const dimensions = getNodeDimensions(node);
  return {
    x: node.position.x + dimensions.width / 2,
    y: node.position.y + dimensions.height / 2,
  };
};

describe("Hexagonal layout strategy", () => {
  it("routes the preset to distinct role-driven geometry", () => {
    const graph = fixture();
    const options = getPreset("hexagonal");
    const result = calculateLayout(graph.nodes, graph.edges, options);
    const baseline = dagreLayoutStrategy.layout({ ...graph, options });
    const byId = new Map(result.nodes.map((node) => [node.id, center(node)]));

    expect(result.strategyId).toBe("hexagonal");
    expect(result.engine).toBe("custom");
    expect(result.nodes.map(({ position }) => position)).not.toEqual(
      baseline.nodes.map(({ position }) => position),
    );
    expect(byId.get("rest-adapter")!.x).toBeLessThan(byId.get("domain-core")!.x);
    expect(byId.get("event-adapter")!.x).toBeLessThan(byId.get("domain-core")!.x);
    expect(byId.get("repository-port")!.x).toBeGreaterThan(byId.get("domain-core")!.x);
    expect(byId.get("database-adapter")!.x).toBeGreaterThan(byId.get("repository-port")!.x);
    expect(byId.get("email-adapter")!.x).toBeGreaterThan(byId.get("repository-port")!.x);
    expect(result.quality.nodeOverlapCount).toBe(0);
    expect(result.diagnostics.find(({ code }) => code === "hexagonal-role-summary")?.message)
      .toContain("1 core");
  });

  it("is deterministic across node and edge input order", () => {
    const graph = fixture();
    const forward = hexagonalLayoutStrategy.layout(graph);
    const reversed = hexagonalLayoutStrategy.layout({
      nodes: [...graph.nodes].reverse(),
      edges: [...graph.edges].reverse(),
    });
    const positions = (nodes: Node[]) =>
      Object.fromEntries(
        [...nodes].sort((left, right) => left.id.localeCompare(right.id))
          .map((node) => [node.id, node.position]),
      );

    expect(positions(reversed.nodes)).toEqual(positions(forward.nodes));
  });

  it("preserves semantic ambiguity diagnostics", () => {
    const graph = fixture();
    graph.nodes.push({
      id: "worker",
      type: "component",
      position: { x: 0, y: 0 },
      data: { label: "Worker" },
    });

    const result = hexagonalLayoutStrategy.layout(graph);

    expect(result.diagnostics.find(({ code }) => code === "semantic-role-ambiguous"))
      .toMatchObject({ severity: "warning", nodeIds: ["worker"] });
    expect(result.quality.nodeOverlapCount).toBe(0);
  });

  it("places explicit infrastructure below the core and preserves child coordinates", () => {
    const graph = fixture();
    graph.nodes.push({
      id: "telemetry",
      type: "component",
      position: { x: 0, y: 0 },
      data: { label: "Telemetry", layoutRole: "infrastructure" },
    }, {
      id: "core-child",
      type: "component",
      parentId: "domain-core",
      position: { x: 25, y: 35 },
      data: { label: "Core child" },
    });
    graph.edges.push({
      id: "core-telemetry",
      source: "domain-core",
      target: "telemetry",
    }, {
      id: "child-email",
      source: "core-child",
      target: "email-adapter",
    });

    const result = hexagonalLayoutStrategy.layout(graph);

    expect(center(result.nodes.find(({ id }) => id === "telemetry")!).y)
      .toBeGreaterThan(center(result.nodes.find(({ id }) => id === "domain-core")!).y);
    expect(result.nodes.find(({ id }) => id === "core-child")!.position).toEqual({ x: 25, y: 35 });
    expect(result.diagnostics.map(({ code }) => ({ code }))).toContainEqual({
      code: "hexagonal-hierarchy-edges-excluded",
    });
    expect(result.quality.nodeOverlapCount).toBe(0);
  });
});
