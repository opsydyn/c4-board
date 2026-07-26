import { EVENT_STORMING_STICKIES } from "@/core/effects/event-storming";
import type { NodeData } from "@/core/effects/node-operations";
import { canvasMachine } from "@/ui/machines/canvas.machine";
import { describe, expect, it } from "vitest";
import { createActor } from "xstate";

/**
 * ADR-016 Phase 4. Storm mode, from the machine's side.
 *
 * The five stickies get one generic event rather than five typed ones. C4 and DDD
 * each grew a machine event per node type — `ADD_PERSON`, `ADD_AGGREGATE`, and so
 * on — which is nineteen events describing the same operation. A third domain is
 * where that stops being worth repeating.
 */

const start = () => createActor(canvasMachine).start();

const dataOf = (node: { data: unknown }) => node.data as NodeData;

describe("adding a sticky", () => {
  it("adds every sticky in the palette", () => {
    const actor = start();

    for (const sticky of EVENT_STORMING_STICKIES) {
      actor.send({ type: "ADD_NODE", nodeType: sticky.type });
    }

    const added = actor.getSnapshot().context.nodes;
    expect(added).toHaveLength(EVENT_STORMING_STICKIES.length);
    expect(added.map((node: { type?: string }) => node.type))
      .toEqual(EVENT_STORMING_STICKIES.map((sticky) => sticky.type));
  });

  it("gives it a label rather than leaving it blank", () => {
    const actor = start();

    actor.send({ type: "ADD_NODE", nodeType: "hotspot" });

    expect(dataOf(actor.getSnapshot().context.nodes[0]!).label.length).toBeGreaterThan(0);
  });

  it("does not stack them on top of each other", () => {
    const actor = start();

    actor.send({ type: "ADD_NODE", nodeType: "domainEvent" });
    actor.send({ type: "ADD_NODE", nodeType: "domainEvent" });

    const [first, second] = actor.getSnapshot().context.nodes;
    expect(first!.position).not.toEqual(second!.position);
  });

  it("ignores a type the board cannot hold", () => {
    // The database CHECK would reject it on save; better to never create it.
    const actor = start();

    actor.send({ type: "ADD_NODE", nodeType: "notAType" });

    expect(actor.getSnapshot().context.nodes).toHaveLength(0);
  });
});

describe("switching to storm mode", () => {
  it("is a domain the machine accepts", () => {
    const actor = start();

    actor.send({ type: "SET_DOMAIN", domain: "eventStorming" });

    expect(actor.getSnapshot().context.currentDomain).toBe("eventStorming");
  });

  it("does not discard nodes from another domain", () => {
    // Switching mode is a change of tools, not a change of board.
    const actor = start();
    actor.send({ type: "ADD_PERSON" });
    const before = actor.getSnapshot().context.nodes.length;

    actor.send({ type: "SET_DOMAIN", domain: "eventStorming" });

    expect(actor.getSnapshot().context.nodes).toHaveLength(before);
  });
});

describe("pivotal events", () => {
  it("marks an event as a phase boundary", () => {
    const actor = start();
    actor.send({ type: "ADD_NODE", nodeType: "domainEvent" });
    const id = actor.getSnapshot().context.nodes[0]!.id;

    actor.send({ type: "UPDATE_NODE", nodeId: id, updates: { isPivotal: true } });

    expect(dataOf(actor.getSnapshot().context.nodes[0]!).isPivotal).toBe(true);
  });
});
