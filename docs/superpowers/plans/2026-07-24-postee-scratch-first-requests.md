# Postee Scratch-First Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open Postee into a durable, immediately executable scratch request that can later be promoted into a collection request without losing authored state.

**Architecture:** Scratch drafts are first-class SQLite records with no collection foreign key. A focused Effect service serialises, persists, reopens, discards, and atomically promotes them; the Postee XState machine owns active editor/tab state and persistence lifecycles. React renders scratch tabs and a stable request command row from machine state, while saved requests remain navigator-selected rather than becoming tabs in this slice.

**Tech Stack:** Bun, Astro 6, React 19, TypeScript, Effect, XState v5, React Aria Components, vanilla-extract, Tauri 2, SQLite/sqlx, Vitest, fast-check.

## Global Constraints

- Use Bun commands and the existing `@/core`, `@/ui`, and `@schema` aliases.
- Keep scratch records local-only and separate from `postee_requests`; do not create a hidden collection.
- Persist authored template expressions such as `{{token}}`, never resolved environment values or execution diagnostics containing secret values.
- Keep method, URL, environment, Send, Save, and Cancel in one stable command row.
- Permit Send when a scratch URL and request semantics are valid; collection membership is never a Send precondition.
- Create scratch tabs only. Saved-request tabs, import, OpenAPI, persisted response snapshots, and protocol changes are out of scope.
- Follow two-space formatting, double quotes, semicolons, and use `apply_patch` for edits.
- Each task starts red, reaches green, runs its focused suite, and commits with the listed subject.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src-tauri/migrations/032_create_postee_scratch_drafts.sql` | Durable scratch draft schema and ordering/index constraints. |
| `src/core/effects/database.postee.ts` | Typed SQLite rows and CRUD primitives for scratch drafts. |
| `src/core/effects/postee/scratch-draft.ts` | Scratch serialisation, persistence, reopen/discard, and atomic promotion. |
| `src/core/effects/postee/request-draft.ts` | In-transaction saved-request persistence reused by promotion. |
| `src/core/effects/postee/index.ts` | Public Postee scratch service and type exports. |
| `src/core/effects/postee/scratch-draft.test.ts` | Effect persistence and promotion integration tests. |
| `src/core/effects/postee/scratch-draft.property.test.ts` | fast-check secret-boundary proof. |
| `src/ui/machines/postee.machine.ts` | Active editor union, scratch events, persistence, execution, and promotion. |
| `test/ui/machines/postee.machine.scratch.test.ts` | XState launch, send, recovery, retry, and promotion tests. |
| `src/ui/components/postee/ScratchTabStrip.tsx` | Accessible scratch tab list, close actions, and reopen overflow. |
| `src/ui/components/postee/ScratchTabStrip.css.ts` | Fixed-size, overflow-safe tab styling. |
| `src/ui/components/postee/SaveScratchDialog.tsx` | Collection chooser shown only when saving a scratch. |
| `src/ui/components/postee/SaveScratchDialog.css.ts` | Dialog layout and validation styling. |
| `src/ui/components/postee/PosteeRequestBuilder.tsx` | Controlled scratch-compatible editor and stable command row. |
| `src/ui/components/postee/PosteeWorkspace.tsx` | Machine-to-editor/tab wiring and callbacks. |
| `src/ui/components/postee/PosteeWorkspace.css.ts` | Command-row and constrained-width workspace rules. |
| `src/ui/components/postee/PosteeSidebar.tsx` | Scratch-first empty state and navigator-only saved selection. |
| `test/ui/components/postee/ScratchTabStrip.test.tsx` | Keyboard navigation, close, and reopen tests. |
| `test/ui/components/postee/PosteeScratchFirstFlow.test.tsx` | First Send, save prompt, and narrow layout tests. |
| `docs/src/content/docs/overview/postee-product-roadmap.md` | Evidence-based roadmap updates. |

## Task 1: Add Durable Scratch Draft Storage

**Files:**
- Create: `src-tauri/migrations/032_create_postee_scratch_drafts.sql`
- Modify: `src/core/effects/database.postee.ts`
- Modify: `src/core/effects/postee/index.ts`
- Create: `test/core/effects/postee/scratch-draft-storage.test.ts`

**Interfaces:** Produces `PosteeScratchDraftRow`, `listPosteeScratchDrafts`, `upsertPosteeScratchDraft`, `setPosteeScratchDraftOpen`, and `deletePosteeScratchDraft`. All methods consume the existing `DatabaseService` boundary and accept authored values only.

- [ ] **Step 1: Write the failing storage test**

```ts
it("orders open drafts and retains closed drafts for reopening", async () => {
  const [service, recorder] = makeDatabaseService();
  await runWithDatabase(upsertPosteeScratchDraft(openDraft), service);
  await runWithDatabase(setPosteeScratchDraftOpen(openDraft.id, false), service);

  await expect(runWithDatabase(listPosteeScratchDrafts(), service)).resolves.toEqual([closedDraft]);
  expect(recorder.executions()).toEqual(expect.arrayContaining([
    expect.objectContaining({ sql: expect.stringContaining("INSERT INTO postee_scratch_drafts") }),
    expect.objectContaining({ sql: expect.stringContaining("SET is_open = ?") }),
  ]));
});
```

- [ ] **Step 2: Verify the test is red**

Run: `bun run test:run test/core/effects/postee/scratch-draft-storage.test.ts`

Expected: FAIL because scratch storage functions do not exist.

- [ ] **Step 3: Add migration `032_create_postee_scratch_drafts.sql`**

```sql
CREATE TABLE postee_scratch_drafts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    method TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    headers_json TEXT NOT NULL,
    body_mode TEXT NOT NULL,
    body_raw TEXT,
    form_values TEXT,
    graphql_document TEXT,
    graphql_variables_json TEXT,
    graphql_operation_name TEXT,
    environment_id TEXT,
    tab_order INTEGER NOT NULL,
    is_open INTEGER NOT NULL DEFAULT 1 CHECK (is_open IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX postee_scratch_drafts_reopen_idx
    ON postee_scratch_drafts(is_open, updated_at DESC);
CREATE INDEX postee_scratch_drafts_open_order_idx
    ON postee_scratch_drafts(is_open, tab_order ASC, updated_at DESC);
```

- [ ] **Step 4: Add typed SQLite accessors**

```ts
export interface PosteeScratchDraftRow {
  readonly id: string;
  readonly name: string;
  readonly method: string;
  readonly url: string;
  readonly description: string | null;
  readonly headers_json: string;
  readonly body_mode: string;
  readonly body_raw: string | null;
  readonly form_values: string | null;
  readonly graphql_document: string | null;
  readonly graphql_variables_json: string | null;
  readonly graphql_operation_name: string | null;
  readonly environment_id: string | null;
  readonly tab_order: number;
  readonly is_open: 0 | 1;
  readonly created_at: number;
  readonly updated_at: number;
}

export const listPosteeScratchDrafts = (openOnly?: boolean) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    return yield* service.query<PosteeScratchDraftRow>(
      `SELECT * FROM postee_scratch_drafts
       ${openOnly === undefined ? "" : "WHERE is_open = ?"}
       ORDER BY is_open DESC, tab_order ASC, updated_at DESC`,
      openOnly === undefined ? [] : [openOnly ? 1 : 0],
    );
  });
