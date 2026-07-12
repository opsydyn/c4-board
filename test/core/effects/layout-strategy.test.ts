import { dagreLayoutStrategy } from "@/core/effects/dagre-layout-strategy";
import { elkLayeredLayoutStrategy } from "@/core/effects/elk-layered-layout-strategy";
import { autoLayout, autoLayoutSelected, getPreset } from "@/core/effects/layout";
import { getSynchronousLayoutStrategies, resolveLayoutStrategy } from "@/core/effects/layout-strategy-registry";
import { describe, expect, it } from "vitest";
import { cloneLayoutFixture, layoutGraphFixtures } from "../../../tests/fixtures/layoutGraphs";

const positions = (nodes: ReturnType<typeof autoLayout>) =>
  Object.fromEntries(
    nodes.map((node) => [node.id, node.position]),
  );

describe("Dagre layout strategy baseline", () => {
  it("registers ELK without exposing it through the synchronous preset path", () => {
    expect(resolveLayoutStrategy("elk-layered")).toBe(elkLayeredLayoutStrategy);
    expect(getSynchronousLayoutStrategies()).not.toContain(elkLayeredLayoutStrategy);
  });

  it.each(layoutGraphFixtures)("preserves the $name baseline", (fixture) => {
    const graph = cloneLayoutFixture(fixture);
    const options = getPreset(graph.preset);
    const dagreOptions = graph.preset === "clientServer" ? { ...options, direction: "TB" as const } : options;
    const result = dagreLayoutStrategy.layout({ ...graph, options: dagreOptions });

    expect({
      positions: positions(result.nodes),
      quality: result.quality,
    }).toMatchSnapshot();
    expect(result.engine).toBe("dagre");
    expect(result.strategyId).toBe("dagre-hierarchical");
    expect(result.diagnostics).toEqual([]);
  });

  it("keeps the legacy autoLayout API on the strategy output", () => {
    const graph = cloneLayoutFixture(layoutGraphFixtures[1]!);
    const options = getPreset(graph.preset);

    expect(autoLayout(graph.nodes, graph.edges, options)).toEqual(
      dagreLayoutStrategy.layout({ ...graph, options }).nodes,
    );
  });

  it("reports preserved children and hierarchy-crossing edges", () => {
    const graph = cloneLayoutFixture(layoutGraphFixtures[0]!);
    const child = {
      ...graph.nodes[1]!,
      id: "child",
      parentId: graph.nodes[0]!.id,
      position: { x: 20, y: 20 },
    };
    const result = dagreLayoutStrategy.layout({
      nodes: [graph.nodes[0]!, child],
      edges: [{ id: "parent-child", source: graph.nodes[0]!.id, target: child.id }],
    });

    expect(result.nodes.find((node) => node.id === child.id)?.position).toEqual(child.position);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "dagre-child-positions-preserved",
      "dagre-hierarchy-edges-excluded",
    ]);
  });

  it("keeps the legacy selected-layout API inert for an empty selection", () => {
    const graph = cloneLayoutFixture(layoutGraphFixtures[0]!);

    expect(autoLayoutSelected(graph.nodes, graph.edges, [], getPreset("hubSpoke"))).toEqual(
      graph.nodes,
    );
  });
});
