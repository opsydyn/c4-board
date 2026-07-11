import type { Edge, Node, XYPosition } from "@xyflow/react";
import {
  type ArchitectureRoleAssignment,
  type ArchitectureSemanticRole,
  inferEventDrivenRoles,
} from "./architecture-role-classification";
import { buildHierarchyDiagnostics } from "./layout-hierarchy-diagnostics";
import { evaluateLayoutQuality } from "./layout-metrics";
import { getNodeDimensions } from "./layout-node-size";
import type {
  LayoutAnalysis,
  LayoutDiagnostic,
  LayoutInput,
  LayoutOptions,
  LayoutResult,
  SynchronousLayoutStrategy,
} from "./layout.types";

const EVENT_DRIVEN_STRATEGY_ID = "event-driven";
const MARGIN = 40;

const DEFAULT_EVENT_DRIVEN_OPTIONS: LayoutOptions = {
  direction: "LR",
  nodeSpacing: 120,
  rankSpacing: 200,
  edgeSpacing: 20,
  snapToGrid: true,
  gridSize: 20,
  strategyId: EVENT_DRIVEN_STRATEGY_ID,
};

interface BusAffinity {
  sourceBusIds: string[];
  destinationBusIds: string[];
  primarySourceBusId: string | null;
  primaryDestinationBusId: string | null;
}

interface PlacementPlan {
  bands: string[];
  affinityByNodeId: Map<string, BusAffinity>;
  supportNodeIds: string[];
  reviewNodeIds: string[];
  bridgeNodeIds: string[];
}

export const eventDrivenLayoutStrategy: SynchronousLayoutStrategy = {
  id: EVENT_DRIVEN_STRATEGY_ID,
  engine: "custom",
  analyse: analyseEventDriven,
  layout: layoutEventDriven,
};

export function analyseEventDriven(input: LayoutInput): LayoutAnalysis {
  const topLevelNodes = sortedNodes(input.nodes.filter((node) => !node.parentId));
  if (topLevelNodes.length === 0) {
    return { applicable: false, score: 0, reasons: ["No top-level nodes are available."] };
  }

  const classification = inferEventDrivenRoles(topLevelNodes, topLevelEdges(topLevelNodes, input.edges));
  const confident = classification.assignments.filter(({ confidence }) => confidence >= 0.65).length;
  const busCount = classification.assignments.filter(({ role }) => role === "event-bus").length;
  return {
    applicable: true,
    score: (confident / topLevelNodes.length) * (busCount > 0 ? 1 : 0.5),
    reasons: [
      `${confident} of ${topLevelNodes.length} node(s) have confident Event-Driven roles.`,
      `${busCount} event bus node(s) were identified.`,
    ],
  };
}

export function layoutEventDriven(input: LayoutInput): LayoutResult {
  const options = { ...DEFAULT_EVENT_DRIVEN_OPTIONS, ...input.options };
  const topLevelNodes = sortedNodes(input.nodes.filter((node) => !node.parentId));
  const childNodes = sortedNodes(input.nodes.filter((node) => node.parentId));
  const includedEdges = topLevelEdges(topLevelNodes, input.edges);
  const diagnostics = buildHierarchyDiagnostics({
    strategyId: EVENT_DRIVEN_STRATEGY_ID,
    strategyLabel: "Event-Driven placement",
    childNodes,
    edges: sortedEdges(input.edges),
    includedEdges,
  });

  if (topLevelNodes.length === 0) {
    diagnostics.push({
      code: "event-driven-no-top-level-nodes",
      severity: "error",
      message: "Event-Driven layout requires at least one top-level node.",
    });
    return buildResult(input.nodes, input.edges, input.nodes, diagnostics);
  }

  const classification = inferEventDrivenRoles(topLevelNodes, includedEdges);
  diagnostics.push(...classification.diagnostics.map(toLayoutDiagnostic));
  diagnostics.push(roleSummary(classification.assignments));

  const positionedTopLevelNodes = positionEventDriven(
    topLevelNodes,
    includedEdges,
    classification.assignments,
    options,
    diagnostics,
  );
  return buildResult(
    [...positionedTopLevelNodes, ...childNodes],
    input.edges,
    input.nodes,
    diagnostics,
    classification.assignments,
  );
}

function topLevelEdges(nodes: ReadonlyArray<Node>, edges: ReadonlyArray<Edge>): Edge[] {
  const ids = new Set(nodes.map(({ id }) => id));
  return sortedEdges(edges.filter(({ source, target }) => ids.has(source) && ids.has(target)));
}

