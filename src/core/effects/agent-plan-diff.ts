import {
  type RigMutationNodeRef,
  type RigMutationToolName,
  type RigValidatedMutationAction,
  type RigValidatedMutationPlan,
  validateRigMutationPlan,
} from "./agent-tools/mutation-tools";
import type {
  RigC4BoardEdge,
  RigC4BoardNode,
  RigC4DiagramProposal,
  RigC4ProposalEdge,
  RigC4ProposalNode,
} from "./ai-agent.runtime";
import type {
  OpyGroundedProposalDiff,
  OpyGroundedProposalEdgeDiff,
  OpyGroundedProposalNodeDiff,
} from "./opy-c4-proposals";

export type RigPlanImpactStatus = "create" | "reuse" | "blocked";

export interface RigPlanImpactEntity {
  readonly id: string;
  readonly category: "node" | "edge";
  readonly status: RigPlanImpactStatus;
  readonly title: string;
  readonly detail: string;
}

export interface RigPlanIssue {
  readonly id: string;
  readonly kind: "ambiguous-node" | "ambiguous-edge";
  readonly title: string;
  readonly detail: string;
}

export interface RigRenderedMutationPlan {
  readonly proposalSummary: string;
  readonly rationale: string;
  readonly plan: RigValidatedMutationPlan;
  readonly issues: ReadonlyArray<RigPlanIssue>;
  readonly impactedEntities: ReadonlyArray<RigPlanImpactEntity>;
  readonly warnings: ReadonlyArray<string>;
  readonly canApprove: boolean;
  readonly hasChanges: boolean;
}

const formatNodeMatchSummary = (matches: ReadonlyArray<RigC4BoardNode>): string =>
  matches
    .map((match) => `${match.nodeType.toUpperCase()} ${match.label}`)
    .join(" | ");

const formatEdgeMatchSummary = (matches: ReadonlyArray<RigC4BoardEdge>): string =>
  matches
    .map((match) => `${match.sourceLabel} -> ${match.targetLabel}${match.label ? ` (${match.label})` : ""}`)
    .join(" | ");

const formatEdgeTitle = (edge: RigC4ProposalEdge): string =>
  `${edge.sourceKey} -> ${edge.targetKey}${edge.label.trim().length > 0 ? ` (${edge.label})` : ""}`;

const toPlanNodeRef = (
  proposalNode: RigC4ProposalNode,
  nodeDiff: OpyGroundedProposalNodeDiff | undefined,
): RigMutationNodeRef | null => {
  if (!nodeDiff) {
    return null;
  }

  if (nodeDiff.status === "new") {
    return {
      kind: "plan-node",
      value: proposalNode.key,
    };
  }

  if (nodeDiff.status === "existing") {
    const existingMatch = nodeDiff.matches[0];
    if (!existingMatch) {
      return null;
    }

    return {
      kind: "board-node",
      value: existingMatch.id,
    };
  }

  return null;
};

const compareImpactStatus = (status: RigPlanImpactStatus): number => {
  switch (status) {
    case "blocked":
      return 0;
    case "create":
      return 1;
    case "reuse":
      return 2;
  }
};

const sortImpacts = (impacts: ReadonlyArray<RigPlanImpactEntity>): ReadonlyArray<RigPlanImpactEntity> =>
  [...impacts].sort((left, right) =>
    compareImpactStatus(left.status) - compareImpactStatus(right.status)
    || left.category.localeCompare(right.category)
    || left.title.localeCompare(right.title)
  );

const buildNodeIssues = (
  nodeDiffs: ReadonlyArray<OpyGroundedProposalNodeDiff>,
): ReadonlyArray<RigPlanIssue> =>
  nodeDiffs
    .filter((nodeDiff) => nodeDiff.status === "ambiguous")
    .map((nodeDiff) => ({
      id: `node:${nodeDiff.node.key}`,
      kind: "ambiguous-node" as const,
      title: `${nodeDiff.node.nodeType.toUpperCase()} ${nodeDiff.node.label}`,
      detail: nodeDiff.matches.length > 0
        ? `Multiple board candidates resolved: ${formatNodeMatchSummary(nodeDiff.matches)}`
        : "No safe board mapping could be resolved for this node.",
    }));

const buildEdgeIssues = (
  edgeDiffs: ReadonlyArray<OpyGroundedProposalEdgeDiff>,
): ReadonlyArray<RigPlanIssue> =>
  edgeDiffs
    .filter((edgeDiff) => edgeDiff.status === "ambiguous")
    .map((edgeDiff) => ({
      id: `edge:${edgeDiff.edge.sourceKey}:${edgeDiff.edge.targetKey}:${edgeDiff.edge.label}`,
      kind: "ambiguous-edge" as const,
      title: formatEdgeTitle(edgeDiff.edge),
      detail: edgeDiff.matches.length > 0
        ? `Unsafe edge match candidates: ${formatEdgeMatchSummary(edgeDiff.matches)}`
        : "The edge cannot be resolved because one or both endpoint nodes are ambiguous.",
    }));

