# Postee GraphQL Editor Design

**Status:** Approved design, pending written-spec review

**Date:** 2026-07-24

## Context

Postee is a durable, local-first HTTP workspace. It already persists request
metadata, headers, and bodies; resolves environments; executes requests through
an Effect HTTP client; retains history; and can pass a saved request into the
native load-test engine. It also ships Monaco for JSON authoring and response
inspection.

The Postee roadmap identifies GraphQL request authoring, variables, schema
loading, and operation selection as a future capability. This design introduces
those capabilities without creating a second request workspace or bypassing the
existing save, run, history, and load-test paths.

## Decision

Add GraphQL as a first-class persisted request-body mode. A GraphQL request is
executed as GraphQL-over-HTTP `POST` only in the first release.

The editor uses Monaco with `monaco-graphql` and `graphql-language-service` for
GraphQL syntax highlighting, diagnostics, and schema-backed completion.
`graphql` supplies document parsing, validation, standard introspection-query
generation, and client-schema construction.

Postee stores introspection snapshots locally and reuses them offline. Refresh
is explicit; Postee must never fetch a schema merely because an editor is
opened. A snapshot is selected by normalised endpoint plus a non-reversible
fingerprint of the resolved enabled request-header context. The cache never
stores credentials or resolved header values.

## Alternatives Considered

### Reuse the JSON body editor

Represent GraphQL as an ordinary JSON body containing `query`, `variables`, and
`operationName`.

Rejected because it obscures the GraphQL document, lacks a durable operation and
schema association, and cannot provide trustworthy GraphQL diagnostics or
completion.

### Separate GraphQL workspace

Build a dedicated GraphiQL-like surface alongside Postee.

Rejected because it duplicates collections, environment resolution, request
persistence, response evidence, history, and load-test integration.

### First-class body mode

Persist GraphQL authoring fields beside the existing request draft and derive an
ordinary HTTP request at the existing execution boundary.

Selected because it preserves Postee's existing lifecycle while keeping
GraphQL-specific concerns explicit and bounded.

## Data Model

The existing `postee_request_bodies` record gains the `graphql` mode. GraphQL
authoring state is held in a one-to-one table rather than overloading the legacy
`raw` and `form_values` columns.

`postee_graphql_requests`:

| Field | Meaning |
| --- | --- |
| `request_id` | Saved Postee request identity and primary key. |
| `document` | GraphQL source text. |
| `variables_json` | User-authored JSON text; empty is allowed. |
| `operation_name` | Nullable selected named operation. |

`postee_graphql_schema_snapshots`:

| Field | Meaning |
| --- | --- |
| `id` | Snapshot identity. |
| `endpoint_url` | Normalised resolved endpoint, without secrets. |
| `context_fingerprint` | SHA-256 digest of canonical enabled resolved headers. |
| `introspection_json` | Successful introspection result. |
| `schema_digest` | Digest of the retained introspection JSON. |
| `fetched_at` | Successful refresh timestamp. |
| `last_used_at` | Local cache-use timestamp. |

The unique cache key is `(endpoint_url, context_fingerprint)`. A cached snapshot
is valid only for the exact resolved execution context. The fingerprint is a
cache selector, not authentication material, and must never be displayed,
exported, logged, or placed in history.

Migrations are forward-only and retain existing raw, JSON, and form request
bodies unchanged. Saving a GraphQL request updates request metadata, headers,
the body mode, and GraphQL fields in one transaction.

## HTTP And Introspection Contract

The GraphQL adapter derives this HTTP request from the saved GraphQL draft:

```http
POST <resolved endpoint>
Content-Type: application/json; charset=utf-8
Accept: application/graphql-response+json, application/json;q=0.9
```

```json
{
  "query": "<document>",
  "variables": { "optional": "object" },
  "operationName": "optional"
}
```

Only non-empty variables and operation names appear in the envelope. User
headers remain available for authentication and endpoint-specific requirements.
The adapter owns required GraphQL protocol headers, so an arbitrary body edit
cannot silently remove them. Existing request-header resolution supplies
environment values before execution or introspection.

Introspection posts the standard `graphql` introspection query through the same
resolved endpoint and enabled headers. It has its own operation marker and is
never retained as a user request, entered into history, or sent to the load-test
engine. A successful response atomically replaces the matching snapshot. A
network, authentication, protocol, or GraphQL error retains the last successful
snapshot and exposes a redacted diagnostic.

The initial release deliberately excludes GraphQL-over-HTTP `GET`, subscriptions,
persisted queries, batching, uploads, schema-file import, federation-aware
composition, automatic schema refresh, and retries.

## Editor Workflow

