import { autoLayout } from "@/core/effects/layout";
import { TIMELINE_LANES, timelineLayout } from "@/core/effects/timeline-layout";
import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";

/**
 * ADR-016 Phase 3. The layout an event storm needs.
 *
 * Every existing preset ranks by dependency, which is exactly the shape Event
 * Storming exists to avoid drawing. Here edges are annotation, not structure, so
 * a layout that derives order from them fights the user every time they drag a
 * sticky earlier on the timeline.
 *
 * That is the property worth protecting, so it is asserted directly rather than
 * inferred from a tidy-looking result.
 */

const node = (id: string, type: string, x: number, over: Partial<Node> = {}): Node => ({
  id,
  type,
  position: { x, y: 0 },
  width: 180,
  height: 120,
  data: { label: id, description: "", technology: "", c4Type: undefined },
  ...over,
});

const xOrder = (laid: Node[]) => [...laid].sort((a, b) => a.position.x - b.position.x).map((n) => n.id);

describe("ordering", () => {
  it("orders events by where they already sit on the timeline", () => {
    const laid = timelineLayout(
      [node("third", "domainEvent", 900), node("first", "domainEvent", 100), node("second", "domainEvent", 500)],
      [],
    );

    expect(xOrder(laid)).toEqual(["first", "second", "third"]);
  });

  it("ignores edges, even when they imply a different order", () => {
    // The property that separates this from every other preset. A dependency
    // layout would put `late` first because everything points at it.
    const nodes = [
      node("early", "domainEvent", 100),
      node("late", "domainEvent", 900),
    ];
    const edges: Edge[] = [{ id: "e1", source: "late", target: "early" }];

    expect(xOrder(timelineLayout(nodes, edges))).toEqual(["early", "late"]);
  });

  it("disagrees with the dependency layout, which is why it exists", () => {
    // Without this the "ignores edges" test above proves nothing: it would pass
    // just as well if dagre happened to produce the same order anyway.
    const nodes = [node("early", "domainEvent", 100), node("late", "domainEvent", 900)];
    const edges: Edge[] = [{ id: "e1", source: "late", target: "early" }];

    expect(xOrder(autoLayout(nodes, edges, { direction: "LR" }))).toEqual(["late", "early"]);
    expect(xOrder(timelineLayout(nodes, edges))).toEqual(["early", "late"]);
  });

  it("spaces events evenly, so the wall reads as a sequence", () => {
    const laid = timelineLayout(
      [node("a", "domainEvent", 0), node("b", "domainEvent", 10), node("c", "domainEvent", 20)],
      [],
    );
    const xs = laid.map((n) => n.position.x).sort((a, b) => a - b);

    expect(xs[1]! - xs[0]!).toBe(xs[2]! - xs[1]!);
  });
});

describe("lanes", () => {
  it("puts each sticky in its own band, events on the backbone", () => {
    const laid = timelineLayout([
      node("h", "hotspot", 0),
      node("e", "domainEvent", 0),
      node("a", "person", 0),
      node("x", "externalSystem", 0),
      node("o", "opportunity", 0),
    ], []);

    const y = (id: string) => laid.find((n) => n.id === id)!.position.y;

    // Hotspots sit above the line because they interrupt the story.
    expect(y("h")).toBeLessThan(y("e"));
    // Everything else hangs below it.
    expect(y("a")).toBeGreaterThan(y("e"));
    expect(y("x")).toBeGreaterThan(y("a"));
    expect(y("o")).toBeGreaterThan(y("x"));
  });

  it("keeps a lane's own order independent of the others", () => {
    const laid = timelineLayout([
      node("e1", "domainEvent", 100),
      node("e2", "domainEvent", 900),
      node("h1", "hotspot", 900),
      node("h2", "hotspot", 100),
    ], []);

    const at = (id: string) => laid.find((n) => n.id === id)!.position.x;
    expect(at("e1")).toBeLessThan(at("e2"));
    expect(at("h2")).toBeLessThan(at("h1"));
  });

  it("gives a node it does not recognise a lane rather than dropping it", () => {
    // Losing a node from the canvas because the layout had no opinion about it
    // would be data loss the user can see.
    const laid = timelineLayout([node("odd", "aggregate", 0), node("e", "domainEvent", 0)], []);

    expect(laid).toHaveLength(2);
    expect(laid.find((n) => n.id === "odd")).toBeDefined();
  });
});

