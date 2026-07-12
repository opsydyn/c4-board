import type { Edge, Node, XYPosition } from "@xyflow/react";
import {
  type ArchitectureRoleAssignment,
  type ArchitectureSemanticRole,
  inferClientServerRoles,
} from "./architecture-role-classification";
import { buildHierarchyDiagnostics } from "./layout-hierarchy-diagnostics";
import { evaluateLayoutQuality } from "./layout-metrics";
import { getDefaultNodeHeight, getDefaultNodeWidth, getNodeDimensions } from "./layout-node-size";
import type {
  LayoutAnalysis,
  LayoutDiagnostic,
  LayoutInput,
  LayoutOptions,
  LayoutResult,
  SynchronousLayoutStrategy,
} from "./layout.types";

const CLIENT_SERVER_STRATEGY_ID = "client-server";
const MARGIN = 40;
const MAX_LAYOUT_DIMENSION = 1_000_000;
const MAX_LAYOUT_SPACING = 1_000_000;
const MIN_GRID_SIZE = 1;
const MAX_GRID_SIZE = 100_000;

const DEFAULT_CLIENT_SERVER_OPTIONS: LayoutOptions = {
  direction: "LR",
  nodeSpacing: 120,
  rankSpacing: 180,
  edgeSpacing: 20,
  snapToGrid: true,
  gridSize: 20,
  strategyId: CLIENT_SERVER_STRATEGY_ID,
};

type PrimaryRole = "client" | "service" | "domain" | "persistence";

interface ExternalAffinity {
  readonly nodeId: string;
  readonly callerIds: string[];
  readonly primaryCallerId: string | null;
  readonly anchorRole: "service" | "domain";
}

interface GeometrySanitization {
  readonly nodes: Node[];
  readonly options: LayoutOptions;
  readonly recoveredNodeIds: string[];
  readonly recoveredOptions: string[];
}

interface StackPlacement {
  readonly cells: ReadonlyMap<string, XYPosition>;
  readonly bottom: number;
}

const PRIMARY_ROLES: PrimaryRole[] = ["client", "service", "domain", "persistence"];

export const clientServerLayoutStrategy: SynchronousLayoutStrategy = {
  id: CLIENT_SERVER_STRATEGY_ID,
  engine: "custom",
  analyse: analyseClientServer,
  layout: layoutClientServer,
};

export function analyseClientServer(input: LayoutInput): LayoutAnalysis {
  const nodes = sortedNodes(input.nodes.filter((node) => !node.parentId));
  if (nodes.length === 0) {
    return { applicable: false, score: 0, reasons: ["No top-level nodes are available."] };
  }

  const classification = inferClientServerRoles(nodes, topLevelEdges(nodes, input.edges));
  const confident = classification.assignments
    .filter(({ confidence, role }) => confidence >= 0.65 && role !== "unclassified").length;
  const tierCount =
    PRIMARY_ROLES.filter((role) => classification.assignments.some((assignment) => assignment.role === role)).length;

  return {
    applicable: true,
    score: (confident / nodes.length) * (tierCount >= 2 ? 1 : 0.5),
    reasons: [
      `${confident} of ${nodes.length} node(s) have confident Client-Server roles.`,
      `${tierCount} of ${PRIMARY_ROLES.length} primary Client-Server tier(s) were identified.`,
    ],
  };
}

