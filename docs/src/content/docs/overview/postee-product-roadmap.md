---
title: "Postee Product Roadmap"
description: "Standalone roadmap for evolving Postee into a trustworthy, local-first API workbench with excellent request UX, native performance testing, and optional C4 and OPY intelligence."
---

# Postee Product Roadmap

**Status:** Active

**Product surface:** Postee

**Current route:** `/postee`

## Product Position

Postee is a first-class, local-first API workspace within c4-board. It must be
useful as an independent professional HTTP client without requiring a diagram,
an OPY session, or a cloud account.

The product target is not feature-for-feature imitation of Postman. Postee must
first provide a credible, dependable REST workflow, then differentiate through:

- native Tauri execution and local ownership of data;
- integrated Rust load testing and performance evidence;
- response baselines, comparisons, and repeatable verification;
- optional links between requests and C4 architecture;
- optional OPY assistance for authoring, diagnosis, and architecture review.

## Current Baseline

Postee already has a substantial implementation:

- collection and request persistence in SQLite;
- request methods, URL validation, cancellation, and timeouts;
- environments, variable substitution, and secret-marked values;
- response body and header inspection;
- JSON search, contextual copy actions, baselines, and diffs;
- execution history with filtering, pagination, inspection, comparison, and CSV
  export;
- a native Rust load engine with concurrency, duration, RPS limiting, HDR
  percentiles, errors, throughput, and live charts;
- Effect-based domain modules, XState orchestration, React Aria controls, and a
  focused Postee test suite.

The current product is mature in capability breadth but transitional in
workflow coherence and lifecycle correctness.

### Material Gaps

1. Request body and header controls are disconnected from durable request state
   and execution.
2. Non-JSON response bodies are not safely retained in history.
3. Optimistic mutations can silently diverge from SQLite after persistence
   failures.
4. Secret-marked environment values are stored as plaintext.
5. Load tests do not inherit the complete prepared request and cannot be
   cancelled after starting.
6. The collection-first empty state prevents immediate scratch requests.
7. Request, response, history, environment, and load-test activities appear as
   separate tools rather than one request lifecycle.
8. Request selection and panel state are split between React-local state and the
   workspace machine.
9. Request authoring lacks first-class parameters, authentication, body modes,
   cookies, and common import paths.
10. Existing tests do not prove the full edit, save, reload, execute, inspect,
    and replay lifecycle.

## Product Principles

### Start With a Request

A user must be able to open Postee, enter a URL, and send a scratch request
without first creating or selecting a collection. Organisation follows intent;
it does not block it.

### One Request Workbench

Request authoring, execution, response inspection, history, and performance
testing belong to one stable workspace. Switching views must not move or discard
the active request.

### Honest State

Saved, saving, dirty, failed, cancelled, and running are explicit product
states. The interface must never claim persistence or execution that did not
occur.

### Progressive Power

The default REST workflow remains compact. Advanced authentication, scripts,
comparison, load testing, and architecture evidence appear when relevant rather
than competing with the primary Send action.

### Local-First Security

Requests, collections, history, and performance data remain usable offline.
Secrets are excluded from portable artefacts and backed by an OS-protected
secret store or encrypted reference model.

### Optional Architecture Intelligence

C4 and OPY features enrich Postee but do not gate it. Every architecture-aware
workflow must preserve a direct, conventional API-client path.

## Target Workspace Model

```text
Postee Workspace
  -> workspace command bar
       -> new/import request
       -> active environment
       -> search and command palette
  -> collection navigator
       -> collections and folders
       -> saved requests
       -> history and environments
  -> request tab strip
       -> scratch and saved requests
       -> dirty/saving/error state
  -> request workbench
       -> method + URL + Send
       -> Params | Auth | Headers | Body | Scripts
  -> resizable result pane
       -> Response | Headers | Cookies | Timeline
       -> History | Tests | Performance
```

The request bar and active request tab remain visible while the result pane
changes. The navigator and result pane are independently collapsible and
resizable. Layout state is restored without making viewport layout part of the
request domain model.

## Sequenced Workstreams

## Workstream 1: Trustworthy Request Workbench

**Priority:** P0

**Outcome:** The primary Postee workflow is cohesive, durable, and immediately
usable. This is the first delivery stream.

