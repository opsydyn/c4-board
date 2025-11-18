-- Add metadata column to edges table for OPSYDYN Visual Language (OVL)
-- Stores edge metadata as JSON: protocol, communicationStyle, requestVolume, latency, animationSpeed, notes

ALTER TABLE edges ADD COLUMN metadata TEXT;

-- Note: SQLite doesn't have native JSON validation, but we'll handle validation in the application layer
-- The metadata column stores serialized EdgeMetadata as JSON string
-- Example: {"protocol":"grpc","communicationStyle":"synchronous","requestVolume":100,"latency":50,"animationSpeed":"auto"}
