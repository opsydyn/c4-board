/**
 * Load Test Engine - Functional Core
 *
 * Executes concurrent HTTP requests with rate limiting.
 * Zero Tauri dependencies - pure async Rust.
 */
use super::config::LoadTestConfig;
use super::stats::{LoadTestProgress, LoadTestStats};
use bytes::Bytes;
use governor::{
    clock::DefaultClock, state::direct::NotKeyed, state::InMemoryState, Quota, RateLimiter,
};
use reqwest::{
    header::{HeaderName, HeaderValue},
    Client, Method,
};
use std::convert::TryFrom;
use std::num::NonZeroU32;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{mpsc, watch};

type DirectRateLimiter = RateLimiter<NotKeyed, InMemoryState, DefaultClock>;

pub struct LoadTestEngine {
    config: LoadTestConfig,
}

#[derive(Clone)]
struct RequestPlan {
    method: Method,
    url: Arc<str>,
    headers: Arc<Vec<(HeaderName, HeaderValue)>>,
    body: Option<Bytes>,
}

impl LoadTestEngine {
    pub fn new(config: LoadTestConfig) -> Result<Self, String> {
        config.validate()?;
        Ok(Self { config })
    }

    /// Run the load test with a progress callback
    ///
    /// The callback is invoked approximately every 100 ms.
    /// Returns the final statistics snapshot when the run completes.
    pub async fn run<F>(&self, progress_callback: F) -> Result<LoadTestProgress, String>
    where
        F: FnMut(LoadTestProgress) + Send + 'static,
    {
        let stats = LoadTestStats::new();

        let client = Client::builder()
            .timeout(self.config.timeout())
            .pool_max_idle_per_host(self.config.concurrency)
            .build()
            .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

        let rate_limiter = self.build_rate_limiter()?;
        let request_plan = Arc::new(Self::build_request_plan(&self.config)?);

        let (tx, mut rx) = mpsc::channel::<WorkerResult>(512);
        let (shutdown_tx, shutdown_rx) = watch::channel(false);

        // Progress reporter that exits cleanly when we're done.
        let stats_for_progress = stats.clone();
        let progress_handle = tokio::spawn(async move {
            let mut callback = progress_callback;
            let mut shutdown_rx = shutdown_rx;
            let mut interval = tokio::time::interval(Duration::from_millis(100));

            loop {
                tokio::select! {
                    _ = interval.tick() => {
                        callback(stats_for_progress.snapshot());
                    }
                    changed = shutdown_rx.changed() => {
                        if changed.is_err() {
                            break;
                        }
                        if *shutdown_rx.borrow() {
                            callback(stats_for_progress.snapshot());
                            break;
                        }
                    }
                }
            }
        });

        let test_start = Instant::now();
        let test_duration = self.config.duration();

        let mut workers = Vec::with_capacity(self.config.concurrency);
        for worker_id in 0..self.config.concurrency {
            let client = client.clone();
            let plan = request_plan.clone();
            let rate_limiter = rate_limiter.clone();
            let tx = tx.clone();

            let worker = tokio::spawn(async move {
                Self::worker(
                    worker_id,
                    client,
                    plan,
                    rate_limiter,
                    tx,
                    test_start,
                    test_duration,
                )
                .await;
            });

            workers.push(worker);
        }

        drop(tx);

        let stats_for_collector = stats.clone();
        let collector_handle = tokio::spawn(async move {
            while let Some(result) = rx.recv().await {
                match result {
                    WorkerResult::Success { latency, bytes } => {
                        stats_for_collector.record_success(latency, bytes);
                    }
                    WorkerResult::Failure { error } => {
                        stats_for_collector.record_failure(error);
                    }
                }
            }
        });

        let mut task_errors = Vec::new();

        for worker in workers {
            if let Err(join_err) = worker.await {
                task_errors.push(format!("Worker task failed: {join_err}"));
            }
        }

        if let Err(join_err) = collector_handle.await {
            task_errors.push(format!("Collector task failed: {join_err}"));
        }

        // Signal progress task to emit one last snapshot and exit.
        let _ = shutdown_tx.send(true);
        if let Err(join_err) = progress_handle.await {
            task_errors.push(format!("Progress task failed: {join_err}"));
        }

        if !task_errors.is_empty() {
            return Err(task_errors.join("; "));
        }

        Ok(stats.snapshot())
    }

