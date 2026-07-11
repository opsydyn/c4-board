import type { Edge, Node } from "@xyflow/react";
import { type ElkLayeredExecutionOptions, layoutWithElk } from "./elk-layered-layout-strategy";
import {
  calculateLayout,
  calculateSelectedLayout,
  getAllC4Presets,
  getAllDDDPresets,
  getPreset,
  type LayoutApplicationAudit,
  type LayoutOptions,
  type LayoutPresetName,
  type LayoutQualityMetrics,
  type LayoutRecommendation,
  type LayoutResult,
  type LayoutRoutedQualityMetrics,
} from "./layout";
import { evaluateLayoutQuality, evaluateRoutedEdgeQuality } from "./layout-metrics";

export type LayoutPreviewScope = "graph" | "selection";
export type LayoutCenterKind = "hub" | "system-of-interest";

export interface LayoutCenterControl {
  kind: LayoutCenterKind;
  selectedNodeId: string;
  candidates: Array<{ id: string; label: string }>;
}

export interface LayoutQualityDelta {
  key: "overlaps" | "crossings" | "edgeLength" | "occupiedArea" | "displacement";
  label: string;
  current: number;
  proposed: number;
  delta: number;
  preference: "lower" | "neutral";
}

export interface LayoutPreviewModel {
  preset: LayoutPresetName;
  presetLabel: string;
  requestedScope: LayoutPreviewScope;
  appliedScope: LayoutPreviewScope;
  options: Partial<LayoutOptions>;
  result: LayoutResult;
  currentQuality: LayoutQualityMetrics;
  qualityDeltas: LayoutQualityDelta[];
  centerControl: LayoutCenterControl | null;
  portSummary: LayoutPortSummary | null;
  routedQuality: LayoutRoutedQualityMetrics | null;
  recommendation: EvaluatedLayoutRecommendation | null;
  recommendedResult: LayoutResult | null;
}

export interface EvaluatedLayoutRecommendation extends LayoutRecommendation {
  currentQuality: LayoutRoutedQualityMetrics;
  recommendedQuality: LayoutRoutedQualityMetrics;
  crossingDelta: number;
  lengthDelta: number;
}

export interface LayoutComparisonMetric {
  key: "overlaps" | "canvasArea" | "routedCrossings" | "routedLength";
  label: string;
  original: number;
  recommended: number;
  favored: "original" | "recommended" | "tie";
  format: "count" | "area" | "length";
}

export interface LayoutPortSummary {
  assignedEdges: number;
  congestedSides: number;
  busiestSide: {
    nodeId: string;
    side: string;
    edgeCount: number;
    estimatedCapacity: number;
  } | null;
}

export interface LayoutPreviewInput {
  nodes: Node[];
  edges: Edge[];
  preset: LayoutPresetName;
  scope: LayoutPreviewScope;
  options?: Partial<LayoutOptions>;
}

export function isCurrentLayoutPreviewRequest(
  activeRequestId: number,
  requestId: number,
  signal: AbortSignal,
): boolean {
  return !signal.aborted && activeRequestId === requestId;
}

export function createLayoutPreview(input: LayoutPreviewInput): LayoutPreviewModel {
  const presetOptions = getPreset(input.preset);
  const options = { ...presetOptions, ...input.options };
  const selectedNodeIds = input.nodes
    .filter((node) => node.selected)
    .map((node) => node.id);
  const hasSelectedTopLevelNodes = input.nodes.some(
    (node) => node.selected && !node.parentId,
  );
  const appliedScope = input.scope === "selection" && hasSelectedTopLevelNodes
    ? "selection"
    : "graph";
  const result = appliedScope === "selection"
    ? calculateSelectedLayout(input.nodes, input.edges, selectedNodeIds, options)
    : calculateLayout(input.nodes, input.edges, options);
  return buildLayoutPreviewModel(input, options, appliedScope, result);
}

export async function createAsyncLayoutPreview(
  input: LayoutPreviewInput,
  executionOptions: ElkLayeredExecutionOptions = {},
): Promise<LayoutPreviewModel> {
  const presetOptions = getPreset(input.preset);
  const options = { ...presetOptions, ...input.options };

  if (options.strategyId !== "elk-layered") return createLayoutPreview(input);

  const result = await layoutWithElk(
    { nodes: input.nodes, edges: input.edges, options },
    executionOptions,
  );
  const recommendation = result.diagnostics.find((diagnostic) => diagnostic.recommendation)
    ?.recommendation;
  let evaluatedRecommendation: EvaluatedLayoutRecommendation | null = null;
  let recommendedResult: LayoutResult | null = null;

  if (recommendation && result.edgeRoutes?.length) {
    recommendedResult = await layoutWithElk(
      {
        nodes: input.nodes,
        edges: input.edges,
        options: { ...options, ...recommendation.options },
      },
      executionOptions,
    );
    evaluatedRecommendation = evaluateLayoutRecommendation(
      recommendation,
      evaluateRoutedEdgeQuality(result.edgeRoutes),
      recommendedResult.edgeRoutes?.length
        ? evaluateRoutedEdgeQuality(recommendedResult.edgeRoutes)
        : null,
    );
  }

  return buildLayoutPreviewModel(
    input,
    options,
    "graph",
    result,
    evaluatedRecommendation,
    evaluatedRecommendation ? recommendedResult : null,
  );
}

