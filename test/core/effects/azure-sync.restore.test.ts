/**
 * Undoing an Azure apply (ADR-020).
 *
 * Checkpoints have been written since the apply reordering, and until now
 * nothing could read them back onto a board. That left the recovery story
 * finished in the database and unfinished for the person who needs it.
 *
 * Restoring is itself destructive — it discards whatever happened after the
 * checkpoint — so it gets the same treatment as an apply: say what will be
 * lost, in counts, before anyone agrees to it.
 */

import type { AzureSyncCheckpoint } from "@/core/effects/azure-sync.checkpoints";
import { describeAzureRestorePlan, resolveAzureRestorePlan } from "@/core/effects/azure-sync.restore";
import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";

const node = (id: string): Node => ({ id, position: { x: 0, y: 0 }, data: {} });
const edge = (id: string, source: string, target: string): Edge => ({ id, source, target, data: {} });

const checkpoint = (
  nodes: ReadonlyArray<Node>,
  edges: ReadonlyArray<Edge> = [],
): AzureSyncCheckpoint => ({
  id: "azure-checkpoint-1",
  diagramId: "diagram-1",
  runId: "azure-sync-abc",
  checkpointType: "pre-apply",
  snapshot: {
    id: "diagram-1",
    name: "Estate",
    nodes: [...nodes],
    edges: [...edges],
    savedAt: 1_900,
  },
  createdAt: 2_000,
});

describe("resolveAzureRestorePlan", () => {
  it("counts what restoring brings back", () => {
    const plan = resolveAzureRestorePlan({
      checkpoint: checkpoint([node("azure:a"), node("azure:b")]),
      currentNodes: [node("azure:a")],
      currentEdges: [],
    });

    expect(plan.nodesRestored).toBe(1);
  });

  it("counts what restoring discards, which is the part worth warning about", () => {
    const plan = resolveAzureRestorePlan({
      checkpoint: checkpoint([node("azure:a")]),
      currentNodes: [node("azure:a"), node("azure:new"), node("manual-1")],
      currentEdges: [],
    });

    // Everything added since the checkpoint goes, including hand-drawn work
    // that had nothing to do with the sync.
    expect(plan.nodesDiscarded).toBe(2);
    expect(plan.discardsManualWork).toBe(true);
  });

  it("does not claim manual work is at risk when only Azure nodes are newer", () => {
    const plan = resolveAzureRestorePlan({
      checkpoint: checkpoint([node("azure:a")]),
      currentNodes: [node("azure:a"), node("azure:new")],
      currentEdges: [],
    });

    expect(plan.nodesDiscarded).toBe(1);
    expect(plan.discardsManualWork).toBe(false);
  });

  it("reports a no-op when the board already matches the checkpoint", () => {
    const plan = resolveAzureRestorePlan({
      checkpoint: checkpoint([node("azure:a")]),
      currentNodes: [node("azure:a")],
      currentEdges: [],
    });

    expect(plan.nodesRestored).toBe(0);
    expect(plan.nodesDiscarded).toBe(0);
    expect(plan.isNoOp).toBe(true);
  });

  it("counts discarded edges too", () => {
    const plan = resolveAzureRestorePlan({
      checkpoint: checkpoint([node("azure:a")], []),
      currentNodes: [node("azure:a")],
      currentEdges: [edge("azure-edge:new", "azure:a", "azure:a")],
    });

    expect(plan.edgesDiscarded).toBe(1);
    expect(plan.isNoOp).toBe(false);
  });
});

describe("describeAzureRestorePlan", () => {
  it("leads with the loss, not the recovery", () => {
    const summary = describeAzureRestorePlan(
      resolveAzureRestorePlan({
        // Both clauses present: one node comes back, one is discarded.
        checkpoint: checkpoint([node("azure:a"), node("azure:gone")]),
        currentNodes: [node("azure:a"), node("manual-1")],
        currentEdges: [],
      }),
    );

    // Matched on the clause, not the word — "RESTORE" also appears in the
    // APPROVAL:: label, which sits first by design.
    expect(summary).toContain("DISCARD 1 node");
    expect(summary).toContain("RESTORE 1 node");
    expect(summary.indexOf("DISCARD 1 node")).toBeLessThan(summary.indexOf("RESTORE 1 node"));
  });

  it("calls out hand-drawn work explicitly, since a sync undo should not eat it silently", () => {
    const summary = describeAzureRestorePlan(
      resolveAzureRestorePlan({
        checkpoint: checkpoint([node("azure:a")]),
        currentNodes: [node("azure:a"), node("manual-1")],
        currentEdges: [],
      }),
    );

    expect(summary.toLowerCase()).toContain("hand-drawn");
  });

  it("reads in the same vocabulary as the other Azure approvals", () => {
    const summary = describeAzureRestorePlan(
      resolveAzureRestorePlan({
        checkpoint: checkpoint([node("azure:a")]),
        currentNodes: [node("azure:a"), node("azure:new")],
        currentEdges: [],
      }),
    );

    expect(summary).toContain("APPROVAL::AZURE RESTORE");
    expect(summary).toContain("RISK::HIGH");
  });
});
