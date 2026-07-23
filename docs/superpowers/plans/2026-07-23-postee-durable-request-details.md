# Postee Durable Request Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Postee request headers and bodies hydrate, save transactionally, survive reload, and supply the exact persisted request execution.

**Architecture:** Add a focused Effect persistence boundary for complete request drafts, then let the Postee workspace machine own loaded details and the asynchronous save lifecycle. Keep the existing explicit-save-before-Send policy: the React builder edits a local draft, reports dirty state, submits the complete draft to the machine, and clears dirty state only after machine-confirmed persistence.

**Tech Stack:** Effect 3, XState 5, React 19, React Aria, Vitest, Testing Library, SQLite through `DatabaseService`

## Global Constraints

- Work only in `/Users/alancurrie/Projects/c4-board/.worktrees/postee-durable-request-details`.
- Use Bun for JavaScript and TypeScript commands.
- Follow test-driven development: each production behaviour requires a failing test observed before implementation.
- Preserve the current explicit-save-before-Send interaction; Send remains unavailable while the active draft is dirty or saving.
- Persist request metadata, headers, and body in one `DatabaseService.transaction`.
- A failed save must leave the editor dirty and show an actionable error.
- Selecting another request must replace every editable field with that request's persisted values.
- Do not add Params, Auth, request tabs, autosave, scratch requests, body-mode controls, or non-JSON history changes in this slice.
- Do not modify Rust code in this slice.
- Do not remove `@ts-nocheck` from the legacy workspace machine in this slice.
- Keep existing persisted body modes intact unless the user edits the JSON body, in which case save it as `json`.

---

## File Structure

- Create `src/core/effects/postee/request-draft.ts`: draft types, database-to-draft conversion, load, and transactional save.
- Create `src/core/effects/postee/request-draft.test.ts`: Effect-level persistence and transaction tests.
- Modify `src/core/effects/postee/index.ts`: export draft contracts and operations.
- Modify `src/ui/machines/postee.machine.ts`: hydrate request drafts, coordinate save state, and expose confirmed drafts.
- Create `test/ui/machines/postee.machine.request-draft.test.ts`: machine hydration, save success, and save failure tests.
- Modify `src/ui/components/postee/PosteeRequestBuilder.tsx`: hydrate local editor fields and submit complete drafts.
- Modify `src/ui/components/postee/PosteeWorkspace.tsx`: connect machine draft state and events to the builder.
- Create `test/ui/components/postee/PosteeRequestBuilder.test.tsx`: component hydration, dirty state, save payload, and failure behaviour.

### Task 1: Transactional Request Draft Persistence

**Files:**
- Create: `src/core/effects/postee/request-draft.ts`
- Create: `src/core/effects/postee/request-draft.test.ts`
- Modify: `src/core/effects/postee/index.ts`

**Interfaces:**
- Consumes: `DatabaseService`, `PosteeRequest`, `PosteeRequestHeader`, `PosteeRequestBody`, and existing Postee database operations.
- Produces:

```ts
export interface PosteeDraftHeader {
  readonly id: string;
  readonly key: string;
  readonly value: string;
  readonly enabled: boolean;
}

export interface PosteeRequestDraft {
  readonly request: PosteeRequest;
  readonly headers: ReadonlyArray<PosteeDraftHeader>;
  readonly body: PosteeRequestBody;
}

export const loadPosteeRequestDraft: (
  request: PosteeRequest,
) => Effect.Effect<PosteeRequestDraft, DatabaseError, DatabaseService>;

export const savePosteeRequestDraft: (
  draft: PosteeRequestDraft,
) => Effect.Effect<PosteeRequestDraft, DatabaseError, DatabaseService>;
```

- [ ] **Step 1: Write failing Effect tests**

Create tests with an in-memory `DatabaseService` stub that records SQL calls and controls transaction execution:

