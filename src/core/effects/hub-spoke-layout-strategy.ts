import type { Edge, Node } from "@xyflow/react";
import {
  buildNodeConnectivity,
  compareNodesByConnectivity,
  compareStableIds,
  type NodeConnectivity,
} from "./layout-graph-analysis";
import { buildHierarchyDiagnostics } from "./layout-hierarchy-diagnostics";
import { evaluateLayoutQuality } from "./layout-metrics";
import type {
  LayoutAnalysis,
  LayoutDiagnostic,
  LayoutInput,
  LayoutOptions,
  LayoutResult,
  SynchronousLayoutStrategy,
} from "./layout.types";
import { assignRadialRings, positionRadialRings } from "./radial-layout";

const HUB_SPOKE_STRATEGY_ID = "hub-spoke";

interface HubSelection {
  node: Node;
  source: "explicit" | "inferred";
  confidence: number;
}

const DEFAULT_HUB_SPOKE_OPTIONS: LayoutOptions = {
  direction: "TB",
  nodeSpacing: 100,
  rankSpacing: 160,
  edgeSpacing: 20,
  snapToGrid: true,
  gridSize: 20,
  strategyId: HUB_SPOKE_STRATEGY_ID,
  ringSpacing: 120,
  startAngleDegrees: -90,
};

export const hubSpokeLayoutStrategy: SynchronousLayoutStrategy = {
  id: HUB_SPOKE_STRATEGY_ID,
  engine: "custom",
  analyse: analyseHubSpoke,
  layout: layoutHubSpoke,
};

export function analyseHubSpoke(input: LayoutInput): LayoutAnalysis {
  const topLevelNodes = input.nodes.filter((node) => !node.parentId);
  if (topLevelNodes.length === 0) {
    return { applicable: false, score: 0, reasons: ["No top-level nodes are available."] };
  }

  if (topLevelNodes.length === 1) {
    return {
      applicable: true,
      score: 0.25,
      reasons: ["A single node can be centered, but no spoke structure is present."],
    };
  }

  const connectivity = buildNodeConnectivity(topLevelNodes, input.edges);
  const maximumNeighbours = Math.max(
    ...topLevelNodes.map((node) => connectivity.get(node.id)?.neighbours.size ?? 0),
  );
  const score = maximumNeighbours / (topLevelNodes.length - 1);

  return {
    applicable: true,
    score,
    reasons: [
      `The strongest hub reaches ${maximumNeighbours} of ${topLevelNodes.length - 1} possible satellite node(s).`,
    ],
  };
}

