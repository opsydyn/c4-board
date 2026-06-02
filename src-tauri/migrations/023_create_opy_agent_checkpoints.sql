-- OPY::9003 Agent Checkpoint Persistence
-- Stores pre-apply board snapshots for confirmed OPY mutation batches.

CREATE TABLE IF NOT EXISTS opy_agent_checkpoints (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    diagram_id TEXT NOT NULL,
    proposal_responded_at INTEGER NOT NULL,
    checkpoint_type TEXT NOT NULL CHECK (checkpoint_type IN ('pre-apply')),
    snapshot_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES opy_chat_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS opy_agent_checkpoints_session_created_idx
    ON opy_agent_checkpoints(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS opy_agent_checkpoints_diagram_created_idx
    ON opy_agent_checkpoints(diagram_id, created_at DESC);
