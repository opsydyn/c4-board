import { describe, expect, it } from "vitest";

import { buildRoutedEdgePath } from "./RoutedEdge";

describe("buildRoutedEdgePath", () => {
  it("renders ELK bend points as an orthogonal SVG path", () => {
    expect(buildRoutedEdgePath([{
      start: { x: 10, y: 20 },
      bends: [{ x: 10, y: 80 }, { x: 120, y: 80 }],
      end: { x: 120, y: 140 },
    }])).toBe("M 10 20 L 10 80 L 120 80 L 120 140");
  });
});
