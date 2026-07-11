-- Persist user-reviewed semantic layout roles only after layout Apply.

ALTER TABLE nodes ADD COLUMN semantic_role TEXT
    CHECK (semantic_role IS NULL OR semantic_role IN (
        'core',
        'inbound-port',
        'outbound-port',
        'inbound-adapter',
        'outbound-adapter',
        'infrastructure',
        'publisher',
        'event-bus',
        'processor',
        'subscriber',
        'client',
        'service',
        'domain',
        'persistence',
        'external-dependency',
        'unclassified'
    ));
