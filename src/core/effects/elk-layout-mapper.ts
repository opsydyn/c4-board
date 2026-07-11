import type { ElkExtendedEdge, ElkNode, ElkPort } from "elkjs/lib/elk-api";

import { DEFAULT_LAYOUT_OPTIONS } from "./dagre-layout-strategy";
import { evaluateLayoutQuality, evaluateRoutedEdgeQuality } from "./layout-metrics";
import { getNodeDimensions } from "./layout-node-size";
import type {
  LayoutDiagnostic,
  LayoutEdgePortAssignment,
  LayoutEdgeRoute,
  LayoutInput,
  LayoutNodeBounds,
  LayoutOptions,
  LayoutPortCongestion,
  LayoutRelationshipClass,
  LayoutResult,
} from "./layout.types";

export type ElkPortOrdering = "semantic" | "stable";

export interface ElkRouteQuality {
  crossingCount: number;
  totalRouteLength: number;
  congestedSideCount: number;
}

export function buildElkLayeredGraph(
  input: LayoutInput,
  portOrdering: ElkPortOrdering = "stable",
): ElkNode {
  const options = { ...DEFAULT_LAYOUT_OPTIONS, ...input.options };
  const portPolicy = getElkPortPolicy(options.direction);
  const allocation = allocateElkPorts(input, portPolicy, portOrdering);
  const elkNodes = new Map<string, ElkNode>();

  for (const node of input.nodes) {
    elkNodes.set(node.id, {
      id: node.id,
      ...getNodeDimensions(node),
      children: [],
      ports: allocation.portsByNodeId.get(node.id) ?? [],
      layoutOptions: { "elk.portConstraints": "FIXED_ORDER" },
    });
  }

  const rootChildren: ElkNode[] = [];
  for (const node of input.nodes) {
    const elkNode = elkNodes.get(node.id)!;
    const parent = node.parentId ? elkNodes.get(node.parentId) : undefined;
    (parent?.children ?? rootChildren).push(elkNode);
  }

  const nodeIds = new Set(input.nodes.map((node) => node.id));
  const edges: ElkExtendedEdge[] = input.edges
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .map((edge) => ({
      id: edge.id,
      sources: [allocation.assignmentByEdgeId.get(edge.id)?.sourcePortId ?? edge.source],
      targets: [allocation.assignmentByEdgeId.get(edge.id)?.targetPortId ?? edge.target],
    }));

  return {
    id: "c4-board-layout-root",
    children: rootChildren,
    edges,
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": toElkDirection(options.direction),
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.hierarchyHandling": "INCLUDE_CHILDREN",
      "elk.randomSeed": "1",
      "elk.spacing.nodeNode": String(options.nodeSpacing),
      "elk.layered.spacing.nodeNodeBetweenLayers": String(options.rankSpacing),
      "elk.spacing.edgeEdge": String(options.edgeSpacing),
      "elk.padding": "[top=40,left=40,bottom=40,right=40]",
    },
  };
}

