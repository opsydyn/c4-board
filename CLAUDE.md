# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Tauri v2 + Astro** desktop application template that combines:
- **Frontend**: Astro with SSG (Static Site Generation) using React
- **Backend**: Tauri v2 (Rust-based) for native desktop capabilities
- **Styling**: Vanilla Extract for type-safe CSS-in-JS

## Development Commands

**Package Manager**: This project uses **Bun** as the primary package manager. All commands should use `bun` instead of `npm` or `pnpm`.

### Running the Application
```bash
# Development mode (starts both Astro dev server and Tauri)
bun run tauri dev

# The dev server runs on http://localhost:4321/
# Tauri automatically loads this URL via tauri.conf.json
```

### Building
```bash
# Build for production (runs type checking, Astro build, then Tauri build)
bun run tauri build

# Frontend-only build with type checking
bun run build

# Type checking only
bun run astro check
```

### Linting
```bash
# Run ESLint
bunx eslint .

# ESLint is configured in eslint.config.ts with:
# - TypeScript support
# - React plugin
# - Vanilla Extract specific linting for *.css.ts files
```

### Astro Commands
```bash
# Preview production build
bun run preview

# Run Astro CLI directly
bun run astro [command]
```

### Testing
```bash
# Run tests once (CI mode)
bun test:run

# Run tests in watch mode (development)
bun test:watch
# or
bun test

# Run tests with UI
bun test:ui

# Run tests with coverage report
bun test:coverage

# Run specific test file
bunx vitest run src/ui/machines/canvas.machine.test.ts
```

**Test Philosophy:**
- Tests focus on the **Functional Core** (Effect services)
- XState machines are tested via integration tests
- 100% type-safe tests using TypeScript
- Use Vitest for fast, modern testing

## Development Workflow: Red-Green-Blue (TDD)

**MANDATORY**: All new features and changes MUST follow the Red-Green-Blue cycle.

This is Test-Driven Development (TDD) with an architectural twist:

### The Three-Phase Cycle

#### 🔴 **RED: Write a Failing Test**

Write a test for the next small piece of functionality. The test should fail because the feature doesn't exist yet.

```typescript
// test/core/effects/postee/status-derivation.test.ts
describe("deriveRequestStatuses", () => {
  it("should mark request as error when response status >= 400", async () => {
    const history: PosteeHistoryEntry[] = [{
      id: "hist-1",
      request_id: "req-1",
      response_status: 404,
      error_message: null,
      executed_at: Date.now()
    }];

    // This will FAIL because deriveRequestStatuses doesn't exist yet
    const result = await Effect.runPromise(deriveRequestStatuses(history));
    expect(result.get("req-1")).toBe("error");
  });
});
```

**Run the test**: `bun test` → Should see RED (failing test)

#### 🟢 **GREEN: Make it Pass (Minimal Implementation)**

Write the simplest code that makes the test pass. Don't worry about perfection yet.

```typescript
// src/core/effects/postee/status-derivation.ts
export const deriveRequestStatuses = (
  history: PosteeHistoryEntry[]
): Effect<Map<string, RequestStatus>, never> =>
  Effect.sync(() => {
    const map = new Map<string, RequestStatus>();
    for (const entry of history) {
      if (!entry.request_id) continue;

      // Simple logic to make test pass
      const status: RequestStatus =
        entry.response_status && entry.response_status >= 400
          ? "error"
          : "success";

      map.set(entry.request_id, status);
    }
    return map;
  });
```

**Run the test**: `bun test` → Should see GREEN (passing test)

#### 🔵 **BLUE: Refactor (Improve Design)**

Now that the test is passing, refactor the code to follow our architectural principles:

- Apply **Functional Core, Imperative Shell** pattern
- Extract pure functions
- Improve type safety
- Add documentation
- Optimize performance (if needed)

```typescript
// src/core/effects/postee/status-derivation.ts
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
    const latestStatuses = new Map<string, { status: RequestStatus; executedAt: number }>();

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
      Array.from(latestStatuses.entries()).map(([id, { status }]) => [id, status])
    );
  });
```

**Run the test again**: `bun test` → Should still be GREEN

**Run all tests**: `bun test` → Ensure refactoring didn't break anything

### Critical Rules

