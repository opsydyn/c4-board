---
title: "ADR-018: Azure sync enterprise readiness"
---

# ADR-018: Azure sync enterprise readiness

**Status**: Proposed
**Date**: 2026-07-26

## Context

Azure sync works for one engineer against one subscription they are already logged into. It was audited against what a platform team at enterprise scale would need, and the gap is structural rather than a list of missing features.

The audit findings, each verified against the code or a live tenant rather than assumed:

### Authentication is Azure CLI only

`azure_graph_validate_auth` opens with `let strategy = "azure-cli".to_string()` and that is the entire strategy set. There is no service principal, managed identity, workload identity or device code path.

The consequences compound: the sync cannot run in CI, cannot run headless, cannot use a shared service account, and silently inherits whichever human identity happens to be logged into `az`. Two engineers syncing the same board can produce different results because they can see different resources.

### The CLI is both the credential source and the transport

`az graph query` performs authentication, query execution and pagination as one opaque step. Every limitation below follows from that coupling — we cannot control retry behaviour, cannot choose a credential, and inherit the CLI's extension requirement.

### No throttling or retry

The only match for `retry|429|backoff` in `azure_sync.rs` is the string *"Run `az login` and retry"*. Azure Resource Graph enforces per-tenant and per-user quotas and returns `429` with a `Retry-After` header. A tenant large enough to matter will hit that, and the sync fails outright.

### Tag filters are applied client-side

The tag filter is a predicate evaluated per resource *after* the fetch, not a `where` clause in the KQL. Filtering to one team's resources still pulls the entire estate first — at enterprise scale the difference between a 200-row query and a 500,000-row one.

### Subscription scope only

No reference to management groups anywhere in the codebase. Enterprises organise hundreds of subscriptions under a management group hierarchy; this requires pasting subscription GUIDs individually.

### Partial authorization is unhandled

Enterprise tenants routinely grant partial access. Probing this tenant returned:

```
ERROR: (AuthorizationFailed) The client ... does not have authorization to perform
action 'Microsoft.Management/managementGroups/read' over scope '/providers/Microsoft.Management'
```

There is no handling for a scope that is partly readable — the expected enterprise case, where a sync should return what it can and say what it could not.

### What is already sound

Worth preserving through any change: KQL string escaping (injection is handled), skip-token pagination with an explicit truncation warning rather than silent loss, relationship dedup with confidence and source ranking, and the generic `_ref_<label>` mechanism where adding a relationship is one projected column plus one label.

## Decision

**Separate authentication from transport.** That single change unblocks four of the six findings, because each is currently a property of `az graph query` being a black box.

Call the Resource Graph REST API directly with a bearer token obtained from a pluggable credential. Proven against the live tenant before proposing it:

```
POST https://management.azure.com/providers/Microsoft.ResourceGraph/resources?api-version=2022-10-01
→ http=200, totalRecords: 5, resultTruncated: false
```

`reqwest` is already a dependency, so this adds no new HTTP stack.

### Phase 1 — Transport

Replace `az graph query` with a direct POST. Token continues to come from the CLI via `az account get-access-token --resource https://management.azure.com`, so **authentication behaviour is unchanged in this phase** and the change is verifiable in isolation.

Gains immediately:

- `totalRecords` and `resultTruncated` come back from the API, a better truncation signal than inferring from a skip token.
- **The `resource-graph` CLI extension is no longer required.** The REST endpoint is part of the base ARM surface.

### Phase 2 — Retry

Own the retry loop, which is only possible once we own the transport. Honour `Retry-After` on `429` and `503`, capped exponential backoff with jitter, bounded attempts, and surface exhaustion as a typed error rather than a string.

### Phase 3 — Credentials

Introduce an `AzureCredential` abstraction that yields a bearer token, with strategies resolved in order:

1. Service principal from environment (client id, tenant id, secret or certificate)
2. Managed identity (IMDS)
3. Workload identity (federated token file)
4. Azure CLI (current behaviour, and the default for desktop use)

Bound by [ADR-012](012-opy-in-postee.md): secret values never leave the process, are never returned across the Tauri boundary, never logged, and never included in an error message. The auth status DTO reports *which strategy* resolved and whether it succeeded — never the material.

### Phase 4 — Server-side filtering

Push tag and type filters into the KQL `where` clause. Verified to work over REST:

```kql
Resources | where tags['env'] =~ 'prod' | project name, type
```

Client-side filtering stays as a defence-in-depth net, not the mechanism.

### Phase 5 — Scope and partial authorization

Add management group scope via the `managementGroups` field of the request body, and treat `AuthorizationFailed` on part of a scope as a partial result plus a warning rather than a failed sync.

### Phase 6 — Relationship coverage

Continue [ADR-017](017-azure-resource-type-mapping.md)'s work: private endpoints, diagnostic settings to workspace, RBAC assignments, VNet integration. Each is one projected `_ref_` column and one label.

## Consequences

### Positive

- The sync becomes runnable by a service account, in CI, and headless.
- Retry and filtering become ours to tune rather than the CLI's to decide.
- Dropping the CLI extension requirement removes the single most confusing failure mode in the product: auth reports healthy, then the query fails with `'graph' is misspelled`.

### Negative

- **Handling client secrets is a new responsibility.** Today the app holds no Azure credential at all; after Phase 3 it can. That is a genuine increase in blast radius and the reason ADR-012's constraints are binding here rather than advisory.
- Token acquisition, expiry and refresh become ours. The CLI was doing that.
- Phase 1 changes the failure surface: HTTP status codes rather than CLI exit codes, so error mapping and its tests are rewritten.
- The Azure sync guide and README both instruct users to install the `resource-graph` extension. Both must change when Phase 1 lands, and the instruction should not be removed before it, or the docs describe a version nobody is running.

### Neutral

- The mapping layer (`azure-sync.mapper.ts`) is untouched — this is entirely a transport and credential change.

## Alternatives considered

**Add the Azure SDK for Rust (`azure_identity`, `azure_mgmt_resourcegraph`).** Rejected for now: it brings a large dependency surface for one endpoint, and `reqwest` plus a token is a few hundred lines. Reconsider if we take on more Azure APIs, where the credential chain would start paying for itself.

**Keep shelling out to `az` and shell an SP login.** Rejected: `az login --service-principal` writes credentials into the CLI's own token cache on disk, outside our control and outside ADR-012's guarantees. It also keeps the CLI as a hard runtime dependency.

**Do only the cheap fixes (retry, filter pushdown) and keep CLI transport.** Rejected as the primary plan because retry cannot be implemented over an opaque subprocess — `az` has already swallowed the 429. The coupling is the problem, so removing it comes first.

**Ship management group scope early.** Deferred to Phase 5: it cannot be verified on the tenant available here (no `Microsoft.Management/managementGroups/read`), and shipping unverifiable scope handling ahead of the credential work would mean guessing at the shape of partial-authorization failures.

## Unverified

Stated explicitly so later readers do not mistake these for tested claims:

- Management group scope is documented in the ARG API but **untested here** — no access on the available tenant.
- Throttling behaviour is inferred from Azure's documented quotas; this estate is far too small to trigger `429`.
- Managed identity and workload identity paths cannot be exercised on a developer workstation and will need a deployed environment to prove.

## References

- [ADR-007: Azure graph sync](007-azure-graph-sync.md)
- [ADR-012: OPY in Postee](012-opy-in-postee.md) — credential handling constraints
- [ADR-017: Azure resource type mapping](017-azure-resource-type-mapping.md)
- [Azure sync guide](../guides/azure-sync.md)
