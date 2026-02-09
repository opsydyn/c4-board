# ADR-004: SQLite Pool Architecture — Bypassing tauri-plugin-sql for Runtime Queries

**Status**: Accepted
**Date**: 2026-02-07
**Deciders**: Alan
**Technical Story**: Fix persistent `SQLITE_BUSY (code 5)` and `cannot start a transaction within a transaction (code 1)` errors during auto-save

## Context

### Problem Statement

Auto-save operations intermittently fail with SQLite BUSY errors (`code: 5`) despite JavaScript-side write serialization. Investigation of the Tauri SQL plugin's Rust source (`tauri-plugin-sql v2.3.1`) revealed a fundamental architectural mismatch:

### Root Cause: Multi-Connection Pool with Per-Connection PRAGMAs

The plugin creates its database pool with:

```rust
// tauri-plugin-sql-2.3.1/src/wrapper.rs:91
Ok(Self::Sqlite(Pool::connect(conn_url).await?))
```

`Pool::connect()` creates a **multi-connection pool** (sqlx default: up to 10 connections). Each `db.execute()` from JavaScript is dispatched to an **arbitrary** pool connection via IPC. This causes two critical issues:

1. **`PRAGMA busy_timeout = 5000`** set from JS only applies to whichever connection handles that specific call. Other pool connections have **no** `busy_timeout`, causing SQLite to return BUSY immediately instead of waiting.

2. **`PRAGMA foreign_keys = ON`** similarly only applies to one connection — referential integrity is not guaranteed across all operations.

### Failed Approaches

| Approach | Why It Failed |
|----------|---------------|
| **Effect.Semaphore** (module-level) | Each `Effect.runPromise()` creates an isolated fiber runtime — a module-level semaphore cannot coordinate across them |
| **JS Promise chain mutex** (alone) | Serializes writes at JS level, but PRAGMAs still only apply to one pool connection |
| **One-time lazy PRAGMA init** | Relies on sqlx LIFO pool behavior, which isn't guaranteed under load |
| **Per-write PRAGMAs inside `withWritePermit`** | 4 extra `executeRaw` calls per write churn pool connections. `BEGIN IMMEDIATE` then hits a connection with a stale open transaction: `(code: 1) cannot start a transaction within a transaction` |

### The Plugin's Limitations

The `tauri_plugin_sql::Builder` does not expose:

- Pool configuration (`max_connections`, `connect_options`)
- Per-connection hooks (`after_connect`)
- `SqliteConnectOptions` (which supports `busy_timeout`, `journal_mode`, `foreign_keys` at the connection level)

The plugin's `DbInstances` state is public (`pub struct DbInstances(pub RwLock<HashMap<String, DbPool>>)`), but the pool inside cannot be reconfigured after creation.

## Decision

### Dual-Pool Architecture: Plugin for Migrations, Custom Pool for Runtime

Keep `tauri-plugin-sql` for its migration system. Create a separate, properly configured `SqlitePool` for all runtime queries via custom Tauri commands.

```
                    ┌──────────────────────────────────────────────┐
                    │                  Rust (lib.rs)               │
                    │                                              │
                    │  ┌──────────────┐   ┌─────────────────────┐ │
                    │  │ Plugin Pool  │   │   AppDb Pool        │ │
                    │  │ (migrations  │   │ (runtime queries)   │ │
                    │  │  only)       │   │                     │ │
                    │  │              │   │ max_connections: 1  │ │
                    │  │ Pool::       │   │ busy_timeout: 5s   │ │
                    │  │   connect()  │   │ journal_mode: WAL  │ │
                    │  │ (multi-conn) │   │ foreign_keys: true │ │
                    │  └──────────────┘   └─────────────────────┘ │
                    │        │                     │               │
                    │   Migrations            sql_execute          │
                    │   (startup)             sql_query            │
                    └──────────────────────────────────────────────┘
                                               ▲
                                               │ invoke()
                    ┌──────────────────────────────────────────────┐
                    │           TypeScript (Effect-TS)             │
                    │                                              │
                    │  database.runtime.ts                         │
                    │  ├── executeRaw() → invoke("sql_execute")    │
                    │  ├── queryRaw()   → invoke("sql_query")      │
                    │  ├── withWritePermit() (JS Promise mutex)    │
                    │  └── retry schedule (8 attempts / 40ms exp)  │
                    └──────────────────────────────────────────────┘
```

