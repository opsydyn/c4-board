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

describe("both dialects round-trip through the metadata envelope", () => {
  /**
   * ADR-015. The reason the C4 dialect could not round-trip was that it carried
   * no metadata, not anything inherent to C4 — Mermaid ignores `%%` comments, so
   * both dialects can carry the same record.
   */
  const rich: Node = {
    id: "api",
    type: "container",
    position: { x: 760, y: 2140 },
    width: 220,
    height: 120,
    data: {
      label: "Payments API",
      description: "Settles transactions",
      technology: "Rust + Axum",
      c4Type: "container",
      subdomainType: "core",
      couplingScoreMode: "manual",
      layoutRole: "core",
    },
  };

  const ddd: Node = {
    id: "ordering",
    position: { x: 40, y: 80 },
    data: { label: "Ordering", description: "", technology: "", dddType: "boundedContext" },
  };

  for (const dialect of ["flowchart", "c4"] as const) {
    it(`restores coordinates from the ${dialect} dialect`, () => {
      const code = Effect.runSync(exportMermaidForDialect(dialect, [rich], [], {}));
      const result = Effect.runSync(importMermaid(code));

      expect(result.nodes[0]?.position).toEqual({ x: 760, y: 2140 });
    });

    it(`restores fields the drawing cannot express, from the ${dialect} dialect`, () => {
      const code = Effect.runSync(exportMermaidForDialect(dialect, [rich], [], {}));
      const data = Effect.runSync(importMermaid(code)).nodes[0]?.data as NodeData;

      // None of these survived before: they exist in neither dialect's notation.
      expect(data.subdomainType).toBe("core");
      expect(data.couplingScoreMode).toBe("manual");
      expect(data.layoutRole).toBe("core");
    });

    it(`carries a DDD node through the ${dialect} dialect, which cannot draw it`, () => {
      const code = Effect.runSync(exportMermaidForDialect(dialect, [ddd], [], {}));
      const result = Effect.runSync(importMermaid(code));

      expect(result.nodes).toHaveLength(1);
      expect((result.nodes[0]?.data as NodeData).dddType).toBe("boundedContext");
    });
  }

  it("keeps reading files exported before the envelope existed", () => {
    // The legacy shape: shape-inferred type, @pos comments, no @c4b records.
    const legacy = [
      "flowchart TB",
      "    api[(\"Payments API\")]",
      "    %% @pos(760,2140,220,120)",
    ].join("\n");

    const result = Effect.runSync(importMermaid(legacy));

    expect(result.nodes[0]?.position).toEqual({ x: 760, y: 2140 });
    expect((result.nodes[0]?.data as NodeData).c4Type).toBe("container");
  });
});

describe("importing a C4 file that predates the envelope", () => {
  const c4 = [
    "C4Container",
    "%% Generated by c4-board — Mermaid C4 (experimental).",
    "  Person(operator, \"Operator\")",
    "  Container(payments_api, \"Payments API\", \"Rust\")",
  ].join("\n");

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
