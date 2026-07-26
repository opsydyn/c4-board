import { EVENT_STORMING_STICKIES } from "@/core/effects/event-storming";
import { nodeTypesForDomain } from "@/ui/components/nodes/nodeTypesByDomain";
import { StickyNode } from "@/ui/components/nodes/StickyNode";
import { describe, expect, it } from "vitest";

/**
 * ADR-016 Phase 4a. Which component draws a node, per domain.
 *
 * The three types a storm shares with C4 and DDD are a Shared Kernel: one
 * `domainEvent`, one row, one CHECK constraint, so a storm can be promoted into a
 * DDD model without translating anything. That sharing is deliberate and worth
 * keeping small.
 *
 * What must *not* be shared is the drawing. A single renderer serving three
 * vocabularies means C4's rendering has to change whenever Event Storming does —
 * a stable context depending on a volatile one. So the model is shared and the
 * presentation is resolved per domain, which is also the Functional Core /
 * Imperative Shell line: the type is core, drawing it is shell.
 */

describe("nodeTypesForDomain", () => {
  it("draws C4 and DDD as they were", () => {
    const c4 = nodeTypesForDomain("c4");

    expect(c4["person"]).toBeDefined();
    expect(c4["person"]).not.toBe(StickyNode);
    expect(nodeTypesForDomain("ddd")["domainEvent"]).not.toBe(StickyNode);
  });

  it("draws every storm sticky as a sticky", () => {
    const storm = nodeTypesForDomain("eventStorming");

    for (const sticky of EVENT_STORMING_STICKIES) {
      expect(storm[sticky.type], `${sticky.type} is not drawn as a sticky`).toBe(StickyNode);
    }
  });

  it("still draws types a storm does not own", () => {
    // A board can hold nodes from before a mode switch. Leaving them without a
    // renderer would blank them, which reads as data loss.
    const storm = nodeTypesForDomain("eventStorming");

    expect(storm["aggregate"]).toBeDefined();
    expect(storm["container"]).toBeDefined();
  });

  it("does not let a storm change how C4 draws a person", () => {
    // The property that matters: a stable context must not shift because a
    // volatile one exists.
    expect(nodeTypesForDomain("c4")["person"]).not.toBe(
      nodeTypesForDomain("eventStorming")["person"],
    );
  });
});

describe("identity", () => {
  /**
   * ReactFlow remounts every node when the `nodeTypes` object identity changes,
   * so this must be stable per domain. Built per render it would remount the
   * board on every keystroke.
   */
  it("returns the same object for the same domain", () => {
    expect(nodeTypesForDomain("c4")).toBe(nodeTypesForDomain("c4"));
    expect(nodeTypesForDomain("eventStorming")).toBe(nodeTypesForDomain("eventStorming"));
  });

  it("returns a different object per domain, so switching mode redraws", () => {
    expect(nodeTypesForDomain("c4")).not.toBe(nodeTypesForDomain("eventStorming"));
  });
});
