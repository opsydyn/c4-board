import { describe, expect, it, vi } from "vitest";

import {
  scheduleCanvasGraphFit,
  shouldRevealNodeDetails,
} from "./C4CanvasContainer";

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

describe("canvas card node-details reveal policy", () => {
  it("reveals node details for a normal desktop canvas selection", () => {
    expect(shouldRevealNodeDetails({
      isCompactLayout: false,
      hasLayoutPreview: false,
      hasLayoutPreviewStatus: false,
    })).toBe(true);
  });

  it("suppresses node details in compact layout", () => {
    expect(shouldRevealNodeDetails({
      isCompactLayout: true,
      hasLayoutPreview: false,
      hasLayoutPreviewStatus: false,
    })).toBe(false);
  });

  it("suppresses node details while a layout preview is active", () => {
    expect(shouldRevealNodeDetails({
      isCompactLayout: false,
      hasLayoutPreview: true,
      hasLayoutPreviewStatus: false,
    })).toBe(false);
  });

  it("suppresses node details while a layout preview is resolving", () => {
    expect(shouldRevealNodeDetails({
      isCompactLayout: false,
      hasLayoutPreview: false,
      hasLayoutPreviewStatus: true,
    })).toBe(false);
  });
});
