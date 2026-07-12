import { describe, expect, it } from "vitest";

import { getLayoutVisualFixture, isLayoutVisualFixtureName } from "@/core/effects/layout-visual-fixtures";

describe("layout visual fixtures", () => {
  it.each(
    [
      "event-driven",
      "event-driven-bridges",
      "client-server",
      "hexagonal-inferred",
      "hexagonal-corrected",
    ] as const,
  )(
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
    expect(isLayoutVisualFixtureName("event-driven-bridges")).toBe(true);
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

  it("selects custom Event-Driven layouts and preserves bridge roles", () => {
    const representative = getLayoutVisualFixture("event-driven");
    const bridges = getLayoutVisualFixture("event-driven-bridges");
    const roles = Object.fromEntries(bridges.nodes.map(node => [node.id, node.data.layoutRole]));

    expect(representative.preset).toBe("eventDriven");
    expect(bridges.preset).toBe("eventDriven");
    expect(Object.values(roles).filter(role => role === "event-bus")).toHaveLength(3);
    expect(roles).toMatchObject({
      "a-to-b": "processor",
      "a-to-c": "processor",
      "b-to-c": "processor",
      "a-local": "processor",
      telemetry: "infrastructure",
      "external-monitor": "external-dependency",
      "review-node": "unclassified",
    });

    const edges = new Set(bridges.edges.map(({ source, target }) => `${source}->${target}`));
    expect(edges.has("a-bus->a-to-b")).toBe(true);
    expect(edges.has("a-to-b->b-bus")).toBe(true);
    expect(edges.has("a-bus->a-to-c")).toBe(true);
    expect(edges.has("a-to-c->c-bus")).toBe(true);
    expect(edges.has("b-bus->b-to-c")).toBe(true);
    expect(edges.has("b-to-c->c-bus")).toBe(true);
  });
});