function positionEventDriven(
  nodes: ReadonlyArray<Node>,
  edges: ReadonlyArray<Edge>,
  assignments: ReadonlyArray<ArchitectureRoleAssignment>,
  options: LayoutOptions,
  diagnostics: LayoutDiagnostic[],
): Node[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const roleByNodeId = new Map(assignments.map(({ nodeId, role }) => [nodeId, role]));
  const maxWidth = Math.max(...nodes.map((node) => getNodeDimensions(node).width));
  const maxHeight = Math.max(...nodes.map((node) => getNodeDimensions(node).height));
  const columnStep = maxWidth + options.nodeSpacing + options.rankSpacing;
  const columnX: Record<"publisher" | "event-bus" | "processor" | "subscriber", number> = {
    publisher: 0,
    "event-bus": columnStep,
    processor: columnStep * 2,
    subscriber: columnStep * 3,
  };
  const plan = buildPlacementPlan(assignments, edges);
  const bandHeight = Math.max(
    maxBandContentHeight(plan, assignments, nodeById, roleByNodeId, options.nodeSpacing),
    maxProcessorHeight(assignments, nodeById),
  ) + options.nodeSpacing * 2;
  const bandY = new Map(plan.bands.map((bandId, index) => [bandId, index * bandHeight]));
  const lastBandY = plan.bands.length > 0 ? bandY.get(plan.bands.at(-1)!)! : 0;
  const supportY = lastBandY + bandHeight + options.rankSpacing;
  const reviewY = supportY + maxHeight + options.nodeSpacing + options.rankSpacing;
  const centers = new Map<string, XYPosition>();
  const nodesByBandAndRole = new Map<string, Map<"publisher" | "event-bus" | "processor" | "subscriber", Node[]>>();

  for (const assignment of assignments) {
    const node = nodeById.get(assignment.nodeId)!;
    const bandId = assignedBand(assignment, plan);
    if (!bandId || plan.bridgeNodeIds.includes(node.id)) continue;
    const role = assignment.role;
    if (!isFlowRole(role) && role !== "event-bus") continue;
    const bands = nodesByBandAndRole.get(bandId) ?? new Map();
    const roleNodes = bands.get(role) ?? [];
    roleNodes.push(node);
    bands.set(role, roleNodes);
    nodesByBandAndRole.set(bandId, bands);
  }

  for (const bandId of plan.bands) {
    const groups = nodesByBandAndRole.get(bandId);
    for (const role of ["publisher", "event-bus", "processor", "subscriber"] as const) {
      stackPeers(groups?.get(role) ?? [], { x: columnX[role], y: bandY.get(bandId)! }, options.nodeSpacing, centers);
    }
  }
  for (const nodeId of plan.bridgeNodeIds) {
    const affinity = plan.affinityByNodeId.get(nodeId)!;
    const sourceY = bandY.get(affinity.primarySourceBusId!)!;
    const destinationY = bandY.get(affinity.primaryDestinationBusId!)!;
    centers.set(nodeId, { x: columnX.processor, y: (sourceY + destinationY) / 2 });
  }
  stackPeers(
    plan.supportNodeIds.map((nodeId) => nodeById.get(nodeId)!),
    { x: columnX["event-bus"], y: supportY },
    options.nodeSpacing,
    centers,
  );
  stackPeers(
    plan.reviewNodeIds.map((nodeId) => nodeById.get(nodeId)!),
    { x: columnX["event-bus"], y: reviewY },
    options.nodeSpacing,
    centers,
  );

  if (plan.bands.length > 1) {
    diagnostics.push({
      code: "event-driven-multiple-bands",
      severity: "info",
      message: `${plan.bands.length} event bus bands were stacked in lexical order.`,
      nodeIds: [...plan.bands],
    });
  }

  const ambiguousProcessorIds = assignments
    .filter(({ nodeId, role }) => role === "processor" && isAmbiguousProcessor(plan.affinityByNodeId.get(nodeId)!))
    .map(({ nodeId }) => nodeId)
    .sort();
  if (ambiguousProcessorIds.length > 0) {
    diagnostics.push({
      code: "event-driven-ambiguous-processor",
      severity: "warning",
      message: "Ambiguous processor affinities were placed in their primary source bands.",
      nodeIds: ambiguousProcessorIds,
    });
  }

  const orphanNodeIds = plan.reviewNodeIds.filter((nodeId) => isFlowRole(roleByNodeId.get(nodeId)!));
  if (plan.bands.length > 0 && orphanNodeIds.length > 0) {
    diagnostics.push({
      code: "event-driven-orphan-role",
      severity: "warning",
      message: "Flow roles without usable event bus affinity were placed in the review lane.",
      nodeIds: orphanNodeIds,
    });
  }
  if (plan.bands.length === 0) {
    diagnostics.push({
      code: "event-driven-no-bus",
      severity: "warning",
      message: "No event bus was identified; flow roles were placed in the review lane.",
    });
  }

  const raw = sortedNodes(nodes).map((node) => {
    const dimensions = getNodeDimensions(node);
    const center = centers.get(node.id) ?? { x: columnX["event-bus"], y: reviewY };
    return {
      node,
      position: { x: center.x - dimensions.width / 2, y: center.y - dimensions.height / 2 },
    };
  });
  const minX = Math.min(...raw.map(({ position }) => position.x));
  const minY = Math.min(...raw.map(({ position }) => position.y));

  return raw.map(({ node, position }) => ({
    ...node,
    position: snapPosition({ x: position.x - minX + MARGIN, y: position.y - minY + MARGIN }, options),
  }));
}

