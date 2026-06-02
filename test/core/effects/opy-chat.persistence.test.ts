import { DatabaseError, DatabaseService } from "@/core/effects/database.base";
import {
  listOpyDiagramProposals,
  type OpyPersistedDiagramProposal,
  upsertOpyDiagramProposal,
} from "@/core/effects/opy-chat.persistence";
import { Effect, Layer } from "effect";
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
});
