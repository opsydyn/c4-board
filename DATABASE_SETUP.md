# Database CRUD Setup

Complete SQLite CRUD setup following **Functional Core, Imperative Shell** pattern with Effect-TS + Tauri.

## Architecture Overview

```
User Action (React)
  → XState Machine (orchestration - WHEN)
  → Effect Service (pure logic - WHAT)
  → DatabaseService Runtime (I/O - HOW)
  → Tauri SQL Plugin
  → SQLite Database
```

## Files Created

### 1. Database Schema
**[src-tauri/migrations/001_initial.sql](src-tauri/migrations/001_initial.sql)**
- Tables: `diagrams`, `nodes`, `edges`
- Foreign keys with CASCADE deletes
- Indexes for performance
- Constraints for data integrity

### 2. Effect Service Layer (Functional Core)
**[src/core/effects/database.ts](src/core/effects/database.ts)**
- Pure functions returning `Effect<Database, Error, Result>`
- **Zero side effects** - all I/O happens at boundaries
- Type-safe operations for:
  - Diagrams: create, get, list, update, delete
  - Nodes: create, get by diagram, update, delete
  - Edges: create, get by diagram, delete

### 3. Runtime Implementation (Imperative Shell)
**[src/core/effects/database.runtime.ts](src/core/effects/database.runtime.ts)**
- Provides actual database connection via Tauri SQL plugin
- Implements DatabaseService tag
- Handles connection pooling
- Database file: `sqlite:c4board.db`

### 4. React Hook
**[src/core/effects/useDatabase.ts](src/core/effects/useDatabase.ts)**
- `useDatabase()` hook for running effects in React
- Automatically provides DatabaseService runtime
- Promise-based API for async operations

### 5. Test Component
**[src/components/DatabaseTest.tsx](src/components/DatabaseTest.tsx)**
**[src/pages/db-test.astro](src/pages/db-test.astro)**
- Demonstrates all CRUD operations
- Test page: `/db-test`

## Usage Examples

### Creating a Diagram
```typescript
import { useDatabase } from "@/core/effects/useDatabase";
import { createDiagram } from "@/core/effects/database";

function MyComponent() {
  const { runEffect } = useDatabase();

  const handleCreate = async () => {
    const diagram = await runEffect(
      createDiagram({
        id: "my-diagram",
        name: "My C4 Diagram",
        description: "Architecture overview"
      })
    );
    console.log("Created:", diagram);
  };

  return <button onClick={handleCreate}>Create</button>;
}
```

### Adding Nodes
```typescript
import { createNode } from "@/core/effects/database";

const handleAddNode = async () => {
  const node = await runEffect(
    createNode({
      id: `node-${Date.now()}`,
      diagram_id: "my-diagram",
      type: "person",
      label: "User",
      technology: "Human",
      description: "End user of the system",
      position_x: 100,
      position_y: 100
    })
  );
};
```

### Loading Data
```typescript
import { listDiagrams, getNodesByDiagram } from "@/core/effects/database";

// Get all diagrams
const diagrams = await runEffect(listDiagrams());

// Get nodes for a specific diagram
const nodes = await runEffect(getNodesByDiagram("my-diagram"));
```

### Error Handling
```typescript
import { Effect } from "effect";
import { DatabaseError, NotFoundError } from "@/core/effects/database";

const result = await runEffect(
  getDiagram("non-existent").pipe(
    Effect.catchTags({
      NotFoundError: (error) => Effect.succeed(null),
      DatabaseError: (error) => {
        console.error("DB Error:", error.message);
        return Effect.fail(error);
      }
    })
  )
);
```

## Integration with XState

```typescript
import { fromPromise } from "xstate";
import { createNode } from "@/core/effects/database";

const canvasMachine = setup({
  actors: {
    createNodeInDB: fromPromise(async ({ input }) => {
      return runEffect(createNode(input));
    })
  }
}).createMachine({
  invoke: {
    src: "createNodeInDB",
    input: ({ event }) => ({
      id: event.nodeId,
      diagram_id: context.diagramId,
      // ... other fields
    }),
    onDone: {
      actions: assign({
        nodes: ({ event }) => [...context.nodes, event.output]
      })
    }
  }
});
```

## Database Location

- **Development**: `~/.local/share/c4-board/c4board.db` (Linux/macOS)
- **Production**: Platform-specific app data directory

## Next Steps

1. **Persist Canvas State**: Wire XState machine to save/load from DB
2. **Auto-save**: Debounce node position changes to DB
3. **Undo/Redo**: Store operation history in DB
4. **Export/Import**: JSON export of diagrams
5. **Multi-diagram Support**: Diagram switcher UI

## Testing

Visit `/db-test` in your Tauri app to test CRUD operations:
1. Click "Create Diagram" to create a test diagram
2. Click "Load Diagrams" to see all diagrams
3. Click "Add Node" on a diagram to create nodes
4. Check that data persists across app restarts

## Dependencies

- ✅ `tauri-plugin-sql` (Rust) - already in [Cargo.toml](src-tauri/Cargo.toml:22)
- ✅ `@tauri-apps/plugin-sql` (JS) - already in [package.json](package.json)
- ✅ SQL plugin configured in [lib.rs](src-tauri/src/lib.rs:10)

## Pure Functional Principles

This setup maintains **Functional Core, Imperative Shell**:

- **Functional Core** (`database.ts`):
  - Pure Effect functions
  - No direct I/O
  - 100% testable without mocking
  - Business logic isolated

- **Imperative Shell** (`database.runtime.ts`, React hooks):
  - Actual database operations
  - Side effects at boundaries
  - Provides runtime dependencies
  - Orchestration only

All database operations are composable Effect values that describe WHAT to do, not HOW to do it.
