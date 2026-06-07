import { DatabaseError, DatabaseService } from "@/core/effects/database.base";
import {
  loadRigAgentRetrievalBundle,
  type RigAgentGovernanceSnapshot,
} from "@/core/effects/agent-retrieval";
import type { RigC4BoardSummary } from "@/core/effects/ai-agent.runtime";
import type { OpyBoardContextRegistry } from "@/core/effects/opy-board-context";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

const createBoardSummary = (): RigC4BoardSummary => ({
  diagramId: "diagram-1",
  diagramName: "Payments Context",
  nodeCount: 3,
  edgeCount: 2,
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
      description: "Accepts payment requests",
      technology: "Rust",
      teamOwnership: "Core Platform",
    },
    {
      id: "system-ledger",
      label: "Ledger Service",
      nodeType: "system",
      description: "Records financial events",
      technology: "Postgres",
      teamOwnership: "Core Platform",
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
    {
      id: "edge-payments-ledger",
      sourceId: "system-payments",
      targetId: "system-ledger",
      sourceLabel: "Payments API",
      targetLabel: "Ledger Service",
      label: "records",
    },
  ],
});

const createBoardContext = (): OpyBoardContextRegistry => ({
  diagramId: "diagram-1",
  diagramName: "Payments Context",
  nodeCount: 3,
  edgeCount: 2,
  ownershipTeamCount: 1,
  selectedNode: {
    id: "system-payments",
    label: "Payments API",
    nodeType: "system",
    relationshipCount: 2,
    teamOwnership: "Core Platform",
    description: "Accepts payment requests",
    technology: "Rust",
  },
  hotspotNode: {
    id: "system-payments",
    label: "Payments API",
    nodeType: "system",
    relationshipCount: 2,
    teamOwnership: "Core Platform",
    description: "Accepts payment requests",
    technology: "Rust",
  },
  scopes: [],
  promptContext: "",
});

const governance = {
  actionMode: "read-only" as const,
  redactionMode: "strict" as const,
  aiProvider: "openai" as const,
  aiModel: "gpt-4o-mini",
  rigExecutionPolicy: {
    killSwitchEnabled: false,
    allowedProviders: ["openai"] as const,
    allowedModels: ["gpt-4o-mini"] as const,
  },
  rigAgentRollout: {
    mode: "canary" as const,
    baseMode: "canary" as const,
    preference: "canary" as const,
    source: "settings" as const,
    envKey: null,
    rawValue: null,
    isEnabled: true,
    isCanary: true,
  },
  agentPolicy: {
    maxActionsPerBatch: 48,
    maxNodesCreatedPerRun: 12,
    maxEdgesCreatedPerRun: 24,
    allowSettingsMutation: false,
  },
} satisfies RigAgentGovernanceSnapshot;

const runWithDatabaseService = async <A, E>(
  effect: Effect.Effect<A, E, DatabaseService>,
  query: (sql: string) => unknown[],
): Promise<A> => {
  const layer = Layer.succeed(DatabaseService, {
    query: <T>(sql: string) =>
      Effect.try({
        try: () => query(sql) as T[],
        catch: (cause) => new DatabaseError({ message: String(cause), cause }),
      }),
    execute: () => Effect.void,
    transaction: <R, A2, E2>(inner: Effect.Effect<A2, E2, R>) => inner,
  });

  return Effect.runPromise(effect.pipe(Effect.provide(layer)));
};

const baseRows = {
  messages: [
    {
      id: "message-1",
      sessionId: "session-1",
      role: "user",
      content:
        "Review Payments API and /subscriptions/00000000-0000-4000-8000-000000000000/resourceGroups/payments/providers/Microsoft.App/containerApps/payments-api",
      createdAt: 1_000,
    },
  ],
  tasks: [
    {
      id: "task-1",
      sessionId: "session-1",
      requestJson: JSON.stringify({
        confirmation: null,
        id: "request-1",
        mode: "read",
        kind: "review",
        label: "REVIEW",
        requiresConfirmation: false,
        replay: {
          kind: "review",
          focus: "Payments API",
          sessionId: "session-1",
        },
      }),
      lineageKey: "review:session-1:payments api",
      parentTaskId: null,
      stage: "planning",
      status: "failed",
      createdAt: 1_100,
      updatedAt: 1_200,
      completedAt: 1_200,
      errorSummary: "Provider timeout while reviewing Payments API",
    },
  ],
  proposals: [
    {
      sessionId: "session-1",
      commandDescription: "Add a Ledger Service downstream from Payments API",
      proposalJson: JSON.stringify({
        summary: "Add Ledger Service",
        rationale: "Separate accounting concerns from the Payments API.",
        warnings: [],
        nodes: [],
        edges: [],
        provider: "openai",
        model: "gpt-4o-mini",
        respondedAtMs: 1_300,
      }),
      contextJson: JSON.stringify({
        promptContext: "FOCUS=Payments API\nCONFIDENCE=HIGH",
        citations: [],
        confidence: "high",
        confidenceReason: "Board evidence available.",
      }),
      decisionStatus: "pending",
      decidedAt: 1_350,
    },
  ],
  artifacts: [
    {
      id: "artifact-1",
      taskId: "task-1",
      sessionId: "session-1",
      toolCallId: null,
      kind: "board_review",
      summary: "Review captured risk concentration around Payments API.",
      payloadJson: JSON.stringify({}),
      createdAt: 1_250,
    },
  ],
  checkpoints: [
    {
      id: "checkpoint-1",
      sessionId: "session-1",
      diagramId: "diagram-1",
      proposalRespondedAtMs: 1_300,
      checkpointType: "pre-apply",
      snapshotJson: JSON.stringify({
        id: "diagram-1",
        name: "Payments Context",
        description: "Tracks payment orchestration",
        nodes: [{ id: "node-1", position: { x: 0, y: 0 }, data: {} }],
        edges: [{ id: "edge-1", source: "node-1", target: "node-2" }],
        savedAt: 1_260,
      }),
      createdAt: 1_275,
    },
  ],
  diagrams: [
    {
      id: "diagram-2",
      name: "Inventory Landscape",
      description: "Stock and warehouse flows",
      created_at: 900,
      updated_at: 1_500,
    },
    {
      id: "diagram-1",
      name: "Payments Context",
      description: "Tracks payment orchestration",
      created_at: 800,
      updated_at: 1_400,
    },
  ],
};

