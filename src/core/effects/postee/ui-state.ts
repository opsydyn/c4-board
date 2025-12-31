import { Effect } from "effect";

/**
 * Input for UI state derivation
 */
export interface UIStateInput {
	readonly isSidebarOpen: boolean;
	readonly isResponseOpen: boolean;
	readonly isCompactLayout: boolean;
	readonly isEnvironmentOpen: boolean;
	readonly showDiff: boolean;
}

/**
 * Derived UI state for layout calculations
 */
export interface DerivedUIState {
	readonly gridTemplateColumns: string;
	readonly gridTemplateRows: string;
	readonly isResponseDocked: boolean;
}

/**
 * Effect service: Derives CSS grid template from UI state flags
 *
 * Pure function that calculates grid layout based on panel visibility.
 * NO side effects, 100% testable.
 *
 * @param input - UI state flags
 * @returns Effect containing derived grid template values
 *
 * @example
 * ```typescript
 * const state = { isSidebarOpen: true, isResponseOpen: true, isCompactLayout: false, isEnvironmentOpen: false };
 * const ui = await Effect.runPromise(deriveUIState(state));
 * // Returns: { gridTemplateColumns: "minmax(260px, 320px) 1fr minmax(300px, 360px)", ... }
 * ```
 */
export const deriveUIState = (
	input: UIStateInput,
): Effect.Effect<DerivedUIState> =>
	Effect.sync(() => {
		// Calculate left track (sidebar)
		const leftTrack = input.isSidebarOpen ? "minmax(260px, 320px)" : "0px";

		// Calculate right track (response panel when docked)
		const rightTrackBase = "minmax(300px, 360px)";
		const rightTrack =
			!input.isCompactLayout && input.isResponseOpen ? rightTrackBase : "0px";

		// Calculate columns
		const gridTemplateColumns = input.isCompactLayout
			? `${leftTrack} 1fr`
			: `${leftTrack} 1fr ${rightTrack}`;

		// Calculate rows
		const templateRowsParts = ["minmax(0, 1fr)"];
		if (input.isCompactLayout && input.isResponseOpen) {
			templateRowsParts.push("auto");
		}
		if (input.isEnvironmentOpen) {
			templateRowsParts.push("auto");
		}
		const gridTemplateRows = templateRowsParts.join(" ");

		// Derive response docking state
		const isResponseDocked = input.isResponseOpen && !input.isCompactLayout;

		return {
			gridTemplateColumns,
			gridTemplateRows,
			isResponseDocked,
		};
	});
