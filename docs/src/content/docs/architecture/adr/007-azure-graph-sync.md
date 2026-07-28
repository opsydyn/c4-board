---
title: "ADR-007: Azure Resource Graph Sync for Dynamic C4 Infrastructure Diagrams"
---

# ADR-007: Azure Resource Graph Sync for Dynamic C4 Infrastructure Diagrams

**Status**: Accepted
**Date**: 2026-02-12

> **Accepted 2026-07-27.** Status corrected during an audit of the ADR index, which had carried this as Proposed long after it shipped. Seven `azure-sync.*` modules ship and the pipeline was exercised end to end against a live subscription, which is what surfaced the defects behind ADR-017.

**Deciders**: Alan
**Technical Story**: Enable deterministic, repeatable generation of C4 board diagrams from Azure infrastructure inventory while preserving ownership, coupling, and save/runtime guarantees.

## Context

The C4 board now has strong local persistence, structured node/edge metadata, and coupling/ownership modeling. It does not yet have a cloud inventory ingestion path.

Teams want to:

- Generate initial diagrams from real Azure infrastructure.
- Re-sync repeatedly without node/edge duplication.
- Track ownership and topology pressure from cloud metadata (tags, boundaries, relationships).
- Use the board as a living system-of-record for team communication and evolution.

Constraints:

- Existing save/runtime stability (ADR-004, ADR-005) must not regress.
- Sync must be idempotent and transaction-safe.
- Phase 1 should stay read-only against Azure and local-write only to C4 storage.

## Decision

Implement an `azure_sync_v1` pipeline with:

1. Tauri-side Azure query command boundary.
2. Effect-side ingestion and pure mapping modules.
3. Deterministic IDs and diff-based upsert into diagram state.
4. Dry-run preview mode before apply.
5. Ownership/tag mapping that feeds existing coupling/topology analysis.

## Scope

### In Scope (Phase 1)

- Subscription/resource-group scoped import.
- Deterministic node/edge synthesis from Azure Resource Graph inventory.
- Supported resource families:
  - Resource Groups
  - VNets/Subnets
  - App Service / Function App
  - AKS
  - SQL/Cosmos
  - Storage
  - Key Vault
  - Service Bus / Event Hub
- Dry-run diff preview + apply flow.
- Idempotent upsert with archive/soft-delete policy for missing resources.

### Out of Scope (Phase 1)

- Full runtime traffic dependency discovery.
- Multi-cloud abstraction.
- Continuous background sync daemon.
- Automatic destructive deletion without explicit user confirmation.

## Architecture

### Flow

1. User opens "Sync from Azure" panel and selects scope.
2. Frontend calls Effect runtime sync API with `dryRun: true | false`.
3. Effect runtime invokes Tauri command(s) to fetch Azure Resource Graph snapshot.
4. Mapper converts snapshot -> normalized board nodes/edges.
5. Diff engine compares normalized snapshot with current diagram.
6. `dryRun=true`: return plan only.
7. `dryRun=false`: apply transactionally via existing canvas persistence boundary.

### Safety

- All apply operations go through existing serialized write boundary.
- Sync apply runs in a single transaction where feasible.
- Hard cap on apply operations per run (configurable guardrail).
- Rollback on any transactional failure.

## API Contracts

### Frontend / Effect Types

```ts
export interface AzureSyncScope {
  subscriptionIds: string[];
  resourceGroups?: string[];
  tagFilters?: Record<string, string>;
  query?: string; // optional advanced filter
}

export interface AzureResourceSnapshot {
  resourceId: string; // full ARM resource ID
  type: string; // e.g. microsoft.web/sites
  name: string;
  location?: string;
  subscriptionId: string;
  resourceGroup?: string;
  tags: Record<string, string>;
  dependsOn?: string[];
  raw?: unknown; // optional provider payload for debugging
}

export interface AzureRelationshipSnapshot {
  fromResourceId: string;
  toResourceId: string;
  relationshipType: "depends_on" | "network_link" | "data_link" | "identity_link" | "inferred";
  confidence: "high" | "medium" | "low";
}

export interface AzureGraphSnapshot {
  collectedAt: number;
  scope: AzureSyncScope;
  resources: AzureResourceSnapshot[];
  relationships: AzureRelationshipSnapshot[];
}

export interface AzureSyncOptions {
  diagramId: string;
  dryRun: boolean;
  archiveMissing: boolean;
  maxApplyOperations?: number;
}

export interface AzureSyncDelta {
  nodesToCreate: number;
  nodesToUpdate: number;
  nodesToArchive: number;
  edgesToCreate: number;
  edgesToUpdate: number;
  edgesToArchive: number;
}

export interface AzureSyncResult {
  runId: string;
  status: "planned" | "applied" | "aborted" | "failed";
  delta: AzureSyncDelta;
  warnings: string[];
  errors: string[];
}
```

### Tauri Command Contracts

