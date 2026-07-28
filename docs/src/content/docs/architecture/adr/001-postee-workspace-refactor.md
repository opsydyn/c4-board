---
title: "ADR-001: PosteeWorkspace Component Refactor to Functional Core Pattern"
---

# ADR-001: PosteeWorkspace Component Refactor to Functional Core Pattern

**Status**: Accepted
**Date**: 2025-12-30

> **Accepted 2026-07-27.** Status corrected during an audit of the ADR index, which had carried this as Proposed long after it shipped. Every module this ADR proposed exists — `form-validation.ts`, `status-derivation.ts` and `ui-state.ts` — and Postee's logic now lives across 37 modules under `src/core/effects/postee/`, with the component down to 760 lines.

**Deciders**: Development Team
**Technical Story**: PosteeWorkspace architectural assessment revealed violations of Functional Core, Imperative Shell pattern

## Context

The PosteeWorkspace component (`src/ui/components/postee/PosteeWorkspace.tsx`) has grown to 1,355 lines and violates our core architectural principle:

### Current Problems

1. **State Explosion**: 24 separate `useState` calls for orchestration-level state
2. **Business Logic in Component**: Complex computations in `useMemo` hooks (status maps, derived state)
3. **Dual State Management**: State duplicated between XState machine and React hooks
4. **Tight Coupling**: Component handles UI chrome, business logic, and orchestration simultaneously
5. **Low Testability**: Cannot test business logic without mocking React hooks

### Architectural Principle

Our codebase follows **Functional Core, Imperative Shell**:

- **Functional Core (Effect-TS)**: Pure business logic with zero side effects
- **Imperative Shell (XState)**: Orchestrates WHEN to run effects
- **Presentation (React)**: Pure views that read state and send events

The PosteeWorkspace machine (`src/ui/machines/postee.machine.ts`) is exemplary, but the component violates the pattern.

### Success Example

The Auto Layout feature demonstrates proper architecture:
- **Effect Service**: `src/core/effects/layout.ts` - Pure layout algorithm
- **Machine**: `src/ui/machines/canvas.machine.ts` - Orchestrates WHEN to layout
- **Component**: `src/ui/components/Toolbar.tsx` - Sends events only

## Decision

We will refactor PosteeWorkspace in **3 phases** to restore architectural integrity:

### Phase 1: Extract Effect Services (Priority: HIGH)

Create pure business logic services in `src/core/effects/postee/`:

#### 1.1 Status Derivation Service
**File**: `src/core/effects/postee/status-derivation.ts`

```typescript
/**
 * Pure function: Derives request execution status from history
 * NO side effects, NO React, 100% testable
 */
export const deriveRequestStatuses = (
  history: PosteeHistoryEntry[]
): Effect<Map<string, RequestStatus>, never>

export const deriveCollectionStatuses = (
  collections: PosteeCollection[],
  requestsByCollection: Record<string, PosteeRequest[]>,
  requestStatuses: Map<string, RequestStatus>
): Effect<Map<string, RequestStatus>, never>
```

**Replaces**: Lines 354-412 in PosteeWorkspace.tsx

#### 1.2 Form Validation Service
**File**: `src/core/effects/postee/form-validation.ts`

```typescript
/**
 * Pure validation: Request form input validation
 */
export const validateRequestForm = (
  input: RequestFormInput
): Effect<ValidatedRequest, FormValidationError>

export const validateCollectionForm = (
  input: CollectionFormInput
): Effect<ValidatedCollection, FormValidationError>
```

**Replaces**: Inline validation logic scattered throughout handlers

#### 1.3 UI State Service
**File**: `src/core/effects/postee/ui-state.ts`

```typescript
/**
 * Pure layout calculations and UI state derivations
 */
export const calculateLayoutGrid = (
  layout: LayoutConfig
): Effect<GridTemplateConfig, never>

export const deriveActiveSelection = (
  collections: PosteeCollection[],
  activeCollectionId: CollectionId | null,
  activeRequestId: RequestId | null
): Effect<SelectionState, never>
```

**Replaces**: Lines 685-700 grid template logic

### Phase 2: Move State to Machine Context (Priority: HIGH)

#### 2.1 Extend Machine Context
**File**: `src/ui/machines/postee.machine.ts`

