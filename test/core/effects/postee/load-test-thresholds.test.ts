import type { LoadTestProgress } from "@/core/effects/postee/load-test";
import {
  evaluateThresholds,
  formatThresholdVerdict,
  type LoadTestThreshold,
} from "@/core/effects/postee/load-test-thresholds";
import { describe, expect, it } from "vitest";

/**
 * ADR-019 slice 5. Thresholds.
 *
 * A load test that only produces numbers cannot fail a build, and gating a
 * pipeline is the main reason teams run one. A threshold turns "p95 was 240ms"
 * into a verdict someone can act on without reading a chart.
 *
 * The judgement is deliberately pure: given a final snapshot and a set of
 * thresholds, the verdict is a function. Nothing here reads a clock, a file or
 * the runtime.
 */

const snapshot = (over: Partial<LoadTestProgress> = {}): LoadTestProgress =>
  ({
    elapsed_ms: 10_000,
    requests_sent: 1000,
    requests_success: 990,
    requests_failed: 10,
    rps: 100,
    p50_latency_ms: 20,
    p95_latency_ms: 120,
    p99_latency_ms: 400,
    avg_latency_ms: 30,
    min_latency_ms: 5,
    max_latency_ms: 900,
    bytes_received: 1024,
    error_count: 10,
    recent_errors: [],
    interval_ms: 100,
    interval_requests_sent: 10,
    interval_requests_success: 10,
    interval_requests_failed: 0,
    interval_rps: 100,
    interval_p50_latency_ms: 20,
    interval_p95_latency_ms: 120,
    interval_p99_latency_ms: 400,
    responses_received: 1000,
    transport_failures: 0,
    transport_timeouts: 0,
    transport_connect_failures: 0,
    status_counts: {},
    status_classes: [],
    ...over,
  }) as LoadTestProgress;

const under = (metric: LoadTestThreshold["metric"], value: number): LoadTestThreshold => ({
  metric,
  comparator: "below",
  value,
});

describe("evaluating a threshold", () => {
  it("passes when the measurement is under the limit", () => {
    const result = evaluateThresholds(snapshot({ p95_latency_ms: 120 }), [
      under("p95_latency_ms", 200),
    ]);

    expect(result.passed).toBe(true);
    expect(result.results[0]?.actual).toBe(120);
  });

  it("fails when the measurement is over the limit", () => {
    const result = evaluateThresholds(snapshot({ p95_latency_ms: 240 }), [
      under("p95_latency_ms", 200),
    ]);

    expect(result.passed).toBe(false);
    expect(result.results[0]?.passed).toBe(false);
  });

  it("fails the whole run when any single threshold fails", () => {
    // A verdict that needed all of them to fail would be useless as a gate.
    const result = evaluateThresholds(snapshot({ p95_latency_ms: 240 }), [
      under("p50_latency_ms", 100),
      under("p95_latency_ms", 200),
    ]);

    expect(result.results.filter((entry) => entry.passed)).toHaveLength(1);
    expect(result.passed).toBe(false);
  });

  it("supports a floor as well as a ceiling", () => {
    // Throughput is the case where you want a minimum, not a maximum.
    const result = evaluateThresholds(snapshot({ rps: 40 }), [
      { metric: "rps", comparator: "above", value: 50 },
    ]);

    expect(result.passed).toBe(false);
  });
});

describe("the error rate", () => {
  it("is a proportion of attempts, not a count", () => {
    const result = evaluateThresholds(
      snapshot({ requests_sent: 1000, requests_failed: 10 }),
      [under("error_rate", 0.05)],
    );

    expect(result.results[0]?.actual).toBeCloseTo(0.01);
    expect(result.passed).toBe(true);
  });

  it("is zero rather than NaN when nothing was sent", () => {
    // A run that failed to start must not report a threshold breach it cannot
    // justify, nor a NaN that renders as blank.
    const result = evaluateThresholds(
      snapshot({ requests_sent: 0, requests_failed: 0 }),
      [under("error_rate", 0.01)],
    );

    expect(result.results[0]?.actual).toBe(0);
    expect(result.passed).toBe(true);
  });
});

describe("a run with nothing declared", () => {
  it("passes, because no claim was made", () => {
    // Absence of thresholds is not a silent pass of thresholds that exist.
    const result = evaluateThresholds(snapshot(), []);

    expect(result.passed).toBe(true);
    expect(result.declared).toBe(false);
  });

  it("records that a verdict was reached when thresholds exist", () => {
    const result = evaluateThresholds(snapshot(), [under("p95_latency_ms", 200)]);

    expect(result.declared).toBe(true);
  });
});

describe("reporting the verdict", () => {
  it("names the metric, the limit and what was measured", () => {
    const result = evaluateThresholds(snapshot({ p95_latency_ms: 240 }), [
      under("p95_latency_ms", 200),
    ]);

    const text = formatThresholdVerdict(result);

    expect(text).toContain("p95_latency_ms");
    expect(text).toContain("200");
    expect(text).toContain("240");
  });

  it("says so plainly when nothing was declared", () => {
    expect(formatThresholdVerdict(evaluateThresholds(snapshot(), []))).toMatch(/no thresholds/i);
  });
});
