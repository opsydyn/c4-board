-- ADR-016 Phase 2. The Big Picture vocabulary.
--
-- Adds the two node types with no existing equivalent, and the pivotal flag.
-- An event storm's event is a `domainEvent` and its actor a `person`, so those
-- are reused rather than duplicated under Event Storming names — which keeps the
-- type CHECK from growing synonyms and lets a storm become a DDD model later
-- without retyping the board.
--
-- `is_pivotal` marks an event as a phase boundary on the timeline. It is a
-- column because node data maps to columns here, not to a JSON blob.
--
-- Same rebuild shape as 034, and for the same reason: SQLite cannot alter a
-- CHECK, and foreign_keys must be off or DROP TABLE cascades through
-- edges -> nodes and empties every diagram's relationships.

PRAGMA foreign_keys=OFF;

CREATE TABLE nodes_new (
    id TEXT PRIMARY KEY,
    diagram_id TEXT NOT NULL,
    -- NEW: Domain discriminator
    domain TEXT NOT NULL DEFAULT 'c4' CHECK(domain IN ('c4', 'ddd', 'eventStorming')),
    -- Expanded type field to include DDD types
    type TEXT NOT NULL CHECK(type IN (
        -- C4 types
        'person', 'system', 'externalSystem', 'container', 'component',
        -- DDD Strategic types
        'boundedContext', 'aggregate', 'domainEvent',
        -- DDD Tactical types
        'entity', 'valueObject', 'domainService', 'repository', 'factory',
        -- DDD Application types
        'command', 'query', 'applicationService',
        -- DDD Infrastructure types
        'integrationEvent', 'antiCorruptionLayer', 'saga',
        -- Event Storming types with no existing equivalent (ADR-016). An event
        -- storm's event is a domainEvent and its actor a person, so those are
        -- reused rather than duplicated under new names.
        'hotspot', 'opportunity'
    )),
    label TEXT NOT NULL,
    technology TEXT,
    description TEXT,
    position_x REAL NOT NULL,
    position_y REAL NOT NULL,
    width REAL,
    height REAL,
    parent_id TEXT,
    extent TEXT,
    expand_parent INTEGER DEFAULT 0,
    icon_id TEXT,

    -- DDD-specific fields (nullable for C4 nodes)
    aggregate_root TEXT,                    -- For Aggregate: name of the root entity
    invariants TEXT,                        -- For Aggregate: JSON array of business rules
    ubiquitous_language TEXT,               -- For Bounded Context: JSON array of domain terms
    team_ownership TEXT,                    -- For Bounded Context: team responsible
    event_schema TEXT,                      -- For Domain/Integration Events: JSON schema
    identity_field TEXT,                    -- For Entity: name of the identity field
    attributes TEXT,                        -- For Entity/Value Object: JSON array of attributes
    parent_aggregate TEXT,                  -- For Entity/Value Object: link to parent aggregate
    parent_context TEXT,                    -- For Aggregate: link to bounded context
    operations TEXT,                        -- For Domain Service: JSON array of operations
    managed_aggregate TEXT,                 -- For Repository: which aggregate it manages
    persistence_technology TEXT,            -- For Repository: storage tech
    created_objects TEXT,                   -- For Factory: JSON array of object types it creates
    creation_rules TEXT,                    -- For Factory: JSON array of creation logic
    parameters TEXT,                        -- For Command/Query: JSON schema of parameters
    target_aggregate TEXT,                  -- For Command: which aggregate it targets
    return_type TEXT,                       -- For Query: what data it returns
    use_cases TEXT,                         -- For Application Service: JSON array of use cases
    dependencies TEXT,                      -- For Application Service: JSON array of dependencies
    publishing_context TEXT,                -- For Integration Event: which context publishes
    subscribing_contexts TEXT,              -- For Integration Event: JSON array of subscribers
    from_context TEXT,                      -- For ACL: source context
    to_context TEXT,                        -- For ACL: target context
    translation_rules TEXT,                 -- For ACL: JSON array of translation logic
    saga_steps TEXT,                        -- For Saga: JSON array of process steps
    compensation_logic TEXT,                -- For Saga: JSON array of rollback steps

    is_pivotal INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL, coupling_state_version INTEGER NOT NULL DEFAULT 1, coupling_state_json TEXT, semantic_role TEXT
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
    )),

    FOREIGN KEY (diagram_id) REFERENCES diagrams(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES nodes(id) ON DELETE CASCADE
);

INSERT INTO nodes_new (
    id,
    diagram_id,
    domain,
    type,
    label,
    technology,
    description,
    position_x,
    position_y,
    width,
    height,
    parent_id,
    extent,
    expand_parent,
    icon_id,
    aggregate_root,
    invariants,
    ubiquitous_language,
    team_ownership,
    event_schema,
    identity_field,
    attributes,
    parent_aggregate,
    parent_context,
    operations,
    managed_aggregate,
    persistence_technology,
    created_objects,
    creation_rules,
    parameters,
    target_aggregate,
    return_type,
    use_cases,
    dependencies,
    publishing_context,
    subscribing_contexts,
    from_context,
    to_context,
    translation_rules,
    saga_steps,
    compensation_logic,
    created_at,
    updated_at,
    coupling_state_version,
    coupling_state_json,
    semantic_role
)
SELECT
    id,
    diagram_id,
    domain,
    type,
    label,
    technology,
    description,
    position_x,
    position_y,
    width,
    height,
    parent_id,
    extent,
    expand_parent,
    icon_id,
    aggregate_root,
    invariants,
    ubiquitous_language,
    team_ownership,
    event_schema,
    identity_field,
    attributes,
    parent_aggregate,
    parent_context,
    operations,
    managed_aggregate,
    persistence_technology,
    created_objects,
    creation_rules,
    parameters,
    target_aggregate,
    return_type,
    use_cases,
    dependencies,
    publishing_context,
    subscribing_contexts,
    from_context,
    to_context,
    translation_rules,
    saga_steps,
    compensation_logic,
    created_at,
    updated_at,
    coupling_state_version,
    coupling_state_json,
    semantic_role
FROM nodes;

DROP TABLE nodes;
ALTER TABLE nodes_new RENAME TO nodes;

CREATE INDEX IF NOT EXISTS idx_nodes_diagram_id ON nodes(diagram_id);
CREATE INDEX IF NOT EXISTS idx_nodes_domain ON nodes(domain);
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
CREATE INDEX IF NOT EXISTS idx_nodes_parent_id ON nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_nodes_team_ownership ON nodes(team_ownership);

PRAGMA foreign_keys=ON;
