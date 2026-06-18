---
title: "ADR-008: Rig Agent Platform Orchestration for OPY Net"
---

# ADR-008: Rig Agent Platform Orchestration for OPY Net

**Status**: Proposed
**Date**: 2026-02-15
**Deciders**: Alan
**Technical Story**: Expand OPY Net from prompt/response assistant to a safe, deterministic, multi-stage agent platform that can generate and evolve boards from user intent.

## Context

The current OPY integration proves core viability but is intentionally minimal:

- Rust runtime exposes a single `rig_agent_hello` command.
- Frontend submits prompt text and receives assistant text.
- No typed tool registry exists for board read/write operations.
- No planner/executor/verifier separation exists.
- No mutation policy framework exists for agent-generated changes.

The product direction requires full Rig capabilities:

1. Users can ask for board creation/evolution from natural language.
2. Agent actions remain safe, reviewable, and recoverable.
3. Save/runtime reliability (existing XState + serialized persistence path) cannot regress.
4. Outputs must be grounded in board/system data with provenance.

## Decision

Adopt a **Rig-first agent architecture** with explicit orchestration stages, typed tools, and policy-gated mutation flow.

### Proposed Solution

Build OPY Net as a staged pipeline:

1. `PLAN`: convert user intent into a typed execution plan.
2. `CONTEXT`: gather graph/settings/sync evidence with provenance.
3. `PROPOSE`: generate candidate board mutations as typed actions.
4. `REVIEW`: render preview diff + risk classification.
5. `APPLY`: execute only after policy-compliant confirmation.
6. `VERIFY`: run post-conditions and summarize deltas.
7. `PERSIST`: store transcript, tasks, tool traces, artifacts.

All writes remain routed through the existing board save boundary and transaction controls.

### Key Architecture Principles

1. **No direct mutation from model output**: model text never mutates board state directly.
2. **Tool-first contracts**: every action passes through typed tool schemas.
3. **Human-in-the-loop by default**: mutation batches require explicit confirmation unless policy marks them safe.
4. **Replayability**: each run can be replayed using stored plan, tool args, and results.
5. **Determinism where feasible**: planning and application are separated so apply stage is deterministic.

## Implementation Details

### Runtime Topology

1. **Rust (Rig runtime)**
   - Hosts provider clients and orchestrator loop.
   - Executes tool calls via typed command bridge.
   - Emits stage artifacts (`plan`, `proposal`, `verification`).
2. **Effect Layer**
   - Owns schema validation, policy checks, and typed service boundaries.
   - Exposes tool implementations for read/write graph operations.
   - Handles persistence integration and error taxonomy.
3. **XState UI Actors**
   - Session actor: transcript + task lifecycle.
   - Run actor: stage state (`idle/planning/proposing/reviewing/applying/verifying`).
   - Preferences actor: mode toggles and guardrail settings persistence.

### Tool Taxonomy (Initial)

1. **Read Tools (auto-allowed)**
   - `board_summary`
   - `node_lookup`
   - `edge_lookup`
   - `ownership_summary`
   - `coupling_summary`
   - `azure_sync_summary`
2. **Mutation Tools (confirm-required by default)**
   - `create_nodes`
   - `update_nodes`
   - `create_edges`
   - `update_edges`
   - `apply_layout`
   - `set_team_ownership`
   - `set_settings_patch` (restricted subset)
3. **Administrative Tools**
   - `create_snapshot_checkpoint`
   - `rollback_to_checkpoint`
   - `export_run_artifact`

### Policy Model

Each tool declares:

- `capability`: `read` | `mutate` | `admin`
- `risk`: `low` | `medium` | `high`
- `requiresConfirmation`: boolean
- `allowedScopes`: `c4` | `ddd` | `azure` | `settings`

Global policy settings:

- `agentMutationMode`: `disabled` | `confirm` | `policy`
- `maxActionsPerBatch`
- `maxNodesCreatedPerRun`
- `maxEdgesCreatedPerRun`
- `allowSettingsMutation`

### Persistence Model Additions

Existing OPY session/message tables remain.

Add:

1. `opy_agent_tasks`
   - `id`, `session_id`, `intent`, `status`, `stage`, `created_at`, `updated_at`, `error`
2. `opy_agent_tool_calls`
   - `id`, `task_id`, `tool_name`, `args_json`, `result_json`, `status`, `latency_ms`, `created_at`
3. `opy_agent_artifacts`
   - `id`, `task_id`, `artifact_type`, `content_json`, `created_at`
