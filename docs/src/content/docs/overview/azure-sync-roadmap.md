---
title: "Roadmap: Azure Sync"
description: "Dedicated roadmap for making Azure sync safe, understandable, agent-ready, and useful for C4 architecture intelligence."
---

# Roadmap: Azure Sync

**Last Updated**: 2026-07-03

**Owner**: Product + Platform Engineering

**Scope Horizon**: 2026-Q3 to 2026-Q4
**Strategic Theme**: Azure sync as the reality layer for agent-supported C4 architecture work.

## 1) Product Thesis

Azure sync should not be a bulk import button. It should be the product's reality check: a governed way to compare intended architecture against observed cloud infrastructure, explain drift, and propose safe C4-level reconciliation.

The moat is the combination of:

1. **Cloud reality**: Azure Resource Graph snapshots, relationship confidence, resource provenance, and sync history.
2. **Architecture intent**: existing C4 diagrams, domain boundaries, ownership, coupling, and design rationale.
3. **Governed application**: dry-run, explicit confirmation, bounded apply, checkpoints, rollback, and audit.
4. **Agentic interpretation**: OPY explains what changed, why it matters, and which architecture-level action is safest.

The goal is to make Azure sync feel like an architecture review assistant, not an infrastructure dump.

## 2) Current Baseline

The current implementation is a strong internal prototype:

1. Tauri invokes Azure CLI and Azure Resource Graph.
2. The frontend can validate auth, query Azure, run a dry-run, apply mapped graph changes, and lay out the Azure subgraph.
3. Sync uses deterministic Azure node and edge IDs.
4. Relationship extraction includes `dependsOn`, selected property references, and ARM parent inference.
5. Relationship source and confidence telemetry are visible in the panel.
6. OPY can receive Azure sync summary context for architecture analysis.

Known gaps:

1. The apply path removes missing Azure nodes and edges without a separate destructive-change confirmation.
2. Runtime options such as `archiveMissing` and `maxApplyOperations` are documented but not implemented.
3. The feature flag and staged rollout controls are documented but not implemented.
4. Azure type-to-C4 mapping is still coarse, with many resource types falling back to generic `system` nodes.
5. Ownership tag precedence is fixed and hidden.
6. Azure CLI execution has pagination guardrails but needs stronger timeout and cancellation behavior.
7. The UX is dense and operator-oriented; it assumes users understand subscription IDs, KQL, delta notation, and relationship confidence.
8. Azure account metadata examples should be scrubbed before documentation is treated as distributable.

## 3) North Star Workflow

The flagship Azure workflow should be:

1. **Connect**
   - User checks Azure CLI availability and account status.
   - The app shows subscription, tenant, and principal presence without exposing unnecessary account metadata.

2. **Choose Scope**
   - User selects saved scopes or enters subscription IDs, resource groups, and tag filters.
   - Advanced KQL remains available but is clearly marked as expert mode.

3. **Preview Reality**
   - Azure sync runs a bounded dry-run.
   - The UI shows resources, relationships, mapping coverage, confidence, warnings, and deltas before any mutation.

4. **Review Architecture Impact**
   - OPY explains what changed, what is low confidence, what is missing from the board, and what would be removed.
   - Users can inspect sample resources and mapped C4 abstractions.

5. **Confirm Apply**
   - The app requires explicit confirmation for removals, archives, or large applies.
   - Apply creates a checkpoint, persists the updated diagram, and records sync provenance.

6. **Reconcile Over Time**
   - Later syncs compare board intent to Azure reality and produce drift findings.
   - OPY can propose architecture-level reconciliation instead of literal resource import.

## 4) Roadmap Pillars

### Pillar A: Safety and Rollout Controls

Make Azure sync safe by default before expanding scope.

Capabilities:

