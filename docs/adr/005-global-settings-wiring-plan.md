# ADR-005: Global Settings Architecture and Wiring Plan

**Status**: Proposed
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
- Audio: `masterAudioEnabled`, `saveChimeEnabled`, `sirenEnabledDefault`, `masterVolume`
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
