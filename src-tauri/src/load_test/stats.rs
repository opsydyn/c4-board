/**
 * Load Test Statistics
 *
 * Collects and computes metrics using HDR histogram.
 */
use hdrhistogram::Histogram;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

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

    /// Error messages (limited to first 100)
    errors: Vec<String>,

    /// Bytes received
    bytes_received: u64,
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

    /// Record a successful request
    pub fn record_success(&self, latency: Duration, bytes: u64) {
        let mut inner = self.inner.lock().unwrap();
        inner.requests_sent += 1;
        inner.requests_success += 1;
        inner.bytes_received += bytes;

        // Record latency in microseconds
        let latency_us = latency.as_micros() as u64;
        inner.latencies.record(latency_us).ok();
    }

    /// Record a failed request
    pub fn record_failure(&self, error: String) {
        let mut inner = self.inner.lock().unwrap();
        inner.requests_sent += 1;
        inner.requests_failed += 1;

        // Store first 100 errors
        if inner.errors.len() < 100 {
            inner.errors.push(error);
        }
    }

    /// Get current progress snapshot
    pub fn snapshot(&self) -> LoadTestProgress {
        let inner = self.inner.lock().unwrap();
        let elapsed = inner.start_time.elapsed();
        let sample_count = inner.latencies.len();

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

        LoadTestProgress {
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
            recent_errors: inner.errors.iter().rev().take(10).cloned().collect(),
        }
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
            errors: Vec::new(),
            bytes_received: 0,
        }
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
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stats_recording() {
        let stats = LoadTestStats::new();

        stats.record_success(Duration::from_millis(100), 1024);
        stats.record_success(Duration::from_millis(200), 2048);
        stats.record_failure("Connection error".to_string());

        let progress = stats.snapshot();

        assert_eq!(progress.requests_sent, 3);
        assert_eq!(progress.requests_success, 2);
        assert_eq!(progress.requests_failed, 1);
        assert!(progress.avg_latency_ms > 0.0);
        assert_eq!(progress.bytes_received, 3072);
    }
}
