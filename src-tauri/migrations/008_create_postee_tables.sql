-- Postee core tables
CREATE TABLE IF NOT EXISTS postee_collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS postee_collections_updated_idx
    ON postee_collections(updated_at DESC);

CREATE TABLE IF NOT EXISTS postee_requests (
    id TEXT PRIMARY KEY,
    collection_id TEXT NOT NULL,
    name TEXT NOT NULL,
    method TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    favorite INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (collection_id) REFERENCES postee_collections(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS postee_requests_collection_idx
    ON postee_requests(collection_id, sort_order);

CREATE TABLE IF NOT EXISTS postee_request_headers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (request_id) REFERENCES postee_requests(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS postee_request_headers_request_idx
    ON postee_request_headers(request_id, sort_order);

CREATE TABLE IF NOT EXISTS postee_request_bodies (
    request_id TEXT PRIMARY KEY,
    mode TEXT NOT NULL DEFAULT 'raw',
    raw TEXT,
    form_values TEXT,
    FOREIGN KEY (request_id) REFERENCES postee_requests(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS postee_environments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS postee_environment_variables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    environment_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    is_secret INTEGER NOT NULL DEFAULT 0,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (environment_id) REFERENCES postee_environments(id) ON DELETE CASCADE,
    UNIQUE(environment_id, key)
);

CREATE INDEX IF NOT EXISTS postee_environment_variables_env_idx
    ON postee_environment_variables(environment_id, sort_order);

CREATE TABLE IF NOT EXISTS postee_history (
    id TEXT PRIMARY KEY,
    request_id TEXT,
    request_snapshot TEXT NOT NULL,
    response_status INTEGER,
    response_time_ms INTEGER,
    response_size_bytes INTEGER,
    error_message TEXT,
    executed_at INTEGER NOT NULL,
    FOREIGN KEY (request_id) REFERENCES postee_requests(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS postee_history_request_idx
    ON postee_history(request_id, executed_at DESC);