Choosing `GraphQL` in the existing Body control renders a GraphQL workbench:

1. **Document**: `MonacoGraphqlEditor` renders the GraphQL document with
   syntax highlighting, parser diagnostics, schema-backed completion, and hover
   information when a matching snapshot is available.
2. **Variables**: the existing JSON Monaco editor renders variables and requires
   a JSON object when non-empty.
3. **Operation**: named operations parsed from the document populate a compact
   selector. It is not shown for a single operation; a multi-operation document
   must select one before Send.
4. **Schema**: a compact status area shows `No schema`, `Cached`, `Stale`,
   `Refreshing`, or `Unavailable`, endpoint-context match, and snapshot age. A
   refresh icon invokes introspection explicitly.

The GraphQL Monaco integration uses the application's existing Monaco loader
and asset path. A single app-scoped language-service adapter registers the
GraphQL mode and worker once, then updates per-model schema configuration when
the active snapshot changes. It must dispose model-specific resources when the
editor or request changes.

An absent, stale, forbidden, or offline schema never disables syntax
highlighting or manual authoring. It disables only schema-derived completion and
schema diagnostics.

## Validation And State Policy

Save is available for incomplete GraphQL drafts. Send is unavailable when any
of these conditions holds:

- the document is empty or cannot be parsed;
- variables are invalid JSON or are not a JSON object;
- a multi-operation document has no selected named operation;
- the selected operation is no longer present in the document.

If a matching schema snapshot exists, schema validation renders diagnostics but
does not block Send. Cached schemas can be stale, access can vary at runtime,
and introspection can be disabled even where execution is allowed.

The core adapter repeats every Send-blocking validation before transport. The UI
is advisory; no malformed GraphQL envelope reaches the HTTP client, history, or
load-test engine.

Existing save-before-send, running, dirty, cancellation, and request-selection
rules remain unchanged. A GraphQL request's history and load-test evidence use
the derived HTTP `POST` envelope, while the saved draft retains the authoring
document, variables, and operation identity.

## Security And Privacy

- Introspection uses the resolved enabled headers required by the endpoint.
- Snapshot identity uses a cryptographic digest of canonical resolved headers;
  neither header values nor the digest are exposed outside local cache lookup.
- Introspection failures, request history, logs, diagnostics, and tests must
  redact secret-like values.
- Export and portability work remains out of scope until the separate Postee
  secret-storage and collection-format decisions are complete.
- The local snapshot is schema metadata that may include descriptions and type
  names. Postee must make its local-only retention explicit and provide a future
  cache-clear command; remote schema upload is out of scope.

## Test And Acceptance Strategy

### Automated Tests

- Effect/core tests for document parsing, operation resolution, variables
  validation, generated envelopes, required header completion, and redaction.
- Persistence tests for migrations, transactional draft saves, snapshot keys,
  successful replacement, offline reuse, and failed-refresh retention.
- HTTP/machine tests proving that a persisted GraphQL draft executes as `POST`
  with the expected JSON envelope and reaches existing history and load-test
  payload preparation.
- React tests for mode switching, keyboard Send gating, operation selection,
  schema states, explicit refresh, and manual fallback without a snapshot.
- Monaco integration tests for language registration, schema update, and
  disposal behaviour. Unit tests must not pretend to prove worker loading.
- Rust tests for the existing load-test request plan accepting the derived
  GraphQL `POST` body unchanged.

### Build And Manual Gates

- `bun run lint`, `bun run test:run`, `bun run build`, and `bun run knip`.
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all --check`.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`.
- `cargo test --manifest-path src-tauri/Cargo.toml`.
- Fresh Tauri development verification that Monaco GraphQL worker assets load,
  syntax highlighting renders, authenticated refresh succeeds against a test
  endpoint, and a cached snapshot remains usable offline.

## Acceptance Criteria

1. A saved GraphQL request retains document, variables, and operation selection
   across restart.
2. Postee derives a standards-compatible GraphQL `POST` JSON envelope and
   required protocol headers without asking the user to construct them.
3. Invalid documents, invalid variables, and ambiguous operation selection are
   blocked in both the editor and core execution boundary.
4. Authenticated introspection creates a context-matched local snapshot without
   persisting or exposing credentials.
5. A cached snapshot drives GraphQL syntax highlighting and schema-backed
   completion offline.
6. An unavailable or stale schema does not prevent manual GraphQL authoring or
   execution.
7. GraphQL execution, history, and load testing retain the derived effective
   HTTP request without changing it to a generic REST body mode.
8. The new Monaco worker and all existing Postee workflows pass fresh automated
   and manual desktop verification.