- Add `azure_sync_v1` staged rollout control.
- Add `archiveMissing` and default it to off until the user explicitly enables it for a run.
- Add `maxApplyOperations` and abort with clear diagnostics when exceeded.
- Require explicit confirmation when node or edge archive/removal counts are non-zero.
- Create a checkpoint before every apply.
- Keep destructive apply behavior reversible through existing save history.

Acceptance criteria:

1. A dry-run with removals cannot be applied without a separate confirmation step.
2. Large applies stop before mutation when they exceed the configured operation cap.
3. Re-running an unchanged scope produces zero net entity delta.
4. Rollout state is visible in Settings or diagnostics.

### Pillar B: Guided Azure Sync UX

Replace the current operator panel with a more conventional guided experience while keeping the compact panel available.

Capabilities:

- Provide a drawer or staged panel flow: auth, scope, preview, review, confirm, result.
- Add saved scopes for common subscriptions/resource groups/tag filters.
- Explain delta notation with labels such as `Create`, `Update`, and `Remove`.
- Show preview rows for representative resources and relationships.
- Show a trust summary for mapping coverage, relationship confidence, inferred relationships, and partial pagination.
- Keep advanced KQL behind an expert disclosure with required projection guidance.

Acceptance criteria:

1. A first-time user can run a safe dry-run without understanding KQL.
2. Apply risk is visible before the apply button is enabled.
3. Low-confidence sync results produce visible warnings and suggested next steps.
4. The compact widget mode remains available for experienced users.

### Pillar C: Mapping Fidelity

Raise Azure-to-C4 mapping quality so imported topology reads like architecture, not inventory.

Capabilities:

- Expand the Azure resource type mapping table.
- Distinguish C4 system, container, component, and external system mappings more carefully.
- Add resource-specific labels, descriptions, and technology strings.
- Make ownership tag precedence configurable.
- Support case-insensitive tag lookup and documented defaults.
- Group implementation-level Azure resources into architecture-level abstractions where appropriate.

Acceptance criteria:

1. At least 90% of supported sample resources map through an explicit rule instead of generic fallback.
2. Ownership mapping can be configured without code changes.
3. Generated diagrams avoid unnecessary resource-level clutter for common Azure app stacks.
4. Mapper behavior is covered by focused fixtures and tests.

### Pillar D: Runtime Reliability

Make Azure sync predictable across tenants, slow networks, and CLI failures.

Capabilities:

- Add timeout and cancellation around Azure CLI subprocesses.
- Surface pagination limits, partial-result warnings, and query duration.
- Normalize Azure CLI failure classes into clear user diagnostics.
- Add smoke coverage for pagination guardrails.
- Add runtime decode tests for snake_case and camelCase payloads.
- Add idempotency tests for dry-run and apply.

Acceptance criteria:

1. Long-running Azure CLI calls can be cancelled from the UI.
2. Partial results are clearly labeled and never look like complete syncs.
3. Auth, query, decode, mapping, diff, and apply failures are diagnosable from the UI.
4. Runtime and integration tests cover the critical sync lifecycle.

### Pillar E: OPY Azure Intelligence

Turn Azure sync into agentic architecture support.

Capabilities:

- Add OPY read tools for Azure sync runs, mapping confidence, drift findings, and resource lookup.
- Ask OPY to explain dry-run results in architecture language.
- Generate drift summaries grouped by severity, ownership, resource group, and confidence.
- Let OPY propose C4-level reconciliation plans that still flow through normal approval gates.
- Persist sync summaries as decision memory inputs.

Acceptance criteria:

1. OPY can explain what an Azure dry-run means without applying changes.
2. ~~OPY can cite board nodes, Azure resources, and sync telemetry in its answer.~~ **Met 2026-08-01.** `agent-tools/azure-tools.ts` adds `azure_resource_lookup` and `azure_sync_summary`, and `RigAgentCitation` was widened so their results cite like board evidence. Both read persisted data — provenanced nodes and the sync run trail — so a citation survives a reload.
3. OPY mutation proposals remain typed, checkpointed, and explicitly approved.
4. Rejected reconciliation proposals remain available as decision memory.

