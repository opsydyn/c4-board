-- Request Span Tracing Table
-- Stores detailed timing breakdown for every HTTP request execution
-- Timeline includes: DNS, connect, TLS, request write, TTFB, body read

CREATE TABLE IF NOT EXISTS postee_request_spans (
    id TEXT PRIMARY KEY,
    history_id TEXT NOT NULL,
    request_uid TEXT NOT NULL,
    endpoint_uid TEXT,
    service_uid TEXT,
    plan_hash TEXT,

    -- Timing breakdown (all in milliseconds)
    dns_start_ms REAL,
    dns_end_ms REAL,
    dns_duration_ms REAL,

    connect_start_ms REAL,
    connect_end_ms REAL,
    connect_duration_ms REAL,

    tls_start_ms REAL,
    tls_end_ms REAL,
    tls_duration_ms REAL,

    request_start_ms REAL NOT NULL,
    request_end_ms REAL,
    request_write_duration_ms REAL,

    ttfb_ms REAL, -- Time To First Byte from request_start

    response_start_ms REAL,
    response_end_ms REAL,
    body_read_duration_ms REAL,

    total_duration_ms REAL NOT NULL,

    -- Metadata
    created_at INTEGER NOT NULL,

    FOREIGN KEY (history_id) REFERENCES postee_history(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS postee_request_spans_history_idx
    ON postee_request_spans(history_id);

CREATE INDEX IF NOT EXISTS postee_request_spans_request_uid_idx
    ON postee_request_spans(request_uid, created_at DESC);