describe("pivotal events", () => {
  it("opens a gap after a pivotal event, marking the phase boundary", () => {
    const pivotal = node("p", "domainEvent", 500, {
      data: { label: "p", description: "", technology: "", isPivotal: true },
    });
    const laid = timelineLayout(
      [node("a", "domainEvent", 100), pivotal, node("b", "domainEvent", 900)],
      [],
    );

    const at = (id: string) => laid.find((n) => n.id === id)!.position.x;
    const beforeBoundary = at("p") - at("a");
    const acrossBoundary = at("b") - at("p");

    expect(acrossBoundary).toBeGreaterThan(beforeBoundary);
  });

  it("leaves spacing even when nothing is pivotal", () => {
    const laid = timelineLayout(
      [node("a", "domainEvent", 100), node("b", "domainEvent", 500), node("c", "domainEvent", 900)],
      [],
    );

    const at = (id: string) => laid.find((n) => n.id === id)!.position.x;
    expect(at("b") - at("a")).toBe(at("c") - at("b"));
  });

  it("ignores a pivotal flag on something that is not an event", () => {
    const laid = timelineLayout([
      node("a", "domainEvent", 100),
      node("h", "hotspot", 500, {
        data: { label: "h", description: "", technology: "", isPivotal: true },
      }),
      node("b", "domainEvent", 900),
    ], []);

    const at = (id: string) => laid.find((n) => n.id === id)!.position.x;
    expect(at("b") - at("a")).toBeGreaterThan(0);
  });
});

describe("edges and empties", () => {
  it("returns an empty board unchanged", () => {
    expect(timelineLayout([], [])).toEqual([]);
  });

  it("never mutates the nodes it was given", () => {
    const original = node("a", "domainEvent", 100);
    const before = { ...original.position };

    timelineLayout([original], []);

    expect(original.position).toEqual(before);
  });
});

describe("TIMELINE_LANES", () => {
  it("reads top to bottom as the wall does", () => {
    expect(TIMELINE_LANES).toEqual(["hotspot", "domainEvent", "person", "externalSystem", "opportunity"]);
  });
});

describe("as a layout strategy", () => {
  /**
   * Registered so the mode can select it in Phase 4. `analyse` reports whether it
   * is the right choice for a board, which is how a storm gets the timeline and a
   * C4 diagram does not.
   */
  it("is resolvable by id", async () => {
    const { resolveSynchronousLayoutStrategy } = await import("@/core/effects/layout-strategy-registry");
    const { TIMELINE_STRATEGY_ID } = await import("@/core/effects/timeline-layout-strategy");

    const resolved = resolveSynchronousLayoutStrategy(TIMELINE_STRATEGY_ID);

    expect(resolved.strategy.id).toBe(TIMELINE_STRATEGY_ID);
    // A silent fallback to dagre would give a storm a dependency layout.
    expect(resolved.diagnostics).toEqual([]);
  });

  it("claims boards made of event storming stickies", async () => {
    const { timelineLayoutStrategy } = await import("@/core/effects/timeline-layout-strategy");

    const analysis = timelineLayoutStrategy.analyse({
      nodes: [node("e", "domainEvent", 0), node("h", "hotspot", 0)],
      edges: [],
      options: {},
    });

    expect(analysis.applicable).toBe(true);
  });

  it("declines a board it would lay out wrongly", async () => {
    const { timelineLayoutStrategy } = await import("@/core/effects/timeline-layout-strategy");

    const analysis = timelineLayoutStrategy.analyse({
      nodes: [node("s", "system", 0), node("c", "container", 0)],
      edges: [],
      options: {},
    });

    expect(analysis.applicable).toBe(false);
    expect(analysis.reasons.join(" ")).toMatch(/event storming/i);
  });

  it("returns the laid-out board through the strategy interface", async () => {
    const { timelineLayoutStrategy } = await import("@/core/effects/timeline-layout-strategy");

    const result = timelineLayoutStrategy.layout({
      nodes: [node("late", "domainEvent", 900), node("early", "domainEvent", 100)],
      edges: [],
      options: {},
    });

    expect(xOrder(result.nodes)).toEqual(["early", "late"]);
    expect(result.strategyId).toBe(timelineLayoutStrategy.id);
  });
});
