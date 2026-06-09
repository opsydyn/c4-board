import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react";
import type { RigC4BoardEdge, RigC4BoardNode, RigC4BoardNodeType, RigC4BoardSummary } from "./agent-tools/contracts";
import type { NodeData } from "./node-operations";
import type { OpyAgentCheckpoint } from "./opy-chat.persistence";

export type OpyCheckpointRestoreImpactCategory = "node" | "edge";
export type OpyCheckpointRestoreImpactStatus = "restore" | "revert" | "remove";

export interface OpyCheckpointRestoreImpactEntity {
  readonly id: string;
  readonly category: OpyCheckpointRestoreImpactCategory;
  readonly status: OpyCheckpointRestoreImpactStatus;
  readonly title: string;
  readonly detail: string;
}

export interface OpyCheckpointRestorePreviewCounts {
  readonly restoreNodes: number;
  readonly revertNodes: number;
  readonly removeNodes: number;
  readonly restoreEdges: number;
  readonly revertEdges: number;
  readonly removeEdges: number;
}

export interface OpyCheckpointRestorePreview {
  readonly checkpointId: string;
  readonly checkpointBoard: RigC4BoardSummary;
  readonly currentBoard: RigC4BoardSummary;
  readonly impactedEntities: ReadonlyArray<OpyCheckpointRestoreImpactEntity>;
  readonly counts: OpyCheckpointRestorePreviewCounts;
  readonly hasChanges: boolean;
}

const RIG_C4_NODE_TYPES = new Set<RigC4BoardNodeType>([
  "person",
  "system",
  "externalSystem",
  "container",
  "component",
]);

const isRigC4BoardNodeType = (value: unknown): value is RigC4BoardNodeType =>
  typeof value === "string" && RIG_C4_NODE_TYPES.has(value as RigC4BoardNodeType);

const toNullableTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toCheckpointBoardNode = (node: ReactFlowNode): RigC4BoardNode | null => {
  const data = (node.data ?? {}) as Partial<NodeData>;
  const nodeType = data.c4Type ?? (typeof node.type === "string" ? node.type : undefined);

  if (!isRigC4BoardNodeType(nodeType)) {
    return null;
  }

  return {
    id: node.id,
    label: toNullableTrimmedString(data.label) ?? node.id,
    nodeType,
    description: toNullableTrimmedString(data.description),
    technology: toNullableTrimmedString(data.technology),
    teamOwnership: toNullableTrimmedString(data.teamOwnership),
  };
};

const toCheckpointBoardSummary = (checkpoint: OpyAgentCheckpoint): RigC4BoardSummary => {
  const nodes = checkpoint.snapshot.nodes
    .map((node: ReactFlowNode) => toCheckpointBoardNode(node))
    .filter((node: RigC4BoardNode | null): node is RigC4BoardNode => node !== null);
  const nodeLabelById = new Map(nodes.map((node) => [node.id, node.label] as const));
  const edges = checkpoint.snapshot.edges.map((edge: ReactFlowEdge): RigC4BoardEdge => ({
    id: edge.id,
    sourceId: edge.source,
    targetId: edge.target,
    sourceLabel: nodeLabelById.get(edge.source) ?? edge.source,
    targetLabel: nodeLabelById.get(edge.target) ?? edge.target,
    label: typeof edge.label === "string" && edge.label.trim().length > 0
      ? edge.label.trim()
      : null,
  }));

  return {
    diagramId: checkpoint.diagramId,
    diagramName: toNullableTrimmedString(checkpoint.snapshot.name),
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodes,
    edges,
  };
};

const sameBoardNode = (left: RigC4BoardNode, right: RigC4BoardNode): boolean =>
  left.label === right.label
  && left.nodeType === right.nodeType
  && left.description === right.description
  && left.technology === right.technology
  && left.teamOwnership === right.teamOwnership;

const sameBoardEdge = (left: RigC4BoardEdge, right: RigC4BoardEdge): boolean =>
  left.sourceId === right.sourceId
  && left.targetId === right.targetId
  && left.label === right.label;

const formatFieldList = (fields: ReadonlyArray<string>): string =>
  fields.map((field) => field.toUpperCase()).join(" | ");

const summarizeNodeChanges = (currentNode: RigC4BoardNode, checkpointNode: RigC4BoardNode): string => {
  const changedFields: string[] = [];

  if (currentNode.label !== checkpointNode.label) {
    changedFields.push("label");
  }
  if (currentNode.nodeType !== checkpointNode.nodeType) {
    changedFields.push("nodeType");
  }
  if (currentNode.description !== checkpointNode.description) {
    changedFields.push("description");
  }
  if (currentNode.technology !== checkpointNode.technology) {
    changedFields.push("technology");
  }
  if (currentNode.teamOwnership !== checkpointNode.teamOwnership) {
    changedFields.push("teamOwnership");
  }

  return changedFields.length > 0
    ? `Revert node fields: ${formatFieldList(changedFields)}.`
    : "Revert node to checkpoint state.";
};

const summarizeEdgeChanges = (currentEdge: RigC4BoardEdge, checkpointEdge: RigC4BoardEdge): string => {
  const changedFields: string[] = [];

  if (currentEdge.sourceId !== checkpointEdge.sourceId) {
    changedFields.push("source");
  }
  if (currentEdge.targetId !== checkpointEdge.targetId) {
    changedFields.push("target");
  }
  if (currentEdge.label !== checkpointEdge.label) {
    changedFields.push("label");
  }

  return changedFields.length > 0
    ? `Revert relationship fields: ${formatFieldList(changedFields)}.`
    : "Revert relationship to checkpoint state.";
};