export function layoutClientServer(input: LayoutInput): LayoutResult {
  const sanitized = sanitizeGeometry(input);
  const { nodes, options } = sanitized;
  const topLevelNodes = sortedNodes(nodes.filter((node) => !node.parentId));
  const childNodes = sortedNodes(nodes.filter((node) => node.parentId));
  const includedEdges = topLevelEdges(topLevelNodes, input.edges);
  const diagnostics = buildHierarchyDiagnostics({
    strategyId: CLIENT_SERVER_STRATEGY_ID,
    strategyLabel: "Client-Server placement",
    childNodes,
    edges: sortedEdges(input.edges),
    includedEdges,
  });

  if (topLevelNodes.length === 0) {
    diagnostics.push({
      code: "client-server-no-top-level-nodes",
      severity: "error",
      message: "Client-Server layout requires at least one top-level node.",
    });
    appendGeometryDiagnostic(diagnostics, sanitized);
    return buildResult(nodes, input.edges, nodes, diagnostics);
  }

  const classification = inferClientServerRoles(topLevelNodes, includedEdges);
  const affinities = buildExternalAffinities(classification.assignments, includedEdges);

  diagnostics.push(...classification.diagnostics.map(toLayoutDiagnostic));
  diagnostics.push(roleSummary(classification.assignments));
  diagnostics.push(...missingTierDiagnostics(classification.assignments));
  diagnostics.push(...affinityDiagnostics(affinities));
  diagnostics.push(...unclassifiedDiagnostics(classification.assignments));
  appendGeometryDiagnostic(diagnostics, sanitized);

  const positionedTopLevelNodes = positionClientServer(
    topLevelNodes,
    classification.assignments,
    affinities,
    options,
  );
  return buildResult(
    [...positionedTopLevelNodes, ...childNodes],
    input.edges,
    nodes,
    diagnostics,
    classification.assignments,
  );
}

function sanitizeGeometry(input: LayoutInput): GeometrySanitization {
  const rawOptions = { ...DEFAULT_CLIENT_SERVER_OPTIONS, ...input.options };
  const recoveredOptions: string[] = [];
  const nodeSpacing = sanitizeSpacing(rawOptions.nodeSpacing, "nodeSpacing", recoveredOptions);
  const rankSpacing = sanitizeSpacing(rawOptions.rankSpacing, "rankSpacing", recoveredOptions);
  const edgeSpacing = sanitizeSpacing(rawOptions.edgeSpacing, "edgeSpacing", recoveredOptions);
  const gridSize = sanitizeGridSize(rawOptions.gridSize, recoveredOptions);
  const { gridSize: _ignoredGridSize, snapToGrid: _ignoredSnapToGrid, ...baseOptions } = rawOptions;

  const recoveredNodeIds: string[] = [];
  const nodes = input.nodes.map((node) => {
    if (node.parentId) return node;
    const sanitized = sanitizeNodeDimensions(node);
    if (sanitized.recovered) recoveredNodeIds.push(node.id);
    return sanitized.node;
  });

  return {
    nodes,
    options: {
      ...baseOptions,
      nodeSpacing,
      rankSpacing,
      edgeSpacing,
      snapToGrid: rawOptions.snapToGrid === true,
      gridSize,
    },
    recoveredNodeIds: recoveredNodeIds.sort(),
    recoveredOptions,
  };
}

function sanitizeSpacing(value: unknown, name: string, recoveredOptions: string[]): number {
  if (boundedNonNegative(value)) return value;
  recoveredOptions.push(name);
  return DEFAULT_CLIENT_SERVER_OPTIONS[name as "nodeSpacing" | "rankSpacing" | "edgeSpacing"];
}

function sanitizeGridSize(value: unknown, recoveredOptions: string[]): number {
  if (boundedGridSize(value)) return value;
  recoveredOptions.push("gridSize");
  return DEFAULT_CLIENT_SERVER_OPTIONS.gridSize!;
}

function sanitizeNodeDimensions(node: Node): { node: Node; recovered: boolean } {
  const width = sanitizeDimension(node.measured?.width, node.style?.width, getDefaultNodeWidth(node.type));
  const height = sanitizeDimension(node.measured?.height, node.style?.height, getDefaultNodeHeight(node.type));
  const recovered = width.recovered || height.recovered;
  if (!recovered) return { node, recovered };

  return {
    node: {
      ...node,
      measured: { ...node.measured, width: width.value, height: height.value },
      style: { ...node.style, width: width.value, height: height.value },
    },
    recovered,
  };
}

