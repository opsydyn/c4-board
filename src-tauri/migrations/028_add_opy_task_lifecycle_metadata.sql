-- OPY::9008 Task Lifecycle Metadata + Snapshot Linkage
-- Adds replay/audit metadata to task envelopes and aligns artifact constraints with stage transitions.

ALTER TABLE opy_agent_tasks
    ADD COLUMN lifecycle_metadata_json TEXT NULL;

ALTER TABLE opy_agent_tasks
    ADD COLUMN snapshot_ref_json TEXT NULL;

CREATE INDEX IF NOT EXISTS opy_agent_tasks_snapshot_ref_idx
    ON opy_agent_tasks(session_id, updated_at DESC)
    WHERE snapshot_ref_json IS NOT NULL;

PRAGMA foreign_keys = OFF;

CREATE TABLE opy_agent_artifacts_v3 (
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
            'stage_transition',
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

INSERT INTO opy_agent_artifacts_v3 (
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

ALTER TABLE opy_agent_artifacts_v3 RENAME TO opy_agent_artifacts;

CREATE INDEX opy_agent_artifacts_task_created_idx
    ON opy_agent_artifacts(task_id, created_at ASC);

CREATE INDEX opy_agent_artifacts_session_kind_idx
    ON opy_agent_artifacts(session_id, kind, created_at DESC);

PRAGMA foreign_keys = ON;
PRAGMA foreign_key_check;
