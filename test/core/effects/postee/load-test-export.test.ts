import type { LoadTestProgress } from "@/core/effects/postee/load-test";
import { toCsv, toJsonReport } from "@/core/effects/postee/load-test-export";
import { describe, expect, it } from "vitest";

/**
 * ADR-019 slice 5. Export.
 *
 * A number you cannot compare with last week's number is not a regression test.
 * The interval series is the interesting artefact — it is the only record of how
 * the run behaved over time, and it lives in memory until the panel is cleared.
 */

const sample = (over: Partial<LoadTestProgress> = {}): LoadTestProgress =>
  ({
    elapsed_ms: 100,
    requests_sent: 10,
    requests_success: 10,
    requests_failed: 0,
    rps: 100,
    p50_latency_ms: 10,
    p95_latency_ms: 20,
    p99_latency_ms: 30,
    avg_latency_ms: 12,
    min_latency_ms: 5,
    max_latency_ms: 40,
    bytes_received: 100,
    error_count: 0,
    recent_errors: [],
    interval_ms: 100,
    interval_requests_sent: 10,
    interval_requests_success: 10,
    interval_requests_failed: 0,
    interval_rps: 100,
    interval_p50_latency_ms: 10,
    interval_p95_latency_ms: 20,
    interval_p99_latency_ms: 30,
    responses_received: 10,
    transport_failures: 0,
    transport_timeouts: 0,
    transport_connect_failures: 0,
    status_counts: {},
    status_classes: [],
    ...over,
  }) as LoadTestProgress;

describe("CSV export", () => {
  it("writes a header so a column can be identified without the code", () => {
    const csv = toCsv([sample()]);

    expect(csv.split("\n")[0]).toContain("elapsed_ms");
    expect(csv.split("\n")[0]).toContain("interval_p95_latency_ms");
  });

  it("writes one row per sample", () => {
    const csv = toCsv([sample({ elapsed_ms: 100 }), sample({ elapsed_ms: 200 })]);

    expect(csv.trim().split("\n")).toHaveLength(3);
  });

  it("exports the interval series, which is what varies over the run", () => {
    const csv = toCsv([sample({ interval_p95_latency_ms: 999 })]);

    expect(csv).toContain("999");
  });

  it("produces a header even with no samples, so the file is still readable", () => {
    expect(toCsv([]).trim().split("\n")).toHaveLength(1);
  });
});

describe("JSON report", () => {
  it("is parseable and carries the samples", () => {
    const parsed = JSON.parse(toJsonReport([sample(), sample()], null));

    expect(parsed.samples).toHaveLength(2);
  });

  it("carries the threshold verdict when one was reached", () => {
    const verdict = {
      declared: true,
      passed: false,
      results: [
        { metric: "p95_latency_ms" as const, comparator: "below" as const, value: 200, actual: 240, passed: false },
      ],
    };

    const parsed = JSON.parse(toJsonReport([sample()], verdict));

    expect(parsed.thresholds.passed).toBe(false);
    expect(parsed.thresholds.results).toHaveLength(1);
  });

  it("omits the verdict rather than inventing a pass when none was declared", () => {
    const parsed = JSON.parse(toJsonReport([sample()], null));

    expect(parsed.thresholds).toBeNull();
  });
});
