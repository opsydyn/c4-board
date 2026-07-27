/**
 * Load Test Statistics
 *
 * Collects and computes metrics using HDR histogram.
 */
use hdrhistogram::Histogram;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, VecDeque};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// Why a request never produced a response. ADR-019 slice 1.
///
/// Distinct from an HTTP status: a 503 is a response the service chose to send,
/// while these are failures to obtain one at all. Collapsing the two is what made
/// "requests_failed" unreadable.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TransportErrorKind {
    Timeout,
    Connect,
    Body,
    Other,
}

/// Latency for one class of HTTP status. ADR-019 slice 2.
///
/// A merged p99 across every status is uninformative during a load test: fast
/// successes and slow errors average into a number describing neither. Reported
/// per class, "p99 of 200s is 40ms, p99 of 503s is 30s" says the service is
/// shedding load cleanly.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusClassLatency {
    /// "2xx", "3xx", "4xx" or "5xx".
    pub class: String,
    pub count: u64,
    pub p50_latency_ms: f64,
    pub p95_latency_ms: f64,
    pub p99_latency_ms: f64,
}

/// How many failure messages are kept as evidence. Counts are unbounded; these
/// are only samples, and they must be the newest ones.
const ERROR_SAMPLE_LIMIT: usize = 20;

fn status_class_of(status: u16) -> Option<usize> {
    match status {
        200..=299 => Some(0),
        300..=399 => Some(1),
        400..=499 => Some(2),
        500..=599 => Some(3),
        _ => None,
    }
}

const STATUS_CLASS_LABELS: [&str; 4] = ["2xx", "3xx", "4xx", "5xx"];

/// Thread-safe statistics collector
#[derive(Clone)]
pub struct LoadTestStats {
    inner: Arc<Mutex<StatsInner>>,
}

struct StatsInner {
    /// Start time of the test
    start_time: Instant,

    /// Total requests sent
    requests_sent: u64,

    /// Successful requests (2xx, 3xx status)
    requests_success: u64,

    /// Failed requests (4xx, 5xx, network errors)
    requests_failed: u64,

    /// Latency histogram (in microseconds)
    /// HDR histogram provides accurate percentiles
    latencies: Histogram<u64>,

    /// The most recent failure messages, bounded. ADR-019 slice 3.
    ///
    /// Was a `Vec` that stopped accepting at 100 while the reported field took the
    /// tail of it, so after a hundred failures the same stale ten were returned
    /// for the rest of the run.
    errors: VecDeque<String>,

    /// Bytes received
    bytes_received: u64,

    /// When the previous snapshot was taken, so an interval has a width. ADR-019.
    interval_start: Instant,

    /// Counts and latencies for the window since that snapshot. Reset on read —
    /// the interval view is a window, not a running total.
    interval_sent: u64,
    interval_success: u64,
    interval_failed: u64,
    interval_latencies: Histogram<u64>,

    /// Responses that arrived, whatever their status. ADR-019 slice 1.
    responses_received: u64,

    /// Attempts that never produced a response, by cause.
    transport_failures: u64,
    transport_timeouts: u64,
    transport_connect_failures: u64,

    /// Time-to-failure, kept apart from response latency: a timeout is bounded by
    /// configuration, so folding it in would drag p99 towards the timeout setting
    /// and stop it describing the service.
    transport_latencies: Histogram<u64>,

    /// Responses by exact status code, and latency per status class. ADR-019 slice 2.
    status_counts: BTreeMap<u16, u64>,
    status_class_latencies: [Histogram<u64>; 4],
}

impl LoadTestStats {
    pub fn new() -> Self {
        Self::with_start(Instant::now())
    }

    pub fn with_start(start_time: Instant) -> Self {
        Self {
            inner: Arc::new(Mutex::new(StatsInner::new(start_time))),
        }
    }

