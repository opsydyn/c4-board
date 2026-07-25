import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OpyDrawer } from "./OpyDrawer";

describe("OpyDrawer", () => {
  it("renders OPY content inside the side drawer shell", () => {
    render(
      <OpyDrawer
        diagramName="Payments Board"
        nodeCount={4}
        edgeCount={3}
        chromeTone="ready"
        onCollapse={() => {}}
        onSwitchToFloating={() => {}}
      >
        <div>OPY panel content</div>
      </OpyDrawer>,
    );

    expect(screen.getByRole("region", { name: "OPY drawer" })).toBeInTheDocument();
    expect(screen.getByText("OPY panel content")).toBeInTheDocument();
    expect(screen.getByText("PAYMENTS BOARD")).toBeInTheDocument();
    expect(screen.getByText("NODES::4")).toBeInTheDocument();
    expect(screen.getByText("EDGES::3")).toBeInTheDocument();
  });

  it("collapses and switches to floating mode through explicit controls", async () => {
    const user = userEvent.setup();
    const onCollapse = vi.fn();
    const onSwitchToFloating = vi.fn();

    render(
      <OpyDrawer
        diagramName="Board"
        nodeCount={0}
        edgeCount={0}
        chromeTone="caution"
        onCollapse={onCollapse}
        onSwitchToFloating={onSwitchToFloating}
      >
        <div>OPY panel content</div>
      </OpyDrawer>,
    );

    await user.click(screen.getByRole("button", { name: "Collapse OPY drawer" }));
    await user.click(screen.getByRole("button", { name: "Switch OPY to floating mode" }));

    expect(onCollapse).toHaveBeenCalledTimes(1);
    expect(onSwitchToFloating).toHaveBeenCalledTimes(1);
  });

  it("uses an untitled fallback and supports neutral chrome tone", () => {
    render(
      <OpyDrawer
        diagramName="   "
        nodeCount={1}
        edgeCount={2}
        chromeTone="neutral"
        onCollapse={() => {}}
        onSwitchToFloating={() => {}}
      >
        <div>OPY panel content</div>
      </OpyDrawer>,
    );

    const drawer = screen.getByRole("region", { name: "OPY drawer" });
    expect(drawer).toHaveAttribute("data-chrome-tone", "neutral");
    expect(screen.getByText("UNTITLED BOARD")).toBeInTheDocument();
  });
});
