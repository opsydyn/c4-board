import type { Edge, Node, XYPosition } from "@xyflow/react";
import dagre from "dagre";
import type { AzureMappedEdge, AzureMappedGraph, AzureMappedNode } from "./azure-sync.mapper";
import { AZURE_RESOURCE_GROUP_NODE_PREFIX, isAzureEdgeId, isAzureNodeId } from "./azure-sync.types";
import {
  type C4Type,
  getDefaultCouplingProfile,
  getDefaultIconId,
  getDefaultIntegrationType,
  getDefaultSubdomainType,
  type NodeData,
} from "./node-operations";

interface MergeAzureMappedGraphInput {
  readonly nodes: readonly Node[];
  readonly edges: readonly Edge[];
  readonly mapped: AzureMappedGraph;
  readonly syncedAt?: number;
}

interface MergeAzureMappedGraphOutput {
  readonly nodes: Node[];
  readonly edges: Edge[];
}

const GRID_COLUMNS = 4;
const GRID_X_GAP = 320;
const GRID_Y_GAP = 220;
const GRID_SIZE = 20;

const TYPE_DIMENSIONS: Record<C4Type, { width: number; height: number }> = {
  person: { width: 220, height: 160 },
  system: { width: 240, height: 170 },
  externalSystem: { width: 240, height: 170 },
  container: { width: 400, height: 300 },
  component: { width: 200, height: 140 },
};

const RESOURCE_GROUP_DIMENSIONS = { width: 620, height: 420 };
const RESOURCE_GROUP_CHILD_PADDING_X = 48;
const RESOURCE_GROUP_CHILD_PADDING_Y = 72;
const RESOURCE_GROUP_CHILD_PADDING_RIGHT = 48;
const RESOURCE_GROUP_CHILD_PADDING_BOTTOM = 48;

interface NodeDimensions {
  width: number;
  height: number;
}

interface DagreLayoutConfig {
  direction: "TB" | "LR";
  nodeSpacing: number;
  rankSpacing: number;
  edgeSpacing: number;
}

interface DagreEdgeLike {
  id: string;
  source: string;
  target: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isAzureNode = (node: Node): boolean => isAzureNodeId(node.id);
const isAzureEdge = (edge: Edge): boolean => isAzureEdgeId(edge.id);

const sortById = <T extends { id: string }>(input: ReadonlyArray<T>): T[] =>
  [...input].sort((a, b) => a.id.localeCompare(b.id));

const snapToGrid = (value: number): number => Math.round(value / GRID_SIZE) * GRID_SIZE;

const isAzureResourceGroupNode = (node: Node): boolean => node.id.startsWith(AZURE_RESOURCE_GROUP_NODE_PREFIX);

const fallbackDimensionsForNode = (node: Node): NodeDimensions => {
  if (isAzureResourceGroupNode(node)) {
    return RESOURCE_GROUP_DIMENSIONS;
  }
  if (node.type && node.type in TYPE_DIMENSIONS) {
    return TYPE_DIMENSIONS[node.type as C4Type];
  }
  return TYPE_DIMENSIONS.system;
};

const resolveNodeDimensions = (node: Node): NodeDimensions => {
  const fallback = fallbackDimensionsForNode(node);
  const styleWidth = typeof node.style?.width === "number" ? node.style.width : undefined;
  const styleHeight = typeof node.style?.height === "number" ? node.style.height : undefined;

  return {
    width: node.measured?.width ?? node.width ?? styleWidth ?? fallback.width,
    height: node.measured?.height ?? node.height ?? styleHeight ?? fallback.height,
  };
};

const layoutWithDagre = (
  nodes: ReadonlyArray<Node>,
  edges: ReadonlyArray<DagreEdgeLike>,
  config: DagreLayoutConfig,
): Map<string, XYPosition> => {
  if (nodes.length === 0) {
    return new Map();
  }

  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: config.direction,
    nodesep: config.nodeSpacing,
    ranksep: config.rankSpacing,
    edgesep: config.edgeSpacing,
    marginx: 0,
    marginy: 0,
  });

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const sortedNodeIds = [...nodeById.keys()].sort((a, b) => a.localeCompare(b));

  for (const nodeId of sortedNodeIds) {
    const node = nodeById.get(nodeId);
    if (!node) {
      continue;
    }
    const dimensions = resolveNodeDimensions(node);
    graph.setNode(nodeId, dimensions);
  }

  const edgeKeys = new Set<string>();
  for (const edge of sortById(edges)) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) {
      continue;
    }
    if (edge.source === edge.target) {
      continue;
    }

    const edgeKey = `${edge.source}|${edge.target}`;
    if (edgeKeys.has(edgeKey)) {
      continue;
    }
    edgeKeys.add(edgeKey);
    graph.setEdge(edge.source, edge.target);
  }

  dagre.layout(graph);

  const positions = new Map<string, XYPosition>();
  for (const nodeId of sortedNodeIds) {
    const node = nodeById.get(nodeId);
    const dagreNode = graph.node(nodeId);
    if (!node || !dagreNode) {
      continue;
    }
    const dimensions = resolveNodeDimensions(node);
    positions.set(nodeId, {
      x: snapToGrid(dagreNode.x - dimensions.width / 2),
      y: snapToGrid(dagreNode.y - dimensions.height / 2),
    });
  }

  return positions;
};

