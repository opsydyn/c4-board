import type { LayoutHistoryArtifact } from "@/core/effects/layout-history-export";
import type { LayoutApplicationAudit } from "@/core/effects/layout.types";
import { ClockCounterClockwiseIcon, DownloadSimpleIcon, TrashIcon, XIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import * as styles from "./LayoutHistoryTable.css";

export interface LayoutHistoryTableProps {
  audits: ReadonlyArray<LayoutApplicationAudit>;
  onDeleteAudit?: (appliedAt: number) => Promise<void>;
  onClearAudits?: () => Promise<void>;
  onPrepareExport?: () => Promise<LayoutHistoryArtifact>;
  onDownloadExport?: (artifact: LayoutHistoryArtifact) => void;
}

const metricLabels: Record<LayoutApplicationAudit["comparisonMetrics"][number]["key"], string> = {
  overlaps: "Overlaps",
  canvasArea: "Canvas area",
  routedCrossings: "Routed crossings",
  routedLength: "Routed length",
};

const formatVariant = (variant: LayoutApplicationAudit["selectedVariant"]) =>
  `${variant.charAt(0).toUpperCase()}${variant.slice(1)} layout`;

const formatMetric = (key: string, value: number) =>
  key === "canvasArea" || key === "routedLength"
    ? Math.round(value).toLocaleString()
    : value.toLocaleString();

export function LayoutHistoryTable({
  audits,
  onDeleteAudit,
  onClearAudits,
  onPrepareExport,
  onDownloadExport,
}: LayoutHistoryTableProps) {
  const [selectedAt, setSelectedAt] = useState<number | null>(audits[0]?.appliedAt ?? null);
  const [confirmation, setConfirmation] = useState<"delete" | "clear" | null>(null);
  const [isDeleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [preparedArtifact, setPreparedArtifact] = useState<LayoutHistoryArtifact | null>(null);
  const selected = audits.find((audit) => audit.appliedAt === selectedAt) ?? audits[0] ?? null;

  useEffect(() => {
    if (!selected && audits[0]) setSelectedAt(audits[0].appliedAt);
  }, [audits, selected]);

  useEffect(() => {
    setPreparedArtifact(null);
  }, [audits]);

  const runDeletion = async (operation: () => Promise<void>) => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await operation();
      setConfirmation(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Layout history operation failed");
    } finally {
      setDeleting(false);
    }
  };

  const prepareExport = async () => {
    if (!onPrepareExport) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      setPreparedArtifact(await onPrepareExport());
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Layout history export failed");
    } finally {
      setDeleting(false);
    }
  };

  if (!selected) {
    return (
      <div className={styles.emptyState}>
        <ClockCounterClockwiseIcon size={22} aria-hidden="true" />
        <span>No accepted layouts yet</span>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.list} aria-label="Accepted layout history">
        <div className={styles.listHeader}>
          <span>Layout applications</span>
          <span>{audits.length}</span>
        </div>
        {audits.map((audit) => {
          const active = audit.appliedAt === selected.appliedAt;
          return (
            <button
              key={audit.appliedAt}
              type="button"
              className={active ? `${styles.entry} ${styles.entryActive}` : styles.entry}
              aria-pressed={active}
              aria-label={`${formatVariant(audit.selectedVariant)}, ${audit.preset}`}
              onClick={() => setSelectedAt(audit.appliedAt)}
            >
              <strong>{formatVariant(audit.selectedVariant)}</strong>
              <span>{audit.preset}</span>
              <time dateTime={new Date(audit.appliedAt).toISOString()}>
                {new Date(audit.appliedAt).toLocaleString()}
              </time>
            </button>
          );
        })}
      </div>
      <article className={styles.detail} aria-live="polite">
        <header className={styles.detailHeader}>
          <div>
            <span className={styles.eyebrow}>Accepted layout</span>
            <h3>{formatVariant(selected.selectedVariant)}</h3>
          </div>
          <div className={styles.meta}>
            <span>Strategy::{selected.strategyId}</span>
            <span>Engine::{selected.engine}</span>
          </div>
          {(onPrepareExport || (onDeleteAudit && onClearAudits)) && (
            <div className={styles.historyActions}>
              {onPrepareExport && !preparedArtifact && (
                <button
                  type="button"
                  className={styles.exportButton}
                  disabled={isDeleting}
                  aria-label="Prepare layout audit history export"
                  onClick={() => void prepareExport()}
                >
                  <DownloadSimpleIcon size={15} aria-hidden="true" /> Prepare JSON
                </button>
              )}
              {preparedArtifact && onDownloadExport && (
                <button
                  type="button"
                  className={styles.exportButton}
                  disabled={isDeleting}
                  aria-label="Download layout audit history"
                  onClick={() => onDownloadExport(preparedArtifact)}
                >
                  <DownloadSimpleIcon size={15} aria-hidden="true" /> Download JSON
                </button>
              )}
              {onDeleteAudit && onClearAudits && (confirmation === "delete"
                ? (
                  <>
                    <button
                      type="button"
                      className={styles.dangerButton}
                      disabled={isDeleting}
                      aria-label="Confirm delete selected layout audit"
                      onClick={() => void runDeletion(() => onDeleteAudit(selected.appliedAt))}
                    >
                      <TrashIcon size={14} aria-hidden="true" /> Confirm delete
                    </button>
                    <button
                      type="button"
                      className={styles.cancelButton}
                      disabled={isDeleting}
                      aria-label="Cancel delete selected layout audit"
                      onClick={() => setConfirmation(null)}
                    >
                      <XIcon size={14} aria-hidden="true" />
                    </button>
                  </>
                )
                : (
                  <button
                    type="button"
                    className={styles.iconButton}
                    disabled={isDeleting}
                    aria-label="Delete selected layout audit"
                    title="Delete selected audit"
                    onClick={() => setConfirmation("delete")}
                  >
                    <TrashIcon size={15} aria-hidden="true" />
                  </button>
                ))}
              {onDeleteAudit && onClearAudits && (confirmation === "clear"
                ? (
                  <>
                    <button
                      type="button"
                      className={styles.dangerButton}
                      disabled={isDeleting}
                      aria-label="Confirm clear layout audit history"
                      onClick={() => void runDeletion(onClearAudits)}
                    >
                      Clear all
                    </button>
                    <button
                      type="button"
                      className={styles.cancelButton}
                      disabled={isDeleting}
                      aria-label="Cancel clear layout audit history"
                      onClick={() => setConfirmation(null)}
                    >
                      <XIcon size={14} aria-hidden="true" />
                    </button>
                  </>
                )
                : (
                  <button
                    type="button"
                    className={styles.clearButton}
                    disabled={isDeleting}
                    aria-label="Clear layout audit history"
                    onClick={() => setConfirmation("clear")}
                  >
                    Clear history
                  </button>
                ))}
            </div>
          )}
        </header>
        {deleteError && <p className={styles.error} role="alert">{deleteError}</p>}
        {preparedArtifact && (
          <section className={styles.exportReview} aria-label="Layout history export review">
            <div className={styles.exportReviewHeader}>
              <div>
                <span className={styles.eyebrow}>Version {preparedArtifact.version} artifact</span>
                <h4>Export review</h4>
              </div>
              <span>{preparedArtifact.summary.applicationCount} applications</span>
            </div>
            <dl className={styles.exportSummary}>
              <div>
                <dt>Range</dt>
                <dd>
                  {preparedArtifact.summary.firstAppliedAt === null
                    ? "Empty"
                    : `${new Date(preparedArtifact.summary.firstAppliedAt).toLocaleString()} to ${
                      new Date(preparedArtifact.summary.lastAppliedAt!).toLocaleString()
                    }`}
                </dd>
              </div>
              <div>
                <dt>Variants</dt>
                <dd>
                  {`Single ${preparedArtifact.summary.variants.single} / Original ${preparedArtifact.summary.variants.original} / Recommended ${preparedArtifact.summary.variants.recommended}`}
                </dd>
              </div>
              <div>
                <dt>Engines</dt>
                <dd>
                  {`Dagre ${preparedArtifact.summary.engines.dagre} / ELK ${preparedArtifact.summary.engines.elk} / Custom ${preparedArtifact.summary.engines.custom}`}
                </dd>
              </div>
            </dl>
            <div className={styles.fingerprint}>
              <span>{preparedArtifact.fingerprint.algorithm}</span>
              <code>{preparedArtifact.fingerprint.value}</code>
            </div>
          </section>
        )}
        {selected.comparisonMetrics.length > 0
          ? (
            <table className={styles.metrics}>
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Original</th>
                  <th>Recommended</th>
                  <th>Favored</th>
                </tr>
              </thead>
              <tbody>
                {selected.comparisonMetrics.map((metric) => (
                  <tr key={metric.key}>
                    <th scope="row">{metricLabels[metric.key]}</th>
                    <td>{formatMetric(metric.key, metric.original)}</td>
                    <td>{formatMetric(metric.key, metric.recommended)}</td>
                    <td data-favored={metric.favored}>{metric.favored}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
          : <p className={styles.singleState}>This application did not include a comparison variant.</p>}
      </article>
    </div>
  );
}
