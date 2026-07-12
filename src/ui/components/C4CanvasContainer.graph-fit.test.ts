import { describe, expect, it, vi } from "vitest";

import { scheduleCanvasGraphFit } from "./C4CanvasContainer";

describe("layout preview graph fitting", () => {
  it("fits after the graph transition has reached the next animation frame", () => {
    const fitViewToGraph = vi.fn();
    const requestFrame = vi.fn<(callback: FrameRequestCallback) => number>();
    requestFrame.mockImplementation((callback) => {
      callback(0);
      return 1;
    });

    scheduleCanvasGraphFit({ current: { fitViewToGraph } }, requestFrame);

    expect(requestFrame).toHaveBeenCalledOnce();
    expect(fitViewToGraph).toHaveBeenCalledOnce();
  });
});
