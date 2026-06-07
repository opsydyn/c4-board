import { CloudIcon } from "@phosphor-icons/react";
import type { Edge, Node } from "@xyflow/react";
import { useEffect, useMemo } from "react";
import type { RigAgentAzureSyncRetrievalSnapshot } from "../../core/effects/agent-retrieval";
import type { AzureSyncDryRunOutput } from "../../core/effects/azure-sync.runtime";
import type { AzureRelationshipConfidence, AzureRelationshipSource } from "../../core/effects/azure-sync.types";
import { useAzureSync } from "../hooks/useAzureSync";
import * as styles from "./AzureSyncPanel.css";

interface AzureSyncPanelProps {
  readonly nodes: readonly Node[];
  readonly edges: readonly Edge[];
  readonly diagramId?: string | null;
  readonly onApply?: (dryRun: AzureSyncDryRunOutput) => Promise<void>;
  readonly onSummaryChange?: (summary: RigAgentAzureSyncRetrievalSnapshot | null) => void;
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

const countCommaSeparatedEntries = (value: string): number =>
  value
    .split(",")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0).length;

const EDGE_SOURCE_ORDER: readonly AzureRelationshipSource[] = [
  "arm_depends_on",
  "property_ref",
  "arm_parent",
  "inferred",
];

const EDGE_SOURCE_LABELS: Record<AzureRelationshipSource, string> = {
  arm_depends_on: "DEPENDS_ON",
  property_ref: "PROPERTY_REF",
  arm_parent: "ARM_PARENT",
  inferred: "INFERRED",
};

const EDGE_CONFIDENCE_ORDER: readonly AzureRelationshipConfidence[] = [
  "high",
  "medium",
  "low",
];

const EDGE_CONFIDENCE_LABELS: Record<AzureRelationshipConfidence, string> = {
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
};

type TelemetryTone = "ready" | "caution" | "critical" | "selected";

const SOURCE_TONE: Record<AzureRelationshipSource, TelemetryTone> = {
  arm_depends_on: "ready",
  property_ref: "selected",
  arm_parent: "caution",
  inferred: "critical",
};

const CONFIDENCE_TONE: Record<AzureRelationshipConfidence, TelemetryTone> = {
  high: "ready",
  medium: "caution",
  low: "critical",
};

const TELEMETRY_TONE_CLASS: Record<TelemetryTone, string> = {
  ready: styles.telemetryBadgeReady,
  caution: styles.telemetryBadgeCaution,
  critical: styles.telemetryBadgeCritical,
  selected: styles.telemetryBadgeSelected,
};

const TELEMETRY_COUNT_TONE_CLASS: Record<TelemetryTone, string> = {
  ready: styles.telemetryBadgeCountReady,
  caution: styles.telemetryBadgeCountCaution,
  critical: styles.telemetryBadgeCountCritical,
  selected: styles.telemetryBadgeCountSelected,
};

const RELATIONSHIP_INFERRED_WARNING_THRESHOLD_PERCENT = 60;
const RELATIONSHIP_INFERRED_WARNING_THRESHOLD_RATIO = RELATIONSHIP_INFERRED_WARNING_THRESHOLD_PERCENT / 100;