function buildPlacementPlan(
  assignments: ReadonlyArray<ArchitectureRoleAssignment>,
  edges: ReadonlyArray<Edge>,
): PlacementPlan {
  const bands = assignments.filter(({ role }) => role === "event-bus").map(({ nodeId }) => nodeId).sort();
  const busIds = new Set(bands);
  const affinityByNodeId = new Map<string, BusAffinity>();
  for (const { nodeId } of assignments) {
    const sourceCounts = new Map<string, number>();
    const destinationCounts = new Map<string, number>();
    for (const edge of edges) {
      if (edge.target === nodeId && busIds.has(edge.source)) increment(sourceCounts, edge.source);
      if (edge.source === nodeId && busIds.has(edge.target)) increment(destinationCounts, edge.target);
    }
    const sourceBusIds = rankedBusIds(sourceCounts);
    const destinationBusIds = rankedBusIds(destinationCounts);
    affinityByNodeId.set(nodeId, {
      sourceBusIds,
      destinationBusIds,
      primarySourceBusId: sourceBusIds[0] ?? null,
      primaryDestinationBusId: destinationBusIds[0] ?? null,
    });
  }

  const supportNodeIds = assignments
    .filter(({ role }) => role === "infrastructure" || role === "external-dependency")
    .map(({ nodeId }) => nodeId)
    .sort();
  const bridgeNodeIds = assignments
    .filter(({ nodeId, role }) => role === "processor" && isBridge(affinityByNodeId.get(nodeId)!))
    .map(({ nodeId }) => nodeId)
    .sort();
  const reviewNodeIds = assignments
    .filter(({ nodeId, role }) => {
      if (role === "unclassified") return true;
      if (!isFlowRole(role) || bands.length === 1) return false;
      return !assignedBand({ nodeId, role }, {
        bands,
        affinityByNodeId,
        supportNodeIds,
        reviewNodeIds: [],
        bridgeNodeIds,
      });
    })
    .map(({ nodeId }) => nodeId)
    .sort();

  return { bands, affinityByNodeId, supportNodeIds, reviewNodeIds, bridgeNodeIds };
}

function assignedBand(
  assignment: Pick<ArchitectureRoleAssignment, "nodeId" | "role">,
  plan: PlacementPlan,
): string | null {
  if (assignment.role === "event-bus") return assignment.nodeId;
  if (plan.bands.length === 1 && isFlowRole(assignment.role)) return plan.bands[0]!;
  const affinity = plan.affinityByNodeId.get(assignment.nodeId);
  if (!affinity) return null;
  if (assignment.role === "publisher") return affinity.primaryDestinationBusId;
  if (assignment.role === "subscriber") return affinity.primarySourceBusId;
  if (assignment.role === "processor") return affinity.primarySourceBusId ?? affinity.primaryDestinationBusId;
  return null;
}

function maxBandContentHeight(
  plan: PlacementPlan,
  assignments: ReadonlyArray<ArchitectureRoleAssignment>,
  nodeById: ReadonlyMap<string, Node>,
  roleByNodeId: ReadonlyMap<string, ArchitectureSemanticRole>,
  nodeSpacing: number,
): number {
  return Math.max(
    0,
    ...plan.bands.map((bandId) =>
      Math.max(
        ...(["publisher", "event-bus", "processor", "subscriber"] as const).map((role) =>
          stackHeight(
            assignments
              .filter(({ nodeId }) =>
                assignedBand({ nodeId, role: roleByNodeId.get(nodeId)! }, plan) === bandId
                && roleByNodeId.get(nodeId) === role && !plan.bridgeNodeIds.includes(nodeId)
              )
              .map(({ nodeId }) => nodeById.get(nodeId)!),
            nodeSpacing,
          )
        ),
      )
    ),
  );
}

