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
 * - Write serialization uses a JS Promise chain mutex, not an Effect Semaphore,
 *   because each Effect.runPromise call creates an independent fiber — a module-level
 *   semaphore cannot reliably coordinate across isolated fiber runtimes.
 */

import { Duration, Effect, FiberRef, Layer, Schedule } from "effect";
import { invoke } from "@tauri-apps/api/core";
import { DatabaseService, DatabaseError } from "./database";

let writeQueue: Promise<void> = Promise.resolve();
const writeLockDepthRef = FiberRef.unsafeMake(0);

const SQLITE_BUSY_MAX_ATTEMPTS = 8;
const SQLITE_BUSY_BASE_DELAY = Duration.millis(40);
const SQLITE_BUSY_RETRY_SCHEDULE = Schedule.intersect(
	Schedule.exponential(SQLITE_BUSY_BASE_DELAY),
	Schedule.recurs(SQLITE_BUSY_MAX_ATTEMPTS - 1),
).pipe(Schedule.jittered);

const toError = (error: unknown): Error =>
	error instanceof Error ? error : new Error(String(error));

const collectErrorMessages = (error: unknown): string[] => {
	const messages: string[] = [];
	const visited = new Set<unknown>();
	let cursor: unknown = error;

	while (
		cursor !== null &&
		cursor !== undefined &&
		(typeof cursor === "object" || typeof cursor === "function") &&
		!visited.has(cursor)
	) {
		visited.add(cursor);

		if ("message" in cursor && typeof cursor.message === "string") {
			messages.push(cursor.message.toLowerCase());
		}

		if ("cause" in cursor) {
			cursor = cursor.cause;
			continue;
		}

		break;
	}

	if (messages.length === 0 && typeof error === "string") {
		messages.push(error.toLowerCase());
	}

	return messages;
};

const isSqliteBusyError = (error: unknown): boolean => {
	const messages = collectErrorMessages(error);
	return messages.some(
		(message) =>
			message.includes("database is locked") ||
			message.includes("database is busy") ||
			message.includes("sqlite busy") ||
			message.includes("sqlite_busy") ||
			message.includes("code: 5"),
	);
};

// ============================================================================
// Raw database operations (via custom Tauri commands)
// ============================================================================

const executeRaw = (
	sql: string,
	bindValues?: unknown[],
): Effect.Effect<void, Error> =>
	Effect.tryPromise({
		try: () => invoke("sql_execute", { sql, values: bindValues ?? [] }),
		catch: toError,
	}).pipe(
		Effect.retry({
			while: (error) => isSqliteBusyError(error),
			schedule: SQLITE_BUSY_RETRY_SCHEDULE,
		}),
	);

const queryRaw = <T>(
	sql: string,
	bindValues?: unknown[],
): Effect.Effect<T[], Error> =>
	Effect.tryPromise({
		try: () => invoke<T[]>("sql_query", { sql, values: bindValues ?? [] }),
		catch: toError,
	}).pipe(
		Effect.retry({
			while: (error) => isSqliteBusyError(error),
			schedule: SQLITE_BUSY_RETRY_SCHEDULE,
		}),
	);

// ============================================================================
// Write serialization (JS Promise chain mutex)
// ============================================================================

const acquireWriteLock = Effect.async<() => void, never>((resume) => {
	let release!: () => void;
	const gate = new Promise<void>((r) => {
		release = r;
	});
	const prev = writeQueue;
	writeQueue = gate;
	prev.then(() => resume(Effect.succeed(release)));
});

const withWritePermit = <A, E, R>(
	effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
	Effect.gen(function* () {
		const lockDepth = yield* FiberRef.get(writeLockDepthRef);

		if (lockDepth > 0) {
			return yield* effect;
		}

		return yield* Effect.acquireUseRelease(
			acquireWriteLock,
			(_release) => Effect.locally(writeLockDepthRef, 1)(effect),
			(release) => Effect.sync(() => release()),
		);
	}) as Effect.Effect<A, E, R>;

// ============================================================================
// Error wrapping helpers
// ============================================================================

const wrapExecuteError = (
	effect: Effect.Effect<void, Error>,
): Effect.Effect<void, DatabaseError> =>
	effect.pipe(
		Effect.mapError(
			(error) => new DatabaseError({ message: "Execute failed", cause: error }),
		),
	);

const wrapQueryError = <T>(
	effect: Effect.Effect<T[], Error>,
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
// Public service operations
// ============================================================================

/**
 * Execute a SQL query that returns results.
 */
const query = <T>(
	sql: string,
	bindValues?: unknown[],
): Effect.Effect<T[], DatabaseError> =>
	wrapQueryError(queryRaw<T>(sql, bindValues));

/**
 * Execute a SQL command that doesn't return results.
 */
const execute = (
	sql: string,
	bindValues?: unknown[],
): Effect.Effect<void, DatabaseError> =>
	withWritePermit(wrapExecuteError(executeRaw(sql, bindValues))).pipe(
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
	withWritePermit(
		Effect.uninterruptibleMask((restore) =>
			Effect.gen(function* () {
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
			}),
		),
	).pipe(Effect.mapError(toDatabaseError));

/**
 * Live DatabaseService Layer
 * Provides the actual implementation for the DatabaseService tag
 */
export const DatabaseServiceLive = Layer.succeed(DatabaseService, {
	query,
	execute,
	transaction,
});
