# Architecture Decision Memory Design

**Status**: Approved design

**Date**: 2026-07-14

## Goal

Make architecture decisions durable product knowledge in `c4-board`. Users can
import existing decision evidence, review OPY's structured interpretation, and
explicitly confirm versioned decision records that future OPY analysis can
search and cite.

Architecture Decision Memory follows the Rig/OPY/Azure prerequisite program
defined in `2026-07-18-rig-opy-azure-prerequisites-design.md`, and precedes the
multi-alternative architecture workbench. Alternatives become more valuable once
OPY can evaluate them against the organization's accepted, rejected, deprecated,
and superseded decisions.

## Product Decision

Use a hybrid decision ledger and immutable source library.

Imported material is evidence, not an accepted decision. Every import creates
an immutable source snapshot. OPY may extract one or more editable decision
drafts, but only an explicit user confirmation promotes a reviewed draft into
durable decision memory.

V1 accepts:

- local Markdown ADR files and directories;
- pasted text; and
- public HTTP or HTTPS URLs.

SQLite remains the source of truth for sources, drafts, confirmed decisions,
versions, links, and status. Rig supports bounded structured extraction and
model invocation; Rig conversation memory or vector-store state does not own
decision lifecycle or authority.

## Product Boundary

Architecture Decision Memory is a first-class OPY workspace, not a transcript
subsection. Its product promise is:

> Bring existing architecture decisions into c4-board, review OPY's
> interpretation, and create durable decision records that future analysis can
> cite.

The core workflow is:

```text
acquire source
  -> normalize and snapshot
  -> extract decision drafts
  -> validate and resolve references
  -> human review and editing
  -> explicit per-decision confirmation
  -> versioned decision record
  -> status-aware OPY retrieval
```

V1 does not bulk-confirm decisions, automatically accept extracted material,
automatically resolve conflicts, or let a model promote its own draft.

## Domain Model

### Decision Source

A `DecisionSource` records the stable identity and acquisition method of
imported evidence. A `DecisionSourceSnapshot` preserves the exact normalized
content used for extraction together with:

- source type;
- display title;
- local relative path or canonical URL when applicable;
- retrieval or import time;
- content type;
- content hash;
- original content; and
- acquisition diagnostics.

Repeated content is deduplicated by content hash. A changed file or URL creates
a new snapshot rather than rewriting the earlier source evidence.

### Decision Draft

A `DecisionDraft` is recoverable working state. It contains OPY's extracted
fields, source evidence spans, confidence, unresolved questions, validation
warnings, and tentative scope links. Users can edit, split, merge, reject,
defer, or confirm drafts.

Drafts have no authority in OPY retrieval unless a user explicitly asks to
inspect work in progress.

### Architecture Decision

The canonical record has this conceptual shape:

```ts
interface ArchitectureDecision {
  id: ArchitectureDecisionId;
  version: number;
  title: string;
  status:
    | "proposed"
    | "accepted"
    | "rejected"
    | "deprecated"
    | "superseded";
  context: string;
  decision: string;
  rationale: string;
  alternatives: ReadonlyArray<DecisionAlternative>;
  consequences: ReadonlyArray<DecisionConsequence>;
  risks: ReadonlyArray<DecisionRisk>;
  scope: DecisionScope;
  sourceRefs: ReadonlyArray<DecisionSourceRef>;
  supersedes: ReadonlyArray<ArchitectureDecisionId>;
  decidedAt?: string;
  confirmedAt: string;
  confirmedBy: "local-user";
  extractionConfidence: number;
  unresolvedQuestions: ReadonlyArray<string>;
}
```

Confirmation creates an append-only version. Later corrections create another
version rather than modifying history. The current projection points at the
active version. Deprecation and supersession are explicit lifecycle changes,
not deletion or overwrite operations.

### Decision Scope

Scope links connect decisions to known product objects when evidence supports
the relationship:

- diagrams;
- nodes and edges;
- systems and teams;
- Azure resources or scopes;
- tags; and
- free-form architecture domains.

Unresolved links remain visible. Extraction must not invent product IDs or
silently substitute similarly named entities.

