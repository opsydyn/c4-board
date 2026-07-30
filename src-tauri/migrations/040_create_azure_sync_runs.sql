-- Azure sync run history (ADR-020 Phase 2).
--
-- Nothing about a sync was ever recorded. The run id, scope, deltas, warnings
-- and auth state lived in React state and died with the component, so the
-- Settings audit could not show a sync history and OPY's Azure evidence existed
-- only if the operator happened to have the panel open in this session.
--
-- `applied` distinguishes a dry-run from a run that reached the board, because
-- the interesting question after the fact is usually "what did we actually
-- change", not "what did we look at".
--
-- Counts are stored rather than the whole snapshot: a run record is an audit
-- trail, not a cache. The board itself, plus the pre-apply checkpoint, already
-- hold the data.

CREATE TABLE azure_sync_runs (
    id TEXT PRIMARY KEY,
    diagram_id TEXT NULL,
    -- Scope as the operator entered it, so a run can be reproduced. Subscription
    -- ids are identifiers rather than credentials; no token or secret is stored.
    subscription_ids_json TEXT NOT NULL,
    resource_groups_json TEXT NOT NULL,
    tag_filters_json TEXT NOT NULL,
    -- 1 when a custom KQL query replaced the default projection. The query text
    -- itself is operator input and is not stored.
    used_custom_query INTEGER NOT NULL DEFAULT 0 CHECK (used_custom_query IN (0, 1)),
    status TEXT NOT NULL CHECK (status IN ('planned', 'applied', 'blocked', 'failed')),
    resource_count INTEGER NOT NULL,
    relationship_count INTEGER NOT NULL,
    nodes_created INTEGER NOT NULL,
    nodes_updated INTEGER NOT NULL,
    nodes_archived INTEGER NOT NULL,
    nodes_retained INTEGER NOT NULL,
    edges_created INTEGER NOT NULL,
    edges_updated INTEGER NOT NULL,
    edges_archived INTEGER NOT NULL,
    edges_retained INTEGER NOT NULL,
    truncated INTEGER NOT NULL DEFAULT 0 CHECK (truncated IN (0, 1)),
    warnings_json TEXT NOT NULL,
    -- Set when the apply was refused, so a blocked run explains itself later.
    blocked_reasons_json TEXT NULL,
    checkpoint_id TEXT NULL,
    error_summary TEXT NULL,
    collected_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX azure_sync_runs_created_idx
    ON azure_sync_runs(created_at DESC);

CREATE INDEX azure_sync_runs_diagram_created_idx
    ON azure_sync_runs(diagram_id, created_at DESC);
