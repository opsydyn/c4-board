# Product Roadmap: Team Topologies + Azure Sync

**Last Updated**: 2026-06-07
**Owner**: Product + Platform Engineering
**Scope Horizon**: 2026-Q1 to 2026-Q2

## 1) Goals

1. Make the C4 board a trusted system-of-record for architecture and ownership.
2. Complete Azure sync from "good dry-run/apply" to "enterprise-safe and scalable".
3. Expose critical local runtime diagnostics in Settings, including SQLite DB size.
4. Add AI copilot + agent workflows so users can chat with architecture data and apply safe board/settings actions.

## 2) Current Baseline (as of 2026-02-14)

1. Team topology scoring model (Balanced Coupling V2) is implemented and active.
2. Node-level coupling scoring controls (`auto/hybrid/manual`) are implemented and persisted.
3. Mud-alert threshold is configurable from global settings and applied in chart warnings.
4. Azure auth, query, dry-run preview, apply merge, and Azure subgraph layout are implemented.
5. Azure relationship extraction includes `dependsOn`, property references, and ARM parent inference.
6. Settings System Status already includes WAL/runtime probe diagnostics but not DB file size.
7. Ownership team catalog is now deduped and shared across node properties and ownership lens filters.
8. Explainability and provenance surfaces exist, giving strong context inputs for LLM-assisted architecture analysis.
9. Azure sync run summaries/deltas are available and can be reused for AI explain/query flows.

## 3) Execution Priority (Sequenced)

1. **P0 (Now)**: Ship Settings `System Status` SQLite DB size telemetry.
2. **P1 (Next)**: AI foundation (BYOK providers + read-only copilot + safe action registry).
3. **P2 (Then)**: Team Topologies productization (ownership UX + explainability).
4. **P3 (Then)**: Azure Sync hardening, safety guardrails, and rollout controls.
5. **P4 (Then)**: Rig agent platform expansion (typed tools, orchestration roles, memory lifecycle, governance).

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

- [x] Add editable `teamOwnership` field to node properties for C4 and DDD nodes.
- [x] Add explicit ownership lens/filter in board UI (show by team, cross-team edges, unknown ownership).
- [x] Add board-level ownership team catalog with dedupe and remove workflow.
- [x] Sync ownership lens `Team Filter` options with ownership input catalog (single source of truth).
- [x] Add ownership lens reset action (`RESET LENS`) to restore filter defaults.
- [x] Add coupling explainability panel with formula inputs and contributors per node.
- [x] Add score provenance rendering (auto/hybrid/manual) in chart tooltip/details.
- [x] Add scenario fixtures for mono-team, multi-team, and unknown-ownership architectures.
- [x] Add user-facing docs for coupling model, governance guidance, and review playbooks.

### Acceptance Criteria

1. A user can assign, edit, and persist `teamOwnership` directly from the board UI.
2. A user can identify cross-team dependencies and ownership gaps in <= 3 interactions.
3. Team input and team filter remain synchronized with no loss of options as teams are added/removed.
4. Every node risk score can be explained from visible inputs and formula output.
5. Score mode behavior is deterministic for `auto`, `hybrid`, and `manual`.
6. No save or load regressions are introduced for existing diagrams.

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

### Milestone D: AI Copilot + Agent Actions (Target: 2026-05-10)

### Scope

1. Add CopilotKit-powered conversational UX that can query diagram, ownership, coupling, and sync context.
2. Support Bring-Your-Own-Key providers (`OpenAI`, `Anthropic`, `OpenRouter`) with secure local persistence.
3. Enable guarded agent actions that can update board structure and settings through typed contracts.
4. Make existing features LLM-friendly via normalized context, provenance, and deterministic action plans.

### Architecture Tracks

1. **Track D1: AI Runtime and Provider Abstraction**
   - [ ] Define `ai_settings` contract (provider, model, key presence, temperature, max tokens, action mode).
   - [ ] Add settings schema + migration for AI provider/model defaults and redaction policy.
   - [ ] Implement provider adapter boundary (`openai`, `anthropic`, `openrouter`) behind one typed runtime interface.
   - [ ] Store API keys in OS keychain where available; fallback encrypted local storage only with explicit warning.
   - [ ] Add health-check endpoint per provider/model for validation from Settings.

2. **Track D2: CopilotKit UX Integration**
   - [ ] Add global AI toggle and launch surface in C4/DDD sidebars (opt-in, off by default).
   - [ ] Add chat panel with context selector: `board`, `selection`, `ownership`, `coupling`, `azure-sync`.
   - [ ] Add response cards for "insights", "recommended actions", and "explainability links".
   - [ ] Add clear offline/no-key/invalid-key UX states with fast retry path.

