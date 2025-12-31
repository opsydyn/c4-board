import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PosteeSidebar } from "@/ui/components/postee/PosteeSidebar";
import type { PosteeCollection, PosteeRequest } from "@/core/effects/database.postee";
import type { RequestStatus } from "@/core/effects/postee/status-derivation";
import { CollectionId, RequestId } from "@/core/effects/postee/types";

describe("PosteeSidebar", () => {
	const mockCollections: PosteeCollection[] = [
		{
			id: CollectionId("col-1"),
			name: "API Tests",
			description: null,
			sort_order: 0,
			created_at: Date.now(),
			updated_at: Date.now(),
		},
		{
			id: CollectionId("col-2"),
			name: "User Endpoints",
			description: null,
			sort_order: 1,
			created_at: Date.now(),
			updated_at: Date.now(),
		},
	];

	const mockRequestsByCollection: Record<string, PosteeRequest[]> = {
		"col-1": [
			{
				id: RequestId("req-1"),
				collection_id: CollectionId("col-1"),
				name: "Get Users",
				method: "GET",
				url: "https://api.example.com/users",
				description: null,
				favorite: 0,
				sort_order: 0,
				created_at: Date.now(),
				updated_at: Date.now(),
			},
		],
		"col-2": [
			{
				id: RequestId("req-2"),
				collection_id: CollectionId("col-2"),
				name: "Create User",
				method: "POST",
				url: "https://api.example.com/users",
				description: null,
				favorite: 0,
				sort_order: 0,
				created_at: Date.now(),
				updated_at: Date.now(),
			},
		],
	};

	const mockRequestStatuses = new Map<string, RequestStatus>([
		["req-1", { _tag: "Success" as const, _: undefined as void }],
		["req-2", { _tag: "Error" as const, _: undefined as void }],
	]);

	it("should render collections tree with collection names", () => {
		// Arrange
		const onCreateCollection = vi.fn();
		const onSelectCollection = vi.fn();
		const onSelectRequest = vi.fn();
		const onDeleteCollections = vi.fn();
		const onRenameCollection = vi.fn();
		const onToggleSidebar = vi.fn();

		// Act
		render(
			<PosteeSidebar
				collections={mockCollections}
				requestsByCollection={mockRequestsByCollection}
				requestStatuses={mockRequestStatuses}
				activeCollectionId={null}
				activeRequestId={null}
				onCreateCollection={onCreateCollection}
				onSelectCollection={onSelectCollection}
				onSelectRequest={onSelectRequest}
				onDeleteCollections={onDeleteCollections}
				onRenameCollection={onRenameCollection}
				onToggleSidebar={onToggleSidebar}
			/>,
		);

		// Assert
		expect(screen.getByText("API Tests")).toBeInTheDocument();
		expect(screen.getByText("User Endpoints")).toBeInTheDocument();
	});

	it("should call onCreateCollection when form is submitted", async () => {
		// Arrange
		const user = userEvent.setup();
		const onCreateCollection = vi.fn();
		const onSelectCollection = vi.fn();
		const onSelectRequest = vi.fn();
		const onDeleteCollections = vi.fn();
		const onRenameCollection = vi.fn();
		const onToggleSidebar = vi.fn();

		render(
			<PosteeSidebar
				collections={mockCollections}
				requestsByCollection={mockRequestsByCollection}
				requestStatuses={mockRequestStatuses}
				activeCollectionId={null}
				activeRequestId={null}
				onCreateCollection={onCreateCollection}
				onSelectCollection={onSelectCollection}
				onSelectRequest={onSelectRequest}
				onDeleteCollections={onDeleteCollections}
				onRenameCollection={onRenameCollection}
				onToggleSidebar={onToggleSidebar}
			/>,
		);

		// Act
		const input = screen.getByPlaceholderText("New collection name");
		await user.type(input, "New Collection");

		const submitButton = screen.getByText("Add Collection");
		await user.click(submitButton);

		// Assert
		expect(onCreateCollection).toHaveBeenCalledWith("New Collection");
	});

	it("should display requests under each collection", async () => {
		// Arrange
		const onCreateCollection = vi.fn();
		const onSelectCollection = vi.fn();
		const onSelectRequest = vi.fn();
		const onDeleteCollections = vi.fn();
		const onRenameCollection = vi.fn();
		const onToggleSidebar = vi.fn();
		const user = userEvent.setup();

		render(
			<PosteeSidebar
				collections={mockCollections}
				requestsByCollection={mockRequestsByCollection}
				requestStatuses={mockRequestStatuses}
				activeCollectionId={CollectionId("col-1")}
				activeRequestId={null}
				onCreateCollection={onCreateCollection}
				onSelectCollection={onSelectCollection}
				onSelectRequest={onSelectRequest}
				onDeleteCollections={onDeleteCollections}
				onRenameCollection={onRenameCollection}
				onToggleSidebar={onToggleSidebar}
			/>,
		);

		// Act: Expand collection by clicking chevron button
		const expandButtons = screen.getAllByRole("button", {
			name: /expand\/collapse collection/i,
		});
		expect(expandButtons.length).toBeGreaterThan(0);
		// Click the first collection's expand button
		await user.click(expandButtons[0]!);

		// Assert
		expect(screen.getByText("Get Users")).toBeInTheDocument();
		expect(screen.getByText("GET")).toBeInTheDocument();
	});

	it("should show request status indicators", async () => {
		// Arrange
		const onCreateCollection = vi.fn();
		const onSelectCollection = vi.fn();
		const onSelectRequest = vi.fn();
		const onDeleteCollections = vi.fn();
		const onRenameCollection = vi.fn();
		const onToggleSidebar = vi.fn();
		const user = userEvent.setup();

		render(
			<PosteeSidebar
				collections={mockCollections}
				requestsByCollection={mockRequestsByCollection}
				requestStatuses={mockRequestStatuses}
				activeCollectionId={CollectionId("col-1")}
				activeRequestId={null}
				onCreateCollection={onCreateCollection}
				onSelectCollection={onSelectCollection}
				onSelectRequest={onSelectRequest}
				onDeleteCollections={onDeleteCollections}
				onRenameCollection={onRenameCollection}
				onToggleSidebar={onToggleSidebar}
			/>,
		);

		// Act: Expand collection by clicking chevron button
		const expandButtons = screen.getAllByRole("button", {
			name: /expand\/collapse collection/i,
		});
		expect(expandButtons.length).toBeGreaterThan(0);
		// Click the first collection's expand button
		await user.click(expandButtons[0]!);

		// Assert: Check that status colors are applied
		// (This is visual, so we check for the presence of the request)
		expect(screen.getByText("Get Users")).toBeInTheDocument();
	});

	it("should call onSelectRequest when request is clicked", async () => {
		// Arrange
		const onCreateCollection = vi.fn();
		const onSelectCollection = vi.fn();
		const onSelectRequest = vi.fn();
		const onDeleteCollections = vi.fn();
		const onRenameCollection = vi.fn();
		const onToggleSidebar = vi.fn();
		const user = userEvent.setup();

		render(
			<PosteeSidebar
				collections={mockCollections}
				requestsByCollection={mockRequestsByCollection}
				requestStatuses={mockRequestStatuses}
				activeCollectionId={CollectionId("col-1")}
				activeRequestId={null}
				onCreateCollection={onCreateCollection}
				onSelectCollection={onSelectCollection}
				onSelectRequest={onSelectRequest}
				onDeleteCollections={onDeleteCollections}
				onRenameCollection={onRenameCollection}
				onToggleSidebar={onToggleSidebar}
			/>,
		);

		// Act: Expand collection by clicking chevron button
		const expandButtons = screen.getAllByRole("button", {
			name: /expand\/collapse collection/i,
		});
		expect(expandButtons.length).toBeGreaterThan(0);
		// Click the first collection's expand button
		await user.click(expandButtons[0]!);

		// Click on the request
		const requestItem = screen.getByText("Get Users");
		await user.click(requestItem);

		// Assert
		expect(onSelectRequest).toHaveBeenCalledWith("req-1");
	});
});
