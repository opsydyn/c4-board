/**
 * Azure pre-apply checkpoints (ADR-020).
 *
 * Apply mutates the board and then saves. A failure between those points used
 * to leave the canvas changed with nothing persisted and no way back. This is
 * the way back, so the tests care most about whether a checkpoint can actually
 * restore what was there.
 */

import {
  type AzureSyncCheckpoint,
  createAzureSyncCheckpoint,
  latestAzureSyncCheckpoint,
  listAzureSyncCheckpoints,
} from "@/core/effects/azure-sync.checkpoints";
import { DatabaseError, DatabaseService } from "@/core/effects/database.base";
import { Effect, Layer } from "effect";
import { describe, expect, it, vi } from "vitest";

const checkpoint = (overrides?: Partial<AzureSyncCheckpoint>): AzureSyncCheckpoint => ({
  id: "azure-checkpoint-1",
  diagramId: "diagram-1",
  runId: "azure-sync-abc",
  checkpointType: "pre-apply",
  snapshot: {
    id: "diagram-1",
    name: "Estate",
    nodes: [{ id: "azure:a", position: { x: 0, y: 0 }, data: {} }],
    edges: [{ id: "azure-edge:1", source: "azure:a", target: "azure:b" }],
    savedAt: 1_900,
  },
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

describe("azure sync checkpoints", () => {
  it("writes the board snapshot it was given", async () => {
    const execute = vi.fn();
    const entry = checkpoint();

    await runWithDatabase(createAzureSyncCheckpoint(entry), { execute });

    const [sql, values] = execute.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("INSERT INTO azure_sync_checkpoints");
    expect(values[0]).toBe("azure-checkpoint-1");
    expect(values[1]).toBe("diagram-1");
    expect(values[2]).toBe("azure-sync-abc");
    expect(JSON.parse(String(values[4]))).toEqual(entry.snapshot);
  });

  it("restores a snapshot that survives the JSON round trip intact", async () => {
    const entry = checkpoint();

    const restored = await runWithDatabase(latestAzureSyncCheckpoint("diagram-1"), {
      query: () => [
        {
          id: entry.id,
          diagramId: entry.diagramId,
          runId: entry.runId,
          checkpointType: entry.checkpointType,
          snapshotJson: JSON.stringify(entry.snapshot),
          createdAt: entry.createdAt,
        },
      ],
    });

    // The whole point: what comes back must be applyable as a board.
    expect(restored?.snapshot).toEqual(entry.snapshot);
    expect(restored?.snapshot.nodes).toHaveLength(1);
    expect(restored?.snapshot.edges).toHaveLength(1);
  });

  it("reports no checkpoint rather than throwing when a diagram has none", async () => {
    const restored = await runWithDatabase(latestAzureSyncCheckpoint("diagram-1"), {
      query: () => [],
    });

    expect(restored).toBeNull();
  });

  it("drops a row whose snapshot will not parse instead of returning a broken board", async () => {
    // A checkpoint that cannot be read is worse than one that is absent: the
    // caller would restore garbage over a live board.
    const restored = await runWithDatabase(latestAzureSyncCheckpoint("diagram-1"), {
      query: () => [
        {
          id: "broken",
          diagramId: "diagram-1",
          runId: "azure-sync-abc",
          checkpointType: "pre-apply",
          snapshotJson: "{not json",
          createdAt: 2_000,
        },
      ],
    });

    expect(restored).toBeNull();
  });

  it("lists a diagram's checkpoints newest first", async () => {
    const rows = [1_000, 3_000, 2_000].map((createdAt) => ({
      id: `checkpoint-${createdAt}`,
      diagramId: "diagram-1",
      runId: "azure-sync-abc",
      checkpointType: "pre-apply",
      snapshotJson: JSON.stringify(checkpoint().snapshot),
      createdAt,
    }));

    const listed = await runWithDatabase(listAzureSyncCheckpoints("diagram-1"), {
      query: () => rows,
    });

    expect(listed.map((entry) => entry.createdAt)).toEqual([3_000, 2_000, 1_000]);
  });
});
