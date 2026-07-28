---
title: "Roadmap: Architecture Change Intelligence"
description: "Forward roadmap for OPY as an agentic architecture workbench across design intent, governance, and cloud reality."
---

# Roadmap: Architecture Change Intelligence

**Last Updated**: 2026-07-03

**Owner**: Product + Platform Engineering

**Scope Horizon**: 2026-Q3 to 2026-Q4
**Strategic Theme**: OPY as the architecture change agent for design intent, governance, and cloud reality.

## 1) Product Thesis

`c4-board` should become the architecture intelligence workbench where system design changes are proposed, reviewed, simulated, approved, applied, synced with cloud reality, and remembered.

The product moat is not AI diagram generation by itself. The moat is the governed loop around architectural change:

```text
intent -> model -> compare -> govern -> sync reality -> detect drift -> evolve
```

OPY should connect four sources of truth:

1. **Architecture intent**: the user's prompt, current board, active selection, and existing C4/DDD model.
2. **Governance context**: ownership, coupling risk, policy settings, approval history, and confidence signals.
3. **Operational reality**: Azure sync runs, mapped resources, relationship confidence, and drift against the board.
4. **Decision memory**: OPY sessions, proposals, accepted/rejected changes, checkpoints, rollback events, artifacts, and task lineage.

## 2) Current Baseline

The current OPY/Rig C4 loop is strong enough to treat as a foundation:

- OPY has a drawer-first UX with floating widget mode still available.
- C4 read/review/proposal/apply flows are grounded in board evidence.
- Mutation plans are typed, policy-gated, checkpointed, and reversible.
- Task lifecycle, resumability, lineage, artifacts, trace history, audit, eval, anomaly screening, confidence, and citations are in place for the current C4 scope.
- Local retrieval covers board evidence, saved diagrams, OPY sessions, tasks, proposals, artifacts, checkpoints, governance, settings, Azure sync summaries, and explainability snapshots.

Known gaps:

- Runtime execution is still effectively OpenAI-first even though settings expose additional providers.
- Provider token usage is reported and decoded but not yet persisted for the board surface, which blocks budget UI and release gates. Postee runs already persist it in `postee_agent_runs`.
- Rig tool contracts exist, but OPY does not yet expose a broad Rig-native tool registry for architecture operations.
- The OPY handbook and older roadmap contain stale status language in a few sections and should be reconciled as this roadmap becomes canonical.

## 3) North Star Workflow

The flagship experience should be:

1. **Model from intent**
   - User describes a system, change, cloud import, incident, or refactor.
   - OPY produces multiple C4 alternatives as typed proposals, not static images.
   - OPY explains tradeoffs, assumptions, missing inputs, and confidence.

2. **Review against governance**
   - OPY checks ownership, coupling, boundary clarity, missing edge labels, policy constraints, and prior decision memory.
   - OPY highlights unsafe, ambiguous, or low-evidence recommendations before approval.

3. **Compare against cloud reality**
   - Azure sync provides the observed topology.
   - OPY identifies drift between the board and observed infrastructure.
   - OPY labels low-confidence mappings and relationship assumptions.

4. **Plan the change**
   - OPY proposes a staged change plan: board edits, ownership updates, Azure mapping assumptions, review checkpoints, and rollback points.
   - The plan is inspectable as a diff and traceable to evidence.

5. **Apply with audit**
   - User approves.
   - OPY applies through the existing save boundary, creates checkpoints, persists artifacts, and links the rationale to session/task history.

## 4) Strategic Pillars

### Pillar A: Streaming OPY Workbench

Make OPY feel like a live architecture operator without weakening safety boundaries.

Capabilities:

- Stream typed lifecycle events, not raw unstructured UI state.
- Show stages such as `contextualizing`, `reading_board`, `checking_governance`, `drafting_proposal`, `verifying_edges`, and `awaiting_approval`.
- Stream text deltas for read-only responses.
- Stream tool-call trace summaries for read tools.
- Stream draft progress for proposals, but persist only complete validated proposal artifacts.
- Support cancellation from the drawer without corrupting task state.

Acceptance criteria:

1. Read-only chat streams into OPY drawer with cancellable lifecycle state.
2. Stream events persist enough trace metadata for audit and replay.
3. Streaming never applies board changes or bypasses confirmation.
4. A cancelled stream produces a deterministic terminal task state.

### Pillar B: Rig Runtime Modernization

Move from "Rig call sites inside OPY" toward a typed Rig runtime boundary.

Delivered:

