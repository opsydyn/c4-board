import type { Edge, Node, XYPosition } from "@xyflow/react";
import { type ArchitectureRoleAssignment, inferHexagonalRoles } from "./architecture-role-classification";
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

const HEXAGONAL_STRATEGY_ID = "hexagonal";
const MARGIN = 40;

const DEFAULT_HEXAGONAL_OPTIONS: LayoutOptions = {
  direction: "LR",
  nodeSpacing: 90,
  rankSpacing: 180,
  edgeSpacing: 20,
  snapToGrid: true,
  gridSize: 20,
  strategyId: HEXAGONAL_STRATEGY_ID,
};

export const hexagonalLayoutStrategy: SynchronousLayoutStrategy = {
  id: HEXAGONAL_STRATEGY_ID,
  engine: "custom",
  analyse: analyseHexagonal,
  layout: layoutHexagonal,
};

export function analyseHexagonal(input: LayoutInput): LayoutAnalysis {
  const topLevelNodes = input.nodes.filter((node) => !node.parentId);
  if (topLevelNodes.length === 0) {
    return { applicable: false, score: 0, reasons: ["No top-level nodes are available."] };
  }
  const classification = inferHexagonalRoles(topLevelNodes, topLevelEdges(topLevelNodes, input.edges));
  const confident = classification.assignments.filter(({ confidence }) => confidence >= 0.65).length;
  const coreCount = classification.assignments.filter(({ role }) => role === "core").length;
  return {
    applicable: true,
    score: (confident / topLevelNodes.length) * (coreCount === 1 ? 1 : 0.7),
    reasons: [
      `${confident} of ${topLevelNodes.length} node(s) have confident Hexagonal roles.`,
      `${coreCount} domain core node(s) were identified.`,
    ],
  };
}

export function layoutHexagonal(input: LayoutInput): LayoutResult {
  const options = { ...DEFAULT_HEXAGONAL_OPTIONS, ...input.options };
  const topNodes = input.nodes.filter((node) => !node.parentId);
  const childNodes = input.nodes.filter((node) => node.parentId);
  const includedEdges = topLevelEdges(topNodes, input.edges);
  const diagnostics = buildHierarchyDiagnostics({
    strategyId: HEXAGONAL_STRATEGY_ID,
    strategyLabel: "Hexagonal placement",
    childNodes,
    edges: input.edges,
    includedEdges,
  });

  if (topNodes.length === 0) {
    diagnostics.push({
      code: "hexagonal-no-top-level-nodes",
      severity: "error",
      message: "Hexagonal layout requires at least one top-level node.",
    });
    return buildResult(input.nodes, input.edges, input.nodes, diagnostics);
  }

  const classification = inferHexagonalRoles(topNodes, includedEdges);
  diagnostics.push(...classification.diagnostics.map((diagnostic): LayoutDiagnostic => ({
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    nodeIds: [...diagnostic.nodeIds],
  })));
  const counts = countRoles(classification.assignments);
  diagnostics.push({
    code: "hexagonal-role-summary",
    severity: "info",
    message:
      `${counts.core} core, ${counts.inboundPort} inbound port, ${counts.outboundPort} outbound port, ${counts.inboundAdapter} inbound adapter, ${counts.outboundAdapter} outbound adapter, ${counts.infrastructure} infrastructure, and ${counts.unclassified} unclassified node(s).`,
  });
  if (counts.core === 0) {
    diagnostics.push({
      code: "hexagonal-core-missing",
      severity: "warning",
      message: "No domain core was identified; review role assignments before applying this layout.",
    });
  } else if (counts.core > 1) {
    diagnostics.push({
      code: "hexagonal-multiple-cores",
      severity: "warning",
      message: `${counts.core} core nodes were identified and grouped in the central sector.`,
      nodeIds: classification.assignments.filter(({ role }) => role === "core").map(({ nodeId }) => nodeId),
    });
  }

  const positioned = positionByRole(topNodes, classification.assignments, options);
  return buildResult(
    [...positioned, ...childNodes],
    input.edges,
    input.nodes,
    diagnostics,
    classification.assignments,
  );
}

function topLevelEdges(nodes: ReadonlyArray<Node>, edges: ReadonlyArray<Edge>): Edge[] {
  const ids = new Set(nodes.map(({ id }) => id));
  return edges.filter(({ source, target }) => ids.has(source) && ids.has(target));
}

