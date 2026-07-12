# Client-Server Semantic Layout Design

**Date:** 2026-07-12
**Status:** Approved

## Goal

Replace the generic Dagre Client-Server preset with deterministic semantic inference and visibly distinct Client-Server geometry.

The primary architecture path is:

```text
client -> service/API -> domain -> persistence
```

Missing tiers remain empty and produce diagnostics. The classifier must not invent a domain or persistence role merely to fill a column.

## Scope

This slice includes:

- schema-validated Client-Server role inference;
- dedicated deterministic Client-Server geometry;
- strategy registry and preset routing;
- standard semantic evidence and layout diagnostics;
- reuse of preview role correction, Apply, persistence, cancellation, and audit boundaries; and
- focused classification, geometry, hierarchy, determinism, and registry tests.

This slice does not add OPY/Rig tools, new preview UI state, native visual baselines, ELK routing, selected-compound extraction, or a new persistence schema.

## Role Inference

Add `inferClientServerRoles` beside the existing Hexagonal and Event-Driven classifiers. Every assignment uses the shared `ArchitectureRoleClassificationSchema` and the existing Client-Server vocabulary:

- `client`;
- `service`;
- `domain`;
- `persistence`;
- `external-dependency`; and
- `unclassified`.

Evidence precedence is deterministic:

1. valid explicit `data.layoutRole`;
2. grounded C4 or DDD node type;
3. token-aware label evidence;
4. graph topology; and
5. `unclassified` fallback.

`externalSystem` is deliberately a generic fallback type: client-identifying label evidence is evaluated before assigning `external-dependency`, so a browser or partner portal represented as an external system can still be a grounded client.

Cross-pattern explicit roles do not become Client-Server assignments. They produce the existing pattern-mismatch diagnostic and classification continues through grounded evidence.

### Client

Use `client` for:

- `person` nodes;
- labels identifying browser, web client, mobile client, desktop client, frontend, UI, or consumer-facing application; and
- otherwise ambiguous top-level nodes with grounded outbound request edges into an identified service and no stronger evidence for another role.

### Service/API

Use `service` for:

- API, server, gateway, controller, endpoint, backend, or application-service labels;
- DDD `applicationService`, `command`, and `query` nodes; and
- service-like C4 nodes that receive grounded requests from clients or coordinate calls into domain/persistence nodes.

### Domain

Use `domain` for:

- DDD `aggregate`, `domainService`, `entity`, and `valueObject` nodes;
- labels identifying domain, business rules, policy, or core business logic; and
- topology only when a node is between an identified service and persistence node with no stronger role evidence.

The topology fallback must be reported at lower confidence than explicit type or label evidence.

### Persistence

Use `persistence` for:

- DDD `repository` nodes;
- database, datastore, storage, repository, cache, or persistence labels; and
- grounded downstream data dependencies from service/domain nodes when no stronger conflicting evidence exists.

### External Dependencies

Use `external-dependency` for remaining `externalSystem` nodes and labels identifying third-party providers or remote dependencies that are not clients.

An external system with an explicit valid Client-Server role remains authoritative. External systems with grounded browser/client labels may classify as clients before the external-dependency fallback.

### Unclassified

Use `unclassified` when no grounded evidence reaches the shared confidence threshold. Preserve the existing ambiguity diagnostic and evidence contract.

## Geometry

Create a synchronous custom `client-server` strategy. Top-level nodes occupy four dimension-aware left-to-right columns:

1. client;
2. service/API;
3. domain; and
4. persistence.

Column separation derives from the maximum reserved node width plus `nodeSpacing` and `rankSpacing`. Nodes stack vertically within each column in stable ID order using reserved dimensions and grid-safe spacing. Normalize top-level coordinates into a positive canvas region and retain configured grid snapping.

Child nodes keep their existing parent-relative coordinates. Edges crossing hierarchy boundaries remain excluded from semantic placement and produce the established hierarchy diagnostics.

## Support and Review Lanes

External dependencies occupy a lower support lane. Each external dependency aligns beneath the service or domain column of its deterministic primary caller:

1. prefer callers with a `service` role;
2. then callers with a `domain` role;
3. break ties by stable node ID.

Multiple callers across service/domain tiers produce an affinity diagnostic naming the chosen caller and alternatives. External dependencies without a service/domain caller use the support lane's service-column anchor and produce an orphan diagnostic.

Unclassified nodes occupy a separate review lane beneath the support lane. Support and review stacks must remain clear of the primary columns and each other.

## Diagnostics

Return shared semantic mismatch and ambiguity diagnostics plus Client-Server-specific diagnostics for:

- role-count summary;
- missing client, service, domain, or persistence tiers;
- multiple external caller affinities;
- orphan external dependencies;
- unclassified nodes;
- missing top-level nodes;
- recovered invalid geometry input; and
- preserved hierarchy and excluded hierarchy-crossing edges.

Missing-tier diagnostics are warnings for client, service, and domain. Persistence absence is informational because valid Client-Server diagrams may delegate storage entirely to external systems.

## Integration

Register the strategy as `client-server` in the synchronous strategy registry and add `strategyId: "client-server"` to the existing `clientServer` preset.

Return semantic assignments through `LayoutResult.semanticRoles`. The existing preview drawer will then provide evidence, confidence, contradiction highlighting, pattern-valid role correction, Infer automatically, non-destructive recomputation, Apply persistence, and audit history without a Client-Server-specific UI path.

The older `client-server` visual fixture may remain on ELK until the follow-up native-baseline slice replaces it with representative inferred and corrected custom-strategy fixtures.

## Failure Behavior

Invalid numeric geometry inputs recover to existing default node dimensions and spacing, emit a warning, and still return deterministic output. Empty top-level input returns the unchanged graph with an error diagnostic.

The strategy never mutates input nodes or edges. Input ordering must not affect assignments, coordinates, diagnostics, or quality metrics.

## Testing

Classification coverage:

- representative four-tier graph with grounded evidence;
- valid explicit-role precedence;
- contradictory explicit-role fallback and diagnostics;
- missing-domain graph without invented assignments;
- topology fallback confidence;
- ambiguous and unclassified nodes; and
- input-order invariance.

Geometry coverage:

- client, service, domain, and persistence column ordering;
- empty-tier preservation and diagnostics;
- caller-affined external support placement;
- deterministic multiple-caller and orphan handling;
- separate unclassified review placement;
- zero overlaps on representative and dense-column fixtures;
- invalid-dimension recovery;
- child-coordinate preservation and hierarchy diagnostics;
- input-order determinism; and
- strategy registry and preset routing without Dagre fallback.

## Acceptance Criteria

1. Client-Server no longer routes through generic Dagre.
2. Representative Client-Server graphs produce stable four-tier semantic assignments with evidence and confidence.
3. Geometry is visibly distinct, left-to-right, dimension-aware, grid-safe, and overlap-free for supported fixtures.
4. Missing tiers remain empty and are explained through diagnostics.
5. External dependencies occupy the lower caller-affined support lane; unclassified nodes occupy a separate review lane.
6. Existing role correction, Apply, persistence, cancellation, undo, and audit behavior remains unchanged.
7. Classification and geometry are deterministic across input order.
8. Existing Hexagonal, Event-Driven, ELK, radial, and Dagre tests remain green.