const calculateCenter = (nodes: ReadonlyArray<Node>): XYPosition => {
  if (nodes.length === 0) {
    return { x: 0, y: 0 };
  }

  let totalX = 0;
  let totalY = 0;
  for (const node of nodes) {
    const dimensions = resolveNodeDimensions(node);
    totalX += node.position.x + dimensions.width / 2;
    totalY += node.position.y + dimensions.height / 2;
  }

  return {
    x: totalX / nodes.length,
    y: totalY / nodes.length,
  };
};

const deriveTopLevelAnchor = (
  allNodes: ReadonlyArray<Node>,
  currentAzureTopNodes: ReadonlyArray<Node>,
): XYPosition => {
  if (currentAzureTopNodes.length > 0) {
    return calculateCenter(currentAzureTopNodes);
  }

  if (allNodes.length === 0) {
    return { x: 360, y: 260 };
  }

  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  for (const node of allNodes) {
    const dimensions = resolveNodeDimensions(node);
    maxX = Math.max(maxX, node.position.x + dimensions.width);
    minY = Math.min(minY, node.position.y);
  }

  return {
    x: (Number.isFinite(maxX) ? maxX : 200) + 320,
    y: (Number.isFinite(minY) ? minY : 120) + 180,
  };
};

const normalizeLayoutToOrigin = (
  positionedNodes: ReadonlyArray<{ node: Node; position: XYPosition }>,
): ReadonlyArray<{ node: Node; position: XYPosition }> => {
  if (positionedNodes.length === 0) {
    return positionedNodes;
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  for (const item of positionedNodes) {
    minX = Math.min(minX, item.position.x);
    minY = Math.min(minY, item.position.y);
  }

  return positionedNodes.map((item) => ({
    node: item.node,
    position: {
      x: item.position.x - minX,
      y: item.position.y - minY,
    },
  }));
};

const upsertNodeDimensions = (
  node: Node,
  dimensions: NodeDimensions,
): Node => ({
  ...node,
  width: dimensions.width,
  height: dimensions.height,
  style: {
    ...(isRecord(node.style) ? node.style : {}),
    width: dimensions.width,
    height: dimensions.height,
  },
});

const applyAzureSubgraphLayout = (
  nodes: ReadonlyArray<Node>,
  edges: ReadonlyArray<Edge>,
  previousNodes: ReadonlyArray<Node>,
): Node[] => {
  const azureNodes = nodes.filter(isAzureNode);
  if (azureNodes.length === 0) {
    return [...nodes];
  }

  const azureNodeById = new Map(azureNodes.map((node) => [node.id, node]));
  const azureNodeIds = new Set(azureNodeById.keys());
  const azureEdges = edges.filter(
    (edge) => azureNodeIds.has(edge.source) && azureNodeIds.has(edge.target),
  );
  const resourceGroupIds = new Set(
    azureNodes.filter(isAzureResourceGroupNode).map((node) => node.id),
  );

  const groupedChildren = new Map<string, Node[]>();
  for (const node of azureNodes) {
    if (!node.parentId || !resourceGroupIds.has(node.parentId)) {
      continue;
    }
    const siblings = groupedChildren.get(node.parentId) ?? [];
    siblings.push(node);
    groupedChildren.set(node.parentId, siblings);
  }

  const nodePositionsById = new Map<string, XYPosition>();
  const nodeDimensionsById = new Map<string, NodeDimensions>();
  const childLayoutConfig: DagreLayoutConfig = {
    direction: "TB",
    nodeSpacing: 84,
    rankSpacing: 110,
    edgeSpacing: 52,
  };

  for (const resourceGroupId of [...resourceGroupIds].sort((a, b) => a.localeCompare(b))) {
    const children = sortById(groupedChildren.get(resourceGroupId) ?? []);
    if (children.length === 0) {
      nodeDimensionsById.set(resourceGroupId, RESOURCE_GROUP_DIMENSIONS);
      continue;
    }

    const childIds = new Set(children.map((node) => node.id));
    const childEdges: DagreEdgeLike[] = azureEdges
      .filter((edge) => childIds.has(edge.source) && childIds.has(edge.target))
      .map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
      }));

    const childPositions = layoutWithDagre(children, childEdges, childLayoutConfig);
    const childLayout = normalizeLayoutToOrigin(
      children.map((node) => ({
        node,
        position: childPositions.get(node.id) ?? node.position,
      })),
    );

    let maxChildRight = 0;
    let maxChildBottom = 0;

    for (const item of childLayout) {
      const dimensions = resolveNodeDimensions(item.node);
      const relativePosition = {
        x: snapToGrid(item.position.x + RESOURCE_GROUP_CHILD_PADDING_X),
        y: snapToGrid(item.position.y + RESOURCE_GROUP_CHILD_PADDING_Y),
      };

      nodePositionsById.set(item.node.id, relativePosition);

      maxChildRight = Math.max(maxChildRight, item.position.x + dimensions.width);
      maxChildBottom = Math.max(maxChildBottom, item.position.y + dimensions.height);
    }

    nodeDimensionsById.set(resourceGroupId, {
      width: Math.max(
        RESOURCE_GROUP_DIMENSIONS.width,
        snapToGrid(
          maxChildRight + RESOURCE_GROUP_CHILD_PADDING_X + RESOURCE_GROUP_CHILD_PADDING_RIGHT,
        ),
      ),
      height: Math.max(
        RESOURCE_GROUP_DIMENSIONS.height,
        snapToGrid(
          maxChildBottom + RESOURCE_GROUP_CHILD_PADDING_Y + RESOURCE_GROUP_CHILD_PADDING_BOTTOM,
        ),
      ),
    });
  }

  const topLevelAzureNodes = sortById(
    azureNodes.filter((node) => !node.parentId || !azureNodeIds.has(node.parentId)),
  );
  if (topLevelAzureNodes.length === 0) {
    return nodes.map((node) => {
      if (!isAzureNode(node)) {
        return node;
      }
      const dimensions = nodeDimensionsById.get(node.id);
      const positionedNode = dimensions ? upsertNodeDimensions(node, dimensions) : node;
      const nextPosition = nodePositionsById.get(node.id);
      return nextPosition
        ? {
          ...positionedNode,
          position: nextPosition,
        }
        : positionedNode;
    });
  }

  const topLevelNodeById = new Map(topLevelAzureNodes.map((node) => [node.id, node]));
  const topLevelNodesForLayout = topLevelAzureNodes.map((node) => {
    const dimensions = nodeDimensionsById.get(node.id);
    return dimensions ? upsertNodeDimensions(node, dimensions) : node;
  });

  const resolveTopLevelId = (nodeId: string): string | undefined => {
    const node = azureNodeById.get(nodeId);
    if (!node) {
      return undefined;
    }
    if (node.parentId && topLevelNodeById.has(node.parentId)) {
      return node.parentId;
    }
    return topLevelNodeById.has(node.id) ? node.id : undefined;
  };

  const topLevelEdgeKeys = new Set<string>();
  const topLevelEdges: DagreEdgeLike[] = [];
  for (const edge of azureEdges) {
    const source = resolveTopLevelId(edge.source);
    const target = resolveTopLevelId(edge.target);
    if (!source || !target || source === target) {
      continue;
    }
    const key = `${source}|${target}`;
    if (topLevelEdgeKeys.has(key)) {
      continue;
    }
    topLevelEdgeKeys.add(key);
    topLevelEdges.push({
      id: `top-level:${key}`,
      source,
      target,
    });
  }

  const topLevelLayout = layoutWithDagre(topLevelNodesForLayout, topLevelEdges, {
    direction: "LR",
    nodeSpacing: 140,
    rankSpacing: 220,
    edgeSpacing: 84,
  });
  const topLevelPositionedNodes = normalizeLayoutToOrigin(
    topLevelNodesForLayout.map((node) => ({
      node,
      position: topLevelLayout.get(node.id) ?? node.position,
    })),
  );

  const currentAzureTopNodes = previousNodes.filter(
    (node) => isAzureNode(node) && (!node.parentId || !isAzureNodeId(node.parentId)),
  );
  const anchor = deriveTopLevelAnchor(previousNodes, currentAzureTopNodes);
  const centeredTopLevel = topLevelPositionedNodes.map(({ node, position }) => ({
    ...node,
    position,
  }));
  const layoutCenter = calculateCenter(centeredTopLevel);
  const offsetX = anchor.x - layoutCenter.x;
  const offsetY = anchor.y - layoutCenter.y;

  for (const item of topLevelPositionedNodes) {
    nodePositionsById.set(item.node.id, {
      x: snapToGrid(item.position.x + offsetX),
      y: snapToGrid(item.position.y + offsetY),
    });
  }

  return nodes.map((node) => {
    if (!isAzureNode(node)) {
      return node;
    }

    const dimensions = nodeDimensionsById.get(node.id);
    const positionedNode = dimensions ? upsertNodeDimensions(node, dimensions) : node;
    const nextPosition = nodePositionsById.get(node.id);

    return nextPosition
      ? {
        ...positionedNode,
        position: nextPosition,
      }
      : positionedNode;
  });
};