```

Implement upsert with `ON CONFLICT(id) DO UPDATE`, preserve `created_at`, and bind only row fields. Implement close/reopen with `UPDATE ... SET is_open = ?, updated_at = ? WHERE id = ?`, and discard with `DELETE ... WHERE id = ?`. Export the accessors and row type through `postee/index.ts`.

- [ ] **Step 5: Run focused verification and commit**

Run: `bun run test:run test/core/effects/postee/scratch-draft-storage.test.ts`

Expected: PASS.

Run: `cargo fmt --manifest-path src-tauri/Cargo.toml --all --check`

Expected: exit 0.

```bash
git add src-tauri/migrations/032_create_postee_scratch_drafts.sql src/core/effects/database.postee.ts src/core/effects/postee/index.ts test/core/effects/postee/scratch-draft-storage.test.ts
git commit -m "feat: persist Postee scratch drafts"
```

## Task 2: Define Scratch Draft Operations and Atomic Promotion

**Files:**
- Create: `src/core/effects/postee/scratch-draft.ts`
- Create: `src/core/effects/postee/scratch-draft.test.ts`
- Create: `src/core/effects/postee/scratch-draft.property.test.ts`
- Modify: `src/core/effects/postee/request-draft.ts`
- Modify: `src/core/effects/postee/request-draft.test.ts`
- Modify: `src/core/effects/postee/index.ts`

**Interfaces:** Consumes Task 1 rows. Produces `PosteeScratchDraft`, `newPosteeScratchDraft`, `loadPosteeScratchDrafts`, `savePosteeScratchDraft`, `closePosteeScratchDraft`, `reopenPosteeScratchDraft`, `discardPosteeScratchDraft`, `promotePosteeScratchDraft`, and `persistPosteeRequestDraftInTransaction`.

- [ ] **Step 1: Write failing domain and property tests**

```ts
it("promotes a scratch atomically and removes only the promoted scratch", async () => {
  const [service, recorder] = makeDatabaseService();
  const promoted = await runWithDatabase(
    promotePosteeScratchDraft({ scratch, collectionId: "collection-1", requestId: "request-1" }),
    service,
  );

  expect(promoted.request.collection_id).toBe("collection-1");
  expect(recorder.transactionCalls()).toBe(1);
  expect(recorder.executedSql()).toEqual(expect.arrayContaining([
    expect.stringContaining("INSERT INTO postee_requests"),
    expect.stringContaining("INSERT INTO postee_request_bodies"),
    expect.stringContaining("DELETE FROM postee_scratch_drafts"),
  ]));
});

