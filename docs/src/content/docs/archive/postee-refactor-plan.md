---
title: "Postee Refactor Plan: Effect Branded Types + Pattern Matching + XState Modularization"
---

# Postee Refactor Plan: Effect Branded Types + Pattern Matching + XState Modularization

## Current Issues Analysis

### 1. **Primitive Obsession**
- IDs are plain `string` types (requestId, collectionId, environmentId)
- Body modes are string literals without type safety
- Method names are plain strings
- URLs are plain strings

**Problems:**
- Easy to mix up different ID types
- No compile-time guarantees about valid values
- String comparisons throughout codebase

### 2. **Cognitive Complexity**
- Multiple nested conditionals in `prepareRequest`
- Switch statements with complex branching
- Manual type narrowing with `as any` casts in XState actions
- Body mode handling scattered across multiple places

### 3. **Type Safety Issues**
- XState done events require `any` casts
- Event parameter handling is fragile
- RequestBodyMode type not enforced at boundaries

### 4. **State Machine Complexity**
- Monolithic machine with deeply nested states
- Actions mixed with state definitions
- Difficult to test individual substates
- Running state has complex invoke logic

---

## Proposed Solutions

### Phase 1: Branded Types (Effect Brand)

#### 1.1 ID Types
```typescript
import { Brand } from "effect";

// Domain-specific IDs with compile-time safety
export type RequestId = string & Brand.Brand<"RequestId">;
export const RequestId = Brand.nominal<RequestId>();

export type CollectionId = string & Brand.Brand<"CollectionId">;
export const CollectionId = Brand.nominal<CollectionId>();

export type EnvironmentId = string & Brand.Brand<"EnvironmentId">;
export const EnvironmentId = Brand.nominal<EnvironmentId>();

export type HistoryEntryId = string & Brand.Brand<"HistoryEntryId">;
export const HistoryEntryId = Brand.nominal<HistoryEntryId>();
```

**Benefits:**
- Cannot accidentally pass CollectionId where RequestId is expected
- Type errors at compile time
- Self-documenting code

#### 1.2 HTTP Method Type
```typescript
import { Schema } from "effect";

// Refined type for HTTP methods
export const HttpMethod = Schema.Literal(
  "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"
);
export type HttpMethod = Schema.Schema.Type<typeof HttpMethod>;
```

#### 1.3 URL Type (with validation)
```typescript
// Branded URL with runtime validation
export type Url = string & Brand.Brand<"Url">;
export const Url = Brand.refined<Url>(
  (s): s is string & Brand.Brand<"Url"> => {
    try {
      new URL(s);
      return true;
    } catch {
      // Relative URLs are okay for our use case
      return s.startsWith("/") || s.startsWith("http");
    }
  },
  (s) => Brand.error(`Invalid URL: ${s}`)
);
```

#### 1.4 Body Mode (Sum Type)
```typescript
import { Data } from "effect";

// Algebraic data type for body modes
export type RequestBody =
  | Data.TaggedEnum<{
      None: {};
      Raw: { content: string };
      Json: { content: string }; // validated JSON
      Form: { entries: ReadonlyArray<readonly [string, string]> };
    }>;

export const RequestBody = Data.taggedEnum<RequestBody>();
```

---

### Phase 2: Pattern Matching

#### 2.1 Replace Switch Statements in `prepareRequest`

**Before:**
```typescript
switch (params.bodyMode) {
  case "raw": {
    const content = resolveTemplate(params.rawBody ?? "", params.env);
    return { type: "raw", content } as const;
  }
  case "json": {
    // ... complex logic
  }
  // ...
}
```

**After:**
```typescript
import { Match } from "effect";

const body = yield* Match.value(params.body).pipe(
  Match.tag("None", () => Effect.succeed(PreparedBody.None)),
  Match.tag("Raw", ({ content }) =>
    Effect.succeed(PreparedBody.Raw({
      content: resolveTemplate(content, params.env)
    }))
  ),
  Match.tag("Json", ({ content }) =>
    Effect.gen(function* () {
      const resolved = resolveTemplate(content, params.env);
      if (resolved.trim().length === 0) {
        return PreparedBody.Json({ content: "" });
      }
      // Validate JSON
      yield* Effect.try({
        try: () => JSON.parse(resolved),
        catch: (cause) => HttpClientError({
          message: "Invalid JSON body",
          cause
        })
      });
      return PreparedBody.Json({ content: resolved });
    })
  ),
  Match.tag("Form", ({ entries }) =>
    Effect.succeed(PreparedBody.Form({
      entries: entries.map(([k, v]) => [
        resolveTemplate(k, params.env),
        resolveTemplate(v, params.env)
      ] as const)
    }))
  ),
  Match.exhaustive
);
```

