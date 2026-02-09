-- Global Settings Table
-- Stores application-level settings as JSON-encoded key/value pairs.

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS app_settings_updated_idx
    ON app_settings(updated_at DESC);
