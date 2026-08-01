---
title: "ADR-017: Azure resource type mapping and relationship projection"
---

# ADR-017: Azure resource type mapping and relationship projection

**Status**: Accepted
**Date**: 2026-07-26

## Context

Azure sync was exercised end-to-end against a real subscription for the first time. The CLI path works — `az graph query` returned 20 resources — but what the board receives is close to useless:

```
nodes: 29   (20 resources + 9 resource-group containers)
by C4 type: { system: 20, container: 9 }
edges: 0
```

Two independent defects produce that.

### Every resource becomes a system

`inferC4Type` in `src/core/effects/azure-sync.mapper.ts` tests four patterns — `microsoft.network/virtualnetworks`, `microsoft.compute/virtualmachines`, `microsoft.web/sites`, `microsoft.containerservice/managedclusters` — and falls through to `system`.

None of the four matched anything in the estate. All nine distinct Azure types collapsed to `system`, so the board renders 20 identical boxes. Worth noting `microsoft.web/staticsites` does not contain the substring `microsoft.web/sites`, so even a near-match misses; substring tests over type strings are the wrong shape for this.

The intended mapping was already written down in `guides/azure-graph-sample-data.md` under "Next Steps" and never implemented. (That guide has since been rewritten around this decision, so the table now lives here rather than there.)

### No edges, on an estate that has relationships

No `_ref_*` column was populated, no `dependsOn`, no ARM parent-child pairs. That is not because the estate is flat:

```
planetnik-runtime -> envId set: True | managedEnvId set: True
planetnik-app     -> envId set: True | managedEnvId set: True
```

Container Apps reference their managed environment through `properties.environmentId`, which the KQL projection in `src-tauri/src/azure_sync.rs` does not select. The relationship exists in Azure and is discarded before it reaches the app. A container registry reference has the same problem.

The consequence is a board of disconnected nodes, which is worse than no import — it looks like an answer.

## Decision

### 1. Replace substring tests with three ordered tiers

`az provider list` reports **4,654 distinct resource types across 316 registered providers**. A hand-maintained exact table covering 19 of them is 0.4% of the catalogue, so an exact table cannot be the primary mechanism — it can only be the override layer.

Inference is therefore three tiers, most specific first:

1. **Exact type** — `microsoft.web/staticsites` → `externalSystem`. Overrides everything below.
2. **Provider namespace** — anything under `microsoft.keyvault`, `microsoft.sql`, `microsoft.cache` is a store whatever its leaf name is. ~25 entries here cover whole product families, including child types (`microsoft.sql/servers/databases` stays a `container`).
3. **Shape** — for providers nothing has an opinion on: a nested type (`provider/type/child`) is a `component`, a top-level type is a `system`.

Exact keys, not substring tests. The previous implementation asked whether the type *contained* `microsoft.web/sites`, which is false for `microsoft.web/staticsites` — a near match that silently produced the wrong answer rather than no answer.

### 2. Project the missing relationship columns

Add to the KQL projection:

- `_ref_environmentId = coalesce(properties.environmentId, properties.managedEnvironmentId)`
- `_ref_registryId` for container registry references

The `_ref_<label>` mechanism is already generic — `PROPERTY_REF_PREFIX` strips the prefix and any label is consumed — so this is a projection change plus a label entry in `relationship_type_for_property_ref`. Unknown labels already degrade to `("inferred", "medium")` rather than failing, so the risk of adding columns is low.

Measured against the same subscription after the change:

```
resources: 20
resources that now yield an edge: 2
   planetnik-app     -> planetnik-env
   planetnik-runtime -> planetnik-env
```

`_ref_environmentId` does what it was added for. `_ref_registryId` is **retained but unverified**: it fired on nothing in this estate, because a Container App holds its registries under `properties.configuration.registries[]` — an array of login-server hostnames, not a resource id, so it cannot yield a resource-to-resource edge in this form. It is kept because it is the documented property for other types (AKS in particular) and costs one projected column. Resolving Container App to registry needs a hostname-to-registry match, which is out of scope here. **Resolved 2026-08-01 by [ADR-018](018-azure-sync-enterprise-readiness.md) Phase 6**, which adds an alias mechanism for exactly this: the app's login-server hostname is matched against the registry's own `loginServer`, so the edge now exists.

### 3. Keep the fallback honest

An unrecognised type still maps to something rather than being dropped. The heuristic is documented in the guide so a reader can predict what an unmapped resource will look like.

## Consequences

Measured over the same 20-resource subscription:

```
BEFORE: { container: 9,  system: 20 }
AFTER : { container: 21, component: 4, externalSystem: 3, system: 1 }
```

Same 29 nodes; four distinct C4 types instead of one plus the resource-group grouping.

### Positive

- A synced board distinguishes platforms, hosts, data stores and external services instead of rendering one shape.
- Namespace coverage means a type nobody has hand-mapped still lands sensibly, so the table stops being a bottleneck on new Azure services.
- Container Apps connect to their environment, so the first real import produces a graph rather than a scatter.
- The lookup table is data, so adding a type is a one-line change with a test, not new branching.

### Negative

- **This changes how every previously synced board renders.** Nodes imported before this ADR carry a persisted `type`; re-syncing will reclassify them. Existing boards are not migrated — the change applies on next sync.
- The table will drift behind Azure's type catalogue. That is accepted: the heuristic fallback keeps unmapped types usable.

### Neutral

- Edge counts will rise on estates using Container Apps, which changes auto-layout output for those boards.

## Alternatives considered

**Leave inference alone and let users retype nodes by hand.** Rejected: the import's value is that it reflects reality, and 20 identical boxes is not a starting point anyone would keep.

**Infer C4 type from resource-graph metadata (`kind`, SKU) instead of a table.** Rejected for now: it is less predictable, and the failure mode is a plausible-looking wrong classification rather than an obvious unmapped one.

**Derive edges from `dependsOn` only.** Rejected: `dependsOn` was empty across the whole estate. It reflects ARM deployment authoring, not runtime topology.

## References

- Row shape and edge-discovery columns: [Azure Resource Graph reference](../guides/azure-graph-sample-data.md)
- Usage: `guides/azure-sync.md`
- [ADR-007: Azure graph sync](007-azure-graph-sync.md)
