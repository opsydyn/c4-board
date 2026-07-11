-- Diagram-owned intelligent layout application history.
-- Audit payloads are immutable, versioned JSON records created only on Apply.

CREATE TABLE IF NOT EXISTS layout_audits (
    id TEXT PRIMARY KEY,
    diagram_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    applied_at INTEGER NOT NULL,
    audit_json TEXT NOT NULL CHECK(json_valid(audit_json)),
    FOREIGN KEY (diagram_id) REFERENCES diagrams(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS layout_audits_diagram_applied_idx
    ON layout_audits(diagram_id, applied_at);

CREATE INDEX IF NOT EXISTS layout_audits_diagram_recent_idx
    ON layout_audits(diagram_id, applied_at DESC);
