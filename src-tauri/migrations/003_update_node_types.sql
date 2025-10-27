-- Update nodes.type CHECK constraint to include container and component
PRAGMA foreign_keys=OFF;

CREATE TABLE IF NOT EXISTS nodes_new (
    id TEXT PRIMARY KEY,
    diagram_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('person', 'system', 'externalSystem', 'container', 'component')),
    label TEXT NOT NULL,
    technology TEXT,
    description TEXT,
    position_x REAL NOT NULL,
    position_y REAL NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (diagram_id) REFERENCES diagrams(id) ON DELETE CASCADE
);

INSERT INTO nodes_new (
    id,
    diagram_id,
    type,
    label,
    technology,
    description,
    position_x,
    position_y,
    created_at,
    updated_at
)
SELECT
    id,
    diagram_id,
    type,
    label,
    technology,
    description,
    position_x,
    position_y,
    created_at,
    updated_at
FROM nodes;

DROP TABLE nodes;
ALTER TABLE nodes_new RENAME TO nodes;

CREATE INDEX IF NOT EXISTS idx_nodes_diagram_id ON nodes(diagram_id);

PRAGMA foreign_keys=ON;
