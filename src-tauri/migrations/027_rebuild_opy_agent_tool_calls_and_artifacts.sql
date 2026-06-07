-- OPY::9007 Tool Call + Artifact Schema Alignment
-- Rebuilds persisted OPY trace tables so runtime enum additions match SQLite constraints.

PRAGMA foreign_keys = OFF;

CREATE TABLE opy_agent_tool_calls_v2 (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    name TEXT NOT NULL CHECK (
        name IN (
            'assemble_context',
            'invoke_agent',
            'invoke_analyst',
            'invoke_planner',
            'invoke_verifier',
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

INSERT INTO opy_agent_tool_calls_v2 (
    id,
    task_id,
    session_id,
    name,
    status,
    started_at,
    updated_at,
    completed_at,
    input_summary,
    output_summary,
    error_summary
)
SELECT
    id,
    task_id,
    session_id,
    name,
    status,
    started_at,
    updated_at,
    completed_at,
    input_summary,
    output_summary,
    error_summary
FROM opy_agent_tool_calls;

CREATE TABLE opy_agent_artifacts_v2 (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    tool_call_id TEXT NULL,
    kind TEXT NOT NULL CHECK (
        kind IN (
            'context_bundle',
            'anomaly_assessment',
            'chat_response',
            'diagram_proposal',
            'board_review',
            'action_descriptor',
            'action_result',
            'resume_boundary_outcome',
            'mutation_plan',
            'checkpoint_restore_preview'
        )
    ),
    summary TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (task_id) REFERENCES opy_agent_tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES opy_chat_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (tool_call_id) REFERENCES opy_agent_tool_calls_v2(id) ON DELETE SET NULL
);

INSERT INTO opy_agent_artifacts_v2 (
    id,
    task_id,
    session_id,
    tool_call_id,
    kind,
    summary,
    payload_json,
    created_at
)
SELECT
    id,
    task_id,
    session_id,
    tool_call_id,
    kind,
    summary,
    payload_json,
    created_at
FROM opy_agent_artifacts;

DROP TABLE opy_agent_artifacts;
DROP TABLE opy_agent_tool_calls;

ALTER TABLE opy_agent_tool_calls_v2 RENAME TO opy_agent_tool_calls;
ALTER TABLE opy_agent_artifacts_v2 RENAME TO opy_agent_artifacts;

CREATE INDEX opy_agent_tool_calls_task_started_idx
    ON opy_agent_tool_calls(task_id, started_at ASC, updated_at ASC);

CREATE INDEX opy_agent_tool_calls_session_status_idx
    ON opy_agent_tool_calls(session_id, status, updated_at DESC);

CREATE INDEX opy_agent_artifacts_task_created_idx
    ON opy_agent_artifacts(task_id, created_at ASC);

CREATE INDEX opy_agent_artifacts_session_kind_idx
    ON opy_agent_artifacts(session_id, kind, created_at DESC);

PRAGMA foreign_keys = ON;
PRAGMA foreign_key_check;
