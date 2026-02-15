-- OPY::9000 Chat Persistence
-- Stores resumable chat sessions and transcript messages per board scope.

CREATE TABLE IF NOT EXISTS opy_chat_sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    domain TEXT NOT NULL CHECK (domain IN ('c4', 'ddd')),
    diagram_id TEXT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_message_at INTEGER NULL,
    FOREIGN KEY (diagram_id) REFERENCES diagrams(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS opy_chat_sessions_scope_updated_idx
    ON opy_chat_sessions(domain, diagram_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS opy_chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('assistant', 'user', 'system')),
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES opy_chat_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS opy_chat_messages_session_created_idx
    ON opy_chat_messages(session_id, created_at ASC);