```ts
it("hydrates persisted headers and body into a complete request draft", async () => {
  const draft = await runWithDatabase(loadPosteeRequestDraft(request), service);

  expect(draft.headers).toEqual([
    { id: "41", key: "Accept", value: "application/json", enabled: true },
  ]);
  expect(draft.body).toEqual({
    request_id: request.id,
    mode: "json",
    raw: "{\"hello\":\"world\"}",
    form_values: null,
  });
});

it("uses an empty JSON body when a request has no persisted body", async () => {
  const draft = await runWithDatabase(loadPosteeRequestDraft(request), serviceWithoutBody);

  expect(draft.body).toEqual({
    request_id: request.id,
    mode: "json",
    raw: "{}",
    form_values: null,
  });
});

it("saves metadata headers and body in one transaction", async () => {
  const saved = await runWithDatabase(savePosteeRequestDraft(draft), service);

  expect(transactionCalls).toBe(1);
  expect(executedSql).toEqual(expect.arrayContaining([
    expect.stringContaining("UPDATE postee_requests"),
    expect.stringContaining("DELETE FROM postee_request_headers"),
    expect.stringContaining("INSERT INTO postee_request_headers"),
    expect.stringContaining("INSERT INTO postee_request_bodies"),
  ]));
  expect(saved).toEqual(draft);
});
```

- [ ] **Step 2: Run the tests and confirm RED**

Run:

```bash
bun run test:run -- src/core/effects/postee/request-draft.test.ts
```

Expected: fail because `request-draft.ts` and its exports do not exist.

- [ ] **Step 3: Implement the minimal Effect boundary**

Implement conversion without importing UI code:

```ts
const toDraftHeader = (header: PosteeRequestHeader): PosteeDraftHeader => ({
  id: String(header.id),
  key: header.key,
  value: header.value ?? "",
  enabled: header.is_enabled === 1,
});

const defaultBody = (requestId: string): PosteeRequestBody => ({
  request_id: requestId,
  mode: "json",
  raw: "{}",
  form_values: null,
});
```

Implement `loadPosteeRequestDraft` with `listPosteeRequestHeaders` and
`getPosteeRequestBody`. Implement `savePosteeRequestDraft` by yielding
`DatabaseService` once and wrapping `updatePosteeRequest`,
`replacePosteeRequestHeaders`, and `upsertPosteeRequestBody` in
`service.transaction`. Map draft headers to ordered database rows and ignore
blank header names.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run:

```bash
bun run test:run -- src/core/effects/postee/request-draft.test.ts
```

Expected: all request-draft tests pass with no warnings.

- [ ] **Step 5: Run core lint and commit**

Run:

```bash
bun run lint -- src/core/effects/postee/request-draft.ts src/core/effects/postee/request-draft.test.ts src/core/effects/postee/index.ts
git add src/core/effects/postee/request-draft.ts src/core/effects/postee/request-draft.test.ts src/core/effects/postee/index.ts
git commit -m "feat: add transactional Postee request drafts"
```

Expected: lint exits zero and the commit contains only Task 1 files.

### Task 2: Machine Hydration and Save Lifecycle

**Files:**
- Modify: `src/ui/machines/postee.machine.ts`
- Create: `test/ui/machines/postee.machine.request-draft.test.ts`

**Interfaces:**
- Consumes: `PosteeRequestDraft`, `loadPosteeRequestDraft`, and `savePosteeRequestDraft` from Task 1.
- Produces:

```ts
export interface RequestDraftSaveState {
  readonly status: "idle" | "saving" | "success" | "error";
  readonly requestId: RequestId | null;
  readonly error: string | null;
  readonly revision: number;
}
```

`PosteeContext` gains:

```ts
requestDrafts: Record<string, PosteeRequestDraft>;
pendingRequestDraft: PosteeRequestDraft | null;
requestDraftSave: RequestDraftSaveState;
```

`PosteeEvent` gains:

```ts
| { type: "SAVE_REQUEST_DRAFT"; draft: PosteeRequestDraft }
```

- [ ] **Step 1: Write failing machine lifecycle tests**

Build a deterministic layer with a database stub and no-op `HttpClient`, start
the real workspace machine with `createActor`, and use `waitFor`:

```ts
it("hydrates request drafts while loading the workspace", async () => {
  const actor = createActor(createPosteeWorkspaceMachine({ layer }));
  actor.start();
  await waitFor(actor, (snapshot) => snapshot.matches({ ready: "idle" }));

  expect(actor.getSnapshot().context.requestDrafts["request-1"]).toMatchObject({
    headers: [{ key: "Accept", value: "application/json", enabled: true }],
    body: { mode: "json", raw: "{\"before\":true}" },
  });
});

it("publishes a saved draft only after transactional persistence succeeds", async () => {
  actor.send({ type: "SAVE_REQUEST_DRAFT", draft: changedDraft });
  await waitFor(actor, (snapshot) =>
    snapshot.context.requestDraftSave.status === "success"
  );

  expect(actor.getSnapshot().context.requestDrafts["request-1"]).toEqual(changedDraft);
  expect(actor.getSnapshot().context.requestDraftSave.revision).toBe(1);
});

it("retains the previous confirmed draft and exposes the error when save fails", async () => {
  actor.send({ type: "SAVE_REQUEST_DRAFT", draft: changedDraft });
  await waitFor(actor, (snapshot) =>
    snapshot.context.requestDraftSave.status === "error"
  );

  expect(actor.getSnapshot().context.requestDrafts["request-1"]).toEqual(originalDraft);
  expect(actor.getSnapshot().context.requestDraftSave.error).toContain("save failed");
});
```

- [ ] **Step 2: Run the machine tests and confirm RED**

Run:

```bash
bun run test:run -- test/ui/machines/postee.machine.request-draft.test.ts
```

Expected: fail because request drafts and the save event do not exist.

- [ ] **Step 3: Hydrate drafts during workspace load**

After loading request metadata, flatten the request map and use
`Effect.forEach(..., { batching: true })` with `loadPosteeRequestDraft`. Return a
`requestDrafts` record from `LoadWorkspaceResult` and assign it in
`assignWorkspace`. New requests receive an in-memory default JSON draft.

- [ ] **Step 4: Add the explicit save state**

Add a `savingDraft` sibling state under `ready`:

```ts
SAVE_REQUEST_DRAFT: {
  target: "savingDraft",
  actions: "stageRequestDraft",
}
```

The invoked actor calls `savePosteeRequestDraft`. On success, update
`requestsByCollection`, update `requestDrafts`, clear the pending draft, set
`status: "success"`, and increment `revision`. On failure, preserve the
confirmed map, clear only the pending draft, and expose a public error string.
Return to `idle` after each terminal action; retain the save status until the
next save begins.

- [ ] **Step 5: Run machine and existing Postee tests**

Run:

```bash
bun run test:run -- test/ui/machines/postee.machine.request-draft.test.ts test/ui/machines/postee.machine.phase2.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 6: Run lint and commit**

Run:

```bash
bun run lint -- src/ui/machines/postee.machine.ts test/ui/machines/postee.machine.request-draft.test.ts
git add src/ui/machines/postee.machine.ts test/ui/machines/postee.machine.request-draft.test.ts
git commit -m "feat: manage Postee request draft saves"
```

Expected: lint exits zero and the commit contains only Task 2 files.

### Task 3: Request Builder Hydration and Truthful Save UX

**Files:**
- Modify: `src/ui/components/postee/PosteeRequestBuilder.tsx`
- Modify: `src/ui/components/postee/PosteeWorkspace.tsx`
- Create: `test/ui/components/postee/PosteeRequestBuilder.test.tsx`

**Interfaces:**
- Consumes: confirmed `PosteeRequestDraft`, `RequestDraftSaveState`, and
  `SAVE_REQUEST_DRAFT` from Task 2.
- Produces component props:

```ts
selectedRequestDraft: PosteeRequestDraft | null;
requestDraftSave: RequestDraftSaveState;
onSaveRequestDraft: (draft: PosteeRequestDraft) => void;
```

- [ ] **Step 1: Write failing request-builder tests**

Mock Monaco with a labelled textarea and render the real `HeadersEditor`:

```ts
it("hydrates body and headers from the selected persisted draft", () => {
  renderBuilder({ selectedRequestDraft: persistedDraft });

  expect(screen.getByLabelText("Request body")).toHaveValue("{\"saved\":true}");
  expect(screen.getByLabelText("Header name")).toHaveValue("Accept");
  expect(screen.getByLabelText("Header value")).toHaveValue("application/json");
});

