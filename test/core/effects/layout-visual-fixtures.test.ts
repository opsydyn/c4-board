import { describe, expect, it } from "vitest";

import { calculateLayout, getPreset } from "@/core/effects/layout";
import { getLayoutVisualFixture, isLayoutVisualFixtureName } from "@/core/effects/layout-visual-fixtures";

describe("layout visual fixtures", () => {
  it.each(
    [
      "event-driven",
      "event-driven-bridges",
      "event-driven-bridges-detail",
      "client-server-inferred",
      "client-server-corrected",
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
      expect(first.nodes[0]?.data).not.toBe(second.nodes[0]?.data);
    },
  );

  it("accepts only supported fixture names", () => {
    expect(isLayoutVisualFixtureName("event-driven")).toBe(true);
    expect(isLayoutVisualFixtureName("event-driven-bridges")).toBe(true);
    expect(isLayoutVisualFixtureName("event-driven-bridges-detail")).toBe(true);
    expect(isLayoutVisualFixtureName("client-server-inferred")).toBe(true);
    expect(isLayoutVisualFixtureName("client-server-corrected")).toBe(true);
    expect(isLayoutVisualFixtureName("hexagonal-inferred")).toBe(true);
    expect(isLayoutVisualFixtureName("hexagonal-corrected")).toBe(true);
    expect(isLayoutVisualFixtureName("user-board")).toBe(false);
  });

  it("keeps inferred and corrected Client-Server fixtures structurally identical", () => {
    const inferred = getLayoutVisualFixture("client-server-inferred");
    const corrected = getLayoutVisualFixture("client-server-corrected");
    const nodeIds = (fixture: typeof inferred) => fixture.nodes.map(({ id }) => id).sort();
    const edgeIds = (fixture: typeof inferred) => fixture.edges.map(({ id }) => id).sort();
    const inferredDecision = inferred.nodes.find(({ id }) => id === "decision-module");
    const correctedDecision = corrected.nodes.find(({ id }) => id === "decision-module");

    expect(inferred.preset).toBe("clientServer");
    expect(corrected.preset).toBe("clientServer");
    expect(nodeIds(corrected)).toEqual(nodeIds(inferred));
    expect(edgeIds(corrected)).toEqual(edgeIds(inferred));
    expect(inferredDecision?.data.layoutRole).toBeUndefined();
    expect(correctedDecision?.data.layoutRole).toBe("domain");

    const normalized = (fixture: typeof inferred) =>
      fixture.nodes.map((fixtureNode) => {
        if (fixtureNode.id !== "decision-module") return fixtureNode;
        const { layoutRole: _layoutRole, ...data } = fixtureNode.data;
        return { ...fixtureNode, data };
      });
    expect(normalized(corrected)).toEqual(normalized(inferred));
  });

  it("moves the corrected node while preserving primary-column positions and exact external support centring", () => {
    const inferredFixture = getLayoutVisualFixture("client-server-inferred");
    const correctedFixture = getLayoutVisualFixture("client-server-corrected");
    const renderedDimensions = {
      "api-server": { width: 200, height: 150 },
      "customer-domain": { width: 240, height: 160 },
      "identity-provider": { width: 220, height: 100 },
    } as const;
    const expectRenderedDimensions = (fixture: typeof inferredFixture) => {
      for (const [id, dimensions] of Object.entries(renderedDimensions)) {
        const style = fixture.nodes.find(node => node.id === id)?.style;
        expect(style?.width).toBe(dimensions.width);
        expect(style?.height).toBe(dimensions.height);
      }
    };
    const inferred = calculateLayout(
      inferredFixture.nodes,
      inferredFixture.edges,
      getPreset(inferredFixture.preset),
    );
    const corrected = calculateLayout(
      correctedFixture.nodes,
      correctedFixture.edges,
      getPreset(correctedFixture.preset),
    );
    const position = (result: typeof inferred, id: string) => result.nodes.find(node => node.id === id)!.position;
    const centreX = (
      result: typeof inferred,
      id: keyof typeof renderedDimensions,
    ) => {
      return position(result, id).x + renderedDimensions[id].width / 2;
    };

    expectRenderedDimensions(inferredFixture);
    expectRenderedDimensions(correctedFixture);
    expect(inferred.semanticRoles?.find(({ nodeId }) => nodeId === "decision-module")?.role)
      .toBe("unclassified");
    expect(corrected.semanticRoles?.find(({ nodeId }) => nodeId === "decision-module")?.role)
      .toBe("domain");
    expect(position(corrected, "decision-module")).not.toEqual(position(inferred, "decision-module"));
    expect(centreX(inferred, "identity-provider")).toBe(centreX(inferred, "api-server"));
    expect(centreX(corrected, "identity-provider")).toBe(centreX(corrected, "api-server"));

    for (
      const id of [
        "web-client",
        "mobile-client",
        "api-server",
        "customer-domain",
        "customer-repository",
      ]
    ) {
      expect(position(corrected, id)).toEqual(position(inferred, id));
    }
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

    const representativeEdges = new Set(
      representative.edges.map(({ source, target }) => `${source}->${target}`),
    );
    expect(representativeEdges.has("orders-publisher->event-bus")).toBe(true);
    expect(representativeEdges.has("billing-publisher->event-bus")).toBe(true);
    expect(representativeEdges.has("event-bus->fulfilment-processor")).toBe(true);
    expect(representativeEdges.has("event-bus->analytics-subscriber")).toBe(true);
    expect(representativeEdges.has("event-bus->notifications-subscriber")).toBe(true);
  });

  it("keeps the bridge detail fixture clone-isolated while preserving the complete graph", () => {
    const complete = getLayoutVisualFixture("event-driven-bridges");
    const detail = getLayoutVisualFixture("event-driven-bridges-detail");

    expect(detail.preset).toBe("eventDriven");
    expect(detail.nodes).toHaveLength(14);
    expect(detail.edges).toHaveLength(15);
    expect(detail.nodes).toEqual(complete.nodes);
    expect(detail.edges).toEqual(complete.edges);
    expect(detail.nodes).not.toBe(complete.nodes);
    expect(detail.edges).not.toBe(complete.edges);

    detail.nodes[0]!.data.label = "detail-only";
    detail.edges[0]!.label = "detail-only";

    expect(complete.nodes[0]!.data.label).toBe("orders-publisher");
    expect(complete.edges[0]!.label).toBe("order accepted");
  });
});
