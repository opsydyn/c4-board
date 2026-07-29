/**
 * Azure provenance survival (ADR-020 Phase 2).
 *
 * The apply merge writes `sourceResourceId`, `sourceResourceType`,
 * `lastSyncedAt`, and the relationship type and confidence onto nodes and
 * edges — and every one of them was dropped at save, because no column or
 * payload field carried them. The confidence and provenance badges an operator
 * reads were therefore describing the last in-memory dry-run, never the board.
 */

import {
  dbEdgeToReactFlow,
  dbNodeToReactFlow,
  reactFlowEdgeToDb,
  reactFlowNodeToDb,
} from "@/core/effects/canvas-persistence";
import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";

const SYNCED_AT = 1_700_000_000_000;

const roundTripNode = (node: Node): Node => {
  const dbInput = reactFlowNodeToDb(node, "diagram-1");
  return dbNodeToReactFlow({
    ...dbInput,
    diagram_id: "diagram-1",
    position_x: dbInput.position_x ?? 0,
    position_y: dbInput.position_y ?? 0,
    created_at: SYNCED_AT,
    updated_at: SYNCED_AT,
  } as never);
};

const roundTripEdge = (edge: Edge): Edge => {
  const dbInput = reactFlowEdgeToDb(edge, "diagram-1");
  return dbEdgeToReactFlow({
    ...dbInput,
    diagram_id: "diagram-1",
    created_at: SYNCED_AT,
    updated_at: SYNCED_AT,
  } as never);
};

describe("azure provenance persistence", () => {
  it("keeps which Azure resource a node came from", () => {
    const node: Node = {
      id: "azure:/subscriptions/s1/providers/microsoft.web/sites/api",
      type: "container",
      position: { x: 0, y: 0 },
      data: {
        label: "api",
        c4Type: "container",
        sourceProvider: "azure",
        sourceResourceId: "/subscriptions/s1/providers/microsoft.web/sites/api",
        sourceResourceType: "microsoft.web/sites",
        lastSyncedAt: SYNCED_AT,
      },
    };

    const restored = roundTripNode(node);

    expect(restored.data.sourceProvider).toBe("azure");
    expect(restored.data.sourceResourceId).toBe("/subscriptions/s1/providers/microsoft.web/sites/api");
    expect(restored.data.sourceResourceType).toBe("microsoft.web/sites");
    expect(restored.data.lastSyncedAt).toBe(SYNCED_AT);
  });

  it("leaves a hand-drawn node unprovenanced rather than claiming Azure made it", () => {
    const node: Node = {
      id: "system-manual",
      type: "system",
      position: { x: 0, y: 0 },
      data: { label: "Manual", c4Type: "system" },
    };

    const restored = roundTripNode(node);

    expect(restored.data.sourceProvider).toBeUndefined();
    expect(restored.data.sourceResourceId).toBeUndefined();
  });

  it("keeps how confident an edge's relationship was and where it came from", () => {
    const edge: Edge = {
      id: "azure-edge:abc",
      source: "azure:a",
      target: "azure:b",
      label: "depends on",
      data: {
        sourceProvider: "azure",
        relationshipType: "network_link",
        confidence: "low",
        provenanceSource: "property_ref",
        provenanceDetail: "subnetId",
        lastSyncedAt: SYNCED_AT,
      },
    };

    const restored = roundTripEdge(edge);

    expect(restored.data?.relationshipType).toBe("network_link");
    expect(restored.data?.confidence).toBe("low");
    expect(restored.data?.provenanceSource).toBe("property_ref");
    expect(restored.data?.provenanceDetail).toBe("subnetId");
  });

  it("leaves a hand-drawn edge without invented provenance", () => {
    const edge: Edge = { id: "manual-edge", source: "a", target: "b", data: {} };

    const restored = roundTripEdge(edge);

    expect(restored.data?.relationshipType).toBeUndefined();
    expect(restored.data?.confidence).toBeUndefined();
  });
});
