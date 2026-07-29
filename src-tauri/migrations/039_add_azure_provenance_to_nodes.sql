-- Azure provenance on nodes (ADR-020 Phase 2).
--
-- The apply merge has always written `sourceProvider`, `sourceResourceId`,
-- `sourceResourceType` and `lastSyncedAt` into a node's data, and the save has
-- always thrown them away: there were no columns. Everything downstream that
-- claimed to describe the board — the provenance badges, the confidence
-- summary — was really describing the last in-memory dry-run.
--
-- Columns rather than a JSON blob because that is this table's existing grain;
-- `nodes` is flat-column throughout, and `semantic_role` was added the same way
-- in migration 030. Edges take the opposite treatment for the same reason: they
-- already carry a versioned JSON payload, so their provenance goes in there.
--
-- Nullable, and NULL means "not Azure-derived" rather than "synced and empty".
-- The same distinction the run usage columns make in migrations 036 and 037:
-- absence of a measurement is not a measurement of absence.

ALTER TABLE nodes ADD COLUMN source_provider TEXT NULL;
ALTER TABLE nodes ADD COLUMN source_resource_id TEXT NULL;
ALTER TABLE nodes ADD COLUMN source_resource_type TEXT NULL;
ALTER TABLE nodes ADD COLUMN last_synced_at INTEGER NULL;

-- Answers "which board nodes came from this Azure resource", which is what a
-- drift check needs and what OPY will need to cite one.
CREATE INDEX nodes_source_resource_idx
    ON nodes(source_provider, source_resource_id);