- `rig-core 0.40` compatibility, replacing the previous `0.30` pin.
- One Rust-side runtime boundary: [`rig_runtime.rs`](/src-tauri/src/rig_runtime.rs) is the only module that imports `rig`.
- Retained OpenAI prompt and structured-extraction behaviour, with no change to command names, payloads, or user-visible error prefixes.
- A normalized, required usage envelope on every command response, decoded and validated at the Effect boundary in [`ai-agent.runtime.ts`](/src/core/effects/ai-agent.runtime.ts).

Deferred, and not implied by the upgrade: streaming, `AgentRun`, hooks, Rig
conversation memory, Rig vector stores, provider parity beyond OpenAI, and usage
budget persistence.

Remaining capabilities:

- Normalize provider execution for OpenAI, Anthropic, and OpenRouter.
- Extend the runtime boundary to streaming and tool use.
- Persist provider response metadata, token usage, and cost estimates where available.
- Evaluate Rig conversation memory, `rig-memory`, and Rig vector-store/RAG primitives without weakening OPY's app-owned task/session/artifact ledger.
- Preserve Effect Schema validation and OPY policy gates at the app boundary.

Acceptance criteria:

1. OpenAI behavior remains compatible after the Rig upgrade spike.
2. Anthropic and OpenRouter can execute read-only OPY flows when configured and allowed.
3. Provider/model allow-list violations fail before invocation.
4. Token usage and estimated cost are persisted per run when provider data is available.
5. A documented memory boundary decides whether OPY-owned memory, Rig-owned memory, or a hybrid model should drive short-term conversation history and semantic retrieval.
6. Runtime errors map back into existing OPY failure phases.

#### Rig Memory Adoption Spike

Evaluate whether to adopt Rig conversation memory, the `rig-memory` companion crate, and Rig vector-store/RAG primitives for OPY.

Questions:

1. Should Rig own short-term conversation history, or should OPY keep history in its SQLite ledger and pass context explicitly?
2. Should Rig vector stores replace, supplement, or ignore the current Fuse-based retrieval bundle?
3. Can Rig memory preserve OPY requirements for audit, redaction, replay, task resume, checkpoints, and approval gates?
4. Which memory should be durable product memory versus temporary model context?

Acceptance criteria:

1. Document a recommended boundary: OPY-owned memory, Rig-owned memory, or hybrid.
2. Spike one read-only OPY flow with Rig conversation memory or vector retrieval.
3. Confirm replay and audit behavior still works through persisted task artifacts.
4. Confirm redaction and provider policy gates run before memory is sent to the model.

### Pillar C: Diagram-Native Tool Registry

Make OPY a diagram operator, not a chat panel.

Read tools:

- `board_summary`
- `selection_context`
- `node_lookup`
- `edge_lookup`
- `ownership_summary`
- `coupling_summary`
- `azure_sync_summary`
- `decision_memory_search`
- `drift_summary`

Proposal tools:

- `propose_node_create`
- `propose_node_update`
- `propose_edge_create`
- `propose_edge_update`
- `propose_team_ownership_update`
- `propose_layout`
- `propose_checkpoint_restore`

Verification tools:

- `verify_c4_consistency`
- `verify_edge_direction`
- `verify_ownership_coverage`
- `verify_coupling_risk`
- `verify_azure_mapping_confidence`

Acceptance criteria:

1. Every tool has schema-validated input/output.
2. Every mutation-capable tool produces a proposal artifact, never a direct board write.
3. Tool policy metadata includes capability, risk, scope, confirmation requirement, and rollback expectations.
4. Tool execution telemetry includes tool name, args hash, duration, result class, and error class.

### Pillar D: Multi-Alternative Architecture Proposals

Make OPY generate and compare options instead of only producing one answer.

Capabilities:

- Generate 2-3 alternatives for meaningful design/refactor prompts.
- Compare alternatives across C4 clarity, team ownership, coupling, Azure alignment, implementation risk, and confidence.
- Allow the operator to accept one alternative, merge parts, or request a revision.
- Persist rejected alternatives and rationale as decision memory.

Acceptance criteria:

1. OPY can render multiple typed proposal alternatives in one session.
2. Alternatives share a comparable scoring model and evidence bundle.
3. Accepting an alternative creates the same approval/checkpoint path as the current proposal flow.
4. Rejected alternatives remain searchable in decision memory.

### Pillar E: Azure Drift and Reality Reconciliation

Turn Azure sync from import plumbing into architecture intelligence.

Capabilities:

- Compare current board intent with Azure observed topology.
- Identify missing resources, unmanaged resources, unclear mappings, and low-confidence relationships.
- Suggest C4 abstraction improvements instead of importing every resource literally.
- Generate a "reconcile reality" proposal that groups Azure resources into architecture-level nodes and edges.
- Track drift over time by diagram, subscription, resource group, and ownership team.

Acceptance criteria:

1. OPY can explain differences between board and Azure sync result using cited evidence.
2. Drift findings are grouped by severity and confidence.
3. OPY can propose a safe C4-level reconciliation diff.
4. Archive/removal operations remain explicitly confirmed and reversible.

### Pillar F: Decision Memory and Change Ledger

Make architecture memory a first-class product object.

Capabilities:

- Persist accepted, rejected, superseded, and rolled-back proposals as a change ledger.
- Link proposals to board checkpoints, OPY sessions, Azure sync runs, ownership snapshots, and approval metadata.
- Search decision memory from OPY and Settings.
- Export transcript, proposal, diff, rationale, and checkpoint references.
- Pin important decisions to the board or diagram metadata.

Acceptance criteria:

1. Every approved OPY change has a ledger entry with rationale and evidence.
2. Rejected proposals retain enough context to explain why they were rejected later.
3. OPY can cite prior decisions in future recommendations.
4. Users can export a decision packet for review outside the app.

### Pillar G: Release Gates and Budget Governance

Use existing audit/eval signals to decide when stronger automation is allowed.

Capabilities:

- Persist provider usage and cost.
- Add budget thresholds by provider, model, session, and day.
- Define release gates over eval pass rates, replay readiness, confidence, anomaly rate, approval/cancel outcomes, and task latency.
- Gate mutation modes by release readiness rather than manual confidence alone.

Acceptance criteria:

1. Settings shows token/cost usage by provider/model.
2. Budget violations block model invocation with a clear recovery path.
3. Mutation mode can be held behind objective readiness gates.
4. Release gate status is reproducible from persisted OPY audit data.

## 5) Sequenced Roadmap

### Phase 0: Roadmap and Documentation Reconciliation

Goal: make the product direction and existing documentation consistent.

- [ ] Mark this roadmap as the forward-looking OPY product roadmap.
- [ ] Reconcile stale OPY handbook status text around lifecycle/resume implementation.
- [ ] Update the older Team Topologies + Azure Sync roadmap to link here for OPY strategy.
- [ ] Update ADR-008 status from `Proposed` if the implemented architecture now satisfies its core decision.

Exit criteria:

1. Docs agree on current OPY state.
2. Remaining work is clearly separated into platform expansion, product differentiation, and release governance.

### Phase 1: Rig Upgrade Spike

Goal: validate newest Rig capabilities without product-scope churn.

- [x] Upgrade `rig-core` in isolation.
- [x] Verify existing hello, plan, review, extractor, and secret-resolution commands.
- [x] Identify breaking API changes and required Schemars/reqwest adjustments.
- [x] Document provider, streaming, tool, memory, and usage-metadata APIs that are viable for OPY.
- [ ] Complete the Rig Memory Adoption Spike and record the OPY/Rig memory boundary.

Exit criteria:

1. Existing OpenAI OPY flows either pass or have documented required changes.
2. A scoped implementation plan exists for runtime modernization.
3. The team has decided whether Rig memory is a replacement, supplement, or non-goal for OPY.
4. No UX work is mixed into the dependency spike.

### Phase 2: Streaming Read-Only OPY

Goal: make the drawer a live workbench while keeping mutation safety unchanged.

- [ ] Add Rust streaming command for read-only OPY chat.
- [ ] Emit typed stream events over Tauri.
- [ ] Decode stream events through an Effect boundary.
- [ ] Route stream state into the OPY lifecycle machine.
- [ ] Add drawer UI for live stages, text deltas, cancellation, and terminal status.
- [ ] Persist stream task artifacts and terminal state.

Exit criteria:

1. Read-only OPY streams visibly in the drawer.
2. Cancel, retry, timeout, and provider failure are deterministic.
3. No proposal/apply path changes are included in this phase.

### Phase 3: Provider Parity and Usage Persistence

Goal: make provider choice real and measurable.

- [ ] Add executable Anthropic runtime path.
- [ ] Add executable OpenRouter runtime path.
- [ ] Normalize provider capability metadata.
- [ ] Persist token usage and cost estimates where available.
- [ ] Add Settings usage summary and budget controls.
- [ ] Add provider/model eval fixtures.

