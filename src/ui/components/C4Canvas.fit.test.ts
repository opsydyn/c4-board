import { describe, expect, it } from "vitest";

import { getLayoutVisualFixture } from "@/core/effects/layout-visual-fixtures";

import { resolveCanvasFitNodeIds, resolveCanvasViewportChrome } from "./C4Canvas";

describe("C4Canvas viewport fitting", () => {
  it("keeps the normal canvas chrome for editable and read-only board views", () => {
    expect(resolveCanvasViewportChrome(false)).toEqual({
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