const buildNodeImpacts = (
  nodeDiffs: ReadonlyArray<OpyGroundedProposalNodeDiff>,
): ReadonlyArray<RigPlanImpactEntity> =>
  nodeDiffs.map((nodeDiff) => ({
    id: `impact-node:${nodeDiff.node.key}`,
    category: "node",
    status: nodeDiff.status === "new"
      ? "create"
      : nodeDiff.status === "existing"
      ? "reuse"
      : "blocked",
    title: `${nodeDiff.node.nodeType.toUpperCase()} ${nodeDiff.node.label}`,
    detail: nodeDiff.status === "new"
      ? `Create node ${nodeDiff.node.key}.`
      : nodeDiff.status === "existing"
      ? `Reuse board node ${nodeDiff.matches[0]?.label ?? nodeDiff.node.label}.`
      : `Blocked by ambiguous matches: ${formatNodeMatchSummary(nodeDiff.matches)}`,
  }));

const buildEdgeImpacts = (
  edgeDiffs: ReadonlyArray<OpyGroundedProposalEdgeDiff>,
): ReadonlyArray<RigPlanImpactEntity> =>
  edgeDiffs.map((edgeDiff) => ({
    id: `impact-edge:${edgeDiff.edge.sourceKey}:${edgeDiff.edge.targetKey}:${edgeDiff.edge.label}`,
    category: "edge",
    status: edgeDiff.status === "new"
      ? "create"
      : edgeDiff.status === "existing"
      ? "reuse"
      : "blocked",
    title: formatEdgeTitle(edgeDiff.edge),
    detail: edgeDiff.status === "new"
      ? "Create relationship."
      : edgeDiff.status === "existing"
      ? "Reuse existing relationship."
      : edgeDiff.matches.length > 0
      ? `Blocked by edge candidates: ${formatEdgeMatchSummary(edgeDiff.matches)}`
      : "Blocked because endpoint mappings are not safe.",
  }));

const buildMutationActionInputs = (
  diff: OpyGroundedProposalDiff,
): ReadonlyArray<{
  readonly tool: RigMutationToolName;
  readonly input: unknown;
}> => {
  const nodeDiffByKey = new Map(diff.nodeDiffs.map((nodeDiff) => [nodeDiff.node.key, nodeDiff] as const));
  const createNodes = diff.nodeDiffs
    .filter((nodeDiff) => nodeDiff.status === "new")
    .map((nodeDiff) => ({
      key: nodeDiff.node.key,
      nodeType: nodeDiff.node.nodeType,
      label: nodeDiff.node.label,
      description: nodeDiff.node.description,
      technology: null,
      teamOwnership: null,
    }));

  const createEdges = diff.edgeDiffs
    .filter((edgeDiff) => edgeDiff.status === "new")
    .flatMap((edgeDiff) => {
      const sourceNode = edgeDiff.sourceNode;
      const targetNode = edgeDiff.targetNode;

      if (!sourceNode || !targetNode) {
        return [];
      }

      const sourceRef = toPlanNodeRef(sourceNode, nodeDiffByKey.get(sourceNode.key));
      const targetRef = toPlanNodeRef(targetNode, nodeDiffByKey.get(targetNode.key));

      if (!sourceRef || !targetRef) {
        return [];
      }

      return [{
        sourceRef,
        targetRef,
        label: edgeDiff.edge.label.trim().length > 0 ? edgeDiff.edge.label : null,
      }];
    });

  const actions: Array<{
    readonly tool: RigMutationToolName;
    readonly input: unknown;
  }> = [];

  if (createNodes.length > 0) {
    actions.push({
      tool: "create_nodes",
      input: { nodes: createNodes },
    });
  }

  if (createEdges.length > 0) {
    actions.push({
      tool: "create_edges",
      input: { edges: createEdges },
    });
  }

  return actions;
};

const sortActions = (
  actions: ReadonlyArray<RigValidatedMutationAction>,
): ReadonlyArray<RigValidatedMutationAction> => [...actions].sort((left, right) => left.tool.localeCompare(right.tool));

export const buildRigMutationPlanDiff = (
  proposal: RigC4DiagramProposal,
  groundedDiff: OpyGroundedProposalDiff | null,
): RigRenderedMutationPlan | null => {
  if (!groundedDiff) {
    return null;
  }

  const issues = [
    ...buildNodeIssues(groundedDiff.nodeDiffs),
    ...buildEdgeIssues(groundedDiff.edgeDiffs),
  ];
  const impactedEntities = sortImpacts([
    ...buildNodeImpacts(groundedDiff.nodeDiffs),
    ...buildEdgeImpacts(groundedDiff.edgeDiffs),
  ]);
  const actionInputs = buildMutationActionInputs(groundedDiff);
  const plan = validateRigMutationPlan(actionInputs);

  return {
    proposalSummary: proposal.summary,
    rationale: proposal.rationale,
    plan: {
      ...plan,
      actions: sortActions(plan.actions),
    },
    issues,
    impactedEntities,
    warnings: proposal.warnings,
    canApprove: issues.length === 0 && plan.totalActions > 0,
    hasChanges: plan.totalNodesCreated > 0
      || plan.totalNodesUpdated > 0
      || plan.totalEdgesCreated > 0
      || plan.totalLayoutOperations > 0,
  };
};
