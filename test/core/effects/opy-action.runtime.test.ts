import type { RigC4BoardSummary, RigC4DiagramProposal } from "@/core/effects/ai-agent.runtime";
import {
  resolveOpyApplyProposalActionFlow,
  resolveOpyExecutableAddNodeActionFlow,
  resolveOpyRollbackActionFlow,
} from "@/core/effects/opy-action.runtime";
import type { OpyAgentCheckpoint, OpyPlanDecisionStatus } from "@/core/effects/opy-chat.persistence";
import { DEFAULT_APP_SETTINGS } from "@/core/effects/settings.types";
import { describe, expect, it } from "vitest";

const defaultAgentPolicy = DEFAULT_APP_SETTINGS.agentPolicy;

const createBoardSummary = (overrides?: Partial<RigC4BoardSummary>): RigC4BoardSummary => ({
  diagramId: "diagram-1",
  diagramName: "Payments Context",
  nodeCount: 2,
  edgeCount: 1,
  nodes: [
    {
      id: "person-customer",
      label: "Customer",
      nodeType: "person",
      description: null,
      technology: null,
      teamOwnership: null,
    },
    {
      id: "system-payments",
      label: "Payments API",
      nodeType: "system",
      description: null,
      technology: null,
      teamOwnership: null,
    },
  ],
  edges: [
    {
      id: "edge-customer-payments",
      sourceId: "person-customer",
      targetId: "system-payments",
      sourceLabel: "Customer",
      targetLabel: "Payments API",
      label: "uses",
    },
  ],
  ...overrides,
});

const createProposal = (overrides?: Partial<RigC4DiagramProposal>): RigC4DiagramProposal => ({
  summary: "Customer uses Payments API.",
  rationale: "Reuses the existing core actors and relationships.",
  warnings: [],
  nodes: [
    {
      key: "customer",
      nodeType: "person",
      label: "Customer",
      description: null,
    },
    {
      key: "payments-api",
      nodeType: "system",
      label: "Payments API",
      description: null,
    },
  ],
  edges: [
    {
      sourceKey: "customer",
      targetKey: "payments-api",
      label: "uses",
    },
  ],
  provider: "openai",
  model: "gpt-5",
  respondedAtMs: 1_700_000_000_000,
  ...overrides,
});

const createProposalRecord = (input?: {
  readonly proposal?: RigC4DiagramProposal;
  readonly decisionStatus?: OpyPlanDecisionStatus;
}) => ({
  proposal: input?.proposal ?? createProposal(),
  decisionStatus: input?.decisionStatus ?? "approved",
});

const createCheckpoint = (overrides?: Partial<OpyAgentCheckpoint>): OpyAgentCheckpoint => ({
  id: "checkpoint-1",
  sessionId: "session-1",
  diagramId: "diagram-1",
  proposalRespondedAtMs: 2_000,
  checkpointType: "pre-apply",
  snapshot: {
    id: "diagram-1",
    name: "Payments Context",
    nodes: [],
    edges: [],
    savedAt: 1_900,
  },
  createdAt: 2_100,
  ...overrides,
});