    /// Record a response that arrived, whatever its status. ADR-019 slice 1.
    ///
    /// Latency is recorded for every status, not only successes. Previously a
    /// failure carried no latency at all, so the histogram held successes only —
    /// and under load the slow requests are exactly the ones that return 503, so
    /// it was systematically dropping its worst samples.
    pub fn record_response(&self, status: u16, succeeded: bool, latency: Duration, bytes: u64) {
        let mut inner = self.inner.lock().unwrap();
        inner.requests_sent += 1;
        inner.responses_received += 1;
        inner.bytes_received += bytes;
        inner.interval_sent += 1;

        // Whether a status is a pass is the test's decision, not HTTP's — see
        // `LoadTestConfig::is_success`. ADR-019 slice 4.
        if succeeded {
            inner.requests_success += 1;
            inner.interval_success += 1;
        } else {
            inner.requests_failed += 1;
            inner.interval_failed += 1;
            inner.push_error(format!("HTTP {status}"));
        }

        *inner.status_counts.entry(status).or_insert(0) += 1;

        let latency_us = latency.as_micros() as u64;
        inner.latencies.record(latency_us).ok();
        inner.interval_latencies.record(latency_us).ok();
        if let Some(class) = status_class_of(status) {
            inner.status_class_latencies[class].record(latency_us).ok();
        }
    }

    /// Record an attempt that never produced a response.
    pub fn record_transport_failure(
        &self,
        kind: TransportErrorKind,
        latency: Duration,
        detail: String,
    ) {
        let mut inner = self.inner.lock().unwrap();
        inner.requests_sent += 1;
        inner.requests_failed += 1;
        inner.transport_failures += 1;
        inner.interval_sent += 1;
        inner.interval_failed += 1;

        match kind {
            TransportErrorKind::Timeout => inner.transport_timeouts += 1,
            TransportErrorKind::Connect => inner.transport_connect_failures += 1,
            TransportErrorKind::Body | TransportErrorKind::Other => {}
        }

        // Deliberately not the response histogram — see `transport_latencies`.
        inner
            .transport_latencies
            .record(latency.as_micros() as u64)
            .ok();

        inner.push_error(detail);
    }

