-- Session History Table
-- Stores snapshots of diagram sessions for versioning and rollback

CREATE TABLE IF NOT EXISTS history (
    id TEXT PRIMARY KEY,
    diagram_id TEXT NOT NULL,
    session_name TEXT NOT NULL,
    snapshot_data TEXT NOT NULL, -- JSON serialized nodes and edges
    created_at INTEGER NOT NULL,
    FOREIGN KEY (diagram_id) REFERENCES diagrams(id) ON DELETE CASCADE
);

-- Index for performance when querying history by diagram
CREATE INDEX IF NOT EXISTS idx_history_diagram_id ON history(diagram_id);
CREATE INDEX IF NOT EXISTS idx_history_created_at ON history(created_at);
