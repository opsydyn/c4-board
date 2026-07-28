---
title: "ADR-020: Azure sync apply safety"
---

# ADR-020: Azure sync apply safety

**Status**: Accepted
**Date**: 2026-07-28
**Deciders**: Alan P Currie
**Technical Story**: Azure sync can delete a board. ADR-007 specified the guardrails that would stop it; they were never built.

## Context

### The apply path deletes without asking

Any Azure entity absent from the incoming snapshot is dropped from the merge — [`azure-sync.apply.ts`](/src/core/effects/azure-sync.apply.ts) skips nodes with no mapped counterpart, and edges the same way — and the save that follows issues real `deleteNode` / `deleteEdge` against SQLite through [`canvas-persistence.ts`](/src/core/effects/canvas-persistence.ts).

There is no checkpoint, no confirmation, no cap on operations, and no rollback. Three ordinary situations reach it:

- a typo in the subscription or resource-group field
- a paged-out snapshot — [`azure_sync.rs`](/src-tauri/src/azure_sync.rs) returns partial results plus a warning string when the page guardrail trips, and the diff treats the missing tail as archivable
- a query returning zero resources, which archives the entire Azure subgraph

The diff cannot distinguish any of these from a genuinely emptied subscription. Only the caller can, and the caller does not try.

### The guardrails were documented as though they existed

ADR-007 specifies `AzureSyncOptions.archiveMissing` and `maxApplyOperations`, and names "hard cap on apply operations per run" as a safety property. Both roadmaps repeat them. `grep -rn "archiveMissing\|maxApplyOperations"` returns nothing across `src/`, `src-tauri/`, and `test/`. The same is true of the `azure_sync_v1` feature flag and its three rollout stages.

This is worse than the features being absent. A reader of ADR-007 has been told the board is protected.

### The preview was not telling the truth either

Fixed separately, immediately before this ADR: the two sides of the dry-run fingerprinted different projections, so `unchanged` was always empty and every surviving node reported as an update. Every guard below reads those numbers, which is why that fix landed first.

## Decision

### Retention is the default; deletion is a choice

`archiveMissing` defaults to **off**. A sync that no longer sees a resource leaves it on the board rather than removing it.

This is a deliberate behaviour change. Boards that previously self-pruned will accumulate stale nodes, and that is the trade being made: a stale node is visible, inspectable, and removable by hand, while a deleted one is gone along with any manual edges and layout attached to it. The failure mode we keep is the one an operator can see and undo.

Apply also stops recomputing its own reconciliation. `mergeAzureMappedGraphIntoCanvas` currently receives only the mapped graph and never sees the diff, so what it does is related to the reviewed plan only by coincidence. It takes the diff, and acts on what was reviewed.

### An apply that is too large is blocked, not warned

`maxApplyOperations` caps the total operation count for a run, mirroring the existing `agentPolicy` block in [`settings.types.ts`](/src/core/effects/settings.types.ts) (`maxActionsPerBatch`, `maxNodesCreatedPerRun`) so the two policy surfaces read alike. Exceeding it blocks.

Warnings were the existing design and they do not work: the truncation warning already renders next to an enabled APPLY button.

### An untrustworthy snapshot cannot be applied

Truncation and zero-result are not degraded accuracy — they are indistinguishable from mass deletion. Both block, with an explicit operator override rather than a silent pass.

### Every apply is checkpointed, in its own table

A pre-apply snapshot is mandatory, and restore is the recovery path when a save fails.

The checkpoint does **not** go in `opy_agent_checkpoints`. That table's `session_id` is `NOT NULL` with a foreign key to `opy_chat_sessions`, and an Azure sync has no chat session. Satisfying the FK would mean inventing one — the precise trap that [migration 033](/src-tauri/migrations/033_create_postee_agent_runs.sql) documents avoiding for Postee, on the grounds that a fabricated parent row is a worse lie than a second table. Azure gets its own.

### The board is not replaced before the save succeeds

`handleApplyAzureSync` sends `LOAD_DIAGRAM_SUCCESS` and then requests the save, throwing if it fails — leaving the canvas mutated with nothing persisted and no restore branch. The order inverts, and a failed save restores from the checkpoint.

### Safety before transport

ADR-018 proposes replacing the `az graph query` subprocess with direct Resource Graph REST calls, then retry, then pluggable credentials. That sequence is not wrong, but it is a reliability and reach programme, and this is a data-loss one. ADR-018 stays Proposed and unamended; this ADR takes priority over it and does not touch transport.

## Consequences

### Positive

- A scope typo, a truncated page, and a zero-result query stop being destructive.
- The reviewed plan and the executed plan become the same object.
- Azure gains the checkpoint and restore story the OPY mutation path has had since ADR-008.
- ADR-007's documented guarantees become true rather than aspirational.

### Negative

- Boards accumulate stale Azure nodes until someone opts into archiving. Pruning becomes a deliberate act, which is more work.
- Another policy block in settings, which is more surface to explain.
- A second checkpoint table, with the snapshot and restore logic that implies. Justified above, but it is duplication.

### Neutral

- The feature flag and staged rollout from ADR-007 remain unbuilt. They gate exposure; these guards gate damage, and damage comes first.
- Deleting resources that Azure genuinely removed now needs an explicit archiving run.

## Alternatives Considered

**Confirmation dialog alone.** Cheapest, and it fails the two cases that matter: a truncated snapshot and a zero-result query both produce a confirmation that looks routine. The operator would be agreeing to a number, not to a mistake they can see.

**Archive as soft-delete with a tombstone.** Richer than retention — it would record that Azure stopped reporting a resource. It also needs a lifecycle, a UI for reviewing tombstones, and a migration. Retention gets the safety now; tombstones remain open.

**Reuse `opy_agent_checkpoints` with a synthetic session.** Avoids a table. It also puts rows in a table whose foreign key asserts an OPY chat session existed, which would be false, and would corrupt the OPY audit surfaces that read it. Rejected for the same reason migration 033 rejected it.

**Do ADR-018 Phase 1 first.** Better transport, more reliable syncs — and an unchanged ability to delete a board. Reliability improvements do not help an operator who has already lost their work.

## References

- [ADR-007: Azure Resource Graph Sync](./007-azure-graph-sync.md) — specified `archiveMissing` and `maxApplyOperations`
- [ADR-008: Rig Agent Platform Orchestration](./008-rig-agent-platform-orchestration.md) — the checkpoint and rollback pattern being mirrored
- [ADR-018: Azure Sync Enterprise Readiness](./018-azure-sync-enterprise-readiness.md) — transport, deliberately sequenced after this

## Notes

The point of retention-by-default is that it fails in the direction a person can recover from. Every guard here is a variation on the same question: when this goes wrong, does the operator end up with something to look at, or with nothing?

### Updates

- 2026-07-28: **Accepted.** The dry-run fingerprint fix landed first, since every guard here reads the numbers it produces.
