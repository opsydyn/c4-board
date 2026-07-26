import { exportMermaidForDialect } from "@/core/effects/export-mermaid-dialect";
import { importMermaid } from "@/core/effects/import-mermaid";
import type { C4Type, NodeData } from "@/core/effects/node-operations";
import type { Edge, Node } from "@xyflow/react";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

/**
 * ADR-014 Phase 4. The round trip the flowchart dialect exists for.
 *
 * This is the constraint that stopped Mermaid C4 replacing the flowchart export:
 * `import-mermaid.ts` reads back the `@pos` comments the flowchart emits, and C4
 * has nowhere to put them. Neither file had a test, so the property everything
 * else was designed around was itself unverified.
 */

const node = (
  id: string,
  c4Type: C4Type,
  label: string,
  position: { x: number; y: number },
): Node => ({
  id,
  position,
  width: 220,
  height: 120,
  data: { label, description: "", technology: "", c4Type },
});

const board = {
  nodes: [
    node("user", "person", "Operator", { x: 120, y: 40 }),
    node("api", "container", "Payments API", { x: 480, y: 260 }),
    node("idp", "externalSystem", "Identity Provider", { x: 860, y: 40 }),
  ],
  edges: [{ id: "e1", source: "user", target: "api", label: "settles via" }] as Edge[],
};

const roundTrip = (viewport?: { x: number; y: number; zoom: number }) =>
  Effect.runSync(Effect.gen(function*() {
    const code = yield* exportMermaidForDialect(
      "flowchart",
      board.nodes,
      board.edges,
      viewport === undefined ? {} : { viewport },
    );
    return yield* importMermaid(code);
  }));

const labelOf = (imported: Node): string => (imported.data as NodeData).label;

describe("flowchart round trip", () => {
  it("brings every element back", () => {
    expect(roundTrip().nodes).toHaveLength(3);
  });

  it("restores positions, which is the whole reason this dialect exists", () => {
    const positions = roundTrip().nodes.map((imported) => imported.position);

    expect(positions).toEqual([
      { x: 120, y: 40 },
      { x: 480, y: 260 },
      { x: 860, y: 40 },
    ]);
  });

  it("restores the C4 type of each element", () => {
    const types = roundTrip().nodes.map((imported) => (imported.data as NodeData).c4Type);

    expect(types).toEqual(["person", "container", "externalSystem"]);
  });

  it("restores labels", () => {
    expect(roundTrip().nodes.map(labelOf)).toEqual([
      "Operator",
      "Payments API",
      "Identity Provider",
    ]);
  });

  it("restores the relationship between the elements that had one", () => {
    const result = roundTrip();
    const [edge] = result.edges;

    expect(result.edges).toHaveLength(1);
    expect(edge?.label).toBe("settles via");
  });

  it("restores the viewport when one was exported", () => {
    expect(roundTrip({ x: -40, y: 15, zoom: 1.5 }).viewport).toEqual({ x: -40, y: 15, zoom: 1.5 });
  });
});

describe("importing the C4 dialect", () => {
  const c4 = Effect.runSync(exportMermaidForDialect("c4", board.nodes, board.edges, {}));

  it("refuses rather than half-parsing it", () => {
    // C4 macros look nothing like flowchart node syntax, so nothing matches. The
    // danger would be importing a subset and silently losing the rest.
    const result = Effect.runSync(Effect.either(importMermaid(c4)));

    expect(result._tag).toBe("Left");
  });

  it("says the file is the wrong dialect, not that it is broken", () => {
    // "No valid nodes found" reads as corruption. Someone who exported C4 and
    // tried to import it needs to be told which export to use instead.
    const result = Effect.runSync(Effect.either(importMermaid(c4)));
    const message = result._tag === "Left" ? result.left.message : "";

    expect(message).toMatch(/C4/);
    expect(message).toMatch(/flowchart/i);
  });

  it("still reports an ordinary unparseable file as having no nodes", () => {
    const result = Effect.runSync(Effect.either(importMermaid("flowchart TB\n  %% nothing here")));
    const message = result._tag === "Left" ? result.left.message : "";

    expect(message).toMatch(/no valid nodes/i);
  });
});
