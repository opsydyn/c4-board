import { Effect } from "effect";
import type { Node } from "@xyflow/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createGraphFixture } from "../../../tests/fixtures";
import { DEFAULT_ICON_BY_TYPE, type C4Type, type NodeData } from "./node-operations";


vi.mock("nanoid", () => ({ nanoid: vi.fn(() => "fixed-node-id") }));

const {
	createNode,
	determineNodePosition,
	createParentRelationship,
	updateNodeData,
} = await import("./node-operations");

const buildNodeData = (type: C4Type, overrides: Partial<NodeData> = {}): NodeData => {
	const { iconId, ...rest } = overrides;
	const baseData: NodeData = {
		label: `${type} node`,
		description: "",
		technology: "",
		c4Type: type,
		...rest,
	};
	
	// Only set iconId if it has a defined value
	if (iconId !== undefined) {
		baseData.iconId = iconId;
	} else if (DEFAULT_ICON_BY_TYPE[type] !== undefined) {
		baseData.iconId = DEFAULT_ICON_BY_TYPE[type];
	}
	
	return baseData;
};

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
	expect(node.data.iconId).toBe(DEFAULT_ICON_BY_TYPE.system);
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

describe("determineNodePosition", () => {
	it("returns default center for first node", () => {
		const position = Effect.runSync(
			determineNodePosition(0, null, [], "system"),
		);

		expect(position).toEqual({ x: 240, y: 200 });
	});

	it("places subsequent nodes on radial ring around existing graph", () => {
		const existingNodes: Node[] = [
			{
				id: "root-1",
				type: "system",
				position: { x: 0, y: 0 },
				data: buildNodeData("system"),
				measured: { width: 100, height: 80 },
			},
			{
				id: "root-2",
				type: "system",
				position: { x: 200, y: 0 },
				data: buildNodeData("system"),
				measured: { width: 100, height: 80 },
			},
			{
				id: "root-3",
				type: "system",
				position: { x: 0, y: 220 },
				data: buildNodeData("system"),
				measured: { width: 100, height: 80 },
			},
		];

		const position = Effect.runSync(
			determineNodePosition(1, null, existingNodes, "system"),
		);

		expect(position).toEqual({ x: 180, y: 300 });
	});
});

describe("createParentRelationship", () => {
	it("returns null when selected node is not a container", () => {
		const node = {
			id: "system-1",
			type: "system",
			position: { x: 0, y: 0 },
			data: buildNodeData("system"),
		} satisfies Node;

		const relationship = Effect.runSync(createParentRelationship(node));
		expect(relationship).toBeNull();
	});

	it("returns parent relationship for containers", () => {
		const container = {
			id: "container-1",
			type: "container",
			position: { x: 0, y: 0 },
			data: buildNodeData("container"),
		} satisfies Node;

		const relationship = Effect.runSync(createParentRelationship(container));

		expect(relationship).toEqual({
			parentId: "container-1",
			extent: "parent",
			expandParent: true,
		});
	});
});

describe("updateNodeData", () => {
	it("merges partial updates into node data", () => {
		const { nodes } = createGraphFixture();
		const [firstNode] = nodes;
		if (!firstNode) {
			throw new Error("Fixture must contain at least one node");
		}
		const targetId = firstNode.id;

		const updatedNodes = Effect.runSync(
			updateNodeData(nodes, targetId, { description: "Updated", technology: "Go" }),
		);

		const target = updatedNodes.find((node) => node.id === targetId) as Node;
		expect(target.data.description).toBe("Updated");
		expect(target.data.technology).toBe("Go");
		// unchanged fields remain
		expect(target.data.label).toBe(firstNode.data.label);
	});
});
