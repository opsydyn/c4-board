import {
  ArrowClockwiseIcon,
  CheckIcon,
  CrosshairIcon,
  InfoIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react";
import type { KeyboardEvent } from "react";
import type { LayoutPreviewModel, LayoutQualityDelta } from "../../core/effects/layout-preview";
import * as styles from "./LayoutPreviewDrawer.css";
import { TacticalSelect } from "./TacticalSelect";

export interface LayoutPreviewDrawerProps {
  preview: LayoutPreviewModel;
  onCenterChange: (nodeId: string) => void;
  onApply: () => void;
  onCancel: () => void;
  failure?: { message: string; attemptedLabel: string } | null;
  onRetry?: () => void;
  onTryRecommendation?: () => void;
  comparisonMode?: "original" | "recommended" | null;
  onComparisonModeChange?: (mode: "original" | "recommended") => void;
}

const formatMetric = (value: number, key: LayoutQualityDelta["key"]): string => {
  if (key === "overlaps" || key === "crossings") return Math.round(value).toLocaleString();
  if (key === "occupiedArea") return Math.round(value / 1_000).toLocaleString() + "K";
  return Math.round(value).toLocaleString();
};

const formatDelta = (metric: LayoutQualityDelta): string => {
  if (Math.abs(metric.delta) < 0.5) return "0";
  const value = metric.key === "occupiedArea" ? metric.delta / 1_000 : metric.delta;
  return `${value > 0 ? "+" : ""}${Math.round(value).toLocaleString()}${metric.key === "occupiedArea" ? "K" : ""}`;
};

const deltaTone = (metric: LayoutQualityDelta): "better" | "worse" | "neutral" => {
  if (metric.preference === "neutral" || Math.abs(metric.delta) < 0.5) return "neutral";
  return metric.delta < 0 ? "better" : "worse";
};

export function LayoutPreviewDrawer({
  preview,
  onCenterChange,
  onApply,
  onCancel,
  failure = null,
  onRetry,
  onTryRecommendation,
  comparisonMode = null,
  onComparisonModeChange,
}: LayoutPreviewDrawerProps) {
  const warnings = preview.result.diagnostics.filter(
    (diagnostic) => diagnostic.severity === "warning" || diagnostic.severity === "error",
  ).length;
  const centerLabel = preview.centerControl?.kind === "hub" ? "Hub" : "System of interest";
  const handleDrawerKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!comparisonMode || !onComparisonModeChange || !event.altKey) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onComparisonModeChange("original");
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      onComparisonModeChange("recommended");
    }
  };

  return (
    <section className={styles.drawer} aria-label="Layout preview" onKeyDown={handleDrawerKeyDown}>
      {comparisonMode && (
        <span className={styles.visuallyHidden} role="status" aria-live="polite" aria-atomic="true">
          {`Preview comparison: ${comparisonMode === "original" ? "Original" : "Recommended"} active.`}
        </span>
      )}
      <header className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.eyebrow}>LAYOUT PREVIEW</span>
          <h2 className={styles.title}>{preview.presetLabel}</h2>
          <div className={styles.meta}>
            <span>{`STRATEGY::${preview.result.strategyId.toUpperCase()}`}</span>
            <span>{`ENGINE::${preview.result.engine.toUpperCase()}`}</span>
            <span>{`SCOPE::${preview.appliedScope.toUpperCase()}`}</span>
            <span>{`WARNINGS::${warnings}`}</span>
          </div>
        </div>
        <div className={styles.actions}>
          {comparisonMode && onComparisonModeChange && (
            <div className={styles.comparisonToggle} role="group" aria-label="Preview comparison">
              <button
                type="button"
                data-active={comparisonMode === "original"}
                aria-pressed={comparisonMode === "original"}
                aria-keyshortcuts="Alt+ArrowLeft"
                onClick={() =>
                  onComparisonModeChange("original")}
              >
                Original
              </button>
              <button
                type="button"
                data-active={comparisonMode === "recommended"}
                aria-pressed={comparisonMode === "recommended"}
                aria-keyshortcuts="Alt+ArrowRight"
                onClick={() =>
                  onComparisonModeChange("recommended")}
              >
                Recommended
              </button>
            </div>
          )}
          {failure && onRetry && (
            <button type="button" className={styles.retryButton} onClick={onRetry}>
              <ArrowClockwiseIcon size={16} weight="bold" aria-hidden="true" />
              Retry
            </button>
          )}
          <button type="button" className={styles.cancelButton} onClick={onCancel}>
            <XIcon size={16} weight="bold" aria-hidden="true" />
            Cancel
          </button>
          <button type="button" className={styles.applyButton} onClick={onApply}>
            <CheckIcon size={16} weight="bold" aria-hidden="true" />
            Apply layout
          </button>
        </div>
      </header>

      {failure && (
        <div className={styles.fallbackNotice} role="alert">
          <WarningCircleIcon size={18} weight="duotone" aria-hidden="true" />
          <p>
            <strong>{`${failure.attemptedLabel} failed.`}</strong>
            {` Showing the last valid preview. ${failure.message}`}
          </p>
        </div>
      )}

      <div className={styles.content}>
        <section className={styles.controlSection} aria-label="Layout controls">
          <div className={styles.sectionHeading}>
            <CrosshairIcon size={17} weight="duotone" aria-hidden="true" />
            <h3>Placement</h3>
          </div>
          <dl className={styles.definitionList}>
            <div>
              <dt>Preset</dt>
              <dd>{preview.presetLabel}</dd>
            </div>
            <div>
              <dt>Requested</dt>
              <dd>{preview.requestedScope}</dd>
            </div>
            <div>
              <dt>Applied</dt>
              <dd>{preview.appliedScope}</dd>
            </div>
          </dl>
          {preview.centerControl && (
            <div className={styles.centerControl}>
              <span className={styles.controlLabel}>{centerLabel}</span>
              <TacticalSelect
                id="layout-preview-center"
                ariaLabel={`Select ${centerLabel.toLowerCase()}`}
                value={preview.centerControl.selectedNodeId}
                options={preview.centerControl.candidates.map((candidate) => ({
                  value: candidate.id,
                  label: candidate.label,
                }))}
                onChange={onCenterChange}
              />
            </div>
          )}
        </section>

        <section className={styles.qualitySection} aria-label="Layout quality comparison">
          <div className={styles.sectionHeading}>
            <InfoIcon size={17} weight="duotone" aria-hidden="true" />
            <h3>Quality comparison</h3>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.qualityTable}>
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Current</th>
                  <th>Proposed</th>
                  <th>Delta</th>
                </tr>
              </thead>
              <tbody>
                {preview.qualityDeltas.map((metric) => (
                  <tr key={metric.key}>
                    <th scope="row">{metric.label}</th>
                    <td>{formatMetric(metric.current, metric.key)}</td>
                    <td>{formatMetric(metric.proposed, metric.key)}</td>
                    <td data-tone={deltaTone(metric)}>{formatDelta(metric)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.routedQuality && (
            <dl className={styles.portSummary} role="group" aria-label="Routed geometry quality">
              <div data-tone={preview.routedQuality.edgeCrossingCount > 0 ? "warning" : "ready"}>
                <dt>Routed crossings</dt>
                <dd>{preview.routedQuality.edgeCrossingCount.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Routed length</dt>
                <dd>{Math.round(preview.routedQuality.totalEdgeLength).toLocaleString()}</dd>
              </div>
            </dl>
          )}
          {preview.portSummary && (
            <dl className={styles.portSummary} role="group" aria-label="Port routing summary">
              <div>
                <dt>Assigned edges</dt>
                <dd>{preview.portSummary.assignedEdges.toLocaleString()}</dd>
              </div>
              <div data-tone={preview.portSummary.congestedSides > 0 ? "warning" : "ready"}>
                <dt>Congested sides</dt>
                <dd>{preview.portSummary.congestedSides.toLocaleString()}</dd>
              </div>
              {preview.portSummary.busiestSide && (
                <div>
                  <dt>Busiest side</dt>
                  <dd>
                    {`${preview.portSummary.busiestSide.edgeCount}/${preview.portSummary.busiestSide.estimatedCapacity} ${preview.portSummary.busiestSide.side.toUpperCase()}`}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </section>

        <section className={styles.diagnosticsSection} aria-label="Layout diagnostics">
          <div className={styles.sectionHeading}>
            <WarningCircleIcon size={17} weight="duotone" aria-hidden="true" />
            <h3>Diagnostics</h3>
          </div>
          <div className={styles.diagnosticsList}>
            {preview.recommendation && onTryRecommendation && (
              <div className={styles.recommendationEvidence}>
                <button type="button" className={styles.retryButton} onClick={onTryRecommendation}>
                  <ArrowClockwiseIcon size={16} weight="bold" aria-hidden="true" />
                  {preview.recommendation.label}
                </button>
                <p>
                  {`CROSSINGS ${preview.recommendation.currentQuality.edgeCrossingCount} → ${preview.recommendation.recommendedQuality.edgeCrossingCount} · ROUTED LENGTH ${
                    Math.round(preview.recommendation.currentQuality.totalEdgeLength).toLocaleString()
                  } → ${Math.round(preview.recommendation.recommendedQuality.totalEdgeLength).toLocaleString()}`}
                </p>
              </div>
            )}
            {preview.result.diagnostics.length === 0
              ? <p className={styles.emptyDiagnostics}>No layout warnings</p>
              : preview.result.diagnostics.map((diagnostic, index) => (
                <div
                  key={`${diagnostic.code}-${index}`}
                  className={styles.diagnostic}
                  data-severity={diagnostic.severity}
                >
                  <span>{diagnostic.severity.toUpperCase()}</span>
                  <p>{diagnostic.message}</p>
                </div>
              ))}
          </div>
        </section>
      </div>
    </section>
  );
}