    fn build_rate_limiter(
        &self,
    ) -> Result<Option<Arc<DirectRateLimiter>>, String> {
        match self.config.rps_limit {
            Some(rps) => {
                let rps_u32 = u32::try_from(rps).map_err(|_| {
                    format!(
                        "RPS limit {rps} exceeds maximum supported value {}",
                        u32::MAX
                    )
                })?;

                let non_zero = NonZeroU32::new(rps_u32)
                    .ok_or_else(|| "RPS limit must be at least 1".to_string())?;
                let quota = Quota::per_second(non_zero);
                Ok(Some(Arc::new(RateLimiter::direct(quota))))
            }
            None => Ok(None),
        }
    }

    fn build_request_plan(config: &LoadTestConfig) -> Result<RequestPlan, String> {
        let method = config
            .method
            .parse::<Method>()
            .map_err(|e| format!("Invalid HTTP method '{}': {e}", config.method))?;

        let mut headers = Vec::with_capacity(config.headers.len());
        for (key, value) in &config.headers {
            let header_name = HeaderName::from_bytes(key.trim().as_bytes())
                .map_err(|e| format!("Invalid header name '{key}': {e}"))?;
            let header_value = HeaderValue::from_str(value)
                .map_err(|e| format!("Invalid header value for '{key}': {e}"))?;
            headers.push((header_name, header_value));
        }

        let body = config
            .body
            .as_ref()
            .map(|body| Bytes::copy_from_slice(body.as_bytes()));

        Ok(RequestPlan {
            method,
            url: Arc::from(config.url.clone()),
            headers: Arc::new(headers),
            body,
        })
    }

    async fn worker(
        _worker_id: usize,
        client: Client,
        plan: Arc<RequestPlan>,
        rate_limiter: Option<Arc<DirectRateLimiter>>,
        tx: mpsc::Sender<WorkerResult>,
        test_start: Instant,
        test_duration: Duration,
    ) {
        loop {
            if test_start.elapsed() >= test_duration {
                break;
            }

            if let Some(limiter) = rate_limiter.as_ref() {
                limiter.until_ready().await;
            }

            let request_start = Instant::now();
            let result = Self::send_request(&client, plan.as_ref()).await;
            let latency = request_start.elapsed();

            let worker_result = match result {
                Ok(bytes) => WorkerResult::Success { latency, bytes },
                Err(error) => WorkerResult::Failure { error },
            };

            if tx.send(worker_result).await.is_err() {
                break;
            }
        }
    }

    async fn send_request(client: &Client, plan: &RequestPlan) -> Result<u64, String> {
        let mut request = client.request(plan.method.clone(), plan.url.as_ref());

        for (name, value) in plan.headers.iter() {
            request = request.header(name.clone(), value.clone());
        }

        if let Some(body) = plan.body.clone() {
            request = request.body(body);
        }

        let response = request
            .send()
            .await
            .map_err(|e| format!("Request failed: {e}"))?;

        let status = response.status();
        if !status.is_success() && !status.is_redirection() {
            return Err(format!("HTTP {status}"));
        }

        let bytes = response
            .bytes()
            .await
            .map_err(|e| format!("Failed to read response: {e}"))?;

        Ok(bytes.len() as u64)
    }
}

enum WorkerResult {
    Success { latency: Duration, bytes: u64 },
    Failure { error: String },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_engine_creation() {
        let config = LoadTestConfig {
            url: "https://httpbin.org/get".to_string(),
            method: "GET".to_string(),
            headers: vec![],
            body: None,
            duration_secs: 1,
            concurrency: 2,
            rps_limit: None,
            timeout_ms: 5000,
        };

        let engine = LoadTestEngine::new(config);
        assert!(engine.is_ok());
    }

    #[tokio::test]
    async fn test_invalid_config() {
        let config = LoadTestConfig {
            url: "".to_string(),
            method: "GET".to_string(),
            headers: vec![],
            body: None,
            duration_secs: 1,
            concurrency: 2,
            rps_limit: None,
            timeout_ms: 5000,
        };

        let engine = LoadTestEngine::new(config);
        assert!(engine.is_err());
    }
}