function sanitizeDimension(
  measured: unknown,
  styled: unknown,
  fallback: number,
): { value: number; recovered: boolean } {
  const measuredInvalid = invalidDimension(measured);
  const styledInvalid = invalidDimension(styled);
  if (!measuredInvalid && boundedPositive(measured, MAX_LAYOUT_DIMENSION)) {
    return { value: measured, recovered: styledInvalid };
  }
  if (!styledInvalid && boundedPositive(styled, MAX_LAYOUT_DIMENSION)) {
    return { value: styled, recovered: measuredInvalid };
  }
  return { value: fallback, recovered: measuredInvalid || styledInvalid };
}

function topLevelEdges(nodes: ReadonlyArray<Node>, edges: ReadonlyArray<Edge>): Edge[] {
  const ids = new Set(nodes.map(({ id }) => id));
  return sortedEdges(edges.filter(({ source, target }) => ids.has(source) && ids.has(target)));
}

function buildExternalAffinities(
  assignments: ReadonlyArray<ArchitectureRoleAssignment>,
  edges: ReadonlyArray<Edge>,
): ExternalAffinity[] {
  const roleByNodeId = new Map(assignments.map(({ nodeId, role }) => [nodeId, role]));
  return assignments
    .filter(({ role }) => role === "external-dependency")
    .map(({ nodeId }): ExternalAffinity => {
      const callerIds = [
        ...new Set(
          edges.flatMap((edge) => {
            if (edge.target === nodeId) return [edge.source];
            if (edge.source === nodeId) return [edge.target];
            return [];
          }).filter((id) => {
            const role = roleByNodeId.get(id);
            return role === "service" || role === "domain";
          }),
        ),
      ].sort((left, right) => {
        const leftRole = roleByNodeId.get(left);
        const rightRole = roleByNodeId.get(right);
        return affinityRoleRank(leftRole) - affinityRoleRank(rightRole) || left.localeCompare(right);
      });
      const primaryCallerId = callerIds[0] ?? null;
      const primaryRole = primaryCallerId ? roleByNodeId.get(primaryCallerId) : undefined;

      return {
        nodeId,
        callerIds,
        primaryCallerId,
        anchorRole: primaryRole === "domain" ? "domain" : "service",
      };
    })
    .sort((left, right) => left.nodeId.localeCompare(right.nodeId));
}

function positionClientServer(
  nodes: ReadonlyArray<Node>,
  assignments: ReadonlyArray<ArchitectureRoleAssignment>,
  affinities: ReadonlyArray<ExternalAffinity>,
  options: LayoutOptions,
): Node[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const assignmentsByRole = new Map<ArchitectureSemanticRole, Node[]>();
  for (const assignment of assignments) {
    const nodesForRole = assignmentsByRole.get(assignment.role) ?? [];
    nodesForRole.push(nodeById.get(assignment.nodeId)!);
    assignmentsByRole.set(assignment.role, nodesForRole);
  }

  const width = columnWidth(nodes, options);
  const step = columnStep(width, options);
  const columnX = new Map(PRIMARY_ROLES.map((role, index) => [role, index * step]));
  const cells = new Map<string, XYPosition>();
  const primaryBottom = Math.max(
    0,
    ...PRIMARY_ROLES.map((role) => {
      const placement = stackColumn(assignmentsByRole.get(role) ?? [], columnX.get(role)!, width, 0, options);
      copyCells(cells, placement.cells);
      return placement.bottom;
    }),
  );

  const supportStart = gridBoundary(primaryBottom + options.rankSpacing, options);
  const supportBottom = Math.max(
    supportStart,
    ...(["service", "domain"] as const).map((role) => {
      const supportNodes = affinities
        .filter((affinity) => affinity.anchorRole === role)
        .map(({ nodeId }) => nodeById.get(nodeId)!);
      const placement = stackColumn(supportNodes, columnX.get(role)!, width, supportStart, options);
      copyCells(cells, placement.cells);
      return placement.bottom;
    }),
  );

  const reviewStart = gridBoundary(Math.max(primaryBottom, supportBottom) + options.rankSpacing, options);
  const review = stackColumn(
    assignmentsByRole.get("unclassified") ?? [],
    columnX.get("service")!,
    width,
    reviewStart,
    options,
  );
  copyCells(cells, review.cells);

  const raw = sortedNodes(nodes).map((node) => ({
    node,
    position: cells.get(node.id) ?? { x: columnX.get("service")!, y: reviewStart },
  }));
  return centerSupportNodes(normalizePositions(raw, options), affinities, assignments);
}