1. **Never skip BLUE**: Skipping refactoring accumulates technical debt
2. **Small steps**: Each RED-GREEN-BLUE cycle should take 5-15 minutes
3. **Test first, always**: No production code without a failing test first
4. **Commit at GREEN**: Each passing test is a valid checkpoint
5. **Refactor fearlessly**: Tests give you confidence to improve design

### Workflow Integration

#### For New Features

1. **Plan**: List all test cases upfront (add to todo list)
2. **Pick one test**: Start with the simplest or most foundational
3. **RED-GREEN-BLUE**: Complete the cycle
4. **Repeat**: Move to next test case

#### For Bug Fixes

1. **RED**: Write a test that reproduces the bug (should fail)
2. **GREEN**: Fix the bug (test passes)
3. **BLUE**: Refactor to prevent similar bugs

#### For Refactoring

1. **Ensure GREEN**: All tests pass before refactoring
2. **BLUE**: Make architectural improvements
3. **Stay GREEN**: Tests should still pass after each change

### Examples from This Codebase

**Good**: [layout.ts](src/core/effects/layout.ts) was built with TDD:

- Pure function with clear inputs/outputs
- Easy to test without mocking
- Refactored to optimal design

**Needs Work**: [PosteeWorkspace.tsx](src/ui/components/postee/PosteeWorkspace.tsx):

- Logic in React hooks (hard to test)
- No tests written first
- Refactor needed (see [ADR-001](docs/adr/001-postee-workspace-refactor.md))

### Benefits

1. **Self-Testing Code**: Every feature has a test
2. **Interface-First Design**: Tests force you to think about API before implementation
3. **Refactoring Safety**: Tests catch regressions immediately
4. **Living Documentation**: Tests show how code should be used
5. **Architectural Alignment**: BLUE phase ensures Functional Core pattern

### References

