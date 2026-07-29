-- Pre-apply checkpoints for Azure sync (ADR-020).
--
-- Azure apply mutates the board and then saves. Until now a failure between
-- those two points left the canvas changed with nothing persisted and no way
-- back. This is the way back.
--
-- Deliberately not `opy_agent_checkpoints`. That table's `session_id` is NOT
-- NULL with a foreign key to `opy_chat_sessions`, and an Azure sync has no chat
-- session — it is started from a panel, by a person, with no agent involved.
-- Satisfying the FK would mean fabricating a session row, which would then be
-- read as real by every OPY audit surface that joins against it. Migration 033
-- made the same call for Postee and recorded the same reasoning: a fabricated
-- parent row is a worse lie than a second table.
--
-- `run_id` is the dry-run's id, so a checkpoint can be traced back to the
-- snapshot that motivated it.

CREATE TABLE azure_sync_checkpoints (
    id TEXT PRIMARY KEY,
    diagram_id TEXT NOT NULL,
    run_id TEXT NOT NULL,
    -- Reserved for the archive/rollback distinction; only one kind exists today.
    checkpoint_type TEXT NOT NULL CHECK (checkpoint_type IN ('pre-apply')),
    snapshot_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX azure_sync_checkpoints_diagram_created_idx
    ON azure_sync_checkpoints(diagram_id, created_at DESC);

CREATE INDEX azure_sync_checkpoints_run_idx
    ON azure_sync_checkpoints(run_id);