    /// Get current progress snapshot.
    ///
    /// Taking a snapshot closes the current interval and opens a new one, so this
    /// is not a pure read. Calling it from more than one place would split the
    /// windows between callers; the engine's progress ticker is the only caller.
    pub fn snapshot(&self) -> LoadTestProgress {
        let mut inner = self.inner.lock().unwrap();
        let elapsed = inner.start_time.elapsed();
        let sample_count = inner.latencies.len();

        let interval_elapsed = inner.interval_start.elapsed();
        let interval_samples = inner.interval_latencies.len();

        let (i_p50, i_p95, i_p99) = if interval_samples > 0 {
            (
                inner.interval_latencies.value_at_quantile(0.50) as f64 / 1000.0,
                inner.interval_latencies.value_at_quantile(0.95) as f64 / 1000.0,
                inner.interval_latencies.value_at_quantile(0.99) as f64 / 1000.0,
            )
        } else {
            // A window with no completions reports zero rather than carrying the
            // previous window forward. A stall has to be visible as a stall.
            (0.0, 0.0, 0.0)
        };

        let interval_secs = interval_elapsed.as_secs_f64();
        let interval_rps = if interval_secs > 0.0 {
            inner.interval_sent as f64 / interval_secs
        } else {
            0.0
        };

        let interval_ms = interval_elapsed.as_millis() as u64;
        let interval_sent = inner.interval_sent;
        let interval_success = inner.interval_success;
        let interval_failed = inner.interval_failed;

        let (p50, p95, p99, avg, min, max) = if sample_count > 0 {
            (
                inner.latencies.value_at_quantile(0.50) as f64 / 1000.0,
                inner.latencies.value_at_quantile(0.95) as f64 / 1000.0,
                inner.latencies.value_at_quantile(0.99) as f64 / 1000.0,
                inner.latencies.mean() / 1000.0,
                inner.latencies.min() as f64 / 1000.0,
                inner.latencies.max() as f64 / 1000.0,
            )
        } else {
            (0.0, 0.0, 0.0, 0.0, 0.0, 0.0)
        };

        let status_classes: Vec<StatusClassLatency> = STATUS_CLASS_LABELS
            .iter()
            .enumerate()
            .filter_map(|(index, label)| {
                let histogram = &inner.status_class_latencies[index];
                if histogram.is_empty() {
                    // A class nobody hit is absent rather than a row of zeroes.
                    return None;
                }
                Some(StatusClassLatency {
                    class: (*label).to_string(),
                    count: histogram.len(),
                    p50_latency_ms: histogram.value_at_quantile(0.50) as f64 / 1000.0,
                    p95_latency_ms: histogram.value_at_quantile(0.95) as f64 / 1000.0,
                    p99_latency_ms: histogram.value_at_quantile(0.99) as f64 / 1000.0,
                })
            })
            .collect();

        let progress = LoadTestProgress {
            elapsed_ms: elapsed.as_millis() as u64,
            requests_sent: inner.requests_sent,
            requests_success: inner.requests_success,
            requests_failed: inner.requests_failed,
            rps: if elapsed.as_secs_f64() > 0.0 {
                inner.requests_sent as f64 / elapsed.as_secs_f64()
            } else {
                0.0
            },
            p50_latency_ms: p50,
            p95_latency_ms: p95,
            p99_latency_ms: p99,
            avg_latency_ms: avg,
            min_latency_ms: min,
            max_latency_ms: max,
            bytes_received: inner.bytes_received,
            error_count: inner.requests_failed,
            recent_errors: inner.errors.iter().rev().cloned().collect(),
            interval_ms,
            interval_requests_sent: interval_sent,
            interval_requests_success: interval_success,
            interval_requests_failed: interval_failed,
            interval_rps,
            interval_p50_latency_ms: i_p50,
            interval_p95_latency_ms: i_p95,
            interval_p99_latency_ms: i_p99,
            responses_received: inner.responses_received,
            transport_failures: inner.transport_failures,
            transport_timeouts: inner.transport_timeouts,
            transport_connect_failures: inner.transport_connect_failures,
            status_counts: inner.status_counts.clone(),
            status_classes,
        };

        // Close the window. Reset rather than accumulate, so the interval
        // histogram stays bounded regardless of run length.
        inner.interval_start = Instant::now();
        inner.interval_sent = 0;
        inner.interval_success = 0;
        inner.interval_failed = 0;
        inner.interval_latencies.reset();

        progress
    }

    /// Reset statistics
    #[allow(dead_code)]
    pub fn reset(&self) {
        let mut inner = self.inner.lock().unwrap();
        *inner = StatsInner::new(Instant::now());
    }
}

impl StatsInner {
    fn new(start_time: Instant) -> Self {
        Self {
            start_time,
            requests_sent: 0,
            requests_success: 0,
            requests_failed: 0,
            latencies: Histogram::<u64>::new(3).expect("Failed to create histogram"),
            errors: VecDeque::new(),
            bytes_received: 0,
            interval_start: start_time,
            interval_sent: 0,
            interval_success: 0,
            interval_failed: 0,
            interval_latencies: Histogram::<u64>::new(3).expect("Failed to create histogram"),
            responses_received: 0,
            transport_failures: 0,
            transport_timeouts: 0,
            transport_connect_failures: 0,
            transport_latencies: Histogram::<u64>::new(3).expect("Failed to create histogram"),
            status_counts: BTreeMap::new(),
            status_class_latencies: std::array::from_fn(|_| {
                Histogram::<u64>::new(3).expect("Failed to create histogram")
            }),
        }
    }

