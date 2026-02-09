import { Context, Data } from "effect";
import type { Effect } from "effect";

export class DatabaseService extends Context.Tag("DatabaseService")<
	DatabaseService,
	{
		readonly query: <T>(sql: string, bindValues?: unknown[]) => Effect.Effect<T[], DatabaseError>;
		readonly execute: (sql: string, bindValues?: unknown[]) => Effect.Effect<void, DatabaseError>;
		readonly transaction: <A, E, R>(
			effect: Effect.Effect<A, E, R>,
		) => Effect.Effect<A, E | DatabaseError, R>;
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
