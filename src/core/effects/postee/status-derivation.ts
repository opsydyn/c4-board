import { Effect, Data, Schema, ParseResult, pipe } from "effect";
import type { PosteeHistoryEntry } from "@/core/effects/database.postee";

/**
 * Idiomatic Effect-TS: Use Data.TaggedEnum for type-safe discriminated union
 * instead of string literals. Provides better type safety and pattern matching.
 *
 * Using `{ readonly _: void }` for no-payload variants to satisfy ESLint
 */
export type RequestStatus = Data.TaggedEnum<{
	Success: { readonly _: void };
	Error: { readonly _: void };
	Unknown: { readonly _: void };
}>;

export const RequestStatus = Data.taggedEnum<RequestStatus>();

/**
 * Schema validation: Ensure history entry has required fields for status derivation
 * This validates at runtime that the data matches our expectations.
 */
const HistoryEntrySchema = Schema.Struct({
	request_id: Schema.NullOr(Schema.String),
	response_status: Schema.NullOr(Schema.Number),
	error_message: Schema.NullOr(Schema.String),
	executed_at: Schema.Number,
});

/**
 * Pure function: Determines execution status from a single history entry
 *
 * NO side effects, 100% testable
 *
 * @param entry - Single history entry to analyze
 * @returns RequestStatus - Success, Error, or Unknown (tagged enum)
 */
const statusFromEntry = (
	entry: Schema.Schema.Type<typeof HistoryEntrySchema>,
): RequestStatus => {
	// Error message takes highest precedence
	if (entry.error_message) return RequestStatus.Error({ _: undefined });

	// Null response means request never completed
	if (entry.response_status === null)
		return RequestStatus.Unknown({ _: undefined });

	// HTTP error codes (4xx, 5xx)
	return entry.response_status >= 400
		? RequestStatus.Error({ _: undefined })
		: RequestStatus.Success({ _: undefined });
};

/**
 * Schema for parsing error - provides type-safe error handling
 */
export class InvalidHistoryEntry extends Data.TaggedError("InvalidHistoryEntry")<{
	readonly entry: unknown;
	readonly parseError: ParseResult.ParseError;
}> {}

/**
 * Effect service: Derives request status map from execution history
 *
 * Uses idiomatic Effect-TS patterns:
 * - Effect.gen for async/generator composition
 * - Schema validation for runtime type safety
 * - Data.taggedEnum for type-safe status values
 * - Proper error channel (InvalidHistoryEntry)
 *
 * Returns the most recent status for each request based on executed_at timestamp.
 * Entries without a request_id are ignored.
 *
 * @param history - Array of history entries (may contain multiple entries per request)
 * @returns Effect containing Map<request_id, RequestStatus>
 *
 * @example
 * ```typescript
 * const history = await getHistory();
 * const statuses = await Effect.runPromise(deriveRequestStatuses(history));
 * const status = statuses.get("req-123"); // RequestStatus (Success | Error | Unknown)
 * ```
 */
export const deriveRequestStatuses = (
	history: PosteeHistoryEntry[],
): Effect.Effect<Map<string, RequestStatus>, InvalidHistoryEntry> =>
	Effect.gen(function* () {
		// Track most recent entry per request
		const latestStatuses = new Map<
			string,
			{ status: RequestStatus; executedAt: number }
		>();

		for (const entry of history) {
			// Skip entries without request ID
			if (!entry.request_id) continue;

			// Validate entry schema - fail fast on invalid data
			const validatedEntry = yield* pipe(
				Schema.decodeUnknown(HistoryEntrySchema)(entry),
				Effect.mapError(
					(parseError) =>
						new InvalidHistoryEntry({ entry, parseError }),
				),
			);

			const status = statusFromEntry(validatedEntry);
			const previous = latestStatuses.get(entry.request_id);

			// Keep only the most recent entry (highest executed_at)
			if (!previous || entry.executed_at > previous.executedAt) {
				latestStatuses.set(entry.request_id, {
					status,
					executedAt: entry.executed_at,
				});
			}
		}

		// Return simplified map (just request_id → status)
		return new Map(
			Array.from(latestStatuses.entries()).map(([id, { status }]) => [
				id,
				status,
			]),
		);
	});
