-- OPY::9001 Agent Run Envelope Persistence
-- Stores durable agent run metadata linked to OPY chat sessions.

CREATE TABLE IF NOT EXISTS opy_agent_runs (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    agent TEXT NOT NULL,
    intent TEXT NOT NULL,
    stage TEXT NOT NULL CHECK (stage IN ('invoke', 'persist', 'complete')),
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
    started_at INTEGER NOT NULL,
    completed_at INTEGER NULL,
    error_summary TEXT NULL,
    FOREIGN KEY (session_id) REFERENCES opy_chat_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS opy_agent_runs_session_started_idx
    ON opy_agent_runs(session_id, started_at DESC);

CREATE INDEX IF NOT EXISTS opy_agent_runs_status_completed_idx
    ON opy_agent_runs(status, completed_at DESC);
