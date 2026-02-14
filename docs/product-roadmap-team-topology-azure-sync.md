# Product Roadmap: Team Topologies + Azure Sync

**Last Updated**: 2026-02-14
**Owner**: Product + Platform Engineering
**Scope Horizon**: 2026-Q1 to 2026-Q2

## 1) Goals

1. Make the C4 board a trusted system-of-record for architecture and ownership.
2. Complete Azure sync from "good dry-run/apply" to "enterprise-safe and scalable".
3. Expose critical local runtime diagnostics in Settings, including SQLite DB size.

## 2) Current Baseline (as of 2026-02-14)

1. Team topology scoring model (Balanced Coupling V2) is implemented and active.
2. Node-level coupling scoring controls (`auto/hybrid/manual`) are implemented and persisted.
3. Mud-alert threshold is configurable from global settings and applied in chart warnings.
4. Azure auth, query, dry-run preview, apply merge, and Azure subgraph layout are implemented.
5. Azure relationship extraction includes `dependsOn`, property references, and ARM parent inference.
6. Settings System Status already includes WAL/runtime probe diagnostics but not DB file size.

## 3) Execution Priority (Sequenced)

1. **P0 (Now)**: Ship Settings `System Status` SQLite DB size telemetry.
2. **P1 (Next)**: Team Topologies productization (ownership UX + explainability).
3. **P2 (Then)**: Azure Sync hardening, safety guardrails, and rollout controls.

### P0 Detailed Breakdown: Settings DB Size Telemetry

#### Objective

Expose local SQLite `main` DB size (and WAL size) in Settings without adding runtime instability.

#### Task Breakdown (File-by-File)

- [ ] `src-tauri/src/db.rs`: Extend `DbRuntimeProbe` response with `db_file_size_bytes`.
- [ ] `src-tauri/src/db.rs`: Extend `DbRuntimeProbe` response with `db_file_size_mb`.
- [ ] `src-tauri/src/db.rs`: Extend `DbRuntimeProbe` response with `wal_file_size_bytes`.
- [ ] `src-tauri/src/db.rs`: Extend `DbRuntimeProbe` response with `wal_file_size_mb`.
- [ ] `src-tauri/src/db.rs`: Resolve DB path safely (prefer `PRAGMA database_list` main entry, fallback to configured file path strategy).
- [ ] `src-tauri/src/db.rs`: Collect file metadata with graceful fallback to `0` or `None` when missing.
- [ ] `src/core/effects/db-runtime-status.ts`: Extend `DatabaseRuntimeProbeSchema` and `DatabaseRuntimeStatusSchema` with new size fields.
- [ ] `src/core/effects/db-runtime-status.ts`: Persist size values in `applyDatabaseRuntimeProbe`.
- [ ] `src/ui/components/settings/SettingsPanel.tsx`: Add `System Status` row `Database Size`.
- [ ] `src/ui/components/settings/SettingsPanel.tsx`: Add `System Status` row `WAL Size`.
- [ ] `src/ui/components/settings/SettingsPanel.tsx`: Add `System Status` row `Total Local Footprint` (optional).
- [ ] `src/ui/components/settings/SettingsPanel.tsx`: Add format helper for bytes/MB display and `N/A` fallback.
- [ ] `test/core/effects`: Add schema/runtime decode tests for new probe fields.
- [ ] `src-tauri/src/lib.rs`: Confirm no command registration changes required if reusing existing `db_runtime_probe`.

#### Acceptance Criteria (P0)

1. `System Status` shows SQLite DB size in MB and bytes on each probe refresh.
2. `System Status` shows WAL size (or `N/A` when WAL file not present).
3. Probe failure does not crash settings and keeps previous diagnostics visible.
4. UI refresh remains non-blocking and consistent with existing probe cadence.
5. No regressions in database runtime status fields currently shown.

#### Suggested Delivery Sequence

1. Backend probe contract update (`db.rs`).
2. TS schema/state update (`db-runtime-status.ts`).
3. Settings rendering update (`SettingsPanel.tsx`).
4. Tests + validation sweep.

## 4) Milestone Roadmap

### Milestone A: Team Topologies Productization (Target: 2026-03-15)

### Scope

1. Make ownership and topology signals visible and actionable in UI.
2. Improve explainability for coupling outcomes used in reviews.
3. Complete documentation and calibration workflow.

### Checklist

