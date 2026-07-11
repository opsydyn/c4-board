/**
 * Database Runtime (Imperative Shell)
 *
 * Provides the actual implementation of DatabaseService using custom Tauri
 * commands backed by a properly configured single-connection SQLite pool.
 *
 * Architecture notes:
 * - The Rust side (lib.rs) creates a SqlitePool with max_connections(1),
 *   busy_timeout(5s), WAL, and foreign_keys configured via SqliteConnectOptions.
 *   Every connection inherits these settings — no JS-side PRAGMA management needed.
 * - The tauri-plugin-sql is kept for migrations only; runtime queries bypass it
 *   via custom sql_execute/sql_query Tauri commands.
 * - Write serialization uses a module-level Effect semaphore (verified to work
 *   across separate Effect.runPromise calls). A defensive ROLLBACK before
 *   BEGIN IMMEDIATE guards against stale connection state from HMR reloads.
 * - Startup uses a latch gate. All queries/writes wait until settings defaults
 *   are bootstrapped, preventing early unsynced reads.
 */

import { invoke } from "@tauri-apps/api/core";
import { Data, Duration, Effect, FiberRef, Layer, Schedule } from "effect";
import { DatabaseError, DatabaseService } from "./database.base";
import {
  beginDatabaseRuntimeOperation,
  beginDatabaseRuntimeWriteRequest,
  completeDatabaseRuntimeOperationSuccess,
  completeDatabaseRuntimeWriteRequest,
  failDatabaseRuntimeOperation,
  markDatabaseRuntimeBootstrapFailure,
  markDatabaseRuntimeBootstrapped,
  markDatabaseRuntimeWriteRequestAcquired,
  recordDatabaseRuntimeRetry,
} from "./db-runtime-status";
import { APP_SETTING_KEYS, DEFAULT_APP_SETTINGS } from "./settings.types";
import { classifySqliteError, isRetryable } from "./sqlite-error-class";

const writeSemaphore = Effect.runSync(Effect.makeSemaphore(1));
const writeLockDepthRef = FiberRef.unsafeMake(0);
const settingsBootstrapLatch = Effect.runSync(Effect.makeLatch(false));
let settingsBootstrapStarted = false;
let settingsBootstrapError: DatabaseError | null = null;

const SQLITE_BUSY_MAX_ATTEMPTS = 8;
const SQLITE_BUSY_BASE_DELAY = Duration.millis(40);
const SQLITE_BUSY_RETRY_SCHEDULE = Schedule.intersect(
  Schedule.exponential(SQLITE_BUSY_BASE_DELAY),
  Schedule.recurs(SQLITE_BUSY_MAX_ATTEMPTS - 1),
).pipe(Schedule.jittered);

class DatabaseRuntimeError extends Data.TaggedError("DatabaseRuntimeError")<{
  readonly message: string;
  readonly cause: unknown;
}> {}

const toDatabaseRuntimeError = (cause: unknown): DatabaseRuntimeError =>
  new DatabaseRuntimeError({
    message: cause instanceof Error ? cause.message : String(cause),
    cause,
  });

// ============================================================================
// Raw database operations (via custom Tauri commands)
// ============================================================================

const executeRaw = (
  sql: string,
  bindValues?: unknown[],
): Effect.Effect<void, DatabaseRuntimeError> =>
  Effect.gen(function*() {
    const operationId = yield* Effect.sync(() => beginDatabaseRuntimeOperation("execute"));

    return yield* Effect.tryPromise({
      try: () => invoke("sql_execute", { sql, values: bindValues ?? [] }),
      catch: toDatabaseRuntimeError,
    }).pipe(
      Effect.tapError((error) =>
        Effect.sync(() => {
          const errorClass = classifySqliteError(error);
          if (isRetryable(errorClass)) {
            recordDatabaseRuntimeRetry(operationId, errorClass, error);
          }
        })
      ),
      Effect.retry({
        while: (error) => isRetryable(classifySqliteError(error)),
        schedule: SQLITE_BUSY_RETRY_SCHEDULE,
      }),
      Effect.tap(() =>
        Effect.sync(() => {
          completeDatabaseRuntimeOperationSuccess(operationId);
        })
      ),
      Effect.tapError((error) =>
        Effect.sync(() => {
          failDatabaseRuntimeOperation(
            operationId,
            classifySqliteError(error),
            error,
          );
        })
      ),
    );
  });