function columnWidth(nodes: ReadonlyArray<Node>, options: LayoutOptions): number {
  return Math.max(...nodes.map((node) => reservedDimensions(node, options).width));
}

function columnStep(width: number, options: LayoutOptions): number {
  return gridBoundary(width + options.nodeSpacing + options.rankSpacing, options);
}

function stackColumn(
  nodes: ReadonlyArray<Node>,
  x: number,
  width: number,
  startY: number,
  options: LayoutOptions,
): StackPlacement {
  const cells = new Map<string, XYPosition>();
  let y = startY;
  for (const node of sortedNodes(nodes)) {
    const dimensions = getNodeDimensions(node);
    cells.set(node.id, { x: x + (width - dimensions.width) / 2, y });
    y += gridBoundary(reservedDimensions(node, options).height + options.nodeSpacing, options);
  }
  return { cells, bottom: y };
}

function normalizePositions(
  placements: ReadonlyArray<{ node: Node; position: XYPosition }>,
  options: LayoutOptions,
): Node[] {
  const minX = Math.min(...placements.map(({ position }) => position.x));
  const minY = Math.min(...placements.map(({ position }) => position.y));
  const margin = gridBoundary(MARGIN, options);
  return placements.map(({ node, position }) => ({
    ...node,
    position: {
      x: gridBoundary(position.x - minX + margin, options),
      y: gridBoundary(position.y - minY + margin, options),
    },
  }));
}

function centerSupportNodes(
  nodes: ReadonlyArray<Node>,
  affinities: ReadonlyArray<ExternalAffinity>,
  assignments: ReadonlyArray<ArchitectureRoleAssignment>,
): Node[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const fallbackAnchorByRole = new Map(
    (["service", "domain"] as const).map((role) => [
      role,
      assignments.find((assignment) => assignment.role === role)?.nodeId ?? null,
    ]),
  );

  return nodes.map((node) => {
    const affinity = affinities.find((entry) => entry.nodeId === node.id);
    if (!affinity) return node;

    const anchorId = affinity.primaryCallerId ?? fallbackAnchorByRole.get(affinity.anchorRole);
    const anchor = anchorId ? nodeById.get(anchorId) : undefined;
    if (!anchor) return node;

    const anchorDimensions = getNodeDimensions(anchor);
    const dimensions = getNodeDimensions(node);
    return {
      ...node,
      position: {
        ...node.position,
        x: anchor.position.x + anchorDimensions.width / 2 - dimensions.width / 2,
      },
    };
  });
}

function missingTierDiagnostics(assignments: ReadonlyArray<ArchitectureRoleAssignment>): LayoutDiagnostic[] {
  const assignedRoles = new Set(assignments.map(({ role }) => role));
  return PRIMARY_ROLES.filter((role) => !assignedRoles.has(role)).map((role) => ({
    code: `client-server-${role}-missing`,
    severity: "warning",
    message: `No ${role} tier was identified; review role assignments before applying this layout.`,
  }));
}

function affinityDiagnostics(affinities: ReadonlyArray<ExternalAffinity>): LayoutDiagnostic[] {
  const ambiguous = affinities.filter(({ callerIds }) => callerIds.length > 1).map(({ nodeId }) => nodeId);
  const orphaned = affinities.filter(({ primaryCallerId }) => primaryCallerId === null).map(({ nodeId }) => nodeId);
  return [
    ...(ambiguous.length > 0
      ? [{
        code: "client-server-external-affinity-ambiguous",
        severity: "warning" as const,
        message: "External dependencies with multiple callers use the service-first, lexical caller affinity.",
        nodeIds: ambiguous,
      }]
      : []),
    ...(orphaned.length > 0
      ? [{
        code: "client-server-external-orphan",
        severity: "warning" as const,
        message: "External dependencies without a service or domain caller use the service support lane.",
        nodeIds: orphaned,
      }]
      : []),
  ];
}

