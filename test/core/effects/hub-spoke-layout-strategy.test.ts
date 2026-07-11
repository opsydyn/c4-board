import { dagreLayoutStrategy } from "@/core/effects/dagre-layout-strategy";
import { hubSpokeLayoutStrategy } from "@/core/effects/hub-spoke-layout-strategy";
import { calculateLayout, getPreset } from "@/core/effects/layout";
import { getNodeDimensions } from "@/core/effects/layout-node-size";
import type { Edge, Node, XYPosition } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { cloneLayoutFixture, layoutGraphFixtures } from "../../../tests/fixtures/layoutGraphs";

const hubFixture = () =>
  cloneLayoutFixture(
    layoutGraphFixtures.find((fixture) => fixture.name === "hub-spoke")!,
  );

const center = (node: Node): XYPosition => {
  const dimensions = getNodeDimensions(node);
  return {
    x: node.position.x + dimensions.width / 2,
    y: node.position.y + dimensions.height / 2,
  };
};

const distance = (left: XYPosition, right: XYPosition): number =>
  Math.hypot(
    right.x - left.x,
    right.y - left.y,
  );

describe("Hub-Spoke layout strategy", () => {
  it("routes the Hub-Spoke preset to distinct radial geometry", () => {
    const graph = hubFixture();
    const options = getPreset("hubSpoke");
    const radial = calculateLayout(graph.nodes, graph.edges, options);
    const baseline = dagreLayoutStrategy.layout({ ...graph, options });
    const hub = radial.nodes.find((node) => node.id === "integration-hub")!;
    const hubCenter = center(hub);
    const spokeRadii = radial.nodes
      .filter((node) => node.id !== hub.id)
      .map((node) => distance(hubCenter, center(node)));

    expect(radial.strategyId).toBe("hub-spoke");
    expect(radial.engine).toBe("custom");
    expect(radial.nodes.map((node) => node.position)).not.toEqual(
      baseline.nodes.map((node) => node.position),
    );
    expect(Math.max(...spokeRadii) - Math.min(...spokeRadii)).toBeLessThanOrEqual(20);
    expect(radial.quality.nodeOverlapCount).toBe(0);
    expect(radial.quality.totalEdgeLength).toBeLessThan(baseline.quality.totalEdgeLength);
    expect(radial.diagnostics.find((diagnostic) => diagnostic.code === "hub-spoke-hub-selected")?.nodeIds)
      .toEqual(["integration-hub"]);
  });

  it("honours an explicit top-level hub", () => {
    const graph = hubFixture();
    const result = hubSpokeLayoutStrategy.layout({
      ...graph,
      options: { hubNodeId: "crm" },
    });

    expect(result.diagnostics.find((diagnostic) => diagnostic.code === "hub-spoke-hub-selected"))
      .toMatchObject({ nodeIds: ["crm"], message: expect.stringContaining("Selected hub") });
  });

  it("falls back to deterministic inference when the requested hub is unavailable", () => {
    const graph = hubFixture();
    const result = hubSpokeLayoutStrategy.layout({
      ...graph,
      options: { hubNodeId: "missing" },
    });

    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "hub-spoke-requested-hub-unavailable",
    );
    expect(result.diagnostics.find((diagnostic) => diagnostic.code === "hub-spoke-hub-selected")?.nodeIds)
      .toEqual(["integration-hub"]);
  });

  it("uses lexical node IDs to break hub ties deterministically", () => {
    const nodes = ["zeta", "alpha", "middle"].map((id): Node => ({
      id,
      type: "system",
      position: { x: 0, y: 0 },
      style: { width: 160, height: 100 },
      data: { label: id },
    }));
    const result = hubSpokeLayoutStrategy.layout({ nodes, edges: [] });

    expect(result.diagnostics.find((diagnostic) => diagnostic.code === "hub-spoke-hub-selected")?.nodeIds)
      .toEqual(["alpha"]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("hub-spoke-weak-hub");
  });

  it("distributes large spoke sets across collision-free rings", () => {
    const hub: Node = {
      id: "hub",
      type: "system",
      position: { x: 0, y: 0 },
      style: { width: 180, height: 120 },
      data: { label: "Hub" },
    };
    const satellites = Array.from({ length: 18 }, (_, index): Node => ({
      id: `satellite-${index.toString().padStart(2, "0")}`,
      type: "externalSystem",
      position: { x: 0, y: 0 },
      style: { width: 160, height: 100 },
      data: { label: `Satellite ${index}` },
    }));
    const edges: Edge[] = satellites.map((satellite) => ({
      id: `hub-${satellite.id}`,
      source: hub.id,
      target: satellite.id,
    }));
    const result = hubSpokeLayoutStrategy.layout({ nodes: [hub, ...satellites], edges });
    const hubCenter = center(result.nodes.find((node) => node.id === hub.id)!);
    const radiusBands = new Set(
      result.nodes
        .filter((node) => node.id !== hub.id)
        .map((node) => Math.round(distance(hubCenter, center(node)) / 50) * 50),
    );

    expect(radiusBands.size).toBeGreaterThan(1);
    expect(result.quality.nodeOverlapCount).toBe(0);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "hub-spoke-multiple-rings",
    );
  });

  it("falls back to Dagre for an unavailable strategy", () => {
    const graph = hubFixture();
    const result = calculateLayout(graph.nodes, graph.edges, { strategyId: "not-installed" });

    expect(result.strategyId).toBe("dagre-hierarchical");
    expect(result.diagnostics[0]).toMatchObject({ code: "layout-strategy-fallback" });
  });
});