const formatEdgeTitle = (edge: RigC4BoardEdge): string =>
  `${edge.sourceLabel} -> ${edge.targetLabel}${edge.label ? ` (${edge.label})` : ""}`;

const compareImpactStatus = (status: OpyCheckpointRestoreImpactStatus): number => {
  switch (status) {
    case "restore":
      return 0;
    case "revert":
      return 1;
    case "remove":
      return 2;
  }
};

const sortImpacts = (
  impacts: ReadonlyArray<OpyCheckpointRestoreImpactEntity>,
): ReadonlyArray<OpyCheckpointRestoreImpactEntity> =>
  [...impacts].sort((left, right) =>
    compareImpactStatus(left.status) - compareImpactStatus(right.status)
    || left.category.localeCompare(right.category)
    || left.title.localeCompare(right.title)
  );

export const selectLatestOpyAgentCheckpoint = (
  checkpoints: ReadonlyArray<OpyAgentCheckpoint>,
): OpyAgentCheckpoint | null => checkpoints[0] ?? null;

export const formatOpyRollbackSummary = (checkpoint: OpyAgentCheckpoint): string =>
  `ROLLBACK READY:: CHECKPOINT ${
    checkpoint.id.slice(0, 8)
  } · ${checkpoint.snapshot.nodes.length} NODE(S) · ${checkpoint.snapshot.edges.length} EDGE(S)`;

export const buildOpyCheckpointRestorePreview = (
  checkpoint: OpyAgentCheckpoint,
  currentBoard: RigC4BoardSummary | null,
): OpyCheckpointRestorePreview | null => {
  if (!currentBoard) {
    return null;
  }

  const checkpointBoard = toCheckpointBoardSummary(checkpoint);
  const currentNodeById = new Map(currentBoard.nodes.map((node) => [node.id, node] as const));
  const checkpointNodeById = new Map(checkpointBoard.nodes.map((node) => [node.id, node] as const));
  const currentEdgeById = new Map(currentBoard.edges.map((edge) => [edge.id, edge] as const));
  const checkpointEdgeById = new Map(checkpointBoard.edges.map((edge) => [edge.id, edge] as const));
  const impacts: OpyCheckpointRestoreImpactEntity[] = [];
  const counts = {
    restoreNodes: 0,
    revertNodes: 0,
    removeNodes: 0,
    restoreEdges: 0,
    revertEdges: 0,
    removeEdges: 0,
  } satisfies OpyCheckpointRestorePreviewCounts;

  checkpointBoard.nodes.forEach((checkpointNode) => {
    const currentNode = currentNodeById.get(checkpointNode.id);

    if (!currentNode) {
      counts.restoreNodes += 1;
      impacts.push({
        id: `restore-node:${checkpointNode.id}`,
        category: "node",
        status: "restore",
        title: `${checkpointNode.nodeType.toUpperCase()} ${checkpointNode.label}`,
        detail: `Restore missing node ${checkpointNode.id} from the checkpoint snapshot.`,
      });
      return;
    }

    if (!sameBoardNode(currentNode, checkpointNode)) {
      counts.revertNodes += 1;
      impacts.push({
        id: `revert-node:${checkpointNode.id}`,
        category: "node",
        status: "revert",
        title: `${checkpointNode.nodeType.toUpperCase()} ${checkpointNode.label}`,
        detail: summarizeNodeChanges(currentNode, checkpointNode),
      });
    }
  });

  currentBoard.nodes.forEach((currentNode) => {
    if (checkpointNodeById.has(currentNode.id)) {
      return;
    }

    counts.removeNodes += 1;
    impacts.push({
      id: `remove-node:${currentNode.id}`,
      category: "node",
      status: "remove",
      title: `${currentNode.nodeType.toUpperCase()} ${currentNode.label}`,
      detail: `Remove current-only node ${currentNode.id} to match the checkpoint snapshot.`,
    });
  });

  checkpointBoard.edges.forEach((checkpointEdge) => {
    const currentEdge = currentEdgeById.get(checkpointEdge.id);

    if (!currentEdge) {
      counts.restoreEdges += 1;
      impacts.push({
        id: `restore-edge:${checkpointEdge.id}`,
        category: "edge",
        status: "restore",
        title: formatEdgeTitle(checkpointEdge),
        detail: `Restore missing relationship ${checkpointEdge.id} from the checkpoint snapshot.`,
      });
      return;
    }

    if (!sameBoardEdge(currentEdge, checkpointEdge)) {
      counts.revertEdges += 1;
      impacts.push({
        id: `revert-edge:${checkpointEdge.id}`,
        category: "edge",
        status: "revert",
        title: formatEdgeTitle(checkpointEdge),
        detail: summarizeEdgeChanges(currentEdge, checkpointEdge),
      });
    }
  });

  currentBoard.edges.forEach((currentEdge) => {
    if (checkpointEdgeById.has(currentEdge.id)) {
      return;
    }

    counts.removeEdges += 1;
    impacts.push({
      id: `remove-edge:${currentEdge.id}`,
      category: "edge",
      status: "remove",
      title: formatEdgeTitle(currentEdge),
      detail: `Remove current-only relationship ${currentEdge.id} to match the checkpoint snapshot.`,
    });
  });

  return {
    checkpointId: checkpoint.id,
    checkpointBoard,
    currentBoard,
    impactedEntities: sortImpacts(impacts),
    counts,
    hasChanges: impacts.length > 0,
  };
};
