/**
 * The gate between a reviewed dry-run and a destructive apply (ADR-020).
 *
 * Azure sync used to apply whatever the merge computed, with the dry-run as
 * decoration. Three ordinary situations reached the delete path that way: a
 * typo in the scope, a snapshot truncated by the paging guardrail, and a query
 * returning nothing. The diff cannot tell any of them apart from a subscription
 * that was genuinely emptied — only the caller can, and it did not try.
 *
 * Pure by design. It decides; the runtime and the panel carry it out.
 */

import type { AzureSyncDiffResult } from "./azure-sync.diff";

export interface AzureApplyPolicy {
  /**
   * Whether entities Azure no longer reports are removed from the board.
   *
   * Off by default (ADR-020). A stale node is visible, inspectable, and
   * removable by hand; a deleted one takes its manual edges and layout with it.
   */
  readonly archiveMissing: boolean;
  /** Hard cap on operations in a single apply. Exceeding it blocks. */
  readonly maxApplyOperations: number;
}

export type AzureApplyBlockReason = "untrusted-snapshot" | "operation-limit";

export interface AzureApplyBlock {
  readonly reason: AzureApplyBlockReason;
  readonly message: string;
  readonly recommendedAction: string;
}

export interface AzureApplyPlan {
  readonly nodesToCreate: number;
  readonly nodesToUpdate: number;
  readonly nodesToArchive: number;
  readonly edgesToCreate: number;
  readonly edgesToUpdate: number;
  readonly edgesToArchive: number;
  /** Entities Azure stopped reporting that this apply will leave alone. */
  readonly nodesRetained: number;
  readonly edgesRetained: number;
  /** Creates, updates, and archives. Retained entities are not work. */
  readonly totalOperations: number;
  readonly destructive: boolean;
  readonly requiresConfirmation: boolean;
}

export interface AzureApplyDecisionInput {
  readonly policy: AzureApplyPolicy;
  readonly nodeDiff: AzureSyncDiffResult;
  readonly edgeDiff: AzureSyncDiffResult;
  /** Resources in the snapshot the diff was computed from. */
  readonly resourceCount: number;
  readonly warnings: ReadonlyArray<string>;
  /**
   * Set only by a deliberate operator action, and only ever unblocks snapshot
   * trust. It is not consent to exceed the operation cap.
   */
  readonly acknowledgedUntrustedSnapshot: boolean;
}

export type AzureApplyDecision =
  & { readonly plan: AzureApplyPlan }
  & (
    | { readonly ok: true; readonly blocked: readonly [] }
    | { readonly ok: false; readonly blocked: ReadonlyArray<AzureApplyBlock> }
  );

/**
 * A warning that means the snapshot is missing resources that exist.
 *
 * Matched on substance rather than an exact string because the Rust side builds
 * the message with the page count interpolated.
 */
const TRUNCATION_MARKERS = ["guardrail", "partial", "truncat", "skip-token"] as const;

const isTruncationWarning = (warning: string): boolean => {
  const normalized = warning.toLowerCase();
  return TRUNCATION_MARKERS.some((marker) => normalized.includes(marker));
};

export const buildAzureApplyPlan = (
  input: Pick<AzureApplyDecisionInput, "policy" | "nodeDiff" | "edgeDiff">,
): AzureApplyPlan => {
  const { archiveMissing } = input.policy;

  const nodesToArchive = archiveMissing ? input.nodeDiff.archive.length : 0;
  const edgesToArchive = archiveMissing ? input.edgeDiff.archive.length : 0;
  const nodesRetained = archiveMissing ? 0 : input.nodeDiff.archive.length;
  const edgesRetained = archiveMissing ? 0 : input.edgeDiff.archive.length;

  const nodesToCreate = input.nodeDiff.create.length;
  const nodesToUpdate = input.nodeDiff.update.length;
  const edgesToCreate = input.edgeDiff.create.length;
  const edgesToUpdate = input.edgeDiff.update.length;

  const destructive = nodesToArchive > 0 || edgesToArchive > 0;

  return {
    nodesToCreate,
    nodesToUpdate,
    nodesToArchive,
    edgesToCreate,
    edgesToUpdate,
    edgesToArchive,
    nodesRetained,
    edgesRetained,
    totalOperations: nodesToCreate + nodesToUpdate + nodesToArchive
      + edgesToCreate + edgesToUpdate + edgesToArchive,
    destructive,
    requiresConfirmation: destructive,
  };
};

export const resolveAzureApplyDecision = (
  input: AzureApplyDecisionInput,
): AzureApplyDecision => {
  const plan = buildAzureApplyPlan(input);
  const blocked: AzureApplyBlock[] = [];

  const truncated = input.warnings.some(isTruncationWarning);
  const empty = input.resourceCount === 0;

  if ((truncated || empty) && !input.acknowledgedUntrustedSnapshot) {
    blocked.push({
      reason: "untrusted-snapshot",
      message: empty
        ? "Azure returned no resources for this scope. An empty result and a deleted estate look identical from here."
        : "Azure returned a partial result. Resources beyond the paging guardrail are missing from this snapshot.",
      recommendedAction: empty
        ? "Check the subscription and resource group filters, then run the dry-run again."
        : "Narrow the scope so the estate fits inside the paging guardrail, then run the dry-run again.",
    });
  }

  if (plan.totalOperations > input.policy.maxApplyOperations) {
    blocked.push({
      reason: "operation-limit",
      message:
        `This apply would perform ${plan.totalOperations} operations, over the limit of ${input.policy.maxApplyOperations}.`,
      recommendedAction: "Narrow the scope, or raise the Azure apply limit in Settings.",
    });
  }

  return blocked.length === 0
    ? { ok: true, blocked: [], plan }
    : { ok: false, blocked, plan };
};
