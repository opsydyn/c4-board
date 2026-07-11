import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LayoutPreviewStatusDrawer } from "./LayoutPreviewStatusDrawer";

describe("LayoutPreviewStatusDrawer", () => {
  it("offers retry and cancel when no valid fallback exists", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const onCancel = vi.fn();
    render(
      <LayoutPreviewStatusDrawer
        label="ELK Layered"
        error="Worker failed."
        onRetry={onRetry}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("STATUS::FAILED");
    expect(screen.getByText("Worker failed.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