**Benefits:**
- Exhaustiveness checking at compile time
- No missing cases
- Clearer intent
- Better error messages

#### 2.2 Replace Conditionals in XState Actions

**Before:**
```typescript
const doneEvent = event as any;
if (!doneEvent || doneEvent.type !== "xstate.done.actor.loadWorkspace") {
  return context;
}
```

**After:**
```typescript
import { Match, Option } from "effect";

return Match.value(event).pipe(
  Match.when(
    { type: "xstate.done.actor.loadWorkspace" },
    (evt) => ({
      ...context,
      collections: evt.output.collections,
      // ... rest of updates
    })
  ),
  Match.orElse(() => context)
);
```

#### 2.3 HTTP Response Handling

**Current:** Nested if/else in error handler
**Refactor:** Use pattern matching

```typescript
const handleFetchError = (cause: unknown, controller: AbortController) =>
  Match.value(cause).pipe(
    Match.when(
      (c): c is DOMException => c instanceof DOMException && c.name === "AbortError",
      () => Match.value(controller.signal.reason).pipe(
        Match.when("timeout", () =>
          HttpClientTimeoutError({
            message: "HTTP request timed out",
            elapsedMs: request.timeoutMs,
          })
        ),
        Match.when("cancelled", () =>
          HttpClientAbortedError({
            message: "HTTP request was cancelled",
          })
        ),
        Match.orElse(() =>
          HttpClientError({
            message: "Request aborted",
            cause,
          })
        )
      )
    ),
    Match.orElse(() =>
      HttpClientError({
        message: "Failed to perform HTTP request",
        cause,
      })
    )
  );
```

---

### Phase 3: XState Modularization

#### 3.1 Extract Runner Machine

The runner state logic should be its own invoked machine:

```typescript
// src/ui/machines/postee/runner.machine.ts
export const createRunnerMachine = () =>
  setup({
    types: {
      context: {} as {
        requestId: RequestId | null;
        response: PreparedResponse | null;
        error: string | null;
        startedAt: number | null;
      },
      input: {} as {
        requestId: RequestId;
        layer: WorkspaceLayer;
        context: PosteeContext;
      },
      output: {} as {
        response: PreparedResponse;
        prepared: PreparedRequest;
        historyEntry: PosteeHistoryEntry;
      },
    },
    actors: {
      executeRequest: fromPromise(/* ... */),
    },
  }).createMachine({
    id: "requestRunner",
    initial: "running",
    context: ({ input }) => ({
      requestId: input.requestId,
      response: null,
      error: null,
      startedAt: Date.now(),
    }),
    states: {
      running: {
        invoke: {
          src: "executeRequest",
          input: ({ context }) => ({ /* ... */ }),
          onDone: {
            target: "success",
            actions: assign({
              response: ({ event }) => event.output.response,
            }),
          },
          onError: {
            target: "error",
            actions: assign({
              error: ({ event }) =>
                event.error instanceof Error
                  ? event.error.message
                  : "Request failed",
            }),
          },
        },
      },
      success: {
        type: "final",
        output: ({ context, event }) => event.output,
      },
      error: {
        type: "final",
      },
    },
  });
```

#### 3.2 Simplified Parent Machine

```typescript
// Workspace machine invokes runner
states: {
  ready: {
    initial: "idle",
    states: {
      idle: {
        on: {
          RUN_REQUEST: {
            target: "running",
            guard: "hasActiveRequest",
          },
          // ... selection actions
        },
      },
      running: {
        invoke: {
          id: "runnerMachine",
          src: "runnerMachine",
          input: ({ context }) => ({
            requestId: context.activeRequestId!,
            layer: context.layer,
            context,
          }),
          onDone: {
            target: "idle",
            actions: ["updateRunnerSuccess", "addToHistory"],
          },
          onError: {
            target: "idle",
            actions: "updateRunnerError",
          },
        },
        on: {
          RUN_CANCEL: {
            actions: "abortInFlight",
          },
        },
      },
    },
  },
}
```

**Benefits:**
- Runner logic is isolated and testable
- Parent machine is simpler
- Clear separation of concerns
- Can test runner without workspace context

#### 3.3 Extract Collection Management

```typescript
// src/ui/machines/postee/collections.machine.ts
export const createCollectionsMachine = () =>
  setup({
    types: {
      context: {} as {
        collections: ReadonlyArray<PosteeCollection>;
        activeId: CollectionId | null;
      },
      events: {} as
        | { type: "SELECT"; id: CollectionId }
        | { type: "CREATE"; name: string; description?: string }
        | { type: "DELETE"; id: CollectionId }
        | { type: "REFRESH" },
    },
  }).createMachine({
    // Focused machine for collection operations
  });
```