Add to context:
```typescript
export interface PosteeContext {
  // ... existing fields

  // NEW: UI orchestration state
  uiState: {
    formInputs: {
      newCollection: { name: string };
      newRequest: { name: string; url: string; method: HttpMethod };
      editRequest: { name: string; url: string; method: HttpMethod };
    };
    layout: {
      sidebarOpen: boolean;
      responseOpen: boolean;
      environmentOpen: boolean;
      compactMode: boolean;
      activeTab: "Body" | "Headers";
      activeResponseTab: "Execution" | "LoadTest" | "History";
    };
    requestEditor: {
      headers: Header[];
      body: string;
      showDiff: boolean;
    };
    selection: {
      expandedKeys: Set<Key>;
      selectedTreeKeys: Selection;
      isRenamingCollectionId: string | null;
    };
    inspected: {
      historyEntry: PosteeHistoryEntry | null;
    };
  };

  // NEW: Derived state (computed by Effect services)
  derivedState: {
    requestStatusMap: Map<string, RequestStatus>;
    collectionStatusMap: Map<string, RequestStatus>;
    requestCollectionMap: Map<string, string>;
  };
}
```

#### 2.2 Add Machine Events
```typescript
export type PosteeEvent =
  | ... existing events

  // NEW: UI state management events
  | { type: "UI_TOGGLE_SIDEBAR" }
  | { type: "UI_TOGGLE_RESPONSE" }
  | { type: "UI_TOGGLE_ENVIRONMENT" }
  | { type: "UI_SET_COMPACT_MODE"; compact: boolean }
  | { type: "UI_SET_ACTIVE_TAB"; tab: "Body" | "Headers" }
  | { type: "UI_UPDATE_FORM_INPUT"; form: string; field: string; value: string }
  | { type: "UI_UPDATE_REQUEST_BODY"; body: string }
  | { type: "UI_UPDATE_REQUEST_HEADERS"; headers: Header[] }
  | { type: "UI_TOGGLE_DIFF" }
  | { type: "UI_SELECT_TREE_KEYS"; keys: Selection }
  | { type: "UI_EXPAND_TREE_KEYS"; keys: Set<Key> }
```

#### 2.3 Add Machine Actions
```typescript
actions: {
  // ... existing actions

  // NEW: UI state actions
  toggleSidebar: assign({
    uiState: ({ context }) => ({
      ...context.uiState,
      layout: {
        ...context.uiState.layout,
        sidebarOpen: !context.uiState.layout.sidebarOpen
      }
    })
  }),

  updateRequestBody: assign({
    uiState: ({ context, event }) => {
      if (event.type !== "UI_UPDATE_REQUEST_BODY") return context.uiState;
      return {
        ...context.uiState,
        requestEditor: {
          ...context.uiState.requestEditor,
          body: event.body
        }
      };
    }
  }),

  // NEW: Derived state actions (using Effect services)
  updateDerivedStatuses: assign({
    derivedState: ({ context }) => {
      const requestStatuses = runLayeredEffect(
        context.layer,
        deriveRequestStatuses(context.history)
      );

      const collectionStatuses = runLayeredEffect(
        context.layer,
        deriveCollectionStatuses(
          context.collections,
          context.requestsByCollection,
          requestStatuses
        )
      );

      return {
        ...context.derivedState,
        requestStatusMap: requestStatuses,
        collectionStatusMap: collectionStatuses
      };
    }
  })
}
```

### Phase 3: Simplify Component (Priority: MEDIUM)

#### 3.1 Create Presentation Components
Break PosteeWorkspace into pure presentation components:

**Files to Create**:
- `src/ui/components/postee/PosteeSidebar.tsx` - Collections tree (lines 832-1048)
- `src/ui/components/postee/PosteeRequestBuilder.tsx` - Request editor (lines 1050-1241)
- `src/ui/components/postee/PosteeResponsePanel.tsx` - Response viewer (lines 701-811)
- `src/ui/components/postee/PosteeEnvironmentPanel.tsx` - Environment editor (lines 1292-1351)

Each component:
- **Props**: Pure data + event handlers
- **No hooks**: Except basic React hooks for local UI state
- **No logic**: Just presentation
- **Size**: < 200 lines each

