import { exportC4ToPlantUML } from "@/core/effects/export-plantuml-c4";
import { importPlantUMLC4 } from "@/core/effects/import-plantuml-c4";
import type { NodeData } from "@/core/effects/node-operations";
import type { Edge, Node } from "@xyflow/react";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

/**
 * ADR-015. PlantUML carries the same envelope as the Mermaid dialects, using its
 * own comment marker. The record is a c4-board concern, so a board shared as
 * PlantUML has to arrive the same as one shared as Mermaid.
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

const edges: Edge[] = [];

const roundTrip = (nodes: Node[]) =>
  Effect.runSync(Effect.gen(function*() {
    const code = yield* exportC4ToPlantUML(nodes, edges, {});
    return yield* importPlantUMLC4(code);
  }));

describe("PlantUML metadata envelope", () => {
  it("uses PlantUML's comment marker, not Mermaid's", () => {
    const code = Effect.runSync(exportC4ToPlantUML([rich], edges, {}));

    expect(code).toContain("' @c4b:v");
    expect(code).not.toContain("%% @c4b:");
  });

  it("restores coordinates", () => {
    expect(roundTrip([rich]).nodes[0]?.position).toEqual({ x: 760, y: 2140 });
  });

  it("restores fields C4-PlantUML notation cannot express", () => {
    const data = roundTrip([rich]).nodes[0]?.data as NodeData;

    expect(data.subdomainType).toBe("core");
    expect(data.couplingScoreMode).toBe("manual");
    expect(data.layoutRole).toBe("core");
  });

  it("carries a DDD node the diagram cannot draw", () => {
    const result = roundTrip([ddd]);

    expect(result.nodes).toHaveLength(1);
    expect((result.nodes[0]?.data as NodeData).dddType).toBe("boundedContext");
  });

  it("keeps reading PlantUML files exported before the envelope existed", () => {
    const legacy = [
      "@startuml",
      "!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml",
      "Container(api, \"Payments API\", \"Rust\")",
      "' @pos(760,2140,220,120)",
      "@enduml",
    ].join("\n");

    const result = Effect.runSync(importPlantUMLC4(legacy));

    expect(result.nodes.length).toBeGreaterThan(0);
  });
});