### 1.1 Request Lifecycle Integrity

- [ ] Introduce one durable request draft model for method, URL, parameters,
      headers, authentication, body, environment, and dirty state.
- [ ] Load request headers and body when the active request changes.
- [ ] Persist request metadata, headers, and body atomically before reporting a
      saved state.
- [ ] Execute the exact active draft or require an explicit save according to a
      documented policy.
- [ ] Store arbitrary text, JSON, HTML, XML, and binary response metadata
      without forcing response bodies through SQLite JSON validation.
- [ ] Surface persistence failures and provide retry without discarding the
      draft.
- [ ] Replace fire-and-forget mutations with observable Effect workflows.
- [ ] Reconcile visual selection, active request identity, and machine state.
- [ ] Add lifecycle integration tests covering edit, save, reload, execute,
      history, and replay.

### 1.2 Immediate Request UX

- [ ] Open Postee with a ready scratch request tab.
- [ ] Allow Send before a collection exists.
- [ ] Add explicit New Request and Import actions.
- [ ] Keep method, URL, environment, Send, Save, and Cancel in one stable command
      row.
- [ ] Provide clear dirty, saving, saved, running, cancelled, and failed states.
- [ ] Ask for a collection only when the user saves a scratch request.
- [ ] Replace passive empty space with useful quick starts: HTTP request, cURL
      import, OpenAPI import, and recent request.

### 1.3 Request Tabs and Split Workspace

- [ ] Add accessible request tabs with close, reopen, reorder, overflow, and
      keyboard navigation.
- [ ] Preserve unsaved draft state while switching requests.
- [ ] Add a resizable request/result split with horizontal and vertical modes.
- [ ] Persist panel sizes and collapsed state per workspace.
- [ ] Move Response, History, and Performance from header toggles into the
      result pane.
- [ ] Keep the active request bar visible while inspecting any result view.
- [ ] Provide narrow-window behaviour without overlapping controls or losing
      the Send action.

### 1.4 Navigator and Environment Context

- [ ] Reduce the permanent brand/navigation footprint in the collection rail.
- [ ] Make request creation more prominent than collection creation.
- [ ] Separate collection selection from multi-select management actions.
- [ ] Add request rename, delete, duplicate, move, and Save As actions.
- [ ] Move active environment selection to the workspace command bar.
- [ ] Move environment editing into a dedicated workspace view or dialog.
- [ ] Preserve active collection expansion and request selection across reloads.

### Acceptance Gate

Workstream 1 is complete when:

1. A new user can send a scratch GET request without creating anything first.
2. Header and body edits survive request switching and application restart.
3. The executed request exactly matches the visible request draft.
4. Plain-text and HTML responses appear in both the response viewer and history.
5. Failed persistence remains visible and recoverable.
6. Five open request tabs retain independent dirty and response state.
7. Response, history, and performance views do not displace the request editor.
8. The complete lifecycle has automated Effect, machine, component, and
   Tauri-backed integration coverage.

## Workstream 2: Complete REST Authoring

**Priority:** P1

**Outcome:** Postee meets the expected request-authoring baseline of a
professional REST client.

### 2.1 Parameters and URL

- [ ] Add enabled query and path parameter tables with descriptions.
- [ ] Keep URL and parameter-table edits synchronised in both directions.
- [ ] Show resolved and unresolved environment substitutions before Send.
- [ ] Support bulk edit, URL encoding, duplicate keys, and stable ordering.

### 2.2 Authentication

- [ ] Add None, Basic, Bearer Token, and API Key authentication.
- [ ] Support inheritance from collection and folder scope.
- [ ] Add OAuth 2.0 only after a dedicated flow and token-storage ADR.
- [ ] Prevent credentials from appearing in logs, history exports, portable
      collections, and OPY prompts by default.

### 2.3 Headers, Body, and Cookies

- [ ] Add generated versus user-defined header visibility.
- [ ] Add no-body, JSON, text, XML, form URL encoded, multipart, and binary
      modes.
- [ ] Infer content type while allowing an explicit override.
- [ ] Add file references with missing-file diagnostics.
- [ ] Add a local cookie jar with clear domain and expiry visibility.
- [ ] Make redirect, certificate, proxy, and timeout policy explicit.

