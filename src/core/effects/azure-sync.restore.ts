/**
 * Undoing an Azure apply (ADR-020).
 *
 * Checkpoints were being written with nothing able to read them back onto a
 * board, which left the recovery story finished in the database and unfinished
 * for the person who needs it.
 *
 * Restoring is itself destructive: it discards everything that happened after
 * the checkpoint, including hand-drawn work that had nothing to do with the
 * sync. So it gets the same treatment as an apply — the loss is counted and
 * stated before anyone agrees to it, rather than described as "undo" and left
 * to sound safe.
 */

import type { Edge, Node } from "@xyflow/react";
import type { AzureSyncCheckpoint } from "./azure-sync.checkpoints";
import { isAzureEdgeId, isAzureNodeId } from "./azure-sync.types";

export interface AzureRestorePlan {
  /** On the board now, absent from the checkpoint — these go. */
  readonly nodesDiscarded: number;
  readonly edgesDiscarded: number;
  /** In the checkpoint, missing from the board now — these come back. */
  readonly nodesRestored: number;
  readonly edgesRestored: number;
  /**
   * Whether anything being discarded was drawn by hand rather than synced.
   *
   * Worth separating: losing a node Azure will re-create on the next sync is
   * very different from losing one a person drew, which nothing will bring back.
   */
  readonly discardsManualWork: boolean;
  readonly isNoOp: boolean;
  readonly checkpointCreatedAt: number;
}

export interface AzureRestorePlanInput {
  readonly checkpoint: AzureSyncCheckpoint;
  readonly currentNodes: ReadonlyArray<Node>;
  readonly currentEdges: ReadonlyArray<Edge>;
}

export const resolveAzureRestorePlan = (
  input: AzureRestorePlanInput,
): AzureRestorePlan => {
  const snapshotNodeIds = new Set(input.checkpoint.snapshot.nodes.map((node) => node.id));
  const snapshotEdgeIds = new Set(input.checkpoint.snapshot.edges.map((edge) => edge.id));
  const currentNodeIds = new Set(input.currentNodes.map((node) => node.id));
  const currentEdgeIds = new Set(input.currentEdges.map((edge) => edge.id));

  const discardedNodes = input.currentNodes.filter((node) => !snapshotNodeIds.has(node.id));
  const discardedEdges = input.currentEdges.filter((edge) => !snapshotEdgeIds.has(edge.id));

  const nodesRestored = [...snapshotNodeIds].filter((id) => !currentNodeIds.has(id)).length;
  const edgesRestored = [...snapshotEdgeIds].filter((id) => !currentEdgeIds.has(id)).length;

  const discardsManualWork = discardedNodes.some((node) => !isAzureNodeId(node.id))
    || discardedEdges.some((edge) => !isAzureEdgeId(edge.id));

  return {
    nodesDiscarded: discardedNodes.length,
    edgesDiscarded: discardedEdges.length,
    nodesRestored,
    edgesRestored,
    discardsManualWork,
    isNoOp: discardedNodes.length === 0 && discardedEdges.length === 0
      && nodesRestored === 0 && edgesRestored === 0,
    checkpointCreatedAt: input.checkpoint.createdAt,
  };
};

/**
 * The line an operator reads before undoing an apply.
 *
 * Discards come first, for the same reason removals lead the apply
 * confirmation: it is the part that cannot be got back by running the sync
 * again. Always high risk — there is no version of replacing a board wholesale
 * that deserves a softer word.
 */
export const describeAzureRestorePlan = (plan: AzureRestorePlan): string =>
  [
    "APPROVAL::AZURE RESTORE",
    "RISK::HIGH",
    plan.nodesDiscarded + plan.edgesDiscarded > 0
      ? `DISCARD ${plan.nodesDiscarded} node(s) and ${plan.edgesDiscarded} edge(s) added since the checkpoint`
      : null,
    plan.discardsManualWork
      ? "Some of what is discarded is hand-drawn and will not come back on the next sync"
      : null,
    plan.nodesRestored + plan.edgesRestored > 0
      ? `RESTORE ${plan.nodesRestored} node(s) and ${plan.edgesRestored} edge(s)`
      : null,
  ].filter((part): part is string => part !== null).join(" · ");
