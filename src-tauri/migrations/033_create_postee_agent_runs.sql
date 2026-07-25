-- Postee agent runs and proposals (ADR-012).
--
-- Deliberately separate from the opy_agent_* tables rather than sharing them with
-- a `surface` discriminator, which is what ADR-012 originally proposed. Those
-- tables require task_id -> opy_agent_tasks and session_id -> opy_chat_sessions,
-- and their name/kind CHECK constraints enumerate board-specific values. A Postee
-- run has no chat session and no board task, so sharing them would mean inventing
-- both to satisfy foreign keys — a worse lie than a second table.
--
-- Same reasoning that already applied to proposals: a C4 proposal is nodes and
-- edges, a Postee proposal is a request.

CREATE TABLE postee_agent_runs (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    model TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('proposed', 'accepted', 'discarded', 'failed')),
    -- Whether the operator consented to response bodies leaving the machine.
    include_bodies INTEGER NOT NULL DEFAULT 0 CHECK (include_bodies IN (0, 1)),
    -- What the redaction boundary withheld, so a replay knows what the model never saw.
    withheld_json TEXT NOT NULL,
    input_tokens INTEGER NULL,
    output_tokens INTEGER NULL,
    total_tokens INTEGER NULL,
    error_summary TEXT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX postee_agent_runs_created_idx
    ON postee_agent_runs(created_at DESC);

CREATE TABLE postee_agent_proposals (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    summary TEXT NOT NULL,
    rationale TEXT NOT NULL,
    warnings_json TEXT NOT NULL,
    name TEXT NOT NULL,
    method TEXT NOT NULL,
    url TEXT NOT NULL,
    headers_json TEXT NOT NULL,
    body_mode TEXT NOT NULL,
    body_raw TEXT NULL,
    graphql_document TEXT NULL,
    graphql_variables_json TEXT NULL,
    graphql_operation_name TEXT NULL,
    -- The scratch draft this became, once the operator accepted it. NULL means
    -- proposed and not taken up, which is a normal outcome worth being able to see.
    scratch_draft_id TEXT NULL,
    accepted_at INTEGER NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (run_id) REFERENCES postee_agent_runs(id) ON DELETE CASCADE
);

CREATE INDEX postee_agent_proposals_run_idx
    ON postee_agent_proposals(run_id, created_at DESC);