    /// Keep the newest messages and drop the oldest, so the sample tracks the run.
    fn push_error(&mut self, detail: String) {
        if self.errors.len() == ERROR_SAMPLE_LIMIT {
            self.errors.pop_front();
        }
        self.errors.push_back(detail);
    }
}

/// Serializable progress snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadTestProgress {
    /// Elapsed time in milliseconds
    pub elapsed_ms: u64,

    /// Total requests sent
    pub requests_sent: u64,

    /// Successful requests
    pub requests_success: u64,

    /// Failed requests
    pub requests_failed: u64,

    /// Requests per second
    pub rps: f64,

    /// 50th percentile latency (median) in ms
    pub p50_latency_ms: f64,

    /// 95th percentile latency in ms
    pub p95_latency_ms: f64,

    /// 99th percentile latency in ms
    pub p99_latency_ms: f64,

    /// Average latency in ms
    pub avg_latency_ms: f64,

    /// Minimum latency in ms
    pub min_latency_ms: f64,

    /// Maximum latency in ms
    pub max_latency_ms: f64,

    /// Total bytes received
    pub bytes_received: u64,

    /// Number of errors
    pub error_count: u64,

    /// Recent error messages (last 10)
    pub recent_errors: Vec<String>,

    // ---- Interval view: the window since the previous snapshot. ADR-019. ----
    //
    // Charts plot these. The cumulative fields above answer "across the run so
    // far", which is right for a final report and wrong for a time axis — a
    // running average cannot show a dip, and a whole-run p95 cannot show a
    // recovery.
    /// Width of this window in milliseconds.
    pub interval_ms: u64,

    /// Requests attempted within the window.
    pub interval_requests_sent: u64,

    /// Requests that succeeded within the window.
    pub interval_requests_success: u64,

    /// Requests that failed within the window.
    pub interval_requests_failed: u64,

    /// Requests per second measured over the window alone.
    pub interval_rps: f64,

    /// Median latency within the window.
    pub interval_p50_latency_ms: f64,

    /// 95th percentile latency within the window.
    pub interval_p95_latency_ms: f64,

    /// 99th percentile latency within the window.
    pub interval_p99_latency_ms: f64,

    // ---- Outcome model. ADR-019 slice 1. ----
    //
    // A 503 is a response the service chose to send; a refused connection is not
    // a response at all. Both used to be "failed" and nothing else.
    /// Responses that arrived, whatever their status.
    pub responses_received: u64,

    /// Attempts that never produced a response.
    pub transport_failures: u64,

    /// Of those, how many timed out.
    pub transport_timeouts: u64,

    /// Of those, how many failed to connect.
    pub transport_connect_failures: u64,

    /// Responses by exact status code. ADR-019 slice 2.
    pub status_counts: BTreeMap<u16, u64>,

    /// Latency per status class, omitting classes nothing landed in.
    pub status_classes: Vec<StatusClassLatency>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stats_recording() {
        let stats = LoadTestStats::new();

        stats.record_response(200, true, Duration::from_millis(100), 1024);
        stats.record_response(200, true, Duration::from_millis(200), 2048);
        stats.record_transport_failure(
            TransportErrorKind::Connect,
            Duration::from_millis(5),
            "Connection error".to_string(),
        );

        let progress = stats.snapshot();

        assert_eq!(progress.requests_sent, 3);
        assert_eq!(progress.requests_success, 2);
        assert_eq!(progress.requests_failed, 1);
        assert!(progress.avg_latency_ms > 0.0);
        assert_eq!(progress.bytes_received, 3072);
    }
}

#[cfg(test)]
mod interval_tests {
    use super::*;

    /// ADR-019.
    ///
    /// Every field in `snapshot()` was cumulative since the run began, and the
    /// charts plotted those values on a time axis. Cumulative statistics on a
    /// time axis cannot show what the chart's shape implies: RPS converges on a
    /// flat run-average and can never dip, and a whole-run p95 climbs when things
    /// degrade and then stays climbed, so a service that recovers looks identical
    /// to one that never did.
    ///
    /// The cumulative figures are correct and stay — they are what a final report
    /// wants. The interval view answers the different question the chart is
    /// actually asking: what is happening *now*.
    fn ms(millis: u64) -> Duration {
        Duration::from_millis(millis)
    }

