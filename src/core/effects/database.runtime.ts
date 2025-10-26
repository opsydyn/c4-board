/**
 * Database Runtime (Imperative Shell)
 *
 * Provides the actual implementation of DatabaseService using Tauri SQL plugin
 * This is where side effects happen - at the boundary of the application
 */

import { Effect, Layer } from "effect";
import Database from "@tauri-apps/plugin-sql";
import { DatabaseService, DatabaseError } from "./database";

let dbInstance: Database | null = null;

/**
 * Get or create database connection
 */
const getDatabase = (): Effect.Effect<Database, DatabaseError> =>
	Effect.gen(function* () {
		if (dbInstance) {
			return dbInstance;
		}

		dbInstance = yield* Effect.tryPromise({
			try: () => Database.load("sqlite:c4board.db"),
			catch: (error) => new DatabaseError("Failed to load database", error),
		});

		return dbInstance;
	});

/**
 * Execute a SQL query that returns results
 */
const query = <T>(
	sql: string,
	bindValues?: unknown[],
): Effect.Effect<T[], DatabaseError> =>
	Effect.gen(function* () {
		const db = yield* getDatabase();

		return yield* Effect.tryPromise({
			try: () => db.select<T[]>(sql, bindValues),
			catch: (error) => new DatabaseError("Query failed", error),
		});
	});

/**
 * Execute a SQL command that doesn't return results
 */
const execute = (
	sql: string,
	bindValues?: unknown[],
): Effect.Effect<void, DatabaseError> =>
	Effect.gen(function* () {
		const db = yield* getDatabase();

		yield* Effect.tryPromise({
			try: () => db.execute(sql, bindValues),
			catch: (error) => new DatabaseError("Execute failed", error),
		});
	});

/**
 * Live DatabaseService Layer
 * Provides the actual implementation for the DatabaseService tag
 */
export const DatabaseServiceLive = Layer.succeed(DatabaseService, {
	getDatabase,
	query,
	execute,
});
