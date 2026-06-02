-- OPY::9002 Diagram Proposal Artifact Persistence
-- Stores structured diagram proposals, grounded context, and plan review state.

CREATE TABLE IF NOT EXISTS opy_diagram_proposals (
    session_id TEXT NOT NULL,
    proposal_responded_at INTEGER NOT NULL,
    command_description TEXT NOT NULL,
    proposal_json TEXT NOT NULL,
    context_json TEXT NOT NULL,
    decision_status TEXT NOT NULL CHECK (decision_status IN ('pending', 'approved', 'rejected')),
    decided_at INTEGER NOT NULL,
    PRIMARY KEY (session_id, proposal_responded_at),
    FOREIGN KEY (session_id) REFERENCES opy_chat_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS opy_diagram_proposals_session_decided_idx
    ON opy_diagram_proposals(session_id, decided_at DESC, proposal_responded_at DESC);