export function layoutHubSpoke(input: LayoutInput): LayoutResult {
  const { nodes, edges } = input;
  const options = { ...DEFAULT_HUB_SPOKE_OPTIONS, ...input.options };
  const topLevelNodes = nodes.filter((node) => !node.parentId);
  const childNodes = nodes.filter((node) => node.parentId);
  const topLevelIds = new Set(topLevelNodes.map((node) => node.id));
  const topLevelEdges = edges.filter(
    (edge) => topLevelIds.has(edge.source) && topLevelIds.has(edge.target),
  );
  const diagnostics = buildHierarchyDiagnostics({
    strategyId: HUB_SPOKE_STRATEGY_ID,
    strategyLabel: "Hub-Spoke placement",
    childNodes,
    edges,
    includedEdges: topLevelEdges,
  });

  if (topLevelNodes.length === 0) {
    diagnostics.push({
      code: "hub-spoke-no-top-level-nodes",
      severity: "error",
      message: "Hub-Spoke requires at least one top-level node.",
    });
    return buildResult(nodes, edges, nodes, diagnostics);
  }

  const connectivity = buildNodeConnectivity(topLevelNodes, topLevelEdges);
  const selection = selectHub(topLevelNodes, connectivity, options.hubNodeId);
  const invalidRequestedHub = options.hubNodeId !== undefined
    && selection.node.id !== options.hubNodeId;

  if (invalidRequestedHub) {
    diagnostics.push({
      code: "hub-spoke-requested-hub-unavailable",
      severity: "warning",
      message: `Requested hub '${options.hubNodeId}' is not a top-level node; an inferred hub was used.`,
    });
  }

  diagnostics.push({
    code: "hub-spoke-hub-selected",
    severity: "info",
    message: `${selection.source === "explicit" ? "Selected" : "Inferred"} hub '${selection.node.id}' with confidence ${
      selection.confidence.toFixed(2)
    }.`,
    nodeIds: [selection.node.id],
  });

  if (selection.source === "inferred" && selection.confidence < 0.5) {
    diagnostics.push({
      code: "hub-spoke-weak-hub",
      severity: "warning",
      message: "No dominant hub was found; review or explicitly select the intended hub.",
      nodeIds: [selection.node.id],
    });
  }

  const satellites = topLevelNodes
    .filter((node) => node.id !== selection.node.id)
    .sort(compareSatellites(selection.node.id, topLevelEdges, connectivity));
  const disconnectedNodes = satellites.filter(
    (node) => !(connectivity.get(selection.node.id)?.neighbours.has(node.id) ?? false),
  );

  if (disconnectedNodes.length > 0) {
    diagnostics.push({
      code: "hub-spoke-disconnected-satellites",
      severity: "warning",
      message: `${disconnectedNodes.length} node(s) have no direct relationship with the selected hub.`,
      nodeIds: disconnectedNodes.map((node) => node.id),
    });
  }

  const nonSpokeEdges = topLevelEdges.filter(
    (edge) => edge.source !== selection.node.id && edge.target !== selection.node.id,
  );
  if (nonSpokeEdges.length > 0) {
    diagnostics.push({
      code: "hub-spoke-secondary-relationships",
      severity: "info",
      message: `${nonSpokeEdges.length} relationship(s) connect satellites and do not influence radial placement.`,
      edgeIds: nonSpokeEdges.map((edge) => edge.id),
    });
  }

  const rings = assignRadialRings(selection.node, satellites, options);
  if (rings.length > 1) {
    diagnostics.push({
      code: "hub-spoke-multiple-rings",
      severity: "info",
      message: `${satellites.length} satellite node(s) were distributed across ${rings.length} rings to avoid overlap.`,
    });
  }

  const positionedTopLevelNodes = positionRadialRings(selection.node, rings, options);
  const layoutedNodes = [...positionedTopLevelNodes, ...childNodes];
  return buildResult(layoutedNodes, edges, nodes, diagnostics);
}

function selectHub(
  nodes: Node[],
  connectivity: Map<string, NodeConnectivity>,
  requestedHubId: string | undefined,
): HubSelection {
  const explicitHub = requestedHubId
    ? nodes.find((node) => node.id === requestedHubId)
    : undefined;
  const ranked = [...nodes].sort((left, right) => compareNodesByConnectivity(left, right, connectivity));
  const selected = explicitHub ?? ranked[0]!;
  const neighbourCount = connectivity.get(selected.id)?.neighbours.size ?? 0;
  const maximumPossibleNeighbours = Math.max(1, nodes.length - 1);

  return {
    node: selected,
    source: explicitHub ? "explicit" : "inferred",
    confidence: explicitHub ? 1 : neighbourCount / maximumPossibleNeighbours,
  };
}

function compareSatellites(
  hubId: string,
  edges: Edge[],
  connectivity: Map<string, NodeConnectivity>,
): (left: Node, right: Node) => number {
  const category = (nodeId: string): number => {
    const inbound = edges.some((edge) => edge.source === nodeId && edge.target === hubId);
    const outbound = edges.some((edge) => edge.source === hubId && edge.target === nodeId);
    if (inbound && !outbound) return 0;
    if (inbound && outbound) return 1;
    if (outbound) return 2;
    return 3;
  };

  return (left, right) => {
    const categoryDifference = category(left.id) - category(right.id);
    if (categoryDifference !== 0) return categoryDifference;
    const degreeDifference = (connectivity.get(right.id)?.neighbours.size ?? 0)
      - (connectivity.get(left.id)?.neighbours.size ?? 0);
    return degreeDifference !== 0 ? degreeDifference : compareStableIds(left.id, right.id);
  };
}

function buildResult(
  layoutedNodes: Node[],
  edges: Edge[],
  previousNodes: Node[],
  diagnostics: LayoutDiagnostic[],
): LayoutResult {
  return {
    nodes: layoutedNodes,
    edges,
    strategyId: hubSpokeLayoutStrategy.id,
    engine: hubSpokeLayoutStrategy.engine,
    diagnostics,
    quality: evaluateLayoutQuality(layoutedNodes, edges, previousNodes),
  };
}
