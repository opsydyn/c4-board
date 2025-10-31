import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IconPicker } from "./IconPicker";
import { DEFAULT_ICON_BY_TYPE } from "../../../core/effects/node-operations";

describe("IconPicker", () => {
	it("allows selecting an icon option and closes the dialog", async () => {
		const handleChange = vi.fn();
		const user = userEvent.setup();

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
		const user = userEvent.setup();

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