function buildLayoutPreviewModel(
  input: LayoutPreviewInput,
  options: Partial<LayoutOptions>,
  appliedScope: LayoutPreviewScope,
  result: LayoutResult,
  evaluatedRecommendation?: EvaluatedLayoutRecommendation | null,
  recommendedResult?: LayoutResult | null,
): LayoutPreviewModel {
  const currentQuality = evaluateLayoutQuality(input.nodes, input.edges);

  if (input.scope === "selection" && appliedScope === "graph") {
    result.diagnostics.unshift({
      code: "layout-preview-selection-fallback",
      severity: "info",
      message: "No top-level selection is available; previewing the full graph.",
    });
  }

  return {
    preset: input.preset,
    presetLabel: getPresetLabel(input.preset),
    requestedScope: input.scope,
    appliedScope,
    options,
    result,
    currentQuality,
    qualityDeltas: buildQualityDeltas(currentQuality, result.quality),
    centerControl: buildCenterControl(input.nodes, options, result, appliedScope),
    portSummary: buildPortSummary(result),
    routedQuality: result.edgeRoutes?.length
      ? evaluateRoutedEdgeQuality(result.edgeRoutes)
      : null,
    recommendation: evaluatedRecommendation ?? null,
    recommendedResult: recommendedResult ?? null,
  };
}

export function promoteLayoutRecommendation(
  preview: LayoutPreviewModel,
): LayoutPreviewModel | null {
  if (!preview.recommendation || !preview.recommendedResult) return null;
  const result = preview.recommendedResult;
  return {
    ...preview,
    options: { ...preview.options, ...preview.recommendation.options },
    result,
    qualityDeltas: buildQualityDeltas(preview.currentQuality, result.quality),
    portSummary: buildPortSummary(result),
    routedQuality: result.edgeRoutes?.length
      ? evaluateRoutedEdgeQuality(result.edgeRoutes)
      : null,
    recommendation: null,
    recommendedResult: null,
  };
}

export function buildLayoutComparisonMetrics(
  original: LayoutPreviewModel,
  recommended: LayoutPreviewModel,
): LayoutComparisonMetric[] {
  const metrics: LayoutComparisonMetric[] = [
    comparisonMetric(
      "overlaps",
      "Overlaps",
      original.result.quality.nodeOverlapCount,
      recommended.result.quality.nodeOverlapCount,
      "count",
    ),
    comparisonMetric(
      "canvasArea",
      "Canvas area",
      original.result.quality.occupiedArea,
      recommended.result.quality.occupiedArea,
      "area",
    ),
  ];

  if (original.routedQuality && recommended.routedQuality) {
    metrics.push(
      comparisonMetric(
        "routedCrossings",
        "Routed crossings",
        original.routedQuality.edgeCrossingCount,
        recommended.routedQuality.edgeCrossingCount,
        "count",
      ),
      comparisonMetric(
        "routedLength",
        "Routed length",
        original.routedQuality.totalEdgeLength,
        recommended.routedQuality.totalEdgeLength,
        "length",
      ),
    );
  }

  return metrics;
}

function comparisonMetric(
  key: LayoutComparisonMetric["key"],
  label: string,
  original: number,
  recommended: number,
  format: LayoutComparisonMetric["format"],
): LayoutComparisonMetric {
  const tolerance = format === "count" ? 0 : 0.5;
  const favored = Math.abs(original - recommended) <= tolerance
    ? "tie"
    : original < recommended
    ? "original"
    : "recommended";
  return { key, label, original, recommended, favored, format };
}

export function evaluateLayoutRecommendation(
  recommendation: LayoutRecommendation,
  currentQuality: LayoutRoutedQualityMetrics,
  recommendedQuality: LayoutRoutedQualityMetrics | null,
): EvaluatedLayoutRecommendation | null {
  if (!recommendedQuality) return null;
  const crossingDelta = recommendedQuality.edgeCrossingCount - currentQuality.edgeCrossingCount;
  const lengthDelta = recommendedQuality.totalEdgeLength - currentQuality.totalEdgeLength;
  const meaningfullyShorter = lengthDelta < -Math.max(1, currentQuality.totalEdgeLength * 0.01);
  const improves = crossingDelta < 0 || (crossingDelta === 0 && meaningfullyShorter);
  if (!improves) return null;

  return {
    ...recommendation,
    currentQuality,
    recommendedQuality,
    crossingDelta,
    lengthDelta,
  };
}

export function buildLayoutApplicationAudit(
  preview: LayoutPreviewModel,
  selectedVariant: LayoutApplicationAudit["selectedVariant"],
  comparisonMetrics: LayoutComparisonMetric[],
  appliedAt = Date.now(),
): LayoutApplicationAudit {
  return {
    version: 1,
    appliedAt,
    preset: preview.preset,
    strategyId: preview.result.strategyId,
    engine: preview.result.engine,
    selectedVariant,
    comparisonMetrics: comparisonMetrics.map(({ key, original, recommended, favored }) => ({
      key,
      original,
      recommended,
      favored,
    })),
  };
}

