import { ScratchTabStrip } from "@/ui/components/postee/ScratchTabStrip";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const tabs = [
  { id: "scratch-a", label: "Untitled request", dirty: false },
  { id: "scratch-b", label: "Create user", dirty: true },
];

describe("ScratchTabStrip", () => {
  it("selects, closes, and reopens scratch tabs with keyboard navigation", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const onReopen = vi.fn();

    render(
      <ScratchTabStrip
        tabs={tabs}
        activeId="scratch-a"
        reopenable={[{ id: "scratch-closed", label: "Recovered request" }]}
        onSelect={onSelect}
        onClose={onClose}
        onReopen={onReopen}
      />,
    );

    await user.click(screen.getByRole("tab", { name: /Untitled request/i }));
    await user.keyboard("{ArrowRight}{Enter}");
    expect(onSelect).toHaveBeenCalledWith("scratch-b");

    onSelect.mockClear();
    await user.click(screen.getByRole("button", { name: "Close Untitled request" }));
    expect(onClose).toHaveBeenCalledWith("scratch-a");
    expect(onSelect).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Reopen drafts" }));
    await user.click(screen.getByRole("menuitem", { name: "Recovered request" }));
    expect(onReopen).toHaveBeenCalledWith("scratch-closed");
  });
});
