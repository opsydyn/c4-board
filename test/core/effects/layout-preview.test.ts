import {
  applyLayoutResultToEdges,
  buildLayoutApplicationAudit,
  buildLayoutComparisonMetrics,
  createAsyncLayoutPreview,
  createLayoutPreview,
  evaluateLayoutRecommendation,
  isCurrentLayoutPreviewRequest,
  promoteLayoutRecommendation,
} from "@/core/effects/layout-preview";
import ELK from "elkjs/lib/elk.bundled.js";
import { describe, expect, it } from "vitest";
import { elkRouteGraphFixtures } from "../../../tests/fixtures/elkRouteGraphs";
import { cloneLayoutFixture, layoutGraphFixtures } from "../../../tests/fixtures/layoutGraphs";

const fixture = (name: string) =>
  cloneLayoutFixture(
    layoutGraphFixtures.find((entry) => entry.name === name)!,
  );

describe("createLayoutPreview", () => {
  it("keeps only recommendations that improve routed quality", () => {
    const recommendation = {
      id: "change-direction" as const,
      label: "Try top-to-bottom routing",
      rationale: "Separate route channels.",
      options: { direction: "TB" as const },
    };
    const current = { edgeCrossingCount: 9, totalEdgeLength: 3_500 };

    expect(evaluateLayoutRecommendation(
      recommendation,
      current,
      { edgeCrossingCount: 4, totalEdgeLength: 4_000 },
    )).toMatchObject({ crossingDelta: -5, lengthDelta: 500 });
    expect(evaluateLayoutRecommendation(
      recommendation,
      current,
      { edgeCrossingCount: 9, totalEdgeLength: 3_480 },
    )).toBeNull();
    expect(evaluateLayoutRecommendation(
      recommendation,
      current,
      { edgeCrossingCount: 10, totalEdgeLength: 2_000 },
    )).toBeNull();
  });

  it("suppresses a real ELK recommendation when the alternative does not improve", async () => {
    const fixture = elkRouteGraphFixtures.find(({ name }) => name === "crossing-pressure-mesh")!;
    const elk = new ELK();
    let executionCount = 0;
    const preview = await createAsyncLayoutPreview({
      nodes: fixture.nodes,
      edges: fixture.edges,
      ...(fixture.options && { options: fixture.options }),
      preset: "elkLayered",
      scope: "graph",
    }, {
      execute: async (graph) => {
        executionCount += 1;
        return elk.layout(graph);
      },
    });

    expect(executionCount).toBe(2);
    expect(preview.result.diagnostics.map(({ code }) => code)).toContain("elk-route-crossing-heavy");
    expect(preview.recommendation).toBeNull();
  });

  it("promotes a cached recommendation without recalculating layout", () => {
    const graph = fixture("system-context");
    const preview = createLayoutPreview({
      ...graph,
      preset: "systemContext",
      scope: "graph",
    });
    const recommendedResult = {
      ...preview.result,
      nodes: preview.result.nodes.map((node) => ({
        ...node,
        position: { x: node.position.x + 50, y: node.position.y + 20 },
      })),
      quality: { ...preview.result.quality, totalEdgeLength: 900 },
    };
    preview.recommendation = {
      id: "change-direction",
      label: "Try top-to-bottom routing",
      rationale: "Separate route channels.",
      options: { direction: "TB" },
      currentQuality: { edgeCrossingCount: 8, totalEdgeLength: 1_200 },
      recommendedQuality: { edgeCrossingCount: 3, totalEdgeLength: 900 },
      crossingDelta: -5,
      lengthDelta: -300,
    };
    preview.recommendedResult = recommendedResult;

    const promoted = promoteLayoutRecommendation(preview);

    expect(promoted).toMatchObject({
      options: { direction: "TB" },
      result: recommendedResult,
      recommendation: null,
      recommendedResult: null,
    });
    expect(preview.result).not.toBe(recommendedResult);
    expect(buildLayoutComparisonMetrics(preview, promoted!)).toEqual([
      expect.objectContaining({ key: "overlaps", favored: "tie" }),
      expect.objectContaining({ key: "canvasArea", favored: "tie" }),
    ]);
  });

  it("keeps individual comparison outcomes instead of an aggregate score", () => {
    const graph = fixture("system-context");
    const original = createLayoutPreview({ ...graph, preset: "systemContext", scope: "graph" });
    const recommended = {
      ...original,
      result: {
        ...original.result,
        quality: {
          ...original.result.quality,
          nodeOverlapCount: original.result.quality.nodeOverlapCount + 1,
          occupiedArea: original.result.quality.occupiedArea - 1_000,
        },
      },
      routedQuality: { edgeCrossingCount: 2, totalEdgeLength: 800 },
    };
    original.routedQuality = { edgeCrossingCount: 4, totalEdgeLength: 700 };

    expect(
      buildLayoutComparisonMetrics(original, recommended).map(({ key, favored }) => ({
        key,
        favored,
      })),
    ).toEqual([
      { key: "overlaps", favored: "original" },
      { key: "canvasArea", favored: "recommended" },
      { key: "routedCrossings", favored: "recommended" },
      { key: "routedLength", favored: "original" },
    ]);
  });

  it("builds deterministic application audit metadata from the active comparison", () => {
    const graph = fixture("system-context");
    const preview = createLayoutPreview({ ...graph, preset: "systemContext", scope: "graph" });
    const metrics = buildLayoutComparisonMetrics(preview, preview);
    const audit = buildLayoutApplicationAudit(preview, "original", metrics, 123);
    const edges = applyLayoutResultToEdges(preview.result);

    expect(audit).toMatchObject({
      version: 1,
      appliedAt: 123,
      preset: "systemContext",
      strategyId: "system-context",
      engine: "custom",
      selectedVariant: "original",
    });
    expect(audit.comparisonMetrics).toHaveLength(2);
    expect(edges.every((edge) => edge.data?.layoutAudit === undefined)).toBe(true);
  });

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
