/**
 * Load test export — ADR-019 slice 5.
 *
 * A number you cannot compare with last week's number is not a regression test.
 * The interval series is the artefact worth keeping: it is the only record of how
 * a run behaved *over time*, and it lives in memory until the panel is cleared.
 *
 * Pure transforms. Writing the file is the shell's job; producing the bytes is
 * this module's, which is why both are testable without a filesystem.
 */

import type { LoadTestProgress } from "./load-test";
import type { ThresholdVerdict } from "./load-test-thresholds";

/**
 * Columns, in order. The interval fields lead because they are what varies across
 * the run — the cumulative ones are near-constant by the end and are included so
 * a reader does not have to recompute them.
 */
const CSV_COLUMNS = [
  "elapsed_ms",
  "interval_ms",
  "interval_rps",
  "interval_requests_sent",
  "interval_requests_success",
  "interval_requests_failed",
  "interval_p50_latency_ms",
  "interval_p95_latency_ms",
  "interval_p99_latency_ms",
  "requests_sent",
  "requests_success",
  "requests_failed",
  "responses_received",
  "transport_failures",
  "transport_timeouts",
  "transport_connect_failures",
  "rps",
  "p50_latency_ms",
  "p95_latency_ms",
  "p99_latency_ms",
  "bytes_received",
] as const satisfies ReadonlyArray<keyof LoadTestProgress>;

export const toCsv = (samples: ReadonlyArray<LoadTestProgress>): string => {
  // The header is emitted even with no rows: an empty file with a header is
  // readable, an empty file is a bug report.
  const header = CSV_COLUMNS.join(",");
  const rows = samples.map((sample) =>
    CSV_COLUMNS.map((column) => {
      const value = sample[column];
      return typeof value === "number" ? String(value) : "";
    }).join(",")
  );

  return [header, ...rows].join("\n");
};

/**
 * The full record: every sample plus the verdict, if one was reached. `null`
 * thresholds stay `null` rather than becoming an empty pass — "nothing was
 * asserted" and "everything asserted held" are different claims.
 */
export const toJsonReport = (
  samples: ReadonlyArray<LoadTestProgress>,
  thresholds: ThresholdVerdict | null,
): string =>
  JSON.stringify(
    {
      sampleCount: samples.length,
      thresholds,
      samples,
    },
    null,
    2,
  );
