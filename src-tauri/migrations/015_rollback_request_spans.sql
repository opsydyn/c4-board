-- Rollback: Drop request spans table
-- This removes the comprehensive network tracing feature
-- Rolls back migrations 013 and 014

DROP TABLE IF EXISTS postee_request_spans;
