import { buildRigMutationPlanDiff, type RigRenderedMutationPlan } from "./agent-plan-diff";
import {
  detectRigMutationPolicyViolation,
  type RigMutationPolicySettings,
} from "./agent-policy";
import { formatOpyRollbackSummary } from "./agent-rollback.runtime";
import type { RigC4BoardSummary, RigC4DiagramProposal } from "./ai-agent.runtime";
import {
  buildGroundedProposalDiff,
  summarizeGroundedProposalDiff,
  type OpyGroundedProposalDiff,
  type OpyGroundedProposalSummary,
} from "./opy-c4-proposals";
import type { OpyAgentCheckpoint, OpyPlanDecisionStatus } from "./opy-chat.persistence";
import type { AiActionMode } from "./settings.types";

export type OpyC4NodeType = "person" | "system" | "externalSystem" | "container" | "component";

export interface OpyBoardAddNodeAction {
  readonly kind: "add-node";
  readonly nodeType: OpyC4NodeType;
  readonly label: string;
}

export interface OpyBoardApplyC4ProposalAction {
  readonly kind: "apply-c4-proposal";
  readonly sessionId: string;
  readonly proposalRespondedAtMs: number;
  readonly proposal: RigC4DiagramProposal;
}

export interface OpyBoardRollbackCheckpointAction {
  readonly kind: "rollback-checkpoint";
  readonly sessionId: string;
  readonly checkpointId: string;
}

export type OpyBoardAction =
  | OpyBoardAddNodeAction
  | OpyBoardApplyC4ProposalAction
  | OpyBoardRollbackCheckpointAction;

export interface OpyActionFlowDescriptor {
  readonly requestKind: "add-node" | "apply-proposal" | "rollback";
  readonly requestLabel: string;
  readonly sessionId: string;
  readonly confirmationMessage: string;
  readonly cancelMessage: string;
  readonly failurePrefix: string;
  readonly boardAction: OpyBoardAction;
  readonly refreshCheckpointsAfterApply: boolean;
}

export type OpyActionFlowIssue =
  | {
    readonly kind: "policy";
    readonly message: string;
    readonly recommendedAction: string;
  }
  | {
    readonly kind: "missing-target";
    readonly detail: string;
  }
  | {
    readonly kind: "no-op";
    readonly message: string;
  };

export interface OpyActionProposalRecord {
  readonly proposal: RigC4DiagramProposal;
  readonly decisionStatus: OpyPlanDecisionStatus;
}

export interface OpyApplyProposalActionResolution {
  readonly descriptor: OpyActionFlowDescriptor;
  readonly groundedProposal: OpyGroundedProposalDiff;
  readonly proposalSummary: OpyGroundedProposalSummary;
  readonly mutationPlan: RigRenderedMutationPlan;
}

const createPolicyIssue = (message: string, recommendedAction: string): OpyActionFlowIssue => ({
  kind: "policy",
  message,
  recommendedAction,
});

const createMissingTargetIssue = (detail: string): OpyActionFlowIssue => ({
  kind: "missing-target",
  detail,
});

const createNoOpIssue = (message: string): OpyActionFlowIssue => ({
  kind: "no-op",
  message,
});

export const createOpyAddNodeActionFlowDescriptor = (input: {
  readonly sessionId: string;
  readonly nodeType: OpyC4NodeType;
  readonly label: string;
}): OpyActionFlowDescriptor => ({
  requestKind: "add-node",
  requestLabel: `ADD ${input.nodeType.toUpperCase()}`,
  sessionId: input.sessionId,
  confirmationMessage: `Apply OPY board action?\n\nADD ${input.nodeType.toUpperCase()} "${input.label}"`,
  cancelMessage: "ACTION CANCELLED BY OPERATOR.",
  failurePrefix: "BOARD ACTION FAILED",
  boardAction: {
    kind: "add-node",
    nodeType: input.nodeType,
    label: input.label,
  },
  refreshCheckpointsAfterApply: false,
});

