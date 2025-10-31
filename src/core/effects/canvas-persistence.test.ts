import { describe, expect, it } from "vitest";
import type { Node as ReactFlowNode } from "@xyflow/react";
import {
	dbNodeToReactFlow,
	reactFlowNodeToDb,
} from "./canvas-persistence";
import {
	DEFAULT_ICON_BY_TYPE,
	type NodeIconId,
} from "./node-operations";
import type { Node as DbNode } from "./database";

describe("reactFlowNodeToDb", () => {
	it("preserves an explicit iconId from the node data", () => {
		const reactNode: ReactFlowNode = {
			id: "node-1",
			type: "system",
			position: { x: 10, y: 20 },
			data: {
				label: "API Gateway",
				c4Type: "system",
				iconId: "phosphor:cloud-duotone",
			},
		};

		const result = reactFlowNodeToDb(reactNode, "diagram-1");

		expect(result.icon_id).toBe("phosphor:cloud-duotone");
	});

	it("applies the default icon for the node type when none is provided", () => {
		const reactNode: ReactFlowNode = {
			id: "node-2",
			type: "container",
			position: { x: 0, y: 0 },
			data: {
				label: "Web App",
				c4Type: "container",
			},
		};

		const result = reactFlowNodeToDb(reactNode, "diagram-1");

		expect(result.icon_id).toBe(DEFAULT_ICON_BY_TYPE.container);
	});
});

describe("dbNodeToReactFlow", () => {
	it("falls back to the default icon when the database value is null", () => {
		const dbNode: DbNode = {
			id: "node-3",
			diagram_id: "diagram-1",
			type: "component",
			label: "Telemetry Worker",
			technology: null,
			description: null,
			position_x: 100,
			position_y: 200,
			width: null,
			height: null,
			parent_id: null,
			extent: null,
			expand_parent: 0,
			icon_id: null,
			created_at: 1,
			updated_at: 2,
		};

		const result = dbNodeToReactFlow(dbNode);

		expect(result.data?.iconId).toBe(DEFAULT_ICON_BY_TYPE.component);
	});

	it("hydrates the iconId from the database value when present", () => {
		const iconId = "phosphor:user-duotone" as NodeIconId;
		const dbNode: DbNode = {
			id: "node-4",
			diagram_id: "diagram-1",
			type: "person",
			label: "Operator",
			technology: null,
			description: null,
			position_x: 42,
			position_y: 24,
			width: null,
			height: null,
			parent_id: null,
			extent: null,
			expand_parent: 0,
			icon_id: iconId,
			created_at: 1,
			updated_at: 2,
		};

		const result = dbNodeToReactFlow(dbNode);

		expect(result.data?.iconId).toBe(iconId);
	});
});
