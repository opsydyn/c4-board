-- Normalize ownership values and add lookup index for team topology queries.
-- This migration is intentionally non-destructive.

UPDATE nodes
SET team_ownership = NULLIF(TRIM(team_ownership), '')
WHERE team_ownership IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nodes_team_ownership ON nodes(team_ownership);
