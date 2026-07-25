import { Drawer } from "@/ui/components/postee/Drawer";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * ADR-011 Phase 3. History overlays rather than competing for pane width, so the
 * drawer must be dismissible without hunting for a control — Escape and a close
 * button both — and must not leave its content in the tree when shut.
 */

describe("Drawer", () => {
  it("shows its title and content when open", () => {
    render(
      <Drawer isOpen title="Execution History" onClose={vi.fn()}>
        <p>Twelve requests</p>
      </Drawer>,
    );

    expect(screen.getByRole("dialog", { name: "Execution History" })).toBeInTheDocument();
    expect(screen.getByText("Twelve requests")).toBeInTheDocument();
  });

  it("renders nothing while closed", () => {
    render(
      <Drawer isOpen={false} title="Execution History" onClose={vi.fn()}>
        <p>Twelve requests</p>
      </Drawer>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Twelve requests")).not.toBeInTheDocument();
  });

  it("closes on the close control", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Drawer isOpen title="Execution History" onClose={onClose}>
        <p>content</p>
      </Drawer>,
    );

    await user.click(screen.getByRole("button", { name: /close/i }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Drawer isOpen title="Execution History" onClose={onClose}>
        <p>content</p>
      </Drawer>,
    );

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
  });
});