Exit criteria:

1. OpenAI, Anthropic, and OpenRouter can run read-only OPY flows behind policy gates.
2. Usage data is visible in Settings and persisted for audit.
3. Budget blocks are test-backed.

### Phase 4: Diagram-Native Tool Registry Expansion

Goal: expose the board's architecture intelligence as tools.

- [ ] Add ownership, coupling, selection, Azure, drift, and decision-memory read tools.
- [ ] Add verification tools for C4 consistency, edge direction, ownership coverage, coupling risk, and Azure mapping confidence.
- [ ] Add mutation proposal tools for node, edge, ownership, layout, and reconciliation changes.
- [ ] Persist normalized tool telemetry for each call.
- [ ] Add contract tests for every tool.

Exit criteria:

1. OPY can inspect the board through typed tools beyond the current C4 summary/lookup set.
2. Tool calls are visible in task history and Settings audit.
3. Mutation tools cannot bypass proposal/approval/checkpoint flow.

### Phase 5: Multi-Alternative Change Workbench

Goal: turn OPY from a single-output assistant into a design partner.

- [ ] Add alternative proposal model and persistence.
- [ ] Add comparison scoring across clarity, ownership, coupling, Azure alignment, risk, and confidence.
- [ ] Add UI for accepting, rejecting, revising, and merging alternatives.
- [ ] Link rejected alternatives into decision memory.
- [ ] Add eval fixtures for alternative quality and comparison consistency.

Exit criteria:

1. OPY can produce and compare multiple architecture proposals.
2. Accepted alternatives enter the existing approval/apply/checkpoint path.
3. Rejected alternatives remain searchable and citeable.

### Phase 6: Azure Drift Intelligence

Goal: make cloud reality reconciliation a first-class OPY flow.

- [ ] Define drift summary data model.
- [ ] Compare board state to Azure sync state.
- [ ] Group drift by severity, confidence, ownership, and C4 abstraction level.
- [ ] Add OPY drift review command.
- [ ] Add reconciliation proposal generation.
- [ ] Add Azure-heavy eval fixtures for drift detection and safe reconciliation.

Exit criteria:

1. OPY can explain architecture drift with citations.
2. OPY can propose safe board reconciliation from Azure evidence.
3. Low-confidence Azure mappings remain visible before approval.

### Phase 7: Decision Memory and Release Gates

Goal: turn OPY history into product-level governance.

- [ ] Add architecture change ledger.
- [ ] Add decision search and export.
- [ ] Add board-pinned decisions.
- [ ] Add release gates over eval, confidence, anomaly, replay readiness, approval outcomes, usage, and latency.
- [ ] Use release gates to control stronger mutation defaults.

Exit criteria:

1. Architecture decisions are searchable, exportable, and citeable by OPY.
2. Release readiness is computed from persisted evidence.
3. The product can safely increase automation only when gates pass.

## 6) Moat Map

| Capability | Easy to copy | Hard to copy | Why it matters |
| --- | --- | --- | --- |
| AI diagram generation | Yes | No | Prompt-to-diagram alone is commoditized. |
| Streaming responses | Mostly | No | Streaming improves feel but is not defensible alone. |
| Typed diagram mutation | Medium | Yes | Requires semantic graph model, schemas, policy, and apply safety. |
| Checkpointed approval loop | Medium | Yes | Builds operator trust and recoverability. |
| Ownership/coupling intelligence | No | Yes | Encodes socio-technical architecture knowledge. |
| Azure reality reconciliation | No | Yes | Connects design intent to operational facts. |
| Decision memory and change ledger | No | Yes | Compounds value over time and across sessions. |
| Release gates over agent behavior | No | Yes | Makes automation governable, not just impressive. |

## 7) Non-Goals

- Do not auto-apply architecture changes while streaming.
- Do not treat raw model text as a mutation source.
- Do not add provider support that bypasses keychain/secret diagnostics.
- Do not import every Azure resource as a C4 node without abstraction and confidence review.
- Do not let release-gate language become decorative; gates must be computed from persisted evidence.

## 8) Definition of Done

The roadmap is complete when:

1. OPY can stream read-only work and tool traces in the drawer.
2. OPY can execute supported providers through one policy-aware Rig runtime boundary.
3. OPY can propose, compare, verify, and apply architecture changes with full auditability.
4. OPY can reconcile board intent with Azure observed topology.
5. OPY can cite prior decisions and export decision packets.
6. Mutation automation is governed by objective release gates and budget controls.