    #[test]
    fn interval_counts_cover_only_the_window_since_the_last_snapshot() {
        let stats = LoadTestStats::new();

        stats.record_response(200, true, ms(10), 100);
        stats.record_response(200, true, ms(10), 100);
        let first = stats.snapshot();

        stats.record_response(200, true, ms(10), 100);
        let second = stats.snapshot();

        assert_eq!(first.interval_requests_sent, 2, "first window saw two");
        assert_eq!(second.interval_requests_sent, 1, "second window saw one");
        assert_eq!(
            second.requests_sent, 3,
            "cumulative still counts everything"
        );
    }

    #[test]
    fn a_quiet_interval_reports_zero_rather_than_the_running_average() {
        // The defect in one assertion: a stall must be visible as a stall.
        let stats = LoadTestStats::new();

        for _ in 0..50 {
            stats.record_response(200, true, ms(5), 10);
        }
        let busy = stats.snapshot();
        let quiet = stats.snapshot();

        assert!(busy.interval_requests_sent > 0);
        assert_eq!(
            quiet.interval_requests_sent, 0,
            "an interval with no traffic must report none"
        );
        assert!(
            quiet.requests_sent > 0,
            "cumulative total must not be reset by taking a snapshot"
        );
    }

    #[test]
    fn interval_latency_tracks_the_window_while_cumulative_does_not() {
        let stats = LoadTestStats::new();

        // A long, healthy stretch.
        for _ in 0..1000 {
            stats.record_response(200, true, ms(5), 10);
        }
        let fast = stats.snapshot();

        // Then a short, sharp spike — under 5% of the run, which is the case the
        // cumulative series cannot show and the one that matters most.
        for _ in 0..20 {
            stats.record_response(200, true, ms(500), 10);
        }
        let slow = stats.snapshot();

        assert!(
            slow.interval_p95_latency_ms > fast.interval_p95_latency_ms * 10.0,
            "interval p95 did not follow the spike: {} then {}",
            fast.interval_p95_latency_ms,
            slow.interval_p95_latency_ms,
        );

        // The whole-run p95 sits below the 20 slow samples entirely, so the spike
        // is invisible in the cumulative series. Not a bug in the percentile —
        // the bug was drawing it on a time axis and implying it meant "now".
        assert!(
            slow.p95_latency_ms < slow.interval_p95_latency_ms / 10.0,
            "cumulative p95 ({}) should be diluted well below the interval ({})",
            slow.p95_latency_ms,
            slow.interval_p95_latency_ms,
        );
    }

    #[test]
    fn interval_failures_are_counted_separately_too() {
        let stats = LoadTestStats::new();

        stats.record_transport_failure(TransportErrorKind::Other, ms(1), "boom".to_string());
        let first = stats.snapshot();
        let second = stats.snapshot();

        assert_eq!(first.interval_requests_failed, 1);
        assert_eq!(second.interval_requests_failed, 0);
        assert_eq!(second.requests_failed, 1);
    }

    #[test]
    fn cumulative_percentiles_are_unchanged_by_the_addition() {
        // Final-report numbers must stay comparable with previous runs.
        let stats = LoadTestStats::new();
        for _ in 0..1000 {
            stats.record_response(200, true, ms(20), 10);
        }

        let snapshot = stats.snapshot();

        assert!((snapshot.p50_latency_ms - 20.0).abs() < 2.0);
        assert_eq!(snapshot.requests_sent, 1000);
    }
}

#[cfg(test)]
mod outcome_tests {
    use super::*;

