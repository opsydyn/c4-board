import ELK from "elkjs/lib/elk.bundled.js";
import { describe, expect, it } from "vitest";

import { buildElkLayeredGraph, evaluateElkRouteQuality, mapElkLayeredResult } from "@/core/effects/elk-layout-mapper";
import type { LayoutInput } from "@/core/effects/layout.types";
import { cloneLayoutFixture, layoutGraphFixtures } from "../../../tests/fixtures/layoutGraphs";

const compoundInput: LayoutInput = {
  nodes: [
    { id: "system", type: "system", position: { x: 0, y: 0 }, data: {} },
    {
      id: "api",
      type: "container",
      parentId: "system",
      position: { x: 20, y: 20 },
      data: {},
    },
    { id: "person", type: "person", position: { x: 600, y: 0 }, data: {} },
  ],
  edges: [{ id: "uses", source: "person", target: "api" }],
};

describe("ELK layered graph mapper", () => {
  it("maps compound nodes, dimensions, edges, and deterministic options", () => {
    const graph = buildElkLayeredGraph(compoundInput);
    const system = graph.children?.find((node) => node.id === "system");

    expect(system).toMatchObject({ id: "system", width: 240, height: 140 });
    expect(system?.children?.[0]).toMatchObject({ id: "api", width: 280, height: 200 });
    expect(graph.children?.map((node) => node.id)).toEqual(["system", "person"]);
    expect(graph.children?.find((node) => node.id === "person")?.ports).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "person::bottom::uses" }),
    ]));
    expect(graph.edges).toEqual([{
      id: "uses",
      sources: ["person::bottom::uses"],
      targets: ["api::top::uses"],
    }]);
    expect(graph.layoutOptions).toMatchObject({
      "elk.algorithm": "layered",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.hierarchyHandling": "INCLUDE_CHILDREN",
      "elk.randomSeed": "1",
    });
  });

  it("produces deterministic compound positions, bounds, and routed edges", async () => {
    const elk = new ELK();
    const first = mapElkLayeredResult(
      compoundInput,
      await elk.layout(buildElkLayeredGraph(compoundInput)),
    );
    const second = mapElkLayeredResult(
      compoundInput,
      await elk.layout(buildElkLayeredGraph(compoundInput)),
    );

    expect(first.nodes.map(({ id, position }) => ({ id, position }))).toEqual(
      second.nodes.map(({ id, position }) => ({ id, position })),
    );
    expect(first.nodeBounds).toEqual(second.nodeBounds);
    expect(first.edgeRoutes).toEqual(second.edgeRoutes);
    expect(first.edgePortAssignments).toEqual([expect.objectContaining({
      edgeId: "uses",
      sourceHandle: "bottom",
      targetHandle: "top",
      semanticClass: "request",
    })]);
    expect(first.nodeBounds).toHaveLength(3);
    expect(first.edgeRoutes?.[0]?.sections.length).toBeGreaterThan(0);
    expect(first.quality.nodeOverlapCount).toBe(0);
  });

  it("maps fixed ports for every layout direction", () => {
    const leftToRight = buildElkLayeredGraph({
      ...compoundInput,
      options: { direction: "LR" },
    });
    expect(leftToRight.edges?.[0]).toMatchObject({
      sources: ["person::right::uses"],
      targets: ["api::left::uses"],
    });

    const bottomToTopGraph = buildElkLayeredGraph({
      ...compoundInput,
      options: { direction: "BT" },
    });
    expect(bottomToTopGraph.edges?.[0]).toMatchObject({
      sources: ["person::top::uses"],
      targets: ["api::bottom::uses"],
    });
    const reverseResult = mapElkLayeredResult(
      { ...compoundInput, options: { direction: "BT" } },
      {
        id: "root",
        children: compoundInput.nodes.map((node) => ({
          id: node.id,
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        })),
      },
    );
    expect(reverseResult.edgePortAssignments).toEqual([expect.objectContaining({
      edgeId: "uses",
      sourceHandle: "top",
      targetHandle: "bottom",
    })]);

    const rightToLeft = buildElkLayeredGraph({
      ...compoundInput,
      options: { direction: "RL" },
    });
    expect(rightToLeft.edges?.[0]).toMatchObject({
      sources: ["person::left::uses"],
      targets: ["api::right::uses"],
    });
  });

  it("allocates high-degree ports deterministically and reports congestion", () => {
    const hub = { id: "hub", type: "system", position: { x: 0, y: 0 }, data: {} };
    const satellites = Array.from({ length: 12 }, (_, index) => ({
      id: `satellite-${index.toString().padStart(2, "0")}`,
      type: index === 0 ? "domainEvent" : "component",
      position: { x: 0, y: 0 },
      data: {},
    }));
    const edges = satellites.map((satellite, index) => ({
      id: `edge-${index.toString().padStart(2, "0")}`,
      source: hub.id,
      target: satellite.id,
      ...(index === 1 && { label: "command: refresh" }),
    }));
    const input: LayoutInput = { nodes: [hub, ...satellites], edges };
    const forward = buildElkLayeredGraph(input, "semantic");
    const reversed = buildElkLayeredGraph({ ...input, edges: [...edges].reverse() }, "semantic");
    const forwardPorts = forward.children?.find((node) => node.id === hub.id)?.ports;
    const reversedPorts = reversed.children?.find((node) => node.id === hub.id)?.ports;

    expect(forwardPorts).toEqual(reversedPorts);
    expect(forwardPorts).toHaveLength(12);
    const incremental = buildElkLayeredGraph({
      nodes: [
        ...input.nodes,
        { id: "satellite--1", type: "component", position: { x: 0, y: 0 }, data: {} },
      ],
      edges: [
        ...edges,
        { id: "edge-new", source: hub.id, target: "satellite--1" },
      ],
    }, "semantic");
    const originalSourcePorts = new Map(forward.edges?.map((edge) => [edge.id, edge.sources[0]]));
    for (const edge of incremental.edges ?? []) {
      if (edge.id !== "edge-new") expect(edge.sources[0]).toBe(originalSourcePorts.get(edge.id));
    }

    const mapped = mapElkLayeredResult(
      input,
      {
        ...forward,
        children: (forward.children ?? []).map((node) => ({ ...node, x: 0, y: 0 })),
      },
      "elk-layered",
      "semantic",
    );
    expect(mapped.edgePortAssignments?.find(({ edgeId }) => edgeId === "edge-01"))
      .toMatchObject({ semanticClass: "command", sourceOrder: 0 });
    expect(mapped.edgePortAssignments?.find(({ edgeId }) => edgeId === "edge-00"))
      .toMatchObject({ semanticClass: "event", sourceOrder: 1 });
    expect(mapped.portCongestion).toContainEqual(expect.objectContaining({
      nodeId: "hub",
      side: "bottom",
      edgeCount: 12,
      congested: true,
    }));
    expect(mapped.diagnostics.map(({ code }) => code)).toContain("elk-port-congestion-detected");
  });

  it.each(["BT", "RL"] as const)("routes a compound edge through %s ports", async (direction) => {
    const elk = new ELK();
    const result = mapElkLayeredResult(
      { ...compoundInput, options: { direction } },
      await elk.layout(buildElkLayeredGraph({ ...compoundInput, options: { direction } })),
    );

    expect(result.edgeRoutes?.[0]?.sections.length).toBeGreaterThan(0);
    expect(result.edgePortAssignments).toHaveLength(1);
    expect(result.diagnostics.map(({ code }) => code)).toContain("elk-fixed-ports-applied");
  });

  it("preserves a node and reports a diagnostic when ELK omits its position", () => {
    const input: LayoutInput = {
      nodes: [{ id: "missing", position: { x: 25, y: 30 }, data: {} }],
      edges: [],
    };
    const result = mapElkLayeredResult(input, {
      id: "root",
      children: [{ id: "missing", width: 100, height: 100 }],
    });

    expect(result.nodes[0]?.position).toEqual({ x: 25, y: 30 });
    expect(result.diagnostics.map(({ code }) => code)).toContain("elk-node-position-missing");
  });

  it.each(["event-driven", "client-server"])(
    "compares semantic and stable port ordering on the %s fixture",
    async (fixtureName) => {
      const fixture = cloneLayoutFixture(layoutGraphFixtures.find(({ name }) => name === fixtureName)!);
      const input: LayoutInput = { nodes: fixture.nodes, edges: fixture.edges, options: { direction: "LR" } };
      const elk = new ELK();
      const semantic = mapElkLayeredResult(
        input,
        await elk.layout(buildElkLayeredGraph(input, "semantic")),
        "elk-layered",
        "semantic",
      );
      const stable = mapElkLayeredResult(
        input,
        await elk.layout(buildElkLayeredGraph(input, "stable")),
        "elk-layered",
        "stable",
      );
      const semanticQuality = evaluateElkRouteQuality(semantic);
      const stableQuality = evaluateElkRouteQuality(stable);

      const semanticClasses = semantic.edgePortAssignments?.map(({ semanticClass }) => semanticClass);
      expect(semanticClasses).toEqual(expect.arrayContaining(
        fixtureName === "event-driven"
          ? ["command", "event"]
          : ["command", "event", "request", "data"],
      ));
      expect(semanticQuality.congestedSideCount).toBe(stableQuality.congestedSideCount);
      expect(semanticQuality.crossingCount).toBeLessThanOrEqual(stableQuality.crossingCount);
      expect(semanticQuality.totalRouteLength).toBeLessThanOrEqual(stableQuality.totalRouteLength);
      const comparableQuality = (quality: typeof semanticQuality) => ({
        ...quality,
        totalRouteLength: Math.round(quality.totalRouteLength * 1_000) / 1_000,
      });
      expect({
        semantic: comparableQuality(semanticQuality),
        stable: comparableQuality(stableQuality),
      }).toEqual(
        fixtureName === "event-driven"
          ? {
            semantic: { congestedSideCount: 0, crossingCount: 0, totalRouteLength: 772.667 },
            stable: { congestedSideCount: 0, crossingCount: 0, totalRouteLength: 772.667 },
          }
          : {
            semantic: { congestedSideCount: 1, crossingCount: 0, totalRouteLength: 1_825.133 },
            stable: { congestedSideCount: 1, crossingCount: 0, totalRouteLength: 1_825.133 },
          },
      );
    },
  );
});
