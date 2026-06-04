-- OPY::9005 Agent Tool Calls + Artifacts
-- Stores a queryable execution trail for persisted OPY lifecycle tasks.

CREATE TABLE IF NOT EXISTS opy_agent_tool_calls (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    name TEXT NOT NULL CHECK (
        name IN (
            'assemble_context',
            'invoke_agent',
            'persist_assistant_message',
            'resolve_action',
            'execute_board_action',
            'refresh_checkpoints'
        )
    ),
    status TEXT NOT NULL CHECK (
        status IN ('running', 'interrupted', 'completed', 'failed', 'cancelled')
    ),
    started_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    completed_at INTEGER NULL,
    input_summary TEXT NULL,
    output_summary TEXT NULL,
    error_summary TEXT NULL,
    FOREIGN KEY (task_id) REFERENCES opy_agent_tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES opy_chat_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS opy_agent_tool_calls_task_started_idx
    ON opy_agent_tool_calls(task_id, started_at ASC, updated_at ASC);

CREATE INDEX IF NOT EXISTS opy_agent_tool_calls_session_status_idx
    ON opy_agent_tool_calls(session_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS opy_agent_artifacts (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    tool_call_id TEXT NULL,
    kind TEXT NOT NULL CHECK (
        kind IN (
            'context_bundle',
            'chat_response',
            'diagram_proposal',
            'board_review',
            'action_descriptor',
            'mutation_plan',
            'checkpoint_restore_preview'
        )
    ),
    summary TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (task_id) REFERENCES opy_agent_tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES opy_chat_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (tool_call_id) REFERENCES opy_agent_tool_calls(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS opy_agent_artifacts_task_created_idx
    ON opy_agent_artifacts(task_id, created_at ASC);

CREATE INDEX IF NOT EXISTS opy_agent_artifacts_session_kind_idx
    ON opy_agent_artifacts(session_id, kind, created_at DESC);