## 5) Milestone Plan

### Milestone 1: Hygiene and Safety

Objective: make current Azure sync safe enough to keep iterating.

Checklist:

- [ ] Replace real Azure account identifiers in docs with placeholders.
- [ ] Add `archiveMissing` to the apply path.
- [ ] Add explicit removal/archive confirmation.
- [ ] Add `maxApplyOperations`.
- [ ] Add a checkpoint-before-apply assertion.
- [ ] Add targeted apply and idempotency tests.

Exit criteria:

1. No Azure sync apply can remove board entities without clear user confirmation.
2. Docs no longer expose real tenant, subscription, or principal metadata.
3. Apply failure leaves the prior board state recoverable.

### Milestone 2: Guided UX

Objective: make Azure sync understandable for non-expert users.

Checklist:

- [ ] Add staged drawer flow for auth, scope, preview, review, and confirm.
- [ ] Add saved sync scopes.
- [ ] Replace compact delta notation with labeled risk summaries.
- [ ] Add preview tables for resources and relationships.
- [ ] Add expert-mode guidance for custom KQL projections.
- [ ] Preserve compact widget/panel mode for repeat operators.

Exit criteria:

1. Dry-run is usable without editing KQL.
2. Apply risk is summarized before confirmation.
3. A user can understand why a relationship is high, medium, or low confidence.

### Milestone 3: Mapping and Ownership

Objective: produce architecture-quality C4 diagrams from Azure reality.

Checklist:

- [ ] Expand resource type mapping fixtures.
- [ ] Add explicit mapping rules for common web, compute, data, network, identity, and observability resources.
- [ ] Add configurable ownership tag precedence.
- [ ] Add case-insensitive tag lookup.
- [ ] Add architecture-level grouping rules for noisy resource clusters.
- [ ] Add mapper coverage tests.

Exit criteria:

1. Supported Azure app stacks produce readable C4-level diagrams.
2. Ownership gaps are visible and explainable.
3. Generic fallback mappings are treated as warnings, not silent success.

### Milestone 4: Runtime Hardening

Objective: make sync reliable across real tenant sizes and failure modes.

Checklist:

- [ ] Add timeout handling around Azure CLI calls.
- [ ] Add cancellation from the UI.
- [ ] Add query duration and page-count telemetry.
- [ ] Add partial-result UX and tests.
- [ ] Add decode tests for auth, query, and snapshot payloads.
- [ ] Add failure-class diagnostics for CLI missing, auth required, invalid scope, invalid KQL, timeout, and partial results.

Exit criteria:

1. The UI never hangs indefinitely on Azure CLI calls.
2. Partial results cannot be mistaken for complete architecture truth.
3. Support diagnostics are specific enough to act on.

### Milestone 5: OPY Reconciliation

Objective: make Azure sync a first-class agentic architecture workflow.

Checklist:

- [ ] Add Azure sync read tools to OPY's tool registry.
- [ ] Add drift summary documents to retrieval.
- [ ] Add OPY prompts for Azure dry-run explanation.
- [ ] Add typed reconciliation proposal artifacts.
- [ ] Add proposal approval, checkpoint, rollback, and ledger linkage.
- [ ] Add evaluation cases for safe and unsafe reconciliation suggestions.

Exit criteria:

1. OPY can explain Azure drift and confidence using cited evidence.
2. OPY can propose a C4 reconciliation plan without bypassing policy gates.
3. Approved and rejected reconciliation decisions become searchable architecture memory.

## 6) Definition of Done

Azure sync is product-ready when:

1. It is safe by default.
2. It explains what it observed and how confident it is.
3. It maps cloud resources into useful architecture abstractions.
4. It gives users clear control over destructive changes.
5. It can feed OPY with enough evidence to support agentic diagram review and reconciliation.
6. It leaves an audit trail that connects Azure reality, C4 intent, user approval, and board history.
