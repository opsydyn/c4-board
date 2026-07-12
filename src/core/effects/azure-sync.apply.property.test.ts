import type { Edge, Node } from "@xyflow/react";
import * as FastCheck from "effect/FastCheck";
import { describe, expect, it } from "vitest";
import { mergeAzureMappedGraphIntoCanvas } from "./azure-sync.apply";
import type { AzureMappedGraph, AzureMappedNode } from "./azure-sync.mapper";

const SYNCED_AT = 1_700_000_000_000;

const syncCaseArbitrary = FastCheck.tuple(
  FastCheck.uniqueArray(
    FastCheck.stringMatching(/^[a-z][a-z0-9]{0,8}$/),
    { minLength: 1, maxLength: 6 },
  ),
  FastCheck.boolean(),
  FastCheck.boolean(),
).map(([slugs, includeExisting, includeStale]) => {
  const nodes: AzureMappedNode[] = slugs.map((slug, index) => ({
    id: `azure:/subscriptions/sub/resourcegroups/rg/providers/microsoft.web/sites/${slug}`,
    type: index % 2 === 0 ? "component" : "system",
    label: slug,
    technology: index % 2 === 0 ? "microsoft.web/sites" : "microsoft.storage/storageaccounts",
    description: `${slug} @ westeurope`,
    sourceResourceId: `/subscriptions/sub/resourcegroups/rg/providers/microsoft.web/sites/${slug}`,
    sourceResourceType: index % 2 === 0
      ? "microsoft.web/sites"
      : "microsoft.storage/storageaccounts",
  }));
  const edges = nodes.slice(1).map((node, index) => ({
    id: `azure-edge:${slugs[index]}-${slugs[index + 1]}`,
    source: nodes[index]!.id,
    target: node.id,
    label: "depends_on",
    relationshipType: "depends_on",
    confidence: "high",
    provenanceSource: "arm_depends_on" as const,
    provenanceDetail: "dependsOn",
  }));
  return { mapped: { nodes, edges }, includeExisting, includeStale };
});

const existingCanvas = (
  mapped: AzureMappedGraph,
  includeExisting: boolean,
  includeStale: boolean,
): { nodes: Node[]; edges: Edge[] } => {
  const manual: Node = {
    id: "manual-system",
    type: "system",
    position: { x: 0, y: 0 },
    data: { label: "Manual", description: "", technology: "", c4Type: "system" },
  };
  const stale: Node = {
    id: "azure:/subscriptions/sub/resourcegroups/rg/providers/microsoft.web/sites/stale-fixture",
    type: "component",
    position: { x: 320, y: 200 },
    data: {
      label: "Stale",
      description: "stale",
      technology: "microsoft.web/sites",
      c4Type: "component",
      sourceProvider: "azure",
    },
  };
  const existingMapped = (includeExisting ? mapped.nodes : [])
    .filter((_, index) => index % 2 === 0)
    .map((node, index): Node => ({
      id: node.id,
      type: node.type,
      position: { x: 640 + index * 240, y: 160 },
      data: {
        label: `old-${node.label}`,
        description: "old",
        technology: "old",
        c4Type: node.type,
        sourceProvider: "azure",
      },
    }));

  return {
    nodes: [manual, ...(includeStale ? [stale] : []), ...existingMapped],
    edges: [
      { id: "manual-edge", source: manual.id, target: manual.id, label: "manual" },
      ...(includeStale
        ? [{
          id: "azure-edge:stale",
          source: stale.id,
          target: mapped.nodes[0]!.id,
          label: "depends_on",
        }]
        : []),
    ],
  };
};

describe("Azure sync reconciliation properties", () => {
  it("is idempotent for an unchanged mapped graph", () => {
    FastCheck.assert(
      FastCheck.property(syncCaseArbitrary, ({ mapped, includeExisting, includeStale }) => {
        const initial = existingCanvas(mapped, includeExisting, includeStale);
        expect(new Set(initial.nodes.map((node) => node.id)).size).toBe(initial.nodes.length);
        const first = mergeAzureMappedGraphIntoCanvas({ ...initial, mapped, syncedAt: SYNCED_AT });
        const second = mergeAzureMappedGraphIntoCanvas({ ...first, mapped, syncedAt: SYNCED_AT });

        expect(second).toEqual(first);
      }),
      { numRuns: 100 },
    );
  });
});