export function mapElkLayeredResult(
  input: LayoutInput,
  graph: ElkNode,
  strategyId = "elk-layered",
  portOrdering: ElkPortOrdering = "stable",
): LayoutResult {
  const resultNodes = flattenNodes(graph.children ?? []);
  const diagnostics: LayoutDiagnostic[] = [];
  const gridSize = input.options?.gridSize ?? DEFAULT_LAYOUT_OPTIONS.gridSize ?? 20;
  const snapToGrid = input.options?.snapToGrid ?? DEFAULT_LAYOUT_OPTIONS.snapToGrid;
  const nodes = input.nodes.map((node) => {
    const resultNode = resultNodes.get(node.id);
    if (resultNode?.x === undefined || resultNode.y === undefined) {
      diagnostics.push({
        code: "elk-node-position-missing",
        severity: "warning",
        message: `ELK did not return a position for node '${node.id}'.`,
        nodeIds: [node.id],
      });
      return node;
    }

    return {
      ...node,
      position: snapPosition(resultNode.x, resultNode.y, snapToGrid, gridSize),
    };
  });
  const nodeBounds = mapNodeBounds(resultNodes);
  const edgeRoutes = mapEdgeRoutes(graph);
  const allocation = allocateElkPorts(
    input,
    getElkPortPolicy(input.options?.direction ?? DEFAULT_LAYOUT_OPTIONS.direction),
    portOrdering,
  );
  const edgePortAssignments = allocation.assignments;
  const portCongestion = allocation.congestion;

  if (edgePortAssignments.length > 0) {
    diagnostics.push({
      code: "elk-fixed-ports-applied",
      severity: "info",
      message: `Assigned fixed ${
        input.options?.direction ?? DEFAULT_LAYOUT_OPTIONS.direction
      } ports to ${edgePortAssignments.length} edge(s).`,
      edgeIds: edgePortAssignments.map((assignment) => assignment.edgeId),
    });
  }

  const congestedPorts = portCongestion.filter((entry) => entry.congested);
  if (congestedPorts.length > 0) {
    diagnostics.push({
      code: "elk-port-congestion-detected",
      severity: "warning",
      message:
        `${congestedPorts.length} node side(s) exceed the estimated readable port capacity. Routes remain deterministic but may be visually dense.`,
      nodeIds: congestedPorts.map((entry) => entry.nodeId),
    });
  }

  diagnostics.unshift({
    code: "elk-layered-layout-complete",
    severity: "info",
    message: `ELK placed ${nodes.length} node(s), including ${
      input.nodes.filter((node) => node.parentId).length
    } nested node(s), and routed ${edgeRoutes.length} edge(s).`,
  });

  return {
    nodes,
    edges: input.edges,
    nodeBounds,
    edgeRoutes,
    edgePortAssignments,
    portCongestion,
    strategyId,
    engine: "elk",
    diagnostics,
    quality: evaluateLayoutQuality(nodes, input.edges, input.nodes),
  };
}

interface ElkPortPolicy {
  sourceHandle: LayoutEdgePortAssignment["sourceHandle"];
  sourceSide: "NORTH" | "EAST" | "SOUTH" | "WEST";
  targetHandle: LayoutEdgePortAssignment["targetHandle"];
  targetSide: "NORTH" | "EAST" | "SOUTH" | "WEST";
}

function getElkPortPolicy(direction: LayoutOptions["direction"]): ElkPortPolicy {
  if (direction === "TB") {
    return { sourceHandle: "bottom", sourceSide: "SOUTH", targetHandle: "top", targetSide: "NORTH" };
  }
  if (direction === "LR") {
    return { sourceHandle: "right", sourceSide: "EAST", targetHandle: "left", targetSide: "WEST" };
  }
  if (direction === "BT") {
    return { sourceHandle: "top", sourceSide: "NORTH", targetHandle: "bottom", targetSide: "SOUTH" };
  }
  return { sourceHandle: "left", sourceSide: "WEST", targetHandle: "right", targetSide: "EAST" };
}

interface ElkPortAllocation {
  assignments: LayoutEdgePortAssignment[];
  assignmentByEdgeId: Map<string, LayoutEdgePortAssignment>;
  portsByNodeId: Map<string, ElkPort[]>;
  congestion: LayoutPortCongestion[];
}