- [ ] Add editable `teamOwnership` field to node properties for C4 and DDD nodes.
- [ ] Add explicit ownership lens/filter in board UI (show by team, cross-team edges, unknown ownership).
- [ ] Add coupling explainability panel with formula inputs and contributors per node.
- [ ] Add score provenance rendering (auto/hybrid/manual) in chart tooltip/details.
- [ ] Add scenario fixtures for mono-team, multi-team, and unknown-ownership architectures.
- [ ] Add user-facing docs for coupling model, governance guidance, and review playbooks.

### Acceptance Criteria

1. A user can assign, edit, and persist `teamOwnership` directly from the board UI.
2. A user can identify cross-team dependencies and ownership gaps in <= 3 interactions.
3. Every node risk score can be explained from visible inputs and formula output.
4. Score mode behavior is deterministic for `auto`, `hybrid`, and `manual`.
5. No save or load regressions are introduced for existing diagrams.

### Milestone B: Azure Sync Hardening + Trust (Target: 2026-04-12)

### Scope

1. Improve resource type mapping and relationship fidelity.
2. Add guardrails for safe apply and large-tenant behavior.
3. Expand test coverage and rollout controls.

### Checklist

- [ ] Add `azure_sync_v1` feature flag and staged rollout controls.
- [ ] Implement runtime apply option `archiveMissing`.
- [ ] Implement runtime apply option `maxApplyOperations`.
- [ ] Add explicit confirmation UX before archive/removal operations.
- [ ] Expand Azure type->C4 mapping table to reduce default-to-system fallbacks.
- [ ] Add configurable tag precedence strategy for ownership mapping in settings.
- [ ] Add runtime/integration tests for payload decode, dry-run consistency, and apply idempotency.
- [ ] Add smoke tests for pagination partial-result warning path.

### Acceptance Criteria

1. Re-running sync with unchanged Azure scope produces zero net entity delta.
2. Apply path respects `maxApplyOperations` and aborts safely with clear user diagnostics.
3. Archive behavior is explicit, user-confirmed, and reversible through normal save history.
4. At least 90% of resources in sample tenant map to non-generic C4 type where mapping rule exists.
5. Relationship telemetry clearly labels source and confidence, and flags low-trust runs.

### Milestone C: Settings System Status - SQLite DB Size (Target: 2026-03-01)

### Scope

1. Add DB file size diagnostics to existing `System Status` section.
2. Keep measurement low-cost, consistent, and safe across platforms.

### Checklist

- [ ] Extend Rust `DbRuntimeProbe` with `db_file_size_bytes`.
- [ ] Extend Rust `DbRuntimeProbe` with `db_file_size_mb`.
- [ ] Extend Rust `DbRuntimeProbe` with `wal_file_size_bytes` (optional but recommended).
- [ ] Extend Rust `DbRuntimeProbe` with `wal_file_size_mb` (optional but recommended).
- [ ] Compute size from file metadata and/or SQLite pragmas (`page_count * page_size`) for validation.
- [ ] Extend TS schema in `db-runtime-status.ts` to decode/store new size fields.
- [ ] Render values in Settings -> `System Status` with clear units (B/KB/MB).
- [ ] Add "N/A" fallback if metadata cannot be read.
- [ ] Add non-blocking refresh behavior with existing `db_runtime_probe` flow.
- [ ] Add tests for decode path and formatting helpers.

### Acceptance Criteria

1. Settings displays SQLite DB size in MB (and bytes in tooltip/detail) without page reload.
2. Probe failure does not break the settings page and shows a clear fallback state.
3. Size values refresh via existing runtime probe loop and remain within 5 seconds of probe update.
4. Runtime probe overhead stays negligible (no user-perceptible latency added).

## 5) Release Gates

1. **Functional Gate**: All acceptance criteria for a milestone pass.
2. **Stability Gate**: No regression in save/apply behavior under autosave and manual save.
3. **Performance Gate**: No noticeable FPS/interaction regressions on medium diagrams.
4. **Trust Gate**: Diagnostics and provenance are visible for risky or inferred outputs.

## 6) Risks and Mitigations

1. Risk: Azure relationship quality varies by resource provider.
   Mitigation: Source/confidence labeling + warning thresholds + incremental mapping upgrades.
2. Risk: Ownership data quality is inconsistent across teams.
   Mitigation: Manual override in node properties + unknown-ownership spotlight in topology view.
3. Risk: DB status feature adds noise or confusion.
   Mitigation: Keep concise labels, human-readable units, and clear fallback messages.

## 7) Definition of Done (Roadmap)

1. Milestones A, B, and C have all checklist items completed.
2. Acceptance criteria for each milestone are demoed and test-backed.
3. Relevant ADR statuses are updated from `Proposed` to `Accepted` where implemented.
4. User docs and runbooks are updated for release readiness.
