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

const SYSTEM_CONTEXT_STRATEGY_ID = "system-context";

type ContextRole = "person" | "internal" | "external" | "other";

interface SystemSelection {
  node: Node;
  source: "explicit" | "inferred";
  confidence: number;
  usedFallbackType: boolean;
}

const DEFAULT_SYSTEM_CONTEXT_OPTIONS: LayoutOptions = {
  direction: "TB",
  nodeSpacing: 120,
  rankSpacing: 200,
  edgeSpacing: 20,
  snapToGrid: true,
  gridSize: 20,
  strategyId: SYSTEM_CONTEXT_STRATEGY_ID,
  ringSpacing: 140,
  startAngleDegrees: -90,
};

export const systemContextLayoutStrategy: SynchronousLayoutStrategy = {
  id: SYSTEM_CONTEXT_STRATEGY_ID,
  engine: "custom",
  analyse: analyseSystemContext,
  layout: layoutSystemContext,
};

export function analyseSystemContext(input: LayoutInput): LayoutAnalysis {
  const topLevelNodes = input.nodes.filter((node) => !node.parentId);
  const systemCandidates = topLevelNodes.filter((node) => effectiveNodeType(node) === "system");

  if (topLevelNodes.length === 0) {
    return { applicable: false, score: 0, reasons: ["No top-level nodes are available."] };
  }

  if (systemCandidates.length === 0) {
    return {
      applicable: true,
      score: 0.25,
      reasons: ["No top-level software system is available as the system of interest."],
    };
  }

  if (systemCandidates.length === 1) {
    return {
      applicable: true,
      score: 1,
      reasons: [`Software system '${systemCandidates[0]!.id}' is the unambiguous system of interest.`],
    };
  }

  const connectivity = buildNodeConnectivity(topLevelNodes, input.edges);
  const strongestCandidate = [...systemCandidates].sort((left, right) =>
    compareNodesByConnectivity(left, right, connectivity)
  )[0]!;
  const reach = (connectivity.get(strongestCandidate.id)?.neighbours.size ?? 0)
    / Math.max(1, topLevelNodes.length - 1);

  return {
    applicable: true,
    score: reach,
    reasons: [
      `${systemCandidates.length} software systems are candidates; '${strongestCandidate.id}' has the strongest context reach.`,
    ],
  };
}

export function layoutSystemContext(input: LayoutInput): LayoutResult {
  const { nodes, edges } = input;
  const options = { ...DEFAULT_SYSTEM_CONTEXT_OPTIONS, ...input.options };
  const topLevelNodes = nodes.filter((node) => !node.parentId);
  const childNodes = nodes.filter((node) => node.parentId);
  const topLevelIds = new Set(topLevelNodes.map((node) => node.id));
  const topLevelEdges = edges.filter(
    (edge) => topLevelIds.has(edge.source) && topLevelIds.has(edge.target),
  );
  const diagnostics = buildHierarchyDiagnostics({
    strategyId: SYSTEM_CONTEXT_STRATEGY_ID,
    strategyLabel: "System Context placement",
    childNodes,
    edges,
    includedEdges: topLevelEdges,
  });

  if (topLevelNodes.length === 0) {
    diagnostics.push({
      code: "system-context-no-top-level-nodes",
      severity: "error",
      message: "System Context requires at least one top-level node.",
    });
    return buildResult(nodes, edges, nodes, diagnostics);
  }

  const connectivity = buildNodeConnectivity(topLevelNodes, topLevelEdges);
  const selection = selectSystemOfInterest(
    topLevelNodes,
    connectivity,
    options.systemOfInterestNodeId,
  );
  const invalidRequestedSystem = options.systemOfInterestNodeId !== undefined
    && selection.node.id !== options.systemOfInterestNodeId;

  if (invalidRequestedSystem) {
    diagnostics.push({
      code: "system-context-requested-system-unavailable",
      severity: "warning",
      message:
        `Requested system of interest '${options.systemOfInterestNodeId}' is not a top-level node; an inferred system was used.`,
    });
  }

  if (selection.usedFallbackType) {
    diagnostics.push({
      code: "system-context-no-software-system",
      severity: "warning",
      message: "No software-system node was available; the strongest internal or connected node was used.",
      nodeIds: [selection.node.id],
    });
  }

  const selectedRole = classifyContextRole(selection.node);
  if (selection.source === "explicit" && (selectedRole === "person" || selectedRole === "external")) {
    diagnostics.push({
      code: "system-context-unusual-system-of-interest",
      severity: "warning",
      message: `Explicit system of interest '${selection.node.id}' is classified as ${selectedRole}.`,
      nodeIds: [selection.node.id],
    });
  }

  diagnostics.push({
    code: "system-context-system-selected",
    severity: "info",
    message: `${
      selection.source === "explicit" ? "Selected" : "Inferred"
    } system of interest '${selection.node.id}' with confidence ${selection.confidence.toFixed(2)}.`,
    nodeIds: [selection.node.id],
  });

  if (selection.source === "inferred" && selection.confidence < 0.5) {
    diagnostics.push({
      code: "system-context-ambiguous-system",
      severity: "warning",
      message: "System-of-interest inference is ambiguous; review or explicitly select the intended software system.",
      nodeIds: [selection.node.id],
    });
  }

  const satellites = topLevelNodes
    .filter((node) => node.id !== selection.node.id)
    .sort(compareContextSatellites(connectivity));
  const roleCounts = countRoles(satellites);
  diagnostics.push({
    code: "system-context-sectors",
    severity: "info",
    message:
      `Context sectors contain ${roleCounts.person} people, ${roleCounts.internal} internal elements, ${roleCounts.external} external systems, and ${roleCounts.other} other elements.`,
  });

  const disconnectedNodes = satellites.filter(
    (node) => !(connectivity.get(selection.node.id)?.neighbours.has(node.id) ?? false),
  );
  if (disconnectedNodes.length > 0) {
    diagnostics.push({
      code: "system-context-disconnected-elements",
      severity: "warning",
      message:
        `${disconnectedNodes.length} context element(s) have no direct relationship with the system of interest.`,
      nodeIds: disconnectedNodes.map((node) => node.id),
    });
  }

  const secondaryEdges = topLevelEdges.filter(
    (edge) => edge.source !== selection.node.id && edge.target !== selection.node.id,
  );
  if (secondaryEdges.length > 0) {
    diagnostics.push({
      code: "system-context-secondary-relationships",
      severity: "info",
      message:
        `${secondaryEdges.length} relationship(s) connect context elements and do not influence radial placement.`,
      edgeIds: secondaryEdges.map((edge) => edge.id),
    });
  }

  const rings = assignRadialRings(selection.node, satellites, options);
  if (rings.length > 1) {
    diagnostics.push({
      code: "system-context-multiple-rings",
      severity: "info",
      message:
        `${satellites.length} context element(s) were distributed across ${rings.length} rings to avoid overlap.`,
    });
  }

  const positionedTopLevelNodes = positionRadialRings(selection.node, rings, options);
  const layoutedNodes = [...positionedTopLevelNodes, ...childNodes];
  return buildResult(layoutedNodes, edges, nodes, diagnostics);
}

