import { describe, it, expect } from "vitest";
import { Effect } from "effect";
import {
	deriveUIState,
	type UIStateInput,
} from "@/core/effects/postee/ui-state";

describe("deriveUIState", () => {
	it("should calculate grid template for open sidebar + response", async () => {
		// Arrange: Sidebar open, response open, not compact
		const input: UIStateInput = {
			isSidebarOpen: true,
			isResponseOpen: true,
			isCompactLayout: false,
			isEnvironmentOpen: false,
			showDiff: false,
		};

		// Act
		const result = await Effect.runPromise(deriveUIState(input));

		// Assert: Should have 3 columns (sidebar, center, response)
		expect(result.gridTemplateColumns).toBe(
			"minmax(260px, 320px) 1fr minmax(300px, 360px)",
		);
		expect(result.gridTemplateRows).toBe("minmax(0, 1fr)");
		expect(result.isResponseDocked).toBe(true);
	});

	it("should calculate grid template for closed sidebar", async () => {
		// Arrange: Sidebar closed, response open
		const input: UIStateInput = {
			isSidebarOpen: false,
			isResponseOpen: true,
			isCompactLayout: false,
			isEnvironmentOpen: false,
			showDiff: false,
		};

		// Act
		const result = await Effect.runPromise(deriveUIState(input));

		// Assert: Should have 2 columns (no sidebar, center, response)
		expect(result.gridTemplateColumns).toBe("0px 1fr minmax(300px, 360px)");
		expect(result.gridTemplateRows).toBe("minmax(0, 1fr)");
		expect(result.isResponseDocked).toBe(true);
	});

	it("should calculate grid template for compact mode", async () => {
		// Arrange: Compact layout with response open
		const input: UIStateInput = {
			isSidebarOpen: true,
			isResponseOpen: true,
			isCompactLayout: true,
			isEnvironmentOpen: false,
			showDiff: false,
		};

		// Act
		const result = await Effect.runPromise(deriveUIState(input));

		// Assert: Should have 2 columns, response undocked
		expect(result.gridTemplateColumns).toBe("minmax(260px, 320px) 1fr");
		expect(result.gridTemplateRows).toBe("minmax(0, 1fr) auto");
		expect(result.isResponseDocked).toBe(false);
	});

	it("should derive active selection state correctly", async () => {
		// Arrange: Various panel states
		const input: UIStateInput = {
			isSidebarOpen: true,
			isResponseOpen: false,
			isCompactLayout: false,
			isEnvironmentOpen: true,
			showDiff: false,
		};

		// Act
		const result = await Effect.runPromise(deriveUIState(input));

		// Assert: Should include environment row
		expect(result.gridTemplateRows).toBe("minmax(0, 1fr) auto");
		expect(result.isResponseDocked).toBe(false);
	});
});
