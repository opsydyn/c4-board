import { DatabaseError, DatabaseService } from "@/core/effects/database.base";
import {
  createOpyAgentCheckpoint,
  getOpyAgentCheckpoint,
  listOpyAgentCheckpoints,
  listOpyDiagramProposals,
  type OpyAgentCheckpoint,
  type OpyPersistedDiagramProposal,
  upsertOpyDiagramProposal,
} from "@/core/effects/opy-chat.persistence";
import { Cause, Effect, Layer, Option } from "effect";
import { describe, expect, it, vi } from "vitest";

const createPersistedProposal = (
  overrides?: Partial<OpyPersistedDiagramProposal>,
): OpyPersistedDiagramProposal => ({
  sessionId: "session-1",
  commandDescription: "Add a ledger service downstream from Payments API",
  proposal: {
    summary: "Add Ledger Service",
    rationale: "Separate accounting concerns from the Payments API.",
    warnings: [],
    nodes: [
      {
        key: "ledger-service",
        nodeType: "system",
        label: "Ledger Service",
        description: "Records financial events",
      },
    ],
    edges: [
      {
        sourceKey: "payments-api",
        targetKey: "ledger-service",
        label: "records",
      },
    ],
    provider: "openai",
    model: "gpt-5",
    respondedAtMs: 2_000,
  },
  context: {
    promptContext: "FOCUS=Ledger\nCONFIDENCE=HIGH",
    citations: [
      {
        id: "board:payments",
        tool: "board_summary",
        label: "Payments Context",
        detail: "4 nodes · 3 edges · 2 teams",
        sourceId: "diagram-1",
      },
    ],
    confidence: "high",
    confidenceReason: "Multiple board sources resolved through typed read tools.",
  },
  decisionStatus: "pending",
  decidedAt: 2_100,
  ...overrides,
});

const createCheckpoint = (
  overrides?: Partial<OpyAgentCheckpoint>,
): OpyAgentCheckpoint => ({
  id: "checkpoint-1",
  sessionId: "session-1",
  diagramId: "diagram-1",
  proposalRespondedAtMs: 2_000,
  checkpointType: "pre-apply",
  snapshot: {
    id: "diagram-1",
    name: "Payments Context",
    description: "Tracks payment orchestration",
    nodes: [{ id: "node-1", position: { x: 0, y: 0 }, data: {} }],
    edges: [{ id: "edge-1", source: "node-1", target: "node-2" }],
    savedAt: 1_900,
  },
  createdAt: 2_100,
  ...overrides,
});

const runWithDatabaseService = async <A, E>(
  effect: Effect.Effect<A, E, DatabaseService>,
  handlers: {
    readonly query?: (sql: string, bindValues?: unknown[]) => unknown[];
    readonly execute?: (sql: string, bindValues?: unknown[]) => void;
  },
): Promise<A> => {
  const layer = Layer.succeed(DatabaseService, {
    query: <T>(sql: string, bindValues?: unknown[]) =>
      Effect.try({
        try: () => (handlers.query?.(sql, bindValues) ?? []) as T[],
        catch: (cause) => new DatabaseError({ message: String(cause), cause }),
      }),
    execute: (sql: string, bindValues?: unknown[]) =>
      Effect.try({
        try: () => {
          handlers.execute?.(sql, bindValues);
        },
        catch: (cause) => new DatabaseError({ message: String(cause), cause }),
      }),
    transaction: <R, A2, E2>(inner: Effect.Effect<A2, E2, R>) => inner,
  });

  return Effect.runPromise(effect.pipe(Effect.provide(layer)));
};

const runExitWithDatabaseService = async <A, E>(
  effect: Effect.Effect<A, E, DatabaseService>,
  handlers: {
    readonly query?: (sql: string, bindValues?: unknown[]) => unknown[];
    readonly execute?: (sql: string, bindValues?: unknown[]) => void;
  },
) => {
  const layer = Layer.succeed(DatabaseService, {
    query: <T>(sql: string, bindValues?: unknown[]) =>
      Effect.try({
        try: () => (handlers.query?.(sql, bindValues) ?? []) as T[],
        catch: (cause) => new DatabaseError({ message: String(cause), cause }),
      }),
    execute: (sql: string, bindValues?: unknown[]) =>
      Effect.try({
        try: () => {
          handlers.execute?.(sql, bindValues);
        },
        catch: (cause) => new DatabaseError({ message: String(cause), cause }),
      }),
    transaction: <R, A2, E2>(inner: Effect.Effect<A2, E2, R>) => inner,
  });

  return Effect.runPromiseExit(effect.pipe(Effect.provide(layer)));
};

