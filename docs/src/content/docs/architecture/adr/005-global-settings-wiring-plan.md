---
title: "ADR-005: Global Settings Architecture and Wiring Plan"
---

# ADR-005: Global Settings Architecture and Wiring Plan

**Status**: Accepted
**Date**: 2026-02-09
**Deciders**: Alan
**Technical Story**: Wire the new global Settings UI scaffold to reliable runtime behavior without regressing save performance, state sync, or navigation UX.

## Context

The Settings view now exists as presentation-only scaffolding (`/settings`), with sidebar entry points from both C4 and Postee workspaces.

Recent incidents showed systemic issues that this wiring must not reintroduce:

- Save failures under contention (`SQLITE_BUSY`, code 5)
- Unsynced save timestamps and stale UI status
- State regression after cross-workspace navigation
- Fragile audio/animation toggles not consistently applied

The architecture already uses Effect and XState, and ADR-004 established a single-connection runtime SQLite pool. The remaining gap is an end-to-end settings model that is typed, persisted, concurrency-safe, and globally applied.

## Decision

Implement Settings as a first-class domain with a phased, low-risk rollout:

1. Typed settings contract and defaults in the Effect layer.
2. Persisted settings in SQLite with explicit migrations.
3. Settings repository APIs (`get`, `patch`, `reset`) with schema validation.
4. Strict write serialization and bounded retry policy for DB writes.
5. Boot-time readiness gating so UI only consumes initialized settings.
6. Global settings state machine + hook for reactive UI consumption.
7. Incremental feature wiring into C4, Postee, and navigation/audio behavior.
8. Verification matrix and staged rollout controls.

## Architecture

### Domain Model

Create `AppSettings` with explicit keys and defaults, including:

- Experience: `animationsEnabled`, `transitionIntensity`
- Audio: `masterAudioEnabled`, `saveVolEnabled`, `sirenEnabledDefault`, `masterVolume`
- Save and sync: `autosaveEnabled`, `autosaveIntervalMs`, `saveOnNavigate`
- Privacy/security: `telemetryEnabled`, `redactionMode`
- Data lifecycle: `historyRetentionDays`

The schema is the source of truth for both storage and UI binding.

### Persistence Model

Add an `app_settings` table keyed by setting name with:

- `key` (primary key)
- `value` (serialized JSON/text)
- `updated_at` (UTC epoch or ISO string)

Use migration-backed creation and idempotent upsert semantics.

### Runtime Concurrency and Readiness

- Use `Effect.Semaphore(1)` to serialize all write critical sections that touch settings and diagram persistence.
- Keep bounded retry for transient lock failures; no unbounded loops.
- Use `Effect.makeLatch(false)` during startup; open only after DB + settings hydration completes so consumers do not render unsynced placeholders.
- Ensure finalizers release permits and clear transient save/sync flags on failure paths.

### State and UI Integration

- Introduce `settings.machine.ts` with states: `booting`, `ready`, `saving`, `error`.
- Expose `useSettings()` for all workspace consumers.
- Use optimistic updates with rollback on failed persistence.
- Render save/status timestamps only from committed write results.

## Implementation Plan

### Phase 1: Contract and Storage

1. Add `settings.types.ts` schema and defaults.
2. Add migration for `app_settings`.
3. Implement repository APIs in `settings.runtime.ts`.

### Phase 2: Runtime Guarantees

1. Introduce semaphore-guarded write boundary shared by settings/save paths.
2. Add bounded retry classification for lock errors.
3. Add boot latch and load ordering.

### Phase 3: Settings Page Wiring

1. Replace placeholder cards with real controls bound to `useSettings()`.
2. Add save status indicators (`SAVING`, `SAVED`, `ERROR`) based on committed state.
3. Add reset/export/import placeholders behind confirmation dialogs (UI first, destructive actions gated).

### Phase 4: Cross-Workspace Adoption

1. C4: autosave cadence, save-on-nav, save sound controls.
2. Postee: siren default, animation toggle behavior.
3. Navigation overlays: animation and timing behavior from global settings.

### Phase 5: Verification and Rollout

1. Add unit tests for schema, repository, machine transitions.
2. Add integration tests for C4 <-> Postee navigation and persistence coherence.
3. Add stress tests for rapid edits + autosave with lock contention simulation.
4. Roll out behind `settings_v1` feature flag with failure/latency telemetry.

### Phase 6: Flag Sunsetting and Cleanup

1. Exit criteria for sunsetting:
   - `settings_v1` enabled in all target environments for at least one stable release window.
   - No P1/P2 incidents attributed to settings runtime, save sync, or settings-driven navigation behavior during that window.
   - Settings load/write telemetry remains within acceptable failure and latency thresholds.
2. Remove rollout branching:
   - Delete `feature-flags.ts` and all `settingsV1Enabled` conditional branches.
   - Make settings runtime always-on in `useAppSettings`, settings machine wiring, and telemetry emission paths.
3. Remove operational flag surface:
   - Remove `PUBLIC_SETTINGS_V1`, `VITE_SETTINGS_V1`, and `SETTINGS_V1` from environment docs and runtime usage.
   - Remove disabled-state UI copy that references `settings_v1` rollout mode.
4. Verification gate before merge:
   - Full test suite green.
   - Manual C4/Postee/settings walkthrough confirms parity with pre-sunset behavior.
   - ADR updated with completion date and links to cleanup PRs.

## Consequences

### Positive

- Global controls become deterministic and persistent.
- Settings behavior is consistent across C4 and Postee.
- Save and sync UI can truthfully reflect committed state.
- Concurrency policy is explicit and auditable.

