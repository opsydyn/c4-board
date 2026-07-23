# Postee HTTP QUERY Method Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add RFC-aware HTTP `QUERY` authoring, persistence, execution, history, and load-test support to Postee with mandatory effective content-type validation.

**Architecture:** A canonical Effect method list and a pure HTTP method-policy module own QUERY semantics. The request builder, HTTP preparation path, machine execution, and load-test adapter consume that policy so no UI or alternate execution path can bypass content and media-type rules.

**Tech Stack:** Bun, TypeScript, Effect Schema/Data/Match, React 19, XState, Vitest, Testing Library, Tauri 2, Rust, reqwest

## Global Constraints

- Follow [RFC 10008](https://www.rfc-editor.org/info/rfc10008/): `QUERY` is safe, idempotent, content-capable, and its content requires a consistent media type.
- JSON QUERY content infers `application/json; charset=utf-8`.
- Form QUERY content infers `application/x-www-form-urlencoded`.
- Raw QUERY content requires an explicit enabled `Content-Type` header.
- Empty QUERY content is invalid.
- Save remains available for incomplete drafts; Send and execution are blocked until semantics are valid.
- Core preparation must enforce the same rules as the editor.
- Never fall back from `QUERY` to `POST` or `GET`.
- Do not add arbitrary custom methods, `Accept-Query` parsing, retries, caching, redirect changes, or a body-mode picker.
- Do not add a SQLite migration; `postee_requests.method` is already unconstrained `TEXT`.
- Preserve the existing committed-state-before-Send policy and transactional draft persistence.
- Use TDD for every production change and commit each task independently.

---

## File Structure

### New Files

- `src/core/effects/postee/http-method-policy.ts`
  Owns canonical method metadata, QUERY semantic validation, case-insensitive
  content-type resolution, generated headers, and body serialization.
- `src/core/effects/postee/http-method-policy.test.ts`
  Proves policy metadata, content validation, inference, and duplicate-header
  prevention.
- `src/core/effects/postee/http-client.test.ts`
  Proves prepared QUERY requests and `RequestInit` retain the method, body, and
  media type.
- `src/core/effects/postee/load-test.test.ts`
  Proves saved drafts become RFC-valid load-test payloads.
- `test/ui/components/postee/LoadTestPanel.test.tsx`
  Proves QUERY selection and invalid-payload blocking in the load-test surface.

### Modified Files

- `src/core/effects/postee/types.ts`
  Exposes one canonical `HTTP_METHODS` tuple and adds `QUERY`.
- `src/core/effects/postee/schema.ts`
  Uses the canonical tuple for persistence schemas.
- `src/core/effects/postee/form-validation.ts`
  Uses the canonical guard instead of a private method list.
- `src/core/effects/postee/index.ts`
  Exports the method-policy contract used by UI modules.
- `src/core/effects/postee/http-client.ts`
  Applies semantic validation and generated headers during preparation; exposes
  the pure `toRequestInit` boundary for testing.
- `test/core/effects/postee/form-validation.test.ts`
  Covers QUERY normalization and acceptance.
- `test/ui/machines/postee.machine.request-draft.test.ts`
  Proves a persisted QUERY draft executes and records history unchanged.
- `src/ui/components/postee/PosteeRequestBuilder.tsx`
  Adds QUERY to the selector and blocks invalid Send paths with an inline
  semantic error.
- `test/ui/components/postee/PosteeRequestBuilder.test.tsx`
  Covers selection, inferred media types, raw validation, and keyboard guards.
- `src/core/effects/postee/load-test.ts`
  Converts a confirmed request draft into a validated load-test payload.
- `src/ui/components/postee/PosteeWorkspace.tsx`
  Passes the selected confirmed draft into the response/load-test surface.
- `src/ui/components/postee/PosteeResponsePanel.tsx`
  Passes complete draft content to `LoadTestPanel`.
- `src/ui/components/postee/LoadTestPanel.tsx`
  Includes QUERY and forwards validated headers and body to Tauri.
- `src-tauri/src/load_test/engine.rs`
  Adds a regression test proving reqwest accepts QUERY with content.
- `docs/src/content/docs/overview/postee-product-roadmap.md`
  Records delivered and future RFC 10008 work.

---

### Task 1: Canonical HTTP Methods and RFC Policy

**Files:**
- Create: `src/core/effects/postee/http-method-policy.ts`
- Create: `src/core/effects/postee/http-method-policy.test.ts`
- Modify: `src/core/effects/postee/types.ts`
- Modify: `src/core/effects/postee/schema.ts`
- Modify: `src/core/effects/postee/form-validation.ts`
- Modify: `src/core/effects/postee/index.ts`
- Modify: `test/core/effects/postee/form-validation.test.ts`

**Interfaces:**
- Produces:

```ts
export const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
  "TRACE",
  "QUERY",
] as const;

export interface HttpMethodPolicy {
  readonly safe: boolean;
  readonly idempotent: boolean;
  readonly content: "forbidden" | "optional" | "required";
  readonly requiresContentType: boolean;
}

export interface EffectiveRequestHeader {
  readonly key: string;
  readonly value: string;
}

export type RequestContent = RequestBody | PreparedBody;

export type RequestSemanticsIssue =
  | "QUERY requires request content."
  | "QUERY requires a Content-Type for its request content.";

export const getHttpMethodPolicy: (method: HttpMethod) => HttpMethodPolicy;

export const evaluateRequestSemantics: (
  method: HttpMethod,
  headers: ReadonlyArray<EffectiveRequestHeader>,
  body: RequestContent,
) => RequestSemanticsIssue | null;

export const completeContentTypeHeaders: (
  headers: ReadonlyArray<EffectiveRequestHeader>,
  body: RequestContent,
) => ReadonlyArray<EffectiveRequestHeader>;

export const serializeRequestBody: (body: RequestContent) => string | null;
```

- Consumes: `HttpMethod`, `RequestBody`, and `HTTP_METHODS` from
  `src/core/effects/postee/types.ts`.

- [ ] **Step 1: Write failing canonical-method and policy tests**

Add tests that initially fail because `QUERY`, the tuple, and policy module do
not exist:

```ts
import { describe, expect, it } from "vitest";
import {
  completeContentTypeHeaders,
  evaluateRequestSemantics,
  getHttpMethodPolicy,
  serializeRequestBody,
} from "./http-method-policy";
import { HTTP_METHODS, RequestBody } from "./types";

describe("HTTP QUERY method policy", () => {
  it("classifies QUERY as safe, idempotent, and content-required", () => {
    expect(HTTP_METHODS).toContain("QUERY");
    expect(getHttpMethodPolicy("QUERY")).toEqual({
      safe: true,
      idempotent: true,
      content: "required",
      requiresContentType: true,
    });
  });

  it("rejects raw QUERY content without an explicit media type", () => {
    expect(
      evaluateRequestSemantics(
        "QUERY",
        [],
        RequestBody.Raw({ content: "select * from systems" }),
      ),
    ).toBe("QUERY requires a Content-Type for its request content.");
  });

  it("rejects empty QUERY content", () => {
    expect(
      evaluateRequestSemantics("QUERY", [], RequestBody.Json({ content: "" })),
    ).toBe("QUERY requires request content.");
  });

  it("infers one JSON content type without duplicating explicit casing", () => {
    expect(
      completeContentTypeHeaders(
        [],
        RequestBody.Json({ content: "{\"name\":\"opsy\"}" }),
      ),
    ).toEqual([
      { key: "content-type", value: "application/json; charset=utf-8" },
    ]);

    expect(
      completeContentTypeHeaders(
        [{ key: "Content-Type", value: "application/query+json" }],
        RequestBody.Json({ content: "{}" }),
      ),
    ).toEqual([
      { key: "Content-Type", value: "application/query+json" },
    ]);
  });

  it("serializes enabled form entries in stable order", () => {
    expect(
      serializeRequestBody(
        RequestBody.Form({
          entries: [["q", "foo"], ["limit", "10"]],
        }),
      ),
    ).toBe("q=foo&limit=10");
  });
});
```

Extend `test/core/effects/postee/form-validation.test.ts`:

```ts
it("normalizes and accepts QUERY", async () => {
  const result = await Effect.runPromise(
    validateRequestForm({
      name: "Search systems",
      url: "https://example.com/systems",
      method: " query ",
    }),
  );

  expect(result.method).toBe("QUERY");
});
```

- [ ] **Step 2: Run the tests and confirm RED**

Run:

```bash
bun run test:run -- src/core/effects/postee/http-method-policy.test.ts test/core/effects/postee/form-validation.test.ts
```

Expected: FAIL because `QUERY`, `HTTP_METHODS`, and
`http-method-policy.ts` are missing.

- [ ] **Step 3: Add one canonical method tuple and update both schemas**

In `src/core/effects/postee/types.ts`, define `HTTP_METHODS` and derive the
schema from it:

```ts
export const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
  "TRACE",
  "QUERY",
] as const;

export const HttpMethodSchema = Schema.Literal(...HTTP_METHODS);
```

In `src/core/effects/postee/schema.ts`, import the tuple and replace the
hand-written union:

```ts
import { HTTP_METHODS } from "./types";

export const HttpMethodSchema = S.Literal(...HTTP_METHODS);
```

In `form-validation.ts`, remove `VALID_HTTP_METHODS` and validate using
`isHttpMethod` after trimming and uppercasing:

```ts
import { HTTP_METHODS, isHttpMethod } from "./types";

Schema.filter(
  (value) => isHttpMethod(value.trim().toUpperCase()),
  {
    message: () => `HTTP method must be one of: ${HTTP_METHODS.join(", ")}`,
  },
)
```

- [ ] **Step 4: Implement the pure method policy**

Create `http-method-policy.ts` with an exhaustive
`Record<HttpMethod, HttpMethodPolicy>`. Use case-insensitive header matching:

```ts
const findContentType = (
  headers: ReadonlyArray<EffectiveRequestHeader>,
): EffectiveRequestHeader | undefined =>
  headers.find(
    (header) =>
      header.key.trim().toLowerCase() === "content-type"
      && header.value.trim().length > 0,
  );
```

Determine whether content exists from the `RequestBody` tagged union:

```ts
export const hasRequestContent = (body: RequestContent): boolean =>
  Match.value(body).pipe(
    Match.tag("None", () => false),
    Match.tag("Raw", ({ content }) => content.length > 0),
    Match.tag("Json", ({ content }) => content.length > 0),
    Match.tag("Form", ({ entries }) => entries.length > 0),
    Match.exhaustive,
  );
```

For QUERY, return the empty-content issue first, then the missing-content-type
issue. Treat JSON and form modes as having inferable media types. Preserve
explicit headers exactly and add no second header when casing differs.

- [ ] **Step 5: Export the policy and verify GREEN**

Export the public contract from `src/core/effects/postee/index.ts`, then run:

```bash
bun run test:run -- src/core/effects/postee/http-method-policy.test.ts test/core/effects/postee/form-validation.test.ts
bun run lint -- src/core/effects/postee/types.ts src/core/effects/postee/schema.ts src/core/effects/postee/form-validation.ts src/core/effects/postee/http-method-policy.ts src/core/effects/postee/http-method-policy.test.ts
```

Expected: all selected tests pass and ESLint exits zero.

- [ ] **Step 6: Commit**

```bash
git add src/core/effects/postee/types.ts src/core/effects/postee/schema.ts src/core/effects/postee/form-validation.ts src/core/effects/postee/http-method-policy.ts src/core/effects/postee/http-method-policy.test.ts src/core/effects/postee/index.ts test/core/effects/postee/form-validation.test.ts
git commit -m "feat: define RFC-aware HTTP QUERY policy"
```

---

### Task 2: HTTP Preparation, Transport, and Machine Execution

**Files:**
- Create: `src/core/effects/postee/http-client.test.ts`
- Modify: `src/core/effects/postee/http-client.ts`
- Modify: `test/ui/machines/postee.machine.request-draft.test.ts`

**Interfaces:**
- Consumes: `evaluateRequestSemantics`, `completeContentTypeHeaders`, and
  `serializeRequestBody` from Task 1.
- Produces:

```ts
export const toRequestInit: (request: PreparedRequest) => RequestInit;
```

- [ ] **Step 1: Write failing HTTP boundary tests**

Create `src/core/effects/postee/http-client.test.ts`:

```ts
it("prepares QUERY JSON with a generated media type", async () => {
  const prepared = await Effect.runPromise(
    prepareRequest({
      id: RequestId("query-1"),
      method: "QUERY",
      url: "https://example.com/feed",
      headers: [],
      body: RequestBody.Json({ content: "{\"q\":\"opsy\"}" }),
      env: { variables: [] },
    }),
  );

  expect(prepared.method).toBe("QUERY");
  expect(prepared.headers).toContainEqual({
    key: "content-type",
    value: "application/json; charset=utf-8",
  });
  expect(toRequestInit(prepared)).toMatchObject({
    method: "QUERY",
    body: "{\"q\":\"opsy\"}",
  });
});

it("preserves an explicit QUERY media type without duplication", async () => {
  const prepared = await Effect.runPromise(
    prepareRequest({
      id: RequestId("query-2"),
      method: "QUERY",
      url: "https://example.com/sql",
      headers: [{
        id: 1,
        request_id: "query-2",
        key: "Content-Type",
        value: "application/sql",
        is_enabled: 1,
        sort_order: 0,
      }],
      body: RequestBody.Raw({ content: "select * from systems" }),
      env: { variables: [] },
    }),
  );

  expect(
    prepared.headers.filter(
      (header) => header.key.toLowerCase() === "content-type",
    ),
  ).toEqual([{ key: "Content-Type", value: "application/sql" }]);
});

it.each([
  [RequestBody.None(), "QUERY requires request content."],
  [
    RequestBody.Raw({ content: "select * from systems" }),
    "QUERY requires a Content-Type for its request content.",
  ],
])("rejects invalid QUERY content before transport", async (body, message) => {
  const exit = await Effect.runPromiseExit(
    prepareRequest({
      id: RequestId("query-invalid"),
      method: "QUERY",
      url: "https://example.com/query",
      headers: [],
      body,
      env: { variables: [] },
    }),
  );

  expect(Exit.isFailure(exit)).toBe(true);
  expect(Cause.pretty(exit.cause)).toContain(message);
});
```

- [ ] **Step 2: Add a failing persisted execution test**

Extend `postee.machine.request-draft.test.ts` with a persisted request:

```ts
it("executes and records a persisted QUERY draft unchanged", async () => {
  const queryDraft = {
    request: {
      ...request,
      method: "QUERY",
      url: "https://example.com/feed",
    },
    headers: [{
      id: "header-query",
      key: "Content-Type",
      value: "application/sql",
      enabled: true,
    }],
    body: {
      request_id: request.id,
      mode: "raw",
      raw: "select * from systems",
      form_values: null,
    },
  } satisfies PosteeRequestDraft;

  // Seed queryDraft through the existing database test layer, run
  // RUN_REQUEST, and capture the PreparedRequest in makeHttpClientTestLayer.
  expect(captured.method).toBe("QUERY");
  expect(captured.body).toEqual(
    RequestBody.Raw({ content: "select * from systems" }),
  );
  expect(history.request_snapshot).toContain("\"method\": \"QUERY\"");
});
```

- [ ] **Step 3: Run both suites and confirm RED**

Run:

```bash
bun run test:run -- src/core/effects/postee/http-client.test.ts test/ui/machines/postee.machine.request-draft.test.ts
```

Expected: FAIL because preparation does not apply QUERY semantic validation,
generated headers are still added only inside the private fetch adapter, and
`toRequestInit` is not exported.

- [ ] **Step 4: Move media-type completion into request preparation**

After resolving and validating the body in `prepareRequest`:

```ts
const issue = evaluateRequestSemantics(params.method, headers, body);
if (issue) {
  return yield* Effect.fail(
    HttpClientError({
      message: issue,
      request: {
        method: params.method,
        url: resolvedUrl,
      },
    }),
  );
}

const effectiveHeaders = completeContentTypeHeaders(headers, body);
```

Return `effectiveHeaders` in `PreparedRequest`. This makes prepared state the
single effective request used by machine history, transport, and load-test
adapters.

- [ ] **Step 5: Expose and simplify the pure fetch adapter**

Rename `toFetchInit` to `toRequestInit` and export it. It must serialize the
prepared body but must not generate another media-type header:

```ts
export const toRequestInit = (request: PreparedRequest): RequestInit => {
  const headers = request.headers.reduce(
    (record, header) => ({ ...record, [header.key]: header.value }),
    {} as Record<string, string>,
  );
  const body = serializeRequestBody(request.body);
  const methodAllowsBody = getHttpMethodPolicy(request.method).content
    !== "forbidden";

  return body !== null && body.length > 0 && methodAllowsBody
    ? { method: request.method, headers, body }
    : { method: request.method, headers };
};
```

Keep `GET` and `HEAD` body omission unchanged. Empty raw, JSON, and form bodies
must also remain omitted for existing methods, matching the current adapter.

- [ ] **Step 6: Verify GREEN**

Run:

```bash
bun run test:run -- src/core/effects/postee/http-method-policy.test.ts src/core/effects/postee/http-client.test.ts test/ui/machines/postee.machine.request-draft.test.ts
bun run lint -- src/core/effects/postee/http-client.ts src/core/effects/postee/http-client.test.ts test/ui/machines/postee.machine.request-draft.test.ts
```

Expected: QUERY preparation, transport mapping, and machine execution tests
pass; existing draft lifecycle tests remain green.

- [ ] **Step 7: Commit**

```bash
git add src/core/effects/postee/http-client.ts src/core/effects/postee/http-client.test.ts test/ui/machines/postee.machine.request-draft.test.ts
git commit -m "feat: execute RFC-valid QUERY requests"
```

---

### Task 3: Request Builder QUERY UX

**Files:**
- Modify: `src/ui/components/postee/PosteeRequestBuilder.tsx`
- Modify: `test/ui/components/postee/PosteeRequestBuilder.test.tsx`

**Interfaces:**
- Consumes: `HTTP_METHODS`, `bodyModeToSumType`, and
  `evaluateRequestSemantics`.
- Produces no new public component props.

- [ ] **Step 1: Add failing component tests**

Add focused tests:

```ts
it("offers QUERY in the request method selector", async () => {
  const user = userEvent.setup();
  renderBuilder();

  await user.click(screen.getByRole("button", { name: "POST" }));
  expect(screen.getByRole("option", { name: "QUERY" })).toBeInTheDocument();
});

it("allows a saved QUERY JSON draft to send", async () => {
  const user = userEvent.setup();
  const onRunRequest = vi.fn();
  renderBuilder({
    selectedRequest: queryJsonDraft.request,
    selectedRequestDraft: queryJsonDraft,
    onRunRequest,
  });

  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Send" }));
  expect(onRunRequest).toHaveBeenCalledOnce();
});

it("blocks a raw QUERY draft until Content-Type is enabled", async () => {
  const rawDraft = makeQueryDraft({
    mode: "raw",
    raw: "select * from systems",
    headers: [],
  });
  renderBuilder({
    selectedRequest: rawDraft.request,
    selectedRequestDraft: rawDraft,
  });

  expect(screen.getByRole("alert")).toHaveTextContent(
    "QUERY requires a Content-Type for its request content.",
  );
  expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
});

it("blocks the keyboard Send shortcut for an invalid QUERY", () => {
  const onRunRequest = vi.fn();
  renderBuilder({
    selectedRequest: rawQueryDraft.request,
    selectedRequestDraft: rawQueryDraft,
    onRunRequest,
  });

  fireEvent.keyDown(window, { key: "Enter", metaKey: true });
  expect(onRunRequest).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run component tests and confirm RED**

Run:

```bash
bun run test:run -- test/ui/components/postee/PosteeRequestBuilder.test.tsx
```

Expected: FAIL because QUERY is missing and the builder does not evaluate
request semantics.

- [ ] **Step 3: Derive editor semantics from visible confirmed state**

Replace the private method-options array with the canonical tuple:

```ts
const methodOptions: ReadonlyArray<HttpMethod> = HTTP_METHODS;
```

Build a sum-type body from the current presentation. When a body edit would be
saved as JSON, evaluate it as JSON:

```ts
const semanticBodyMode = bodyWasEdited
  ? "json"
  : editorPresentation.requestBodyMode;

const semanticBody = bodyModeToSumType(
  semanticBodyMode as RequestBodyMode,
  editorPresentation.requestBody,
  selectedRequestDraft?.body.form_values ?? null,
);

const requestSemanticsIssue = evaluateRequestSemantics(
  editorPresentation.requestMethod as HttpMethod,
  editorPresentation.requestHeaders
    .filter((header) => header.enabled)
    .map(({ key, value }) => ({ key, value })),
  semanticBody,
);
```

- [ ] **Step 4: Guard every Send path and show the error**

Derive:

```ts
const canSendRequest = canRunRequest
  && requestSemanticsIssue === null
  && isEditorSynchronized
  && !isAnySaveActive
  && !isRunning;
```

Use `canSendRequest` for the Send button and `Cmd/Ctrl+Enter`. Do not use it
for Save. Render:

```tsx
{requestSemanticsIssue && (
  <div className={styles.validationError} role="alert">
    <Warning size={14} weight="bold" />
    <span>{requestSemanticsIssue}</span>
  </div>
)}
```

Keep persistence, URL validation, save errors, global save status, and running
locks unchanged.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
bun run test:run -- test/ui/components/postee/PosteeRequestBuilder.test.tsx src/core/effects/postee/http-method-policy.test.ts
bun run lint -- src/ui/components/postee/PosteeRequestBuilder.tsx test/ui/components/postee/PosteeRequestBuilder.test.tsx
```

Expected: QUERY selector and semantic editor tests pass, including keyboard
guards and all existing durable-draft tests.

- [ ] **Step 6: Commit**

```bash
git add src/ui/components/postee/PosteeRequestBuilder.tsx test/ui/components/postee/PosteeRequestBuilder.test.tsx
git commit -m "feat: add RFC-aware QUERY request editing"
```

---

### Task 4: QUERY Load-Test Parity

**Files:**
- Create: `src/core/effects/postee/load-test.test.ts`
- Create: `test/ui/components/postee/LoadTestPanel.test.tsx`
- Modify: `src/core/effects/postee/load-test.ts`
- Modify: `src/ui/components/postee/PosteeWorkspace.tsx`
- Modify: `src/ui/components/postee/PosteeResponsePanel.tsx`
- Modify: `src/ui/components/postee/LoadTestPanel.tsx`
- Modify: `src-tauri/src/load_test/engine.rs`

**Interfaces:**
- Consumes: confirmed `PosteeRequestDraft`, Task 1 policy functions, and
  `LoadTestConfigInput`.
- Produces:

```ts
export type LoadTestRequestPayload =
  | {
    readonly _tag: "Valid";
    readonly method: string;
    readonly headers: ReadonlyArray<{ readonly key: string; readonly value: string }>;
    readonly body: string | null;
  }
  | {
    readonly _tag: "Invalid";
    readonly message: RequestSemanticsIssue;
  };

export const buildLoadTestRequestPayload: (
  method: HttpMethod,
  draft: PosteeRequestDraft,
) => LoadTestRequestPayload;
```

- [ ] **Step 1: Write failing load-test payload tests**

Create `src/core/effects/postee/load-test.test.ts`:

```ts
it("builds a QUERY load-test payload with generated JSON media type", () => {
  const result = buildLoadTestRequestPayload("QUERY", queryJsonDraft);

  expect(result).toEqual({
    _tag: "Valid",
    method: "QUERY",
    headers: [{
      key: "content-type",
      value: "application/json; charset=utf-8",
    }],
    body: "{\"q\":\"opsy\"}",
  });
});

it("rejects a raw QUERY load-test payload without Content-Type", () => {
  expect(buildLoadTestRequestPayload("QUERY", rawQueryDraft)).toEqual({
    _tag: "Invalid",
    message: "QUERY requires a Content-Type for its request content.",
  });
});
```

- [ ] **Step 2: Write failing load-test component and Rust tests**

In `LoadTestPanel.test.tsx`, mock `useLoadTest`, Tauri detection, and Tone:

```ts
it("forwards QUERY method, headers, and body to the load-test runner", async () => {
  const user = userEvent.setup();
  const start = vi.fn().mockResolvedValue(undefined);
  useLoadTestMock.mockReturnValue(makeIdleLoadTestState({ start }));

  render(<LoadTestPanel requestDraft={queryJsonDraft} />);
  await user.click(screen.getByRole("button", { name: /start/i }));

  expect(start).toHaveBeenCalledWith(
    expect.objectContaining({
      method: "QUERY",
      headers: [{
        key: "content-type",
        value: "application/json; charset=utf-8",
      }],
      body: "{\"q\":\"opsy\"}",
    }),
  );
});
```

In `src-tauri/src/load_test/engine.rs`:

```rust
#[test]
fn build_request_plan_accepts_query_content() {
    let config = LoadTestConfig {
        url: "https://example.com/feed".to_string(),
        method: "QUERY".to_string(),
        headers: vec![(
            "content-type".to_string(),
            "application/json".to_string(),
        )],
        body: Some(r#"{"q":"opsy"}"#.to_string()),
        duration_secs: 1,
        concurrency: 1,
        rps_limit: None,
        timeout_ms: 5_000,
    };

    let plan = LoadTestEngine::build_request_plan(&config)
        .expect("QUERY plan should be valid");

    assert_eq!(plan.method.as_str(), "QUERY");
    assert_eq!(plan.body.as_deref(), Some(r#"{"q":"opsy"}"#.as_bytes()));
}
```

- [ ] **Step 3: Run tests and confirm RED**

Run:

```bash
bun run test:run -- src/core/effects/postee/load-test.test.ts test/ui/components/postee/LoadTestPanel.test.tsx
cargo test --manifest-path src-tauri/Cargo.toml build_request_plan_accepts_query_content
```

Expected: TypeScript tests fail because the adapter and `requestDraft` prop do
not exist. The Rust test should pass once added, proving no Rust production
change is needed; if it fails, correct the native method parsing boundary
without special-casing QUERY.

- [ ] **Step 4: Implement the pure load-test adapter**

Convert `draft.body` with `bodyModeToSumType`, filter enabled draft headers,
evaluate semantics, complete the content type, and serialize the body:

```ts
export const buildLoadTestRequestPayload = (
  method: HttpMethod,
  draft: PosteeRequestDraft,
): LoadTestRequestPayload => {
  const body = bodyModeToSumType(
    draft.body.mode as RequestBodyMode,
    draft.body.raw,
    draft.body.form_values,
  );
  const headers = draft.headers
    .filter((header) => header.enabled)
    .map(({ key, value }) => ({ key, value }));
  const issue = evaluateRequestSemantics(method, headers, body);

  return issue
    ? { _tag: "Invalid", message: issue }
    : {
      _tag: "Valid",
      method,
      headers: completeContentTypeHeaders(headers, body),
      body: serializeRequestBody(body),
    };
};
```

- [ ] **Step 5: Pass the confirmed draft through the response surface**

Add `selectedRequestDraft: PosteeRequestDraft | null` to
`PosteeResponsePanelProps`. Pass it from `PosteeWorkspace`, and replace the
metadata-only `LoadTestPanel` input with:

```tsx
{selectedRequestDraft && (
  <LoadTestPanel requestDraft={selectedRequestDraft} />
)}
```

Keep the editable method and URL controls in `LoadTestPanel`. Recompute the
payload when `targetMethod` changes. On Start:

```ts
if (payload._tag === "Invalid") {
  return;
}

await start({
  url: targetUrl.trim(),
  method: payload.method,
  headers: [...payload.headers],
  body: payload.body,
  // existing duration, concurrency, rate, and timeout values
});
```

Show `payload.message` with `role="alert"` and disable Start for an invalid
QUERY payload.

- [ ] **Step 6: Verify GREEN**

Run:

```bash
bun run test:run -- src/core/effects/postee/load-test.test.ts test/ui/components/postee/LoadTestPanel.test.tsx test/ui/components/postee/PosteeRequestBuilder.test.tsx
cargo test --manifest-path src-tauri/Cargo.toml build_request_plan_accepts_query_content
bun run lint -- src/core/effects/postee/load-test.ts src/core/effects/postee/load-test.test.ts src/ui/components/postee/PosteeWorkspace.tsx src/ui/components/postee/PosteeResponsePanel.tsx src/ui/components/postee/LoadTestPanel.tsx test/ui/components/postee/LoadTestPanel.test.tsx
```

Expected: QUERY load tests forward the confirmed method, body, and one
effective content type; invalid raw QUERY drafts cannot start.

- [ ] **Step 7: Commit**

```bash
git add src/core/effects/postee/load-test.ts src/core/effects/postee/load-test.test.ts src/ui/components/postee/PosteeWorkspace.tsx src/ui/components/postee/PosteeResponsePanel.tsx src/ui/components/postee/LoadTestPanel.tsx test/ui/components/postee/LoadTestPanel.test.tsx src-tauri/src/load_test/engine.rs
git commit -m "feat: carry QUERY content into load tests"
```

---

### Task 5: Product Roadmap and Final Verification

**Files:**
- Modify: `docs/src/content/docs/overview/postee-product-roadmap.md`

**Interfaces:**
- Consumes the completed Task 1-4 behaviour.
- Produces the public product sequence for remaining RFC 10008 work.

- [ ] **Step 1: Add the RFC 10008 roadmap subsection**

Under Workstream 2, after Headers, Body, and Cookies, add:

```md
### 2.4 HTTP QUERY (RFC 10008)

- [x] Author, persist, execute, replay, and inspect HTTP QUERY requests.
- [x] Require query content and an effective Content-Type before execution.
- [x] Preserve QUERY method, headers, and body in native load testing.
- [x] Classify QUERY as safe and idempotent without silently retrying it.
- [ ] Parse `Accept-Query` structured fields and expose supported media types.
- [ ] Define QUERY redirect handling for 301, 302, 303, 307, and 308.
- [ ] Evaluate content-aware QUERY cache keys and equivalent-resource links.
- [ ] Add a governed retry policy that uses safe/idempotent metadata.
- [ ] Add browser CORS and intermediary compatibility diagnostics.
```

Add this acceptance item:

```md
6. RFC-valid QUERY requests preserve content and media type across authoring,
   execution, history, replay, and load testing.
```

Link the subsection to RFC 10008.

- [ ] **Step 2: Run focused cross-boundary verification**

Run:

```bash
bun run test:run -- src/core/effects/postee/http-method-policy.test.ts src/core/effects/postee/http-client.test.ts src/core/effects/postee/load-test.test.ts test/core/effects/postee/form-validation.test.ts test/ui/components/postee/PosteeRequestBuilder.test.tsx test/ui/components/postee/LoadTestPanel.test.tsx test/ui/machines/postee.machine.request-draft.test.ts
cargo test --manifest-path src-tauri/Cargo.toml build_request_plan_accepts_query_content
```

Expected: every QUERY-specific test passes with no warnings or unhandled
effects.

- [ ] **Step 3: Run full repository gates**

Run fresh:

```bash
bun run lint
bun run test:run
bun run build
bun run knip
cargo fmt --manifest-path src-tauri/Cargo.toml --all --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
git diff --check "$(git merge-base main HEAD)" HEAD
```

Expected:

- ESLint exits zero.
- All Vitest files pass.
- Astro check reports 0 errors, 0 warnings, and 0 hints.
- Astro builds all routes.
- Knip reports no unused files, dependencies, or exports.
- Rust formatting and Clippy pass with warnings denied.
- All Rust tests pass.
- Git diff hygiene reports no whitespace errors.

- [ ] **Step 4: Commit the roadmap**

```bash
git add docs/src/content/docs/overview/postee-product-roadmap.md
git commit -m "docs: add HTTP QUERY roadmap"
```

- [ ] **Step 5: Perform independent whole-branch review**

Generate a review package from the branch base to `HEAD`. The reviewer must
check:

- both method schemas and form validation agree;
- QUERY never loses or changes method/body/media type;
- explicit Content-Type casing does not create duplicates;
- UI and core validation cannot disagree;
- keyboard, machine, replay, and load-test paths cannot bypass semantics;
- GET and HEAD still omit content;
- raw request content and secret headers do not appear in new logs; and
- roadmap checkboxes match verified implementation.

Resolve every Critical and Important finding and rerun the covering test plus
all affected gates.

- [ ] **Step 6: Merge locally after approval**

Use `superpowers:finishing-a-development-branch`. Merge the feature branch into
`main` locally only after the independent review and all fresh gates pass.
Rerun `bun run test:run` on the merged tree before removing the owned worktree
and feature branch.
