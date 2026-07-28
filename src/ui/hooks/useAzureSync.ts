import type { Edge, Node } from "@xyflow/react";
import { Effect } from "effect";
import { useCallback, useMemo, useState } from "react";
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
  readonly onApply?: (dryRun: AzureSyncDryRunOutput) => Promise<void>;
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
  const { nodes, edges, diagramId, onApply } = input;

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

  const clearDryRun = useCallback(() => {
    setDryRun(null);
    setError(null);
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

    setIsApplyLoading(true);
    try {
      await onApply(dryRun);
      const appliedAt = Date.now();
      setLastAppliedAt(appliedAt);
      setLastUpdatedAt(appliedAt);
    } catch (applyError) {
      console.error("❌ Azure apply failed", applyError);
      setError(toErrorMessage(applyError));
    } finally {
      setIsApplyLoading(false);
    }
  }, [dryRun, onApply]);

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
    existingAzureNodeCount: existingNodes.length,
    existingAzureEdgeCount: existingEdges.length,
    checkAuth,
    runDryRun,
    runApply,
    clearDryRun,
  };
};