### Negative

- Additional domain and machine complexity.
- More migrations and compatibility surface to maintain.
- Requires disciplined boundaries so settings logic does not leak into view components.

### Neutral

- Existing UI scaffold remains usable during phased wiring.
- Rollout can proceed incrementally without blocking unrelated feature work.

## Alternatives Considered

### Alternative 1: Keep settings client-only in local state

Rejected due to cross-workspace inconsistency and no durable source of truth.

### Alternative 2: Write settings directly from components

Rejected due to duplicated logic, race-prone side effects, and weak testability.

### Alternative 3: Defer readiness gating

Rejected due to observed unsynced timestamp/state behavior during startup and navigation.

## Acceptance Criteria

- Settings persist across app restarts and workspace switches.
- C4/Postee behaviors reflect settings immediately and consistently.
- No regressions to save success rate under rapid edit/autosave load.
- Save timestamp/status reflects committed DB state, not local optimistic time.
- Audio/animation toggles are globally respected and user-controllable.

## Implementation Notes (2026-02-09)

- `settings_v1` rollout gate added with env-based control (`PUBLIC_SETTINGS_V1`, `VITE_SETTINGS_V1`, `SETTINGS_V1`).
- Settings telemetry events now emit load/write success and failure metrics (latency + error context) when diagnostics sharing is enabled.
- Phase 5 tests added:
  - Schema/unit coverage for `AppSettings` contract.
  - Repository coverage for `get/patch/reset` and validation behavior.
  - Runtime contention coverage for retry (`SQLITE_BUSY`) and semaphore serialization.
- Settings page orchestration moved from `useEffect` coordination to `settings.machine.ts` (XState), including boot/loading, queued writes, optimistic updates, and recovery reload paths.
- Machine transitions are modularized with `createStateConfig` slices (Stately modular state pattern), and actor outputs/errors are schema-decoded via Effect `Schema` before state updates.

## Rollout Resume Addendum (2026-02-12)

This addendum resumes the full settings rollout and adds a dedicated DB runtime status sub-plan.
Scope is documentation and planning only.

### Current Baseline

1. Settings domain contract, persistence, and runtime locking model are in place.
2. Settings page uses XState orchestration with optimistic writes and queued persistence.
3. Static "Database Runtime: Single connection + WAL" copy exists in Settings but is not yet a live runtime probe.

### Updated Remaining Plan

#### Phase R1: Stabilization and Read-Model Hardening

1. Freeze current settings behavior and remove known UI ambiguity between optimistic state and committed state labels.
2. Standardize status vocabulary for settings saves and runtime health (`LOADING`, `SAVING`, `SYNCED`, `ERROR`, `DEGRADED`).
3. Confirm all settings controls report queue depth and failure states consistently.

#### Phase R2: DB Runtime Status Sub-Plan (New)

Objective: replace static runtime copy with observable, trustworthy runtime health.

1. Define runtime status contract.
   - Output model: `status`, `pendingWrites`, `lockRetries`, `lastSuccessAt`, `lastFailureAt`, `lastErrorMessage`, `journalMode`, `maxConnections`.
   - Error model: typed Effect `Schema` validation for all runtime status payloads.
2. Add runtime event instrumentation in database runtime boundary.
   - Capture read/write operation start, completion, retry, and failure.
   - Include retry classification (busy/locked/non-retryable) and operation duration.
3. Build frontend runtime read model stream.
   - Stream source from runtime events folded into a single diagnostics snapshot.
   - Keep orchestration ownership in XState; keep diagnostics/read-model ownership in atom stream state.
4. Surface runtime health in Settings.
   - Replace static "ONLINE" with derived status chip.
   - Show queue depth, last successful operation time, and degraded lock-pressure indication.
5. Add backend truth probe (optional hardening path).
   - Add command-backed snapshot for `PRAGMA journal_mode` and pool metadata.
   - Use as bootstrap verification and recovery fallback for the frontend stream.
6. Add operational telemetry and alert thresholds.
   - Emit lock retry bursts and sustained degraded periods.
   - Define warning thresholds for investigation.

#### Phase R3: Cross-Workspace Final Wiring

1. Ensure C4 and Postee consume the same resolved settings state and runtime diagnostics semantics.
2. Validate save-on-navigate, autosave cadence, and audio defaults against committed settings values.
3. Align settings-driven behavior for navigation overlays and load transitions in both directions.

#### Phase R4: Verification Matrix and Rollout Gates

1. Unit tests for runtime status model decode/encode and status derivation rules.
2. Integration tests for rapid-toggle settings writes while autosave and navigation are active.
3. Contention tests with forced lock/retry paths verifying transition to `DEGRADED` and recovery to `ONLINE`.
4. Manual validation checklist across C4, Postee, and Settings pages with persisted restart verification.

#### Phase R5: Flag Sunsetting Completion

1. Remove `settings_v1` branch paths after stability window criteria are met.
2. Remove feature-flag environment surface and disabled-state UX copy.
3. Keep runtime status diagnostics always-on and production-safe.

### Sequencing and Dependencies

1. Complete R1 before R2 to avoid reworking status semantics.
2. Complete R2 before final R3 integration so workspaces consume one runtime status model.
3. Complete R4 before R5 to avoid sunsetting with blind spots.

### Exit Criteria for Addendum

1. Settings runtime card reports live DB runtime state, not static placeholders.
2. Lock contention is visible in UI and telemetry with clear degraded/recovered transitions.
3. Save state labels and timestamps reflect committed state only.
4. C4/Postee/settings behaviors remain consistent across navigation and restart.