function positionByRole(
  nodes: ReadonlyArray<Node>,
  assignments: ReadonlyArray<ArchitectureRoleAssignment>,
  options: LayoutOptions,
): Node[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const maxWidth = Math.max(...nodes.map((node) => getNodeDimensions(node).width));
  const maxHeight = Math.max(...nodes.map((node) => getNodeDimensions(node).height));
  const innerX = maxWidth + options.nodeSpacing + options.rankSpacing / 2;
  const outerX = innerX + maxWidth + options.nodeSpacing + options.rankSpacing;
  const upperY = -(maxHeight + options.nodeSpacing);
  const lowerY = maxHeight + options.nodeSpacing + options.rankSpacing;
  const fallbackY = lowerY + maxHeight + options.nodeSpacing + options.rankSpacing;
  const anchors: Record<ArchitectureRoleAssignment["role"], XYPosition> = {
    core: { x: 0, y: 0 },
    "inbound-port": { x: -innerX, y: upperY },
    "outbound-port": { x: innerX, y: upperY },
    "inbound-adapter": { x: -outerX, y: 0 },
    "outbound-adapter": { x: outerX, y: 0 },
    infrastructure: { x: 0, y: lowerY },
    unclassified: { x: 0, y: fallbackY },
    publisher: { x: 0, y: fallbackY },
    "event-bus": { x: 0, y: fallbackY },
    processor: { x: 0, y: fallbackY },
    subscriber: { x: 0, y: fallbackY },
    client: { x: 0, y: fallbackY },
    service: { x: 0, y: fallbackY },
    domain: { x: 0, y: fallbackY },
    persistence: { x: 0, y: fallbackY },
    "external-dependency": { x: 0, y: fallbackY },
  };
  const verticalRoles = new Set<ArchitectureRoleAssignment["role"]>([
    "inbound-port",
    "outbound-port",
    "inbound-adapter",
    "outbound-adapter",
  ]);
  const centers = new Map<string, XYPosition>();
  const roles = [...new Set(assignments.map(({ role }) => role))].sort();

  for (const role of roles) {
    const roleNodes = assignments.filter((assignment) => assignment.role === role)
      .map(({ nodeId }) => nodeById.get(nodeId)!)
      .sort((left, right) => left.id.localeCompare(right.id));
    const anchor = anchors[role];
    const vertical = verticalRoles.has(role);
    const dimensions = roleNodes.map((node) => getNodeDimensions(node));
    const laneSize = Math.max(0, ...dimensions.map((dimension) => vertical ? dimension.height : dimension.width))
      + options.nodeSpacing;
    roleNodes.forEach((node, index) => {
      const offset = (index - (roleNodes.length - 1) / 2) * laneSize;
      centers.set(node.id, {
        x: anchor.x + (vertical ? 0 : offset),
        y: anchor.y + (vertical ? offset : 0),
      });
    });
  }

  const raw = [...nodes].sort((left, right) => left.id.localeCompare(right.id)).map((node) => {
    const center = centers.get(node.id) ?? anchors.unclassified;
    const dimensions = getNodeDimensions(node);
    return {
      node,
      position: {
        x: center.x - dimensions.width / 2,
        y: center.y - dimensions.height / 2,
      },
    };
  });
  const minX = Math.min(...raw.map(({ position }) => position.x));
  const minY = Math.min(...raw.map(({ position }) => position.y));

  return raw.map(({ node, position }) => ({
    ...node,
    position: snapPosition({ x: position.x - minX + MARGIN, y: position.y - minY + MARGIN }, options),
  }));
}

function snapPosition(position: XYPosition, options: LayoutOptions): XYPosition {
  if (!options.snapToGrid || !options.gridSize) return position;
  return {
    x: Math.round(position.x / options.gridSize) * options.gridSize,
    y: Math.round(position.y / options.gridSize) * options.gridSize,
  };
}

function countRoles(assignments: ReadonlyArray<ArchitectureRoleAssignment>) {
  const count = (role: ArchitectureRoleAssignment["role"]) =>
    assignments.filter((assignment) => assignment.role === role).length;
  return {
    core: count("core"),
    inboundPort: count("inbound-port"),
    outboundPort: count("outbound-port"),
    inboundAdapter: count("inbound-adapter"),
    outboundAdapter: count("outbound-adapter"),
    infrastructure: count("infrastructure"),
    unclassified: count("unclassified"),
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
    strategyId: hexagonalLayoutStrategy.id,
    engine: hexagonalLayoutStrategy.engine,
    diagnostics,
    ...(semanticRoles && { semanticRoles }),
    quality: evaluateLayoutQuality(nodes, edges, previousNodes),
  };
}
