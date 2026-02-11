-- Persist node coupling state for balanced coupling scoring and overrides.
-- This keeps coupling UI state durable across reload/navigation.

ALTER TABLE nodes ADD COLUMN coupling_state_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE nodes ADD COLUMN coupling_state_json TEXT;
