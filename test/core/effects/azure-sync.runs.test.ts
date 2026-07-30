/**
 * Azure sync run history (ADR-020 Phase 2).
 *
 * Nothing about a sync was recorded before this. The run lived in React state
 * and died with the component, which is why OPY's Azure evidence only existed
 * when the operator happened to have the panel open.
 */

import { type AzureSyncRunRecord, listAzureSyncRuns, recordAzureSyncRun } from "@/core/effects/azure-sync.runs";
import { DatabaseError, DatabaseService } from "@/core/effects/database.base";
import { Effect, Layer } from "effect";
import { describe, expect, it, vi } from "vitest";

const record = (overrides?: Partial<AzureSyncRunRecord>): AzureSyncRunRecord => ({
  id: "azure-sync-abc",
  diagramId: "diagram-1",
  subscriptionIds: ["sub-a"],
  resourceGroups: ["rg-a"],
  tagFilters: { env: "prod" },
  usedCustomQuery: false,
  status: "applied",
  resourceCount: 14,
  relationshipCount: 9,
  nodesCreated: 3,
  nodesUpdated: 1,
  nodesArchived: 0,
  nodesRetained: 2,
  edgesCreated: 4,
  edgesUpdated: 0,
  edgesArchived: 0,
  edgesRetained: 1,
  truncated: false,
  warnings: ["one warning"],
  blockedReasons: [],
  checkpointId: "azure-checkpoint-abc",
  errorSummary: null,
  collectedAt: 1_900,
  createdAt: 2_000,
  ...overrides,
});

const runWithDatabase = async <A, E>(
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

const rowFor = (entry: AzureSyncRunRecord) => ({
  id: entry.id,
  diagramId: entry.diagramId,
  subscriptionIdsJson: JSON.stringify(entry.subscriptionIds),
  resourceGroupsJson: JSON.stringify(entry.resourceGroups),
  tagFiltersJson: JSON.stringify(entry.tagFilters),
  usedCustomQuery: entry.usedCustomQuery ? 1 : 0,
  status: entry.status,
  resourceCount: entry.resourceCount,
  relationshipCount: entry.relationshipCount,
  nodesCreated: entry.nodesCreated,
  nodesUpdated: entry.nodesUpdated,
  nodesArchived: entry.nodesArchived,
  nodesRetained: entry.nodesRetained,
  edgesCreated: entry.edgesCreated,
  edgesUpdated: entry.edgesUpdated,
  edgesArchived: entry.edgesArchived,
  edgesRetained: entry.edgesRetained,
  truncated: entry.truncated ? 1 : 0,
  warningsJson: JSON.stringify(entry.warnings),
  blockedReasonsJson: JSON.stringify(entry.blockedReasons),
  checkpointId: entry.checkpointId,
  errorSummary: entry.errorSummary,
  collectedAt: entry.collectedAt,
  createdAt: entry.createdAt,
});

describe("azure sync runs", () => {
  it("records a run with its scope and deltas", async () => {
    const execute = vi.fn();

    await runWithDatabase(recordAzureSyncRun(record()), { execute });

    const [sql, values] = execute.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("INSERT INTO azure_sync_runs");
    expect(values[0]).toBe("azure-sync-abc");
    expect(JSON.parse(String(values[2]))).toEqual(["sub-a"]);
  });

  it("never stores the custom query text, only that one was used", async () => {
    const execute = vi.fn();

    await runWithDatabase(
      recordAzureSyncRun(record({ usedCustomQuery: true })),
      { execute },
    );

    const [, values] = execute.mock.calls[0] as [string, unknown[]];
    // Operator-authored KQL can carry anything they typed; the audit only needs
    // to know the default projection was replaced.
    expect(values.some((value) => typeof value === "string" && value.includes("Resources |"))).toBe(false);
    expect(values[5]).toBe(1);
  });

  it("reads a run back with its counts and flags intact", async () => {
    const entry = record();

    const runs = await runWithDatabase(listAzureSyncRuns(), { query: () => [rowFor(entry)] });

    expect(runs[0]).toEqual(entry);
  });

  it("keeps retained counts distinct from archived ones", async () => {
    // These answer different questions: what was removed, and what a retention
    // default spared. Collapsing them would hide the safety behaviour entirely.
    const entry = record({ nodesArchived: 0, nodesRetained: 7 });

    const runs = await runWithDatabase(listAzureSyncRuns(), { query: () => [rowFor(entry)] });

    expect(runs[0]?.nodesArchived).toBe(0);
    expect(runs[0]?.nodesRetained).toBe(7);
  });

  it("drops a row whose scope will not parse rather than inventing an empty scope", async () => {
    const runs = await runWithDatabase(listAzureSyncRuns(), {
      query: () => [{ ...rowFor(record()), subscriptionIdsJson: "{not json" }],
    });

    expect(runs).toEqual([]);
  });

  it("lists runs newest first", async () => {
    const rows = [1_000, 3_000, 2_000].map((createdAt) => rowFor(record({ id: `run-${createdAt}`, createdAt })));

    const runs = await runWithDatabase(listAzureSyncRuns(), { query: () => rows });

    expect(runs.map((entry) => entry.createdAt)).toEqual([3_000, 2_000, 1_000]);
  });
});