## Source Acquisition

### Local Markdown

Users can select one `.md` or `.mdx` file or a directory. Directory import
discovers supported files recursively, preserves relative paths and
frontmatter, hashes normalized content, and reports skipped or duplicate files.

### Pasted Text

Pasted content is preserved exactly. The user supplies a title or accepts an
editable OPY-suggested title. The source is recorded as a local paste and never
receives invented external provenance.

### Public URLs

URL acquisition runs through a Rust/Tauri boundary. It accepts only public
HTTP and HTTPS targets and enforces:

- DNS and resolved-address checks against loopback, link-local, private,
  reserved, and local-network destinations;
- redirect limits with the same checks applied to every target;
- response-size and request-duration limits;
- an allow-list of text and document content types supported by the
  normalizer;
- rejection of local-file and unsupported protocols; and
- snapshotting of normalized content, canonical URL, retrieval time, content
  type, hash, and diagnostics.

URL changes create new snapshots. They do not alter decisions derived from an
earlier snapshot.

## Extraction and Human Review

Rig receives redacted, size-bounded source content and returns schema-constrained
drafts. Extraction can legitimately return zero, one, or multiple decisions.

Every extracted field includes enough provenance to trace it to source evidence
where practical. The extraction result also carries:

- overall and field-level confidence where useful;
- unresolved questions;
- ambiguous status or date warnings;
- uncertain product-scope links; and
- missing rationale, alternatives, consequences, or risk warnings.

The review surface presents source evidence beside an editable decision draft.
Confirmation is per decision. Split and merge operations preserve all source
links and record which extraction drafts contributed to the confirmed record.

Fetch, extraction, validation, indexing, and persistence failures preserve the
last completed source or draft state. Retry resumes at the failed boundary and
does not repeat successful external work unnecessarily.

## Architecture and Ownership

### Rust and Tauri

Rust owns:

- constrained URL retrieval;
- local file and directory access;
- content normalization and hashing;
- provider and secret resolution;
- Rig model invocation; and
- bounded structured extraction.

Decision work should not enlarge `src-tauri/src/ai_agent.rs` indefinitely.
Focused modules should separate source acquisition, extraction, and command
registration, for example `decision_source.rs`, `decision_extraction.rs`, and
`decision_commands.rs`.

### Effect Domain Layer

Effect owns canonical schemas, validation, orchestration services, confirmation
policy, transactions, and retrieval projections. Every Rust response and every
model-produced value is untrusted until decoded through Effect Schema.

The domain layer validates status transitions, dates, scope references,
supersession cycles, version sequencing, and source provenance before
persistence.

### Persistence

The initial SQLite model uses focused tables for:

- `architecture_decision_sources`;
- `architecture_decision_source_snapshots`;
- `architecture_decision_drafts`;
- `architecture_decisions`;
- `architecture_decision_versions`;
- `architecture_decision_source_links`; and
- `architecture_decision_scope_links`.

Confirmation, version creation, current-version projection, source links, and
scope links commit transactionally. Source snapshots and confirmed versions are
append-only product history.

### XState and UI

A dedicated import/review machine owns acquisition, extraction, review,
validation, confirmation, retry, cancellation, and recovery. OPY chat consumes
confirmed decisions through typed read tools; the transcript does not own the
import lifecycle.

Initial tools are:

- `decision_search`;
- `decision_get`;
- `decision_sources`;
- `decision_conflicts`; and
- `decision_draft_extract`.

Read tools cannot promote a draft. Confirmation remains a user-initiated product
command governed outside the model tool loop.

## Retrieval and Conflict Handling

Decision retrieval considers explicit scope, semantic relevance, status,
version, recency, supersession, source confidence, and extraction confidence.
OPY distinguishes active accepted decisions from proposed, rejected,
deprecated, and superseded records.

OPY citations link the confirmed record and its immutable source snapshot. If a
confirmed record interprets ambiguous source material, the response distinguishes
the user's confirmed interpretation from the original evidence.

The product detects but does not automatically resolve:

- incompatible accepted decisions in overlapping scope;
- imports that appear to supersede existing decisions without a declared link;
- accepted decisions that conflict with the current board; and
- newer snapshots whose source content differs from the evidence previously
  reviewed.

