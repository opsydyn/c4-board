import {
  applyLayoutResultToEdges,
  createAsyncLayoutPreview,
  createLayoutPreview,
  isCurrentLayoutPreviewRequest,
} from "@/core/effects/layout-preview";
import { describe, expect, it } from "vitest";
import { cloneLayoutFixture, layoutGraphFixtures } from "../../../tests/fixtures/layoutGraphs";

const fixture = (name: string) =>
  cloneLayoutFixture(
    layoutGraphFixtures.find((entry) => entry.name === name)!,
  );

describe("createLayoutPreview", () => {
  it("rejects cancelled and superseded asynchronous preview completions", () => {
    const current = new AbortController();
    const cancelled = new AbortController();
    cancelled.abort();

    expect(isCurrentLayoutPreviewRequest(4, 4, current.signal)).toBe(true);
    expect(isCurrentLayoutPreviewRequest(5, 4, current.signal)).toBe(false);
    expect(isCurrentLayoutPreviewRequest(4, 4, cancelled.signal)).toBe(false);
  });

  it("creates an asynchronous ELK preview with routed edges", async () => {
    const graph = fixture("pipeline");
    const preview = await createAsyncLayoutPreview({
      ...graph,
      preset: "elkLayered",
      scope: "graph",
    }, {
      execute: async (elkGraph) => ({
        ...elkGraph,
        children: (elkGraph.children ?? []).map((node, index) => ({
          ...node,
          x: index * 300,
          y: index * 200,
        })),
        edges: (elkGraph.edges ?? []).map((edge) => ({
          ...edge,
          sections: [{
            id: `${edge.id}-section`,
            startPoint: { x: 100, y: 100 },
            bendPoints: [{ x: 100, y: 200 }],
            endPoint: { x: 300, y: 200 },
          }],
        })),
      }),
    });

    expect(preview.result.engine).toBe("elk");
    expect(preview.result.edgeRoutes?.length).toBeGreaterThan(0);
    expect(preview.appliedScope).toBe("graph");
    expect(preview.portSummary).toMatchObject({ assignedEdges: preview.result.edges.length });
    expect(preview.routedQuality).toEqual({
      edgeCrossingCount: 0,
      totalEdgeLength: 900,
    });
    const projectedEdges = applyLayoutResultToEdges(preview.result);
    expect(projectedEdges[0]).toMatchObject({
      sourceHandle: "bottom",
      targetHandle: "top",
      data: { layoutRoute: expect.any(Array) },
    });
  });

  it("builds a non-destructive graph preview with quality deltas and center control", () => {
    const graph = fixture("system-context");
    const originalPositions = graph.nodes.map((node) => ({ ...node.position }));
    const preview = createLayoutPreview({
      ...graph,
      preset: "systemContext",
      scope: "graph",
    });

    expect(preview.result.strategyId).toBe("system-context");
    expect(preview.centerControl).toMatchObject({
      kind: "system-of-interest",
      selectedNodeId: "core-system",
    });
    expect(preview.qualityDeltas.map((metric) => metric.key)).toEqual([
      "overlaps",
      "crossings",
      "edgeLength",
      "occupiedArea",
      "displacement",
    ]);
    expect(preview.routedQuality).toBeNull();
    expect(graph.nodes.map((node) => node.position)).toEqual(originalPositions);
  });

  it("falls back from selection preview to graph when no top-level nodes are selected", () => {
    const graph = fixture("hub-spoke");
    const preview = createLayoutPreview({
      ...graph,
      preset: "hubSpoke",
      scope: "selection",
    });

    expect(preview.requestedScope).toBe("selection");
    expect(preview.appliedScope).toBe("graph");
    expect(preview.result.diagnostics[0]?.code).toBe("layout-preview-selection-fallback");
  });

  it("limits center correction candidates to a selected subgraph", () => {
    const graph = fixture("hub-spoke");
    graph.nodes = graph.nodes.map((node, index) => ({
      ...node,
      selected: index < 3,
    }));
    const preview = createLayoutPreview({
      ...graph,
      preset: "hubSpoke",
      scope: "selection",
    });

    expect(preview.appliedScope).toBe("selection");
    expect(preview.centerControl?.candidates).toHaveLength(3);
    expect(preview.centerControl?.candidates.map((candidate) => candidate.id).sort()).toEqual([
      "crm",
      "erp",
      "integration-hub",
    ]);
  });

  it("recalculates around an explicit center override", () => {
    const graph = fixture("system-context");
    const preview = createLayoutPreview({
      ...graph,
      preset: "systemContext",
      scope: "graph",
      options: { systemOfInterestNodeId: "payments" },
    });

    expect(preview.centerControl?.selectedNodeId).toBe("payments");
    expect(preview.result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "system-context-unusual-system-of-interest",
    );
  });

  it("disambiguates duplicate center candidate labels", () => {
    const graph = fixture("system-context");
    graph.nodes = graph.nodes.map((node) => ({
      ...node,
      data: node.type === "person" ? { ...node.data, label: "User" } : node.data,
    }));
    const preview = createLayoutPreview({
      ...graph,
      preset: "systemContext",
      scope: "graph",
    });
    const userCandidates = preview.centerControl?.candidates.filter(
      (candidate) => candidate.label.startsWith("User · PERSON ·"),
    );

    expect(userCandidates).toHaveLength(2);
    expect(new Set(userCandidates?.map((candidate) => candidate.label)).size).toBe(2);
  });
});