- [Martin Fowler: Test-Driven Development](https://martinfowler.com/bliki/TestDrivenDevelopment.html)
- [Kent Beck: Test-Driven Development by Example](https://www.amazon.com/Test-Driven-Development-Kent-Beck/dp/0321146530)

## Architecture

### **Core Principle: Functional Core, Imperative Shell** ⭐

This codebase strictly follows the **Functional Core, Imperative Shell** pattern:

**Functional Core (Effect-TS):**
- All business logic lives in `src/core/effects/`
- Pure functions that return `Effect<Env, Error, Result>`
- **Contains ZERO side effects directly in code**: no `invoke()`, `fetch()`, `localStorage`, DOM access
- Includes: validation, transformation, serialization, business rules
- **100% testable** without mocking I/O

**Imperative Shell (XState + Tauri):**
- State machines in `src/ui/machines/` orchestrate **when** to run effects
- Tauri commands in `src-tauri/src/` provide **how** to do I/O
- React components are pure views of state
- Side effects only at the boundaries

**Example Flow:**
```
User Action (React)
  → XState Machine (orchestration)
  → Effect Service (pure logic)
  → Tauri Command (I/O)
  → Rust (native operation)
  → Effect resolves
  → Machine transitions
  → React re-renders
```

**When writing new code:**
- Business logic? → Create an Effect in `core/effects/`
- User flow? → Create an XState machine in `ui/machines/`
- Native I/O? → Create a Tauri command in `src-tauri/`
- UI? → Create a React component (reads state, sends events)

### Advanced Pattern Example: Auto-Layout

**Real implementation from this codebase** showing the pattern in action:

**Functional Core** ([src/core/effects/layout.ts](src/core/effects/layout.ts)):
```typescript
/**
 * Pure function - takes nodes/edges, returns new positions
 * NO side effects, NO ReactFlow APIs, NO DOM manipulation
 * 100% testable without mocking
 */
export function autoLayout(
  nodes: Node[],
  edges: Edge[],
  options: Partial<LayoutOptions> = {}
): Node[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Pure Dagre algorithm
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({
    rankdir: opts.direction,
    nodesep: opts.nodeSpacing,
    ranksep: opts.rankSpacing,
  });

  // Add nodes to graph (pure data transformation)
  topLevelNodes.forEach(node => {
    graph.setNode(node.id, {
      width: node.width,
      height: node.height
    });
  });

  // Add edges (pure data transformation)
  validEdges.forEach(edge => {
    graph.setEdge(edge.source, edge.target);
  });

  // Run layout algorithm (pure computation)
  dagre.layout(graph);

  // Return new node array with updated positions (immutable)
  return nodes.map(node => {
    const position = graph.node(node.id);
    return {
      ...node,
      position: opts.snapToGrid
        ? snapToGrid(position, opts.gridSize)
        : position
    };
  });
}
```

**Imperative Shell** ([src/ui/machines/canvas.machine.ts](src/ui/machines/canvas.machine.ts)):
```typescript
/**
 * XState machine action - orchestrates WHEN to run the effect
 * Calls the pure function and updates state
 */
actions: {
  applyLayout: assign({
    previousLayout: ({ context }) => context.nodes, // Save for undo
    currentLayout: ({ event }) => event.preset ?? "command",
    nodes: ({ context, event }) => {
      if (event.type !== "AUTO_LAYOUT") return context.nodes;

      // Get preset options
      const presetOptions = event.preset
        ? getPreset(event.preset)
        : {};
      const mergedOptions = { ...presetOptions, ...event.options };

      // Call pure function (functional core)
      return autoLayout(context.nodes, context.edges, mergedOptions);
    },
  }),
}
```

**React Component** ([src/ui/components/Toolbar.tsx](src/ui/components/Toolbar.tsx)):
```typescript
/**
 * Pure view - reads state, sends events
 * No business logic, just presentation
 */
function Toolbar({ send, currentLayout }) {
  return (
    <button
      onClick={() => send({
        type: "AUTO_LAYOUT",
        preset: "command"
      })}
    >
      Auto Layout
    </button>
  );
}
```

**Why this pattern works:**
- ✅ `autoLayout()` is **100% testable** without XState, React, or ReactFlow
- ✅ Machine **orchestrates when**, not how
- ✅ React **presents**, doesn't compute
- ✅ Can swap layout algorithms without touching UI
- ✅ Can test layout logic with simple unit tests:

```typescript
test('should layout nodes vertically', () => {
  const nodes = [/* test nodes */];
  const edges = [/* test edges */];

  const result = autoLayout(nodes, edges, { direction: "TB" });

  // Assert pure function results
  expect(result[0].position.y).toBeLessThan(result[1].position.y);
});
```

### Effect-TS Idioms and Anti-Patterns

**CRITICAL**: Always use idiomatic Effect-TS patterns. Avoid imperative anti-patterns.

#### ✅ DO: Use Option for Nullable Values

**Anti-pattern** (Boolean Blindness):
```typescript
// ❌ BAD: Boolean blindness - loses semantic information
const isValidURL = (url: string): boolean => {
  try {
    new URL(url);
    return true;  // What does true mean? Valid? Parsed? Success?
  } catch {
    return false; // What does false mean? Invalid? Error? Missing?
  }
};

// Usage requires re-parsing
if (isValidURL(input)) {
  const url = new URL(input); // Parsing twice!
}
```

**Idiomatic Effect-TS** (Option):
```typescript
// ✅ GOOD: Option preserves the parsed value
const parseURL = Option.liftThrowable((urlString: string) =>
  new URL(urlString.trim())
);

// Usage: Pattern match on Option
pipe(
  parseURL(input),
  Option.match({
    onNone: () => "Invalid URL",
    onSome: (url) => `Valid: ${url.hostname}` // Has the URL object!
  })
);

// Or use in Schema validation
Schema.filter((s) => Option.isSome(parseURL(s)), {
  message: () => "URL must be valid"
})
```

**Why Option is better:**

- ✅ **No boolean blindness**: `Some(URL)` vs `None` is self-documenting
- ✅ **No double parsing**: The parsed value is preserved in `Some`
- ✅ **Composable**: Can chain with `map`, `flatMap`, `filter`, etc.
- ✅ **Type-safe**: Compiler enforces handling both cases

#### ✅ DO: Use Data.TaggedEnum for Discriminated Unions

**Anti-pattern** (String Unions):
```typescript
// ❌ BAD: String literals lose type safety
type Status = "success" | "error" | "unknown";

const status: Status = "success";

// No structural typing, just string comparison
if (status === "success") { /* ... */ }
```

**Idiomatic Effect-TS** (Data.TaggedEnum):
```typescript
// ✅ GOOD: Tagged enum with payload support
export const RequestStatus = Data.taggedEnum<{
  Success: { readonly _: void };
  Error: { readonly message: string };
  Unknown: { readonly _: void };
}>();

// Type-safe construction
const status = RequestStatus.Error({ message: "Network timeout" });

// Pattern matching
pipe(
  status,
  RequestStatus.$match({
    Success: () => console.log("Success!"),
    Error: ({ message }) => console.error(message),
    Unknown: () => console.log("Unknown")
  })
);
```

#### ✅ DO: Use Effect.gen for Sequential Composition

**Anti-pattern** (Nested Promises):
```typescript
// ❌ BAD: Promise hell, hard to read
const process = async (input: string) => {
  const validated = await validate(input)
    .catch(e => { throw new Error("Validation failed") });

  const parsed = await parse(validated)
    .catch(e => { throw new Error("Parse failed") });

  return await save(parsed)
    .catch(e => { throw new Error("Save failed") });
};
```

**Idiomatic Effect-TS** (Effect.gen):
```typescript
// ✅ GOOD: Linear, readable, type-safe error channel
const process = (input: string): Effect.Effect<Result, ProcessError> =>
  Effect.gen(function* () {
    const validated = yield* validate(input);
    const parsed = yield* parse(validated);
    const saved = yield* save(parsed);
    return saved;
  });
```

#### ✅ DO: Use Schema for Runtime Validation

**Anti-pattern** (Manual Validation):
```typescript
// ❌ BAD: Manual checks, no type inference
const validateForm = (data: any): ValidatedForm => {
  if (!data.name || data.name.trim() === "") {
    throw new Error("Name required");
  }
  if (!data.url) {
    throw new Error("URL required");
  }
  // ... more manual checks
  return data as ValidatedForm; // Unsafe cast!
};
```

**Idiomatic Effect-TS** (Schema):
```typescript
// ✅ GOOD: Declarative validation with automatic type inference
const FormSchema = Schema.Struct({
  name: pipe(
    Schema.String,
    Schema.filter(s => s.trim().length > 0, {
      message: () => "Name cannot be empty"
    })
  ),
  url: pipe(
    Schema.String,
    Schema.filter(s => Option.isSome(parseURL(s)), {
      message: () => "URL must be valid"
    })
  )
});

// Type automatically inferred: { name: string, url: string }
type ValidatedForm = Schema.Schema.Type<typeof FormSchema>;
```

#### ✅ DO: Use Data.TaggedError for Type-Safe Errors

**Anti-pattern** (Throwing Errors):
```typescript
// ❌ BAD: Untyped errors, can't know what might be thrown
const fetchUser = async (id: string): Promise<User> => {
  if (!id) throw new Error("ID required");
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) throw new Error("Fetch failed");
  return response.json();
};
```

**Idiomatic Effect-TS** (TaggedError):

```typescript
// ✅ GOOD: Typed error channel, exhaustive handling
class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly field: string;
}> {}

class NetworkError extends Data.TaggedError("NetworkError")<{
  readonly status: number;
}> {}

const fetchUser = (id: string): Effect.Effect<User, ValidationError | NetworkError> =>
  Effect.gen(function* () {
    if (!id) {
      return yield* Effect.fail(new ValidationError({ field: "id" }));
    }
    // ... fetch logic with NetworkError on failure
  });
```

#### Summary of Idioms

| Anti-Pattern | Idiomatic Effect-TS | Why Better |
| ------------ | ------------------- | ---------- |
| `try/catch` returning `boolean` | `Option.liftThrowable` | Preserves parsed value, composable |
| String unions (`"success" \| "error"`) | `Data.taggedEnum` | Type-safe, supports payloads, pattern matching |
| `async/await` with nested `.catch()` | `Effect.gen` with `yield*` | Linear flow, typed error channel |
| Manual validation with `throw` | `Schema` with filters | Declarative, automatic type inference |
| Generic `Error` throws | `Data.TaggedError` | Type-safe error channel, exhaustive handling |
| Imperative loops with mutations | `Effect.forEach`, `Effect.filter` | Immutable, composable |

**Rule**: If you're writing `try/catch`, `throw`, or returning `boolean`, ask: "Can I use Option, Either, or Effect instead?"

### XState Idioms and Anti-Patterns

**CRITICAL**: Follow XState 5 best practices for state-driven design.

#### ❌ ANTI-PATTERN: Boolean Flags in Context

**Problem**: Using booleans in context to represent states

```typescript
// ❌ BAD: Boolean blindness in XState context
const machine = setup({
  types: {} as {
    context: {
      isSidebarOpen: boolean;
      isResponseOpen: boolean;
      isCompactLayout: boolean;
    };
  }
}).createMachine({
  context: {
    isSidebarOpen: true,
    isResponseOpen: false,
    isCompactLayout: false
  },
  on: {
    TOGGLE_SIDEBAR: {
      actions: assign({
        isSidebarOpen: ({ context }) => !context.isSidebarOpen
      })
    }
  }
});
```

**Why this is wrong:**

- ❌ **Boolean blindness**: `isSidebarOpen: true` loses semantic meaning (opening? open? closing?)
- ❌ **Not state-driven**: Flags don't leverage XState's core strength (explicit states)
- ❌ **Combinatorial explosion**: 3 booleans = 8 possible combinations, many invalid
- ❌ **Hard to visualize**: Can't generate meaningful state charts
- ❌ **No state guards**: Can't prevent invalid transitions

**XState principle**: "Use states to model states, context for data"

#### ✅ CORRECT: State-Driven Design with Parallel States

```typescript
// ✅ GOOD: Explicit states, no boolean flags
const machine = setup({
  types: {} as {
    context: {
      // Only data, no booleans representing states
      gridConfig: GridConfig;
    };
    events:
      | { type: "TOGGLE_SIDEBAR" }
      | { type: "TOGGLE_RESPONSE" }
      | { type: "SET_LAYOUT"; layout: "normal" | "compact" };
  }
}).createMachine({
  id: "ui",
  type: "parallel", // Multiple orthogonal concerns
  states: {
    // Sidebar state machine
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
    // Response panel state machine
    response: {
      initial: "closed",
      states: {
        closed: {
          on: { TOGGLE_RESPONSE: "docked" }
        },
        docked: {
          on: {
            TOGGLE_RESPONSE: "closed",
            // State guard: compact layout forces floating
            "layout.SWITCH_COMPACT": "floating"
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
    // Layout state machine
    layout: {
      initial: "normal",
      states: {
        normal: {
          on: {
            SET_LAYOUT: {
              target: "compact",
              guard: ({ event }) => event.layout === "compact"
            }
          },
          entry: "broadcastLayoutChange" // Notify sibling states
        },
        compact: {
          on: {
            SET_LAYOUT: {
              target: "normal",
              guard: ({ event }) => event.layout === "normal"
            }
          },
          entry: "broadcastLayoutChange"
        }
      }
    }
  }
});
```

**Why state-driven is better:**

- ✅ **Explicit states**: `sidebar.open` vs `sidebar.closed` is self-documenting
- ✅ **No invalid states**: Impossible to have contradictory boolean combinations
- ✅ **State guards**: Layout changes can force response panel transitions
- ✅ **Visualizable**: Can generate state charts from machine definition
- ✅ **Parallel states**: Sidebar, response, and layout are orthogonal concerns
- ✅ **Type-safe**: TypeScript knows exactly which states exist

#### ❌ ANTI-PATTERN: Monolithic Machines (> 500 Lines)

**Problem**: Single machine handling too many concerns

```typescript
// ❌ BAD: 1040-line machine handling everything
const workspaceMachine = setup({...}).createMachine({
  // Collections logic (200 lines)
  // Requests logic (200 lines)
  // Environments logic (200 lines)
  // Runner logic (200 lines)
  // UI logic (200 lines)
  // History logic (40 lines)
});
```

**Why this is wrong:**

- ❌ **Hard to test**: Too many concerns in one machine
- ❌ **Hard to reason about**: 1040 lines is too much cognitive load
- ❌ **Poor separation of concerns**: Everything coupled together
- ❌ **Can't scale**: Adding features makes it worse

#### ✅ CORRECT: Actor Model with Spawned Child Machines

```typescript
// ✅ GOOD: Parent orchestrates child actors (< 200 lines)
const workspaceMachine = setup({
  types: {} as {
    context: {
      uiActor: ActorRefFrom<typeof uiMachine>;
      collectionsActor: ActorRefFrom<typeof collectionsMachine>;
      runnerActor: ActorRefFrom<typeof runnerMachine> | null;
    };
  },
  actors: {
    uiMachine,
    collectionsMachine,
    runnerMachine
  }
}).createMachine({
  context: ({ spawn }) => ({
    // Spawn persistent child actors
    uiActor: spawn("uiMachine"),
    collectionsActor: spawn("collectionsMachine"),
    runnerActor: null // Invoked on-demand
  }),
  on: {
    RUN_REQUEST: {
      actions: assign({
        // Invoke runner actor dynamically
        runnerActor: ({ spawn, context }) => spawn("runnerMachine", {
          input: { requestId: context.activeRequestId }
        })
      })
    }
  }
});

// Each child machine: < 200 lines, single concern
const uiMachine = setup({...}).createMachine({ /* UI logic only */ });
const collectionsMachine = setup({...}).createMachine({ /* Collections only */ });
const runnerMachine = setup({...}).createMachine({ /* Request execution only */ });
```

**Why actor model is better:**

- ✅ **Separation of concerns**: Each actor has single responsibility
- ✅ **Testability**: Small actors (< 200 lines) easy to test in isolation
- ✅ **Maintainability**: Easy to reason about individual actors
- ✅ **Concurrency**: Can spawn multiple runner actors for parallel requests
- ✅ **Reusability**: Actors can be reused in different parent contexts

#### When to Use Spawned Actors vs Invoked Actors

**Spawned Actors** (`spawn` in context):

- Use for **dynamic** or **unknown** number of actors
- Actors are **persistent** across state transitions
- Example: Multiple request runners, collection items, environment tabs

**Invoked Actors** (`invoke` in state):

- Use for **finite/known** number of actors
- Actors are **tied to state lifecycle** (stopped when state exits)
- Example: Database initialization, HTTP request execution

#### Summary of XState Idioms

| Anti-Pattern | Idiomatic XState 5 | Why Better |
| ------------ | ------------------ | ---------- |
| Boolean flags in context (`isSidebarOpen`) | Explicit states (`sidebar.open`, `sidebar.closed`) | Self-documenting, no invalid states, visualizable |
| Monolithic machine (> 500 lines) | Actor model with spawned child machines | Separation of concerns, testability, maintainability |
| Nested if/else on event type | State-driven event handlers (`on: { EVENT: ... }`) | Events scoped to states, impossible to handle wrong event |
| Mutating context directly | `assign()` with immutable updates | Predictable state updates, time-travel debugging |

**Rule**: If your machine is > 500 lines or has boolean flags in context, refactor to the actor model with state-driven design.

**See**: [ADR-002: Postee Actor Model Refactor](docs/adr/002-postee-actor-model-refactor.md) for detailed migration plan.

### Frontend-Backend Communication

The application uses **Tauri Commands** for IPC (Inter-Process Communication):

1. **Rust Side** ([src-tauri/src/lib.rs](src-tauri/src/lib.rs)):
   - Define commands with `#[tauri::command]` macro
   - Register handlers in `tauri::Builder` using `invoke_handler!` macro
   - Example: `greet` command takes a string and returns a formatted greeting

2. **Frontend Side** ([src/components/Greet.tsx](src/components/Greet.tsx)):
   - Import `invoke` from `@tauri-apps/api/core`
   - Call commands: `await invoke("command_name", { param: value })`
   - Commands return Promises

### Component Framework Strategy

This template uses **React** exclusively for simplicity (KISS principle):

- **Astro Integration**: Configured in [astro.config.mts](astro.config.mts) with `@astrojs/react`
- **JSX Transform**: React 19's automatic JSX transform (no need to import React)
- **Component Hydration**: Use Astro's client directives (e.g., `client:visible`, `client:only="react"`) to control when components become interactive
- **State Management**: XState for UI flows, React hooks (`useState`, `useCallback`) for local component state

### Styling System

**Vanilla Extract with Contract-Based Theming**:

- **Type-Safe CSS**: Write styles in `*.css.ts` files with full TypeScript support
- **Theme Contract**: All themes implement a type-safe contract ([src/styles/theme.contract.css.ts](src/styles/theme.contract.css.ts))
- **CSS Layers**: Predictable cascade control with `@layer` ([src/styles/layers.css.ts](src/styles/layers.css.ts))
- **Semantic Tokens**: Design tokens named by purpose, not value
- **Pattern**: Import `theme` and use semantic tokens:
  ```typescript
  import { theme } from '@/styles/theme.css';

  const myStyle = style({
    "@layer": {
      [componentsLayer]: {
        color: theme.color.foreground.primary,
        backgroundColor: theme.color.background.surface,
        padding: theme.spacing["4"],
      },
    },
  });
  ```
- **Global Styles**: Imported in [src/layouts/Layout.astro](src/layouts/Layout.astro) via `global.css.ts`
- **ESLint Integration**: Special linting rules apply to `*.css.ts` files (see [eslint.config.ts](eslint.config.ts))
- **Full Documentation**: See [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) for complete design system documentation

### Project Structure

```
├── src/                      # Astro frontend source
│   ├── components/          # React components
│   ├── ui/                  # C4 canvas application
│   │   ├── components/      # Canvas UI components
│   │   ├── machines/        # XState machines
│   │   └── nodes/           # Custom ReactFlow nodes
│   ├── core/                # Functional core
│   │   ├── effects/         # Effect-TS services (coming)
│   │   └── schema/          # Zod schemas
│   ├── layouts/             # Astro layouts
│   ├── pages/               # Astro pages (routes)
│   └── styles/              # Vanilla Extract styles (*.css.ts)
├── src-tauri/               # Rust/Tauri backend
│   ├── src/
│   │   ├── lib.rs          # Main Tauri app logic & commands
│   │   └── main.rs         # Entry point
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Tauri configuration
└── public/                  # Static assets
```

## Key Configuration Files

- **[tauri.conf.json](src-tauri/tauri.conf.json)**: Defines dev server URL, build commands, window settings, and bundle configuration
- **[astro.config.mts](astro.config.mts)**: Astro configuration with React, Vanilla Extract, and optimization plugins
- **[Cargo.toml](src-tauri/Cargo.toml)**: Rust dependencies and release optimizations (LTO, size optimization)

## Dependencies of Note

- **State Management**: XState (`xstate`, `@xstate/react`) and Effect (`effect`, `@effect-atom/atom-react`)
- **Icons**: `@phosphor-icons/react`
- **Optimizations**: `@playform/compress` and `@playform/inline` for production builds
- **Flow Diagrams**: `@xyflow/react` and `dagre` for graph/flow visualizations

## Adding New Tauri Commands

1. Define the Rust function in [src-tauri/src/lib.rs](src-tauri/src/lib.rs) with `#[tauri::command]`
2. Add it to the `invoke_handler!` macro in the builder
3. Call from frontend using `invoke("command_name", { args })`

## Architecture Decision Records (ADRs)

**IMPORTANT**: All significant architectural decisions MUST be documented in an ADR.

### When to Create an ADR

Create an ADR when making decisions about:

- **Architectural patterns**: Changes to Functional Core, Imperative Shell, or component structure
- **State management**: XState machine design, Effect service patterns, context structure
- **Major refactors**: Component splits, service extractions, directory restructuring
- **Technology choices**: Adding/removing libraries, changing build tools
- **Cross-cutting concerns**: Testing strategy, error handling, logging patterns
- **Performance optimizations**: Caching strategies, lazy loading, derived state

### ADR Process

1. **Before coding**: Write a draft ADR with Status: "Proposed"
2. **Gather feedback**: Share with team for review
3. **Implement**: Build the solution according to the ADR
4. **Update**: Mark as Status: "Accepted" when complete
5. **Reference**: Link ADR in code comments and PR descriptions

### ADR Location

All ADRs live in [`docs/adr/`](docs/adr/) with:

- **Naming**: `NNN-title-in-kebab-case.md` (sequential numbering)
- **Index**: [`docs/adr/README.md`](docs/adr/README.md) contains the full index
- **Template**: See [`docs/adr/001-postee-workspace-refactor.md`](docs/adr/001-postee-workspace-refactor.md) for format

### ADR Sections

Each ADR includes:

- **Status**: Proposed | Accepted | Superseded | Deprecated
- **Date**: YYYY-MM-DD
- **Context**: Problem statement and background
- **Decision**: What is being changed and why
- **Consequences**: Positive, negative, and neutral outcomes
- **Alternatives Considered**: What was rejected and why

### Example ADRs

- [ADR-001: PosteeWorkspace Refactor](docs/adr/001-postee-workspace-refactor.md) - Migrating component to Functional Core pattern

**Rule**: If a change requires more than 3 files or touches architectural boundaries, write an ADR first.

## Testing

Vitest is configured as a dev dependency but no test files exist yet. To add tests:
```bash
# Run tests
npx vitest
```