function selectSystemOfInterest(
  nodes: Node[],
  connectivity: Map<string, NodeConnectivity>,
  requestedNodeId: string | undefined,
): SystemSelection {
  const explicitSystem = requestedNodeId
    ? nodes.find((node) => node.id === requestedNodeId)
    : undefined;
  const softwareSystems = nodes.filter((node) => effectiveNodeType(node) === "system");
  const internalNodes = nodes.filter((node) => classifyContextRole(node) === "internal");
  const candidatePool = softwareSystems.length > 0
    ? softwareSystems
    : internalNodes.length > 0
    ? internalNodes
    : nodes;
  const inferred = [...candidatePool].sort((left, right) => compareNodesByConnectivity(left, right, connectivity))[0]!;
  const selected = explicitSystem ?? inferred;
  const neighbourCount = connectivity.get(selected.id)?.neighbours.size ?? 0;
  const unambiguousType = !explicitSystem && softwareSystems.length === 1;

  return {
    node: selected,
    source: explicitSystem ? "explicit" : "inferred",
    confidence: explicitSystem || unambiguousType
      ? 1
      : neighbourCount / Math.max(1, nodes.length - 1),
    usedFallbackType: !explicitSystem && softwareSystems.length === 0,
  };
}

function compareContextSatellites(
  connectivity: Map<string, NodeConnectivity>,
): (left: Node, right: Node) => number {
  return (left, right) => {
    const roleDifference = roleOrder(classifyContextRole(left))
      - roleOrder(classifyContextRole(right));
    if (roleDifference !== 0) return roleDifference;
    const connectivityDifference = compareNodesByConnectivity(left, right, connectivity);
    return connectivityDifference !== 0
      ? connectivityDifference
      : compareStableIds(left.id, right.id);
  };
}

function classifyContextRole(node: Node): ContextRole {
  const nodeType = effectiveNodeType(node);
  if (nodeType === "person") return "person";
  if (nodeType === "externalSystem") return "external";
  if (nodeType === "system" || nodeType === "container" || nodeType === "component") {
    return "internal";
  }
  return "other";
}

function effectiveNodeType(node: Node): string | undefined {
  const c4Type = node.data?.c4Type;
  return typeof c4Type === "string" ? c4Type : node.type;
}

function roleOrder(role: ContextRole): number {
  switch (role) {
    case "person":
      return 0;
    case "internal":
      return 1;
    case "external":
      return 2;
    case "other":
      return 3;
  }
}

function countRoles(nodes: Node[]): Record<ContextRole, number> {
  const counts: Record<ContextRole, number> = {
    person: 0,
    internal: 0,
    external: 0,
    other: 0,
  };
  for (const node of nodes) counts[classifyContextRole(node)] += 1;
  return counts;
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
    strategyId: systemContextLayoutStrategy.id,
    engine: systemContextLayoutStrategy.engine,
    diagnostics,
    quality: evaluateLayoutQuality(layoutedNodes, edges, previousNodes),
  };
}
