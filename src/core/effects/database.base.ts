import { Effect, Context, Data } from "effect";
import Database from "@tauri-apps/plugin-sql";

export class DatabaseService extends Context.Tag("DatabaseService")<
	DatabaseService,
	{
		readonly getDatabase: () => Effect.Effect<Database, DatabaseError>;
		readonly query: <T>(sql: string, bindValues?: unknown[]) => Effect.Effect<T[], DatabaseError>;
		readonly execute: (sql: string, bindValues?: unknown[]) => Effect.Effect<void, DatabaseError>;
	}
>() {}

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
	message: string;
	cause?: unknown;
}> {}

export class NotFoundError extends Data.TaggedError("NotFoundError")<{
	entity: string;
	id: string;
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
	field: string;
	message: string;
}> {}

/**
 * Initialize the database connection and run pending migrations.
 * Consumers typically call this once on startup to ensure the DB is ready.
 */
export const initDatabase = Effect.gen(function* () {
	const service = yield* DatabaseService;
	const db = yield* service.getDatabase();
	return db;
});
