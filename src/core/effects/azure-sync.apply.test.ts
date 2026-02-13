import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { mergeAzureMappedGraphIntoCanvas } from "./azure-sync.apply";
import type { AzureMappedGraph } from "./azure-sync.mapper";

const createManualNode = (
  id: string,
  label: string,
  position: { x: number; y: number },
): Node => ({
  id,
  type: "system",
  position,
  data: {
    label,
    description: "",
    technology: "",
    c4Type: "system",
  },
});

const createAzureNode = (
  id: string,
  label: string,
  position: { x: number; y: number },
): Node => ({
  id,
  type: "system",
  position,
  data: {
    label,
    description: "old",
    technology: "old-tech",
    c4Type: "system",
    sourceProvider: "azure",
  },
});

describe("mergeAzureMappedGraphIntoCanvas", () => {
  it("upserts mapped Azure nodes and edges while preserving non-Azure graph", () => {
    const manual = createManualNode("system-manual", "Manual", { x: 0, y: 0 });
    const existingAzure = createAzureNode(
      "azure:/subscriptions/sub-a/resourcegroups/rg-a/providers/microsoft.web/sites/site-a",
      "site-a-old",
      { x: 420, y: 80 },
    );
    const archivedAzure = createAzureNode(
      "azure:/subscriptions/sub-a/resourcegroups/rg-a/providers/microsoft.compute/virtualmachines/vm-old",
      "vm-old",
      { x: 420, y: 280 },
    );

    const edges: Edge[] = [
      {
        id: "azure-edge:old",
        source: archivedAzure.id,
        target: existingAzure.id,
        label: "depends_on",
        type: "default",
      },
      {
        id: "manual-edge",
        source: manual.id,
        target: manual.id,
        label: "self",
        type: "default",
      },
    ];

    const mapped: AzureMappedGraph = {
      nodes: [
        {
          id: existingAzure.id,
          type: "component",
          label: "site-a",
          description: "microsoft.web/sites @ westus2",
          technology: "microsoft.web/sites",
          sourceResourceId: "/subscriptions/sub-a/resourcegroups/rg-a/providers/microsoft.web/sites/site-a",
          sourceResourceType: "microsoft.web/sites",
          teamOwnership: "platform",
        },
        {
          id: "azure:/subscriptions/sub-a/resourcegroups/rg-a/providers/microsoft.storage/storageaccounts/sa-new",
          type: "system",
          label: "sa-new",
          description: "microsoft.storage/storageaccounts @ eastus",
          technology: "microsoft.storage/storageaccounts",
          sourceResourceId:
            "/subscriptions/sub-a/resourcegroups/rg-a/providers/microsoft.storage/storageaccounts/sa-new",
          sourceResourceType: "microsoft.storage/storageaccounts",
        },
      ],
      edges: [
        {
          id: "azure-edge:new",
          source: existingAzure.id,
          target: "azure:/subscriptions/sub-a/resourcegroups/rg-a/providers/microsoft.storage/storageaccounts/sa-new",
          label: "depends_on",
          relationshipType: "depends_on",
          confidence: "high",
        },
      ],
    };

    const result = mergeAzureMappedGraphIntoCanvas({
      nodes: [manual, existingAzure, archivedAzure],
      edges,
      mapped,
      syncedAt: 1_700_000_000_000,
    });

    expect(result.nodes.map((node) => node.id).sort()).toEqual([
      "azure:/subscriptions/sub-a/resourcegroups/rg-a/providers/microsoft.storage/storageaccounts/sa-new",
      existingAzure.id,
      manual.id,
    ]);

    const mergedExisting = result.nodes.find((node) => node.id === existingAzure.id);
    expect(mergedExisting?.position).toEqual({ x: 420, y: 80 });
    expect(mergedExisting?.type).toBe("component");
    expect(mergedExisting?.data.label).toBe("site-a");
    expect(mergedExisting?.data.sourceProvider).toBe("azure");

    expect(result.edges.map((edge) => edge.id).sort()).toEqual([
      "azure-edge:new",
      "manual-edge",
    ]);
  });

  it("drops edges that target archived Azure nodes", () => {
    const manual = createManualNode("system-manual", "Manual", { x: 0, y: 0 });
    const staleAzure = createAzureNode(
      "azure:/subscriptions/sub-a/resourcegroups/rg-a/providers/microsoft.compute/virtualmachines/vm-stale",
      "vm-stale",
      { x: 420, y: 80 },
    );

    const result = mergeAzureMappedGraphIntoCanvas({
      nodes: [manual, staleAzure],
      edges: [
        {
          id: "manual-to-azure",
          source: manual.id,
          target: staleAzure.id,
          type: "default",
          label: "manual-link",
        },
      ],
      mapped: {
        nodes: [],
        edges: [],
      },
      syncedAt: 1_700_000_000_000,
    });

    expect(result.nodes.map((node) => node.id)).toEqual([manual.id]);
    expect(result.edges).toEqual([]);
  });
});