function unclassifiedDiagnostics(assignments: ReadonlyArray<ArchitectureRoleAssignment>): LayoutDiagnostic[] {
  const nodeIds = assignments.filter(({ role }) => role === "unclassified").map(({ nodeId }) => nodeId).sort();
  return nodeIds.length === 0 ? [] : [{
    code: "client-server-unclassified-review-lane",
    severity: "warning",
    message: "Unclassified nodes were placed in the separate review lane.",
    nodeIds,
  }];
}

function appendGeometryDiagnostic(diagnostics: LayoutDiagnostic[], sanitized: GeometrySanitization): void {
  if (sanitized.recoveredNodeIds.length === 0 && sanitized.recoveredOptions.length === 0) return;
  diagnostics.push({
    code: "client-server-invalid-geometry-input",
    severity: "warning",
    message: `Recovered invalid geometry input: ${
      [
        ...sanitized.recoveredOptions,
        ...(sanitized.recoveredNodeIds.length > 0
          ? [`fallback dimensions for ${sanitized.recoveredNodeIds.length} node(s)`]
          : []),
      ].join(", ")
    }.`,
    ...(sanitized.recoveredNodeIds.length > 0 && { nodeIds: sanitized.recoveredNodeIds }),
  });
}

function roleSummary(assignments: ReadonlyArray<ArchitectureRoleAssignment>): LayoutDiagnostic {
  const count = (role: ArchitectureSemanticRole) => assignments.filter((assignment) => assignment.role === role).length;
  return {
    code: "client-server-role-summary",
    severity: "info",
    message: `${count("client")} client, ${count("service")} service, ${count("domain")} domain, ${
      count("persistence")
    } persistence, ${count("external-dependency")} external dependency, and ${
      count("unclassified")
    } unclassified node(s).`,
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
    strategyId: clientServerLayoutStrategy.id,
    engine: clientServerLayoutStrategy.engine,
    diagnostics,
    ...(semanticRoles && { semanticRoles }),
    quality: evaluateLayoutQuality(nodes, edges, previousNodes),
  };
}

function copyCells(target: Map<string, XYPosition>, source: ReadonlyMap<string, XYPosition>): void {
  for (const [nodeId, position] of source) target.set(nodeId, position);
}

function reservedDimensions(node: Node, options: LayoutOptions): { width: number; height: number } {
  const dimensions = getNodeDimensions(node);
  return {
    width: gridBoundary(dimensions.width, options),
    height: gridBoundary(dimensions.height, options),
  };
}

function gridBoundary(value: number, options: LayoutOptions): number {
  if (!options.snapToGrid || !options.gridSize) return value;
  const snapped = Math.ceil(value / options.gridSize) * options.gridSize;
  return Number.isFinite(snapped) ? snapped : 0;
}

function affinityRoleRank(role: ArchitectureSemanticRole | undefined): number {
  return role === "service" ? 0 : role === "domain" ? 1 : 2;
}

function toLayoutDiagnostic(
  diagnostic: { code: string; severity: "warning"; message: string; nodeIds: readonly string[] },
): LayoutDiagnostic {
  return { ...diagnostic, nodeIds: [...diagnostic.nodeIds] };
}

function sortedNodes(nodes: ReadonlyArray<Node>): Node[] {
  return [...nodes].sort((left, right) => left.id.localeCompare(right.id));
}

function sortedEdges(edges: ReadonlyArray<Edge>): Edge[] {
  return [...edges].sort((left, right) => left.id.localeCompare(right.id));
}

function invalidDimension(value: unknown): boolean {
  return typeof value === "number" && !boundedPositive(value, MAX_LAYOUT_DIMENSION);
}

function boundedPositive(value: unknown, maximum: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= maximum;
}

function boundedNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= MAX_LAYOUT_SPACING;
}

function boundedGridSize(value: unknown): value is number {
  return boundedPositive(value, MAX_GRID_SIZE) && value >= MIN_GRID_SIZE;
}