#### 3.2 Refactor PosteeWorkspace.tsx
**Target**: Reduce from 1,355 lines → ~300 lines

```typescript
export function PosteeWorkspace() {
  const machine = useMemo(() => createPosteeWorkspaceMachine(), []);
  const [state, send] = useMachine(machine);

  const {
    collections,
    requestsByCollection,
    activeCollectionId,
    activeRequestId,
    environments,
    variablesByEnvironment,
    runner,
    history,
    uiState,
    derivedState
  } = state.context;

  // Pure event delegation (no logic)
  const handlers = {
    onCreateCollection: (name: string) =>
      send({ type: "CREATE_COLLECTION", payload: { id: CollectionIdBrand(nanoid()), name } }),

    onToggleSidebar: () =>
      send({ type: "UI_TOGGLE_SIDEBAR" }),

    onUpdateRequestBody: (body: string) =>
      send({ type: "UI_UPDATE_REQUEST_BODY", body }),

    // ... 10-15 simple delegations
  };

  return (
    <div className={styles.workspace} style={{ /* derived from uiState.layout */ }}>
      {uiState.layout.sidebarOpen && (
        <PosteeSidebar
          collections={collections}
          selectedKeys={uiState.selection.selectedTreeKeys}
          expandedKeys={uiState.selection.expandedKeys}
          statusMap={derivedState.collectionStatusMap}
          onSelect={handlers.onSelectCollection}
          onExpand={handlers.onExpandTreeKeys}
          // ... pure props only
        />
      )}

      <PosteeRequestBuilder
        selectedRequest={/* derived */}
        formInputs={uiState.formInputs.editRequest}
        requestEditor={uiState.requestEditor}
        activeTab={uiState.layout.activeTab}
        isRunning={state.matches({ ready: "running" })}
        onSubmit={handlers.onUpdateRequest}
        onRun={handlers.onRunRequest}
        // ... pure props only
      />

      {/* Similar for other panels */}
    </div>
  );
}
```

### Phase 4: Viewport Observation (Priority: LOW)

Move responsive layout detection to machine:

**File**: `src/core/effects/viewport.ts`

```typescript
/**
 * Effect service: Observe viewport size changes
 */
export const observeViewport = (): Effect<
  Stream<ViewportSize>,
  never,
  WindowService
>
```

**Machine Integration**:
```typescript
invoke: {
  id: "viewportObserver",
  src: fromObservable(() => viewportStream),
  onSnapshot: {
    actions: assign({
      uiState: ({ context, event }) => ({
        ...context.uiState,
        layout: {
          ...context.uiState.layout,
          compactMode: event.snapshot.width < 1360
        }
      })
    })
  }
}
```

## Consequences

### Positive

1. **Single Source of Truth**: All state lives in machine context
2. **Testability**: Business logic is pure Effect services (100% testable)
3. **Separation of Concerns**: Clear boundaries between layers
4. **Maintainability**: Smaller, focused components (< 300 lines each)
5. **Consistency**: Follows same pattern as successful features (Auto Layout)
6. **Performance**: Derived state computed once, not on every render
7. **Type Safety**: Full Effect-TS type inference for business logic

### Negative

1. **Migration Effort**: ~3-5 days of focused refactoring
2. **Learning Curve**: Team must understand Effect-TS services
3. **Testing Update**: Existing tests need rewrite (component → service tests)
4. **Temporary Duplication**: During migration, some code duplication

### Neutral

1. **File Count**: +8 new files (services + split components)
2. **Machine Complexity**: Context grows, but organized hierarchically
3. **No Feature Changes**: Same functionality, better architecture

## Migration Plan

### Week 1: Phase 1 (Effect Services)
- **Day 1-2**: Create status-derivation.ts + tests
- **Day 3**: Create form-validation.ts + tests
- **Day 4**: Create ui-state.ts + tests
- **Day 5**: Integration testing of services

### Week 2: Phase 2 (Machine State)
- **Day 1-2**: Extend machine context with uiState
- **Day 3**: Add UI state events + actions
- **Day 4**: Wire Effect services into machine actions
- **Day 5**: Test machine with new state structure