3. **Track D3: Agent Action System (Safe-by-Default)**
   - [ ] Implement action registry using `Effect Schema` contracts for all agent-callable operations.
   - [ ] Start with safe actions: move nodes, run layout, update node metadata, update ownership tags, toggle view/settings.
   - [ ] Require preview plan + user confirmation before any state mutation.
   - [ ] Route confirmed actions through existing save/write serialization boundary (no bypass).
   - [ ] Add undo checkpoint creation for each AI-applied action batch.

4. **Track D4: LLM-Friendly Context Layer**
   - [ ] Build a deterministic context assembler from board graph + ownership + coupling + Azure sync runs.
   - [ ] Include provenance markers for each context block (source, timestamp, confidence).
   - [ ] Add token-budgeting and chunking strategy to prevent oversized prompts on large diagrams.
   - [ ] Add redaction transform aligned to existing privacy settings.

5. **Track D5: Evaluation, Trust, and Observability**
   - [ ] Create eval fixtures covering mono-team, multi-team, unknown ownership, and Azure-heavy topologies.
   - [ ] Add automated eval checks for factuality vs source graph, unsafe action attempts, and policy compliance.
   - [ ] Emit AI telemetry: latency, token usage, model/provider, failure class, confirmation/cancel rates.
   - [ ] Add kill switch (`ai_assistant_v1`) and staged rollout controls.

### Acceptance Criteria

1. Users can configure and validate BYOK provider settings in under 2 minutes with no app restart.
2. Chat answers include cited context blocks (node/edge/settings/sync provenance) for traceability.
3. Agent actions never mutate state without explicit user confirmation and produce undo checkpoints.
4. AI-applied changes preserve save correctness (no write-lock regressions, no unsynced UI status regressions).
5. AI context generation stays within configured token budgets and remains responsive on medium/large boards.
6. Eval suite passes baseline thresholds for factuality, action safety, and error handling before general rollout.

### Suggested Delivery Sequence

1. D1 provider abstraction + settings contract/migration.
2. D4 context assembler and provenance/citation model.
3. D2 CopilotKit read-only chat integration (insights only).
4. D3 safe action registry + preview/confirm/undo workflow.
5. D5 eval/telemetry gates + staged rollout.

### Milestone E: Rig Agent Platform Expansion (Target: 2026-06-21)

### Scope

1. Move from single-prompt assistant behavior to a typed Rig agent platform.
2. Introduce planner/analyst/executor/verifier responsibilities with deterministic action boundaries.
3. Add durable memory and task lifecycle controls so sessions are resumable, auditable, and recoverable.
4. Keep all mutations routed through the same save/transaction safety boundaries used by manual UI.
5. Detailed execution plan and architecture baseline: `docs/adr/008-rig-agent-platform-orchestration.md`.
6. Task-level implementation backlog: `docs/rig-agent-task-breakdown.md`.

### Architecture Tracks

1. **Track E1: Rig Tooling Surface (Typed + Safe)**
   - [ ] Define a Rig tool registry for board read models (`board_summary`, `node_lookup`, `edge_lookup`, `ownership_summary`, `coupling_summary`, `azure_sync_summary`).
   - [ ] Define mutation tools (`update_node`, `create_edge`, `layout_graph`, `set_owner`, `set_setting`) with `Effect Schema` contracts.
   - [ ] Add tool capability metadata (`read_only`, `requires_confirmation`, `risk_level`) and enforce it at runtime.
   - [ ] Add policy guardrails to deny out-of-scope tool calls (diagram scope, hidden features, restricted settings).
   - [ ] Emit normalized tool execution telemetry (`tool`, `args_hash`, `duration_ms`, `result`, `error_class`).

2. **Track E2: Multi-Agent/Role Orchestration**
   - [x] Implement role separation across Rig read/proposal/review flows: `analyst` (explain), `planner` (plan), `verifier` (post-check), with executor handoff preserved through typed action/apply boundaries.
   - [x] Require persisted planner output before any executable action batch.
   - [x] Add iteration budgets and hard timeouts per stage to prevent runaway agent loops.
   - [x] Add cancellation and retry semantics surfaced in UI session state.
   - [ ] Add deterministic stage transitions logged per run (`planned`, `proposed`, `confirmed`, `applied`, `verified`, `rolled_back`).

3. **Track E3: Memory, Sessions, and Task Lifecycle**
   - [ ] Extend persisted OPY sessions with task metadata (`intent`, `status`, `last_stage`, `last_error`, `last_artifact`).
   - [ ] Add first-class task records for long-running operations and resumable workflows.
   - [ ] Persist board snapshot references per applied task for diff/review.
   - [ ] Add session operations: rename, archive, restore, pin, and export transcript.
   - [ ] Add background cleanup/retention controls in Settings (TTL + max session count).

