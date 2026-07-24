# Postee GraphQL Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add durable POST-only GraphQL requests with Monaco syntax highlighting, authenticated explicit introspection, local schema snapshots, and schema-backed completion.

**Architecture:** Persist GraphQL authoring data beside a Postee request, then derive the standard JSON HTTP envelope before the existing HTTP, history, and load-test boundaries. An Effect schema service uses the resolved endpoint and enabled headers for explicit introspection; it caches successful schema snapshots locally by endpoint plus a non-reversible context digest.

**Tech Stack:** Bun, Astro, React 19, Effect, XState 5, SQLite/Tauri, Monaco 0.55, `graphql`, `monaco-graphql`, `graphql-language-service`, Vitest, Rust.

## Global Constraints

- Support GraphQL-over-HTTP `POST` only. Exclude GET, subscriptions, batching, uploads, persisted queries, retries, and automatic schema refresh.
- Derive `Content-Type: application/json; charset=utf-8` and `Accept: application/graphql-response+json, application/json;q=0.9` for every GraphQL request.
- Persist document, variables JSON text, and nullable operation name. Convert them to generic `RequestBody.Json` only at the HTTP boundary.
- Store schema snapshots locally by normalised endpoint plus SHA-256 of canonical resolved enabled headers. Never persist, log, export, render, or history-record credential values or the fingerprint.
- Refresh introspection explicitly with the active resolved endpoint/headers; failures retain the last valid matching snapshot and return redacted diagnostics.
- Save accepts invalid GraphQL drafts. Send is blocked in UI and core for an empty/unparseable document, invalid/non-object variables, missing selection for multiple operations, or unavailable selected operation.
- A matching schema provides diagnostics only, not a Send block. No schema, stale schema, or disabled introspection must retain manual authoring.
- Use `apply_patch`, strict RED-GREEN TDD, focused tests, and one logical commit per task.
- Add forward-only `src-tauri/migrations/031_add_postee_graphql.sql`; preserve raw, JSON, and form bodies.

## Task 1: GraphQL Domain And Dependencies

**Files:**
- Modify: `package.json`, `bun.lock`, `src/core/effects/postee/index.ts`
- Create: `src/core/effects/postee/graphql.ts`, `src/core/effects/postee/graphql.test.ts`

**Interfaces:**

```ts
export interface GraphqlDraft {
  readonly document: string;
  readonly variablesJson: string;
  readonly operationName: string | null;
}
export type GraphqlDraftIssue =
  | "GraphQL requires an operation document."
  | "GraphQL document is invalid."
  | "GraphQL variables must be valid JSON."
  | "GraphQL variables must be a JSON object."
  | "GraphQL requires an operation selection."
  | "The selected GraphQL operation no longer exists.";
export const prepareGraphqlDraft: (draft: GraphqlDraft) => {
  issue: GraphqlDraftIssue | null;
  operationNames: ReadonlyArray<string>;
  body: RequestBody.Json | null;
  protocolHeaders: ReadonlyArray<EffectiveRequestHeader>;
};
```

- [ ] Write failing tests for a valid derived envelope; empty, invalid, and non-object variables; multi-operation selection; stale operation name.
- [ ] Run `bun run test:run src/core/effects/postee/graphql.test.ts`; expect module-not-found RED.
- [ ] Add `graphql`, `monaco-graphql`, and `graphql-language-service` with Bun. Implement `prepareGraphqlDraft` using `parse` and operation definitions; emit JSON keys in order `query`, optional `variables`, optional `operationName`.
- [ ] Make the valid test assert exact `RequestBody.Json` and exact protocol headers. Rerun the focused suite; expect GREEN.
- [ ] Run `bun run build`; expect Astro check/build with zero errors.
- [ ] Commit `feat: add Postee GraphQL draft preparation`.

## Task 2: Durable Draft And Snapshot Storage

**Files:**
- Create: `src-tauri/migrations/031_add_postee_graphql.sql`, `test/core/effects/postee/graphql-persistence.test.ts`
- Modify: `src/core/effects/database.postee.ts`, `src/core/effects/postee/schema.ts`, `src/core/effects/postee/types.ts`, `src/core/effects/postee/request-draft.ts`, `src/core/effects/postee/request-draft.test.ts`

**Interfaces:**

```ts
export interface PosteeGraphqlRequest {
  request_id: string; document: string; variables_json: string; operation_name: string | null;
}
export interface PosteeGraphqlSchemaSnapshot {
  id: string; endpoint_url: string; context_fingerprint: string;
  introspection_json: string; schema_digest: string; fetched_at: number; last_used_at: number;
}
// PosteeRequestDraft gains graphql: PosteeGraphqlRequest | null
```