const queryRows = (overrides?: Partial<typeof baseRows>) => (sql: string): unknown[] => {
  const rows = {
    ...baseRows,
    ...overrides,
  };

  if (sql.includes("FROM opy_chat_messages")) {
    return rows.messages;
  }
  if (sql.includes("FROM opy_agent_tasks")) {
    return rows.tasks;
  }
  if (sql.includes("FROM opy_diagram_proposals")) {
    return rows.proposals;
  }
  if (sql.includes("FROM opy_agent_artifacts")) {
    return rows.artifacts;
  }
  if (sql.includes("FROM opy_agent_checkpoints")) {
    return rows.checkpoints;
  }
  if (sql.includes("FROM diagrams")) {
    return rows.diagrams;
  }

  return [];
};

describe("agent-retrieval", () => {
  it("indexes board, task, and session evidence into a retrieval prompt bundle", async () => {
    const bundle = await runWithDatabaseService(
      loadRigAgentRetrievalBundle({
        domain: "c4",
        sessionId: "session-1",
        diagramId: "diagram-1",
        boardSummary: createBoardSummary(),
        boardContext: createBoardContext(),
        query: "payments",
        governance: {
          ...governance,
          redactionMode: "standard",
        },
        redactionMode: "standard",
        maxHits: 6,
        recencyMs: null,
        now: 2_000,
      }),
      queryRows(),
    );

    expect(bundle.hits.some((hit) =>
      hit.scope === "board" && hit.source === "node" && hit.label.includes("Payments API")
    )).toBe(true);
    expect(bundle.hits.some((hit) => hit.scope !== "board")).toBe(true);
    expect(bundle.promptContext).toContain("RETRIEVAL=[BOARD/NODE]");
    expect(bundle.promptContext).toContain("Payments API");
  });

  it("applies strict redaction to freeform transcript content and sensitive board metadata", async () => {
    const bundle = await runWithDatabaseService(
      loadRigAgentRetrievalBundle({
        domain: "c4",
        sessionId: "session-1",
        diagramId: "diagram-1",
        boardSummary: createBoardSummary(),
        boardContext: createBoardContext(),
        query: "",
        governance,
        redactionMode: "strict",
        maxHits: 8,
        recencyMs: null,
        now: 2_000,
      }),
      queryRows({
        proposals: [],
        artifacts: [],
        checkpoints: [],
      }),
    );

    const messageHit = bundle.hits.find((hit) => hit.source === "message");
    const boardNodeHit = bundle.hits.find((hit) => hit.source === "node" && hit.label.includes("Payments API"));

    expect(messageHit?.contentPreview).toBe("[REDACTED BY PRIVACY POLICY]");
    expect(boardNodeHit?.detail).toContain("[REDACTED TEAM]");
  });

  it("supports governance-only scope filters and all-diagrams metadata retrieval", async () => {
    const governanceOnly = await runWithDatabaseService(
      loadRigAgentRetrievalBundle({
        domain: "c4",
        sessionId: "session-1",
        diagramId: "diagram-1",
        boardSummary: createBoardSummary(),
        boardContext: createBoardContext(),
        query: "kill switch policy",
        governance: {
          ...governance,
          redactionMode: "off",
        },
        redactionMode: "off",
        scopes: ["governance"],
        maxHits: 2,
        recencyMs: null,
        now: 2_000,
      }),
      queryRows(),
    );

    expect(governanceOnly.hits).toHaveLength(1);
    expect(governanceOnly.hits[0]?.scope).toBe("governance");
    expect(governanceOnly.promptContext).toContain("RETRIEVAL=[GOVERNANCE/GOVERNANCE]");

    const allDiagramBundle = await runWithDatabaseService(
      loadRigAgentRetrievalBundle({
        domain: "c4",
        sessionId: "session-1",
        diagramId: "diagram-1",
        boardSummary: null,
        boardContext: null,
        query: "inventory",
        governance: {
          ...governance,
          redactionMode: "off",
        },
        redactionMode: "off",
        scopes: ["board"],
        diagramScope: "all-diagrams",
        maxHits: 3,
        recencyMs: null,
        now: 2_000,
      }),
      queryRows({
        messages: [],
        tasks: [],
        proposals: [],
        artifacts: [],
        checkpoints: [],
      }),
    );

    expect(allDiagramBundle.hits.some((hit) =>
      hit.source === "diagram" && hit.label.includes("Inventory Landscape")
    )).toBe(true);
  });
});
