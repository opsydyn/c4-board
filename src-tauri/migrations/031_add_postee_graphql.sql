CREATE TABLE postee_graphql_requests (
    request_id TEXT PRIMARY KEY,
    document TEXT NOT NULL,
    variables_json TEXT NOT NULL DEFAULT '',
    operation_name TEXT,
    FOREIGN KEY (request_id) REFERENCES postee_requests(id) ON DELETE CASCADE
);

CREATE TABLE postee_graphql_schema_snapshots (
    id TEXT PRIMARY KEY,
    endpoint_url TEXT NOT NULL,
    context_fingerprint TEXT NOT NULL,
    introspection_json TEXT NOT NULL,
    schema_digest TEXT NOT NULL,
    fetched_at INTEGER NOT NULL,
    last_used_at INTEGER NOT NULL,
    UNIQUE(endpoint_url, context_fingerprint)
);