export const resolveOpyExecutableAddNodeActionFlow = (input: {
  readonly actionMode: AiActionMode;
  readonly policy: RigMutationPolicySettings;
  readonly domain: "c4" | "ddd";
  readonly sessionId: string;
  readonly nodeType: OpyC4NodeType;
  readonly label: string;
}): { readonly ok: true; readonly value: OpyActionFlowDescriptor } | { readonly ok: false; readonly issue: OpyActionFlowIssue } => {
  if (input.domain !== "c4") {
    return {
      ok: false,
      issue: createPolicyIssue(
        "Board commands are currently available in C4 mode only.",
        "Switch to the C4 board and retry.",
      ),
    };
  }

  if (input.actionMode !== "apply-with-confirmation") {
    return {
      ok: false,
      issue: createPolicyIssue(
        `Action blocked by mode ${input.actionMode.toUpperCase()}.`,
        "Switch to APPLY-WITH-CONFIRMATION to execute board actions.",
      ),
    };
  }

  const policyViolation = detectRigMutationPolicyViolation({
    policy: input.policy,
    totalActions: 1,
    totalNodesCreated: 1,
    totalEdgesCreated: 0,
  });
  if (policyViolation) {
    return {
      ok: false,
      issue: createPolicyIssue(
        `Action blocked by policy. ${policyViolation.message}`,
        "Adjust AI Agent policy limits in Settings or reduce the requested board change.",
      ),
    };
  }

  return {
    ok: true,
    value: createOpyAddNodeActionFlowDescriptor(input),
  };
};

export const resolveOpyApplyProposalActionFlow = (input: {
  readonly actionMode: AiActionMode;
  readonly policy: RigMutationPolicySettings;
  readonly boardSummary: RigC4BoardSummary | null;
  readonly proposalRecord: OpyActionProposalRecord | null;
  readonly plannerArtifactReady: boolean;
  readonly sizePolicyOverride?: boolean;
  readonly sessionId: string;
}):
  | { readonly ok: true; readonly value: OpyApplyProposalActionResolution }
  | { readonly ok: false; readonly issue: OpyActionFlowIssue } => {
  if (input.actionMode !== "apply-with-confirmation") {
    return {
      ok: false,
      issue: createPolicyIssue(
        `Proposal apply blocked by mode ${input.actionMode.toUpperCase()}.`,
        "Switch to APPLY-WITH-CONFIRMATION.",
      ),
    };
  }

  if (!input.boardSummary) {
    return {
      ok: false,
      issue: createMissingTargetIssue("RETRY TARGET MISSING::CURRENT BOARD SUMMARY."),
    };
  }

  if (!input.proposalRecord) {
    return {
      ok: false,
      issue: createMissingTargetIssue("RETRY TARGET MISSING::PROPOSAL HISTORY."),
    };
  }

  const groundedProposal = buildGroundedProposalDiff(input.proposalRecord.proposal, input.boardSummary);
  if (!groundedProposal) {
    return {
      ok: false,
      issue: createMissingTargetIssue("RETRY TARGET MISSING::PROPOSAL DIFF CONTEXT."),
    };
  }

  const proposalSummary = summarizeGroundedProposalDiff(groundedProposal);
  const mutationPlan = buildRigMutationPlanDiff(input.proposalRecord.proposal, groundedProposal);
  if (!mutationPlan) {
    return {
      ok: false,
      issue: createMissingTargetIssue("RETRY TARGET MISSING::MUTATION PLAN CONTEXT."),
    };
  }

  if (input.proposalRecord.decisionStatus !== "approved") {
    return {
      ok: false,
      issue: createPolicyIssue(
        `Plan apply blocked while decision is ${input.proposalRecord.decisionStatus.toUpperCase()}.`,
        input.proposalRecord.decisionStatus === "rejected"
          ? "Review the rejected plan or generate a new proposal."
          : "Approve the current plan before applying it.",
      ),
    };
  }

  if (!proposalSummary.canApply) {
    return {
      ok: false,
      issue: createPolicyIssue(
        `Proposal apply blocked by ${proposalSummary.ambiguousNodes} ambiguous node(s) and ${proposalSummary.ambiguousEdges} ambiguous edge(s).`,
        "Resolve proposal ambiguity before applying.",
      ),
    };
  }

  if (!proposalSummary.hasChanges) {
    return {
      ok: false,
      issue: createNoOpIssue("NO NEW CHANGES TO APPLY. PROPOSAL ALREADY MATCHES THE BOARD."),
    };
  }

  if (!input.plannerArtifactReady) {
    return {
      ok: false,
      issue: createPolicyIssue(
        "Plan apply blocked because no persisted planner artifact is attached to this proposal.",
        "Regenerate the proposal so OPY can persist a planner artifact before apply.",
      ),
    };
  }

  if (!mutationPlan.canApprove) {
    return {
      ok: false,
      issue: createPolicyIssue(
        `Plan apply blocked by ${mutationPlan.issues.length} unresolved issue(s).`,
        "Resolve or regenerate the blocked plan before apply.",
      ),
    };
  }

  const policyViolation = detectRigMutationPolicyViolation({
    policy: input.policy,
    totalActions: mutationPlan.plan.totalActions,
    totalNodesCreated: mutationPlan.plan.totalNodesCreated,
    totalEdgesCreated: mutationPlan.plan.totalEdgesCreated,
  });
  if (policyViolation && input.sizePolicyOverride !== true) {
    return {
      ok: false,
      issue: createPolicyIssue(
        `Plan apply blocked by policy. ${policyViolation.message}`,
        "Adjust AI Agent policy limits in Settings or reduce the proposed change batch.",
      ),
    };
  }

  return {
    ok: true,
    value: {
      descriptor: {
        requestKind: "apply-proposal",
        requestLabel: "APPLY PROPOSAL",
        sessionId: input.sessionId,
        confirmationMessage: [
          "Apply OPY diagram proposal?",
          "",
          `Plan actions ${mutationPlan.plan.totalActions}`,
          `Create ${mutationPlan.plan.totalNodesCreated} node(s)`,
          `Create ${mutationPlan.plan.totalEdgesCreated} edge(s)`,
          `Reuse ${proposalSummary.existingNodes} node(s)`,
          `Reuse ${proposalSummary.existingEdges} edge(s)`,
          ...(policyViolation && input.sizePolicyOverride === true
            ? ["", `SIZE POLICY OVERRIDE:: ${policyViolation.message}`]
            : []),
          "",
          "This will update and save the current board.",
        ].join("\n"),
        cancelMessage: "PROPOSAL APPLY CANCELLED BY OPERATOR.",
        failurePrefix: "PROPOSAL APPLY FAILED",
        boardAction: {
          kind: "apply-c4-proposal",
          sessionId: input.sessionId,
          proposalRespondedAtMs: input.proposalRecord.proposal.respondedAtMs,
          proposal: input.proposalRecord.proposal,
        },
        refreshCheckpointsAfterApply: true,
      },
      groundedProposal,
      proposalSummary,
      mutationPlan,
    },
  };
};

