import { BOARD_METADATA_VERSION, decodeBoardMetadata, encodeBoardMetadata } from "@/core/effects/board-metadata";
import type { NodeData } from "@/core/effects/node-operations";
import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";

/**
 * ADR-015. The record of a board, as opposed to the drawing of it.
 *
 * Four of sixteen `NodeData` fields used to survive a share. The coupling model,
 * ownership and layout roles, and the whole DDD vocabulary were dropped, and a
 * DDD board exported as nothing at all because both exporters filter out any node
 * without a `c4Type` before writing a line.
 */

/** Every field the model defines, so the round trip is asserted against all of it. */
const fullNodeData: Required<Pick<NodeData, "label" | "description" | "technology">> & NodeData = {
  label: "Payments API",
  description: "Settles transactions",
  technology: "Rust + Axum",
  c4Type: "container",
  dddType: "aggregate",
  createdAt: 1_700_000_000_000,
  subdomainType: "core",
  integrationType: "contract",
  couplingProfile: { strength: 0.6, distance: 0.3, volatility: 0.2 },
  couplingScoreMode: "manual",
  couplingOverrides: { strength: 0.8, integrationType: "functional", subdomainType: "generic" },
  iconId: "phosphor:package-duotone",
  layoutRole: "core",
  aggregateRoot: "Payment",
  invariants: ["balance never negative"],
  ubiquitousLanguage: ["settlement", "ledger"],
};

const node: Node = {
  id: "api",
  type: "container",
  position: { x: 760, y: 2140 },
  width: 220,
  height: 120,
  data: fullNodeData,
};

const edge: Edge = {
  id: "e1",
  source: "user",
  target: "api",
  label: "settles via",
  data: {
    createdAt: 1_700_000_000_001,
    metadata: {
      protocol: "https",
      communicationStyle: "synchronous",
      requestVolume: 120,
      latency: 40,
      animationSpeed: "medium",
      notes: "peak at month end",
    },
  },
};

const roundTrip = (nodes: Node[], edges: Edge[], viewport?: { x: number; y: number; zoom: number }) =>
  decodeBoardMetadata(encodeBoardMetadata(nodes, edges, viewport));

describe("encodeBoardMetadata", () => {
  it("emits comment lines a renderer will ignore", () => {
    for (const line of encodeBoardMetadata([node], [edge])) {
      expect(line.startsWith("%% @c4b:"), `not a comment: ${line}`).toBe(true);
    }
  });

  it("stamps the version, so a later format change is detectable", () => {
    expect(encodeBoardMetadata([node], []).join("\n")).toContain(`@c4b:v${BOARD_METADATA_VERSION}`);
  });

  it("emits one record per element", () => {
    expect(encodeBoardMetadata([node, { ...node, id: "b" }], [edge])).toHaveLength(3);
  });

  it("emits nothing for an empty board", () => {
    expect(encodeBoardMetadata([], [])).toEqual([]);
  });
});

describe("round trip", () => {
  it("restores every field the node model defines", () => {
    const [restored] = roundTrip([node], [])?.nodes ?? [];

    // Compared whole rather than field by field: a field added to NodeData and
    // not carried fails here instead of being quietly dropped from every export.
    expect(restored?.data).toEqual(fullNodeData);
  });

  it("restores position and size", () => {
    const [restored] = roundTrip([node], [])?.nodes ?? [];

    expect(restored?.position).toEqual({ x: 760, y: 2140 });
    expect(restored?.width).toBe(220);
    expect(restored?.height).toBe(120);
  });

  it("restores the node id, so edges still connect to it", () => {
    const result = roundTrip([node, { ...node, id: "user" }], [edge]);

    expect(result?.nodes.map((restored) => restored.id)).toEqual(["api", "user"]);
    expect(result?.edges[0]?.source).toBe("user");
    expect(result?.edges[0]?.target).toBe("api");
  });

  it("restores every edge metadata field", () => {
    const [restored] = roundTrip([node], [edge])?.edges ?? [];

    expect((restored?.data as { metadata: unknown })?.metadata).toEqual(
      (edge.data as { metadata: unknown }).metadata,
    );
  });

  it("restores the viewport", () => {
    expect(roundTrip([node], [], { x: -40, y: 15, zoom: 1.5 })?.viewport)
      .toEqual({ x: -40, y: 15, zoom: 1.5 });
  });

  it("carries a node no dialect can draw", () => {
    // A DDD node has no c4Type, so both exporters omit it from the diagram. The
    // envelope is the record; the drawing is only a view of it.
    const ddd: Node = {
      id: "ordering",
      position: { x: 10, y: 20 },
      data: { label: "Ordering", description: "", technology: "", dddType: "boundedContext" },
    };

    const restored = roundTrip([ddd], [])?.nodes ?? [];
    expect(restored).toHaveLength(1);
    expect((restored[0]?.data as NodeData).dddType).toBe("boundedContext");
  });
});

describe("comment markers", () => {
  /**
   * Mermaid comments with `%%`, PlantUML with `'`. The record is the same either
   * way — it is a c4-board concern, not a dialect's — so the marker is a
   * parameter rather than a second encoder to keep in step.
   */
  it("emits PlantUML comments when asked", () => {
    for (const line of encodeBoardMetadata([node], [], undefined, "'")) {
      expect(line.startsWith("' @c4b:"), `not a PlantUML comment: ${line}`).toBe(true);
    }
  });

  it("defaults to Mermaid comments", () => {
    expect(encodeBoardMetadata([node], [])[0]?.startsWith("%% @c4b:")).toBe(true);
  });

  it("reads either marker, so one decoder serves both formats", () => {
    for (const marker of ["%%", "'"] as const) {
      const lines = encodeBoardMetadata([node], [edge], undefined, marker);

      expect(decodeBoardMetadata(lines)?.nodes, `${marker} did not decode`).toHaveLength(1);
    }
  });

  it("carries the same record whichever marker is used", () => {
    const viaMermaid = decodeBoardMetadata(encodeBoardMetadata([node], [edge], undefined, "%%"));
    const viaPlantUml = decodeBoardMetadata(encodeBoardMetadata([node], [edge], undefined, "'"));

    expect(viaPlantUml).toEqual(viaMermaid);
  });
});

describe("decodeBoardMetadata", () => {
  it("returns null when a file carries no envelope, so legacy parsing can run", () => {
    expect(decodeBoardMetadata(["flowchart TB", "  a[\"A\"]"])).toBeNull();
  });

  it("ignores the diagram's own lines", () => {
    const lines = ["C4Context", "  Person(a, \"A\")", ...encodeBoardMetadata([node], [])];

    expect(decodeBoardMetadata(lines)?.nodes).toHaveLength(1);
  });

  it("refuses a version it does not understand rather than guessing", () => {
    const future = "%% @c4b:v99 {\"kind\":\"node\",\"id\":\"a\"}";

    expect(() => decodeBoardMetadata([future])).toThrow(/v99/);
  });

  it("refuses a malformed record rather than applying part of it", () => {
    expect(() => decodeBoardMetadata([`%% @c4b:v${BOARD_METADATA_VERSION} {not json`]))
      .toThrow(/metadata/i);
  });
});