### Acceptance Gate

1. A saved request round-trips every supported authoring field.
2. URL and parameter editing cannot silently disagree.
3. Authentication inheritance is visible and overridable.
4. Secret values are redacted from logs, history, exports, and diagnostics.
5. Request previews show the effective method, URL, headers, and body before
   execution.

## Workstream 3: Collections, Navigation, and Portability

**Priority:** P1

**Outcome:** Requests are easy to organise, find, migrate, and version.

- [ ] Add nested folders with drag, move, duplicate, and bulk operations.
- [ ] Add favourites, recents, saved searches, and request-level search.
- [ ] Add request and collection descriptions without crowding the run surface.
- [ ] Import cURL from clipboard or text.
- [ ] Copy the effective request as cURL.
- [ ] Import Postman Collection v2.1 and common Postman environment files.
- [ ] Import OpenAPI 3.0 and 3.1 from file, clipboard, or URL.
- [ ] Export a documented, versioned Postee collection format.
- [ ] Exclude secrets and machine-local file paths from portable exports.
- [ ] Evaluate a Git-friendly filesystem representation through a dedicated ADR.
- [ ] Report import warnings, unsupported fields, and lossy conversions before
      committing imported data.

### Acceptance Gate

1. A user can migrate a representative Postman collection and environment
   without hand-recreating requests.
2. Import is previewable and cancellable.
3. Exported Postee collections round-trip without IDs leaking across workspaces.
4. Portable artefacts are deterministic, reviewable, and secret-free.

## Workstream 4: Response Evidence and Verification

**Priority:** P1

**Outcome:** Postee turns executions into inspectable, repeatable evidence.

- [ ] Present response Body, Headers, Cookies, and Timeline as stable tabs.
- [ ] Add pretty, raw, preview, hexadecimal, and image-safe body views where
      appropriate.
- [ ] Add response search, copy, download, truncation, and large-body policy.
- [ ] Preserve request and response snapshots with clear retention controls.
- [ ] Replay a history entry as a new draft without overwriting the saved
      request.
- [ ] Filter history by request, collection, environment, status, and time.
- [ ] Compare status, headers, timing, size, and body rather than body alone.
- [ ] Promote a history entry to a named baseline or saved example.
- [ ] Add declarative assertions for status, headers, JSON paths, duration, and
      schema shape.
- [ ] Display assertion results next to the response and retain them in history.

### Acceptance Gate

1. Any retained execution can be inspected, compared, replayed, or promoted to
   a baseline.
2. Large and non-text responses cannot freeze the workspace.
3. Comparison makes every changed response dimension explicit.
4. Assertions run deterministically and retain actionable failure evidence.

## Workstream 5: Collection Runner and Automation

**Priority:** P2

**Outcome:** Saved requests become repeatable verification workflows.

- [ ] Run a request, folder, or collection in defined order.
- [ ] Select an environment and provide per-run variable overrides.
- [ ] Support iterations, delays, stop-on-failure, and request filtering.
- [ ] Pass explicitly selected response values into later requests.
- [ ] Add pre-request and post-response scripting only after defining a
      constrained sandbox and capability policy.
- [ ] Import data rows from JSON and CSV.
- [ ] Produce a durable run report with request, assertion, timing, and error
      summaries.
- [ ] Define a headless command for CI after the collection format stabilises.
- [ ] Keep CI output secret-redacted and machine-readable.

### Acceptance Gate

1. The same collection and environment produce equivalent desktop and headless
   results.
2. Runs can be cancelled and resumed only where semantics are explicit.
3. Script execution has documented filesystem, network, environment, and secret
   boundaries.
4. CI exits non-zero on failed requests or assertions and emits a retained
   report.

## Workstream 6: Native Performance Workbench

**Priority:** P2

**Outcome:** Postee converts a verified request into controlled, comparable
performance evidence.

- [ ] Build a load profile from the complete effective request, including
      headers, body, authentication, and environment resolution.
- [ ] Add immediate cancellation from UI through the Tauri command boundary.
- [ ] Replace theatrical warnings with concise target, duration, concurrency,
      and risk confirmation.