### Week 3: Phase 3 (Component Split)
- **Day 1**: Create PosteeSidebar.tsx
- **Day 2**: Create PosteeRequestBuilder.tsx
- **Day 3**: Create PosteeResponsePanel.tsx + PosteeEnvironmentPanel.tsx
- **Day 4**: Refactor PosteeWorkspace.tsx orchestrator
- **Day 5**: Integration testing + cleanup

### Week 4: Phase 4 + Polish
- **Day 1-2**: Create viewport.ts + integrate
- **Day 3**: Remove dead code from old PosteeWorkspace
- **Day 4**: Documentation updates
- **Day 5**: Code review + acceptance testing

## Testing Strategy

**MANDATORY**: Follow Red-Green-Blue (TDD) workflow for all implementation.

### Test Planning

All test cases to be implemented (in priority order):

#### Phase 1: Effect Services

**status-derivation.ts**:

1. Should mark request as error when response status >= 400
2. Should mark request as error when error_message exists
3. Should mark request as success when response status < 400
4. Should mark request as unknown when response_status is null
5. Should return most recent status when multiple history entries exist
6. Should ignore entries without request_id

**form-validation.ts**:

1. Should accept valid request form with all fields
2. Should reject empty request name
3. Should reject empty URL
4. Should reject invalid URL format
5. Should reject invalid HTTP method
6. Should trim whitespace from inputs

**ui-state.ts**:

1. Should calculate grid template for open sidebar + response
2. Should calculate grid template for closed sidebar
3. Should calculate grid template for compact mode
4. Should derive active selection state correctly

#### Phase 2: Machine Integration

1. Should toggle sidebar state on UI_TOGGLE_SIDEBAR event
2. Should update request body on UI_UPDATE_REQUEST_BODY event
3. Should update derived statuses when history changes
4. Should preserve UI state across collection switches
5. Should reset form inputs after successful creation

#### Phase 3: Component Tests

1. PosteeSidebar should render collections with correct status colors
2. PosteeRequestBuilder should disable run button when no active request
3. PosteeResponsePanel should show diff when toggled
4. PosteeEnvironmentPanel should save variables on change

### Red-Green-Blue Workflow

For each test case above, follow this cycle:

#### 🔴 RED: Write Failing Test

Example for first test case:

```typescript
// test/core/effects/postee/status-derivation.test.ts
import { describe, it, expect } from "vitest";
import { Effect } from "effect";
import { deriveRequestStatuses } from "@/core/effects/postee/status-derivation";
import type { PosteeHistoryEntry } from "@/core/effects/database.postee";

describe("deriveRequestStatuses", () => {
  it("should mark request as error when response status >= 400", async () => {
    // Arrange: Create test history with error status
    const history: PosteeHistoryEntry[] = [{
      id: "hist-1",
      request_id: "req-1",
      request_snapshot: "{}",
      response_status: 404,
      response_time_ms: 100,
      response_size_bytes: 1024,
      response_body: "Not Found",
      response_headers: "{}",
      error_message: null,
      executed_at: Date.now()
    }];

    // Act: Derive statuses (this will FAIL - function doesn't exist yet)
    const result = await Effect.runPromise(deriveRequestStatuses(history));

    // Assert: Expect error status
    expect(result.get("req-1")).toBe("error");
  });
});
```

