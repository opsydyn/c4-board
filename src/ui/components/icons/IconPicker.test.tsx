import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("./IconPicker.css", () => ({
	pickerContainer: "pickerContainer",
	trigger: "trigger",
	triggerIcon: "triggerIcon",
	popoverContent: "popoverContent",
	quickFilterRow: "quickFilterRow",
	searchInput: "searchInput",
	iconGrid: "iconGrid",
	iconButton: "iconButton",
	footerRow: "footerRow",
	footerButton: "footerButton",
	helperRow: "helperRow",
	sectionHeading: "sectionHeading",
	statusText: "statusText",
	errorText: "errorText",
}));

const mockDatabase = {
	runEffect: vi.fn(),
};

vi.mock("../../../core/effects/useDatabase", () => ({
	useDatabase: () => mockDatabase,
}));

let IconPicker: (typeof import("./IconPicker"))["IconPicker"];

beforeAll(async () => {
	const module = await import("./IconPicker");
	IconPicker = module.IconPicker;
});
import { DEFAULT_ICON_BY_TYPE } from "../../../core/effects/node-operations";

describe("IconPicker", () => {
	it("allows selecting an icon option and closes the dialog", async () => {
		const handleChange = vi.fn();
		const user = userEvent.setup({ document: globalThis.document as Document });

		render(
			<IconPicker
				type="system"
				value={DEFAULT_ICON_BY_TYPE.system}
				onChange={handleChange}
			/>,
		);

		const trigger = screen.getByRole("button", { name: /select icon/i });
		await user.click(trigger);

		const dialog = await screen.findByRole("dialog", { name: /select node icon/i });
		
		const componentButton = within(dialog).getByRole("button", {
			name: "Component",
		});

		await user.click(componentButton);

		expect(handleChange).toHaveBeenCalledWith("phosphor:cube-duotone");

		await screen.findByRole("button", { name: /select icon/i });
		expect(
			screen.queryByRole("dialog", { name: /select node icon/i }),
		).not.toBeInTheDocument();
	});

	it("resets to the default icon when requested", async () => {
		const handleChange = vi.fn();
		const handleReset = vi.fn();
		const user = userEvent.setup({ document: globalThis.document as Document });

		render(
			<IconPicker
				type="system"
				value="phosphor:cube-duotone"
				onChange={handleChange}
				onReset={handleReset}
			/>,
		);

		const trigger = screen.getByRole("button", { name: /select icon/i });
		await user.click(trigger);

		const dialog = await screen.findByRole("dialog", { name: /select node icon/i });
		const resetButton = within(dialog).getByRole("button", {
			name: /reset to default/i,
		});

		await user.click(resetButton);

		expect(handleChange).toHaveBeenCalledWith(DEFAULT_ICON_BY_TYPE.system);
		expect(handleReset).toHaveBeenCalledTimes(1);
	});
});