it.prop([fc.stringMatching(/^[A-Za-z0-9_-]{1,32}$/)])(
  "does not serialise a resolved environment value",
  (secret) => {
    const stored = serialisePosteeScratchDraft({ ...scratch, url: "https://{{host}}/{{token}}" });
    expect(JSON.stringify(stored)).not.toContain(secret);
  },
);
```

- [ ] **Step 2: Verify the tests are red**

Run: `bun run test:run src/core/effects/postee/scratch-draft.test.ts src/core/effects/postee/scratch-draft.property.test.ts`

Expected: FAIL because scratch domain operations do not exist.

- [ ] **Step 3: Implement scratch domain types and serialisation**

```ts
export interface PosteeScratchDraft {
  readonly id: string;
  readonly name: string;
  readonly method: HttpMethod;
  readonly url: string;
  readonly description: string | null;
  readonly headers: ReadonlyArray<PosteeDraftHeader>;
  readonly body: Omit<PosteeRequestBody, "request_id">;
  readonly graphql: Omit<PosteeGraphqlRequest, "request_id"> | null;
  readonly environmentId: string | null;
  readonly tabOrder: number;
  readonly isOpen: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export const newPosteeScratchDraft = (input: { id: string; tabOrder: number; now: number }): PosteeScratchDraft => ({
  id: input.id,
  name: "Untitled request",
  method: "GET",
  url: "",
  description: null,
  headers: [],
  body: { mode: "json", raw: "{}", form_values: null },
  graphql: null,
  environmentId: null,
  tabOrder: input.tabOrder,
  isOpen: true,
  createdAt: input.now,
  updatedAt: input.now,
});
```

Map only authored fields to `PosteeScratchDraftRow`; serialisation never accepts environment variable records.

- [ ] **Step 4: Extract in-transaction request persistence and promote**

```ts
export const persistPosteeRequestDraftInTransaction = (draft: PosteeRequestDraft) =>
  Effect.gen(function*() {
    const acceptedHeaders = draft.headers.filter((header) => header.key.trim().length > 0);
    const headers = acceptedHeaders.map((header, sort_order) => ({
      request_id: draft.request.id,
      key: header.key,
      value: header.value,
      is_enabled: header.enabled ? 1 : 0,
      sort_order,
    }));
    const body = { ...draft.body, request_id: draft.request.id };
    const request = yield* updatePosteeRequest(draft.request);
    yield* replacePosteeRequestHeaders(draft.request.id, headers);
    yield* upsertPosteeRequestBody(body);
    if (body.mode === "graphql" && draft.graphql !== null) {
      yield* upsertPosteeGraphqlRequest({ ...draft.graphql, request_id: draft.request.id });
    } else {
      yield* deletePosteeGraphqlRequest(draft.request.id);
    }
    return { request, headers: acceptedHeaders, body, graphql: body.mode === "graphql" ? draft.graphql : null };
  });

export const savePosteeRequestDraft = (draft: PosteeRequestDraft) =>
  Effect.flatMap(DatabaseService, (service) => service.transaction(persistPosteeRequestDraftInTransaction(draft)));
```

`promotePosteeScratchDraft` runs one transaction: create the collection request, persist headers/body/GraphQL with the extracted helper, delete the scratch row, and return the saved draft. A failed transaction leaves the scratch intact.

- [ ] **Step 5: Run focused verification and commit**

Run: `bun run test:run src/core/effects/postee/scratch-draft.test.ts src/core/effects/postee/scratch-draft.property.test.ts src/core/effects/postee/request-draft.test.ts`

Expected: PASS, including atomic rollback and secret-boundary assertions.

```bash
git add src/core/effects/postee/scratch-draft.ts src/core/effects/postee/scratch-draft.test.ts src/core/effects/postee/scratch-draft.property.test.ts src/core/effects/postee/request-draft.ts src/core/effects/postee/request-draft.test.ts src/core/effects/postee/index.ts
git commit -m "feat: add Postee scratch draft lifecycle"
```

## Task 3: Make the Workspace Machine Scratch-Aware

**Files:**
- Modify: `src/ui/machines/postee.machine.ts`
- Create: `test/ui/machines/postee.machine.scratch.test.ts`
- Modify: `test/ui/machines/postee.machine.request-draft.test.ts`

**Interfaces:** Consumes Task 2 effects. Produces `PosteeEditorTarget`, scratch event contracts, and context fields `scratchDrafts`, `openScratchIds`, `closedScratchIds`, and `activeEditor`. Task 4 consumes the resolved active editable draft rather than `activeRequestId`.

- [ ] **Step 1: Write failing XState lifecycle tests**

```ts
it("opens a fresh scratch while retaining prior drafts for reopen after restart", async () => {
  const actor = createActor(createPosteeWorkspaceMachine({ layer }));
  actor.start();
  await waitFor(actor, (snapshot) => snapshot.matches({ ready: "idle" }));

  expect(actor.getSnapshot().context.activeEditor).toMatchObject({ kind: "scratch" });
  expect(actor.getSnapshot().context.openScratchIds).toHaveLength(1);
  expect(actor.getSnapshot().context.closedScratchIds).toContain("prior-scratch");
});

it("sends a valid scratch and records history with null request id", async () => {
  actor.send({ type: "UPDATE_SCRATCH_DRAFT", draft: validScratch });
  actor.send({ type: "RUN_REQUEST" });
  await waitFor(actor, (snapshot) => snapshot.context.runner.status === "success");
  expect(recorder.historyEntries()[0]?.request_id).toBeNull();
});
```

Cover new, debounced save, retry, close/reopen, discard, promotion, and saved request selection in the same suite.

- [ ] **Step 2: Verify the tests are red**

Run: `bun run test:run test/ui/machines/postee.machine.scratch.test.ts`

Expected: FAIL because scratch events and active editor state do not exist.

- [ ] **Step 3: Add the active editor union and scratch event contract**

Rename the current pre-scratch `PosteeEvent` union to `ExistingPosteeEvent`
without changing its variants, then compose it with the scratch events:

```ts
export type PosteeEditorTarget =
  | { readonly kind: "scratch"; readonly scratchId: string }
  | { readonly kind: "saved"; readonly requestId: RequestId }
  | null;

export type PosteeEvent =
  | { type: "CREATE_SCRATCH" }
  | { type: "SELECT_SCRATCH"; scratchId: string }
  | { type: "UPDATE_SCRATCH_DRAFT"; draft: PosteeScratchDraft }
  | { type: "CLOSE_SCRATCH"; scratchId: string }
  | { type: "REOPEN_SCRATCH"; scratchId: string }
  | { type: "DISCARD_SCRATCH"; scratchId: string }
  | { type: "PROMOTE_SCRATCH"; scratchId: string; collectionId: CollectionId; requestId: RequestId }
  | ExistingPosteeEvent;
```

During workspace load, hydrate all prior drafts as reopenable, create and persist one new scratch, and select it. Do not select the first collection/request when the new scratch is available.

- [ ] **Step 4: Add persistence, execution, schema, and promotion states**

Use XState `savingScratch`, `retryingScratchSave`, and `promotingScratch`. `UPDATE_SCRATCH_DRAFT` updates the addressed draft then resets an `after: { 350: "savingScratch" }` debounce. A newer revision during an in-flight save returns to the debounce state; stale actor completion cannot overwrite it.

```ts
const activeEditableDraft = (context: PosteeContext): PosteeScratchDraft | PosteeRequestDraft | null => {
  if (context.activeEditor?.kind === "scratch") return context.scratchDrafts[context.activeEditor.scratchId] ?? null;
  if (context.activeEditor?.kind === "saved") return context.requestDrafts[context.activeEditor.requestId] ?? null;
  return null;
};
```

Refactor `runRequest` to prepare this draft directly. Scratch history uses `request_id: null`; saved history preserves its request ID. GraphQL schema context must derive from the active editable draft, allowing scratch GraphQL authoring without collection membership.

On successful promotion, replace the scratch target with the saved request, insert its returned draft into `requestDrafts` and `requestsByCollection`, remove the scratch IDs, and retain the runner response. On error retain the scratch and show a retryable failure.

- [ ] **Step 5: Run focused verification and commit**

Run: `bun run test:run test/ui/machines/postee.machine.scratch.test.ts test/ui/machines/postee.machine.request-draft.test.ts test/ui/components/postee/PosteeGraphqlLifecycle.test.tsx`

Expected: PASS.

```bash
git add src/ui/machines/postee.machine.ts test/ui/machines/postee.machine.scratch.test.ts test/ui/machines/postee.machine.request-draft.test.ts
git commit -m "feat: orchestrate Postee scratch requests"
```

## Task 4: Build the Scratch Tab and Command-Row UX

**Files:**
- Create: `src/ui/components/postee/ScratchTabStrip.tsx`
- Create: `src/ui/components/postee/ScratchTabStrip.css.ts`
- Create: `src/ui/components/postee/SaveScratchDialog.tsx`
- Create: `src/ui/components/postee/SaveScratchDialog.css.ts`
- Modify: `src/ui/components/postee/PosteeRequestBuilder.tsx`
- Modify: `src/ui/components/postee/PosteeWorkspace.tsx`
- Modify: `src/ui/components/postee/PosteeWorkspace.css.ts`
- Modify: `src/ui/components/postee/PosteeSidebar.tsx`
- Create: `test/ui/components/postee/ScratchTabStrip.test.tsx`
- Create: `test/ui/components/postee/PosteeScratchFirstFlow.test.tsx`
- Modify: `test/ui/components/postee/PosteeRequestBuilder.test.tsx`

**Interfaces:** Consumes Task 3 editor state. Produces `ScratchTabStrip` with select/close/reopen callbacks and `SaveScratchDialog` with `onConfirm(collectionId)`. The editor consumes an active editable draft and emits draft changes; it does not own durable draft lifecycle state.

- [ ] **Step 1: Write failing accessibility and first-use component tests**

```tsx
it("creates, closes, and reopens scratch tabs with keyboard navigation", async () => {
  const user = userEvent.setup();
  render(<ScratchTabStrip tabs={tabs} activeId="scratch-a" onSelect={onSelect} onClose={onClose} onReopen={onReopen} />);

  await user.keyboard("{ArrowRight}{Enter}");
  expect(onSelect).toHaveBeenCalledWith("scratch-b");
  await user.click(screen.getByRole("button", { name: "Close Untitled request" }));
  expect(onClose).toHaveBeenCalledWith("scratch-a");
  await user.click(screen.getByRole("button", { name: "Reopen drafts" }));
  await user.click(screen.getByRole("menuitem", { name: "Untitled request" }));
  expect(onReopen).toHaveBeenCalledWith("scratch-a");
});

it("sends a valid scratch before collection selection and opens a collection dialog only on Save", async () => {
  render(<PosteeWorkspace />);
  await user.type(screen.getByLabelText("Request URL"), "https://api.example.test/health");
  await user.click(screen.getByRole("button", { name: "Send request" }));
  expect(sendRequest).toHaveBeenCalledOnce();
  expect(screen.queryByRole("dialog", { name: "Save request" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Save request" }));
  expect(screen.getByRole("dialog", { name: "Save request" })).toBeVisible();
});
```

- [ ] **Step 2: Verify the tests are red**

Run: `bun run test:run test/ui/components/postee/ScratchTabStrip.test.tsx test/ui/components/postee/PosteeScratchFirstFlow.test.tsx`

Expected: FAIL because scratch tabs, save dialog, and scratch Send are not rendered.

- [ ] **Step 3: Implement `ScratchTabStrip` and reopen overflow**

```tsx
export interface ScratchTabStripProps {
  readonly tabs: ReadonlyArray<{ id: string; label: string; dirty: boolean }>;
  readonly activeId: string | null;
  readonly reopenable: ReadonlyArray<{ id: string; label: string }>;
  readonly onSelect: (id: string) => void;
  readonly onClose: (id: string) => void;
  readonly onReopen: (id: string) => void;
}
```

Use React Aria `Tabs`, `TabList`, and `Tab`, fixed icon-button dimensions for close controls, and a `Reopen drafts` menu only when closed drafts exist. The active tab must scroll into view when visible tabs overflow.

- [ ] **Step 4: Implement save-time collection selection and controlled editing**

`SaveScratchDialog` presents existing collections in a labelled listbox and disables confirmation until a collection is selected. Escape and Cancel close the dialog without changing the scratch. Confirm sends `PROMOTE_SCRATCH`.

Replace collection-first builder gating with the following boundary:

```ts
interface PosteeRequestBuilderProps {
  readonly activeDraft: PosteeScratchDraft | PosteeRequestDraft | null;
  readonly activeKind: "scratch" | "saved" | null;
  readonly onDraftChange: (draft: PosteeScratchDraft | PosteeRequestDraft) => void;
  readonly onSend: () => void;
  readonly onSave: () => void;
  readonly onCancel: () => void;
}
```

Keep the command row stable. Enable method, URL, and body editing for an active scratch. Enable Send only when URL validation and request semantics pass and no persistence failure is active; never require a collection. For a scratch, Save opens the dialog. For a saved request, retain existing save behaviour.

Update the sidebar empty state to state that requests can be sent without a collection; remove the blocking collection-first message.

- [ ] **Step 5: Add constrained-width styles**

Add a `@media` rule in `PosteeWorkspace.css.ts` with a stable grid that keeps the URL, active tab, and fixed Send button column visible. Inactive tabs and secondary actions overflow into menus rather than overlap or resize controls.

- [ ] **Step 6: Run focused verification and commit**

Run: `bun run test:run test/ui/components/postee/ScratchTabStrip.test.tsx test/ui/components/postee/PosteeScratchFirstFlow.test.tsx test/ui/components/postee/PosteeRequestBuilder.test.tsx test/ui/components/postee/PosteeSidebar.test.tsx`

Expected: PASS.

```bash
git add src/ui/components/postee/ScratchTabStrip.tsx src/ui/components/postee/ScratchTabStrip.css.ts src/ui/components/postee/SaveScratchDialog.tsx src/ui/components/postee/SaveScratchDialog.css.ts src/ui/components/postee/PosteeRequestBuilder.tsx src/ui/components/postee/PosteeWorkspace.tsx src/ui/components/postee/PosteeWorkspace.css.ts src/ui/components/postee/PosteeSidebar.tsx test/ui/components/postee/ScratchTabStrip.test.tsx test/ui/components/postee/PosteeScratchFirstFlow.test.tsx test/ui/components/postee/PosteeRequestBuilder.test.tsx
git commit -m "feat: add Postee scratch-first workspace UX"
```

## Task 5: Validate Recovery, Document Delivery, and Release Gates

**Files:**
- Modify: `docs/src/content/docs/overview/postee-product-roadmap.md`
- Modify: `README.md`
- Modify: `test/ui/machines/postee.machine.scratch.test.ts`

**Interfaces:** Consumes the full scratch flow from Tasks 1-4 and produces only evidence-backed roadmap/README claims.

- [ ] **Step 1: Add restart and failed-promotion lifecycle evidence**

```ts
it("starts a fresh scratch after restart while the prior scratch is reopenable", async () => {
  const first = createActor(createPosteeWorkspaceMachine({ layer }));
  first.start();
  await waitFor(first, (snapshot) => snapshot.matches({ ready: "idle" }));
  const priorId = scratchId(first.getSnapshot());
  first.stop();

  const second = createActor(createPosteeWorkspaceMachine({ layer }));
  second.start();
  await waitFor(second, (snapshot) => snapshot.matches({ ready: "idle" }));
  expect(scratchId(second.getSnapshot())).not.toBe(priorId);
  expect(second.getSnapshot().context.closedScratchIds).toContain(priorId);
});
```

Also assert a failed promotion retains the scratch row and selected editor and does not insert a request into `requestsByCollection`.

- [ ] **Step 2: Run complete TypeScript and Rust gates**

Run: `bun run test:run`

Expected: all Vitest files pass.

Run: `bun run lint`

Expected: exit 0.

Run: `bun run build`

Expected: Astro check/build completes with zero diagnostics.

Run: `bun run knip`

Expected: exit 0.

Run: `cargo fmt --manifest-path src-tauri/Cargo.toml --all --check`

Expected: exit 0.

Run: `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`

Expected: exit 0.

Run: `cargo test --manifest-path src-tauri/Cargo.toml`

Expected: all Rust tests pass.

- [ ] **Step 3: Perform desktop visual and interaction acceptance**

Run: `bun tauri dev`

Verify at desktop and constrained widths:

1. Postee opens to a blank scratch with no collection selected.
2. A valid scratch sends and writes history with no request ID.
3. Two scratch tabs can be authored, closed, reopened, and survive restart.
4. Save prompts for a collection only after Save is chosen.
5. Promotion retains editor/tab response state and adds the request to the selected collection.
6. Persistence/promotion failure retains the scratch and exposes retry.
7. URL, active tab, and Send do not overlap or disappear.

Record fresh screenshots only when they satisfy those acceptance criteria.

- [ ] **Step 4: Update docs from verified evidence and commit**

Mark the roadmap items delivered only after Steps 1-3: ready scratch request, Send before collection, explicit new request, stable command row, visible request state, save-time collection prompt, scratch close/reopen/keyboard navigation, and restart recovery. Keep request reorder, saved-request tabs, import, persisted response snapshots, split-pane persistence, and OpenAPI import unchecked.

Update `README.md` to describe durable local scratch requests and collection promotion. Do not claim narrow-window visual acceptance without Step 3 evidence.

Run: `git diff --check "$(git merge-base main HEAD)" HEAD`

Expected: no whitespace errors.

```bash
git add docs/src/content/docs/overview/postee-product-roadmap.md README.md test/ui/machines/postee.machine.scratch.test.ts
git commit -m "docs: record Postee scratch-first delivery"
```

## Plan Self-Review

### Spec Coverage

- Fresh active scratch, multiple durable drafts, close/reopen, and restart recovery: Tasks 1-3 and 5.
- Send before collection and stable command row: Task 4.
- Save-time collection choice and atomic promotion: Tasks 2-4.
- Template/secret boundary: Task 2 property test.
- Persistence errors, retry, and constrained width: Tasks 3-5.
- Tauri-backed persistence and visual acceptance: Task 5.
- Deferred saved-request tabs/import/response snapshots: Global Constraints and Task 5 docs.

### Completeness Scan

Every task names concrete files, interfaces, red/green commands, and commit boundaries. Deferred work is an explicit scope boundary.

### Type Consistency

`PosteeScratchDraftRow` originates in Task 1. `PosteeScratchDraft` originates in Task 2 and is consumed by Tasks 3-4. `PosteeEditorTarget` originates in Task 3 and is the only active-editor identity consumed by Task 4.
