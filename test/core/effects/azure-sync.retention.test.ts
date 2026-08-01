/**
 * Retention on apply (ADR-020).
 *
 * `mergeAzureMappedGraphIntoCanvas` used to drop any Azure node the incoming
 * snapshot did not mention, and the save that followed turned that into a real
 * DELETE. Retention makes the default failure a stale node an operator can see
 * rather than a missing one they cannot recover.
 */

import { mergeAzureMappedGraphIntoCanvas } from "@/core/effects/azure-sync.apply";
import type { AzureMappedNode } from "@/core/effects/azure-sync.mapper";
import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";

const SYNCED_AT = 1_700_000_000_000;

const mapped = (id: string): AzureMappedNode => ({
  id,
  type: "container",
  label: id,
  technology: "microsoft.web/sites",
  description: "",
  sourceResourceId: id.replace("azure:", ""),
  sourceResourceType: "microsoft.web/sites",
});

const boardNode = (id: string): Node => ({
  id,
  position: { x: 0, y: 0 },
  type: "container",
  data: { label: id, c4Type: "container" },
});

const boardEdge = (id: string, source: string, target: string): Edge => ({
  id,
  source,
  target,
  data: {},
});

describe("azure apply retention", () => {
  it("keeps an Azure node the snapshot no longer reports when archiving is off", () => {
    const result = mergeAzureMappedGraphIntoCanvas({
      nodes: [boardNode("azure:a"), boardNode("azure:gone")],
      edges: [],
      mapped: { nodes: [mapped("azure:a")], edges: [] },
      syncedAt: SYNCED_AT,
      archiveMissing: false,
    });

    expect(result.nodes.map((node) => node.id).sort()).toEqual(["azure:a", "azure:gone"]);
  });

  it("removes it only when archiving is explicitly on", () => {
    const result = mergeAzureMappedGraphIntoCanvas({
      nodes: [boardNode("azure:a"), boardNode("azure:gone")],
      edges: [],
      mapped: { nodes: [mapped("azure:a")], edges: [] },
      syncedAt: SYNCED_AT,
      archiveMissing: true,
    });

    expect(result.nodes.map((node) => node.id)).toEqual(["azure:a"]);
  });

  it("retains by default, so a caller that forgets the flag cannot delete", () => {
    const result = mergeAzureMappedGraphIntoCanvas({
      nodes: [boardNode("azure:a"), boardNode("azure:gone")],
      edges: [],
      mapped: { nodes: [mapped("azure:a")], edges: [] },
      syncedAt: SYNCED_AT,
    });

    expect(result.nodes.map((node) => node.id)).toContain("azure:gone");
  });

  it("keeps a retained node's edges rather than orphaning them", () => {
    const result = mergeAzureMappedGraphIntoCanvas({
      nodes: [boardNode("azure:a"), boardNode("azure:gone")],
      edges: [boardEdge("azure-edge:keep", "azure:a", "azure:gone")],
      mapped: { nodes: [mapped("azure:a")], edges: [] },
      syncedAt: SYNCED_AT,
      archiveMissing: false,
    });

    expect(result.edges.map((edge) => edge.id)).toContain("azure-edge:keep");
  });

  it("does not rewrite a retained node's data, since Azure no longer describes it", () => {
    const stale = {
      ...boardNode("azure:gone"),
      position: { x: 42, y: 99 },
      data: { label: "gone", c4Type: "container", teamOwnership: "team-x" },
    };

    const result = mergeAzureMappedGraphIntoCanvas({
      nodes: [stale],
      edges: [],
      mapped: { nodes: [], edges: [] },
      syncedAt: SYNCED_AT,
      archiveMissing: false,
    });

    const retained = result.nodes.find((node) => node.id === "azure:gone");

    // Position is excluded deliberately: subgraph layout owns it for every
    // Azure node, retained or not, and grid-snaps on each run.
    expect(retained?.data).toEqual(stale.data);
    expect(retained?.type).toBe(stale.type);
  });

  it("never touches non-Azure nodes either way", () => {
    const manual: Node = { id: "manual-1", position: { x: 0, y: 0 }, data: {} };

    for (const archiveMissing of [true, false]) {
      const result = mergeAzureMappedGraphIntoCanvas({
        nodes: [manual, boardNode("azure:gone")],
        edges: [],
        mapped: { nodes: [], edges: [] },
        syncedAt: SYNCED_AT,
        archiveMissing,
      });

      expect(result.nodes.map((node) => node.id)).toContain("manual-1");
    }
  });
});
