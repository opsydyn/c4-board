/**
 * OPY's Azure read tools (Gate 5).
 *
 * The Azure roadmap's acceptance criterion is that OPY can *cite* Azure
 * resources. It could not: citations are produced only by read tools, no Azure
 * read tool existed, and the one Azure document in retrieval was a counts-only
 * summary built from live panel state that vanished on reload.
 *
 * These tools read what now persists — provenanced board nodes and the sync run
 * trail — and return results a citation can be built from.
 */

import {
  azureResourceLookup,
  azureSyncSummary,
  buildAzureResourceCitation,
  buildAzureSyncCitation,
} from "@/core/effects/agent-tools/azure-tools";
import type { AzureSyncRunRecord } from "@/core/effects/azure-sync.runs";
import type { Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";

const azureNode = (id: string, overrides?: Record<string, unknown>): Node => ({
  id,
  position: { x: 0, y: 0 },
  type: "container",
  data: {
    label: id.split("/").pop() ?? id,
    c4Type: "container",
    sourceProvider: "azure",
    sourceResourceId: id.replace("azure:", ""),
    sourceResourceType: "microsoft.app/containerapps",
    lastSyncedAt: 1_700_000_000_000,
    ...overrides,
  },
});

const manualNode = (id: string): Node => ({
  id,
  position: { x: 0, y: 0 },
  type: "system",
  data: { label: id, c4Type: "system" },
});

const run = (overrides?: Partial<AzureSyncRunRecord>): AzureSyncRunRecord => ({
  id: "azure-sync-abc",
  diagramId: "diagram-1",
  subscriptionIds: ["sub-a"],
  resourceGroups: [],
  tagFilters: {},
  usedCustomQuery: false,
  status: "applied",
  resourceCount: 20,
  relationshipCount: 9,
  nodesCreated: 3,
  nodesUpdated: 1,
  nodesArchived: 0,
  nodesRetained: 2,
  edgesCreated: 4,
  edgesUpdated: 0,
  edgesArchived: 0,
  edgesRetained: 0,
  truncated: false,
  warnings: [],
  blockedReasons: [],
  checkpointId: "azure-checkpoint-abc",
  errorSummary: null,
  collectedAt: 1_699_999_000_000,
  createdAt: 1_700_000_000_000,
  ...overrides,
});

describe("azureResourceLookup", () => {
  it("finds only the board nodes Azure actually put there", () => {
    const result = azureResourceLookup(
      { query: null },
      { nodes: [azureNode("azure:/subs/s/app"), manualNode("system-manual")], edges: [], runs: [] },
    );

    expect(result.totalAzureNodes).toBe(1);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.nodeId).toBe("azure:/subs/s/app");
  });

  it("matches on resource type, which is how someone asks about a class of thing", () => {
    const result = azureResourceLookup(
      { query: "containerapps" },
      {
        nodes: [
          azureNode("azure:/subs/s/app"),
          azureNode("azure:/subs/s/registry", {
            sourceResourceType: "microsoft.containerregistry/registries",
          }),
        ],
        edges: [],
        runs: [],
      },
    );

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.resourceType).toBe("microsoft.app/containerapps");
  });

  it("matches on the resource id, so a full ARM id pasted from the portal resolves", () => {
    const result = azureResourceLookup(
      { query: "/SUBS/S/APP" },
      { nodes: [azureNode("azure:/subs/s/app")], edges: [], runs: [] },
    );

    expect(result.matches).toHaveLength(1);
  });

  it("says it found nothing rather than returning the whole board", () => {
    const result = azureResourceLookup(
      { query: "nothing-like-this" },
      { nodes: [azureNode("azure:/subs/s/app")], edges: [], runs: [] },
    );

    expect(result.matches).toEqual([]);
    expect(result.found).toBe(false);
  });

  it("reports a board with no Azure nodes as empty rather than as an error", () => {
    const result = azureResourceLookup(
      { query: null },
      { nodes: [manualNode("system-manual")], edges: [], runs: [] },
    );

    expect(result.totalAzureNodes).toBe(0);
    expect(result.found).toBe(false);
  });
});

describe("azureSyncSummary", () => {
  it("reports the most recent run", () => {
    const result = azureSyncSummary(
      {},
      { nodes: [], edges: [], runs: [run({ id: "newer", createdAt: 3_000 }), run({ id: "older", createdAt: 1_000 })] },
    );

    expect(result.lastRun?.runId).toBe("newer");
  });

  it("distinguishes never-synced from synced-and-empty", () => {
    // A board with no sync history is not a board whose estate is empty, and
    // OPY answering "there is nothing in Azure" to the first would be wrong.
    const result = azureSyncSummary({}, { nodes: [], edges: [], runs: [] });

    expect(result.hasSynced).toBe(false);
    expect(result.lastRun).toBeNull();
  });

  it("surfaces that a run was truncated, because it changes what the answer is worth", () => {
    const result = azureSyncSummary(
      {},
      { nodes: [], edges: [], runs: [run({ truncated: true, warnings: ["partial"] })] },
    );

    expect(result.lastRun?.truncated).toBe(true);
  });

  it("carries retained counts, so retention is visible as a deliberate choice", () => {
    const result = azureSyncSummary({}, { nodes: [], edges: [], runs: [run({ nodesRetained: 7 })] });

    expect(result.lastRun?.nodesRetained).toBe(7);
  });
});

describe("azure citations", () => {
  it("cites a resource by its Azure identity, not its board id", () => {
    const result = azureResourceLookup(
      { query: null },
      { nodes: [azureNode("azure:/subs/s/app")], edges: [], runs: [] },
    );

    const citation = buildAzureResourceCitation(result, "off");

    expect(citation?.tool).toBe("azure_resource_lookup");
    expect(citation?.detail).toContain("microsoft.app/containerapps");
  });

  it("withholds the resource id under strict redaction but still cites", () => {
    // The citation is what lets an operator check the claim, so it should
    // survive redaction even when the identifier cannot.
    const result = azureResourceLookup(
      { query: null },
      { nodes: [azureNode("azure:/subs/s/app")], edges: [], runs: [] },
    );

    const citation = buildAzureResourceCitation(result, "strict");

    expect(citation).not.toBeNull();
    expect(citation?.sourceId).toBeNull();
  });

  it("does not cite an Azure resource when none was found", () => {
    const result = azureResourceLookup({ query: "nope" }, { nodes: [], edges: [], runs: [] });

    expect(buildAzureResourceCitation(result, "off")).toBeNull();
  });

  it("does not cite a sync that never happened", () => {
    const result = azureSyncSummary({}, { nodes: [], edges: [], runs: [] });

    expect(buildAzureSyncCitation(result, "off")).toBeNull();
  });

  it("cites a real sync with what it did", () => {
    const result = azureSyncSummary({}, { nodes: [], edges: [], runs: [run()] });
    const citation = buildAzureSyncCitation(result, "off");

    expect(citation?.tool).toBe("azure_sync_summary");
    expect(citation?.detail).toContain("20 resources");
  });
});
