import { describe, expect, it } from "vitest";
import { StackIcon, PackageIcon } from "@phosphor-icons/react";
import {
	getNodeIconComponent,
	resolveNodeIconId,
} from "./nodeIcons";
import {
	DEFAULT_ICON_BY_TYPE,
	type NodeIconId,
} from "../../core/effects/node-operations";

describe("resolveNodeIconId", () => {
	it("falls back to the default icon for the node type when value is missing", () => {
		const result = resolveNodeIconId(undefined, "container");
		expect(result).toBe(DEFAULT_ICON_BY_TYPE.container);
	});

	it("returns the provided icon id when present", () => {
		const result = resolveNodeIconId("phosphor:user-duotone", "person");
		expect(result).toBe("phosphor:user-duotone");
	});
});

describe("getNodeIconComponent", () => {
	it("returns the registered icon component when available", () => {
		const Component = getNodeIconComponent("phosphor:stack-duotone", "container");
		expect(Component).toBe(StackIcon);
	});

	it("returns the fallback icon component when id is unregistered", () => {
		const Component = getNodeIconComponent(
			"phosphor:nonexistent" as NodeIconId,
			"system",
		);
		expect(Component).toBe(PackageIcon);
	});
});
