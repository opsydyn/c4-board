import { exportMermaidForDialect } from "@/core/effects/export-mermaid-dialect";
import { exportC4ToPlantUML } from "@/core/effects/export-plantuml-c4";
import { importMermaid } from "@/core/effects/import-mermaid";
import { importPlantUMLC4 } from "@/core/effects/import-plantuml-c4";
import type { NodeData } from "@/core/effects/node-operations";
import type { Edge, Node } from "@xyflow/react";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

/**
 * ADR-016 Phase 5. What a storm actually exports.
 *
 * ADR-016 said storms "draw nothing", on the reasoning that both exporters filter
 * to C4 types. That was wrong in a way worth pinning down: a storm's actor *is* a
 * `person` and its external system *is* an `externalSystem`, both C4 types, so
 * those are drawn while the event backbone, hotspots and opportunities are not.
 *
 * A drawing of the supporting cast with no events is worse than an empty one. An
 * empty diagram says "nothing here"; this one looks complete and is not.
 */

const sticky = (id: string, type: string, x: number, data: Partial<NodeData> = {}): Node => ({
  id,
  type,
  position: { x, y: 0 },
  width: 180,
  height: 120,
  data: {
    label: id,
    description: "",
    technology: "",
    ...(type === "person" || type === "externalSystem" ? { c4Type: type } : {}),
    ...(type === "domainEvent" ? { dddType: "domainEvent" } : {}),
    ...data,
  } as NodeData,
});

/** A Big Picture board: the backbone, the people, and the arguments. */
const storm: Node[] = [
  sticky("placed", "domainEvent", 100, { isPivotal: true }),
  sticky("paid", "domainEvent", 300),
  sticky("who-refunds", "hotspot", 500),
  sticky("customer", "person", 700),
  sticky("payments", "externalSystem", 900),
  sticky("self-serve", "opportunity", 1100),
];

const edges: Edge[] = [];

const drawn = (source: string, comment: string) =>
  source.split("\n").filter((line) => !line.trim().startsWith(comment));

describe("what a storm draws", () => {
  it("draws the supporting cast but not the story", () => {
    const flowchart = drawn(
      Effect.runSync(exportMermaidForDialect("flowchart", storm, edges, {})),
      "%%",
    ).join("\n");

    // Drawn, because they are C4 types.
    expect(flowchart).toContain("customer");
    expect(flowchart).toContain("payments");
    // Not drawn — including every event, which is the board's whole spine.
    expect(flowchart).not.toContain("placed");
    expect(flowchart).not.toContain("who-refunds");
  });

  it("says what it left out, rather than letting the gap pass unremarked", () => {
    // The honest minimum until a dialect can draw these: the file states that it
    // is partial, so a reader is not misled by a diagram that looks complete.
    for (const dialect of ["flowchart", "c4"] as const) {
      const source = Effect.runSync(exportMermaidForDialect(dialect, storm, edges, {}));

      expect(source, `${dialect} does not declare the omission`).toMatch(/4 of 6 nodes/);
      expect(source).toMatch(/not drawn/i);
    }
  });

  it("says the same in PlantUML", () => {
    const source = Effect.runSync(exportC4ToPlantUML(storm, edges, {}));

    expect(source).toMatch(/4 of 6 nodes/);
  });

  it("stays silent when everything is drawn", () => {
    const c4Board = [sticky("customer", "person", 0), sticky("payments", "externalSystem", 100)];
    const source = Effect.runSync(exportMermaidForDialect("flowchart", c4Board, edges, {}));

    expect(source).not.toMatch(/not drawn/i);
  });
});

describe("what a storm records", () => {
  /** The envelope is the record, and it is complete regardless of the drawing. */
  const formats = [
    {
      name: "mermaid flowchart",
      out: () => Effect.runSync(exportMermaidForDialect("flowchart", storm, edges, {})),
      back: (s: string) => Effect.runSync(importMermaid(s)),
    },
    {
      name: "mermaid c4",
      out: () => Effect.runSync(exportMermaidForDialect("c4", storm, edges, {})),
      back: (s: string) => Effect.runSync(importMermaid(s)),
    },
    {
      name: "plantuml",
      out: () => Effect.runSync(exportC4ToPlantUML(storm, edges, {})),
      back: (s: string) => Effect.runSync(importPlantUMLC4(s)),
    },
  ];

  for (const format of formats) {
    it(`brings the whole board back through ${format.name}`, () => {
      const result = format.back(format.out());

      expect(result.nodes.map((node) => node.id).sort()).toEqual(storm.map((n) => n.id).sort());
    });

    it(`keeps the pivotal event through ${format.name}`, () => {
      const result = format.back(format.out());
      const placed = result.nodes.find((node) => node.id === "placed");

      expect((placed?.data as NodeData).isPivotal).toBe(true);
    });

    it(`keeps coordinates through ${format.name}`, () => {
      const result = format.back(format.out());

      expect(result.nodes.find((node) => node.id === "who-refunds")?.position)
        .toEqual({ x: 500, y: 0 });
    });
  }
});
