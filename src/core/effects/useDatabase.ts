/**
 * React Hook for Database Effects
 *
 * Provides a way to run database effects from React components
 * Bridges Effect-TS with React component lifecycle
 */

import { useCallback } from "react";
import { Effect } from "effect";
import { DatabaseServiceLive } from "./database.runtime";
import {
	DatabaseService,
	type DatabaseError,
	type NotFoundError,
	type ValidationError,
} from "./database";

/**
 * Hook to run database effects
 */
export function useDatabase() {
	const runEffect = useCallback(
		<A, E extends DatabaseError | NotFoundError | ValidationError>(
			effect: Effect.Effect<A, E, DatabaseService>,
		): Promise<A> => {
			// Provide the DatabaseService layer and run the effect as a Promise
			return Effect.runPromise(Effect.provide(effect, DatabaseServiceLive));
		},
		[],
	);

	return {
		runEffect,
	};
}
