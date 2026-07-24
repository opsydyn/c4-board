# Postee Scratch-First Requests Design

**Status:** Approved design, pending implementation-plan review

## Goal

Make Postee immediately useful without forcing a user to create a collection.
Opening the workspace presents a fresh request that can be authored and sent at
once. Unsaved work is durable locally, supports multiple tabs, and becomes a
normal collection request only when the user chooses to save it.

## User Decisions

- A scratch request survives application restarts.
- Postee opens to a new blank scratch instead of restoring an earlier draft as
  the active request.
- Earlier scratch requests remain available to reopen after launch.
- Multiple scratch tabs are supported.
- Scratch requests are not represented by a hidden or synthetic collection.

## Interaction Contract

### Entry and Tabs

1. Opening Postee creates and activates a new blank `Untitled request` scratch
   tab.
2. `New Request` creates another scratch tab and activates it.
3. Existing scratch drafts remain recoverable through a `Reopen drafts` tab
   overflow/menu after a restart.
4. Closing a scratch hides it from the active tab strip but does not delete it.
5. Discard is the only permanent deletion action. It is explicit and confirms
   the destructive action when retained work would be lost.

### Authoring and Sending

1. Scratch tabs expose the same method, URL, environment, headers, body,
   GraphQL payload, Send, Cancel, and response behaviour as saved requests.
2. A valid URL is the only collection-independent Send prerequisite. Collection
   membership is not required to execute a scratch request.
3. The stable command row keeps method, URL, environment, Send, Save, and
   Cancel visible while response, history, or performance surfaces change.
4. A tab label uses a request name when present; otherwise it derives a compact
   label from the method and URL host/path. Dirty state is visible without
   changing the tab's layout.

### Saving

1. Saving a scratch asks for a collection only at save time.
2. A successful save promotes the scratch to a normal collection request while
   preserving its editor content, response state, and tab position.
3. Saving never rewrites environment templates into resolved credential values.

## Persistence Boundary

### Data Model

Introduce a local workspace-draft record that is separate from
`postee_requests` and carries no `collection_id`. It stores:

- a stable scratch ID and tab order;
- method, URL, name, description, headers, body, and GraphQL fields;
- selected environment identity;
- lifecycle metadata required to restore the editor; and
- created and updated timestamps.

Workspace tab persistence records order and whether a tab references a saved
request or a scratch draft. It does not duplicate request domain data.

Draft values retain templates such as `{{token}}`; resolved environment values
exist only for request execution and must never be persisted in a scratch record
or diagnostic output.

### Ownership

- Effect services load, save, close, reopen, discard, and promote scratch
  drafts using the existing SQLite boundary.
- XState owns active tab selection and the explicit persistence, execution, and
  promotion lifecycles. It must not become another copy of durable draft data.
- React renders machine state and sends explicit commands. It does not own an
  independent draft lifecycle.

### Durability and Promotion

Edits are persisted through a short debounce and flush before tab switching,
close, and application exit. Failed writes preserve the in-memory draft, expose
a retryable failure state, and never report a false saved state.

Scratch promotion is atomic: create the conventional request and associated
headers, body, and GraphQL rows in the chosen collection; update the active tab
to the new request identity; then remove the scratch record. A failed promotion
leaves the scratch unchanged and recoverable.

Scratch executions write normal history evidence with no request ID, using the
existing nullable history relation. Persisting response bodies as part of the
scratch workspace is not included in this slice.

## UX Heuristics

1. **Immediate action:** landing in Postee offers a usable request rather than
   setup work.
2. **Stable controls:** primary request commands do not move between result
   views.
3. **Visible state:** scratch, dirty, saving, saved, running, cancelled, and
   failed are distinct and accessible.
4. **Recoverable control:** closing retains a scratch; discarding is deliberate.
5. **Progressive commitment:** collection selection occurs only when the user
   intentionally saves.

At constrained widths, the active tab and Send action remain visible. Secondary
tabs and actions move into overflow rather than overlapping controls.

## Failure Behaviour

- An invalid URL blocks Send with the local validation reason.
- A persistence failure retains the editable draft and supplies retry.
- A closed scratch reopens without creating a duplicate draft.
- The fresh launch scratch cannot overwrite a recovered draft.
- A failed collection save does not delete or partially promote the scratch.

## Verification Contract

- Effect property and integration tests cover persistence, promotion, restart
  recovery, and the absence of resolved secret values in durable drafts.
- XState tests cover launch, new, send, save, close/reopen, discard, retry, and
  restart recovery.
- Component tests cover command-row state, keyboard tab navigation, collection
  prompt timing, and tab overflow.
- Tauri-backed integration verifies local persistence and scratch history.
- Desktop and constrained-width visual/interactions checks verify the command
  row and tab behaviour remain usable.

## Scope Boundaries

This slice does not add request import, OpenAPI import, request reordering,
saved-request tabs, persisted response snapshots, or changes to protocol
support. Those remain separate roadmap work.
