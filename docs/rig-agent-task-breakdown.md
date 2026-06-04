# Rig Agent Task Breakdown (Execution Plan)

**Last Updated**: 2026-06-04
**Source ADR**: `docs/adr/008-rig-agent-platform-orchestration.md`
**Delivery Horizon**: 6 phases across 2026-Q1/Q2

## 1) Critical Path

1. Foundation hardening (config, key storage, run envelope).
2. Read-only tooling and grounded context.
3. Proposal-only mutation planning.
4. Confirmed apply through existing save boundary.
5. Multi-stage orchestration and resumable tasks.
6. Governance, rollout gates, and evaluation automation.

## Status Review

- Completed in code: `RIG-001` through `RIG-004`, `RIG-101` through `RIG-103`, `RIG-201`, `RIG-202`, `RIG-203`, `RIG-301`, and `RIG-302`.
- `RIG-401` is now started:
  - OPY has an explicit orchestration machine for `contextualizing`, `planning`, `proposing`, `awaiting_confirmation`, `applying`, `verifying`, `completed`, and `failed`
  - the panel is no longer relying on a single local `isRunning` flag for read/proposal/apply/rollback flow state
  - action confirmations now surface inside OPY as a real `awaiting_confirmation` state instead of dropping into `window.confirm`
  - machine-level lifecycle telemetry now emits flow start, transition, completion, cancellation, and failure events independently of persisted run envelopes
  - the control field now carries the last terminal flow outcome after a lifecycle returns to `idle`
  - retry now replays from machine-owned request metadata rather than a panel-local closure
  - mutation action descriptors and blockers for `/add`, proposal apply, and rollback now resolve through `src/core/effects/opy-action.runtime.ts` instead of staying embedded in the panel
  - confirmation UI is now derived from the active machine request metadata, and lifecycle reset clears that pending confirmation state structurally
  - read-side failures now preserve `invoke` vs `persist` provenance, so terminal OPY state and telemetry no longer flatten read runtime and persistence errors together
  - action-side failures now preserve separate `apply`, `verify`, and `persist` provenance so terminal OPY state and telemetry no longer flatten all mutation failures together
  - confirmed action execution is now re-resolved from the active machine request replay metadata, so OPY no longer depends on a panel-local execution ref to resume or confirm a staged action
  - session changes now reset the OPY lifecycle boundary to avoid cross-session stale flow state
  - retryable terminal failure handling now exists at the OPY surface
- The OPY surface now goes beyond the original roadmap UI baseline:
  - floating widget with layout memory, minimize/orb presence, snap modes, and draggable resize
  - pinned conversation strip with collapsible upper sections
  - urgency-aware chrome signals for `policy`, `review`, `proposal`, and `checkpoint`
  - actionable chrome signals that open and focus the matching OPY section
- `RIG-401` is now effectively complete in code for the current OPY scope: staged lifecycle, machine-owned retry/reset, typed failure provenance, and confirmation replay are all in place.
- `RIG-402` is now started:
  - active OPY lifecycle requests are persisted in `opy_agent_tasks`
  - session hydration/switch/create interrupts stale running tasks instead of losing them silently
  - OPY can hydrate the latest interrupted request for a session and surface `resume` / `dismiss` controls back to the operator
- the next `RIG-402` slices should extend this baseline into tool-call/artifact persistence and deeper restart continuity rather than only terminal replay after failure
- `RIG-501` and `RIG-502` remain valid rollout gates, but they should not move ahead of orchestration and persistent task lifecycle.

## 2) Phase 0: Foundation Hardening

### RIG-001: Agent Config Contract

- Goal: Define stable config schema for providers/models/policy defaults.
- Deliverables:
  - Add `ai_settings` shape to settings Effect schema.
  - Add migration for default agent settings.
  - Add runtime decode validation with clear error tags.
- Primary files:
  - `src/core/effects/settings.types.ts`
  - `src/core/effects/settings.runtime.ts`
  - `src-tauri/migrations/020_ai_settings.sql`
- Depends on: none.
- Acceptance:
  - Settings can read/write `ai_settings` without regressions.
  - Invalid settings payload returns typed schema error.

### RIG-002: Secret Storage Boundary

- Goal: Move provider keys to secure storage abstraction.
- Deliverables:
  - Introduce key resolver interface with priority order.
  - Support keychain-first, fallback path with explicit warning.
  - Add diagnostics endpoint to show "configured/not configured" only.
- Primary files:
  - `src-tauri/src/ai_agent.rs`
  - `src/core/effects/ai-agent.runtime.ts`
  - `src/ui/components/settings/SettingsPanel.tsx`
- Depends on: `RIG-001`.
- Acceptance:
  - Raw key never rendered in UI logs/telemetry.
  - Health check passes when key exists via supported source.

### RIG-003: Agent Run Envelope + Telemetry

