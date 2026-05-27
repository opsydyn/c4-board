import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_ICON_BY_TYPE } from "../../../core/effects/node-operations";
import { IconPicker } from "./IconPicker";

const mockDatabase = {
  runEffect: vi.fn(),
};

vi.mock("../../../core/effects/useDatabase", () => ({
  useDatabase: () => mockDatabase,
}));

describe("IconPicker", () => {
  it("allows selecting an icon option and closes the dialog", async () => {
    const handleChange = vi.fn();

    render(
      <IconPicker
        type="system"
        value={DEFAULT_ICON_BY_TYPE.system}
        onChange={handleChange}
      />,
    );

    const trigger = screen.getByRole("button", { name: /select icon/i });
    fireEvent.click(trigger);

    const dialog = await waitFor(() => screen.getByRole("dialog", { name: /select node icon/i }));

    const componentButton = within(dialog).getByRole("button", {
      name: "Component",
    });

    fireEvent.click(componentButton);

    expect(handleChange).toHaveBeenCalledWith("phosphor:cube-duotone");

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /select node icon/i })).toBeNull();
    });
  }, 10000);

  it("resets to the default icon when requested", async () => {
    const handleChange = vi.fn();
    const handleReset = vi.fn();

    render(
      <IconPicker
        type="system"
        value="phosphor:cube-duotone"
        onChange={handleChange}
        onReset={handleReset}
      />,
    );

    const trigger = screen.getByRole("button", { name: /select icon/i });
    fireEvent.click(trigger);

    const dialog = await waitFor(() => screen.getByRole("dialog", { name: /select node icon/i }));
    const resetButton = within(dialog).getByRole("button", {
      name: /reset to default/i,
    });

    fireEvent.click(resetButton);

    expect(handleChange).toHaveBeenCalledWith(DEFAULT_ICON_BY_TYPE.system);
    expect(handleReset).toHaveBeenCalledTimes(1);
  }, 10000);
});
