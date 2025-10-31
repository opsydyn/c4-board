-- Store metadata for user-provided icons
CREATE TABLE IF NOT EXISTS custom_icons (
    id TEXT PRIMARY KEY,
    label TEXT,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS custom_icons_filename_idx
    ON custom_icons(filename);