describe("opy-action.runtime", () => {
  it("blocks executable add-node actions outside C4 apply mode", () => {
    const nonC4Resolution = resolveOpyExecutableAddNodeActionFlow({
      actionMode: "apply-with-confirmation",
      policy: defaultAgentPolicy,
      domain: "ddd",
      sessionId: "session-1",
      nodeType: "component",
      label: "Ledger Service",
    });
    const readOnlyResolution = resolveOpyExecutableAddNodeActionFlow({
      actionMode: "read-only",
      policy: defaultAgentPolicy,
      domain: "c4",
      sessionId: "session-1",
      nodeType: "component",
      label: "Ledger Service",
    });

    expect(nonC4Resolution).toEqual({
      ok: false,
      issue: expect.objectContaining({
        kind: "policy",
        recommendedAction: "Switch to the C4 board and retry.",
      }),
    });
    expect(readOnlyResolution).toEqual({
      ok: false,
      issue: expect.objectContaining({
        kind: "policy",
        message: "Action blocked by mode READ-ONLY.",
      }),
    });
  });

  it("builds a low-risk approval policy for executable add-node actions", () => {
    const resolution = resolveOpyExecutableAddNodeActionFlow({
      actionMode: "apply-with-confirmation",
      policy: defaultAgentPolicy,
      domain: "c4",
      sessionId: "session-1",
      nodeType: "component",
      label: "Ledger Service",
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) {
      return;
    }

    expect(resolution.value.approvalPolicy).toMatchObject({
      actionClass: "single-add",
      risk: "low",
      approvalMode: "always-confirm",
      requiresConfirmation: true,
      thresholdTriggered: false,
    });
    expect(resolution.value.confirmationMessage).toContain("APPROVAL::SINGLE ADD");
  });

  it("returns a no-op apply issue when the approved proposal already matches the board", () => {
    const resolution = resolveOpyApplyProposalActionFlow({
      actionMode: "apply-with-confirmation",
      policy: defaultAgentPolicy,
      boardSummary: createBoardSummary(),
      proposalRecord: createProposalRecord(),
      plannerArtifactReady: true,
      sessionId: "session-1",
    });

    expect(resolution).toEqual({
      ok: false,
      issue: {
        kind: "no-op",
        message: "NO NEW CHANGES TO APPLY. PROPOSAL ALREADY MATCHES THE BOARD.",
      },
    });
  });

  it("builds an executable apply descriptor for an approved proposal with new changes", () => {
    const resolution = resolveOpyApplyProposalActionFlow({
      actionMode: "apply-with-confirmation",
      policy: defaultAgentPolicy,
      boardSummary: createBoardSummary({
        nodeCount: 1,
        edgeCount: 0,
        nodes: [
          {
            id: "person-customer",
            label: "Customer",
            nodeType: "person",
            description: null,
            technology: null,
            teamOwnership: null,
          },
        ],
        edges: [],
      }),
      proposalRecord: createProposalRecord(),
      plannerArtifactReady: true,
      sessionId: "session-9",
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) {
      return;
    }

    expect(resolution.value.proposalSummary).toMatchObject({
      newNodes: 1,
      existingNodes: 1,
      newEdges: 1,
      existingEdges: 0,
      canApply: true,
      hasChanges: true,
    });
    expect(resolution.value.mutationPlan.plan).toMatchObject({
      totalActions: 2,
      totalNodesCreated: 1,
      totalEdgesCreated: 1,
    });
    expect(resolution.value.descriptor).toMatchObject({
      requestKind: "apply-proposal",
      requestLabel: "APPLY PROPOSAL",
      sessionId: "session-9",
      refreshCheckpointsAfterApply: true,
      boardAction: {
        kind: "apply-c4-proposal",
        sessionId: "session-9",
        proposalRespondedAtMs: createProposal().respondedAtMs,
      },
    });
    expect(resolution.value.descriptor.confirmationMessage).toContain("Plan actions 2");
    expect(resolution.value.descriptor.confirmationMessage).toContain("Create 1 node(s)");
    expect(resolution.value.descriptor.confirmationMessage).toContain("Create 1 edge(s)");
    expect(resolution.value.descriptor.approvalPolicy).toMatchObject({
      actionClass: "batch-mutation",
      risk: "high",
      approvalMode: "confirm-on-threshold",
      requiresConfirmation: true,
      thresholdTriggered: true,
    });
    expect(resolution.value.descriptor.confirmationMessage).toContain("APPROVAL::BATCH MUTATION");
  });

  it("blocks apply when the plan has not been approved", () => {
    const resolution = resolveOpyApplyProposalActionFlow({
      actionMode: "apply-with-confirmation",
      policy: defaultAgentPolicy,
      boardSummary: createBoardSummary({
        nodeCount: 1,
        edgeCount: 0,
        nodes: [
          {
            id: "person-customer",
            label: "Customer",
            nodeType: "person",
            description: null,
            technology: null,
            teamOwnership: null,
          },
        ],
        edges: [],
      }),
      proposalRecord: createProposalRecord({
        decisionStatus: "pending",
      }),
      plannerArtifactReady: true,
      sessionId: "session-1",
    });

    expect(resolution).toEqual({
      ok: false,
      issue: expect.objectContaining({
        kind: "policy",
        message: "Plan apply blocked while decision is PENDING.",
      }),
    });
  });

  it("returns a missing-target rollback issue when the checkpoint is unavailable", () => {
    const resolution = resolveOpyRollbackActionFlow({
      actionMode: "apply-with-confirmation",
      policy: defaultAgentPolicy,
      checkpoint: null,
      sessionId: "session-1",
    });

    expect(resolution).toEqual({
      ok: false,
      issue: {
        kind: "missing-target",
        detail: "RETRY TARGET MISSING::CHECKPOINT HISTORY.",
      },
    });
  });

  it("builds a rollback descriptor for an available checkpoint", () => {
    const resolution = resolveOpyRollbackActionFlow({
      actionMode: "apply-with-confirmation",
      policy: defaultAgentPolicy,
      checkpoint: createCheckpoint({
        id: "checkpoint-9",
        sessionId: "session-9",
      }),
      sessionId: "session-9",
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) {
      return;
    }

    expect(resolution.value).toMatchObject({
      requestKind: "rollback",
      requestLabel: "ROLLBACK",
      sessionId: "session-9",
      refreshCheckpointsAfterApply: true,
      boardAction: {
        kind: "rollback-checkpoint",
        sessionId: "session-9",
        checkpointId: "checkpoint-9",
      },
    });
    expect(resolution.value.confirmationMessage).toContain("Rollback to OPY checkpoint?");
    expect(resolution.value.confirmationMessage).toContain(
      "This will restore the board to the checkpoint snapshot and save it.",
    );
    expect(resolution.value.approvalPolicy).toMatchObject({
      actionClass: "rollback",
      risk: "high",
      approvalMode: "confirm-on-threshold",
      requiresConfirmation: true,
      thresholdTriggered: true,
    });
    expect(resolution.value.confirmationMessage).toContain("APPROVAL::ROLLBACK");
  });

  it("blocks add-node when the node creation budget is exhausted", () => {
    const resolution = resolveOpyExecutableAddNodeActionFlow({
      actionMode: "apply-with-confirmation",
      policy: {
        ...defaultAgentPolicy,
        maxNodesCreatedPerRun: 0,
      },
      domain: "c4",
      sessionId: "session-1",
      nodeType: "component",
      label: "Ledger Service",
    });

    expect(resolution).toEqual({
      ok: false,
      issue: expect.objectContaining({
        kind: "policy",
        message: "Action blocked by policy. Node creation count 1 exceeds the max node budget 0.",
      }),
    });
  });

  it("blocks apply when the proposal exceeds the action budget", () => {
    const resolution = resolveOpyApplyProposalActionFlow({
      actionMode: "apply-with-confirmation",
      policy: {
        ...defaultAgentPolicy,
        maxActionsPerBatch: 1,
      },
      boardSummary: createBoardSummary({
        nodeCount: 1,
        edgeCount: 0,
        nodes: [
          {
            id: "person-customer",
            label: "Customer",
            nodeType: "person",
            description: null,
            technology: null,
            teamOwnership: null,
          },
        ],
        edges: [],
      }),
      proposalRecord: createProposalRecord(),
      plannerArtifactReady: true,
      sessionId: "session-11",
    });

    expect(resolution).toEqual({
      ok: false,
      issue: expect.objectContaining({
        kind: "policy",
        message: "Plan apply blocked by policy. Batch size 2 exceeds the max action budget 1.",
      }),
    });
  });

  it("allows apply when the operator explicitly overrides a size policy block", () => {
    const resolution = resolveOpyApplyProposalActionFlow({
      actionMode: "apply-with-confirmation",
      policy: {
        ...defaultAgentPolicy,
        maxActionsPerBatch: 1,
      },
      boardSummary: createBoardSummary({
        nodeCount: 1,
        edgeCount: 0,
        nodes: [
          {
            id: "person-customer",
            label: "Customer",
            nodeType: "person",
            description: null,
            technology: null,
            teamOwnership: null,
          },
        ],
        edges: [],
      }),
      proposalRecord: createProposalRecord(),
      plannerArtifactReady: true,
      sizePolicyOverride: true,
      sessionId: "session-11",
    });

    expect(resolution.ok).toBe(true);
    if (resolution.ok) {
      expect(resolution.value.descriptor.confirmationMessage).toContain("SIZE POLICY OVERRIDE");
      expect(resolution.value.descriptor.confirmationMessage).toContain(
        "Batch size 2 exceeds the max action budget 1.",
      );
    }
  });

  it("blocks apply when the persisted planner artifact is missing", () => {
    const resolution = resolveOpyApplyProposalActionFlow({
      actionMode: "apply-with-confirmation",
      policy: defaultAgentPolicy,
      boardSummary: createBoardSummary({
        nodeCount: 1,
        edgeCount: 0,
        nodes: [
          {
            id: "person-customer",
            label: "Customer",
            nodeType: "person",
            description: null,
            technology: null,
            teamOwnership: null,
          },
        ],
        edges: [],
      }),
      proposalRecord: createProposalRecord(),
      plannerArtifactReady: false,
      sessionId: "session-12",
    });

    expect(resolution).toEqual({
      ok: false,
      issue: expect.objectContaining({
        kind: "policy",
        message: "Plan apply blocked because no persisted planner artifact is attached to this proposal.",
        recommendedAction: "Regenerate the proposal so OPY can persist a planner artifact before apply.",
      }),
    });
  });

  it("blocks rollback when the action budget is zero", () => {
    const resolution = resolveOpyRollbackActionFlow({
      actionMode: "apply-with-confirmation",
      policy: {
        ...defaultAgentPolicy,
        maxActionsPerBatch: 0,
      },
      checkpoint: createCheckpoint(),
      sessionId: "session-1",
    });

    expect(resolution).toEqual({
      ok: false,
      issue: expect.objectContaining({
        kind: "policy",
        message: "Rollback blocked by policy. Batch size 1 exceeds the max action budget 0.",
      }),
    });
  });
});
