import ELK from "elkjs/lib/elk.bundled.js";
import { describe, expect, it } from "vitest";

import { buildElkLayeredGraph, mapElkLayeredResult } from "@/core/effects/elk-layout-mapper";
import { evaluateRoutedEdgeQuality } from "@/core/effects/layout-metrics";
import { elkRouteGraphFixtures } from "../../../tests/fixtures/elkRouteGraphs";

const expectedEvidence = {
  "two-boundaries": { crossings: 2, warning: false },
  "dense-three-boundaries": { crossings: 4, warning: false },
  "crossing-pressure-mesh": { crossings: 9, warning: true },
};

describe("ELK routed quality gates", () => {
  it.each(elkRouteGraphFixtures)("records evidence for $name", async (fixture) => {
    const elk = new ELK();
    const result = mapElkLayeredResult(
      fixture,
      await elk.layout(buildElkLayeredGraph(fixture)),
    );
    const quality = evaluateRoutedEdgeQuality(result.edgeRoutes ?? []);
    const expected = expectedEvidence[fixture.name as keyof typeof expectedEvidence];

    expect(quality.edgeCrossingCount).toBe(expected.crossings);
    expect(quality.totalEdgeLength / fixture.edges.length).toBeLessThan(300);
    expect(result.diagnostics.some(({ code }) => code === "elk-route-crossing-heavy"))
      .toBe(expected.warning);
    expect(result.diagnostics.map(({ code }) => code)).not.toContain("elk-route-length-high");
  });

  it("warns when average routed length exceeds the spacing-aware gate", () => {
    const fixture = elkRouteGraphFixtures[0]!;
    const input = {
      nodes: fixture.nodes.slice(0, 2).map(({ parentId: _parentId, ...node }) => node),
      edges: [{ id: "long-route", source: fixture.nodes[0]!.id, target: fixture.nodes[1]!.id }],
      options: { direction: "LR" as const, rankSpacing: 100 },
    };
    const graph = buildElkLayeredGraph(input);
    graph.children = (graph.children ?? []).map((node, index) => ({ ...node, x: index * 100, y: 0 }));
    graph.edges = (graph.edges ?? []).map((edge) => ({
      ...edge,
      sections: [{
        id: "long-section",
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 900, y: 0 },
      }],
    }));

    const result = mapElkLayeredResult(input, graph);

    expect(result.diagnostics.map(({ code }) => code)).toContain("elk-route-length-high");
  });
});
