---
title: "ADR-002: Postee Actor Model Refactor"
---

# ADR-002: Postee Actor Model Refactor

**Status**: Proposed
**Date**: 2025-01-XX
**Related**: [ADR-001](001-postee-workspace-refactor.md)

## Context

The current `postee.machine.ts` has grown to **1040 lines** and exhibits two critical anti-patterns:

### Problem 1: Boolean Blindness in Context

```typescript
// ❌ ANTI-PATTERN: Boolean flags in context
uiFlags: {
  isSidebarOpen: boolean;
  isResponseOpen: boolean;
  isCompactLayout: boolean;
  isEnvironmentOpen: boolean;
}
```

**Why this is wrong** (per [XState best practices](https://stately.ai/docs/context)):

- **Not state-driven**: Booleans in context make implicit states explicit states should represent
- **Boolean blindness**: `isSidebarOpen: true` loses semantic meaning (opening? open? closing?)
- **Combinatorial explosion**: 4 booleans = 16 possible combinations, many invalid
- **Hard to reason about**: What's the valid state space? Can sidebar be closed while response is docked?

**XState principle**: "Use states to model states, context for data"

### Problem 2: Monolithic Machine (1040 Lines)

The machine handles too many concerns:
- Collections management
- Request CRUD
- Environment management
- Request execution (runner)
- UI layout state
- History tracking

**Result**: Hard to test, hard to reason about, hard to maintain.

## Decision

Refactor to the **Actor Model** using XState 5's spawn/invoke patterns:

```
PosteeWorkspaceMachine (Orchestrator)
  ├─> UIPanelMachine (spawned actor)
  │    ├─ States: sidebar.open, sidebar.closed
  │    ├─ States: response.docked, response.floating, response.closed
  │    └─ States: layout.normal, layout.compact
  ├─> CollectionsMachine (spawned actor)
  │    ├─ States: idle, loading, ready, error
  │    └─ Context: collections[], activeCollectionId
  ├─> RequestsMachine (spawned actor)
  │    ├─ States: idle, editing, validating
  │    └─ Context: requests[], activeRequestId
  ├─> RunnerMachine (invoked actor)
  │    ├─ States: idle, preparing, executing, success, error
  │    └─ Context: requestId, response, error
  └─> EnvironmentsMachine (spawned actor)
       ├─ States: idle, loading, ready
       └─ Context: environments[], activeEnvironmentId
```

### Actor Hierarchy

**Parent Machine** (`postee.machine.ts`):
- **Responsibility**: Orchestration, coordination, spawning child actors
- **Context**: References to spawned actors, minimal shared state
- **Events**: High-level coordination events (WORKSPACE_LOADED, RUN_REQUEST)

**Child Machines** (spawned with `spawnChild`):
- **Responsibility**: Single concern (UI layout, collections, runner, etc.)
- **Context**: Domain-specific data
- **Communication**: Send events to parent, receive events from parent

## Design: UI Panel Actor (Example)

Replace boolean flags with explicit states:

```typescript
// ✅ CORRECT: State-driven UI
const uiPanelMachine = setup({
  types: {} as {
    context: {
      // Data only, no booleans representing states
      gridConfig: GridConfig;
    };
    events:
      | { type: "TOGGLE_SIDEBAR" }
      | { type: "TOGGLE_RESPONSE" }
      | { type: "SET_LAYOUT"; layout: "normal" | "compact" };
  },
}).createMachine({
  id: "uiPanel",
  type: "parallel", // Multiple orthogonal states
  states: {
    // Sidebar state (not boolean!)
    sidebar: {
      initial: "open",
      states: {
        open: {
          on: { TOGGLE_SIDEBAR: "closed" }
        },
        closed: {
          on: { TOGGLE_SIDEBAR: "open" }
        }
      }
    },
    // Response panel state
    response: {
      initial: "closed",
      states: {
        closed: {
          on: { TOGGLE_RESPONSE: "docked" }
        },
        docked: {
          on: {
            TOGGLE_RESPONSE: "closed",
            "layout.SWITCH_COMPACT": "floating" // State transition on layout change
          }
        },
        floating: {
          on: {
            TOGGLE_RESPONSE: "closed",
            "layout.SWITCH_NORMAL": "docked"
          }
        }
      }
    },
    // Layout state
    layout: {
      initial: "normal",
      states: {
        normal: {
          on: { SET_LAYOUT: { target: "compact", guard: ({ event }) => event.layout === "compact" } },
          entry: "broadcastLayoutChange" // Notify sibling states
        },
        compact: {
          on: { SET_LAYOUT: { target: "normal", guard: ({ event }) => event.layout === "normal" } },
          entry: "broadcastLayoutChange"
        }
      }
    }
  }
});
```

**Benefits**:
- ✅ **Explicit states**: `sidebar.open` vs `sidebar.closed` is self-documenting
- ✅ **No invalid states**: Can't have `isSidebarOpen: true` and `isSidebarOpen: false`
- ✅ **Parallel states**: Sidebar, response, and layout are orthogonal
- ✅ **State guards**: Layout change can trigger response panel transitions
- ✅ **Visualizable**: Can generate state charts from machine definition

## Implementation Plan

### Phase 1: Extract UI Panel Actor (Week 1)

**Goal**: Remove boolean flags, create state-driven UI actor

1. **RED**: Write tests for UIPanelMachine
   - Test sidebar state transitions
   - Test response panel state transitions
   - Test layout state transitions
   - Test state guards (compact layout forces response to floating)

2. **GREEN**: Implement UIPanelMachine
   - Create `src/ui/machines/ui-panel.machine.ts`
   - Define parallel states for sidebar, response, layout
   - Use Effect service `deriveUIState` in actions

3. **BLUE**: Integrate with parent machine
   - Spawn UIPanelMachine in postee.machine.ts
   - Replace `uiFlags` with actor reference
   - Update PosteeWorkspace.tsx to read from UI actor

**Success Criteria**:
- No booleans in context (only states)
- All tests passing
- UI behavior unchanged

### Phase 2: Extract Runner Actor (Week 2)

**Goal**: Separate request execution into its own actor

1. **RED**: Write tests for RunnerMachine
   - Test idle → preparing → executing → success flow
   - Test idle → preparing → executing → error flow
   - Test cancellation at each stage

2. **GREEN**: Implement RunnerMachine
   - Create `src/ui/machines/runner.machine.ts`
   - States: idle, preparing, executing, success, error
   - Use Effect services (prepareRequest, HttpClient)

3. **BLUE**: Integrate with parent machine
   - Invoke RunnerMachine on RUN_REQUEST event
   - Parent listens to runner's done/error events
   - Update PosteeWorkspace.tsx to read from runner actor

**Success Criteria**:
- Runner is fully isolated actor
- Can run multiple requests concurrently (spawn multiple runner actors)
- All tests passing

### Phase 3: Extract Collections Actor (Week 3)

**Goal**: Separate collections management

1. **RED**: Write tests for CollectionsMachine
2. **GREEN**: Implement CollectionsMachine
3. **BLUE**: Spawn in parent machine

### Phase 4: Extract Requests Actor (Week 4)

**Goal**: Separate request CRUD

1. **RED**: Write tests for RequestsMachine
2. **GREEN**: Implement RequestsMachine
3. **BLUE**: Spawn in parent machine

### Phase 5: Extract Environments Actor (Week 5)

**Goal**: Separate environment management

1. **RED**: Write tests for EnvironmentsMachine
2. **GREEN**: Implement EnvironmentsMachine
3. **BLUE**: Spawn in parent machine

### Phase 6: Parent Machine Simplification (Week 6)

**Goal**: Reduce parent to pure orchestrator

- Remove all domain logic from parent
- Parent only spawns actors and coordinates communication
- Target: < 200 lines for parent machine

## Testing Strategy

**MANDATORY**: Follow Red-Green-Blue (TDD) workflow for all actors.

### Test Planning

For each actor machine:

1. **State Transition Tests**: Verify all transitions work correctly
2. **Guard Tests**: Verify conditional transitions
3. **Action Tests**: Verify actions update context correctly
4. **Integration Tests**: Verify parent-child communication
5. **Effect Integration Tests**: Verify Effect services are called correctly

### Red-Green-Blue Workflow

#### 🔴 RED: Write Failing Test

```typescript
// test/ui/machines/ui-panel.machine.test.ts
import { describe, it, expect } from "vitest";
import { createActor } from "xstate";
import { uiPanelMachine } from "@/ui/machines/ui-panel.machine";

describe("UIPanelMachine", () => {
  it("should transition sidebar from open to closed on TOGGLE_SIDEBAR", () => {
    // Arrange
    const actor = createActor(uiPanelMachine);
    actor.start();

    // Assert initial state
    expect(actor.getSnapshot().matches({ sidebar: "open" })).toBe(true);

    // Act: Toggle sidebar
    actor.send({ type: "TOGGLE_SIDEBAR" });

    // Assert: Sidebar closed
    expect(actor.getSnapshot().matches({ sidebar: "closed" })).toBe(true);
  });
});
```

Run: `bun test` → Should see RED (machine doesn't exist yet)

#### 🟢 GREEN: Minimal Implementation

```typescript
// src/ui/machines/ui-panel.machine.ts
import { setup } from "xstate";

export const uiPanelMachine = setup({
  types: {} as {
    events: { type: "TOGGLE_SIDEBAR" };
  },
}).createMachine({
  id: "uiPanel",
  type: "parallel",
  states: {
    sidebar: {
      initial: "open",
      states: {
        open: {
          on: { TOGGLE_SIDEBAR: "closed" }
        },
        closed: {
          on: { TOGGLE_SIDEBAR: "open" }
        }
      }
    }
  }
});
```

Run: `bun test` → Should see GREEN

#### 🔵 BLUE: Refactor

- Add comprehensive JSDoc comments
- Extract guard functions
- Add Effect service integration
- Optimize state structure

Run: `bun test` → Should stay GREEN

### Test Coverage Goals

- **Actor Machines**: 100% state coverage (all states reachable)
- **Effect Services**: Already covered by Phase 1 tests
- **Integration**: Parent-child communication fully tested

## Consequences

### Positive

✅ **State-driven design**: No more boolean blindness, explicit states
✅ **Separation of concerns**: Each actor has a single responsibility
✅ **Testability**: Small actors are easy to test in isolation
✅ **Maintainability**: < 200 lines per actor, easy to reason about
✅ **Concurrency**: Can spawn multiple runner actors for parallel requests
✅ **Visualization**: Can generate state charts for each actor
✅ **Type safety**: XState 5 provides full TypeScript support for actor refs

### Negative

⚠️ **Learning curve**: Team needs to understand actor model
⚠️ **More files**: 6 actor files instead of 1 monolithic machine
⚠️ **Communication overhead**: Parent-child event passing adds complexity
⚠️ **Initial migration effort**: 6 weeks to fully refactor

### Neutral

🔄 **Effect services unchanged**: Functional Core remains pure
🔄 **Component API unchanged**: PosteeWorkspace.tsx still uses `useMachine`
🔄 **Test count increases**: More actors = more tests (but easier to write)

## Alternatives Considered

### Alternative 1: Keep Monolithic Machine

**Rejected**: Machine is already too large (1040 lines), will only grow worse.

### Alternative 2: Split into Separate Top-Level Machines

**Rejected**: Machines wouldn't share state or coordinate. Actor model provides better orchestration.

### Alternative 3: Use Redux/Zustand Instead

**Rejected**:
- Loses state machine benefits (explicit states, state charts)
- Harder to model complex workflows
- No built-in actor model for concurrency

## Success Metrics

| Metric | Before | After | Status |
|--------|--------|-------|--------|
| Parent machine lines | 1040 | < 200 | 🎯 Target |
| Boolean flags in context | 4 | 0 | 🎯 Target |
| Number of actors | 1 | 6 | 🎯 Target |
| Test files | 1 | 7 (parent + 6 actors) | 🎯 Target |
| Testability (1-10) | 3 | 9 | 🎯 Target |

## References

- [XState 5 Actor Model](https://stately.ai/docs/actors)
- [Spawning Actors in XState 5](https://stately.ai/docs/spawn)
- [State-Driven Interfaces with XState](https://dev.to/bnevilleoneill/state-driven-interfaces-with-xstate-ah5)
- [XState: The Redux Alternative](https://medium.com/@melekcharradi/xstate-the-redux-alternative-for-complex-application-logic-9747262861d1)
- [State machines and Actors in XState v5](https://www.sandromaglione.com/articles/state-machines-and-actors-in-xstate-v5)

## Notes

- This ADR supersedes parts of ADR-001 (Phase 3 Component Split will be easier after actor refactor)
- Each actor should follow Functional Core, Imperative Shell pattern
- Parent machine is the Imperative Shell that orchestrates actor lifecycle
- Actors use Effect services (Functional Core) for business logic