const queryRaw = <T>(
  sql: string,
  bindValues?: unknown[],
): Effect.Effect<T[], DatabaseRuntimeError> =>
  Effect.gen(function*() {
    const operationId = yield* Effect.sync(() => beginDatabaseRuntimeOperation("query"));

    return yield* Effect.tryPromise({
      try: () => invoke<T[]>("sql_query", { sql, values: bindValues ?? [] }),
      catch: toDatabaseRuntimeError,
    }).pipe(
      Effect.tapError((error) =>
        Effect.sync(() => {
          const errorClass = classifySqliteError(error);
          if (isRetryable(errorClass)) {
            recordDatabaseRuntimeRetry(operationId, errorClass, error);
          }
        })
      ),
      Effect.retry({
        while: (error) => isRetryable(classifySqliteError(error)),
        schedule: SQLITE_BUSY_RETRY_SCHEDULE,
      }),
      Effect.tap(() =>
        Effect.sync(() => {
          completeDatabaseRuntimeOperationSuccess(operationId);
        })
      ),
      Effect.tapError((error) =>
        Effect.sync(() => {
          failDatabaseRuntimeOperation(
            operationId,
            classifySqliteError(error),
            error,
          );
        })
      ),
    );
  });

// ============================================================================
// Write serialization (Semaphore)
// ============================================================================

const withWritePermit = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.gen(function*() {
    const lockDepth = yield* FiberRef.get(writeLockDepthRef);

    if (lockDepth > 0) {
      return yield* effect;
    }

    const requestId = yield* Effect.sync(beginDatabaseRuntimeWriteRequest);

    return yield* writeSemaphore.withPermits(1)(
      Effect.gen(function*() {
        yield* Effect.sync(() => markDatabaseRuntimeWriteRequestAcquired(requestId));
        return yield* Effect.locally(writeLockDepthRef, 1)(effect);
      }),
    ).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          completeDatabaseRuntimeWriteRequest(requestId);
        }),
      ),
    );
  }) as Effect.Effect<A, E, R>;

// ============================================================================
// Error wrapping helpers
// ============================================================================

const wrapExecuteError = (
  effect: Effect.Effect<void, DatabaseRuntimeError>,
): Effect.Effect<void, DatabaseError> =>
  effect.pipe(
    Effect.mapError(
      (error) => new DatabaseError({ message: "Execute failed", cause: error }),
    ),
  );

const wrapQueryError = <T>(
  effect: Effect.Effect<T[], DatabaseRuntimeError>,
): Effect.Effect<T[], DatabaseError> =>
  effect.pipe(
    Effect.mapError(
      (error) => new DatabaseError({ message: "Query failed", cause: error }),
    ),
  );

const toDatabaseError = (error: unknown): DatabaseError =>
  error instanceof DatabaseError
    ? error
    : new DatabaseError({ message: "Database operation failed", cause: error });

// ============================================================================
// Settings bootstrap gate (latch)
// ============================================================================

const UPSERT_BOOTSTRAP_SETTING_SQL = `
	INSERT INTO app_settings (key, value, updated_at)
	VALUES (?, ?, ?)
	ON CONFLICT(key) DO UPDATE SET
		value = excluded.value,
		updated_at = excluded.updated_at
`;

interface ExistingSettingRow {
  key: string;
}

const bootstrapDefaultSettings = (): Effect.Effect<void, DatabaseError> =>
  Effect.gen(function*() {
    const rows = yield* wrapQueryError(
      queryRaw<ExistingSettingRow>(`SELECT key FROM app_settings`),
    ).pipe(Effect.mapError(toDatabaseError));

    const existingKeys = new Set(rows.map((row) => row.key));
    const missingKeys = APP_SETTING_KEYS.filter((key) => !existingKeys.has(key));

    if (missingKeys.length === 0) {
      return;
    }

    const now = Date.now();
    yield* withWritePermit(
      Effect.gen(function*() {
        for (const key of missingKeys) {
          yield* wrapExecuteError(
            executeRaw(UPSERT_BOOTSTRAP_SETTING_SQL, [
              key,
              JSON.stringify(DEFAULT_APP_SETTINGS[key]),
              now,
            ]),
          );
        }
      }),
    ).pipe(Effect.mapError(toDatabaseError));
  });