- [ ] Write RED persistence tests: old JSON drafts load `graphql: null`; GraphQL draft save is one transaction with request, headers, body mode, and GraphQL row; changing back to JSON deletes the GraphQL row; snapshots only match exact endpoint/fingerprint.
- [ ] Run `bun run test:run src/core/effects/postee/request-draft.test.ts test/core/effects/postee/graphql-persistence.test.ts`; expect RED.
- [ ] Create tables `postee_graphql_requests` and `postee_graphql_schema_snapshots` with cascading request foreign key and unique `(endpoint_url, context_fingerprint)`. Add `graphql` body mode and database get/upsert/delete/touch functions.
- [ ] Extend draft load/save so the GraphQL row is loaded and persisted atomically, while non-GraphQL saves delete it.
- [ ] Rerun focused tests; expect GREEN. Add a representative pre-031 database compatibility fixture.
- [ ] Commit `feat: persist Postee GraphQL drafts and schema snapshots`.

## Task 3: Explicit Authenticated Introspection Service

**Files:**
- Create: `src/core/effects/postee/graphql-schema.ts`, `src/core/effects/postee/graphql-schema.test.ts`
- Modify: `src/core/effects/postee/http-client.ts`, `src/core/effects/postee/index.ts`

**Interfaces:**

```ts
export interface GraphqlSchemaContext {
  readonly endpointUrl: string;
  readonly headers: ReadonlyArray<EffectiveRequestHeader>;
}
export const fingerprintGraphqlSchemaContext: (context: GraphqlSchemaContext) => Promise<string>;
export const refreshGraphqlSchema: (context: GraphqlSchemaContext) => Effect.Effect<PosteeGraphqlSchemaSnapshot, GraphqlSchemaError, HttpClient | DatabaseService>;
```

- [ ] Write RED tests proving a SHA-256 fingerprint is stable under header ordering/casing and never contains `Bearer secret`; cache lookup touches a matching snapshot; failed HTTP, GraphQL `errors`, malformed introspection, and disabled introspection do not overwrite cached data.
- [ ] Run `bun run test:run src/core/effects/postee/graphql-schema.test.ts`; expect RED.
- [ ] Canonicalise resolved enabled headers by lower-case key, trimmed value, and stable sort; hash with Web Crypto. Build the standard introspection query with `getIntrospectionQuery`, derive the normal GraphQL JSON POST, use `prepareRequest` plus `HttpClient.send`, validate with `buildClientSchema`, then upsert only on success.
- [ ] Use category/status-only errors; never carry response body, headers, envelope, or fingerprint into diagnostics.
- [ ] Rerun focused tests and `src/core/effects/postee/http-client.test.ts`; expect GREEN.
- [ ] Commit `feat: cache authenticated Postee GraphQL schemas`.

## Task 4: Share GraphQL Execution, History, And Load Testing

**Files:**
- Modify: `src/ui/machines/postee.machine.ts`, `test/ui/machines/postee.machine.request-draft.test.ts`, `src/core/effects/postee/load-test.ts`, `src/core/effects/postee/load-test.test.ts`, `src-tauri/src/load_test/engine.rs`

**Contract:** Add `preparePosteeDraftBody(draft): Effect<RequestBody, GraphqlDraftIssue>`. It branches on `draft.body.mode === "graphql"`, calls `prepareGraphqlDraft`, and returns `RequestBody.Json`; all non-GraphQL modes retain existing conversion.

- [ ] Write RED machine/load tests asserting a saved GraphQL draft becomes HTTP `POST` with exact JSON body and protocol headers, history stores the derived prepared request, invalid GraphQL never invokes native load testing, and native request plan receives the same body.
- [ ] Run `bun run test:run test/ui/machines/postee.machine.request-draft.test.ts src/core/effects/postee/load-test.test.ts`; expect RED.
- [ ] Replace every generic `bodyModeToSumType` path that handles persisted drafts with the new boundary. Reject a GraphQL draft stored with a non-POST method rather than silently rewriting it.
- [ ] Add Rust regression for the derived GraphQL POST plan; do not add GraphQL parsing to Rust.
- [ ] Rerun focused TypeScript tests and `cargo test --manifest-path src-tauri/Cargo.toml load_test::engine`; expect GREEN.
- [ ] Commit `feat: execute Postee GraphQL requests through HTTP workflows`.

## Task 5: Monaco GraphQL Editor And Request UX