const createPlacementGenerator = (existingNodes: ReadonlyArray<Node>) => {
  if (existingNodes.length === 0) {
    let index = 0;
    return (): XYPosition => {
      const position = {
        x: 120 + (index % GRID_COLUMNS) * GRID_X_GAP,
        y: 120 + Math.floor(index / GRID_COLUMNS) * GRID_Y_GAP,
      };
      index += 1;
      return position;
    };
  }

  const minX = existingNodes.reduce((acc, node) => Math.min(acc, node.position.x), Number.POSITIVE_INFINITY);
  const maxY = existingNodes.reduce((acc, node) => Math.max(acc, node.position.y), Number.NEGATIVE_INFINITY);

  const anchorX = Number.isFinite(minX) ? minX : 120;
  const anchorY = Number.isFinite(maxY) ? maxY + GRID_Y_GAP : 120;

  let index = 0;
  return (): XYPosition => {
    const position = {
      x: anchorX + (index % GRID_COLUMNS) * GRID_X_GAP,
      y: anchorY + Math.floor(index / GRID_COLUMNS) * GRID_Y_GAP,
    };
    index += 1;
    return position;
  };
};

const mergeNodeData = (
  mappedNode: AzureMappedNode,
  existingData: Partial<NodeData>,
  syncedAt: number,
): NodeData => {
  const subdomainType = existingData.subdomainType ?? getDefaultSubdomainType(mappedNode.type);
  const integrationType = existingData.integrationType ?? getDefaultIntegrationType(mappedNode.type);
  const couplingProfile = existingData.couplingProfile ?? getDefaultCouplingProfile(mappedNode.type);
  const couplingScoreMode = existingData.couplingScoreMode ?? "auto";
  const iconId = existingData.iconId ?? getDefaultIconId(mappedNode.type);
  const createdAt = existingData.createdAt ?? syncedAt;
  const teamOwnership = mappedNode.teamOwnership ?? existingData.teamOwnership;

  return {
    ...existingData,
    label: mappedNode.label,
    description: mappedNode.description,
    technology: mappedNode.technology,
    c4Type: mappedNode.type,
    subdomainType,
    integrationType,
    couplingProfile,
    couplingScoreMode,
    iconId,
    createdAt,
    sourceProvider: "azure",
    sourceResourceId: mappedNode.sourceResourceId,
    sourceResourceType: mappedNode.sourceResourceType,
    lastSyncedAt: syncedAt,
    syncVersion: 1,
    ...(typeof teamOwnership === "string" && teamOwnership.trim().length > 0
      ? { teamOwnership }
      : {}),
  };
};