it("submits the complete dirty draft and waits for confirmed save", async () => {
  const { rerender, onSaveRequestDraft } = renderBuilder({
    selectedRequestDraft: persistedDraft,
  });

  await user.clear(screen.getByLabelText("Request body"));
  await user.type(screen.getByLabelText("Request body"), "{\"changed\":true}");
  await user.click(screen.getByRole("button", { name: "Save" }));

  expect(onSaveRequestDraft).toHaveBeenCalledWith(expect.objectContaining({
    body: expect.objectContaining({ mode: "json", raw: "{\"changed\":true}" }),
  }));
  expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();

  rerenderBuilder({ requestDraftSave: successfulSaveRevisionOne });
  expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
});

it("keeps the draft dirty and shows the save error after persistence fails", async () => {
  const view = renderBuilder({ selectedRequestDraft: persistedDraft });
  await user.type(screen.getByLabelText("Request body"), " ");
  await user.click(screen.getByRole("button", { name: "Save" }));

  view.rerenderWith({
    requestDraftSave: {
      status: "error",
      requestId: RequestId("request-1"),
      error: "Request save failed",
      revision: 0,
    },
  });

  expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  expect(screen.getByRole("alert")).toHaveTextContent("Request save failed");
});

it("replaces body and headers when another request is selected", () => {
  const view = renderBuilder({ selectedRequestDraft: persistedDraft });
  view.rerenderWith({ selectedRequestDraft: secondPersistedDraft });

  expect(screen.getByLabelText("Request body")).toHaveValue("{\"second\":true}");
  expect(screen.getByLabelText("Header name")).toHaveValue("X-Second");
  expect(screen.queryByDisplayValue("Accept")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run component tests and confirm RED**

Run:

```bash
bun run test:run -- test/ui/components/postee/PosteeRequestBuilder.test.tsx
```

Expected: fail because the builder lacks persisted draft props and save states.

- [ ] **Step 3: Make the builder hydrate complete drafts**

Replace the isolated empty header/body defaults with values copied from
`selectedRequestDraft`. Map `PosteeDraftHeader` to the existing editor shape
without making the core module import UI types. On a selected request ID change,
replace URL, method, headers, body, and body mode together.

- [ ] **Step 4: Make all editable fields participate in dirty and save state**

Header and body change handlers set dirty state. The save handler submits:

```ts
onSaveRequestDraft({
  request: {
    ...selectedRequestDraft.request,
    method: requestMethod,
    url: trimmedUrl,
  },
  headers: requestHeaders,
  body: {
    ...selectedRequestDraft.body,
    mode: bodyWasEdited ? "json" : selectedRequestDraft.body.mode,
    raw: requestBody,
  },
});
```

While saving, show a disabled `Saving...` command and disable Send. Clear dirty
state only when the matching request's save revision increases after a
successful save. On error, keep Save visible and render the public error with
`role="alert"`.

- [ ] **Step 5: Wire the workspace to machine state**

Select `requestDrafts[selectedRequest.id]`, pass it and
`requestDraftSave` to the builder, and replace metadata-only save dispatch with
`SAVE_REQUEST_DRAFT`. Keep request creation behaviour unchanged.

- [ ] **Step 6: Run focused tests and confirm GREEN**

Run:

```bash
bun run test:run -- test/ui/components/postee/PosteeRequestBuilder.test.tsx test/ui/machines/postee.machine.request-draft.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 7: Run full TypeScript verification**

Run:

```bash
bun run lint
bun run test:run
bun run build
bun run knip
```

Expected: every command exits zero, with 0 failed tests and no new unused
exports or files.

- [ ] **Step 8: Commit**

```bash
git add src/ui/components/postee/PosteeRequestBuilder.tsx src/ui/components/postee/PosteeWorkspace.tsx test/ui/components/postee/PosteeRequestBuilder.test.tsx
git commit -m "feat: persist Postee request bodies and headers"
```

Expected: the commit contains only Task 3 files.

## Final Review and Merge

- [ ] Generate a review package from the branch base to `HEAD`.
- [ ] Run a whole-branch code review focused on lifecycle truthfulness,
      transactionality, request-switch leakage, and regression coverage.
- [ ] Resolve all Critical and Important findings and rerun their covering tests.
- [ ] Run fresh final verification:

```bash
bun run lint
bun run test:run
bun run build
bun run knip
cargo test --manifest-path src-tauri/Cargo.toml
git diff --check "$(git merge-base main HEAD)" HEAD
```

- [ ] Merge `feat/postee-durable-request-details` into `main` locally with a
      non-fast-forward merge after all gates pass.