- Goal: Standardize run identity and lifecycle metadata.
- Deliverables:
  - Add `runId`, `stage`, `startedAt`, `completedAt`, `status`.
  - Persist run envelope in OPY session context.
  - Emit telemetry event per run completion/failure.
- Primary files:
  - `src/core/effects/opy-chat.persistence.ts`
  - `src/ui/components/OpyCopilotPanel.tsx`
  - `src/ui/machines/` (new `opy-run.machine.ts`)
- Depends on: `RIG-001`.
- Acceptance:
  - Every run has unique `runId` and terminal status.
  - Failed runs are visible with stage and error summary.

### RIG-004: Error Taxonomy Baseline

- Goal: Replace ad-hoc runtime errors with typed agent error classes.
- Deliverables:
  - Implement `AgentConfigError`, `AgentRuntimeError`, `AgentPolicyError`.
  - Normalize frontend error rendering from typed error payloads.
- Primary files:
  - `src/core/effects/ai-agent.runtime.ts`
  - `src/ui/components/OpyCopilotPanel.tsx`
- Depends on: `RIG-003`.
- Acceptance:
  - UI surfaces stage-aware error text.
  - Unknown errors are mapped to consistent fallback type.

## 3) Phase 1: Read-Only Rig Intelligence

### RIG-101: Read Tool Registry

- Goal: Introduce typed read tools for board introspection.
- Deliverables:
  - Tool contracts for `board_summary`, `node_lookup`, `edge_lookup`.
  - Schema-validated inputs and outputs per tool.
- Primary files:
  - `src/core/effects/agent-tools/read-tools.ts`
  - `src/core/effects/agent-tools/contracts.ts`
  - `src-tauri/src/ai_agent.rs`
- Depends on: Phase 0 complete.
- Acceptance:
  - Tool calls fail fast on invalid payloads.
  - Deterministic results for identical board snapshots.

### RIG-102: Context Assembler + Citations

- Goal: Ground responses in explicit board evidence.
- Deliverables:
  - Build context blocks with source metadata.
  - Return citation bundles in response payload.
- Primary files:
  - `src/core/effects/agent-context.ts`
  - `src/core/effects/ai-agent.runtime.ts`
  - `src/ui/components/OpyCopilotPanel.tsx`
- Depends on: `RIG-101`.
- Acceptance:
  - Assistant response includes at least one citation block.
  - Missing evidence forces low-confidence label.

### RIG-103: Read-Only UX State

- Goal: Surface confidence/provenance in OPY panel.
- Deliverables:
  - Add run stage and confidence UI.
  - Add citations list and expandable diagnostics.
- Primary files:
  - `src/ui/components/OpyCopilotPanel.tsx`
  - `src/ui/components/styles.css.ts`
- Depends on: `RIG-102`.
- Acceptance:
  - User can inspect sources used for each answer.
  - Read-only mode blocks mutation tools.

## 4) Phase 2: Proposal-Only Mutation Planning

### RIG-201: Mutation Tool Contracts

- Goal: Define typed mutation actions with policy metadata.
- Deliverables:
  - Contracts for `create_nodes`, `update_nodes`, `create_edges`, `apply_layout`.
  - Per-tool metadata: risk, scope, requiresConfirmation.
- Primary files:
  - `src/core/effects/agent-tools/mutation-tools.ts`
  - `src/core/effects/agent-policy.ts`
- Depends on: Phase 1 complete.
- Acceptance:
  - Mutation plan can be validated without applying changes.
  - Risk classification is attached to every action.

### RIG-202: Plan/Diff Renderer

- Goal: Show proposed graph changes before apply.
- Deliverables:
  - Render creates/updates/deletes summary and impacted entities.
  - Add "Approve plan" / "Reject plan" controls.
- Primary files:
  - `src/ui/components/OpyCopilotPanel.tsx`
  - `src/core/effects/agent-plan-diff.ts`
- Depends on: `RIG-201`.
- Acceptance:
  - No board state mutation occurs in proposal mode.
  - User can inspect and reject a plan.

## 5) Phase 3: Controlled Apply

### RIG-301: Checkpoint + Apply Boundary

- Goal: Apply approved actions through existing save guarantees.
- Deliverables:
  - Create pre-apply checkpoint artifact.
  - Route apply through `C4CanvasContainer` save boundary.
  - Ensure autosave/sync interactions remain safe.
- Primary files:
  - `src/ui/components/C4CanvasContainer.tsx`
  - `src/core/effects/agent-apply.runtime.ts`
  - `src/core/effects/opy-chat.persistence.ts`
- Depends on: Phase 2 complete.
- Acceptance:
  - Applied plan updates board and persists successfully.
  - Failed apply keeps board consistent and recoverable.

### RIG-302: Rollback Path

- Goal: Recover safely from failed or unwanted agent apply.
- Deliverables:
  - Rollback endpoint by checkpoint/task.
  - UI action to rollback last applied task.
  - Historical checkpoint restore targets with proposal provenance.
  - Restore diff preview against the current board before confirm.
