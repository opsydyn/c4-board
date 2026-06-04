-- OPY::9006 Task Lineage Continuity
-- Adds lightweight lineage metadata so interrupted task chains can be restored across related runs.

ALTER TABLE opy_agent_tasks
    ADD COLUMN lineage_key TEXT NULL;

ALTER TABLE opy_agent_tasks
    ADD COLUMN parent_task_id TEXT NULL;

CREATE INDEX IF NOT EXISTS opy_agent_tasks_session_lineage_updated_idx
    ON opy_agent_tasks(session_id, lineage_key, updated_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS opy_agent_tasks_parent_idx
    ON opy_agent_tasks(parent_task_id);