- [ ] Add environment-aware safety rules and explicit production-target
      confirmation.
- [ ] Save named load profiles without duplicating request data.
- [ ] Define pass/fail budgets for error rate, throughput, and p50/p95/p99
      latency.
- [ ] Retain, compare, annotate, and export load-test runs.
- [ ] Correlate recent errors with the request configuration used for the run.
- [ ] Add warm-up, ramp, steady-state, and cool-down stages.
- [ ] Prove worker cleanup, cancellation, bounded memory, and event-listener
      disposal in Rust and UI tests.

### Acceptance Gate

1. A load run reproduces the selected request exactly.
2. Cancel stops new traffic promptly and reaches a terminal UI state.
3. Saved performance evidence records configuration, environment identity,
   metrics, thresholds, and result.
4. Production-like targets require an explicit, reviewable safety decision.

## Workstream 7: C4 and OPY Differentiation

**Priority:** P2 after the REST credibility floor

**Outcome:** Postee provides architecture-aware API verification without losing
its standalone workflow.

### 7.1 C4 Evidence Links

- [ ] Link a saved request, collection, baseline, assertion suite, or load
      profile to a C4 node or relationship.
- [ ] Open linked Postee artefacts from node details without losing the current
      workspace.
- [ ] Show last verified status and evidence age without presenting one request
      as complete service health.
- [ ] Detect links to deleted or changed architecture elements.
- [ ] Keep evidence links portable through stable logical identities.

### 7.2 OPY Assistance

- [ ] Generate a reviewable request draft from endpoint intent, OpenAPI, or a C4
      relationship.
- [ ] Explain failures using redacted request, response, history, and
      architecture context.
- [ ] Suggest assertions and performance budgets as proposals.
- [ ] Draft collection organisation and environment-variable mappings.
- [ ] Require confirmation before OPY saves, sends, imports, runs a collection,
      or starts a load test.
- [ ] Record input evidence, proposal, confirmation, execution, and result in
      the existing OPY audit model.

### 7.3 Architecture Verification

- [ ] Compare declared C4 protocols and endpoints with observed Postee evidence.
- [ ] Surface stale, failing, or unverified relationships as review findings.
- [ ] Generate an architecture verification report from explicit evidence.
- [ ] Never infer service identity, ownership, production health, or compliance
      from an uncorroborated request result.

### Acceptance Gate

1. Postee remains fully usable when C4 and OPY features are disabled.
2. Every architecture claim links to retained evidence and its timestamp.
3. Agent-generated requests and tests remain drafts until explicitly confirmed.
4. Secrets and unrelated workspace context never enter provider prompts.

## Workstream 8: Protocol and Team Expansion

**Priority:** P3

These capabilities follow a stable REST domain model, portable format, and
verification runner:

- [ ] GraphQL requests, variables, schema loading, and operation selection.
- [ ] WebSocket and Server-Sent Events sessions.
- [ ] gRPC requests and reflection.
- [ ] client certificates, proxy profiles, and advanced transport diagnostics.
- [ ] Git-backed collection collaboration.
- [ ] conflict-aware merge UX for portable Postee artefacts.
- [ ] optional shared workspaces only after local ownership and encryption
      boundaries are preserved.

Cloud collaboration, hosted monitoring, mock servers, public API publishing, and
marketplace plugins are not required for Postee's initial credibility target.

## Cross-Cutting Architecture

### Domain and State

- Define Effect Schema contracts for persisted requests, drafts, prepared
  requests, responses, history, assertions, and performance runs.
- Use XState for explicit lifecycle and coordination states, not as a second
  copy of domain data.
- Split the monolithic workspace machine along request editor, persistence,
  runner, panel, and collection-runner responsibilities when each boundary has a
  stable event contract.
- Remove React-local orchestration state that can disagree with machine state.
- Remove `@ts-nocheck` from active Postee orchestration.
- Delete the legacy `PosteeWorkspace.original.tsx` after behaviour parity is
  proven.

### Persistence and Migration

- Add forward-only migrations with compatibility tests against representative
  existing Postee databases.
- Make compound request saves transactional.
- Separate response content type from response storage representation.
- Define history retention, truncation, cleanup, and export policy.
- Keep optimistic UI only where failure has an explicit rollback or retry path.