    /// ADR-019 slice 1. Latency for every completed response.
    ///
    /// `record_failure` took no latency, so the histogram held successes only.
    /// Under load the slow requests are exactly the ones that return 503 or time
    /// out, which means the histogram was dropping its worst samples — the
    /// reported percentiles were optimistic by construction.
    ///
    /// Transport failures are timed separately rather than mixed in. A timeout is
    /// time-to-give-up, bounded by the configured timeout, so folding it into
    /// response latency makes p99 converge on that setting and stop describing
    /// the service at all.
    fn ms(millis: u64) -> Duration {
        Duration::from_millis(millis)
    }

    #[test]
    fn a_slow_error_response_is_in_the_latency_histogram() {
        let stats = LoadTestStats::new();

        stats.record_response(200, true, ms(10), 100);
        stats.record_response(503, false, ms(900), 20);

        let snapshot = stats.snapshot();

        assert!(
            snapshot.max_latency_ms >= 800.0,
            "the slow 503 was dropped from the histogram: max {}",
            snapshot.max_latency_ms
        );
    }

    #[test]
    fn a_non_2xx_response_still_counts_as_a_failed_request() {
        let stats = LoadTestStats::new();

        stats.record_response(500, false, ms(10), 0);
        let snapshot = stats.snapshot();

        assert_eq!(snapshot.requests_failed, 1);
        assert_eq!(snapshot.requests_success, 0);
    }

    #[test]
    fn a_response_is_counted_as_received_whatever_its_status() {
        // The distinction slice 1 exists to draw: a 503 arrived, a refused
        // connection did not. Both were previously "failed" and nothing else.
        let stats = LoadTestStats::new();

        stats.record_response(200, true, ms(5), 10);
        stats.record_response(429, false, ms(5), 10);
        stats.record_transport_failure(TransportErrorKind::Timeout, ms(30_000), "timed out".into());

        let snapshot = stats.snapshot();

        assert_eq!(snapshot.responses_received, 2, "two responses arrived");
        assert_eq!(snapshot.transport_failures, 1, "one never reached the host");
        assert_eq!(snapshot.requests_sent, 3, "all three were attempts");
    }

    #[test]
    fn a_timeout_does_not_inflate_response_latency() {
        // Mixing them would make p99 converge on the timeout setting.
        let stats = LoadTestStats::new();

        stats.record_response(200, true, ms(10), 10);
        stats.record_transport_failure(TransportErrorKind::Timeout, ms(30_000), "timed out".into());

        let snapshot = stats.snapshot();

        assert!(
            snapshot.max_latency_ms < 1000.0,
            "the timeout leaked into response latency: max {}",
            snapshot.max_latency_ms
        );
    }

    #[test]
    fn transport_failures_are_counted_by_kind() {
        let stats = LoadTestStats::new();

        stats.record_transport_failure(TransportErrorKind::Timeout, ms(100), "a".into());
        stats.record_transport_failure(TransportErrorKind::Timeout, ms(100), "b".into());
        stats.record_transport_failure(TransportErrorKind::Connect, ms(5), "c".into());

        let snapshot = stats.snapshot();

        assert_eq!(snapshot.transport_timeouts, 2);
        assert_eq!(snapshot.transport_connect_failures, 1);
    }

    #[test]
    fn interval_metrics_still_track_responses() {
        // Slice 1 must not undo ADR-019's interval window.
        let stats = LoadTestStats::new();

        stats.record_response(200, true, ms(5), 10);
        let first = stats.snapshot();
        let second = stats.snapshot();

        assert_eq!(first.interval_requests_sent, 1);
        assert_eq!(second.interval_requests_sent, 0);
    }
}

#[cfg(test)]
mod distribution_tests {
    use super::*;

