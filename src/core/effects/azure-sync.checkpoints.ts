/**
 * Pre-apply checkpoints for Azure sync (ADR-020).
 *
 * Apply mutates the board and then saves. Without a checkpoint, a failure
 * between those two points leaves the canvas changed, nothing persisted, and no
 * way back — which is how a sync turns a bad scope into lost work.
 *
 * Stored in `azure_sync_checkpoints` rather than `opy_agent_checkpoints`,
 * because that table requires an OPY chat session an Azure sync does not have.
 * See migration 038 for the full reasoning.
 */

import { Effect } from "effect";
import type { SaveDiagramInput } from "./canvas-persistence";
import { DatabaseService } from "./database.base";

export type AzureSyncCheckpointType = "pre-apply";

export interface AzureSyncCheckpointSnapshot extends SaveDiagramInput {
  readonly savedAt: number | null;
}

export interface AzureSyncCheckpoint {
  readonly id: string;
  readonly diagramId: string;
  /** The dry-run this checkpoint was taken for, so it traces to a snapshot. */
  readonly runId: string;
  readonly checkpointType: AzureSyncCheckpointType;
  readonly snapshot: AzureSyncCheckpointSnapshot;
  readonly createdAt: number;
}

interface AzureSyncCheckpointRow {
  id: string;
  diagramId: string;
  runId: string;
  checkpointType: string;
  snapshotJson: string;
  createdAt: number;
}

const INSERT_CHECKPOINT_SQL = `
  INSERT INTO azure_sync_checkpoints (
    id,
    diagram_id,
    run_id,
    checkpoint_type,
    snapshot_json,
    created_at
  )
  VALUES (?, ?, ?, ?, ?, ?)
`;

const LIST_CHECKPOINTS_SQL = `
  SELECT
    id,
    diagram_id AS diagramId,
    run_id AS runId,
    checkpoint_type AS checkpointType,
    snapshot_json AS snapshotJson,
    created_at AS createdAt
  FROM azure_sync_checkpoints
  WHERE diagram_id = ?
  ORDER BY created_at DESC
`;

/**
 * Returns `null` for a row that will not decode.
 *
 * An unreadable checkpoint is worse than an absent one — the caller would
 * restore garbage over a live board — so a broken row is treated as no
 * checkpoint at all.
 */
const decodeCheckpointRow = (row: AzureSyncCheckpointRow): AzureSyncCheckpoint | null => {
  if (row.checkpointType !== "pre-apply") {
    return null;
  }

  let snapshot: unknown;
  try {
    snapshot = JSON.parse(row.snapshotJson);
  } catch {
    return null;
  }

  if (typeof snapshot !== "object" || snapshot === null) {
    return null;
  }

  const candidate = snapshot as Partial<AzureSyncCheckpointSnapshot>;
  if (!Array.isArray(candidate.nodes) || !Array.isArray(candidate.edges)) {
    return null;
  }

  return {
    id: row.id,
    diagramId: row.diagramId,
    runId: row.runId,
    checkpointType: "pre-apply",
    snapshot: candidate as AzureSyncCheckpointSnapshot,
    createdAt: row.createdAt,
  };
};

export const createAzureSyncCheckpoint = (checkpoint: AzureSyncCheckpoint) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    yield* service.execute(INSERT_CHECKPOINT_SQL, [
      checkpoint.id,
      checkpoint.diagramId,
      checkpoint.runId,
      checkpoint.checkpointType,
      JSON.stringify(checkpoint.snapshot),
      checkpoint.createdAt,
    ]);

    return checkpoint;
  });

export const listAzureSyncCheckpoints = (diagramId: string) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    const rows = yield* service.query<AzureSyncCheckpointRow>(LIST_CHECKPOINTS_SQL, [diagramId]);

    return rows
      .map(decodeCheckpointRow)
      .filter((row): row is AzureSyncCheckpoint => row !== null)
      .sort((left, right) => right.createdAt - left.createdAt);
  });

export const latestAzureSyncCheckpoint = (diagramId: string) =>
  Effect.map(
    listAzureSyncCheckpoints(diagramId),
    (checkpoints): AzureSyncCheckpoint | null => checkpoints[0] ?? null,
  );
