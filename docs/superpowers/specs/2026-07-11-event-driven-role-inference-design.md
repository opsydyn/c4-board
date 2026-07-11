# Event-Driven Role Inference Design

**Date:** 2026-07-11  
**Status:** Approved for planning

## Objective

Classify nodes in an Event-Driven architecture as publishers, event buses,
processors, subscribers, infrastructure, external dependencies, or
unclassified. The result must be deterministic, explainable, schema validated,
and compatible with the semantic review and correction workflow already used by
the Hexagonal layout.

This slice establishes classification only. Dedicated Event-Driven lane geometry
and native visual baselines belong to the following slice.

## Architecture

Add `inferEventDrivenRoles(nodes, edges)` beside `inferHexagonalRoles` in the
existing architecture role-classification module. It returns the shared
`ArchitectureRoleClassification` contract with `pattern: "event-driven"`.

Classification uses an ordered evidence cascade:

1. A valid explicit `data.layoutRole` wins with confidence `1`.
2. Event-specific labels and node types provide direct semantic evidence.
3. Directed topology distinguishes flow roles when labels are incomplete.
4. Nodes without sufficient evidence become `unclassified`.

The classifier sorts nodes by ID before inference and uses stable tie-breaking so
node and edge input order cannot affect assignments or diagnostics.

## Role Semantics

### Event Bus

Broker, bus, queue, topic, and stream labels identify an `event-bus`. Strong
fan-in and fan-out may support bus inference when labels are incomplete, but
topology alone must not override direct contradictory evidence.

### Publisher

A `publisher` emits events toward an event bus and does not primarily consume
events from one. Publisher, producer, and event-source labels are direct
evidence.

### Processor

A `processor` consumes from an event bus and emits a subsequent event or command.
Processor, transformer, projector, handler, and workflow labels support this role
when topology confirms onward output.

### Subscriber

A `subscriber` consumes from an event bus as a terminal handler and does not
publish onward. Subscriber, consumer, listener, and sink labels support this role
when topology shows no onward event flow.

The processor/subscriber distinction is therefore semantic and topology-aware:
processors continue the flow; subscribers terminate it.

### Supporting Roles

Database, cache, telemetry, logging, and operational-service evidence identifies
`infrastructure`. External-system evidence identifies `external-dependency` when
the node does not participate directly in the event flow. Insufficient evidence
produces `unclassified` rather than a speculative assignment.

## Diagnostics

A valid Event-Driven explicit role remains authoritative. An explicit role from
another architecture pattern produces the existing
`semantic-role-pattern-mismatch` warning and falls through to normal inference.

Assignments below the shared `0.65` confidence threshold produce the existing
`semantic-role-ambiguous` warning. Every assignment contains concise evidence
that explains the winning rule. The classifier introduces no new diagnostic
schema in this slice.

## Data Flow

1. Build directed inbound and outbound adjacency for all known nodes.
2. Identify event-bus candidates from explicit roles and direct semantic evidence.
3. Classify each sorted node through the evidence cascade using its relationship
   to identified buses and its onward outputs.
4. Build mismatch and ambiguity diagnostics in stable node order.
5. Decode the complete result through `ArchitectureRoleClassificationSchema`.

No board state is mutated. Persistence and correction controls continue to use
the shared `data.layoutRole` field and pattern-valid role schema.

## Testing

Use test-driven development with a representative Event-Driven graph containing
publishers, one bus, a continuing processor, terminal subscribers,
infrastructure, and an external dependency.

Coverage must prove:

- grounded classification of every representative role;
- the semantic processor/subscriber topology distinction;
- explicit valid roles override inference;
- cross-pattern explicit roles produce mismatch diagnostics;
- weak evidence produces unclassified and ambiguity diagnostics;
- reversing node and edge input order returns an identical result;
- the result decodes through the shared classification schema.

## Non-Goals

- Event-Driven lane placement or edge routing;
- changes to the layout preview UI;
- OPY/Rig architecture-pattern classification;
- weighted probabilistic scoring or model-based inference;
- new persistence columns or migrations.