describe("opy-chat.persistence", () => {
  it("loads persisted diagram proposals ordered by latest proposal timestamp", async () => {
    const newestProposal = createPersistedProposal();
    const olderProposal = createPersistedProposal({
      proposal: {
        ...createPersistedProposal().proposal,
        summary: "Reuse existing board only",
        respondedAtMs: 1_000,
      },
      decidedAt: 1_050,
      decisionStatus: "approved",
    });

    const result = await runWithDatabaseService(
      listOpyDiagramProposals("session-1"),
      {
        query: () => [
          {
            sessionId: olderProposal.sessionId,
            commandDescription: olderProposal.commandDescription,
            proposalJson: JSON.stringify(olderProposal.proposal),
            contextJson: JSON.stringify(olderProposal.context),
            decisionStatus: olderProposal.decisionStatus,
            decidedAt: olderProposal.decidedAt,
          },
          {
            sessionId: newestProposal.sessionId,
            commandDescription: newestProposal.commandDescription,
            proposalJson: JSON.stringify(newestProposal.proposal),
            contextJson: JSON.stringify(newestProposal.context),
            decisionStatus: newestProposal.decisionStatus,
            decidedAt: newestProposal.decidedAt,
          },
          {
            sessionId: "session-1",
            commandDescription: "bad row",
            proposalJson: "{}",
            contextJson: "{}",
            decisionStatus: "pending",
            decidedAt: 99,
          },
        ],
      },
    );

    expect(result).toHaveLength(2);
    expect(result[0]?.proposal.respondedAtMs).toBe(2_000);
    expect(result[0]?.decisionStatus).toBe("pending");
    expect(result[1]?.proposal.respondedAtMs).toBe(1_000);
    expect(result[1]?.decisionStatus).toBe("approved");
  });

  it("upserts diagram proposal artifacts with serialized proposal and context", async () => {
    const execute = vi.fn();
    const proposal = createPersistedProposal({
      decisionStatus: "approved",
      decidedAt: 2_500,
    });

    const result = await runWithDatabaseService(
      upsertOpyDiagramProposal(proposal),
      { execute },
    );

    expect(result).toEqual(proposal);
    expect(execute).toHaveBeenCalledTimes(1);

    const [sql, values] = execute.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("INSERT INTO opy_diagram_proposals");
    expect(values[0]).toBe("session-1");
    expect(values[1]).toBe(2_000);
    expect(values[2]).toBe(proposal.commandDescription);
    expect(JSON.parse(String(values[3]))).toEqual(proposal.proposal);
    expect(JSON.parse(String(values[4]))).toEqual(proposal.context);
    expect(values[5]).toBe("approved");
    expect(values[6]).toBe(2_500);
  });

  it("creates and lists pre-apply checkpoints with serialized board snapshots", async () => {
    const execute = vi.fn();
    const checkpoint = createCheckpoint();

    const createResult = await runWithDatabaseService(
      createOpyAgentCheckpoint(checkpoint),
      { execute },
    );

    expect(createResult).toEqual(checkpoint);
    const [insertSql, insertValues] = execute.mock.calls[0] as [string, unknown[]];
    expect(insertSql).toContain("INSERT INTO opy_agent_checkpoints");
    expect(insertValues[0]).toBe("checkpoint-1");
    expect(insertValues[1]).toBe("session-1");
    expect(insertValues[2]).toBe("diagram-1");
    expect(insertValues[3]).toBe(2_000);
    expect(insertValues[4]).toBe("pre-apply");
    expect(JSON.parse(String(insertValues[5]))).toEqual(checkpoint.snapshot);
    expect(insertValues[6]).toBe(2_100);

    const listed = await runWithDatabaseService(
      listOpyAgentCheckpoints("session-1"),
      {
        query: () => [
          {
            id: "checkpoint-older",
            sessionId: "session-1",
            diagramId: "diagram-1",
            proposalRespondedAtMs: 1_000,
            checkpointType: "pre-apply",
            snapshotJson: JSON.stringify({
              id: "diagram-1",
              name: "Payments Context",
              nodes: [],
              edges: [],
              savedAt: null,
            }),
            createdAt: 1_100,
          },
          {
            id: "checkpoint-1",
            sessionId: "session-1",
            diagramId: "diagram-1",
            proposalRespondedAtMs: 2_000,
            checkpointType: "pre-apply",
            snapshotJson: JSON.stringify(checkpoint.snapshot),
            createdAt: 2_100,
          },
        ],
      },
    );

    expect(listed).toHaveLength(2);
    expect(listed[0]?.id).toBe("checkpoint-1");
    expect(listed[0]?.snapshot.name).toBe("Payments Context");
    expect(listed[1]?.id).toBe("checkpoint-older");
  });

  it("loads a checkpoint by id and rejects when it is missing", async () => {
    const checkpoint = createCheckpoint();

    const loaded = await runWithDatabaseService(
      getOpyAgentCheckpoint("checkpoint-1"),
      {
        query: () => [
          {
            id: checkpoint.id,
            sessionId: checkpoint.sessionId,
            diagramId: checkpoint.diagramId,
            proposalRespondedAtMs: checkpoint.proposalRespondedAtMs,
            checkpointType: checkpoint.checkpointType,
            snapshotJson: JSON.stringify(checkpoint.snapshot),
            createdAt: checkpoint.createdAt,
          },
        ],
      },
    );

    expect(loaded).toEqual(checkpoint);

    const exit = await runExitWithDatabaseService(
      getOpyAgentCheckpoint("missing"),
      {
        query: () => [],
      },
    );

    expect(exit._tag).toBe("Failure");
    const failure = Cause.failureOption(exit.cause);
    expect(Option.isSome(failure)).toBe(true);
    if (Option.isSome(failure)) {
      expect(failure.value).toMatchObject({
        _tag: "NotFoundError",
        entity: "opy_agent_checkpoint",
        id: "missing",
      });
    }
  });
});