export function applyLayoutResultToEdges(
  result: LayoutResult,
  audit?: LayoutApplicationAudit,
): Edge[] {
  const routeByEdgeId = new Map(
    result.edgeRoutes?.map((route) => [route.edgeId, route.sections]) ?? [],
  );
  const portsByEdgeId = new Map(
    result.edgePortAssignments?.map((assignment) => [assignment.edgeId, assignment]) ?? [],
  );

  return result.edges.map((edge) => {
    const {
      layoutAudit: _previousAudit,
      layoutRoute: _previousRoute,
      ...data
    } = edge.data ?? {};
    const layoutRoute = routeByEdgeId.get(edge.id);
    const ports = portsByEdgeId.get(edge.id);
    return {
      ...edge,
      sourceHandle: ports?.sourceHandle ?? null,
      targetHandle: ports?.targetHandle ?? null,
      data: {
        ...data,
        ...(layoutRoute && { layoutRoute }),
        ...(audit && { layoutAudit: audit }),
      },
    };
  });
}

function buildPortSummary(result: LayoutResult): LayoutPortSummary | null {
  if (!result.edgePortAssignments || !result.portCongestion) return null;
  const busiestSide = [...result.portCongestion]
    .sort((left, right) =>
      right.edgeCount - left.edgeCount
      || left.nodeId.localeCompare(right.nodeId)
      || left.side.localeCompare(right.side)
    )[0] ?? null;

  return {
    assignedEdges: result.edgePortAssignments.length,
    congestedSides: result.portCongestion.filter((entry) => entry.congested).length,
    busiestSide,
  };
}

function getPresetLabel(preset: LayoutPresetName): string {
  const metadata = [...getAllC4Presets(), ...getAllDDDPresets()]
    .find((entry) => entry.name === preset);
  return metadata?.label ?? preset;
}

function buildQualityDeltas(
  current: LayoutQualityMetrics,
  proposed: LayoutQualityMetrics,
): LayoutQualityDelta[] {
  return [
    delta("overlaps", "Overlaps", current.nodeOverlapCount, proposed.nodeOverlapCount, "lower"),
    delta(
      "crossings",
      "Straight crossings",
      current.straightLineCrossingCount,
      proposed.straightLineCrossingCount,
      "lower",
    ),
    delta("edgeLength", "Straight length", current.totalEdgeLength, proposed.totalEdgeLength, "lower"),
    delta("occupiedArea", "Canvas area", current.occupiedArea, proposed.occupiedArea, "lower"),
    delta("displacement", "Movement", 0, proposed.averageNodeDisplacement, "neutral"),
  ];
}

function delta(
  key: LayoutQualityDelta["key"],
  label: string,
  current: number,
  proposed: number,
  preference: LayoutQualityDelta["preference"],
): LayoutQualityDelta {
  return { key, label, current, proposed, delta: proposed - current, preference };
}

function buildCenterControl(
  nodes: Node[],
  options: Partial<LayoutOptions>,
  result: LayoutResult,
  appliedScope: LayoutPreviewScope,
): LayoutCenterControl | null {
  const kind = options.strategyId === "hub-spoke"
    ? "hub"
    : options.strategyId === "system-context"
    ? "system-of-interest"
    : null;
  if (!kind) return null;

  const diagnosticCode = kind === "hub"
    ? "hub-spoke-hub-selected"
    : "system-context-system-selected";
  const selectedNodeId = result.diagnostics
    .find((diagnostic) => diagnostic.code === diagnosticCode)
    ?.nodeIds?.[0];
  if (!selectedNodeId) return null;

  return {
    kind,
    selectedNodeId,
    candidates: buildCenterCandidates(nodes, appliedScope),
  };
}

function buildCenterCandidates(
  nodes: Node[],
  appliedScope: LayoutPreviewScope,
): Array<{ id: string; label: string }> {
  const candidates = nodes
    .filter((node) => !node.parentId && (appliedScope === "graph" || node.selected))
    .map((node) => ({ node, baseLabel: nodeLabel(node) }));
  const labelCounts = new Map<string, number>();
  for (const candidate of candidates) {
    const normalizedLabel = candidate.baseLabel.toLowerCase();
    labelCounts.set(normalizedLabel, (labelCounts.get(normalizedLabel) ?? 0) + 1);
  }

  return candidates
    .map(({ node, baseLabel }) => ({
      id: node.id,
      label: (labelCounts.get(baseLabel.toLowerCase()) ?? 0) > 1
        ? `${baseLabel} · ${(node.type ?? "node").toUpperCase()} · ${node.id.slice(-6).toUpperCase()}`
        : baseLabel,
    }))
    .sort((left, right) =>
      left.label === right.label
        ? compareIds(left.id, right.id)
        : compareIds(left.label, right.label)
    );
}

function nodeLabel(node: Node): string {
  const label = node.data?.label;
  return typeof label === "string" && label.trim().length > 0 ? label : node.id;
}

function compareIds(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}
