import type {
  RigC4BoardEdge,
  RigC4BoardNode,
  RigC4BoardSummary,
  RigC4DiagramProposal,
  RigC4ProposalEdge,
  RigC4ProposalNode,
} from "./ai-agent.runtime";

export type OpyProposalDiffStatus = "new" | "existing" | "ambiguous";

export interface OpyGroundedProposalNodeDiff {
  readonly node: RigC4ProposalNode;
  readonly status: OpyProposalDiffStatus;
  readonly matches: ReadonlyArray<RigC4BoardNode>;
}

export interface OpyGroundedProposalEdgeDiff {
  readonly edge: RigC4ProposalEdge;
  readonly status: OpyProposalDiffStatus;
  readonly matches: ReadonlyArray<RigC4BoardEdge>;
  readonly sourceNode: RigC4ProposalNode | null;
  readonly targetNode: RigC4ProposalNode | null;
}

export interface OpyGroundedProposalDiff {
  readonly nodeDiffs: ReadonlyArray<OpyGroundedProposalNodeDiff>;
  readonly edgeDiffs: ReadonlyArray<OpyGroundedProposalEdgeDiff>;
}

export interface OpyGroundedProposalSummary {
  readonly newNodes: number;
  readonly existingNodes: number;
  readonly ambiguousNodes: number;
  readonly newEdges: number;
  readonly existingEdges: number;
  readonly ambiguousEdges: number;
  readonly canApply: boolean;
  readonly hasChanges: boolean;
}

const normalizeComparisonText = (value: string | null | undefined): string => (value ?? "").trim().toLowerCase();

const edgeMatchesSameDirection = (
  edge: RigC4BoardEdge,
  sourceIds: ReadonlySet<string>,
  targetIds: ReadonlySet<string>,
): boolean => sourceIds.has(edge.sourceId) && targetIds.has(edge.targetId);

const edgeMatchesEitherDirection = (
  edge: RigC4BoardEdge,
  sourceIds: ReadonlySet<string>,
  targetIds: ReadonlySet<string>,
): boolean =>
  edgeMatchesSameDirection(edge, sourceIds, targetIds)
  || (sourceIds.has(edge.targetId) && targetIds.has(edge.sourceId));

export const findBoardNodeMatches = (
  proposalNode: RigC4ProposalNode,
  existingNodes: ReadonlyArray<RigC4BoardNode>,
): ReadonlyArray<RigC4BoardNode> => {
  const normalizedLabel = normalizeComparisonText(proposalNode.label);
  const exactMatches = existingNodes.filter((existingNode) =>
    existingNode.nodeType === proposalNode.nodeType
    && normalizeComparisonText(existingNode.label) === normalizedLabel
  );

  if (exactMatches.length > 0) {
    return exactMatches;
  }

  return existingNodes.filter((existingNode) => normalizeComparisonText(existingNode.label) === normalizedLabel);
};

export const buildGroundedProposalDiff = (
  proposal: RigC4DiagramProposal,
  boardSummary: RigC4BoardSummary | null,
): OpyGroundedProposalDiff | null => {
  if (!boardSummary) {
    return null;
  }

  const nodeDiffs = proposal.nodes.map((node): OpyGroundedProposalNodeDiff => {
    const matches = findBoardNodeMatches(node, boardSummary.nodes);
    const exactMatches = matches.filter((match) =>
      match.nodeType === node.nodeType
      && normalizeComparisonText(match.label) === normalizeComparisonText(node.label)
    );

    if (exactMatches.length === 1) {
      return {
        node,
        status: "existing",
        matches: exactMatches,
      };
    }

    if (matches.length > 0) {
      return {
        node,
        status: "ambiguous",
        matches,
      };
    }

    return {
      node,
      status: "new",
      matches: [],
    };
  });

  const nodeDiffByKey = new Map(nodeDiffs.map((nodeDiff) => [nodeDiff.node.key, nodeDiff] as const));
  const proposalNodeByKey = new Map(proposal.nodes.map((node) => [node.key, node] as const));

  const edgeDiffs = proposal.edges.map((edge): OpyGroundedProposalEdgeDiff => {
    const sourceNode = proposalNodeByKey.get(edge.sourceKey) ?? null;
    const targetNode = proposalNodeByKey.get(edge.targetKey) ?? null;
    const sourceDiff = sourceNode ? nodeDiffByKey.get(sourceNode.key) ?? null : null;
    const targetDiff = targetNode ? nodeDiffByKey.get(targetNode.key) ?? null : null;

    if (!sourceNode || !targetNode || !sourceDiff || !targetDiff) {
      return {
        edge,
        status: "ambiguous",
        matches: [],
        sourceNode,
        targetNode,
      };
    }

    const candidateSourceIds = new Set(sourceDiff.matches.map((match) => match.id));
    const candidateTargetIds = new Set(targetDiff.matches.map((match) => match.id));
    const exactMatches = boardSummary.edges.filter((existingEdge) =>
      edgeMatchesSameDirection(existingEdge, candidateSourceIds, candidateTargetIds)
      && normalizeComparisonText(existingEdge.label) === normalizeComparisonText(edge.label)
    );
    const blockingConnections = boardSummary.edges.filter((existingEdge) =>
      edgeMatchesEitherDirection(existingEdge, candidateSourceIds, candidateTargetIds)
    );

    if (sourceDiff.status === "ambiguous" || targetDiff.status === "ambiguous") {
      return {
        edge,
        status: "ambiguous",
        matches: blockingConnections,
        sourceNode,
        targetNode,
      };
    }

    if (sourceDiff.status === "existing" && targetDiff.status === "existing") {
      if (exactMatches.length === 1) {
        return {
          edge,
          status: "existing",
          matches: exactMatches,
          sourceNode,
          targetNode,
        };
      }

      if (exactMatches.length > 1 || blockingConnections.length > 0) {
        return {
          edge,
          status: "ambiguous",
          matches: exactMatches.length > 0 ? exactMatches : blockingConnections,
          sourceNode,
          targetNode,
        };
      }
    }

    return {
      edge,
      status: "new",
      matches: [],
      sourceNode,
      targetNode,
    };
  });

  return {
    nodeDiffs,
    edgeDiffs,
  };
};

export const summarizeGroundedProposalDiff = (
  diff: OpyGroundedProposalDiff,
): OpyGroundedProposalSummary => {
  const newNodes = diff.nodeDiffs.filter((item) => item.status === "new").length;
  const existingNodes = diff.nodeDiffs.filter((item) => item.status === "existing").length;
  const ambiguousNodes = diff.nodeDiffs.filter((item) => item.status === "ambiguous").length;
  const newEdges = diff.edgeDiffs.filter((item) => item.status === "new").length;
  const existingEdges = diff.edgeDiffs.filter((item) => item.status === "existing").length;
  const ambiguousEdges = diff.edgeDiffs.filter((item) => item.status === "ambiguous").length;

  return {
    newNodes,
    existingNodes,
    ambiguousNodes,
    newEdges,
    existingEdges,
    ambiguousEdges,
    canApply: ambiguousNodes === 0 && ambiguousEdges === 0,
    hasChanges: newNodes > 0 || newEdges > 0,
  };
};
