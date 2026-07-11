import type { Edge, Node } from "@xyflow/react";
import dagre from "dagre";
import { evaluateLayoutQuality } from "./layout-metrics";
import { getNodeDimensions } from "./layout-node-size";
import type {
  LayoutDiagnostic,
  LayoutInput,
  LayoutOptions,
  LayoutResult,
  SynchronousLayoutStrategy,
} from "./layout.types";

export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  direction: "TB",
  nodeSpacing: 80,
  rankSpacing: 120,
  edgeSpacing: 20,
  snapToGrid: true,
  gridSize: 20,
};

export const dagreLayoutStrategy: SynchronousLayoutStrategy = {
  id: "dagre-hierarchical",
  engine: "dagre",
  analyse: ({ nodes }) => {
    const applicable = nodes.some((node) => !node.parentId);
    return {
      applicable,
      score: applicable ? 1 : 0,
      reasons: ["Dagre is the compatibility strategy for directed hierarchical layouts."],
    };
  },
  layout: layoutWithDagre,
};

export function layoutWithDagre(input: LayoutInput): LayoutResult {
  const { nodes, edges } = input;
  const options = { ...DEFAULT_LAYOUT_OPTIONS, ...input.options };
  const topLevelNodes = nodes.filter((node) => !node.parentId);
  const childNodes = nodes.filter((node) => node.parentId);
  const topLevelNodeIds = new Set(topLevelNodes.map((node) => node.id));
  const graph = new dagre.graphlib.Graph();

  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: options.direction,
    nodesep: options.nodeSpacing,
    ranksep: options.rankSpacing,
    edgesep: options.edgeSpacing,
    marginx: 40,
    marginy: 40,
  });

  for (const node of topLevelNodes) {
    graph.setNode(node.id, getNodeDimensions(node));
  }

  const includedEdges = edges.filter(
    (edge) => topLevelNodeIds.has(edge.source) && topLevelNodeIds.has(edge.target),
  );
  for (const edge of includedEdges) graph.setEdge(edge.source, edge.target);

  dagre.layout(graph);

  const layoutedTopLevelNodes = topLevelNodes.map((node) => applyDagrePosition(node, graph, options));
  const layoutedNodes = [...layoutedTopLevelNodes, ...childNodes];
  const diagnostics = buildDiagnostics(childNodes, edges, includedEdges);

  return {
    nodes: layoutedNodes,
    edges,
    strategyId: dagreLayoutStrategy.id,
    engine: dagreLayoutStrategy.engine,
    diagnostics,
    quality: evaluateLayoutQuality(layoutedNodes, edges, nodes),
  };
}

function applyDagrePosition(
  node: Node,
  graph: dagre.graphlib.Graph,
  options: LayoutOptions,
): Node {
  const position = graph.node(node.id);
  const { width, height } = getNodeDimensions(node);
  let x = position.x - width / 2;
  let y = position.y - height / 2;

  if (options.snapToGrid && options.gridSize) {
    x = Math.round(x / options.gridSize) * options.gridSize;
    y = Math.round(y / options.gridSize) * options.gridSize;
  }

  return { ...node, position: { x, y } };
}

function buildDiagnostics(
  childNodes: Node[],
  edges: Edge[],
  includedEdges: Edge[],
): LayoutDiagnostic[] {
  const diagnostics: LayoutDiagnostic[] = [];

  if (childNodes.length > 0) {
    diagnostics.push({
      code: "dagre-child-positions-preserved",
      severity: "info",
      message: `${childNodes.length} child node position(s) were preserved by the Dagre compatibility strategy.`,
      nodeIds: childNodes.map((node) => node.id),
    });
  }

  if (includedEdges.length < edges.length) {
    const includedEdgeIds = new Set(includedEdges.map((edge) => edge.id));
    const excludedEdges = edges.filter((edge) => !includedEdgeIds.has(edge.id));
    diagnostics.push({
      code: "dagre-hierarchy-edges-excluded",
      severity: "warning",
      message: `${excludedEdges.length} hierarchy-crossing edge(s) did not influence Dagre placement.`,
      edgeIds: excludedEdges.map((edge) => edge.id),
    });
  }

  return diagnostics;
}
