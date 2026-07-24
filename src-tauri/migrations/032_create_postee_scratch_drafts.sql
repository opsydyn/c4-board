CREATE TABLE postee_scratch_drafts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    method TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    headers_json TEXT NOT NULL,
    body_mode TEXT NOT NULL,
    body_raw TEXT,
    form_values TEXT,
    graphql_document TEXT,
    graphql_variables_json TEXT,
    graphql_operation_name TEXT,
    environment_id TEXT,
    tab_order INTEGER NOT NULL,
    is_open INTEGER NOT NULL DEFAULT 1 CHECK (is_open IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX postee_scratch_drafts_reopen_idx
    ON postee_scratch_drafts(is_open, updated_at DESC);

CREATE INDEX postee_scratch_drafts_open_order_idx
    ON postee_scratch_drafts(is_open, tab_order ASC, updated_at DESC);