const ensureSettingsBootstrapped = (): Effect.Effect<void, DatabaseError> =>
  Effect.gen(function*() {
    const shouldBootstrap = yield* Effect.sync(() => {
      if (settingsBootstrapStarted) {
        return false;
      }
      settingsBootstrapStarted = true;
      return true;
    });

    if (shouldBootstrap) {
      yield* Effect.uninterruptible(
        bootstrapDefaultSettings().pipe(
          Effect.catchAll((error) =>
            Effect.sync(() => {
              settingsBootstrapError = error;
            })
          ),
          Effect.ensuring(settingsBootstrapLatch.open),
        ),
      );
    } else {
      yield* settingsBootstrapLatch.await;
    }

    const bootstrapError = yield* Effect.sync(() => settingsBootstrapError);
    if (bootstrapError) {
      yield* Effect.sync(() => {
        markDatabaseRuntimeBootstrapFailure(bootstrapError);
      });
      return yield* Effect.fail(bootstrapError);
    }

    yield* Effect.sync(() => {
      markDatabaseRuntimeBootstrapped();
    });
  });

/**
 * Public boot gate for callers that want to explicitly wait for DB/settings readiness.
 */
export const ensureDatabaseRuntimeReady = (): Effect.Effect<void, DatabaseError> => ensureSettingsBootstrapped();

// ============================================================================
// Public service operations
// ============================================================================

/**
 * Execute a SQL query that returns results.
 */
const query = <T>(
  sql: string,
  bindValues?: unknown[],
): Effect.Effect<T[], DatabaseError> =>
  ensureSettingsBootstrapped().pipe(
    Effect.flatMap(() => wrapQueryError(queryRaw<T>(sql, bindValues))),
    Effect.mapError(toDatabaseError),
  );

/**
 * Execute a SQL command that doesn't return results.
 */
const execute = (
  sql: string,
  bindValues?: unknown[],
): Effect.Effect<void, DatabaseError> =>
  ensureSettingsBootstrapped().pipe(
    Effect.flatMap(() => withWritePermit(wrapExecuteError(executeRaw(sql, bindValues)))),
    Effect.mapError(toDatabaseError),
  );

/**
 * Execute an effect in a SQL transaction.
 * Uses BEGIN IMMEDIATE to acquire a write lock upfront,
 * avoiding lock escalation churn under frequent saves.
 */
const transaction = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E | DatabaseError, R> =>
  ensureSettingsBootstrapped().pipe(
    Effect.flatMap(() =>
      withWritePermit(
        Effect.uninterruptibleMask((restore) =>
          Effect.gen(function*() {
            // Defensive ROLLBACK: clear any stale transaction left on the
            // connection (e.g. after a Vite HMR reload that recreated the
            // semaphore while a transaction was in-flight).
            yield* Effect.catchAll(
              executeRaw("ROLLBACK"),
              () => Effect.succeed(undefined),
            );

            yield* wrapExecuteError(executeRaw("BEGIN IMMEDIATE"));

            const operationExit = yield* Effect.exit(restore(effect));

            if (operationExit._tag === "Success") {
              const commitExit = yield* Effect.exit(
                wrapExecuteError(executeRaw("COMMIT")),
              );

              if (commitExit._tag === "Success") {
                return operationExit.value;
              }

              yield* Effect.catchAll(
                wrapExecuteError(executeRaw("ROLLBACK")),
                () => Effect.succeed(undefined),
              );

              return yield* Effect.failCause(commitExit.cause);
            }

            yield* Effect.catchAll(
              wrapExecuteError(executeRaw("ROLLBACK")),
              () => Effect.succeed(undefined),
            );

            return yield* Effect.failCause(operationExit.cause);
          })
        ),
      )
    ),
    Effect.mapError(toDatabaseError),
  );

/**
 * Live DatabaseService Layer
 * Provides the actual implementation for the DatabaseService tag
 */
export const DatabaseServiceLive = Layer.succeed(DatabaseService, {
  query,
  execute,
  transaction,
});