4. `opy_agent_checkpoints`
   - `id`, `task_id`, `diagram_id`, `snapshot_ref`, `created_at`

### Event and State Integration

Use XState event emission for run lifecycle notifications:

- `agent.plan.created`
- `agent.proposal.ready`
- `agent.confirmation.required`
- `agent.apply.started`
- `agent.apply.completed`
- `agent.verify.failed`

UI subscribes to emitted events for progress rendering, toast diagnostics, and activity timeline.

### Error Model

Standardize errors with `Effect Schema` tags:

- `AgentConfigError`
- `AgentPolicyViolationError`
- `AgentToolValidationError`
- `AgentToolExecutionError`
- `AgentApplyError`
- `AgentVerificationError`

Each error includes:

- `runId`
- `stage`
- `recoverable` flag
- `recommendedAction`

## Phased Migration Plan

### Phase 0: Foundation Hardening

1. Finalize provider abstraction + key storage rules.
2. Stabilize OPY session persistence and lifecycle controls.
3. Add baseline telemetry envelope for agent runs.

### Phase 1: Read-Only Rig Intelligence

1. Implement read tool registry with schema validation.
2. Build context assembler + citation bundles.
3. Ship read-only architecture Q&A with confidence labels.

### Phase 2: Proposal-Only Mutation Planning

1. Add mutation tool contracts.
2. Generate preview-only action plans and graph diffs.
3. Require explicit user confirmation UI; no apply yet.

### Phase 3: Controlled Apply

1. Execute confirmed mutation batches through save boundary.
2. Create pre-apply checkpoints and rollback path.
3. Add post-apply verification and failure recovery.

### Phase 4: Multi-Agent Orchestration

1. Separate planner/analyst/executor/verifier stages.
2. Add stage budgets, retries, and cancellation semantics.
3. Add resumable long-running task support.

### Phase 5: Governance and Rollout

1. Add audit views and policy administration.
2. Add canary flag rollout (`rig_agent_v1`).
3. Gate broader rollout by evaluation thresholds.

## Acceptance Criteria

1. OPY can produce cited read-only answers grounded in board data.
2. OPY can produce deterministic, typed mutation proposals from user intent.
3. No mutation is applied without policy-compliant confirmation.
4. Applied changes are persisted through existing save path and are undoable.
5. Run artifacts (plan, calls, results) are persisted and replayable.
6. Agent failures never leave board state partially mutated without diagnostic visibility.

## Testing Strategy

### Unit Tests

1. Tool contract schema validation (valid/invalid payloads).
2. Policy engine allow/deny matrix.
3. Context assembler provenance and redaction correctness.
4. Mutation plan normalization and diff generation.

### Integration Tests

1. Read-only run with citations.
2. Proposal-only run requiring confirmation.
3. Confirmed apply run creating checkpoint and save.
4. Apply failure triggers rollback and error artifact.
5. Resume interrupted task from persisted stage.

### End-to-End Scenarios

1. Generate a new board from prompt in C4 mode.
2. Expand existing board with team ownership assignments.
3. Apply Azure-aware topology changes while preserving local annotations.
4. Reject unsafe settings mutation attempt by policy.

## Consequences

### Positive

- Enables true agent-driven board creation and evolution.
- Preserves reliability by reusing existing save/runtime boundaries.
- Improves trust through explicit plan/review/apply workflow and provenance.
- Creates a foundation for future multi-agent capabilities.

### Negative

- Significant implementation complexity across Rust, Effect, and XState layers.
- Requires new persistence schema and migration management.
- Requires robust evaluation/telemetry to avoid hidden regressions.

### Neutral

- Existing OPY chat UX remains valid and becomes the entry point to richer flows.
- Existing Azure/team topology features become high-value context sources for agents.

## Alternatives Considered

### Alternative 1: Keep OPY as text-only advisor

**Why Rejected**: Does not meet product goal of agent-assisted board generation and automation.

### Alternative 2: Execute model-generated JSON directly in frontend

**Why Rejected**: Unsafe and brittle; bypasses typed policy enforcement and save boundaries.

### Alternative 3: Implement orchestration only in frontend

**Why Rejected**: Weak isolation for secrets/provider logic and poorer long-running task control.

## References

- `docs/src/content/docs/overview/product-roadmap-team-topology-azure-sync.md`
- `docs/adr/004-sqlite-pool-architecture.md`
- `docs/adr/005-global-settings-wiring-plan.md`
- `docs/adr/007-azure-graph-sync.md`
- `src/core/effects/ai-agent.runtime.ts`
- `src-tauri/src/ai_agent.rs`