Run: `bun test` → Should see RED (test fails because function doesn't exist)

#### 🟢 GREEN: Minimal Implementation

```typescript
// src/core/effects/postee/status-derivation.ts
import { Effect } from "effect";
import type { PosteeHistoryEntry } from "@/core/effects/database.postee";

export type RequestStatus = "success" | "error" | "unknown";

export const deriveRequestStatuses = (
  history: PosteeHistoryEntry[]
): Effect<Map<string, RequestStatus>, never> =>
  Effect.sync(() => {
    const map = new Map<string, RequestStatus>();

    for (const entry of history) {
      if (!entry.request_id) continue;

      // Minimal logic to pass first test
      const status: RequestStatus =
        entry.response_status && entry.response_status >= 400
          ? "error"
          : "success";

      map.set(entry.request_id, status);
    }

    return map;
  });
```

Run: `bun test` → Should see GREEN (test passes)

#### 🔵 BLUE: Refactor After All Tests Pass

After implementing tests 1-6, refactor to final design:

```typescript
// src/core/effects/postee/status-derivation.ts
import { Effect } from "effect";
import type { PosteeHistoryEntry } from "@/core/effects/database.postee";

export type RequestStatus = "success" | "error" | "unknown";

/**
 * Pure function: Determines execution status from history entry
 * NO side effects, 100% testable
 */
const statusFromEntry = (entry: PosteeHistoryEntry): RequestStatus => {
  if (entry.error_message) return "error";
  if (entry.response_status === null) return "unknown";
  return entry.response_status >= 400 ? "error" : "success";
};

/**
 * Effect service: Derives request status map from execution history
 * Returns most recent status for each request
 */
export const deriveRequestStatuses = (
  history: PosteeHistoryEntry[]
): Effect<Map<string, RequestStatus>, never> =>
  Effect.sync(() => {
    const latestStatuses = new Map<
      string,
      { status: RequestStatus; executedAt: number }
    >();

    for (const entry of history) {
      if (!entry.request_id) continue;

      const status = statusFromEntry(entry);
      const previous = latestStatuses.get(entry.request_id);

      if (!previous || entry.executed_at > previous.executedAt) {
        latestStatuses.set(entry.request_id, {
          status,
          executedAt: entry.executed_at
        });
      }
    }

    return new Map(
      Array.from(latestStatuses.entries()).map(([id, { status }]) => [
        id,
        status
      ])
    );
  });

/**
 * Effect service: Derives collection statuses from request statuses
 * Collection is "error" if any request errored, "success" if any succeeded, "unknown" otherwise
 */
export const deriveCollectionStatuses = (
  collections: PosteeCollection[],
  requestsByCollection: Record<string, PosteeRequest[]>,
  requestStatuses: Map<string, RequestStatus>
): Effect<Map<string, RequestStatus>, never> =>
  Effect.sync(() => {
    const map = new Map<string, RequestStatus>();

    for (const collection of collections) {
      const requests = requestsByCollection[collection.id] ?? [];
      let collectionStatus: RequestStatus = "unknown";

      for (const request of requests) {
        const requestStatus = requestStatuses.get(request.id) ?? "unknown";

        if (requestStatus === "error") {
          collectionStatus = "error";
          break; // Error takes precedence
        }

        if (requestStatus === "success" && collectionStatus === "unknown") {
          collectionStatus = "success";
        }
      }

      map.set(collection.id, collectionStatus);
    }

    return map;
  });
```

Run: `bun test` → Should stay GREEN (all tests still pass after refactor)

### Test Coverage Goals

- **Unit tests** (Effect services): 100% coverage - every function, every branch
- **Integration tests** (XState machine): Cover all state transitions and actions
- **Component tests**: Snapshot tests for visual regression

## Success Metrics

### Before (Current State)
- PosteeWorkspace.tsx: **1,355 lines**
- useState calls: **24**
- useMemo with logic: **6**
- Testable business logic: **0%**
- Effect service usage: **0%**

### After (Target State)
- PosteeWorkspace.tsx: **~300 lines** (orchestrator only)
- useState calls: **0** (all in machine)
- useMemo with logic: **0** (all Effect services)
- Testable business logic: **100%** (pure functions)
- Effect service usage: **100%** (status, validation, UI state)
- New components: **4 pure presentation components** (< 200 lines each)
- New services: **3 Effect services** (fully tested)

## Alternatives Considered

### Alternative 1: Keep React State, Add Context
**Rejected**: Doesn't solve architectural violation, just moves useState to Context

### Alternative 2: Zustand/Redux for UI State
**Rejected**: Introduces third state management library, violates single responsibility

### Alternative 3: Incremental Refactor (No Machine Changes)
**Rejected**: Leaves state split between React and XState, no single source of truth

## References

- `CLAUDE.md` - Functional Core, Imperative Shell
- `src/core/effects/layout.ts` (Reference architecture)
- `src/ui/machines/postee.machine.ts` (Already correct)
- [Effect-TS Documentation](https://effect.website/)
- [XState Documentation](https://statemachine.dev/)

## Follow-Up ADRs

- **ADR-002**: Viewport observation pattern (if Phase 4 reveals broader needs)
- **ADR-003**: Form validation framework (if pattern emerges across features)
- **ADR-004**: Derived state caching strategy (if performance issues arise)