const mergeMappedNode = (
  existingNode: Node,
  mappedNode: AzureMappedNode,
  syncedAt: number,
): Node<NodeData> => {
  const priorData = isRecord(existingNode.data)
    ? existingNode.data as Partial<NodeData>
    : {};

  const baseNode = {
    ...existingNode,
    type: mappedNode.type,
    data: mergeNodeData(mappedNode, priorData, syncedAt),
  };

  if (mappedNode.parentGroupId) {
    return {
      ...baseNode,
      parentId: mappedNode.parentGroupId,
      extent: "parent",
      expandParent: true,
    };
  }

  const nodeWithoutParent = {
    ...baseNode,
  };
  delete nodeWithoutParent.parentId;
  delete nodeWithoutParent.extent;
  delete nodeWithoutParent.expandParent;
  return nodeWithoutParent;
};

const createMappedNode = (
  mappedNode: AzureMappedNode,
  position: XYPosition,
  syncedAt: number,
): Node<NodeData> => {
  const dimensions = mappedNode.isSyntheticContainer
    ? RESOURCE_GROUP_DIMENSIONS
    : TYPE_DIMENSIONS[mappedNode.type];

  const baseNode = {
    id: mappedNode.id,
    type: mappedNode.type,
    position,
    width: dimensions.width,
    height: dimensions.height,
    style: {
      width: dimensions.width,
      height: dimensions.height,
    },
    data: mergeNodeData(mappedNode, {}, syncedAt),
  } satisfies Node<NodeData>;

  if (mappedNode.parentGroupId) {
    return {
      ...baseNode,
      parentId: mappedNode.parentGroupId,
      extent: "parent",
      expandParent: true,
    };
  }

  return baseNode;
};

