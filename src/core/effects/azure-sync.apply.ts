import type { Edge, Node, XYPosition } from "@xyflow/react";
import type { AzureMappedEdge, AzureMappedGraph, AzureMappedNode } from "./azure-sync.mapper";
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

const AZURE_NODE_ID_PREFIX = "azure:";
const AZURE_EDGE_ID_PREFIX = "azure-edge:";

const GRID_COLUMNS = 4;
const GRID_X_GAP = 320;
const GRID_Y_GAP = 220;

const TYPE_DIMENSIONS: Record<C4Type, { width: number; height: number }> = {
  person: { width: 220, height: 160 },
  system: { width: 240, height: 170 },
  externalSystem: { width: 240, height: 170 },
  container: { width: 400, height: 300 },
  component: { width: 200, height: 140 },
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isAzureNode = (node: Node): boolean => node.id.startsWith(AZURE_NODE_ID_PREFIX);
const isAzureEdge = (edge: Edge): boolean => edge.id.startsWith(AZURE_EDGE_ID_PREFIX);

const sortById = <T extends { id: string }>(input: ReadonlyArray<T>): T[] =>
  [...input].sort((a, b) => a.id.localeCompare(b.id));

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

  return {
    ...existingNode,
    type: mappedNode.type,
    data: mergeNodeData(mappedNode, priorData, syncedAt),
  };
};

const createMappedNode = (
  mappedNode: AzureMappedNode,
  position: XYPosition,
  syncedAt: number,
): Node<NodeData> => {
  const dimensions = TYPE_DIMENSIONS[mappedNode.type];
  return {
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
  };
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

  return {
    nodes: mergedNodes,
    edges: mergedEdges.filter(
      (edge) => mergedNodeIds.has(edge.source) && mergedNodeIds.has(edge.target),
    ),
  };
};
