import { Effect } from "effect";
import type { Node } from "@xyflow/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createGraphFixture } from "../../../tests/fixtures";

vi.mock("nanoid", () => ({ nanoid: vi.fn(() => "fixed-node-id") }));

const { createNode } = await import("./node-operations");

describe("createNode", () => {
	const fixedNow = new Date("2024-01-01T00:00:00.000Z").getTime();

	beforeEach(() => {
		vi.spyOn(Date, "now").mockReturnValue(fixedNow);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("creates a system node with default properties when no context exists", () => {
		const effect = createNode({
			type: "system",
			label: "",
			nodeCounter: 0,
			selectedNodeId: null,
			existingNodes: [],
		});

		const node = Effect.runSync(effect);

		expect(node.id).toBe("system-fixed-node-id");
		expect(node.type).toBe("system");
		expect(node.position).toEqual({ x: 240, y: 200 });
		expect(node.data.label).toBe("New System");
		expect(node.data.createdAt).toBe(fixedNow);
		expect(node).not.toHaveProperty("parentId");
	});

	it("creates a child component inside a selected container", () => {
		const { nodes: baseNodes } = createGraphFixture();
		const container = baseNodes.find((n) => n.type === "container") as Node;

		const effect = createNode({
			type: "component",
			label: "Telemetry Worker",
			nodeCounter: 3,
			selectedNodeId: container.id,
			existingNodes: baseNodes,
		});

		const node = Effect.runSync(effect);

		expect(node.parentId).toBe(container.id);
		expect(node.extent).toBe("parent");
		expect(node.expandParent).toBe(true);
		expect(node.position).toEqual({ x: 20, y: 60 });
		expect(node.data.label).toBe("Telemetry Worker");
	});
});