4. **Track E4: Grounded Context + Retrieval**
   - [x] Build local retrieval index over nodes, edges, settings, sync run summaries, and explainability artifacts.
   - Current OPY scope now indexes current-board graph evidence, saved-diagram metadata, session messages, tasks, proposals, artifacts, checkpoints, governance snapshots, operator settings state, Azure sync summaries, and complexity-field explainability snapshots locally.
   - [x] Add retrieval filters by domain (`c4`, `ddd`, `azure`), scope (current diagram/all diagrams), and recency.
   - [x] Return explicit citation bundles for every generated recommendation.
   - [ ] Add confidence scoring tied to citation coverage (low citation coverage => low confidence banner).
   - [x] Add redaction pipeline before retrieval/prompt assembly using existing privacy settings.

5. **Track E5: Action Safety, Governance, and Rollout**
   - [ ] Add approval policies by action class (always-confirm, confirm-on-threshold, auto-apply for read-only).
   - [x] Add per-provider and per-model allow-lists in settings with kill switch support.
   - [x] Add anomaly detection for suspicious prompts/tool-call patterns (prompt injection, unsafe request patterns).
   - Current OPY scope now runs request-preflight anomaly checks for prompt injection, secret exfiltration, policy bypass, and destructive mutation language, and it now extends those checks into suspicious tool-trace summaries plus mutation-plan analysis before apply. All anomaly outcomes persist as `anomaly_assessment` artifacts and surface through `ANOMALY::...` warnings.
   - [x] Add canary rollout mode (`rig_agent_v1`) and environment-level overrides.
   - [x] Add governance audit log view in Settings (`who`, `what`, `when`, `why`, `source session`).
   - Current OPY scope also aggregates persisted anomalies, blocked counts, cancellations, failures, decisions, and average terminal-task duration in that audit surface.

6. **Track E6: Developer Experience + Evaluation**
   - [ ] Add deterministic fixture suite for Rig runs (`read-only qa`, `safe mutation`, `failure recovery`, `rollback`).
   - [ ] Add regression tests for tool contracts and schema migration compatibility.
   - [ ] Add local replay utility for failed agent runs using stored transcripts and tool traces.
   - [ ] Add budget/latency dashboards (p50/p95 latency, token usage, cost estimate, tool success rate).
   - [ ] Add pass/fail quality gates before enabling mutation mode by default.
   - Current OPY scope now emits browser telemetry for provider/model, configured max-token budget, action mode, rollout mode/source, anomaly severity/score, confirmation requirement, and cancellation/failure outcomes. Provider-reported token usage and cost remain pending runtime support.

### Acceptance Criteria

1. Rig can execute read-only architecture QA with cited sources and deterministic outputs across repeated runs.
2. Any mutation proposal is represented as a typed plan and never applies without policy-compliant confirmation.
3. Multi-stage runs are resumable after restart and preserve task/session integrity.
4. Agent-applied changes are diffable, undoable, and linked to transcript + tool trace provenance.
5. Eval suite passes thresholds for safety, determinism, and factual grounding before rollout expansion.

### Suggested Delivery Sequence

1. E1 typed tool registry + policy metadata.
2. E2 role orchestration with stage lifecycle controls.
3. E3 session/task lifecycle and snapshot linkage.
4. E6 eval/replay dashboards and release gating.

## 5) Release Gates

1. **Functional Gate**: All acceptance criteria for a milestone pass.
2. **Stability Gate**: No regression in save/apply behavior under autosave and manual save.
3. **Performance Gate**: No noticeable FPS/interaction regressions on medium diagrams.
4. **Trust Gate**: Diagnostics and provenance are visible for risky or inferred outputs.
5. **AI Safety Gate**: No unconfirmed mutations, no secret leakage in prompts, and eval thresholds met.

## 6) Risks and Mitigations

1. Risk: Azure relationship quality varies by resource provider.
   Mitigation: Source/confidence labeling + warning thresholds + incremental mapping upgrades.
2. Risk: Ownership data quality is inconsistent across teams.
   Mitigation: Manual override in node properties + unknown-ownership spotlight in topology view.
3. Risk: DB status feature adds noise or confusion.
   Mitigation: Keep concise labels, human-readable units, and clear fallback messages.
4. Risk: LLM hallucination or low-confidence recommendations erode trust.
   Mitigation: Source citations, confidence scoring, and read-only default until action gates pass.
5. Risk: Provider/API key handling introduces security risk.
   Mitigation: Keychain-first storage, explicit redaction policy, and kill-switch rollout controls.
6. Risk: Agent actions regress save/runtime reliability.
   Mitigation: Existing serialized write boundary reuse, preview-confirm flow, and undo checkpoints.

## 7) Definition of Done (Roadmap)

1. Milestones A, B, C, D, and E have all checklist items completed.
2. Acceptance criteria for each milestone are demoed and test-backed.
3. Relevant ADR statuses are updated from `Proposed` to `Accepted` where implemented.
4. User docs and runbooks are updated for release readiness.
