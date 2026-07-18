# Rig, OPY, and Azure Prerequisites Design

**Status**: Approved design

**Date**: 2026-07-18

## Goal

Complete the prerequisite program that makes OPY a stable, modern, and
Azure-informed architecture copilot before starting Architecture Decision
Memory as a new product feature.

The program delivers three dependent outcomes:

1. a compatible, bounded upgrade from `rig-core 0.30` to `0.40`;
2. a stabilized C4-first OPY core with one testable Rig runtime boundary; and
3. Azure sync that is safe, understandable, reliable, architecture-quality,
   and usable as cited read-only evidence by OPY.

## Product Decision

Use a gated foundation-first sequence:

```text
Rig 0.40 upgrade
  -> OPY core stabilization
  -> Azure safety and reliability
  -> Azure product quality
  -> cited OPY Azure intelligence
  -> Architecture Decision Memory
```

Each gate must pass before the next begins. The program does not treat every
new Rig capability as mandatory, and it does not expand OPY mutation scope while
Azure evidence is being made trustworthy.

## Scope

### Included

- Upgrade `rig-core` from `0.30` to `0.40`.
- Preserve and characterize current OPY hello, review, and proposal behavior.
- Centralize Rig execution behind a Rust-side OPY runtime boundary.
- Stabilize the controlled C4 loop: read, review, proposal, confirmation,
  apply, verification, rollback, resume, audit, anomaly screening, and eval.
- Reconcile conflicting OPY, roadmap, and ADR status text.
- Add Azure sync apply safeguards, runtime hardening, and architecture-quality
  C4 mapping.
- Add typed, cited, read-only Azure and drift intelligence to OPY.
- Add user-reviewed, read-only OPY-assisted KQL drafting and execution.

### Deferred

- Architecture Decision Memory implementation; its approved design remains the
  next feature after this program.
- Azure mutation or automatic reconciliation proposals.
- Multi-alternative architecture proposals.
- New provider parity, broad tool families, streaming UX, and Rig-managed
  memory unless a concrete compatibility need arises in the upgrade.
- Automatic changes to OPY mutation defaults based on release-readiness data.

## Gate 1: Rig 0.40 Upgrade

### Characterization Contract

Before changing the dependency, add deterministic Rust-side coverage for:

- `rig_agent_hello` success and configuration failure behavior;
- C4 proposal extraction and validation;
- C4 board-review extraction and validation;
- key-resolution errors without secret disclosure; and
- model, temperature, max-token, retry, and error-envelope normalization.

Live provider calls are optional smoke tests. Compatibility tests must use
fixtures or deterministic fakes and must not require an API key.

### Runtime Boundary

Move direct Rig construction out of `ai_agent.rs` into a focused runtime module.
The boundary owns:

- provider-client construction;
- model selection and provider/model allow-list validation;
- prompt and extractor construction;
- normalized response and provider metadata;
- usage extraction when Rig supplies it; and
- conversion into existing OPY error classes.

`ai_agent.rs` remains the Tauri command adapter and secret-resolution boundary.
It must not become the home for new model-runtime concerns.

### Adoption Posture

Adopt only the Rig 0.40 APIs required for compatibility and future structured
extraction:

- preserve ordinary prompt and structured extractor behavior;
- normalize the current `PromptResponse` and extraction-response shapes;
- capture token usage only when supplied by the provider; and
- make turn budgets explicit where the new Rig semantics differ.

Defer `AgentRun`, hooks, streaming, Rig conversation memory, tool-loop
migration, and vector-store adoption. These are evaluated later against a
specific product need; SQLite remains OPY's durable authority.

### Exit Criteria

- `rig-core 0.40` compiles and all existing behavior-characterization tests
  pass.
- OPY hello, review, and proposal flows preserve current user-visible behavior.
- Provider/model errors map to OPY diagnostics without secrets.
- Usage metadata can enter the existing run/task/artifact trail when present.
- No OPY call site outside the new runtime boundary imports Rig directly.

## Gate 2: OPY Core Stabilization

### Supported Core

OPY remains C4-first and controlled:

```text
read or review
  -> typed proposal
  -> policy check
  -> explicit confirmation
  -> checkpointed apply
  -> verification
  -> rollback or audit/replay
```

### Required Work

- Verify lifecycle transitions, cancellation, timeout, retry, stale-result
  dropping, session switching, and resumable-task recovery end to end.
- Ensure task/session isolation prevents stale results or actions crossing into
  another board or session.
- Join provider metadata and usage with existing tasks, traces, artifacts,
  checkpoints, and audit records rather than creating a competing log.
- Compute release readiness from persisted replay, latency, confidence,
  anomaly, approval, and failure signals without changing action modes yet.
- Reconcile the OPY handbook, Rig task breakdown, ADR-008, and architecture
  roadmap so shipped and deferred scope are stated consistently.

### Exit Criteria

- Every supported OPY intent reaches a deterministic terminal state with a
  visible recovery path.
- Task history reconstructs model metadata, traces, artifacts, checkpoints,
  and usage when available.
- Current C4 mutation safety remains unchanged.
- The release-readiness view is reproducible from persisted evidence.
- Documentation no longer contradicts implementation status.

