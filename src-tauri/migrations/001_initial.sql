-- C4 Diagrams Database Schema
-- Following Functional Core principle: schema represents pure data structure

-- Diagrams table: stores C4 diagram metadata
CREATE TABLE IF NOT EXISTS diagrams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Nodes table: stores C4 elements (Person, System, External System)
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    diagram_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('person', 'system', 'externalSystem')),
    label TEXT NOT NULL,
    technology TEXT,
    description TEXT,
    position_x REAL NOT NULL,
    position_y REAL NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (diagram_id) REFERENCES diagrams(id) ON DELETE CASCADE
);

-- Edges table: stores relationships between nodes
CREATE TABLE IF NOT EXISTS edges (
    id TEXT PRIMARY KEY,
    diagram_id TEXT NOT NULL,
    source TEXT NOT NULL,
    target TEXT NOT NULL,
    label TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (diagram_id) REFERENCES diagrams(id) ON DELETE CASCADE,
    FOREIGN KEY (source) REFERENCES nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (target) REFERENCES nodes(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_nodes_diagram_id ON nodes(diagram_id);
CREATE INDEX IF NOT EXISTS idx_edges_diagram_id ON edges(diagram_id);
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target);
