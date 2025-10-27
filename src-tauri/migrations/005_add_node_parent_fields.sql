-- Add parent-child relationship fields for ReactFlow sub-flows
-- Enables containers to contain other nodes (nested diagrams)

ALTER TABLE nodes ADD COLUMN parent_id TEXT;
ALTER TABLE nodes ADD COLUMN extent TEXT CHECK(extent IN ('parent', NULL));
ALTER TABLE nodes ADD COLUMN expand_parent INTEGER DEFAULT 0 CHECK(expand_parent IN (0, 1));

-- Create index for parent lookup performance
CREATE INDEX IF NOT EXISTS idx_nodes_parent_id ON nodes(parent_id);

-- Add foreign key constraint (parent must be another node in same diagram)
-- Note: SQLite doesn't support ALTER TABLE to add foreign keys, so we document it here
-- FOREIGN KEY (parent_id) REFERENCES nodes(id) ON DELETE CASCADE
-- This will be enforced at the application level