### Implementation Details

#### Rust Side (`src-tauri/src/lib.rs`)

```rust
struct AppDb(SqlitePool);

// In setup callback:
let conn_opts = SqliteConnectOptions::new()
    .filename(&db_path)
    .create_if_missing(true)
    .busy_timeout(Duration::from_secs(5))
    .journal_mode(SqliteJournalMode::Wal)
    .synchronous(SqliteSynchronous::Normal)
    .foreign_keys(true);

let pool = SqlitePoolOptions::new()
    .max_connections(1)
    .connect_with(conn_opts);

app.manage(AppDb(pool));
```

Key configuration:

- **`max_connections(1)`**: Single connection eliminates pool contention. sqlx queues callers waiting for the connection.
- **`busy_timeout(5s)`**: Configured via `SqliteConnectOptions`, applies to **every** connection the pool creates (not via PRAGMA).
- **`journal_mode(WAL)`**: Write-Ahead Logging for better read concurrency.
- **`foreign_keys(true)`**: Enforced at connection level, not via fragile PRAGMA.

Two Tauri commands replicate the plugin's `execute`/`select` interface:

```rust
#[tauri::command]
async fn sql_execute(state: State<'_, AppDb>, sql: String, values: Vec<JsonValue>)
    -> Result<(u64, i64), String>

#[tauri::command]
async fn sql_query(state: State<'_, AppDb>, sql: String, values: Vec<JsonValue>)
    -> Result<Vec<IndexMap<String, JsonValue>>, String>
```

Value binding and row decoding match the plugin's strategy exactly (null/string/number dispatch, type-aware JSON conversion).

#### TypeScript Side (`src/core/effects/database.runtime.ts`)

```typescript
import { invoke } from "@tauri-apps/api/core";

const executeRaw = (sql: string, bindValues?: unknown[]) =>
    Effect.tryPromise({
        try: () => invoke("sql_execute", { sql, values: bindValues ?? [] }),
        catch: toError,
    }).pipe(Effect.retry({ while: isSqliteBusyError, schedule }));

const queryRaw = <T>(sql: string, bindValues?: unknown[]) =>
    Effect.tryPromise({
        try: () => invoke<T[]>("sql_query", { sql, values: bindValues ?? [] }),
        catch: toError,
    }).pipe(Effect.retry({ while: isSqliteBusyError, schedule }));
```

Changes from previous implementation:

- Removed `import Database from "@tauri-apps/plugin-sql"` entirely
- Removed ALL PRAGMA management (`ensurePragmas`, `walConfigured`, etc.)
- Removed `executeRawUnsafe`/`queryRawUnsafe` distinction
- Kept JS Promise chain mutex (`writeQueue`) for JS-level serialization
- Kept retry schedule (safety net, should rarely trigger now)

## Consequences

### Positive

- **Zero BUSY errors**: Single connection + configured busy_timeout = no contention
- **Correct foreign keys**: Configured at connection level, not fragile PRAGMA
- **Simpler JS runtime**: No PRAGMA management, no `Database` import, ~50 fewer lines
- **Clear separation**: Plugin = migrations, custom pool = runtime queries
- **Testable**: Service interface unchanged — all existing tests pass

### Negative

