import { evaluateLayoutQuality } from "@/core/effects/layout-metrics";
import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";

const node = (id: string, x: number, y: number): Node => ({
  id,
  type: "component",
  position: { x, y },
  style: { width: 100, height: 100 },
  data: { label: id },
});

const edge = (source: string, target: string): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
});

describe("evaluateLayoutQuality", () => {
  it("measures overlaps, bounds, and occupied area", () => {
    const metrics = evaluateLayoutQuality([
      node("left", 0, 0),
      node("right", 50, 25),
    ], []);

    expect(metrics.nodeOverlapCount).toBe(1);
    expect(metrics.nodeOverlapArea).toBe(3_750);
    expect(metrics.boundingBox).toEqual({ x: 0, y: 0, width: 150, height: 125 });
    expect(metrics.occupiedArea).toBe(18_750);
    expect(metrics.aspectRatio).toBe(1.2);
  });

  it("counts proper straight-line edge crossings and edge lengths", () => {
    const nodes = [
      node("top-left", 0, 0),
      node("top-right", 200, 0),
      node("bottom-left", 0, 200),
      node("bottom-right", 200, 200),
    ];
    const edges = [
      edge("top-left", "bottom-right"),
      edge("top-right", "bottom-left"),
    ];

    const metrics = evaluateLayoutQuality(nodes, edges);

    expect(metrics.straightLineCrossingCount).toBe(1);
    expect(metrics.totalEdgeLength).toBeCloseTo(Math.sqrt(80_000) * 2);
    expect(metrics.maximumEdgeLength).toBeCloseTo(Math.sqrt(80_000));
  });

  it("measures displacement only for nodes present in both layouts", () => {
    const previous = [node("stable", 10, 10), node("moved", 0, 0)];
    const current = [
      node("stable", 10, 10),
      node("moved", 30, 40),
      node("new", 200, 200),
    ];

    const metrics = evaluateLayoutQuality(current, [], previous);

    expect(metrics.displacedNodeCount).toBe(1);
    expect(metrics.averageNodeDisplacement).toBe(50);
    expect(metrics.maximumNodeDisplacement).toBe(50);
  });

  it("uses absolute positions for nested nodes", () => {
    const parent = node("parent", 200, 100);
    const child = { ...node("child", 20, 30), parentId: "parent" };

    const metrics = evaluateLayoutQuality([parent, child], []);

    expect(metrics.boundingBox).toEqual({ x: 200, y: 100, width: 120, height: 130 });
    expect(metrics.nodeOverlapCount).toBe(0);
  });
});
