import type { LayoutApplicationAudit } from "@/core/effects/layout.types";
import { ClockCounterClockwiseIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import * as styles from "./LayoutHistoryTable.css";

export interface LayoutHistoryTableProps {
  audits: ReadonlyArray<LayoutApplicationAudit>;
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

export function LayoutHistoryTable({ audits }: LayoutHistoryTableProps) {
  const [selectedAt, setSelectedAt] = useState<number | null>(audits[0]?.appliedAt ?? null);
  const selected = audits.find((audit) => audit.appliedAt === selectedAt) ?? audits[0] ?? null;

  useEffect(() => {
    if (!selected && audits[0]) setSelectedAt(audits[0].appliedAt);
  }, [audits, selected]);

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
        </header>
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
