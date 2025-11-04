-- Migration 010: Add JSON response body storage to history
-- SQLite JSON1 extension support for storing and querying HTTP responses

-- Add response body columns to postee_history
ALTER TABLE postee_history ADD COLUMN response_body TEXT;
ALTER TABLE postee_history ADD COLUMN response_headers TEXT;

-- Add check constraint to ensure valid JSON (SQLite 3.37.0+)
-- This will validate JSON on insert/update
-- Note: CHECK constraints don't prevent NULL values, which is intentional
CREATE TABLE IF NOT EXISTS postee_history_new (
    id TEXT PRIMARY KEY,
    request_id TEXT,
    request_snapshot TEXT NOT NULL,
    response_status INTEGER,
    response_time_ms INTEGER,
    response_size_bytes INTEGER,
    response_body TEXT CHECK(json_valid(response_body) OR response_body IS NULL),
    response_headers TEXT CHECK(json_valid(response_headers) OR response_headers IS NULL),
    error_message TEXT,
    executed_at INTEGER NOT NULL,
    FOREIGN KEY (request_id) REFERENCES postee_requests(id) ON DELETE SET NULL
);

-- Copy existing data
INSERT INTO postee_history_new
    (id, request_id, request_snapshot, response_status, response_time_ms,
     response_size_bytes, error_message, executed_at)
SELECT
    id, request_id, request_snapshot, response_status, response_time_ms,
    response_size_bytes, error_message, executed_at
FROM postee_history;

-- Drop old table and rename new one
DROP TABLE postee_history;
ALTER TABLE postee_history_new RENAME TO postee_history;

-- Recreate index
CREATE INDEX IF NOT EXISTS postee_history_request_idx
    ON postee_history(request_id, executed_at DESC);

-- Create index for faster JSON queries (optional, but recommended)
-- Useful for searching response bodies
CREATE INDEX IF NOT EXISTS postee_history_executed_idx
    ON postee_history(executed_at DESC);
