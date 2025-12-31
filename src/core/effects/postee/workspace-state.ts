import { Effect } from "effect";
import type { PosteeRequest } from "../database.postee";
import type { CollectionId, RequestId } from "./types";
import type { RunnerState } from "../../../ui/machines/postee.machine";

/**
 * Input for workspace state derivation
 */
export interface WorkspaceStateInput {
	readonly isInitialising: boolean;
	readonly isRunning: boolean;
	readonly isFailure: boolean;
	readonly runner: RunnerState;
	readonly activeCollectionId: CollectionId | null;
	readonly activeRequestId: RequestId | null;
	readonly requestsByCollection: Record<string, PosteeRequest[]>;
}

/**
 * Derived workspace state
 */
export interface DerivedWorkspaceState {
	readonly statusLabel: string;
	readonly activeCollectionKey: string | null;
	readonly requestsForActiveCollection: PosteeRequest[];
	readonly selectedRequest: PosteeRequest | null;
	readonly canRunRequest: boolean;
	readonly lastError: string | null;
}

/**
 * Effect service: Derives workspace state from machine context
 *
 * Pure function that calculates derived values based on current workspace state.
 * NO side effects, 100% testable.
 *
 * @param input - Workspace state input
 * @returns Effect containing derived workspace state
 *
 * @example
 * ```typescript
 * const input = {
 *   isInitialising: false,
 *   isRunning: true,
 *   isFailure: false,
 *   runner: { status: "running", ... },
 *   activeCollectionId: "col-123",
 *   activeRequestId: "req-456",
 *   requestsByCollection: { "col-123": [...] }
 * };
 * const derived = await Effect.runPromise(deriveWorkspaceState(input));
 * // Returns: { statusLabel: "Executing request", canRunRequest: false, ... }
 * ```
 */
export const deriveWorkspaceState = (
	input: WorkspaceStateInput,
): Effect.Effect<DerivedWorkspaceState> =>
	Effect.sync(() => {
		// Derive status label
		const statusLabel = (() => {
			if (input.isInitialising) return "Synchronising workspace";
			if (input.isRunning) return "Executing request";
			if (input.isFailure) return "Failed to load workspace";
			if (input.runner.status === "success") return "Last run succeeded";
			if (input.runner.status === "error") return "Last run errored";
			return "Idle";
		})();

		// Derive active collection key
		const activeCollectionKey = input.activeCollectionId
			? (input.activeCollectionId as unknown as string)
			: null;

		// Derive requests for active collection
		const requestsForActiveCollection = activeCollectionKey
			? input.requestsByCollection[activeCollectionKey] ?? []
			: [];

		// Derive selected request
		const selectedRequest = requestsForActiveCollection.find(
			(request: PosteeRequest) =>
				request.id === (input.activeRequestId as unknown as string),
		) ?? null;

		// Derive canRunRequest
		const canRunRequest = Boolean(selectedRequest) && !input.isInitialising && !input.isRunning;

		// Derive last error
		const lastError = input.runner.status === "error"
			? input.runner.error ?? "Request failed"
			: null;

		return {
			statusLabel,
			activeCollectionKey,
			requestsForActiveCollection,
			selectedRequest,
			canRunRequest,
			lastError,
		};
	});