## Gate 3: Azure Safety and Runtime Reliability

### Safe Apply Contract

Every Azure sync begins with a dry-run that separately reports creates, updates,
archives, and removals.

- `archiveMissing` defaults to off and is selected explicitly per run.
- `maxApplyOperations` blocks oversized applies before state mutation.
- Removal or archive counts require a second explicit confirmation.
- A checkpoint is mandatory before every apply.
- Failure leaves the prior board recoverable through checkpoint restore.

### Execution Contract

The Azure CLI/Resource Graph boundary adds:

- hard timeouts;
- user-initiated cancellation propagated to the subprocess;
- query-duration and page-count telemetry;
- explicit partial-result state; and
- actionable failure classes for missing CLI, missing auth, invalid scope,
  invalid KQL, timeout, decode failure, and partial results.

Partial results are never presented as complete cloud truth.

### Test Contract

Focused coverage proves:

- dry-run and apply idempotency;
- removal confirmation and operation caps cannot be bypassed;
- checkpoints precede applies;
- error classes expose actionable recovery;
- timeout and cancellation leave no partially applied local state; and
- snake_case and camelCase runtime payloads decode safely.

### Exit Criteria

A user can safely dry-run, understand completeness and impact, and apply only a
bounded, explicitly confirmed, checkpointed change.

## Gate 4: Azure Product Quality

### Guided Workflow

The primary Azure experience is a staged drawer:

```text
auth -> choose scope -> dry-run -> review impact -> confirm apply -> result
```

- Saved scopes support common subscriptions, resource groups, and tag filters.
- Advanced KQL remains in an expert disclosure with projection guidance.
- Review uses labelled Create, Update, Archive, and Remove outcomes.
- Preview exposes representative resources, relationships, mapping coverage,
  confidence, warnings, and partial-result state.
- Compact panel mode remains available for repeat operators.

### Architecture-Quality Mapping

- Add explicit and tested C4 rules for common web, compute, data, network,
  identity, and observability resource types.
- Add case-insensitive ownership-tag lookup and configurable tag precedence.
- Add architecture-level grouping for noisy resource clusters when rules support
  it.
- Mark generic fallbacks as visible warnings, not silent success.

### Exit Criteria

A first-time user can complete a safe dry-run without writing KQL, and supported
Azure stacks appear as readable C4 abstractions with uncertainty visible.

## Gate 5: OPY Azure Read Intelligence

Add typed, read-only tools:

- `azure_sync_summary`;
- `azure_resource_lookup`;
- `azure_mapping_confidence`; and
- `azure_drift_summary`.

OPY explanations cite board nodes, Azure resources, mapping and relationship
provenance, confidence, scope, query metadata, and partial-result state. It can
explain a dry-run or drift finding, but it cannot apply Azure changes or create
Azure reconciliation mutations in this program.

### OPY-Assisted KQL Authoring

OPY can draft a `KqlQueryProposal` from a user's plain-language request. The
proposal includes query text, intent, expected fields, inherited scope,
assumptions, suggested result limit, and warnings.

The execution flow is:

```text
user intent
  -> OPY drafts KQL and explanation
  -> user reviews or edits
  -> app validates query and inherited scope
  -> user explicitly runs query
  -> bounded results become cited Azure evidence
```

Safety requirements:

- only read-only Azure Resource Graph queries are executable;
- OPY cannot run shell commands, ARM writes, subscription changes, or arbitrary
  Azure CLI arguments;
- scope is inherited from the active Azure panel or session and cannot be
  silently widened;
- validation enforces query-length, result-limit, timeout, page-limit, and
  supported-construct bounds independently of model output; and
- every result retains scope, source, duration, completeness, and retrieval
  metadata for accurate OPY citations.

The UI adds a Draft with OPY action beside the editable expert KQL editor. A
draft is never sent to Azure until the user explicitly selects Run Query.

### Exit Criteria

- OPY provides cited, read-only Azure explanations and drift summaries.
- OPY produces schema-valid KQL drafts, and every execution has user review.
- Azure query scope and result bounds are enforced independently of OPY.
- Result, timeout, failure, and partial-result states remain visible and
  citeable.

## Program Completion

The prerequisite program completes only when all five gates meet their exit
criteria and repository validation confirms no C4 save, OPY lifecycle, or Azure
apply regressions.

At that point, Architecture Decision Memory is the next product feature. Its
approved hybrid source-library and versioned-ledger design remains unchanged;
only its sequencing is deferred.

## Verification

Verification is proportional to each gate and includes focused Rust, Effect,
XState/UI, database, and docs tests; full frontend and Rust checks at gate
boundaries; and live Azure/provider smoke tests only when safe credentials and
a controlled scope are available. No live test may mutate a board or Azure
resource without the same confirmation and checkpoint protections as the
product.

## Non-Goals

- Broad provider parity or budgets beyond metadata capture.
- Streaming, tool-loop, hook, or memory adoption merely because Rig supports
  them.
- Azure mutation proposals or autonomous reconciliation.
- Architecture Decision Memory implementation during this program.
- Multi-alternative architecture proposals.
- Any automatic elevation of OPY mutation defaults.
