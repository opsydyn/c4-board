/**
 * Proof of the defect this fix removes, kept as a test so it cannot come back.
 *
 * The old code fingerprinted board nodes over `{type, width, height, position,
 * data}` and mapper output over a different projection entirely. This
 * reconstructs both and asserts what an operator actually saw: a board that
 * nobody had touched reporting every node as changed.
 */

import { mergeAzureMappedGraphIntoCanvas } from "@/core/effects/azure-sync.apply";
import { diffAzureSyncEntities } from "@/core/effects/azure-sync.diff";
import type { AzureMappedNode } from "@/core/effects/azure-sync.mapper";
import { fingerprintAzureBoardNode, fingerprintAzureMappedNode } from "@/core/effects/azure-sync.types";
import { describe, expect, it } from "vitest";

const SYNCED_AT = 1_700_000_000_000;

const node: AzureMappedNode = {
  id: "azure:/subscriptions/s1/resourcegroups/rg1/providers/microsoft.web/sites/api",
  type: "container",
  label: "api",
  technology: "microsoft.web/sites",
  description: "App Service",
  sourceResourceId: "/subscriptions/s1/resourcegroups/rg1/providers/microsoft.web/sites/api",
  sourceResourceType: "microsoft.web/sites",
};

const boardNode = () => {
  const merged = mergeAzureMappedGraphIntoCanvas({
    nodes: [],
    edges: [],
    mapped: { nodes: [node], edges: [] },
    syncedAt: SYNCED_AT,
  });
  return merged.nodes.find((candidate) => candidate.id === node.id)!;
};

/** The projection the panel used before this fix. */
const legacyBoardFingerprint = (candidate: ReturnType<typeof boardNode>): string =>
  JSON.stringify({
    type: candidate.type ?? null,
    width: candidate.width ?? null,
    height: candidate.height ?? null,
    position: candidate.position,
    data: candidate.data ?? null,
  });

/** The projection the runtime used before this fix. */
const legacyMappedFingerprint = (candidate: AzureMappedNode): string =>
  JSON.stringify({
    type: candidate.type,
    label: candidate.label,
    technology: candidate.technology,
    description: candidate.description,
    sourceResourceId: candidate.sourceResourceId,
    sourceResourceType: candidate.sourceResourceType,
    parentGroupId: candidate.parentGroupId ?? null,
    isSyntheticContainer: candidate.isSyntheticContainer ?? false,
    teamOwnership: candidate.teamOwnership ?? null,
  });

describe("the dry-run delta defect", () => {
  it("used to report an untouched node as changed", () => {
    const board = boardNode();

    // The two projections could never agree, whatever the data.
    expect(legacyBoardFingerprint(board)).not.toBe(legacyMappedFingerprint(node));

    const legacyDiff = diffAzureSyncEntities(
      [{ id: board.id, fingerprint: legacyBoardFingerprint(board) }],
      [{ id: node.id, fingerprint: legacyMappedFingerprint(node) }],
    );

    expect(legacyDiff.update).toHaveLength(1);
    expect(legacyDiff.unchanged).toHaveLength(0);
  });

  it("now reports it as unchanged, which is the truth", () => {
    const board = boardNode();

    const diff = diffAzureSyncEntities(
      [{ id: board.id, fingerprint: fingerprintAzureBoardNode(board) }],
      [{ id: node.id, fingerprint: fingerprintAzureMappedNode(node) }],
    );

    expect(diff.unchanged).toHaveLength(1);
    expect(diff.update).toHaveLength(0);
    expect(diff.archive).toHaveLength(0);
  });
});
