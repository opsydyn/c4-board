import type { Edge, Node } from "@xyflow/react";
import { Effect } from "effect";
import { useCallback, useMemo, useState } from "react";
import {
  type AzureApplyDecision,
  type AzureApplyPlan,
  type AzureApplyPolicy,
  resolveAzureApplyDecision,
} from "../../core/effects/azure-sync.apply-policy";
import type { AzureSyncEntitySnapshot } from "../../core/effects/azure-sync.diff";
import {
  type AzureSyncDryRunOutput,
  planAzureSyncDryRun,
  validateAzureGraphAuth,
} from "../../core/effects/azure-sync.runtime";
import {
  type AzureAuthStatus,
  type AzureSyncScope,
  fingerprintAzureBoardEdge,
  fingerprintAzureBoardNode,
  isAzureEdgeId,
  isAzureNodeId,
} from "../../core/effects/azure-sync.types";

interface UseAzureSyncInput {
  readonly nodes: readonly Node[];
  readonly edges: readonly Edge[];
  readonly diagramId?: string | null;
  readonly policy: AzureApplyPolicy;
  /**
   * Asked only when the plan removes something. Returning false abandons the
   * apply. Injected rather than called directly so the decision stays testable
   * and the hook stays free of `window`.
   */
  readonly confirmDestructiveApply: (plan: AzureApplyPlan) => boolean;
  readonly onApply?: (
    dryRun: AzureSyncDryRunOutput,
    plan: AzureApplyPlan,
  ) => Promise<void>;
}

interface AzureScopeFormState {
  readonly subscriptionIdsInput: string;
  readonly resourceGroupsInput: string;
  readonly tagFiltersInput: string;
  readonly queryInput: string;
}

interface UseAzureSyncResult {
  readonly form: AzureScopeFormState;
  readonly setSubscriptionIdsInput: (value: string) => void;
  readonly setResourceGroupsInput: (value: string) => void;
  readonly setTagFiltersInput: (value: string) => void;
  readonly setQueryInput: (value: string) => void;
  readonly authStatus: AzureAuthStatus | null;
  readonly isCheckingAuth: boolean;
  readonly isDryRunLoading: boolean;
  readonly isApplyLoading: boolean;
  readonly dryRun: AzureSyncDryRunOutput | null;
  readonly error: string | null;
  readonly lastUpdatedAt: number | null;
  readonly lastAppliedAt: number | null;
  /** The live gate for the current dry-run, or `null` before one exists. */
  readonly applyDecision: AzureApplyDecision | null;
  readonly acknowledgedUntrustedSnapshot: boolean;
  readonly acknowledgeUntrustedSnapshot: (acknowledged: boolean) => void;
  readonly existingAzureNodeCount: number;
  readonly existingAzureEdgeCount: number;
  readonly checkAuth: () => Promise<void>;
  readonly runDryRun: () => Promise<void>;
  readonly runApply: () => Promise<void>;
  readonly clearDryRun: () => void;
}

const toErrorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);

const parseCommaSeparated = (value: string): string[] =>
  value
    .split(",")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

const parseTagFilters = (value: string): Record<string, string> => {
  const output: Record<string, string> = {};

  for (const segment of parseCommaSeparated(value)) {
    const [rawKey, ...rest] = segment.split("=");
    const key = rawKey?.trim();
    const parsedValue = rest.join("=").trim();

    if (!key || parsedValue.length === 0) {
      continue;
    }
    output[key] = parsedValue;
  }

  return output;
};

const toAzureNodeSnapshot = (node: Node): AzureSyncEntitySnapshot => ({
  id: node.id,
  fingerprint: fingerprintAzureBoardNode(node),
});

const toAzureEdgeSnapshot = (edge: Edge): AzureSyncEntitySnapshot => ({
  id: edge.id,
  fingerprint: fingerprintAzureBoardEdge(edge),
});

const isAzureNode = (node: Node): boolean => isAzureNodeId(node.id);
const isAzureEdge = (edge: Edge): boolean => isAzureEdgeId(edge.id);

