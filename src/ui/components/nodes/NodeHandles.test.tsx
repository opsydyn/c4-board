import { render } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import { NodeHandles } from "./NodeHandles";

describe("NodeHandles", () => {
  it("exposes every source and target side while keeping reverse anchors non-interactive", () => {
    const { container } = render(
      <ReactFlowProvider>
        <NodeHandles />
      </ReactFlowProvider>,
    );

    expect(container.querySelectorAll(".react-flow__handle")).toHaveLength(8);
    expect(container.querySelectorAll(".source")).toHaveLength(4);
    expect(container.querySelectorAll(".target")).toHaveLength(4);
    expect(container.querySelectorAll(".connectable")).toHaveLength(4);
  });
});
