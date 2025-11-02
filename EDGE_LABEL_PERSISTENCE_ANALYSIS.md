# Edge Label Persistence - Database Analysis

## Answer: **YES, we need a new SQL UPDATE query**

## Current State

### ✅ Database Schema - Already Supports Labels
**File**: `src-tauri/migrations/001_initial.sql:34`
```sql
CREATE TABLE IF NOT EXISTS edges (
    id TEXT PRIMARY KEY,
    diagram_id TEXT NOT NULL,
    source TEXT NOT NULL,
    target TEXT NOT NULL,
    label TEXT,  -- ✅ Column exists!
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    ...
);
```

### ✅ Rust Types - Already Support Labels
**File**: `src-tauri/src/lib.rs`
```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Edge {
    pub id: String,
    pub diagram_id: String,
    pub source: String,
    pub target: String,
    pub label: Option<String>,  // ✅ Exists!
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateEdgeInput {
    pub id: String,
    pub diagram_id: String,
    pub source: String,
    pub target: String,
    pub label: Option<String>,  // ✅ Exists!
}
```

### ✅ CREATE Query - Already Includes Label
**File**: `src/core/effects/database.c4.ts:347`
```typescript
export const createEdge = (input: CreateEdgeInput) =>
  Effect.gen(function* () {
    const service = yield* DatabaseService;
    const now = Date.now();

    yield* service.execute(
      `INSERT INTO edges (id, diagram_id, source, target, label, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.diagram_id,
        input.source,
        input.target,
        input.label ?? null,  // ✅ Label is saved!
        now,
        now,
      ],
    );
    ...
  });
```

### ❌ UPDATE Query - **MISSING!**
**File**: `src/core/effects/database.c4.ts`

**What exists**:
- `createEdge()` - Line 341
- `getEdgesByDiagram()` - Line 371
- `deleteEdge()` - Line 381

**What's missing**:
- ❌ `updateEdge()` - **Doesn't exist!**
- ❌ `updateEdgeLabel()` - **Doesn't exist!**

## What We Need to Add

### Phase 1: Database Query (database.c4.ts)

Add this function after `deleteEdge()`:

```typescript
export interface UpdateEdgeInput {
  id: string;
  label?: string;
}

export const updateEdge = (input: UpdateEdgeInput) =>
  Effect.gen(function* () {
    const service = yield* DatabaseService;
    const now = Date.now();

    // Build dynamic UPDATE query based on provided fields
    const updates: string[] = [];
    const values: (string | null | number)[] = [];

    if (input.label !== undefined) {
      updates.push("label = ?");
      values.push(input.label ?? null);
    }

    // Always update updated_at
    updates.push("updated_at = ?");
    values.push(now);

    // Add id for WHERE clause
    values.push(input.id);

    yield* service.execute(
      `UPDATE edges SET ${updates.join(", ")} WHERE id = ?`,
      values,
    );

    // Return updated edge
    return yield* service.query<Edge>(
      `SELECT * FROM edges WHERE id = ?`,
      [input.id],
    ).pipe(
      Effect.flatMap((rows) =>
        rows.length > 0
          ? Effect.succeed(rows[0])
          : Effect.fail(new Error(`Edge ${input.id} not found after update`))
      ),
    );
  });
```

**Or simpler, label-only version**:

```typescript
export const updateEdgeLabel = (edgeId: string, label: string) =>
  Effect.gen(function* () {
    const service = yield* DatabaseService;
    const now = Date.now();

    yield* service.execute(
      `UPDATE edges SET label = ?, updated_at = ? WHERE id = ?`,
      [label, now, edgeId],
    );

    // Return updated edge
    return yield* service.query<Edge>(
      `SELECT * FROM edges WHERE id = ?`,
      [edgeId],
    ).pipe(
      Effect.flatMap((rows) =>
        rows.length > 0
          ? Effect.succeed(rows[0])
          : Effect.fail(new Error(`Edge ${edgeId} not found`))
      ),
    );
  });
```

### Phase 2: Export from canvas-persistence.ts

Add to `src/core/effects/canvas-persistence.ts`:

```typescript
export const updateEdgeLabelInDb = (edgeId: string, label: string) =>
  Effect.gen(function* () {
    yield* updateEdgeLabel(edgeId, label);
  });
```

## Updated Implementation Plan

### Phase 1: Database Layer (20 min)
**File**: `src/core/effects/database.c4.ts`
- Add `updateEdgeLabel()` function
- Add TypeScript interface if needed
- Test with simple query

### Phase 2: Functional Core (30 min)
**File**: `src/core/effects/edge-operations.ts`
- Add `updateEdgeLabel()` pure function (validates label)
- Returns updated edges array
- No database calls (pure)

### Phase 3: XState Machine (30 min)
**File**: `src/ui/machines/canvas.machine.ts`
- Add `UPDATE_EDGE_LABEL` event
- Add `updateEdgeLabel` action
- Call functional core + database

### Phase 4: UI Component (1 hour)
- Create `EdgeLabelEditor` component
- Integrate with C4Canvas

### Phase 5: Testing (30 min)
- Test UPDATE query works
- Test persistence across saves/loads

## Key Points

✅ **Schema supports it** - `label TEXT` column exists
✅ **Rust types support it** - `label: Option<String>` exists
✅ **CREATE already saves it** - Labels are persisted on creation
❌ **UPDATE doesn't exist** - Need to add `updateEdge()` or `updateEdgeLabel()`
✅ **Load already reads it** - `getEdgesByDiagram()` returns all columns including label

## Conclusion

**We need to add a new SQL UPDATE query**, but it's straightforward because:
1. The column already exists
2. The types already support it
3. CREATE already uses it
4. We just need UPDATE to modify it

**Estimated time to add database function**: ~20 minutes

---

Ready to implement! Start with Phase 1 (database layer) to add the `updateEdgeLabel()` function.
