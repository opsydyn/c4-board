-- Allow pre-restore checkpoints (ADR-020).
--
-- Restoring a checkpoint replaces the board wholesale, which discards anything
-- added since — including hand-drawn work. That makes an undo just as
-- destructive as the apply it reverses, so it takes a checkpoint of its own
-- first and a mistaken undo stays recoverable.
--
-- Migration 038's CHECK constraint admits only 'pre-apply'. SQLite cannot alter
-- a CHECK in place, so the table is rebuilt. Labelling a pre-restore snapshot
-- 'pre-apply' would have avoided this migration and been a small lie in the
-- data, which is the kind that costs more later than the rebuild does now.

CREATE TABLE azure_sync_checkpoints_new (
    id TEXT PRIMARY KEY,
    diagram_id TEXT NOT NULL,
    run_id TEXT NOT NULL,
    checkpoint_type TEXT NOT NULL CHECK (checkpoint_type IN ('pre-apply', 'pre-restore')),
    snapshot_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

INSERT INTO azure_sync_checkpoints_new (
    id, diagram_id, run_id, checkpoint_type, snapshot_json, created_at
)
SELECT id, diagram_id, run_id, checkpoint_type, snapshot_json, created_at
FROM azure_sync_checkpoints;

DROP TABLE azure_sync_checkpoints;

ALTER TABLE azure_sync_checkpoints_new RENAME TO azure_sync_checkpoints;

CREATE INDEX azure_sync_checkpoints_diagram_created_idx
    ON azure_sync_checkpoints(diagram_id, created_at DESC);

CREATE INDEX azure_sync_checkpoints_run_idx
    ON azure_sync_checkpoints(run_id);