function maxProcessorHeight(
  assignments: ReadonlyArray<ArchitectureRoleAssignment>,
  nodeById: ReadonlyMap<string, Node>,
): number {
  return Math.max(
    0,
    ...assignments.filter(({ role }) => role === "processor")
      .map(({ nodeId }) => getNodeDimensions(nodeById.get(nodeId)!).height),
  );
}

function stackHeight(nodes: ReadonlyArray<Node>, nodeSpacing: number): number {
  return nodes.reduce((total, node) => total + getNodeDimensions(node).height, 0)
    + Math.max(0, nodes.length - 1) * nodeSpacing;
}

function rankedBusIds(counts: ReadonlyMap<string, number>): string[] {
  return [...counts.keys()].sort((left, right) => counts.get(right)! - counts.get(left)! || left.localeCompare(right));
}

function increment(counts: Map<string, number>, id: string): void {
  counts.set(id, (counts.get(id) ?? 0) + 1);
}

function isFlowRole(role: ArchitectureSemanticRole): role is "publisher" | "processor" | "subscriber" {
  return role === "publisher" || role === "processor" || role === "subscriber";
}

function isBridge(affinity: BusAffinity): boolean {
  return affinity.sourceBusIds.length === 1
    && affinity.destinationBusIds.length === 1
    && affinity.primarySourceBusId !== affinity.primaryDestinationBusId;
}

function isAmbiguousProcessor(affinity: BusAffinity): boolean {
  return affinity.sourceBusIds.length > 1 || affinity.destinationBusIds.length > 1;
}

function stackPeers(
  nodes: ReadonlyArray<Node>,
  anchor: XYPosition,
  nodeSpacing: number,
  centers: Map<string, XYPosition>,
): void {
  const totalHeight = nodes.reduce((total, node) => total + getNodeDimensions(node).height, 0)
    + Math.max(0, nodes.length - 1) * nodeSpacing;
  let y = anchor.y - totalHeight / 2;
  for (const node of sortedNodes(nodes)) {
    const { height } = getNodeDimensions(node);
    centers.set(node.id, { x: anchor.x, y: y + height / 2 });
    y += height + nodeSpacing;
  }
}

function roleSummary(assignments: ReadonlyArray<ArchitectureRoleAssignment>): LayoutDiagnostic {
  const count = (role: ArchitectureSemanticRole) => assignments.filter((assignment) => assignment.role === role).length;
  return {
    code: "event-driven-role-summary",
    severity: "info",
    message: `${count("publisher")} publisher, ${count("event-bus")} event bus, ${count("processor")} processor, ${
      count("subscriber")
    } subscriber, ${count("infrastructure")} infrastructure, and ${count("unclassified")} unclassified node(s).`,
  };
}

function toLayoutDiagnostic(
  diagnostic: { code: string; severity: "warning"; message: string; nodeIds: string[] },
): LayoutDiagnostic {
  return { ...diagnostic, nodeIds: [...diagnostic.nodeIds] };
}

function sortedNodes(nodes: ReadonlyArray<Node>): Node[] {
  return [...nodes].sort((left, right) => left.id.localeCompare(right.id));
}

function sortedEdges(edges: ReadonlyArray<Edge>): Edge[] {
  return [...edges].sort((left, right) => left.id.localeCompare(right.id));
}

function snapPosition(position: XYPosition, options: LayoutOptions): XYPosition {
  if (!options.snapToGrid || !options.gridSize) return position;
  return {
    x: Math.round(position.x / options.gridSize) * options.gridSize,
    y: Math.round(position.y / options.gridSize) * options.gridSize,
  };
}

function buildResult(
  nodes: Node[],
  edges: Edge[],
  previousNodes: Node[],
  diagnostics: LayoutDiagnostic[],
  semanticRoles?: ReadonlyArray<ArchitectureRoleAssignment>,
): LayoutResult {
  return {
    nodes,
    edges,
    strategyId: eventDrivenLayoutStrategy.id,
    engine: eventDrivenLayoutStrategy.engine,
    diagnostics,
    ...(semanticRoles && { semanticRoles }),
    quality: evaluateLayoutQuality(nodes, edges, previousNodes),
  };
}