---

### Phase 4: Implementation Order

#### Step 1: Create Branded Types Module
- [ ] Create `src/core/effects/postee/types.ts`
- [ ] Define all branded types
- [ ] Add helper functions for constructing branded values
- [ ] Export schema validators

#### Step 2: Refactor HTTP Client
- [ ] Update `PreparedRequest` to use branded types
- [ ] Replace body mode string union with sum type
- [ ] Add pattern matching for body preparation
- [ ] Add pattern matching for error handling
- [ ] Update tests

#### Step 3: Update Database Schemas
- [ ] Update Postee schemas to use branded types
- [ ] Add runtime validation with Effect Schema
- [ ] Update service layer types

#### Step 4: Extract Runner Machine
- [ ] Create `runner.machine.ts`
- [ ] Move execution logic
- [ ] Add tests for runner machine
- [ ] Update parent machine to invoke runner

#### Step 5: Refactor Main Machine
- [ ] Simplify action handlers using pattern matching
- [ ] Remove `as any` casts
- [ ] Update to use branded types
- [ ] Consider extracting more submachines

#### Step 6: Testing
- [ ] Unit tests for branded type constructors
- [ ] Tests for pattern matching logic
- [ ] Integration tests for machines
- [ ] Type checking passes

---

## Code Examples

### Branded Type Usage

```typescript
// ❌ Before: Easy to mix up IDs
function getRequest(id: string): Effect.Effect<PosteeRequest, DatabaseError> {
  // Could accidentally pass collectionId here
}

// ✅ After: Type-safe IDs
function getRequest(
  id: RequestId
): Effect.Effect<PosteeRequest, DatabaseError, DatabaseService> {
  // Compiler error if you pass CollectionId
}

// Creating branded values
const requestId = RequestId.make("req_123"); // Option<RequestId>
const collectionId = CollectionId.make("col_456"); // Option<CollectionId>

// Safe construction with validation
Effect.gen(function* () {
  const id = yield* RequestId.make("invalid").pipe(
    Effect.mapError(() => new Error("Invalid request ID"))
  );
  return yield* PosteeRequests.get(id);
});
```

### Pattern Matching Benefits

```typescript
// ❌ Before: Verbose and error-prone
function handleBodyMode(mode: string) {
  if (mode === "raw") {
    return { type: "raw" };
  } else if (mode === "json") {
    return { type: "json" };
  } else if (mode === "form") {
    return { type: "form" };
  } else {
    return { type: "none" }; // Forgot a case?
  }
}

// ✅ After: Exhaustive and clear
function handleBody(body: RequestBody) {
  return Match.value(body).pipe(
    Match.tag("Raw", (r) => PreparedBody.Raw(r)),
    Match.tag("Json", (j) => PreparedBody.Json(j)),
    Match.tag("Form", (f) => PreparedBody.Form(f)),
    Match.tag("None", () => PreparedBody.None),
    Match.exhaustive // Compiler error if we miss a case
  );
}
```

---

## Expected Outcomes

### Type Safety
- ✅ Compile-time errors for ID mismatches
- ✅ No `as any` casts needed
- ✅ Exhaustiveness checking for all variants

### Code Quality
- ✅ Lower cognitive complexity (< 10 per function)
- ✅ Clearer intent with pattern matching
- ✅ Self-documenting types

### Maintainability
- ✅ Easier to add new body modes
- ✅ Easier to test individual machines
- ✅ Easier to reason about state transitions

### Performance
- ✅ No runtime overhead for branded types (zero-cost abstraction)
- ✅ Pattern matching compiles to efficient switch statements

---

## Migration Strategy

### Backward Compatibility
1. Keep old types alongside new branded types
2. Add adapter functions for conversion
3. Migrate incrementally, function by function
4. Remove old types once migration is complete

### Testing During Migration
- Run both old and new implementations in parallel
- Compare outputs
- Gradually increase confidence

### Rollback Plan
- Each phase is independently committable
- Can revert individual phases if issues arise
- Feature flags for new implementations

---

## Questions to Resolve

1. **Should we brand ALL strings or just IDs?**
   - Recommendation: Start with IDs, URLs, then expand

2. **How to handle existing database data?**
   - Use Schema.decode for runtime validation
   - Add migration for invalid data

3. **Testing strategy for branded types?**
   - Unit tests for constructors
   - Property-based tests for validation

4. **TypeScript stack overflow issue?**
   - Excluding machines from tsconfig is acceptable for now
   - XState v5 type inference is a known issue
   - Focus on ESLint and IDE type checking