```rust
// src-tauri command boundary
#[tauri::command]
async fn azure_graph_query(scope: AzureSyncScopeDto) -> Result<AzureGraphSnapshotDto, AzureSyncErrorDto>;

#[tauri::command]
async fn azure_graph_validate_auth() -> Result<AzureAuthStatusDto, AzureSyncErrorDto>;
```

Notes:

- `azure_graph_query` remains read-only against Azure.
- Authentication strategy is explicitly surfaced to UI through `azure_graph_validate_auth`.
- DTOs must stay JSON-safe and schema-validated on TS side before mapping.

### Deterministic Mapping Contracts

- Node ID: `azure:${normalizedResourceId}`
- Edge ID: `azure-edge:${hash(from|to|relationshipType)}`
- Provenance metadata in node data:
  - `sourceProvider: "azure"`
  - `sourceResourceId`
  - `sourceResourceType`
  - `lastSyncedAt`
  - `syncVersion`

## File-by-File Implementation Checklist

### New Files

1. `src/core/effects/azure-sync.types.ts`
   - Define sync scope, snapshot, delta, result, and error contracts.
2. `src/core/effects/azure-sync.mapper.ts`
   - Pure resource/relationship -> C4 node/edge mapping.
   - Tag -> ownership mapping helpers.
3. `src/core/effects/azure-sync.diff.ts`
   - Pure diff engine (`existing` vs `mapped`) for create/update/archive plans.
4. `src/core/effects/azure-sync.runtime.ts`
   - Orchestrates query -> map -> diff -> dry-run/apply.
   - Uses existing DB/service boundaries and transaction paths.
5. `src/ui/hooks/useAzureSync.ts`
   - Hook exposing preview/apply actions and sync status.
6. `src/ui/components/AzureSyncPanel.tsx`
   - Scope controls, dry-run preview, apply trigger, status/error display.
7. `src-tauri/src/azure_sync.rs`
   - Tauri command handlers and Azure client bridge.

### Existing Files to Update

1. `src-tauri/src/lib.rs`
   - Register new Azure sync commands in `invoke_handler`.
2. `src/core/effects/canvas-persistence.ts`
   - Add optional sync provenance persistence fields if missing.
3. `src/core/effects/database.c4.ts`
   - Ensure node/edge persistence supports provenance metadata and idempotent upsert fields.
4. `src/core/effects/node-operations.ts`
   - Extend typed node data for provider/source metadata where needed.
5. `src/ui/components/C4CanvasContainer.tsx`
   - Wire Azure sync panel actions and refresh behavior after apply.
6. `src/pages/settings.astro` and/or settings runtime modules
   - Add optional defaults for tag ownership key precedence (if enabled in Phase 1).
7. `docs/src/content/docs/architecture/adr/index.md`
   - Add ADR index entry.

## Phased Delivery Plan

1. Phase A: Contract and command scaffolding.
2. Phase B: Mapper + deterministic IDs + diff engine.
3. Phase C: Dry-run UI and preview.
4. Phase D: Apply path + transaction safety.
5. Phase E: Ownership/coupling integration and calibration.
6. Phase F: Stress tests, rollout gates, flag strategy.

## Testing Strategy

### Unit Tests

- Mapper deterministic ID generation.
- Resource type -> C4 type mapping.
- Tag precedence -> `teamOwnership`.
- Diff correctness across create/update/archive scenarios.

### Integration Tests

- Dry-run preview does not write state.
- Apply writes are idempotent across repeated runs.
- Sync with concurrent autosave does not violate write guarantees.
- Failure during apply rolls back cleanly.

### Scenario Fixtures

- Small RG baseline.
- Multi-team topology with mixed ownership tags.
- High-fanout service mesh subset.
- Sparse metadata case (missing tags/dependsOn).

## Operational Controls and Rollout

- Feature flag: `azure_sync_v1`.
- Rollout stages:
  - Stage 1: internal dry-run only.
  - Stage 2: internal apply.
  - Stage 3: broader availability + expanded resource mappings.
- Guardrails:
  - max apply operations per run
  - explicit confirmation for archive actions
  - visible run summary and failure diagnostics

## Consequences

### Positive

- Fast bootstrap of architecture diagrams from real Azure estate.
- Improved ownership transparency through tag mapping.
- Better coupling/topology signals grounded in actual infra layout.

### Negative

- Additional maintenance for provider mappings and relationship heuristics.
- Azure auth and API behavior introduces operational complexity.

### Neutral

- Existing manual modeling stays valid; sync is additive, not mandatory.

## Alternatives Considered

### Alternative 1: Manual import only (CSV/JSON)

Rejected: lower complexity, but no live cloud coherence and poor repeatability.

### Alternative 2: Sidecar-first implementation

Deferred: may be useful later for advanced auth/client libraries, but Phase 1 can start with direct Tauri command integration and evolve as needed.

### Alternative 3: Full topology inference in Phase 1

Rejected: too high risk/complexity; begin with deterministic inventory + conservative relationships.

## References

- `docs/adr/004-sqlite-pool-architecture.md`
- `docs/adr/005-global-settings-wiring-plan.md`
- `docs/adr/006-balanced-coupling-v2-and-mud-threshold-controls.md`
