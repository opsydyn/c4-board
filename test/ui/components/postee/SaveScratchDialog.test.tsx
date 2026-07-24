import type { PosteeCollection } from "@/core/effects/database.postee";
import { SaveScratchDialog } from "@/ui/components/postee/SaveScratchDialog";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const collections: PosteeCollection[] = [
  {
    id: "collection-a",
    name: "Platform API",
    description: null,
    sort_order: 0,
    created_at: 1,
    updated_at: 1,
  },
];

describe("SaveScratchDialog", () => {
  it("requires a collection before promoting a scratch", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <SaveScratchDialog
        isOpen
        collections={collections}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Save request" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Save request" })).toBeDisabled();

    await user.click(screen.getByRole("option", { name: "Platform API" }));
    await user.click(screen.getByRole("button", { name: "Save request" }));

    expect(onConfirm).toHaveBeenCalledWith("collection-a");
  });

  it("clears the collection choice when the dialog closes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <SaveScratchDialog
        isOpen
        collections={collections}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("option", { name: "Platform API" }));
    rerender(<SaveScratchDialog isOpen={false} collections={collections} onClose={vi.fn()} onConfirm={vi.fn()} />);
    rerender(<SaveScratchDialog isOpen collections={collections} onClose={vi.fn()} onConfirm={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Save request" })).toBeDisabled();
  });
});