export const resolveOpyRollbackActionFlow = (input: {
  readonly actionMode: AiActionMode;
  readonly policy: RigMutationPolicySettings;
  readonly checkpoint: OpyAgentCheckpoint | null;
  readonly sessionId: string;
}): { readonly ok: true; readonly value: OpyActionFlowDescriptor } | { readonly ok: false; readonly issue: OpyActionFlowIssue } => {
  if (input.actionMode !== "apply-with-confirmation") {
    return {
      ok: false,
      issue: createPolicyIssue(
        `Rollback blocked by mode ${input.actionMode.toUpperCase()}.`,
        "Switch to APPLY-WITH-CONFIRMATION.",
      ),
    };
  }

  const policyViolation = detectRigMutationPolicyViolation({
    policy: input.policy,
    totalActions: 1,
    totalNodesCreated: 0,
    totalEdgesCreated: 0,
  });
  if (policyViolation) {
    return {
      ok: false,
      issue: createPolicyIssue(
        `Rollback blocked by policy. ${policyViolation.message}`,
        "Adjust AI Agent policy limits in Settings before retrying rollback.",
      ),
    };
  }

  if (!input.checkpoint) {
    return {
      ok: false,
      issue: createMissingTargetIssue("RETRY TARGET MISSING::CHECKPOINT HISTORY."),
    };
  }

  return {
    ok: true,
    value: {
      requestKind: "rollback",
      requestLabel: "ROLLBACK",
      sessionId: input.sessionId,
      confirmationMessage: [
        "Rollback to OPY checkpoint?",
        "",
        formatOpyRollbackSummary(input.checkpoint),
        `Created ${new Intl.DateTimeFormat(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(input.checkpoint.createdAt)}`,
        "",
        "This will restore the board to the checkpoint snapshot and save it.",
      ].join("\n"),
      cancelMessage: "ROLLBACK CANCELLED BY OPERATOR.",
      failurePrefix: "ROLLBACK FAILED",
      boardAction: {
        kind: "rollback-checkpoint",
        sessionId: input.sessionId,
        checkpointId: input.checkpoint.id,
      },
      refreshCheckpointsAfterApply: true,
    },
  };
};