const mergeMappedEdge = (
  existingEdge: Edge | null,
  mappedEdge: AzureMappedEdge,
  syncedAt: number,
): Edge => {
  const existingData = existingEdge && isRecord(existingEdge.data)
    ? existingEdge.data
    : {};

  const priorCreatedAt = typeof existingData.createdAt === "number"
    ? existingData.createdAt
    : syncedAt;

  return {
    ...(existingEdge ?? {}),
    id: mappedEdge.id,
    source: mappedEdge.source,
    target: mappedEdge.target,
    label: mappedEdge.label,
    type: "default",
    data: {
      ...existingData,
      sourceProvider: "azure",
      relationshipType: mappedEdge.relationshipType,
      confidence: mappedEdge.confidence,
      provenanceSource: mappedEdge.provenanceSource,
      ...(mappedEdge.provenanceDetail ? { provenanceDetail: mappedEdge.provenanceDetail } : {}),
      createdAt: priorCreatedAt,
      lastSyncedAt: syncedAt,
      syncVersion: 1,
    },
  };
};

export const mergeAzureMappedGraphIntoCanvas = (
  input: MergeAzureMappedGraphInput,
): MergeAzureMappedGraphOutput => {
  const syncedAt = input.syncedAt ?? Date.now();
  const mappedNodes = sortById(input.mapped.nodes);
  const mappedEdges = sortById(input.mapped.edges);

  const mappedNodesById = new Map(mappedNodes.map((node) => [node.id, node]));
  const mergedNodes: Node[] = [];
  const consumedNodeIds = new Set<string>();

  for (const node of input.nodes) {
    if (!isAzureNode(node)) {
      mergedNodes.push(node);
      continue;
    }

    const mappedNode = mappedNodesById.get(node.id);
    if (!mappedNode) {
      continue;
    }

    mergedNodes.push(mergeMappedNode(node, mappedNode, syncedAt));
    consumedNodeIds.add(node.id);
  }

  const placeNext = createPlacementGenerator(mergedNodes);

  for (const mappedNode of mappedNodes) {
    if (consumedNodeIds.has(mappedNode.id)) {
      continue;
    }

    mergedNodes.push(createMappedNode(mappedNode, placeNext(), syncedAt));
  }

  const mergedNodeIds = new Set(mergedNodes.map((node) => node.id));
  const mappedEdgesById = new Map(mappedEdges.map((edge) => [edge.id, edge]));
  const mergedEdges: Edge[] = [];
  const consumedEdgeIds = new Set<string>();

  for (const edge of input.edges) {
    if (!isAzureEdge(edge)) {
      mergedEdges.push(edge);
      continue;
    }

    const mappedEdge = mappedEdgesById.get(edge.id);
    if (!mappedEdge) {
      continue;
    }

    mergedEdges.push(mergeMappedEdge(edge, mappedEdge, syncedAt));
    consumedEdgeIds.add(edge.id);
  }

  for (const mappedEdge of mappedEdges) {
    if (consumedEdgeIds.has(mappedEdge.id)) {
      continue;
    }

    mergedEdges.push(mergeMappedEdge(null, mappedEdge, syncedAt));
  }

  const retainedEdges = mergedEdges.filter(
    (edge) => mergedNodeIds.has(edge.source) && mergedNodeIds.has(edge.target),
  );
  const layoutedNodes = applyAzureSubgraphLayout(
    mergedNodes,
    retainedEdges,
    input.nodes,
  );

  return {
    nodes: layoutedNodes,
    edges: retainedEdges,
  };
};