- **Two pools to same database**: Both the plugin and our pool connect to `c4board.db`. WAL mode allows this safely (multiple readers, one writer). The plugin's pool is only used during startup migrations.
- **Rust code duplication**: `bind_values` and `row_to_json` replicate the plugin's internal logic. If the plugin's encoding changes, we'd need to update. However, this is a stable API surface.
- **Binary size**: Adding `sqlx` directly (alongside the plugin's transitive dependency) is zero additional cost since it's already in the dependency tree.

### Neutral

- **Migration system unchanged**: `tauri_plugin_sql::Builder` still handles all schema migrations
- **`DatabaseService` interface unchanged**: No changes to `database.base.ts` or any consuming code
- **Test infrastructure unchanged**: Mock layers work identically

## Alternatives Considered

### Alternative 1: Fork tauri-plugin-sql to Expose Pool Configuration

Modify the plugin to accept `SqliteConnectOptions` or `SqlitePoolOptions`.

**Why Rejected**: Maintenance burden of a fork. The plugin is actively developed and we'd need to track upstream changes. Our dual-pool approach is non-invasive and doesn't modify third-party code.

### Alternative 2: SQLite Connection URL Parameters

Pass `?busy_timeout=5000` in the connection string: `sqlite:c4board.db?busy_timeout=5000`.

**Why Rejected**: The plugin's `path_mapper` function splits on `:` and treats the remainder as a filesystem path. Query parameters would become part of the filename literal (`c4board.db?busy_timeout=5000`).

### Alternative 3: Per-Write PRAGMA Application

Set `PRAGMA busy_timeout` inside `withWritePermit` before each write batch.

**Why Rejected**: Causes P1 regression. Extra `executeRaw` calls churn through pool connections, and `BEGIN IMMEDIATE` hits a connection with a stale open transaction from a previous failed PRAGMA call.

### Alternative 4: Single PRAGMA Init (LIFO Pool Assumption)

Set PRAGMAs once on first operation, relying on sqlx's LIFO connection reuse.

**Why Rejected**: LIFO behavior is an implementation detail, not a guarantee. Under load or after idle timeout, the pool may assign a different connection without `busy_timeout`.

## Architectural Recommendations

### Boundaries Between Effect Layer and Rust Layer

The Functional Core / Imperative Shell pattern mandates clear I/O boundaries. Here are the rules:

#### Rule 1: Rust Commands are Thin I/O Wrappers

Rust Tauri commands should contain **zero business logic**. They are the I/O boundary — they accept data, perform the side effect, and return results.

```rust
// GOOD: Thin wrapper, no logic
#[tauri::command]
async fn sql_execute(state: State<'_, AppDb>, sql: String, values: Vec<JsonValue>)
    -> Result<(u64, i64), String> {
    let query = bind_values(sqlx::query(&sql), values);
    let result = state.0.execute(query).await.map_err(|e| e.to_string())?;
    Ok((result.rows_affected(), result.last_insert_rowid()))
}

// BAD: Business logic in Rust command
#[tauri::command]
async fn save_diagram(state: State<'_, AppDb>, diagram: DiagramInput) -> Result<(), String> {
    // DON'T: validation, diffing, transaction orchestration in Rust
    // These belong in Effect services (TypeScript)
}
```

#### Rule 2: Effect Services Own Business Logic

All validation, transformation, orchestration, and domain rules live in `src/core/effects/`:

```typescript
// GOOD: Business logic in Effect service
export const saveDiagram = (input: SaveDiagramInput) =>
    Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* service.transaction(
            Effect.gen(function* () {
                // Diffing, upserts, deletes — all pure logic
            }),
        );
    });
```

#### Rule 3: XState Machines Orchestrate, Never Compute

Machines decide **when** to run effects, not **how**:

```typescript
// GOOD: Machine dispatches to Effect service
invoke: {
    src: fromPromise(({ input }) =>
        runEffect(saveDiagram(input))
    ),
}

// BAD: Business logic in machine action
actions: assign({
    nodes: ({ context }) => {
        // DON'T: filtering, sorting, validation here
    },
})
```

#### Rule 4: React Components are Pure Views

Components read state and send events. No `useEffect` for business logic:

```typescript
// GOOD: Pure view
function Toolbar({ send }) {
    return <button onClick={() => send({ type: "SAVE" })}>Save</button>;
}

// BAD: Business logic in component
function Toolbar() {
    useEffect(() => {
        // DON'T: database queries, transformations here
    }, []);
}
```

### Recommended Rust-Level Enhancements

#### 1. Pool Health Monitoring

Add a `sql_health` command for diagnostics:

```rust
#[tauri::command]
async fn sql_health(state: State<'_, AppDb>) -> Result<PoolHealth, String> {
    let pool = &state.0;
    Ok(PoolHealth {
        size: pool.size(),
        idle: pool.num_idle(),
        active: pool.size() - pool.num_idle() as u32,
    })
}
```

#### 2. Graceful Pool Shutdown

Close the pool on app exit to flush WAL:

```rust
// In setup, register a shutdown handler:
let pool_clone = pool.clone();
app.on_window_event(move |_window, event| {
    if let tauri::WindowEvent::Destroyed = event {
        tauri::async_runtime::block_on(pool_clone.close());
    }
});
```

#### 3. Consider Moving Transaction Management to Rust

Currently, `BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK` are sent as individual `invoke()` calls from TypeScript. With `max_connections(1)`, this works because the single connection maintains transaction state. However, if pool size ever increases, consider a Rust-side `sql_transaction` command that accepts a batch of statements:

```rust
#[tauri::command]
async fn sql_transaction(
    state: State<'_, AppDb>,
    statements: Vec<(String, Vec<JsonValue>)>,
) -> Result<Vec<(u64, i64)>, String> {
    let mut tx = state.0.begin().await.map_err(|e| e.to_string())?;
    let mut results = Vec::new();
    for (sql, values) in statements {
        let query = bind_values(sqlx::query(&sql), values);
        let result = tx.execute(query).await.map_err(|e| {
            // Transaction auto-rolls back on drop
            e.to_string()
        })?;
        results.push((result.rows_affected(), result.last_insert_rowid()));
    }
    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(results)
}
```

This would guarantee transaction atomicity regardless of pool configuration — but adds complexity to the Effect service layer. Only recommended if we move to `max_connections > 1`.

#### 4. Typed Query Builders (Future)

Instead of raw SQL strings crossing the IPC boundary, consider typed query builders in Rust:

```rust
#[tauri::command]
async fn upsert_node(state: State<'_, AppDb>, node: NodeInput) -> Result<(), String> {
    sqlx::query!(
        "INSERT INTO nodes (id, diagram_id, ...) VALUES (?, ?, ...)
         ON CONFLICT(id) DO UPDATE SET ...",
        node.id, node.diagram_id, ...
    )
    .execute(&state.0)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}
```

**Trade-off**: More Rust code but compile-time SQL validation. Only recommended if SQL complexity grows beyond what raw strings can safely express.

## References

- [sqlx SqliteConnectOptions docs](https://docs.rs/sqlx/latest/sqlx/sqlite/struct.SqliteConnectOptions.html)
- [SQLite WAL mode](https://www.sqlite.org/wal.html)
- [SQLite busy_timeout](https://www.sqlite.org/pragma.html#pragma_busy_timeout)
- [tauri-plugin-sql source (v2.3.1)](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/sql)
- [ADR-001: PosteeWorkspace Refactor](./001-postee-workspace-refactor.md) — Functional Core pattern
- [ADR-002: Postee Actor Model](./002-postee-actor-model-refactor.md) — XState patterns

---

## Notes

### Investigation Timeline

1. **Effect.Semaphore approach**: Failed — isolated fiber runtimes
2. **JS Promise chain mutex**: Worked for serialization, didn't fix PRAGMAs
3. **One-time lazy PRAGMA init**: Worked sometimes (LIFO pool), failed under load
4. **Per-write PRAGMAs in `withWritePermit`**: P1 regression (transaction within transaction)
5. **Custom Rust pool with `SqliteConnectOptions`**: Final solution, all issues resolved

### Key Insight

The Tauri SQL plugin is designed for general-purpose database access. Its multi-connection pool is appropriate for MySQL/PostgreSQL where concurrent connections are the norm. For SQLite (single-writer, file-based), a single-connection pool with explicit `busy_timeout` is the correct configuration. The plugin doesn't expose this because it abstracts over all three backends.