export const useAzureSync = (input: UseAzureSyncInput): UseAzureSyncResult => {
  const { nodes, edges, diagramId, onApply, policy, confirmDestructiveApply } = input;

  const [subscriptionIdsInput, setSubscriptionIdsInput] = useState("");
  const [resourceGroupsInput, setResourceGroupsInput] = useState("");
  const [tagFiltersInput, setTagFiltersInput] = useState("");
  const [queryInput, setQueryInput] = useState("");

  const [authStatus, setAuthStatus] = useState<AzureAuthStatus | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  const [isDryRunLoading, setIsDryRunLoading] = useState(false);
  const [isApplyLoading, setIsApplyLoading] = useState(false);
  const [dryRun, setDryRun] = useState<AzureSyncDryRunOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [lastAppliedAt, setLastAppliedAt] = useState<number | null>(null);
  const [acknowledgedUntrustedSnapshot, setAcknowledgedUntrustedSnapshot] = useState(false);

  const existingNodes = useMemo(
    () => nodes.filter(isAzureNode).map(toAzureNodeSnapshot),
    [nodes],
  );
  const existingEdges = useMemo(
    () => edges.filter(isAzureEdge).map(toAzureEdgeSnapshot),
    [edges],
  );

  const parsedScope = useMemo<AzureSyncScope>(
    () => {
      const subscriptionIds = parseCommaSeparated(subscriptionIdsInput);
      const resourceGroups = parseCommaSeparated(resourceGroupsInput);
      const tagFilters = parseTagFilters(tagFiltersInput);
      const query = queryInput.trim();

      return {
        subscriptionIds,
        ...(resourceGroups.length > 0 ? { resourceGroups } : {}),
        ...(Object.keys(tagFilters).length > 0 ? { tagFilters } : {}),
        ...(query.length > 0 ? { query } : {}),
      };
    },
    [queryInput, resourceGroupsInput, subscriptionIdsInput, tagFiltersInput],
  );

  const checkAuth = useCallback(async () => {
    setError(null);
    setIsCheckingAuth(true);

    try {
      const nextAuthStatus = await Effect.runPromise(validateAzureGraphAuth());
      setAuthStatus(nextAuthStatus);
      setLastUpdatedAt(Date.now());
    } catch (authError) {
      console.error("❌ Azure auth check failed", authError);
      setError(toErrorMessage(authError));
    } finally {
      setIsCheckingAuth(false);
    }
  }, []);

  const runDryRun = useCallback(async () => {
    setError(null);

    if (parsedScope.subscriptionIds.length === 0) {
      setError(
        "Provide at least one Azure Subscription ID before running a dry-run.",
      );
      return;
    }

    setIsDryRunLoading(true);
    try {
      const result = await Effect.runPromise(
        planAzureSyncDryRun({
          scope: parsedScope,
          existingNodes,
          existingEdges,
          ...(diagramId ? { idNamespace: diagramId } : {}),
        }),
      );
      setDryRun(result);
      setLastUpdatedAt(Date.now());
    } catch (dryRunError) {
      console.error("❌ Azure dry-run failed", dryRunError);
      setError(toErrorMessage(dryRunError));
    } finally {
      setIsDryRunLoading(false);
    }
  }, [diagramId, existingEdges, existingNodes, parsedScope]);

  /**
   * Computed for display as well as for the gate, so the panel can disable and
   * explain APPLY before it is pressed rather than failing after.
   */
  const applyDecision = useMemo<AzureApplyDecision | null>(
    () =>
      dryRun === null ? null : resolveAzureApplyDecision({
        policy,
        nodeDiff: dryRun.nodeDiff,
        edgeDiff: dryRun.edgeDiff,
        resourceCount: dryRun.snapshot.resources.length,
        warnings: dryRun.result.warnings,
        acknowledgedUntrustedSnapshot,
      }),
    [acknowledgedUntrustedSnapshot, dryRun, policy],
  );

  const clearDryRun = useCallback(() => {
    setDryRun(null);
    setError(null);
    setAcknowledgedUntrustedSnapshot(false);
  }, []);

  const runApply = useCallback(async () => {
    setError(null);

    if (!dryRun) {
      setError("Run a dry-run before applying Azure sync changes.");
      return;
    }

    if (!onApply) {
      setError("Azure apply handler is not configured.");
      return;
    }

    // The gate, not a warning (ADR-020). A truncated or empty snapshot cannot
    // be told apart from a deleted estate, so it does not reach the board.
    //
    // Recomputed here rather than read from `applyDecision` so the click acts
    // on the state at the moment it happened, not on a render that may have
    // been captured before the operator changed something.
    const decision = resolveAzureApplyDecision({
      policy,
      nodeDiff: dryRun.nodeDiff,
      edgeDiff: dryRun.edgeDiff,
      resourceCount: dryRun.snapshot.resources.length,
      warnings: dryRun.result.warnings,
      acknowledgedUntrustedSnapshot,
    });

    if (!decision.ok) {
      setError(
        decision.blocked
          .map((block) => `${block.message} ${block.recommendedAction}`)
          .join(" "),
      );
      return;
    }

    // Only ever asked when something is destroyed, so it does not become the
    // dialog people dismiss without reading.
    if (decision.plan.requiresConfirmation && !confirmDestructiveApply(decision.plan)) {
      return;
    }

    setIsApplyLoading(true);
    try {
      await onApply(dryRun, decision.plan);
      const appliedAt = Date.now();
      setLastAppliedAt(appliedAt);
      setLastUpdatedAt(appliedAt);
    } catch (applyError) {
      console.error("❌ Azure apply failed", applyError);
      setError(toErrorMessage(applyError));
    } finally {
      setIsApplyLoading(false);
    }
  }, [acknowledgedUntrustedSnapshot, confirmDestructiveApply, dryRun, onApply, policy]);

  return {
    form: {
      subscriptionIdsInput,
      resourceGroupsInput,
      tagFiltersInput,
      queryInput,
    },
    setSubscriptionIdsInput,
    setResourceGroupsInput,
    setTagFiltersInput,
    setQueryInput,
    authStatus,
    isCheckingAuth,
    isDryRunLoading,
    isApplyLoading,
    dryRun,
    error,
    lastUpdatedAt,
    lastAppliedAt,
    applyDecision,
    acknowledgedUntrustedSnapshot,
    acknowledgeUntrustedSnapshot: setAcknowledgedUntrustedSnapshot,
    existingAzureNodeCount: existingNodes.length,
    existingAzureEdgeCount: existingEdges.length,
    checkAuth,
    runDryRun,
    runApply,
    clearDryRun,
  };
};
