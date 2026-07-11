import { describe, expect, it } from "vitest";

import { getLayoutVisualFixture, isLayoutVisualFixtureName } from "@/core/effects/layout-visual-fixtures";

describe("layout visual fixtures", () => {
  it.each(["event-driven", "client-server", "hexagonal-inferred", "hexagonal-corrected"] as const)(
    "clones the %s fixture",
    (name) => {
      const first = getLayoutVisualFixture(name);
      const second = getLayoutVisualFixture(name);

      expect(first.name).toBe(name);
      expect(first.nodes.length).toBeGreaterThan(0);
      expect(first.edges.length).toBeGreaterThan(0);
      expect(first.nodes).not.toBe(second.nodes);
      expect(first.nodes[0]).not.toBe(second.nodes[0]);
    },
  );

  it("accepts only supported fixture names", () => {
    expect(isLayoutVisualFixtureName("event-driven")).toBe(true);
    expect(isLayoutVisualFixtureName("client-server")).toBe(true);
    expect(isLayoutVisualFixtureName("hexagonal-inferred")).toBe(true);
    expect(isLayoutVisualFixtureName("hexagonal-corrected")).toBe(true);
    expect(isLayoutVisualFixtureName("user-board")).toBe(false);
  });

  it("selects Hexagonal and preserves explicit corrected roles", () => {
    const inferred = getLayoutVisualFixture("hexagonal-inferred");
    const corrected = getLayoutVisualFixture("hexagonal-corrected");

    expect(inferred.preset).toBe("hexagonal");
    expect(corrected.preset).toBe("hexagonal");
    expect(corrected.nodes.find(node => node.id === "event-adapter")?.data.layoutRole)
      .toBe("outbound-adapter");
    expect(corrected.nodes.find(node => node.id === "telemetry")?.data.layoutRole)
      .toBe("infrastructure");
  });
});
