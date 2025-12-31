import { describe, it, expect } from "vitest";
import { Effect } from "effect";
import {
	deriveUIState,
	type UIStateInput,
} from "@/core/effects/postee/ui-state";
import { deriveRequestStatuses } from "@/core/effects/postee/status-derivation";
import type { PosteeHistoryEntry } from "@/core/effects/database.postee";

/**
 * Phase 2 Integration Tests
 *
 * These tests verify that our Effect services integrate correctly
 * with the machine's action patterns. They test the functional core
 * (Effect services) that the machine actions use.
 *
 * We test the services directly to verify the integration pattern
 * without requiring complex database mocking.
 */
describe("Postee Machine - Phase 2 Integration", () => {
	it("should toggle sidebar state and derive new UI state", () => {
		// Arrange: Simulating machine context flags (initial state)
		const initialFlags: UIStateInput = {
			isSidebarOpen: true,
			isResponseOpen: false,
			isCompactLayout: false,
			isEnvironmentOpen: false,
			showDiff: false,
		};

		// Act: Derive initial UI state (what machine does on initialization)
		const initialUIState = Effect.runSync(deriveUIState(initialFlags));

		// Assert: Initial state has sidebar open, response closed (0px)
		expect(initialUIState.gridTemplateColumns).toBe(
			"minmax(260px, 320px) 1fr 0px",
		);

		// Act: Simulate toggleSidebar action
		const toggledFlags: UIStateInput = {
			...initialFlags,
			isSidebarOpen: false,
		};
		const toggledUIState = Effect.runSync(deriveUIState(toggledFlags));

		// Assert: Sidebar closed, grid updated (third column still there)
		expect(toggledUIState.gridTemplateColumns).toBe("0px 1fr 0px");

		// Act: Toggle back (simulating second UI_TOGGLE_SIDEBAR event)
		const backToInitialFlags: UIStateInput = {
			...toggledFlags,
			isSidebarOpen: true,
		};
		const backToInitialUIState = Effect.runSync(
			deriveUIState(backToInitialFlags),
		);

		// Assert: Back to initial state
		expect(backToInitialUIState.gridTemplateColumns).toBe(
			"minmax(260px, 320px) 1fr 0px",
		);
	});

	it("should toggle response panel and update docked state", () => {
		// Arrange
		const initialFlags: UIStateInput = {
			isSidebarOpen: true,
			isResponseOpen: false,
			isCompactLayout: false,
			isEnvironmentOpen: false,
			showDiff: false,
		};

		// Initial state: Response closed
		const initialUIState = Effect.runSync(deriveUIState(initialFlags));
		expect(initialUIState.isResponseDocked).toBe(false);

		// Act: Open response panel (simulating toggleResponse action)
		const responseOpenFlags: UIStateInput = {
			...initialFlags,
			isResponseOpen: true,
		};
		const responseOpenUIState = Effect.runSync(deriveUIState(responseOpenFlags));

		// Assert: Response panel open and docked (3 columns)
		expect(responseOpenUIState.isResponseDocked).toBe(true);
		expect(responseOpenUIState.gridTemplateColumns).toBe(
			"minmax(260px, 320px) 1fr minmax(300px, 360px)",
		);
	});

	it("should derive request statuses from history", () => {
		// Arrange: Sample history entries (simulating database load)
		const history: PosteeHistoryEntry[] = [
			{
				id: "hist-1",
				request_id: "req-1",
				request_snapshot: "{}",
				response_status: 200,
				response_time_ms: 100,
				response_size_bytes: 1024,
				response_body: "{}",
				response_headers: "{}",
				error_message: null,
				executed_at: Date.now(),
			},
			{
				id: "hist-2",
				request_id: "req-2",
				request_snapshot: "{}",
				response_status: 404,
				response_time_ms: 150,
				response_size_bytes: 512,
				response_body: "Not Found",
				response_headers: "{}",
				error_message: null,
				executed_at: Date.now(),
			},
		];

		// Act: Derive request statuses (what deriveRequestStatuses action does)
		const statusMap = Effect.runSync(deriveRequestStatuses(history));

		// Assert: Statuses are correctly derived
		expect(statusMap.size).toBe(2);
		expect(statusMap.get("req-1")?._tag).toBe("Success");
		expect(statusMap.get("req-2")?._tag).toBe("Error");
	});

	it("should update request statuses when history changes", () => {
		// Arrange: Initial history
		const initialHistory: PosteeHistoryEntry[] = [
			{
				id: "hist-1",
				request_id: "req-1",
				request_snapshot: "{}",
				response_status: 500,
				response_time_ms: 100,
				response_size_bytes: 1024,
				response_body: "Error",
				response_headers: "{}",
				error_message: null,
				executed_at: Date.now() - 1000,
			},
		];

		const initialStatuses = Effect.runSync(
			deriveRequestStatuses(initialHistory),
		);
		expect(initialStatuses.get("req-1")?._tag).toBe("Error");

		// Act: Simulate REFRESH_HISTORY with updated history
		const updatedHistory: PosteeHistoryEntry[] = [
			...initialHistory,
			{
				id: "hist-2",
				request_id: "req-1",
				request_snapshot: "{}",
				response_status: 200, // Now successful
				response_time_ms: 100,
				response_size_bytes: 1024,
				response_body: "{}",
				response_headers: "{}",
				error_message: null,
				executed_at: Date.now(), // More recent
			},
		];

		const updatedStatuses = Effect.runSync(
			deriveRequestStatuses(updatedHistory),
		);

		// Assert: Status updated to most recent
		expect(updatedStatuses.get("req-1")?._tag).toBe("Success");
	});

	it("should set compact layout and adjust grid structure", () => {
		// Arrange: Non-compact with response open
		const initialFlags: UIStateInput = {
			isSidebarOpen: true,
			isResponseOpen: true,
			isCompactLayout: false,
			isEnvironmentOpen: false,
			showDiff: false,
		};

		const initialUIState = Effect.runSync(deriveUIState(initialFlags));

		// Initial: 3 columns (sidebar, center, response docked)
		expect(initialUIState.gridTemplateColumns).toBe(
			"minmax(260px, 320px) 1fr minmax(300px, 360px)",
		);
		expect(initialUIState.isResponseDocked).toBe(true);

		// Act: Enable compact layout (simulating setCompactLayout action)
		const compactFlags: UIStateInput = {
			...initialFlags,
			isCompactLayout: true,
		};
		const compactUIState = Effect.runSync(deriveUIState(compactFlags));

		// Assert: 2 columns only (response undocked in compact mode)
		expect(compactUIState.gridTemplateColumns).toBe(
			"minmax(260px, 320px) 1fr",
		);
		expect(compactUIState.isResponseDocked).toBe(false);
		expect(compactUIState.gridTemplateRows).toBe("minmax(0, 1fr) auto");

		// Act: Disable compact layout
		const backToNormalFlags: UIStateInput = {
			...compactFlags,
			isCompactLayout: false,
		};
		const backToNormalUIState = Effect.runSync(
			deriveUIState(backToNormalFlags),
		);

		// Assert: Back to 3 columns
		expect(backToNormalUIState.gridTemplateColumns).toBe(
			"minmax(260px, 320px) 1fr minmax(300px, 360px)",
		);
		expect(backToNormalUIState.isResponseDocked).toBe(true);
	});
});
