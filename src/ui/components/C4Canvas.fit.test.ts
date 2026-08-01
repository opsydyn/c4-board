import { describe, expect, it } from "vitest";

import { getLayoutVisualFixture } from "@/core/effects/layout-visual-fixtures";

import { resolveCanvasFitNodeIds, resolveCanvasViewportChrome } from "./C4Canvas";

describe("C4Canvas viewport fitting", () => {
  /**
   * A board can be larger than ReactFlow's default 0.5 zoom floor can show.
   *
   * One synced board spanned roughly 11,000 by 10,800 units, mostly because a
   * few hand-drawn nodes sat far from everything else. Fitting it needs about
   * 0.1, so `fitView` clamped at 0.5 and settled over an empty region — the
   * board loaded, the minimap drew it, and the canvas showed grid. The floor
   * was already lowered for harness captures; there was no reason a board a
   * person is looking at should be held to a stricter one.
   */
  it("lets an ordinary board zoom out far enough to fit a large graph", () => {
    expect(resolveCanvasViewportChrome(false)).toEqual({
      minZoom: 0.1,
      showMiniMap: true,
    });
  });

  it("uses capture-only viewport chrome for visual harness previews", () => {
    expect(resolveCanvasViewportChrome(true)).toEqual({
      minZoom: 0.1,
      showMiniMap: false,
    });
  });

  it("fits the detail fixture to the event flow without mutating its complete graph", () => {
    const fixture = getLayoutVisualFixture("event-driven-bridges-detail");
    const nodesBeforeFit = structuredClone(fixture.nodes);
    const edgesBeforeFit = structuredClone(fixture.edges);

    const fitNodeIds = resolveCanvasFitNodeIds(fixture.nodes, fixture.viewportFitNodeIds);

    expect(fitNodeIds).toEqual([
      "orders-publisher",
      "a-bus",
      "b-bus",
      "c-bus",
      "a-local",
      "a-to-b",
      "a-to-c",
      "b-to-c",
      "a-subscriber",
      "b-subscriber",
      "c-subscriber",
    ]);
    expect(fixture.nodes).toEqual(nodesBeforeFit);
    expect(fixture.edges).toEqual(edgesBeforeFit);
  });

  it("fits the complete graph when no explicit fit nodes are supplied", () => {
    const fixture = getLayoutVisualFixture("event-driven-bridges");

    expect(resolveCanvasFitNodeIds(fixture.nodes)).toEqual(fixture.nodes.map(({ id }) => id));
  });
});
