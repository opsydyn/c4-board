-- OPY::9004 Agent Task Lifecycle Persistence
-- Stores resumable OPY lifecycle requests across remounts and app restarts.

CREATE TABLE IF NOT EXISTS opy_agent_tasks (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    request_json TEXT NOT NULL,
    stage TEXT NOT NULL CHECK (
        stage IN (
            'contextualizing',
            'planning',
            'proposing',
            'awaiting_confirmation',
            'applying',
            'verifying',
            'completed',
            'failed'
        )
    ),
    status TEXT NOT NULL CHECK (
        status IN ('running', 'interrupted', 'completed', 'failed', 'cancelled')
    ),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    completed_at INTEGER NULL,
    error_summary TEXT NULL,
    FOREIGN KEY (session_id) REFERENCES opy_chat_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS opy_agent_tasks_session_updated_idx
    ON opy_agent_tasks(session_id, updated_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS opy_agent_tasks_status_updated_idx
    ON opy_agent_tasks(status, updated_at DESC);
