-- Model attribution on the OPY run envelope (Gate 2).
--
-- Which provider and model answered a run was only ever carried on transient
-- telemetry events, read from whatever settings held at emit time. Nothing
-- durable recorded it, so a run in task history could not be attributed to a
-- model at all — and once settings changed, the pairing was gone for good.
--
-- Gate 2 requires task history to reconstruct model metadata. That means storing
-- what answered, next to what it cost, on the record it belongs to.
--
-- Nullable for the same reason the usage columns are: runs recorded before this
-- migration have no attribution, and inventing one from current settings would
-- be a guess presented as a record.

ALTER TABLE opy_agent_runs ADD COLUMN provider TEXT NULL;
ALTER TABLE opy_agent_runs ADD COLUMN model TEXT NULL;