Users can relate, revise, supersede, or leave findings unresolved. Conflict
detection never silently changes status or current-version selection.

## Delivery Slices

### Slice 1: Domain Foundation

- Define source, snapshot, draft, decision, version, scope, and relationship
  schemas.
- Add migrations and persistence services.
- Implement append-only versions and explicit supersession.
- Add fixture-based schema, migration, and repository tests.

Exit: decisions can be created, versioned, linked, queried, and reconstructed
without Rig or UI dependencies.

### Slice 2: Markdown and Pasted-Text Import

- Add file, directory, and pasted-text acquisition.
- Snapshot, hash, and deduplicate content.
- Add schema-validated Rig extraction.
- Persist recoverable drafts.

Exit: supported local imports produce editable drafts but cannot create
confirmed decisions.

### Slice 3: HITL Review and Confirmation

- Add the import/review machine and evidence-versus-draft UI.
- Support edit, split, merge, reject, defer, and per-decision confirmation.
- Surface unresolved questions, validation warnings, and uncertain references.

Exit: only explicit user confirmation promotes a reviewed draft into versioned
memory.

### Slice 4: URL Ingestion

- Add constrained HTTP and HTTPS fetching.
- Enforce address, redirect, size, duration, protocol, and content-type limits.
- Persist snapshots and retrieval provenance.

Exit: unsuitable or malicious URLs fail safely without losing import state.

### Slice 5: OPY Retrieval

- Add decision search, record, source, and conflict tools.
- Include status-aware decision evidence in OPY context assembly.
- Render citations and supersession warnings.
- Add retrieval and conflict evaluation fixtures.

Exit: OPY cites applicable decisions and clearly distinguishes every lifecycle
status.

## Testing and Verification

Coverage includes:

- schema and migration compatibility;
- append-only history and current-version projection;
- duplicate imports and changed-source snapshots;
- malformed and adversarial extraction output;
- authorization of confirmation transitions;
- split and merge provenance;
- URL SSRF and resource-limit controls;
- retrieval ranking by status, scope, and supersession;
- conflict detection;
- replay and audit reconstruction; and
- redaction before provider invocation.

Each delivery slice runs the repository's proportionate frontend, Rust,
database, and docs checks. Read-only extraction fixtures should make core
parsing and validation deterministic without requiring live provider calls.

## Roadmap Reconciliation

Architecture Decision Memory becomes the next forward OPY feature stream after
the approved Rig/OPY/Azure prerequisite program. The existing Architecture
Change Intelligence roadmap should be revised so:

1. documentation reconciliation remains the immediate housekeeping slice;
2. the prerequisite program delivers the Rig `0.30` to current-stable upgrade,
   OPY core stabilization, and safe/cited Azure intelligence first;
3. Architecture Decision Memory then precedes multi-alternative proposals;
4. decision search and conflict detection precede automatic use in mutation
   proposals; and
5. the multi-alternative workbench becomes the first major consumer of durable
   decision memory.

ADR-008 should be updated from `Proposed` once its implemented core decision is
verified against the current code. A separate ADR should capture decision-memory
authority, append-only versioning, immutable evidence, and the HITL promotion
boundary before implementation planning if those choices are considered
architecturally binding.

## Non-Goals

- Automatic acceptance or bulk confirmation of extracted decisions.
- Automatic conflict resolution or silent supersession.
- Treating Rig memory, embeddings, or chat transcripts as authoritative
  decision state.
- Importing authenticated or private web sources in V1.
- Supporting arbitrary binary office formats in V1.
- Multi-user identity, permissions, or remote collaboration in V1.
- Generating and comparing architecture alternatives in the first five slices.
- Automatically applying board mutations from imported decisions.

## Definition of Done

V1 is complete when a user can import Markdown, pasted text, or a safe public
URL; review and edit schema-valid extracted drafts; explicitly confirm versioned
decisions; inspect immutable source provenance; search decisions from OPY with
status-aware citations; and see unresolved conflicts without any model or import
path bypassing the human confirmation boundary.
