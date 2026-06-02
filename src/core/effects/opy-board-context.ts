import type { RigC4BoardNode, RigC4BoardSummary } from "./ai-agent.runtime";
import type {
  RigReadBoardSummaryResult,
  RigReadEdgeLookupResult,
  RigReadNodeLookupResult,
} from "./agent-tools/contracts";
import { executeRigReadTool } from "./agent-tools/read-tools";

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

const toNodeSnapshot = (
  lookup: RigReadNodeLookupResult,
): OpyBoardContextNodeSnapshot => ({
  id: lookup.node!.id,
  label: lookup.node!.label,
  nodeType: lookup.node!.nodeType,
  relationshipCount: lookup.relationshipCount,
  teamOwnership: lookup.node!.teamOwnership,
  description: lookup.node!.description,
  technology: lookup.node!.technology,
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
  boardSummary: RigReadBoardSummaryResult,
): string => {
  const metadata = [
    `${boardSummary.nodeCount} nodes`,
    `${boardSummary.edgeCount} edges`,
    boardSummary.ownershipTeams.length > 0 ? `${boardSummary.ownershipTeams.length} teams` : null,
  ].filter((value): value is string => value !== null);

  return metadata.join(" · ");
};

const buildPromptContext = (
  boardSummary: RigReadBoardSummaryResult,
  selectedNode: OpyBoardContextNodeSnapshot | null,
  hotspotNode: OpyBoardContextNodeSnapshot | null,
  selectedEdge: RigReadEdgeLookupResult | null,
): string => {
  const parts = [
    `DOMAIN=C4`,
    `DIAGRAM=${boardSummary.diagramId ?? "unsaved"}`,
    `NAME=${normalizeLabel(boardSummary.diagramName)}`,
    `NODES=${boardSummary.nodeCount}`,
    `EDGES=${boardSummary.edgeCount}`,
    `TEAMS=${boardSummary.ownershipTeams.length}`,
  ];

  if (selectedNode) {
    parts.push(
      `SELECTED=${selectedNode.nodeType.toUpperCase()} ${selectedNode.label}`,
      `SELECTED_LINKS=${selectedNode.relationshipCount}`,
    );
  }

  if (selectedEdge?.found && selectedEdge.edge) {
    parts.push(
      `SELECTED_EDGE=${selectedEdge.edge.sourceLabel}->${selectedEdge.edge.targetLabel}`,
      `SELECTED_EDGE_LABEL=${selectedEdge.edge.label ?? "(no label)"}`,
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

  const boardSummaryResult = executeRigReadTool("board_summary", {}, boardSummary);
  const selectedNodeLookup = selectedNodeId
    ? executeRigReadTool("node_lookup", { nodeId: selectedNodeId }, boardSummary)
    : null;
  const selectedNode = selectedNodeLookup?.found ? toNodeSnapshot(selectedNodeLookup) : null;
  const selectedEdge = selectedNodeLookup?.found && selectedNodeLookup.connectedEdges[0]
    ? executeRigReadTool(
      "edge_lookup",
      { edgeId: selectedNodeLookup.connectedEdges[0].id },
      boardSummary,
    )
    : null;
  const hotspotNodeLookup = boardSummaryResult.nodes
    .map((node) => executeRigReadTool("node_lookup", { nodeId: node.id }, boardSummary))
    .filter((lookup): lookup is RigReadNodeLookupResult => lookup.found)
    .sort((left, right) => right.relationshipCount - left.relationshipCount || left.node!.label.localeCompare(right.node!.label))[0]
    ?? null;
  const hotspotNode = hotspotNodeLookup?.found ? toNodeSnapshot(hotspotNodeLookup) : null;

  const scopes: OpyBoardContextScope[] = [
    {
      id: "whole-board",
      label: `BOARD · ${normalizeLabel(boardSummaryResult.diagramName)}`,
      hint: formatBoardScopeHint(boardSummaryResult),
      focus: `Review the whole board ${normalizeLabel(boardSummaryResult.diagramName)} and its systemic structure.`,
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
    diagramId: boardSummaryResult.diagramId,
    diagramName: normalizeLabel(boardSummaryResult.diagramName),
    nodeCount: boardSummaryResult.nodeCount,
    edgeCount: boardSummaryResult.edgeCount,
    ownershipTeamCount: boardSummaryResult.ownershipTeams.length,
    selectedNode,
    hotspotNode,
    scopes,
    promptContext: buildPromptContext(boardSummaryResult, selectedNode, hotspotNode, selectedEdge),
  };
};