- Primary files:
  - `src/core/effects/agent-rollback.runtime.ts`
  - `src/ui/components/OpyCopilotPanel.tsx`
- Depends on: `RIG-301`.
- Acceptance:
  - Rollback restores previous snapshot deterministically.
  - Rollback action is logged in run artifacts.
  - Operator can inspect restore/revert/remove deltas before executing restore.

## 6) Phase 4: Multi-Stage Orchestration

### RIG-401: Orchestration Machine

- Goal: Implement explicit staged execution lifecycle.
- Deliverables:
  - Add XState machine with stages:
    - `idle`
    - `planning`
    - `contextualizing`
    - `proposing`
    - `awaiting_confirmation`
    - `applying`
    - `verifying`
    - `completed`
    - `failed`
  - Emit lifecycle events for UI and telemetry.
- Current status:
  - initial machine and OPY panel integration landed
  - in-panel confirmation is now wired through the machine boundary
  - remaining work is to complete deeper orchestration ownership and handoff into persistent task lifecycle
- Primary files:
  - `src/ui/machines/opy-agent.machine.ts`
  - `src/ui/hooks/useOpyAgentMachine.ts`
- Depends on: Phase 3 complete.
- Acceptance:
  - Stage transitions are deterministic and test-covered.
  - Cancellation and retry behave correctly.

### RIG-402: Persistent Task Lifecycle

- Goal: Resume interrupted runs and long-running tasks.
- Deliverables:
  - Add `opy_agent_tasks`, `opy_agent_tool_calls`, `opy_agent_artifacts`.
  - Resume logic from last persisted stage.
- Primary files:
  - `src-tauri/migrations/024_create_opy_agent_tasks.sql`
  - `src/core/effects/opy-chat.persistence.ts`
  - `src/ui/components/OpyCopilotPanel.tsx`
  - `src/ui/machines/opy-agent.machine.ts`
- Depends on: `RIG-401`.
- Current status:
  - first slice complete for task persistence and resume hydration
  - `opy_agent_tasks` now stores active OPY lifecycle requests with `running|interrupted|completed|failed|cancelled` status
  - OPY can hydrate the latest interrupted request for the active session and let the operator resume or dismiss it
  - tool-call/artifact persistence is still pending
- Acceptance:
  - App restart can resume in-progress task context.
  - Task timeline remains queryable and coherent.

## 7) Phase 5: Governance, Evaluation, Rollout

### RIG-501: Policy Controls in Settings

- Goal: Make mutation and safety policies configurable.
- Deliverables:
  - Add controls for mutation mode, action limits, settings mutation lock.
  - Persist and enforce policy at runtime.
- Primary files:
  - `src/ui/components/settings/SettingsPanel.tsx`
  - `src/core/effects/settings.types.ts`
  - `src/core/effects/agent-policy.ts`
- Depends on: Phase 4 complete.
- Acceptance:
  - Policy updates take effect without restart.
  - Runtime blocks policy-violating actions.

### RIG-502: Evaluation Harness

- Goal: Gate rollout using measurable quality thresholds.
- Deliverables:
  - Add fixture scenarios: mono-team, cross-team, unknown ownership, Azure-heavy.
  - Add assertions for factual grounding, safe action behavior, rollback correctness.
- Primary files:
  - `test/core/effects/agent-evals/*.test.ts`
  - `test/ui/machines/opy-agent.machine.test.ts`
- Depends on: `RIG-501`.
- Acceptance:
  - Eval pass criteria is met before enabling mutation mode by default.
  - Regression suite blocks unsafe behavioral drift.

### RIG-503: Rollout Controls + Audit View

- Goal: Support staged release with operational visibility.
- Deliverables:
  - Add `rig_agent_v1` feature flag + canary controls.
  - Add audit screen for agent actions and confirmations.
- Primary files:
  - `src/core/effects/feature-flags.ts`
  - `src/ui/components/settings/SettingsPanel.tsx`
  - `src/ui/components/settings/AgentAuditPanel.tsx`
- Depends on: `RIG-502`.
- Acceptance:
  - Feature can be enabled by cohort/environment.
  - Audit trail captures who/what/when/why per applied task.

## 8) Next Recommended Execution Order

1. `RIG-401` Orchestration Machine.
2. `RIG-402` Persistent Task Lifecycle.
3. `RIG-501` Policy Controls in Settings.
4. `RIG-502` Evaluation Harness.
5. `RIG-503` Rollout Controls + Audit View.

## 9) Definition of Ready / Done

### Ready

1. Task has typed input/output contract.
2. Task has target files and dependency mapping.
3. Task has explicit acceptance criteria and test scope.

### Done

1. Implementation complete with tests.
2. No save/autosave regressions in C4 board flows.
3. Telemetry and diagnostics added where applicable.
4. Documentation updated in roadmap + ADR links.
