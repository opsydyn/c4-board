import { CloudIcon } from "@phosphor-icons/react";
import type { Edge, Node } from "@xyflow/react";
import { useMemo } from "react";
import type { AzureSyncDryRunOutput } from "../../core/effects/azure-sync.runtime";
import { useAzureSync } from "../hooks/useAzureSync";
import * as styles from "./AzureSyncPanel.css";

interface AzureSyncPanelProps {
  readonly nodes: readonly Node[];
  readonly edges: readonly Edge[];
  readonly diagramId?: string | null;
  readonly onApply?: (dryRun: AzureSyncDryRunOutput) => Promise<void>;
}

const formatTimestamp = (value: number | null): string => {
  if (value === null) {
    return "No sync activity yet";
  }

  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

export function AzureSyncPanel({
  nodes,
  edges,
  diagramId,
  onApply,
}: AzureSyncPanelProps) {
  const {
    form,
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
    existingAzureNodeCount,
    existingAzureEdgeCount,
    checkAuth,
    runDryRun,
    runApply,
    clearDryRun,
  } = useAzureSync({
    nodes,
    edges,
    ...(diagramId ? { diagramId } : {}),
    ...(onApply ? { onApply } : {}),
  });

  const authBadgeClassName = useMemo(() => {
    if (!authStatus) {
      return styles.syncStatusBadge;
    }

    if (!authStatus.available || !authStatus.authenticated) {
      return `${styles.syncStatusBadge} ${styles.syncStatusCritical}`;
    }

    return `${styles.syncStatusBadge} ${styles.syncStatusReady}`;
  }, [authStatus]);

  const authLabel = useMemo(() => {
    if (!authStatus) {
      return "AUTH::UNKNOWN";
    }
    if (!authStatus.available) {
      return "AUTH::UNAVAILABLE";
    }
    if (!authStatus.authenticated) {
      return "AUTH::REQUIRED";
    }
    return "AUTH::READY";
  }, [authStatus]);

  return (
    <section className={styles.syncCard} aria-label="Azure Resource Graph sync panel">
      <header className={styles.syncHeader}>
        <h2 className={styles.syncTitle}>
          <CloudIcon size={14} weight="duotone" aria-hidden="true" /> AZURE GRAPH SYNC
        </h2>
        <p className={styles.syncMeta}>
          Dry-run resource graph mapping before apply. Existing Azure entities: {existingAzureNodeCount} nodes /{" "}
          {existingAzureEdgeCount} edges
        </p>
      </header>

      <div className={styles.syncStatusRow}>
        <span className={authBadgeClassName}>{authLabel}</span>
        <span className={styles.syncMeta}>
          STRATEGY::{authStatus?.strategy ?? "UNCONFIGURED"}
        </span>
      </div>

      <div className={styles.syncForm}>
        <label className={styles.syncFormGroup}>
          <span className={styles.syncLabel}>Subscriptions (comma separated)</span>
          <input
            className={styles.syncInput}
            value={form.subscriptionIdsInput}
            onChange={(event) => setSubscriptionIdsInput(event.currentTarget.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
          />
        </label>
        <label className={styles.syncFormGroup}>
          <span className={styles.syncLabel}>Resource Groups (optional)</span>
          <input
            className={styles.syncInput}
            value={form.resourceGroupsInput}
            onChange={(event) => setResourceGroupsInput(event.currentTarget.value)}
            placeholder="rg-platform, rg-shared"
          />
        </label>
        <label className={styles.syncFormGroup}>
          <span className={styles.syncLabel}>Tag Filters (key=value, comma separated)</span>
          <input
            className={styles.syncInput}
            value={form.tagFiltersInput}
            onChange={(event) => setTagFiltersInput(event.currentTarget.value)}
            placeholder="team=platform, env=prod"
          />
        </label>
        <label className={styles.syncFormGroup}>
          <span className={styles.syncLabel}>Advanced Query (optional)</span>
          <input
            className={styles.syncInput}
            value={form.queryInput}
            onChange={(event) => setQueryInput(event.currentTarget.value)}
            placeholder="where type =~ 'microsoft.web/sites'"
          />
        </label>
      </div>

      <div className={styles.syncActions}>
        <button
          type="button"
          className={styles.syncButton}
          onClick={() => {
            void checkAuth();
          }}
          disabled={isCheckingAuth || isDryRunLoading}
        >
          {isCheckingAuth ? "CHECKING AUTH..." : "CHECK AUTH"}
        </button>
        <button
          type="button"
          className={styles.syncButton}
          onClick={() => {
            void runDryRun();
          }}
          disabled={isDryRunLoading || isCheckingAuth || isApplyLoading}
        >
          {isDryRunLoading ? "RUNNING PREVIEW..." : "RUN DRY-RUN"}
        </button>
        <button
          type="button"
          className={styles.syncButton}
          onClick={() => {
            void runApply();
          }}
          disabled={isDryRunLoading || isCheckingAuth || isApplyLoading || !dryRun}
        >
          {isApplyLoading ? "APPLYING..." : "APPLY TO BOARD"}
        </button>
        <button
          type="button"
          className={styles.syncButton}
          onClick={clearDryRun}
          disabled={isDryRunLoading || isApplyLoading}
        >
          CLEAR
        </button>
      </div>

      {error && <p className={styles.syncError}>SYNC ERROR :: {error}</p>}

      {!error && authStatus?.details && !authStatus.authenticated && (
        <p className={styles.syncWarning}>AUTH DETAIL :: {authStatus.details}</p>
      )}

      {dryRun && (
        <>
          <div className={styles.syncSummaryGrid}>
            <div className={styles.syncSummaryItem}>
              <span className={styles.syncSummaryLabel}>Run ID</span>
              <span className={styles.syncSummaryValue}>{dryRun.result.runId}</span>
            </div>
            <div className={styles.syncSummaryItem}>
              <span className={styles.syncSummaryLabel}>Collected At</span>
              <span className={styles.syncSummaryValue}>
                {formatTimestamp(dryRun.snapshot.collectedAt)}
              </span>
            </div>
            <div className={styles.syncSummaryItem}>
              <span className={styles.syncSummaryLabel}>Resources</span>
              <span className={styles.syncSummaryValue}>
                {dryRun.snapshot.resources.length}
              </span>
            </div>
            <div className={styles.syncSummaryItem}>
              <span className={styles.syncSummaryLabel}>Relationships</span>
              <span className={styles.syncSummaryValue}>
                {dryRun.snapshot.relationships.length}
              </span>
            </div>
            <div className={styles.syncSummaryItem}>
              <span className={styles.syncSummaryLabel}>Node Delta</span>
              <span className={styles.syncSummaryValue}>
                +{dryRun.result.delta.nodesToCreate} / ~{dryRun.result.delta.nodesToUpdate} / -
                {dryRun.result.delta.nodesToArchive}
              </span>
            </div>
            <div className={styles.syncSummaryItem}>
              <span className={styles.syncSummaryLabel}>Edge Delta</span>
              <span className={styles.syncSummaryValue}>
                +{dryRun.result.delta.edgesToCreate} / ~{dryRun.result.delta.edgesToUpdate} / -
                {dryRun.result.delta.edgesToArchive}
              </span>
            </div>
          </div>
          {dryRun.result.warnings.length > 0 && (
            <ul className={styles.syncList}>
              {dryRun.result.warnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          )}
        </>
      )}

      <p className={styles.syncMeta}>
        LAST UPDATE :: {formatTimestamp(lastUpdatedAt)}
      </p>
      <p className={styles.syncMeta}>
        LAST APPLY :: {formatTimestamp(lastAppliedAt)}
      </p>
    </section>
  );
}
