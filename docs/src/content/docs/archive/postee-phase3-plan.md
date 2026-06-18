---
title: "Postee Phase 3 Integration Plan"
---

```markdown
# Postee Phase 3 Integration Plan

## Target integration points
- `src/pages/postee.astro`  
  Replace the temporary `C4CanvasContainer` island with a dedicated React island that mounts the Postee workspace.
- `src/ui/components`  
  Introduce a `postee/` subdirectory to host collection sidebar, request editor, response viewer, environment drawer, and history panel components.
- `src/ui/machines/postee.machine.ts`  
  Wire the new machine through `@xstate/react` hooks inside the Postee workspace component. Provide the merged Effect layer (`Layer.merge(DatabaseServiceLive, HttpClientLive)`) via a lightweight context/provider.
- `src/core/effects/postee`  
  Reuse the new HTTP client service and database helpers. Add convenience wrappers (e.g. `loadWorkspace`, `executeRequest`) if the UI needs simpler entry points.

## Incremental implementation steps
1. **Scaffold React workspace shell**
   - Create `PosteeWorkspace.tsx` that runs the machine with `useMachine`.
   - Provide the machine with the shared layer (merging `DatabaseServiceLive` + `HttpClientLive`).
   - Render placeholder panes to verify layout.

2. **Collections + request list sidebar**
   - Component to render `collections` with nested requests and favorite badges.
   - Dispatch `SELECT_COLLECTION` / `SELECT_REQUEST` events.
   - Unit test: simple render confirms state transitions & selection styling.

3. **Request editor**
   - Tabs for `Params`, `Headers`, `Body`, `Auth` (initially stub).
   - Bind form inputs to machine context events (`UPDATE_REQUEST_METADATA`, header/body edits to be added).
   - Add optimistic local buffer before persisting via Effect.
   - Tests: controlled input updates & validation.

4. **Environment manager**
   - Drawer for environment switcher and variable table.
   - Events for `SELECT_ENVIRONMENT` and later CRUD for variables.
   - Tests: ensure disabling variables removes them from resolved request.

5. **Request runner + response viewer**
   - Display status code, duration, size, headers, and response body with syntax highlighting.
   - Hook `RUN_REQUEST`/`RUN_CANCEL`; show loader while `runner.status === "running"`.
   - Tests: mock machine to assert UI states.

6. **History panel**
   - Bottom sheet or side panel listing recent entries (`context.history`).
   - Allow replay by dispatching `SELECT_REQUEST` + `RUN_REQUEST`.
   - Tests: snapshot row rendering.

7. **Persisting edits**
   - Wire create/update/delete effects from `PosteeCollections` & `PosteeRequests`.
   - Emit toast notifications (reuse existing toast system if available).
   - Tests: verify Effect calls with spies/mocks.

8. **Styling & accessibility**
   - Use existing design tokens (`styles.css.ts` theme helpers) for typography and color.
   - Integrate `react-aria-components` for focus management and keyboard navigation.

## Testing strategy
- **Unit tests**
  - Machine tests (`postee.machine.test.ts`) to cover transitions (loading, run success/error, cancellation).
  - HTTP client tests mocking `fetch` (success, timeout, cancellation, interpolation).
- **Component tests**
  - Render workspace with mocked machine service using Vitest + Testing Library.
- **Integration tests**
  - Future: add MSW-powered flows when the API surface expands; currently focus on local fetch behaviour.
- **Visual regression (optional)**
  - Leverage Vitest browser runner once UI is polished (capture key states of Postee layout).
```
