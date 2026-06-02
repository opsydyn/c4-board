import type { RigC4BoardNode, RigC4BoardSummary } from "./ai-agent.runtime";

export interface OpyBoardContextNodeSnapshot {
  readonly id: string;
  readonly label: string;
  readonly nodeType: RigC4BoardNode["nodeType"];
  readonly relationshipCount: number;
  readonly teamOwnership: string | null;
  readonly description: string | null;
  readonly technology: string | null;
}

export interface OpyBoardContextScope {
  readonly id: "whole-board" | "selected-node" | "hotspot";
  readonly label: string;
  readonly hint: string;
  readonly focus: string | null;
  readonly node: OpyBoardContextNodeSnapshot | null;
}

export interface OpyBoardContextRegistry {
  readonly diagramId: string | null;
  readonly diagramName: string;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly ownershipTeamCount: number;
  readonly selectedNode: OpyBoardContextNodeSnapshot | null;
  readonly hotspotNode: OpyBoardContextNodeSnapshot | null;
  readonly scopes: ReadonlyArray<OpyBoardContextScope>;
  readonly promptContext: string;
}

interface BuildOpyBoardContextRegistryInput {
  readonly boardSummary: RigC4BoardSummary | null;
  readonly selectedNodeId: string | null;
}

const normalizeLabel = (value: string | null | undefined): string => {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : "UNTITLED BOARD";
};

const countRelationshipsByNodeId = (
  boardSummary: RigC4BoardSummary,
): ReadonlyMap<string, number> => {
  const counts = new Map<string, number>();

  for (const edge of boardSummary.edges) {
    counts.set(edge.sourceId, (counts.get(edge.sourceId) ?? 0) + 1);
    counts.set(edge.targetId, (counts.get(edge.targetId) ?? 0) + 1);
  }

  return counts;
};

const toNodeSnapshot = (
  node: RigC4BoardNode,
  relationshipCounts: ReadonlyMap<string, number>,
): OpyBoardContextNodeSnapshot => ({
  id: node.id,
  label: node.label,
  nodeType: node.nodeType,
  relationshipCount: relationshipCounts.get(node.id) ?? 0,
  teamOwnership: node.teamOwnership,
  description: node.description,
  technology: node.technology,
});

const formatNodeScopeLabel = (prefix: string, node: OpyBoardContextNodeSnapshot): string =>
  `${prefix} · ${node.nodeType.toUpperCase()} ${node.label}`;

const formatNodeScopeHint = (
  node: OpyBoardContextNodeSnapshot,
  suffix: string,
): string => {
  const metadata = [
    `${node.relationshipCount} links`,
    node.teamOwnership ? `TEAM ${node.teamOwnership}` : null,
    node.technology ? `TECH ${node.technology}` : null,
    suffix,
  ].filter((value): value is string => value !== null);

  return metadata.join(" · ");
};

const formatBoardScopeHint = (
  boardSummary: RigC4BoardSummary,
  ownershipTeamCount: number,
): string => {
  const metadata = [
    `${boardSummary.nodeCount} nodes`,
    `${boardSummary.edgeCount} edges`,
    ownershipTeamCount > 0 ? `${ownershipTeamCount} teams` : null,
  ].filter((value): value is string => value !== null);

  return metadata.join(" · ");
};

const buildPromptContext = (
  boardSummary: RigC4BoardSummary,
  selectedNode: OpyBoardContextNodeSnapshot | null,
  hotspotNode: OpyBoardContextNodeSnapshot | null,
  ownershipTeamCount: number,
): string => {
  const parts = [
    `DOMAIN=C4`,
    `DIAGRAM=${boardSummary.diagramId ?? "unsaved"}`,
    `NAME=${normalizeLabel(boardSummary.diagramName)}`,
    `NODES=${boardSummary.nodeCount}`,
    `EDGES=${boardSummary.edgeCount}`,
    `TEAMS=${ownershipTeamCount}`,
  ];

  if (selectedNode) {
    parts.push(
      `SELECTED=${selectedNode.nodeType.toUpperCase()} ${selectedNode.label}`,
      `SELECTED_LINKS=${selectedNode.relationshipCount}`,
    );
  }

  if (hotspotNode) {
    parts.push(
      `HOTSPOT=${hotspotNode.nodeType.toUpperCase()} ${hotspotNode.label}`,
      `HOTSPOT_LINKS=${hotspotNode.relationshipCount}`,
    );
  }

  return parts.join(" | ");
};

export const buildOpyBoardContextRegistry = (
  input: BuildOpyBoardContextRegistryInput,
): OpyBoardContextRegistry | null => {
  const { boardSummary, selectedNodeId } = input;
  if (!boardSummary) {
    return null;
  }

  const relationshipCounts = countRelationshipsByNodeId(boardSummary);
  const ownershipTeamCount = new Set(
    boardSummary.nodes
      .map((node) => node.teamOwnership?.trim())
      .filter((value): value is string => Boolean(value)),
  ).size;

  const nodesById = new Map(
    boardSummary.nodes.map((node) => [node.id, toNodeSnapshot(node, relationshipCounts)] as const),
  );
  const selectedNode = selectedNodeId ? nodesById.get(selectedNodeId) ?? null : null;
  const hotspotNode = [...nodesById.values()]
    .sort((left, right) => right.relationshipCount - left.relationshipCount || left.label.localeCompare(right.label))[0]
    ?? null;

  const scopes: OpyBoardContextScope[] = [
    {
      id: "whole-board",
      label: `BOARD · ${normalizeLabel(boardSummary.diagramName)}`,
      hint: formatBoardScopeHint(boardSummary, ownershipTeamCount),
      focus: `Review the whole board ${normalizeLabel(boardSummary.diagramName)} and its systemic structure.`,
      node: null,
    },
  ];

  if (selectedNode) {
    scopes.push({
      id: "selected-node",
      label: formatNodeScopeLabel("SELECTED", selectedNode),
      hint: formatNodeScopeHint(selectedNode, "operator focus"),
      focus: `Review the selected ${selectedNode.nodeType} ${selectedNode.label} and its immediate relationships.`,
      node: selectedNode,
    });
  }

  if (hotspotNode && hotspotNode.id !== selectedNode?.id) {
    scopes.push({
      id: "hotspot",
      label: formatNodeScopeLabel("HOTSPOT", hotspotNode),
      hint: formatNodeScopeHint(hotspotNode, "highest connectivity"),
      focus: `Review the connectivity hotspot ${hotspotNode.label} for coupling and risk concentration.`,
      node: hotspotNode,
    });
  }

  return {
    diagramId: boardSummary.diagramId,
    diagramName: normalizeLabel(boardSummary.diagramName),
    nodeCount: boardSummary.nodeCount,
    edgeCount: boardSummary.edgeCount,
    ownershipTeamCount,
    selectedNode,
    hotspotNode,
    scopes,
    promptContext: buildPromptContext(boardSummary, selectedNode, hotspotNode, ownershipTeamCount),
  };
};