export function allocateElkPorts(
  input: LayoutInput,
  policy: ElkPortPolicy,
  portOrdering: ElkPortOrdering = "stable",
): ElkPortAllocation {
  const nodeById = new Map(input.nodes.map((node) => [node.id, node]));
  const validEdges = input.edges.filter((edge) => nodeById.has(edge.source) && nodeById.has(edge.target));
  const semanticClassByEdgeId = new Map(validEdges.map((edge) => [edge.id, classifyRelationship(edge, nodeById)]));
  const sourceOrder = buildEndpointOrder(validEdges, "source", semanticClassByEdgeId, portOrdering);
  const targetOrder = buildEndpointOrder(validEdges, "target", semanticClassByEdgeId, portOrdering);
  const edgeById = new Map(validEdges.map((edge) => [edge.id, edge]));
  const assignments = validEdges.map((edge) => {
    const sourceIndex = sourceOrder.get(edge.id) ?? 0;
    const targetIndex = targetOrder.get(edge.id) ?? 0;
    return {
      edgeId: edge.id,
      sourceHandle: policy.sourceHandle,
      targetHandle: policy.targetHandle,
      sourcePortId: portId(edge.source, policy.sourceHandle, edge.id),
      targetPortId: portId(edge.target, policy.targetHandle, edge.id),
      sourceOrder: sourceIndex,
      targetOrder: targetIndex,
      semanticClass: semanticClassByEdgeId.get(edge.id) ?? "request",
    } satisfies LayoutEdgePortAssignment;
  });
  const portsByNodeId = new Map<string, ElkPort[]>();
  const portOrderById = new Map(assignments.flatMap((assignment) => [
    [assignment.sourcePortId, assignment.sourceOrder] as const,
    [assignment.targetPortId, assignment.targetOrder] as const,
  ]));

  for (const assignment of assignments) {
    addPort(portsByNodeId, edgeById.get(assignment.edgeId)?.source, {
      id: assignment.sourcePortId,
      width: 1,
      height: 1,
      layoutOptions: { "elk.port.side": policy.sourceSide },
    });
    addPort(portsByNodeId, edgeById.get(assignment.edgeId)?.target, {
      id: assignment.targetPortId,
      width: 1,
      height: 1,
      layoutOptions: { "elk.port.side": policy.targetSide },
    });
  }
  for (const ports of portsByNodeId.values()) {
    ports.sort((left, right) => {
      const sideDelta = String(left.layoutOptions?.["elk.port.side"])
        .localeCompare(String(right.layoutOptions?.["elk.port.side"]));
      return sideDelta || (portOrderById.get(left.id) ?? 0) - (portOrderById.get(right.id) ?? 0);
    });
  }

  return {
    assignments,
    assignmentByEdgeId: new Map(assignments.map((assignment) => [assignment.edgeId, assignment])),
    portsByNodeId,
    congestion: buildPortCongestion(input, assignments, policy),
  };
}

function buildEndpointOrder(
  edges: LayoutInput["edges"],
  endpoint: "source" | "target",
  semanticClassByEdgeId: Map<string, LayoutRelationshipClass>,
  portOrdering: ElkPortOrdering,
): Map<string, number> {
  const grouped = new Map<string, typeof edges>();
  for (const edge of edges) {
    const nodeId = edge[endpoint];
    grouped.set(nodeId, [...(grouped.get(nodeId) ?? []), edge]);
  }

  const order = new Map<string, number>();
  for (const group of grouped.values()) {
    group.sort((left, right) => {
      if (portOrdering === "semantic") {
        const classDelta = relationshipClassRank(semanticClassByEdgeId.get(left.id))
          - relationshipClassRank(semanticClassByEdgeId.get(right.id));
        if (classDelta !== 0) return classDelta;
      }
      const leftAdjacent = endpoint === "source" ? left.target : left.source;
      const rightAdjacent = endpoint === "source" ? right.target : right.source;
      return leftAdjacent.localeCompare(rightAdjacent) || left.id.localeCompare(right.id);
    });
    group.forEach((edge, index) => order.set(edge.id, index));
  }
  return order;
}

function classifyRelationship(
  edge: LayoutInput["edges"][number],
  nodeById: Map<string, LayoutInput["nodes"][number]>,
): LayoutRelationshipClass {
  const sourceType = nodeById.get(edge.source)?.type;
  const targetType = nodeById.get(edge.target)?.type;
  const metadata = (edge.data as { metadata?: { communicationStyle?: string } } | undefined)?.metadata;
  const label = typeof edge.label === "string" ? edge.label.toLowerCase() : "";

  if (sourceType === "command" || targetType === "command" || label.includes("command")) return "command";
  if (
    sourceType === "domainEvent" || sourceType === "integrationEvent"
    || targetType === "domainEvent" || targetType === "integrationEvent"
    || metadata?.communicationStyle === "asynchronous" || label.includes("event")
  ) return "event";
  if (
    sourceType === "repository" || sourceType === "entity" || sourceType === "valueObject"
    || targetType === "repository" || targetType === "entity" || targetType === "valueObject"
    || label.includes("data")
  ) return "data";
  return "request";
}

