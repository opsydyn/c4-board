/**
 * Edge Operations Tests
 *
 * Tests for edge validation, creation, metadata management, and visual styling.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Effect } from "effect";
import type { Edge } from "@xyflow/react";
import {
	validateEdgeConnection,
	findEdgeById,
	getEdgesForNode,
	removeEdgesConnectedToNode,
	removeEdge,
	createValidatedEdge,
	addValidatedEdge,
	validateEdgeLabel,
	updateEdgeLabel,
	updateEdgeMetadata,
	getEdgeStyle,
	getEdgeColor,
	getEdgeThickness,
	getEdgeAnimation,
	EDGE_STYLE_MAP,
	PROTOCOL_COLOR_MAP,
	type EdgeData,
} from "./edge-operations";

describe("validateEdgeConnection", () => {
	const mockEdges: Edge[] = [
		{
			id: "edge-1",
			source: "node-a",
			target: "node-b",
			label: "uses",
			type: "default",
		},
	];

	it("should succeed for valid connection", () => {
		const effect = validateEdgeConnection(mockEdges, "node-c", "node-d");
		const result = Effect.runSync(effect);
		expect(result).toBeUndefined(); // Void effect succeeds
	});

	it("should fail for self-connection", async () => {
		const effect = validateEdgeConnection(mockEdges, "node-a", "node-a");
		await expect(Effect.runPromise(effect)).rejects.toThrow("Cannot connect node to itself");
	});

	it("should fail for duplicate edge (same direction)", async () => {
		const effect = validateEdgeConnection(mockEdges, "node-a", "node-b");
		await expect(Effect.runPromise(effect)).rejects.toThrow("Edge already exists between these nodes");
	});

	it("should fail for duplicate edge (opposite direction)", async () => {
		const effect = validateEdgeConnection(mockEdges, "node-b", "node-a");
		await expect(Effect.runPromise(effect)).rejects.toThrow("Edge already exists between these nodes");
	});
});

describe("findEdgeById", () => {
	const mockEdges: Edge[] = [
		{
			id: "edge-1",
			source: "node-a",
			target: "node-b",
			label: "uses",
			type: "default",
		},
		{
			id: "edge-2",
			source: "node-b",
			target: "node-c",
			label: "sends",
			type: "default",
		},
	];

	it("should find edge by ID", () => {
		const effect = findEdgeById(mockEdges, "edge-2");
		const result = Effect.runSync(effect);

		expect(result).not.toBeNull();
		expect(result?.id).toBe("edge-2");
		expect(result?.source).toBe("node-b");
		expect(result?.target).toBe("node-c");
	});

	it("should return null for non-existent ID", () => {
		const effect = findEdgeById(mockEdges, "edge-999");
		const result = Effect.runSync(effect);

		expect(result).toBeNull();
	});
});

describe("getEdgesForNode", () => {
	const mockEdges: Edge[] = [
		{
			id: "edge-1",
			source: "node-a",
			target: "node-b",
			label: "uses",
			type: "default",
		},
		{
			id: "edge-2",
			source: "node-b",
			target: "node-c",
			label: "sends",
			type: "default",
		},
		{
			id: "edge-3",
			source: "node-d",
			target: "node-b",
			label: "calls",
			type: "default",
		},
	];

	it("should get all edges for node as source or target", () => {
		const edges = getEdgesForNode(mockEdges, "node-b");

		expect(edges).toHaveLength(3);
		expect(edges.map((e) => e.id)).toEqual(["edge-1", "edge-2", "edge-3"]);
	});

	it("should return empty array for node with no edges", () => {
		const edges = getEdgesForNode(mockEdges, "node-999");

		expect(edges).toHaveLength(0);
	});

	it("should get edges where node is only source", () => {
		const edges = getEdgesForNode(mockEdges, "node-a");

		expect(edges).toHaveLength(1);
		expect(edges[0]?.id).toBe("edge-1");
	});

	it("should get edges where node is only target", () => {
		const edges = getEdgesForNode(mockEdges, "node-c");

		expect(edges).toHaveLength(1);
		expect(edges[0]?.id).toBe("edge-2");
	});
});

describe("removeEdgesConnectedToNode", () => {
	const mockEdges: Edge[] = [
		{
			id: "edge-1",
			source: "node-a",
			target: "node-b",
			label: "uses",
			type: "default",
		},
		{
			id: "edge-2",
			source: "node-b",
			target: "node-c",
			label: "sends",
			type: "default",
		},
		{
			id: "edge-3",
			source: "node-d",
			target: "node-e",
			label: "calls",
			type: "default",
		},
	];

	it("should remove all edges connected to node", () => {
		const effect = removeEdgesConnectedToNode(mockEdges, "node-b");
		const result = Effect.runSync(effect);

		expect(result).toHaveLength(1);
		expect(result[0]?.id).toBe("edge-3");
	});

	it("should return all edges if node not connected", () => {
		const effect = removeEdgesConnectedToNode(mockEdges, "node-999");
		const result = Effect.runSync(effect);

		expect(result).toHaveLength(3);
	});
});

describe("removeEdge", () => {
	const mockEdges: Edge[] = [
		{
			id: "edge-1",
			source: "node-a",
			target: "node-b",
			label: "uses",
			type: "default",
		},
		{
			id: "edge-2",
			source: "node-b",
			target: "node-c",
			label: "sends",
			type: "default",
		},
	];

	it("should remove specific edge by ID", () => {
		const effect = removeEdge(mockEdges, "edge-1");
		const result = Effect.runSync(effect);

		expect(result).toHaveLength(1);
		expect(result[0]?.id).toBe("edge-2");
	});

	it("should return all edges if ID not found", () => {
		const effect = removeEdge(mockEdges, "edge-999");
		const result = Effect.runSync(effect);

		expect(result).toHaveLength(2);
	});
});

describe("createValidatedEdge", () => {
	beforeEach(() => {
		vi.spyOn(Date, "now").mockReturnValue(1234567890);
	});

	it("should create new edge with default label", () => {
		const effect = createValidatedEdge([], "node-a", "node-b");
		const result = Effect.runSync(effect);

		expect(result.source).toBe("node-a");
		expect(result.target).toBe("node-b");
		expect(result.label).toBe("uses");
		expect(result.type).toBe("default");
		expect((result.data as EdgeData).createdAt).toBe(1234567890);
	});

	it("should create edge with custom label", () => {
		const effect = createValidatedEdge([], "node-a", "node-b", "sends data");
		const result = Effect.runSync(effect);

		expect(result.label).toBe("sends data");
	});

	it("should create unique edge IDs when multiple edges are created in the same millisecond", () => {
		const first = Effect.runSync(createValidatedEdge([], "node-a", "node-b", "uses"));
		const second = Effect.runSync(createValidatedEdge([first], "node-c", "node-d", "calls"));

		expect(first.id).not.toBe(second.id);
		expect(new Set([first.id, second.id]).size).toBe(2);
	});

	it("should fail for invalid connection", async () => {
		const existingEdges: Edge[] = [
			{
				id: "edge-1",
				source: "node-a",
				target: "node-b",
				label: "uses",
				type: "default",
			},
		];

		const effect = createValidatedEdge(existingEdges, "node-a", "node-b");
		await expect(Effect.runPromise(effect)).rejects.toThrow();
	});
});

describe("addValidatedEdge", () => {
	it("should add validated edge to edges array", () => {
		const existingEdges: Edge[] = [
			{
				id: "edge-1",
				source: "node-a",
				target: "node-b",
				label: "uses",
				type: "default",
			},
		];

		const effect = addValidatedEdge(existingEdges, "node-c", "node-d", "calls");
		const result = Effect.runSync(effect);

		expect(result).toHaveLength(2);
		expect(result[1]?.source).toBe("node-c");
		expect(result[1]?.target).toBe("node-d");
		expect(result[1]?.label).toBe("calls");
	});

	it("should fail and not add invalid edge", async () => {
		const existingEdges: Edge[] = [
			{
				id: "edge-1",
				source: "node-a",
				target: "node-b",
				label: "uses",
				type: "default",
			},
		];

		const effect = addValidatedEdge(existingEdges, "node-a", "node-a");
		await expect(Effect.runPromise(effect)).rejects.toThrow();
	});
});

describe("validateEdgeLabel", () => {
	it("should accept valid label", () => {
		const effect = validateEdgeLabel("sends data");
		const result = Effect.runSync(effect);

		expect(result).toBe("sends data");
	});

	it("should trim whitespace", () => {
		const effect = validateEdgeLabel("  sends data  ");
		const result = Effect.runSync(effect);

		expect(result).toBe("sends data");
	});

	it("should fail for empty label", async () => {
		const effect = validateEdgeLabel("");
		await expect(Effect.runPromise(effect)).rejects.toThrow("Edge label cannot be empty");
	});

	it("should fail for whitespace-only label", async () => {
		const effect = validateEdgeLabel("   ");
		await expect(Effect.runPromise(effect)).rejects.toThrow("Edge label cannot be empty");
	});

	it("should fail for label exceeding 100 characters", async () => {
		const longLabel = "x".repeat(101);
		const effect = validateEdgeLabel(longLabel);
		await expect(Effect.runPromise(effect)).rejects.toThrow("Edge label too long (max 100 characters)");
	});

	it("should accept label with exactly 100 characters", () => {
		const maxLabel = "x".repeat(100);
		const effect = validateEdgeLabel(maxLabel);
		const result = Effect.runSync(effect);

		expect(result).toBe(maxLabel);
	});
});

describe("updateEdgeLabel", () => {
	const mockEdges: Edge[] = [
		{
			id: "edge-1",
			source: "node-a",
			target: "node-b",
			label: "uses",
			type: "default",
		},
		{
			id: "edge-2",
			source: "node-b",
			target: "node-c",
			label: "sends",
			type: "default",
		},
	];

	it("should update edge label", () => {
		const effect = updateEdgeLabel(mockEdges, "edge-1", "calls");
		const result = Effect.runSync(effect);

		const updatedEdge = result.find((e) => e.id === "edge-1");
		expect(updatedEdge?.label).toBe("calls");
	});

	it("should not modify other edges", () => {
		const effect = updateEdgeLabel(mockEdges, "edge-1", "calls");
		const result = Effect.runSync(effect);

		const otherEdge = result.find((e) => e.id === "edge-2");
		expect(otherEdge?.label).toBe("sends");
	});

	it("should fail for non-existent edge", async () => {
		const effect = updateEdgeLabel(mockEdges, "edge-999", "new label");
		await expect(Effect.runPromise(effect)).rejects.toThrow("not found");
	});

	it("should fail for invalid label", async () => {
		const effect = updateEdgeLabel(mockEdges, "edge-1", "");
		await expect(Effect.runPromise(effect)).rejects.toThrow();
	});
});

describe("updateEdgeMetadata", () => {
	const mockEdges: Edge[] = [
		{
			id: "edge-1",
			source: "node-a",
			target: "node-b",
			label: "uses",
			type: "default",
			data: {
				createdAt: 1234567890,
				metadata: {
					protocol: "http" as const,
					requestVolume: 100,
				},
			} as EdgeData,
		},
	];

	it("should update edge metadata", () => {
		const effect = updateEdgeMetadata(mockEdges, "edge-1", {
			protocol: "grpc",
			latency: 50,
		});
		const result = Effect.runSync(effect);

		const updatedEdge = result.find((e) => e.id === "edge-1");
		const metadata = (updatedEdge?.data as EdgeData)?.metadata;
		expect(metadata?.protocol).toBe("grpc");
		expect(metadata?.latency).toBe(50);
		expect(metadata?.requestVolume).toBe(100); // Preserved
	});

	it("should create metadata if not present", () => {
		const edgeWithoutMeta: Edge[] = [
			{
				id: "edge-1",
				source: "node-a",
				target: "node-b",
				label: "uses",
				type: "default",
			},
		];

		const effect = updateEdgeMetadata(edgeWithoutMeta, "edge-1", {
			protocol: "https",
		});
		const result = Effect.runSync(effect);

		const updatedEdge = result.find((e) => e.id === "edge-1");
		const metadata = (updatedEdge?.data as EdgeData)?.metadata;
		expect(metadata?.protocol).toBe("https");
	});

	it("should fail for non-existent edge", async () => {
		const effect = updateEdgeMetadata(mockEdges, "edge-999", { protocol: "http" });
		await expect(Effect.runPromise(effect)).rejects.toThrow();
	});
});

describe("getEdgeStyle", () => {
	it("should return solid line for synchronous", () => {
		const style = getEdgeStyle("synchronous");
		expect(style).toBe(EDGE_STYLE_MAP.synchronous);
		expect(style).toBe("0");
	});

	it("should return dashed line for asynchronous", () => {
		const style = getEdgeStyle("asynchronous");
		expect(style).toBe(EDGE_STYLE_MAP.asynchronous);
		expect(style).toBe("5,5");
	});

	it("should return dotted line for optional", () => {
		const style = getEdgeStyle("optional");
		expect(style).toBe(EDGE_STYLE_MAP.optional);
		expect(style).toBe("2,2");
	});

	it("should return default solid line for undefined", () => {
		const style = getEdgeStyle(undefined);
		expect(style).toBe(EDGE_STYLE_MAP.synchronous);
	});
});

describe("getEdgeColor", () => {
	it("should return correct color for http", () => {
		const color = getEdgeColor("http");
		expect(color).toBe(PROTOCOL_COLOR_MAP.http);
		expect(color).toBe("#4CAF50");
	});

	it("should return correct color for grpc", () => {
		const color = getEdgeColor("grpc");
		expect(color).toBe(PROTOCOL_COLOR_MAP.grpc);
		expect(color).toBe("#1976D2");
	});

	it("should return correct color for kafka", () => {
		const color = getEdgeColor("kafka");
		expect(color).toBe(PROTOCOL_COLOR_MAP.kafka);
		expect(color).toBe("#00BCD4");
	});

	it("should return default gray for undefined", () => {
		const color = getEdgeColor(undefined);
		expect(color).toBe("#666666");
	});
});

describe("getEdgeThickness", () => {
	it("should return default thickness for no volume", () => {
		const thickness = getEdgeThickness(undefined);
		expect(thickness).toBe(2);
	});

	it("should return default thickness for zero volume", () => {
		const thickness = getEdgeThickness(0);
		expect(thickness).toBe(2);
	});

	it("should scale thickness logarithmically", () => {
		// Math.log10(5) * 2 + 2 = 1.4 * 2 + 2 = 3.4 = 3
		expect(getEdgeThickness(5)).toBe(3); // Low volume
		// Math.log10(50) * 2 + 2 = 1.7 * 2 + 2 = 5.4 = 5
		expect(getEdgeThickness(50)).toBe(5); // Medium volume
		// Math.log10(500) * 2 + 2 = 2.7 * 2 + 2 = 7.4 = 7
		expect(getEdgeThickness(500)).toBe(7); // High volume
		// Math.log10(5000) * 2 + 2 = 3.7 * 2 + 2 = 9.4 = 9
		expect(getEdgeThickness(5000)).toBe(9); // Very high volume
	});

	it("should cap thickness at 10", () => {
		const thickness = getEdgeThickness(1000000);
		expect(thickness).toBeLessThanOrEqual(10);
	});
});

describe("getEdgeAnimation", () => {
	it("should not animate for none", () => {
		const animation = getEdgeAnimation({ animationSpeed: "none" });
		expect(animation.animated).toBe(false);
		expect(animation.duration).toBeUndefined();
	});

	it("should animate slow", () => {
		const animation = getEdgeAnimation({ animationSpeed: "slow" });
		expect(animation.animated).toBe(true);
		expect(animation.duration).toBe(3000);
	});

	it("should animate medium", () => {
		const animation = getEdgeAnimation({ animationSpeed: "medium" });
		expect(animation.animated).toBe(true);
		expect(animation.duration).toBe(1500);
	});

	it("should animate fast", () => {
		const animation = getEdgeAnimation({ animationSpeed: "fast" });
		expect(animation.animated).toBe(true);
		expect(animation.duration).toBe(750);
	});

	it("should auto-calculate based on request volume", () => {
		const lowVolume = getEdgeAnimation({
			animationSpeed: "auto",
			requestVolume: 5,
		});
		expect(lowVolume.duration).toBe(3000);

		const mediumVolume = getEdgeAnimation({
			animationSpeed: "auto",
			requestVolume: 50,
		});
		expect(mediumVolume.duration).toBe(1500);

		const highVolume = getEdgeAnimation({
			animationSpeed: "auto",
			requestVolume: 500,
		});
		expect(highVolume.duration).toBe(750);

		const veryHighVolume = getEdgeAnimation({
			animationSpeed: "auto",
			requestVolume: 5000,
		});
		expect(veryHighVolume.duration).toBe(500);
	});

	it("should not animate for auto with no volume", () => {
		const animation = getEdgeAnimation({
			animationSpeed: "auto",
			requestVolume: 0,
		});
		expect(animation.animated).toBe(false);
	});

	it("should default to none for undefined metadata", () => {
		const animation = getEdgeAnimation(undefined);
		expect(animation.animated).toBe(false);
	});
});