**Files:**
- Create: `src/ui/components/postee/MonacoGraphqlEditor.tsx`, `src/ui/components/postee/MonacoGraphqlEditor.css.ts`, `test/ui/components/postee/MonacoGraphqlEditor.test.tsx`
- Modify: `src/ui/components/postee/MonacoJsonEditor.tsx`, `src/ui/components/postee/PosteeRequestBuilder.tsx`, `test/ui/components/postee/PosteeRequestBuilder.test.tsx`, `src/ui/machines/postee.machine.ts`

**Interfaces:**

```ts
export interface MonacoGraphqlEditorProps {
  value: string; onChange: (value: string) => void;
  schema: GraphQLSchema | null; readOnly: boolean; height?: string;
}
type GraphqlSchemaUiState = "NoSchema" | "Cached" | "Stale" | "Refreshing" | "Unavailable";
```

- [ ] Write RED component tests: GraphQL mode renders labelled Document and Variables Monaco editors; multi-operation draft disables Send but enables Save; operation selection enables Send; no schema retains syntax editor/manual Send; `Cmd/Ctrl+Enter` uses exactly the Send predicate.
- [ ] Run `bun run test:run test/ui/components/postee/MonacoGraphqlEditor.test.tsx test/ui/components/postee/PosteeRequestBuilder.test.tsx`; expect RED.
- [ ] Extract only shared Monaco loader configuration from the JSON editor. Register `monaco-graphql` and its Vite worker once app-wide; expose per-model schema update/disposal functions.
- [ ] Add GraphQL body mode with compact Document, Variables, Operation, Schema status, and labelled Refresh Schema icon controls. Hide operation control for exactly one operation. Use `aria-live="polite"` for refresh status/errors.
- [ ] Add tests for request switching, running read-only state, cached/offline state, explicit refresh loading/failure, and non-blocking schema diagnostics.
- [ ] Rerun focused component suites; expect GREEN.
- [ ] Commit `feat: add schema-aware Postee GraphQL editor`.

## Task 6: Machine Refresh Lifecycle, Roadmap, And Release Gates

**Files:**
- Create: `test/ui/components/postee/PosteeGraphqlLifecycle.test.tsx`
- Modify: `src/ui/machines/postee.machine.ts`, `test/ui/machines/postee.machine.request-draft.test.ts`, `docs/src/content/docs/overview/postee-product-roadmap.md`

- [ ] Write RED lifecycle test that refreshes with resolved authentication, persists schema, reopens offline from cache, rejects different credential context reuse, and confirms no refresh is recorded in history or passed to load testing.
- [ ] Run `bun run test:run test/ui/components/postee/PosteeGraphqlLifecycle.test.tsx`; expect RED.
- [ ] Add `REFRESH_GRAPHQL_SCHEMA`, success, and failure machine events. Keep previous cache state on failure, reject refresh without a selected saved GraphQL request, and do not dirty the authoring draft.
- [ ] Update roadmap only after GREEN: mark POST GraphQL authoring, variables, operations, authenticated explicit introspection, offline snapshots, syntax highlighting, and completion delivered. Keep GET, subscriptions, persisted queries, uploads, batching, automatic refresh, schema import, federation, retries, and portability unchecked.
- [ ] Run focused lifecycle/machine tests; expect GREEN.
- [ ] Run all release commands: `bun run lint`; `bun run test:run`; `bun run build`; `bun run knip`; `cargo fmt --manifest-path src-tauri/Cargo.toml --all --check`; `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`; `cargo test --manifest-path src-tauri/Cargo.toml`; `git diff --check "$(git merge-base main HEAD)" HEAD`.
- [ ] Run `bun tauri dev` and manually verify worker loading, authenticated explicit refresh, offline completion from matching cache, context mismatch isolation, derived POST history, load-test payload parity, and secret redaction.
- [ ] Commit `feat: refresh and reuse Postee GraphQL schemas`; make a separate docs-only validation commit only if the manual acceptance evidence changes tracked docs.

## Plan Self-Review

- POST contract and pure validation: Task 1.
- Migration and atomic persistence: Task 2.
- Authenticated context-safe snapshot caching: Task 3.
- Existing execution, history, and native load-test parity: Task 4.
- Monaco syntax/completion/editor UX: Task 5.
- Explicit refresh, offline reuse, roadmap accuracy, package/desktop gates: Task 6.
- No task introduces GET, subscriptions, batching, uploads, automatic refresh, persisted queries, retries, schema import, federation, or a separate workspace.