function relationshipClassRank(value: LayoutRelationshipClass | undefined): number {
  return { command: 0, event: 1, request: 2, data: 3 }[value ?? "request"];
}

function portId(nodeId: string, handle: string, edgeId: string): string {
  return `${nodeId}::${handle}::${edgeId}`;
}

function addPort(portsByNodeId: Map<string, ElkPort[]>, nodeId: string | undefined, port: ElkPort): void {
  if (!nodeId) return;
  portsByNodeId.set(nodeId, [...(portsByNodeId.get(nodeId) ?? []), port]);
}

function buildPortCongestion(
  input: LayoutInput,
  assignments: LayoutEdgePortAssignment[],
  policy: ElkPortPolicy,
): LayoutPortCongestion[] {
  const counts = new Map<string, { nodeId: string; side: LayoutPortCongestion["side"]; count: number }>();
  for (const assignment of assignments) {
    const edge = input.edges.find((candidate) => candidate.id === assignment.edgeId);
    if (!edge) continue;
    incrementPortCount(counts, edge.source, policy.sourceHandle);
    incrementPortCount(counts, edge.target, policy.targetHandle);
  }
  const nodeById = new Map(input.nodes.map((node) => [node.id, node]));
  return [...counts.values()].map(({ nodeId, side, count }) => {
    const dimensions = getNodeDimensions(nodeById.get(nodeId)!);
    const sideLength = side === "top" || side === "bottom" ? dimensions.width : dimensions.height;
    const estimatedCapacity = Math.max(1, Math.floor((sideLength - 24) / 24));
    return { nodeId, side, edgeCount: count, estimatedCapacity, congested: count > estimatedCapacity };
  });
}

function incrementPortCount(
  counts: Map<string, { nodeId: string; side: LayoutPortCongestion["side"]; count: number }>,
  nodeId: string,
  side: LayoutPortCongestion["side"],
): void {
  const key = `${nodeId}:${side}`;
  const current = counts.get(key);
  counts.set(key, { nodeId, side, count: (current?.count ?? 0) + 1 });
}

function flattenNodes(nodes: ElkNode[], result = new Map<string, ElkNode>()): Map<string, ElkNode> {
  for (const node of nodes) {
    result.set(node.id, node);
    flattenNodes(node.children ?? [], result);
  }
  return result;
}

function mapNodeBounds(nodes: Map<string, ElkNode>): LayoutNodeBounds[] {
  return [...nodes.values()].flatMap((node) =>
    node.x === undefined || node.y === undefined || node.width === undefined || node.height === undefined
      ? []
      : [{ nodeId: node.id, x: node.x, y: node.y, width: node.width, height: node.height }]
  );
}

function mapEdgeRoutes(graph: ElkNode): LayoutEdgeRoute[] {
  return (graph.edges ?? []).flatMap((edge) => {
    const sections = (edge.sections ?? []).map((section) => ({
      start: section.startPoint,
      bends: section.bendPoints ?? [],
      end: section.endPoint,
    }));
    return sections.length > 0 ? [{ edgeId: edge.id, sections }] : [];
  });
}

export function evaluateElkRouteQuality(result: LayoutResult): ElkRouteQuality {
  const routed = evaluateRoutedEdgeQuality(result.edgeRoutes ?? []);

  return {
    crossingCount: routed.edgeCrossingCount,
    totalRouteLength: routed.totalEdgeLength,
    congestedSideCount: (result.portCongestion ?? []).filter(({ congested }) => congested).length,
  };
}

function snapPosition(x: number, y: number, enabled: boolean | undefined, gridSize: number) {
  if (!enabled) return { x, y };
  return {
    x: Math.round(x / gridSize) * gridSize,
    y: Math.round(y / gridSize) * gridSize,
  };
}

function toElkDirection(direction: string): string {
  return { TB: "DOWN", BT: "UP", LR: "RIGHT", RL: "LEFT" }[direction] ?? "DOWN";
}