    /// ADR-019 slices 2 and 3.
    ///
    /// Slice 2: a merged p99 says nothing during a load test. "p99 of 200s is
    /// 40ms, p99 of 503s is 30s" says the service is shedding load cleanly, which
    /// is the judgement the tool exists to support.
    ///
    /// Slice 3: `recent_errors` was not recent. Collection stopped at 100 and the
    /// field reported the tail of that frozen vector, so a run degrading at minute
    /// five showed evidence from second two forever.
    fn ms(millis: u64) -> Duration {
        Duration::from_millis(millis)
    }

    #[test]
    fn every_status_is_counted_by_its_exact_code() {
        let stats = LoadTestStats::new();

        stats.record_response(200, true, ms(5), 10);
        stats.record_response(200, true, ms(5), 10);
        stats.record_response(429, false, ms(5), 10);
        stats.record_response(503, false, ms(5), 10);

        let snapshot = stats.snapshot();

        assert_eq!(snapshot.status_counts.get(&200), Some(&2));
        assert_eq!(snapshot.status_counts.get(&429), Some(&1));
        assert_eq!(snapshot.status_counts.get(&503), Some(&1));
    }

    #[test]
    fn latency_is_reported_per_status_class() {
        // The point of the slice: fast successes alongside slow errors must not
        // average into one uninformative number.
        let stats = LoadTestStats::new();

        for _ in 0..50 {
            stats.record_response(200, true, ms(10), 10);
        }
        for _ in 0..50 {
            stats.record_response(503, false, ms(2000), 10);
        }

        let snapshot = stats.snapshot();
        let find = |class: &str| {
            snapshot
                .status_classes
                .iter()
                .find(|entry| entry.class == class)
                .unwrap_or_else(|| panic!("no {class} class reported"))
        };

        let ok = find("2xx");
        let server = find("5xx");

        assert_eq!(ok.count, 50);
        assert_eq!(server.count, 50);
        assert!(
            ok.p95_latency_ms < 100.0,
            "2xx p95 was {}",
            ok.p95_latency_ms
        );
        assert!(
            server.p95_latency_ms > 1000.0,
            "5xx p95 was {}",
            server.p95_latency_ms
        );
    }

    #[test]
    fn a_class_with_no_responses_is_not_reported() {
        let stats = LoadTestStats::new();
        stats.record_response(200, true, ms(5), 10);

        let snapshot = stats.snapshot();

        assert!(snapshot
            .status_classes
            .iter()
            .all(|entry| entry.class != "4xx"));
    }

    #[test]
    fn recent_errors_are_actually_recent() {
        let stats = LoadTestStats::new();

        for index in 0..500 {
            stats.record_transport_failure(
                TransportErrorKind::Other,
                ms(1),
                format!("failure-{index}"),
            );
        }

        let snapshot = stats.snapshot();

        assert!(
            snapshot
                .recent_errors
                .iter()
                .any(|error| error.contains("failure-499")),
            "the newest failure is missing: {:?}",
            snapshot.recent_errors
        );
        assert!(
            !snapshot
                .recent_errors
                .iter()
                .any(|error| error.contains("failure-0")),
            "the oldest failure is still being reported: {:?}",
            snapshot.recent_errors
        );
    }

    #[test]
    fn the_error_sample_stays_bounded() {
        let stats = LoadTestStats::new();

        for index in 0..10_000 {
            stats.record_transport_failure(TransportErrorKind::Other, ms(1), format!("e{index}"));
        }

        let snapshot = stats.snapshot();

        assert!(
            snapshot.recent_errors.len() <= 20,
            "error sample grew to {}",
            snapshot.recent_errors.len()
        );
    }

    #[test]
    fn the_failure_count_is_not_bounded_by_the_sample() {
        // Counts are the measurement; messages are only evidence.
        let stats = LoadTestStats::new();

        for index in 0..10_000 {
            stats.record_transport_failure(TransportErrorKind::Other, ms(1), format!("e{index}"));
        }

        let snapshot = stats.snapshot();

        assert_eq!(snapshot.requests_failed, 10_000);
        assert_eq!(snapshot.transport_failures, 10_000);
    }
}
