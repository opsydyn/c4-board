import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_ICON_BY_TYPE } from "../../../core/effects/node-operations";
import { describe, expect, it, vi } from "vitest";

const mockDatabase = {
	runEffect: vi.fn(),
};

vi.mock("../../../core/effects/useDatabase", () => ({
	useDatabase: () => mockDatabase,
}));


describe("IconPicker", () => {
	it("allows selecting an icon option and closes the dialog", async () => {
		const handleChange = vi.fn();
		const { IconPicker } = await import("./IconPicker");

		render(
			<IconPicker
				type="system"
				value={DEFAULT_ICON_BY_TYPE.system}
				onChange={handleChange}
			/>,
		);
		const user = userEvent.setup();

		const trigger = screen.getByRole("button", { name: /select icon/i });
		await user.click(trigger);

		const dialog = await screen.findByRole("dialog", { name: /select node icon/i }, { timeout: 3000 });

		const componentButton = within(dialog).getByRole("button", {
			name: "Component",
		});

		await user.click(componentButton);

		expect(handleChange).toHaveBeenCalledWith("phosphor:cube-duotone");

		await screen.findByRole("button", { name: /select icon/i }, { timeout: 3000 });
		expect(screen.queryByRole("dialog", { name: /select node icon/i })).toBeNull();
	}, 10000);

	it("resets to the default icon when requested", async () => {
		const handleChange = vi.fn();
		const handleReset = vi.fn();
		const { IconPicker } = await import("./IconPicker");

		render(
			<IconPicker
				type="system"
				value="phosphor:cube-duotone"
				onChange={handleChange}
				onReset={handleReset}
			/>,
		);
		const user = userEvent.setup();

		const trigger = screen.getByRole("button", { name: /select icon/i });
		await user.click(trigger);

		const dialog = await screen.findByRole("dialog", { name: /select node icon/i }, { timeout: 3000 });
		const resetButton = within(dialog).getByRole("button", {
			name: /reset to default/i,
		});

		await user.click(resetButton);

		expect(handleChange).toHaveBeenCalledWith(DEFAULT_ICON_BY_TYPE.system);
		expect(handleReset).toHaveBeenCalledTimes(1);
	}, 10000);
});
