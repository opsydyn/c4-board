/**
 * Load test thresholds — ADR-019 slice 5.
 *
 * A run that only produces numbers cannot fail a build, and gating a pipeline is
 * the main reason teams run load tests at all. A threshold turns "p95 was 240ms"
 * into a verdict someone can act on without reading a chart.
 *
 * Part of the functional core: given a final snapshot and a set of thresholds,
 * the verdict is a pure function. Nothing here reads a clock, a file or the
 * runtime, so the judgement is testable without running a load test.
 */

import type { LoadTestProgress } from "./load-test";

/** Metrics a threshold can be declared against, taken from the final snapshot. */
export type ThresholdMetric =
  | "p50_latency_ms"
  | "p95_latency_ms"
  | "p99_latency_ms"
  | "avg_latency_ms"
  | "rps"
  | "error_rate";

/**
 * `below` is a ceiling, `above` is a floor. Latency wants a ceiling; throughput
 * wants a floor, which is why one comparator would not do.
 */
export type ThresholdComparator = "below" | "above";

export interface LoadTestThreshold {
  readonly metric: ThresholdMetric;
  readonly comparator: ThresholdComparator;
  readonly value: number;
}

export interface ThresholdResult extends LoadTestThreshold {
  readonly actual: number;
  readonly passed: boolean;
}

export interface ThresholdVerdict {
  /** Whether any threshold was declared at all — distinct from having passed. */
  readonly declared: boolean;
  readonly passed: boolean;
  readonly results: ReadonlyArray<ThresholdResult>;
}

/**
 * A proportion of attempts rather than a count, so the number means the same
 * thing at any duration. Zero when nothing was sent: a run that never started
 * has no error rate to report, and NaN renders as a blank that reads as a pass.
 */
const errorRateOf = (snapshot: LoadTestProgress): number =>
  snapshot.requests_sent > 0 ? snapshot.requests_failed / snapshot.requests_sent : 0;

const measure = (snapshot: LoadTestProgress, metric: ThresholdMetric): number =>
  metric === "error_rate" ? errorRateOf(snapshot) : snapshot[metric];

export const evaluateThresholds = (
  snapshot: LoadTestProgress,
  thresholds: ReadonlyArray<LoadTestThreshold>,
): ThresholdVerdict => {
  const results = thresholds.map((threshold): ThresholdResult => {
    const actual = measure(snapshot, threshold.metric);
    return {
      ...threshold,
      actual,
      passed: threshold.comparator === "below"
        ? actual < threshold.value
        : actual > threshold.value,
    };
  });

  return {
    declared: results.length > 0,
    // Any failure fails the run: a gate that needed all of them to fail would
    // never stop anything.
    passed: results.every((result) => result.passed),
    results,
  };
};

/** Human-readable verdict, for the panel and for the exported report. */
export const formatThresholdVerdict = (verdict: ThresholdVerdict): string => {
  if (!verdict.declared) {
    return "No thresholds declared — nothing was asserted about this run.";
  }

  const lines = verdict.results.map((result) => {
    const limit = result.comparator === "below" ? "<" : ">";
    return `${result.passed ? "PASS" : "FAIL"} ${result.metric} ${limit} ${result.value} (measured ${
      Number(result.actual.toFixed(3))
    })`;
  });

  return [verdict.passed ? "PASSED" : "FAILED", ...lines].join("\n");
};
