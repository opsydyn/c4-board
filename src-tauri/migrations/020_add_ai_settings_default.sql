-- Seed default AI runtime settings contract for Rig agent orchestration.
-- Non-destructive: keeps existing value if already present.

INSERT INTO app_settings (key, value, updated_at)
SELECT
    'aiSettings',
    '{"provider":"openai","model":"gpt-4o-mini","temperature":0.2,"maxTokens":1024,"actionMode":"read-only"}',
    CAST(strftime('%s', 'now') AS INTEGER) * 1000
WHERE NOT EXISTS (
    SELECT 1 FROM app_settings WHERE key = 'aiSettings'
);
