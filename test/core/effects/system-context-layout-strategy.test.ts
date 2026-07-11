import { dagreLayoutStrategy } from "@/core/effects/dagre-layout-strategy";
import { calculateLayout, getPreset } from "@/core/effects/layout";
import { getNodeDimensions } from "@/core/effects/layout-node-size";
import { systemContextLayoutStrategy } from "@/core/effects/system-context-layout-strategy";
import type { Edge, Node, XYPosition } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { cloneLayoutFixture, layoutGraphFixtures } from "../../../tests/fixtures/layoutGraphs";

const contextFixture = () =>
  cloneLayoutFixture(
    layoutGraphFixtures.find((fixture) => fixture.name === "system-context")!,
  );

const node = (id: string, type: string): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  style: { width: 160, height: 100 },
  data: { label: id },
});

const edge = (source: string, target: string): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
});

const center = (layoutNode: Node): XYPosition => {
  const dimensions = getNodeDimensions(layoutNode);
  return {
    x: layoutNode.position.x + dimensions.width / 2,
    y: layoutNode.position.y + dimensions.height / 2,
  };
};

const clockwiseOrderFromTop = (nodes: Node[], centerNode: Node): string[] => {
  const centerPosition = center(centerNode);
  return [...nodes]
    .sort((left, right) => {
      const leftCenter = center(left);
      const rightCenter = center(right);
      const leftAngle = normalizeAngle(
        Math.atan2(leftCenter.y - centerPosition.y, leftCenter.x - centerPosition.x) + Math.PI / 2,
      );
      const rightAngle = normalizeAngle(
        Math.atan2(rightCenter.y - centerPosition.y, rightCenter.x - centerPosition.x) + Math.PI / 2,
      );
      return leftAngle - rightAngle;
    })
    .map((layoutNode) => layoutNode.id);
};

const normalizeAngle = (angle: number): number => (angle + Math.PI * 2) % (Math.PI * 2);

describe("System Context layout strategy", () => {
  it("routes the preset to a distinct radial system context", () => {
    const graph = contextFixture();
    const options = getPreset("systemContext");
    const radial = calculateLayout(graph.nodes, graph.edges, options);
    const baseline = dagreLayoutStrategy.layout({ ...graph, options });

    expect(radial.strategyId).toBe("system-context");
    expect(radial.engine).toBe("custom");
    expect(radial.nodes.map((layoutNode) => layoutNode.position)).not.toEqual(
      baseline.nodes.map((layoutNode) => layoutNode.position),
    );
    expect(radial.quality.nodeOverlapCount).toBe(0);
    expect(radial.diagnostics.find((diagnostic) => diagnostic.code === "system-context-system-selected")?.nodeIds)
      .toEqual(["core-system"]);
  });

  it("honours an explicit top-level system of interest", () => {
    const nodes = [node("primary", "system"), node("secondary", "system"), node("person", "person")];
    const result = systemContextLayoutStrategy.layout({
      nodes,
      edges: [edge("person", "primary"), edge("primary", "secondary")],
      options: { systemOfInterestNodeId: "secondary" },
    });

    expect(result.diagnostics.find((diagnostic) => diagnostic.code === "system-context-system-selected"))
      .toMatchObject({ nodeIds: ["secondary"], message: expect.stringContaining("Selected") });
  });

  it("warns when an explicit system of interest has an external role", () => {
    const graph = contextFixture();
    const result = systemContextLayoutStrategy.layout({
      ...graph,
      options: { systemOfInterestNodeId: "payments" },
    });

    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "system-context-unusual-system-of-interest",
    );
  });

  it("falls back to inferred selection when an explicit node is unavailable", () => {
    const graph = contextFixture();
    const result = systemContextLayoutStrategy.layout({
      ...graph,
      options: { systemOfInterestNodeId: "missing" },
    });

    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "system-context-requested-system-unavailable",
    );
    expect(result.diagnostics.find((diagnostic) => diagnostic.code === "system-context-system-selected")?.nodeIds)
      .toEqual(["core-system"]);
  });

  it("places people, internal elements, externals, and other nodes in stable sectors", () => {
    const contextNodes = [
      node("center", "system"),
      node("person-a", "person"),
      node("person-b", "person"),
      node("internal", "container"),
      node("external", "externalSystem"),
      node("other", "domainEvent"),
    ];
    const contextEdges = contextNodes
      .filter((contextNode) => contextNode.id !== "center")
      .map((contextNode) => edge("center", contextNode.id));
    const result = systemContextLayoutStrategy.layout({
      nodes: contextNodes,
      edges: contextEdges,
      options: { systemOfInterestNodeId: "center" },
    });
    const centerNode = result.nodes.find((layoutNode) => layoutNode.id === "center")!;
    const satellites = result.nodes.filter((layoutNode) => layoutNode.id !== "center");

    expect(clockwiseOrderFromTop(satellites, centerNode)).toEqual([
      "person-a",
      "person-b",
      "internal",
      "external",
      "other",
    ]);
  });

  it("uses c4Type metadata and reports fallback when no software system exists", () => {
    const container = {
      ...node("application", "customNode"),
      data: { label: "Application", c4Type: "container" },
    };
    const external = {
      ...node("provider", "customNode"),
      data: { label: "Provider", c4Type: "externalSystem" },
    };
    const result = systemContextLayoutStrategy.layout({
      nodes: [container, external],
      edges: [edge("application", "provider")],
    });

    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "system-context-no-software-system",
    );
    expect(result.diagnostics.find((diagnostic) => diagnostic.code === "system-context-system-selected")?.nodeIds)
      .toEqual(["application"]);
    expect(result.diagnostics.find((diagnostic) => diagnostic.code === "system-context-sectors")?.message)
      .toContain("1 external systems");
  });

  it("reports ambiguous inference between equally connected software systems", () => {
    const result = systemContextLayoutStrategy.layout({
      nodes: [node("zeta", "system"), node("alpha", "system")],
      edges: [],
    });

    expect(result.diagnostics.find((diagnostic) => diagnostic.code === "system-context-system-selected")?.nodeIds)
      .toEqual(["alpha"]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "system-context-ambiguous-system",
    );
  });

  it("distributes large contexts across collision-free rings", () => {
    const centerNode = node("system-of-interest", "system");
    const satellites = Array.from({ length: 18 }, (_, index) => {
      const types = ["person", "container", "externalSystem"] as const;
      return node(`context-${index.toString().padStart(2, "0")}`, types[index % types.length]!);
    });
    const edges = satellites.map((satellite) => edge(centerNode.id, satellite.id));
    const result = systemContextLayoutStrategy.layout({ nodes: [centerNode, ...satellites], edges });

    expect(result.quality.nodeOverlapCount).toBe(0);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "system-context-multiple-rings",
    );
  });
});