export function AzureSyncPanel({
  nodes,
  edges,
  diagramId,
  onApply,
  onSummaryChange,
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

  const relationshipTelemetry = useMemo(() => {
    if (!dryRun) {
      return null;
    }

    const sourceCounts: Record<AzureRelationshipSource, number> = {
      arm_depends_on: 0,
      property_ref: 0,
      arm_parent: 0,
      inferred: 0,
    };

    const confidenceCounts: Record<AzureRelationshipConfidence, number> = {
      high: 0,
      medium: 0,
      low: 0,
    };

    for (const relationship of dryRun.snapshot.relationships) {
      sourceCounts[relationship.source] += 1;
      confidenceCounts[relationship.confidence] += 1;
    }

    const total = dryRun.snapshot.relationships.length;
    const inferredCount = sourceCounts.inferred;
    const inferredRatio = total > 0 ? inferredCount / total : 0;

    const warnings: string[] = [];
    if (total > 0 && inferredRatio >= RELATIONSHIP_INFERRED_WARNING_THRESHOLD_RATIO) {
      warnings.push(
        `RELATIONSHIP TRUST WARNING :: ${
          Math.round(inferredRatio * 100)
        }% inferred links (threshold ${RELATIONSHIP_INFERRED_WARNING_THRESHOLD_PERCENT}%). Consider refining query scope.`,
      );
    }
    if (total > 0 && confidenceCounts.high === 0) {
      warnings.push(
        "RELATIONSHIP TRUST WARNING :: No high-confidence links detected in this run.",
      );
    }

    return {
      sourceCounts,
      confidenceCounts,
      sourceTelemetry: EDGE_SOURCE_ORDER.map((source) => ({
        source,
        label: EDGE_SOURCE_LABELS[source],
        count: sourceCounts[source],
        tone: SOURCE_TONE[source],
      })),
      confidenceTelemetry: EDGE_CONFIDENCE_ORDER.map((confidence) => ({
        confidence,
        label: EDGE_CONFIDENCE_LABELS[confidence],
        count: confidenceCounts[confidence],
        tone: CONFIDENCE_TONE[confidence],
      })),
      warnings,
    };
  }, [dryRun]);

  const dryRunWarnings = useMemo(() => {
    if (!dryRun) {
      return [];
    }

    const combinedWarnings = [...dryRun.result.warnings];
    if (relationshipTelemetry) {
      combinedWarnings.push(...relationshipTelemetry.warnings);
    }

    return [...new Set(combinedWarnings)];
  }, [dryRun, relationshipTelemetry]);

  const retrievalSummary = useMemo<RigAgentAzureSyncRetrievalSnapshot | null>(() => {
    const hasSignal = authStatus !== null
      || dryRun !== null
      || error !== null
      || lastUpdatedAt !== null
      || lastAppliedAt !== null
      || existingAzureNodeCount > 0
      || existingAzureEdgeCount > 0
      || form.subscriptionIdsInput.trim().length > 0
      || form.resourceGroupsInput.trim().length > 0
      || form.tagFiltersInput.trim().length > 0
      || form.queryInput.trim().length > 0;

    if (!hasSignal) {
      return null;
    }

    const authState = !authStatus
      ? "unknown"
      : !authStatus.available
        ? "unavailable"
        : authStatus.authenticated
          ? "ready"
          : "required";

    return {
      authState,
      authStrategy: authStatus?.strategy ?? null,
      subscriptionCount: countCommaSeparatedEntries(form.subscriptionIdsInput),
      resourceGroupCount: countCommaSeparatedEntries(form.resourceGroupsInput),
      tagFilterCount: countCommaSeparatedEntries(form.tagFiltersInput),
      advancedQuery: form.queryInput.trim() || null,
      existingAzureNodeCount,
      existingAzureEdgeCount,
      previewResourceCount: dryRun?.snapshot.resources.length ?? 0,
      previewRelationshipCount: dryRun?.snapshot.relationships.length ?? 0,
      mappedNodeCount: dryRun?.mapped.nodes.length ?? 0,
      mappedEdgeCount: dryRun?.mapped.edges.length ?? 0,
      plannedNodeCreates: dryRun?.nodeDiff.create.length ?? 0,
      plannedNodeUpdates: dryRun?.nodeDiff.update.length ?? 0,
      plannedNodeArchives: dryRun?.nodeDiff.archive.length ?? 0,
      plannedEdgeCreates: dryRun?.edgeDiff.create.length ?? 0,
      plannedEdgeUpdates: dryRun?.edgeDiff.update.length ?? 0,
      plannedEdgeArchives: dryRun?.edgeDiff.archive.length ?? 0,
      warningCount: dryRunWarnings.length,
      warnings: dryRunWarnings,
      lastStatus: dryRun?.result.status ?? (error ? "failed" : lastAppliedAt !== null ? "applied" : "idle"),
      lastUpdatedAt,
      lastAppliedAt,
      lastError: error,
    };
  }, [
    authStatus,
    dryRun,
    dryRunWarnings,
    error,
    existingAzureEdgeCount,
    existingAzureNodeCount,
    form.queryInput,
    form.resourceGroupsInput,
    form.subscriptionIdsInput,
    form.tagFiltersInput,
    lastAppliedAt,
    lastUpdatedAt,
  ]);

  useEffect(() => {
    onSummaryChange?.(retrievalSummary);
  }, [onSummaryChange, retrievalSummary]);

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
            {relationshipTelemetry && (
              <>
                <div className={styles.syncSummaryItem}>
                  <span className={styles.syncSummaryLabel}>Relationship Sources</span>
                  <div className={styles.telemetryBadgeRow}>
                    {relationshipTelemetry.sourceTelemetry.map((entry) => (
                      <span
                        key={entry.source}
                        className={`${styles.telemetryBadge} ${TELEMETRY_TONE_CLASS[entry.tone]}`}
                      >
                        <span>{entry.label}</span>
                        <span
                          className={`${styles.telemetryBadgeCount} ${TELEMETRY_COUNT_TONE_CLASS[entry.tone]}`}
                        >
                          {entry.count}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
                <div className={styles.syncSummaryItem}>
                  <span className={styles.syncSummaryLabel}>Relationship Confidence</span>
                  <div className={styles.telemetryBadgeRow}>
                    {relationshipTelemetry.confidenceTelemetry.map((entry) => (
                      <span
                        key={entry.confidence}
                        className={`${styles.telemetryBadge} ${TELEMETRY_TONE_CLASS[entry.tone]}`}
                      >
                        <span>{entry.label}</span>
                        <span
                          className={`${styles.telemetryBadgeCount} ${TELEMETRY_COUNT_TONE_CLASS[entry.tone]}`}
                        >
                          {entry.count}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          {dryRunWarnings.length > 0 && (
            <ul className={styles.syncList}>
              {dryRunWarnings.map((warning) => <li key={warning}>{warning}</li>)}
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
