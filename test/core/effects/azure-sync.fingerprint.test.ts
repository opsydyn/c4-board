/**
 * The Azure dry-run fingerprint.
 *
 * The dry-run is the only safeguard standing between an operator and a
 * destructive apply, and it was reporting numbers that could not be right: the
 * two sides fingerprinted different shapes, so `unchanged` was always empty and
 * every surviving node read as an update.
 *
 * The invariant that keeps them honest is a round trip. A node produced by the
 * mapper, merged onto the canvas, saved, and loaded back must fingerprint
 * identically — otherwise a board that nobody touched reports as drifted, and
 * the operator learns to ignore the preview.
 */

import { mergeAzureMappedGraphIntoCanvas } from "@/core/effects/azure-sync.apply";
import type { AzureMappedEdge, AzureMappedNode } from "@/core/effects/azure-sync.mapper";
import {
  fingerprintAzureBoardEdge,
  fingerprintAzureBoardNode,
  fingerprintAzureMappedEdge,
  fingerprintAzureMappedNode,
} from "@/core/effects/azure-sync.types";
import { dbNodeToReactFlow, reactFlowNodeToDb } from "@/core/effects/canvas-persistence";
import { describe, expect, it } from "vitest";

const SYNCED_AT = 1_700_000_000_000;

/**
 * `null` on an optional field means "omit it", which `exactOptionalPropertyTypes`
 * will not let a caller express by passing `undefined`.
 */
const mappedNode = (
  overrides?: Partial<Omit<AzureMappedNode, "parentGroupId" | "teamOwnership">> & {
    readonly parentGroupId?: string | null;
    readonly teamOwnership?: string | null;
  },
): AzureMappedNode => {
  const { parentGroupId = "azure-rg:s1/rg1", teamOwnership = "team-platform", ...rest } = overrides ?? {};

  return {
    id: "azure:/subscriptions/s1/resourcegroups/rg1/providers/microsoft.web/sites/api",
    type: "container",
    label: "api",
    technology: "microsoft.web/sites",
    description: "App Service",
    sourceResourceId: "/subscriptions/s1/resourcegroups/rg1/providers/microsoft.web/sites/api",
    sourceResourceType: "microsoft.web/sites",
    ...rest,
    ...(parentGroupId === null ? {} : { parentGroupId }),
    ...(teamOwnership === null ? {} : { teamOwnership }),
  };
};

const mappedEdge = (overrides?: Partial<AzureMappedEdge>): AzureMappedEdge => ({
  id: "azure-edge:abc123",
  source: "azure:/subscriptions/s1/a",
  target: "azure:/subscriptions/s1/b",
  label: "depends on",
  relationshipType: "depends_on",
  confidence: "high",
  provenanceSource: "arm_depends_on",
  ...overrides,
});

/** Mapper output -> canvas -> database row -> canvas, the way a real sync goes. */
const roundTripToBoardNode = (node: AzureMappedNode) => {
  const merged = mergeAzureMappedGraphIntoCanvas({
    nodes: [],
    edges: [],
    mapped: { nodes: [node], edges: [] },
    syncedAt: SYNCED_AT,
  });

  const boardNode = merged.nodes.find((candidate) => candidate.id === node.id);
  if (!boardNode) {
    throw new Error("merge dropped the mapped node");
  }

  const dbInput = reactFlowNodeToDb(boardNode, "diagram-1");
  return dbNodeToReactFlow({
    ...dbInput,
    diagram_id: "diagram-1",
    position_x: dbInput.position_x ?? 0,
    position_y: dbInput.position_y ?? 0,
    created_at: SYNCED_AT,
    updated_at: SYNCED_AT,
  } as never);
};

describe("azure sync fingerprints", () => {
  it("gives a saved-and-reloaded node the same fingerprint the mapper produced", () => {
    const node = mappedNode();

    expect(fingerprintAzureBoardNode(roundTripToBoardNode(node)))
      .toBe(fingerprintAzureMappedNode(node));
  });

  it("survives the round trip for a node with no team tag and no parent group", () => {
    const node = mappedNode({
      parentGroupId: null,
      teamOwnership: null,
      description: "",
    });

    expect(fingerprintAzureBoardNode(roundTripToBoardNode(node)))
      .toBe(fingerprintAzureMappedNode(node));
  });

  it("changes when a field an operator would care about changes", () => {
    const before = fingerprintAzureMappedNode(mappedNode());

    expect(fingerprintAzureMappedNode(mappedNode({ label: "api-v2" }))).not.toBe(before);
    expect(fingerprintAzureMappedNode(mappedNode({ type: "component" }))).not.toBe(before);
    expect(fingerprintAzureMappedNode(mappedNode({ teamOwnership: "team-data" }))).not.toBe(before);
    expect(fingerprintAzureMappedNode(mappedNode({ parentGroupId: "azure-rg:s1/rg2" }))).not.toBe(before);
  });

  it("ignores layout, which the operator moves freely and Azure does not own", () => {
    const node = mappedNode();
    const merged = mergeAzureMappedGraphIntoCanvas({
      nodes: [],
      edges: [],
      mapped: { nodes: [node], edges: [] },
      syncedAt: SYNCED_AT,
    });
    const boardNode = merged.nodes.find((candidate) => candidate.id === node.id)!;

    const moved = {
      ...boardNode,
      position: { x: boardNode.position.x + 500, y: boardNode.position.y + 500 },
      width: 999,
      height: 999,
    };

    expect(fingerprintAzureBoardNode(moved)).toBe(fingerprintAzureBoardNode(boardNode));
  });

  it("matches a mapped edge against the board edge it produced", () => {
    const edge = mappedEdge();
    // The merge keeps an edge only when both endpoints are themselves mapped,
    // so the endpoints belong in the mapped graph, not just on the canvas.
    const merged = mergeAzureMappedGraphIntoCanvas({
      nodes: [],
      edges: [],
      mapped: {
        nodes: [
          mappedNode({ id: edge.source, parentGroupId: null }),
          mappedNode({ id: edge.target, parentGroupId: null }),
        ],
        edges: [edge],
      },
      syncedAt: SYNCED_AT,
    });

    const boardEdge = merged.edges.find((candidate) => candidate.id === edge.id);
    if (!boardEdge) {
      throw new Error("merge dropped the mapped edge");
    }

    expect(fingerprintAzureBoardEdge(boardEdge)).toBe(fingerprintAzureMappedEdge(edge));
  });
});