### Secret Handling

- Store secret values through the OS keychain or an encrypted vault-backed
  reference.
- Keep only secret identity, source, and presence in SQLite.
- Redact secrets from errors, logs, history snapshots, exports, diagnostics,
  tests, and provider context.
- Add regression tests using secret-like values for every outward boundary.
- Record the selected model in a dedicated Postee secret-storage ADR.

### Testing

- Use Effect tests for parsing, preparation, redaction, persistence contracts,
  imports, assertions, and comparison.
- Use XState actor tests for draft, save, run, cancel, failure, and tab
  lifecycles.
- Use React tests for keyboard, focus, tab, split-pane, empty, loading, failure,
  and recovery states.
- Use property tests for request round-tripping, URL/parameter synchronisation,
  redaction, and import/export stability.
- Use Rust unit and property tests for load configuration, rate limiting,
  cancellation, statistics, and cleanup.
- Add a Tauri-backed integration path for the complete request lifecycle.
- Add Playwright visual and interaction checks at desktop and constrained
  viewport sizes.

### Accessibility and Performance

- Preserve React Aria semantics and visible focus across every workspace
  control.
- Support keyboard-only request creation, tab switching, Send, Save, search,
  panel resizing, and close recovery.
- Respect reduced motion and global audio settings.
- Virtualise large request trees and bound response/history rendering.
- Keep request-tab switching responsive without mounting every heavy editor.

## Product Measures

Postee should track product quality without collecting request contents:

- time from opening Postee to first sent request;
- percentage of sessions blocked before first request;
- send, save, import, persistence, and execution failure rates;
- request-tab restore and unsaved-draft recovery success;
- response render time by size bucket;
- collection import completion and warning rates;
- load-test cancellation latency and cleanup failures;
- assertion and collection-run completion rates.

Telemetry is opt-in and must never contain URLs, headers, bodies, environment
values, response content, or secrets.

## Release Sequence

| Horizon | Delivery |
| --- | --- |
| **Now** | Workstream 1: trustworthy lifecycle, scratch requests, tabs, split workspace, coherent navigator |
| **Next** | Workstreams 2-4: complete REST authoring, portability, response evidence, assertions |
| **Then** | Workstreams 5-6: collection automation and native performance workbench |
| **Differentiate** | Workstream 7: C4 evidence and governed OPY assistance |
| **Expand** | Workstream 8: additional protocols and optional team workflows |

Each workstream must ship as independently testable vertical slices. Detailed
implementation plans belong in milestone-specific documents rather than growing
this product roadmap into a code-level task log.

## Required Architecture Decisions

1. Postee request draft, autosave, and Send semantics.
2. Request-tab ownership and relationship to the application workspace tabs.
3. Postee secret storage and portable secret references.
4. Portable collection format and Git representation.
5. Script runtime, sandbox, capabilities, and dependency policy.
6. History content storage, retention, and large/binary response policy.
7. Load-test cancellation, production-target safety, and evidence retention.
8. OPY request context, confirmation boundaries, and audit artefacts.

Existing ADRs:

- [ADR-001: PosteeWorkspace Component Refactor](../architecture/adr/001-postee-workspace-refactor/)
- [ADR-002: Postee Actor Model Refactor](../architecture/adr/002-postee-actor-model-refactor/)
- [ADR-009: Varlock Environment Governance](../architecture/adr/009-varlock-environment-governance/)

ADR-001 and ADR-002 should be reconciled against current source before the
Workstream 1 implementation plan is approved.

## Definition of Product Credibility

Postee reaches its first credible-alternative milestone when:

1. A user can author and send common REST requests without consulting
   documentation.
2. Visible request state, persisted state, executed state, and history evidence
   cannot silently disagree.
3. Parameters, authentication, headers, common body modes, environments,
   cookies, and arbitrary response types work end to end.
4. Multiple request tabs, collections, history, import/export, replay,
   assertions, and keyboard workflows are dependable.
5. Secrets remain protected across storage and every outward boundary.
6. Load testing reproduces the effective request, can be cancelled, and
   generates comparable evidence.
7. Existing Postee data migrates without silent loss.
8. C4 and OPY integrations are useful differentiators but remain optional.

