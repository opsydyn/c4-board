/**
 * Shared testing utilities live here.
 *
 * Once the Testing Library stack is installed, move helpers such as
 * `renderWithProviders`, MSW server setup, and Vitest lifecycle hooks into
 * this module so suites can import from a single place.
 */

export function warnUnconfiguredTestingLibrary(): void {
	if (process.env.NODE_ENV !== "test") return;
	// eslint-disable-next-line no-console
	console.warn(
		"tests/utils still needs render helpers. Install @testing-library/react and add utilities here.",
	);
}
