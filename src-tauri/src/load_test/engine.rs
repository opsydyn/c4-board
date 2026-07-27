/**
 * Load Test Engine - Functional Core
 *
 * Executes concurrent HTTP requests with rate limiting.
 * Zero Tauri dependencies - pure async Rust.
 */
use super::config::LoadTestConfig;
use super::stats::{LoadTestProgress, LoadTestStats, TransportErrorKind};
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
    cancel: CancellationHandle,
}

/// Cooperative cancellation for a run. ADR-019.
///
/// Cloneable and cheap, so the command layer can hold one while the engine runs.
/// Cancelling is idempotent — a second call is a no-op rather than an error,
/// because an abort button that can be pressed twice should not be able to fail.
#[derive(Clone)]
pub struct CancellationHandle {
    tx: Arc<watch::Sender<bool>>,
}

impl CancellationHandle {
    fn new() -> Self {
        let (tx, _rx) = watch::channel(false);
        Self { tx: Arc::new(tx) }
    }

    /// Ask the run to stop. Workers finish the request already in flight and the
    /// stats gathered so far are reported — a partial measurement is still a
    /// measurement, and discarding it would teach users not to abort.
    pub fn cancel(&self) {
        // `send` fails and leaves the value untouched when nothing has subscribed
        // yet, which is exactly the cancel-before-run case. `send_replace` stores
        // the value regardless, so an engine cancelled before it starts never
        // issues a request.
        self.tx.send_replace(true);
    }

    fn subscribe(&self) -> watch::Receiver<bool> {
        self.tx.subscribe()
    }
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
        Ok(Self {
            config,
            cancel: CancellationHandle::new(),
        })
    }

    /// A handle that can stop this run from elsewhere. Take it before `run`.
    pub fn cancellation_handle(&self) -> CancellationHandle {
        self.cancel.clone()
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

        let redirect_limit = self.config.redirect_limit();
        let client = Client::builder()
            .timeout(self.config.timeout())
            .redirect(if redirect_limit == 0 {
                reqwest::redirect::Policy::none()
            } else {
                reqwest::redirect::Policy::limited(redirect_limit)
            })
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

            let cancel_rx = self.cancel.subscribe();

            let worker = tokio::spawn(async move {
                Self::worker(
                    worker_id,
                    client,
                    plan,
                    rate_limiter,
                    tx,
                    test_start,
                    test_duration,
                    cancel_rx,
                )
                .await;
            });

            workers.push(worker);
        }

        drop(tx);

        let stats_for_collector = stats.clone();
        // Cloned so the collector can classify without borrowing the engine.
        let config_for_collector = self.config.clone();
        let collector_handle = tokio::spawn(async move {
            while let Some(result) = rx.recv().await {
                match result {
                    WorkerResult::Responded {
                        status,
                        latency,
                        bytes,
                    } => {
                        stats_for_collector.record_response(
                            status,
                            config_for_collector.is_success(status),
                            latency,
                            bytes,
                        );
                    }
                    WorkerResult::Transport {
                        kind,
                        latency,
                        detail,
                    } => {
                        stats_for_collector.record_transport_failure(kind, latency, detail);
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

    fn build_rate_limiter(&self) -> Result<Option<Arc<DirectRateLimiter>>, String> {
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

    #[allow(clippy::too_many_arguments)]
    async fn worker(
        _worker_id: usize,
        client: Client,
        plan: Arc<RequestPlan>,
        rate_limiter: Option<Arc<DirectRateLimiter>>,
        tx: mpsc::Sender<WorkerResult>,
        test_start: Instant,
        test_duration: Duration,
        mut cancel_rx: watch::Receiver<bool>,
    ) {
        loop {
            // Checked before the duration test so an already-cancelled engine
            // never issues a single request.
            if *cancel_rx.borrow() {
                break;
            }

            if test_start.elapsed() >= test_duration {
                break;
            }

            if let Some(limiter) = rate_limiter.as_ref() {
                // Waiting on the rate limiter must stay interruptible, or an abort
                // during a low-RPS run would sit here until the next token.
                tokio::select! {
                    _ = limiter.until_ready() => {}
                    _ = cancel_rx.changed() => break,
                }
            }

            let request_start = Instant::now();
            let result = Self::send_request(&client, plan.as_ref()).await;
            let latency = request_start.elapsed();

            let worker_result = match result {
                Ok((status, bytes)) => WorkerResult::Responded {
                    status,
                    latency,
                    bytes,
                },
                Err((kind, detail)) => WorkerResult::Transport {
                    kind,
                    latency,
                    detail,
                },
            };

            if tx.send(worker_result).await.is_err() {
                break;
            }
        }
    }

    /// Returns the status and body size of whatever came back. Only a failure to
    /// obtain a response at all is an `Err` — a 503 is a response.
    async fn send_request(
        client: &Client,
        plan: &RequestPlan,
    ) -> Result<(u16, u64), (TransportErrorKind, String)> {
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
            .map_err(|e| (classify_transport_error(&e), format!("Request failed: {e}")))?;

        let status = response.status().as_u16();

        // The body is read whatever the status: it is part of the response the
        // service produced, and skipping it for errors would understate both the
        // latency and the bytes transferred.
        let bytes = response.bytes().await.map_err(|e| {
            (
                classify_transport_error(&e),
                format!("Failed to read response: {e}"),
            )
        })?;

        Ok((status, bytes.len() as u64))
    }
}

/// What one attempt produced. ADR-019 slice 1.
///
/// A response that arrived is not an error, whatever its status — collapsing a
/// 503 and a refused connection into one `Err(String)` is what made the failure
/// count unreadable and cost the histogram its slowest samples.
enum WorkerResult {
    Responded {
        status: u16,
        latency: Duration,
        bytes: u64,
    },
    Transport {
        kind: TransportErrorKind,
        latency: Duration,
        detail: String,
    },
}

/// reqwest exposes the cause as predicates rather than a kind, so this is the
/// single place that translation happens.
fn classify_transport_error(error: &reqwest::Error) -> TransportErrorKind {
    if error.is_timeout() {
        TransportErrorKind::Timeout
    } else if error.is_connect() {
        TransportErrorKind::Connect
    } else if error.is_body() || error.is_decode() {
        TransportErrorKind::Body
    } else {
        TransportErrorKind::Other
    }
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
            success_statuses: None,
            max_redirects: None,
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
            success_statuses: None,
            max_redirects: None,
        };

        let engine = LoadTestEngine::new(config);
        assert!(engine.is_err());
    }

    #[test]
    fn build_request_plan_accepts_query_content() {
        let config = LoadTestConfig {
            url: "https://example.com/feed".to_string(),
            method: "QUERY".to_string(),
            headers: vec![("content-type".to_string(), "application/json".to_string())],
            body: Some(r#"{\"q\":\"opsy\"}"#.to_string()),
            duration_secs: 1,
            concurrency: 1,
            rps_limit: None,
            timeout_ms: 5_000,
            success_statuses: None,
            max_redirects: None,
        };

        let plan = LoadTestEngine::build_request_plan(&config).expect("QUERY plan should be valid");

        assert_eq!(plan.method.as_str(), "QUERY");
        assert_eq!(plan.body.as_deref(), Some(r#"{\"q\":\"opsy\"}"#.as_bytes()));
    }

    #[test]
    fn build_request_plan_preserves_the_derived_graphql_post_envelope() {
        let graphql_body = r#"{"query":"query Viewer { viewer { id } }","variables":{"includeEmail":true},"operationName":"Viewer"}"#;
        let config = LoadTestConfig {
            url: "https://example.com/graphql".to_string(),
            method: "POST".to_string(),
            headers: vec![
                (
                    "content-type".to_string(),
                    "application/json; charset=utf-8".to_string(),
                ),
                (
                    "accept".to_string(),
                    "application/graphql-response+json, application/json;q=0.9".to_string(),
                ),
            ],
            body: Some(graphql_body.to_string()),
            duration_secs: 1,
            concurrency: 1,
            rps_limit: None,
            timeout_ms: 5_000,
            success_statuses: None,
            max_redirects: None,
        };

        let plan = LoadTestEngine::build_request_plan(&config)
            .expect("derived GraphQL POST plan should be valid");

        assert_eq!(plan.method.as_str(), "POST");
        assert_eq!(plan.body.as_deref(), Some(graphql_body.as_bytes()));
        assert_eq!(plan.headers.len(), 2);
    }
}

#[cfg(test)]
mod cancellation_tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    /// ADR-019.
    ///
    /// The engine had no cancellation at all: `start_load_test` was the only
    /// command and workers checked nothing but elapsed time. A wrong URL or a
    /// mistyped duration ran to completion, hammering the target the whole way.
    ///
    /// These use a long duration and a short cancel, so a pass cannot be an
    /// accident of the run finishing on its own.
    fn long_running_config() -> LoadTestConfig {
        LoadTestConfig {
            // Unroutable by definition (RFC 5737 TEST-NET-1), so the test neither
            // depends on the network nor sends traffic anywhere real.
            url: "http://192.0.2.1:9/".to_string(),
            method: "GET".to_string(),
            headers: vec![],
            body: None,
            duration_secs: 30,
            concurrency: 2,
            rps_limit: None,
            timeout_ms: 100,
            success_statuses: None,
            max_redirects: None,
        }
    }

    #[tokio::test]
    async fn cancelling_ends_the_run_well_before_its_duration() {
        let engine = LoadTestEngine::new(long_running_config()).expect("valid config");
        let handle = engine.cancellation_handle();

        let started = Instant::now();
        let run = tokio::spawn(async move { engine.run(|_| {}).await });

        tokio::time::sleep(Duration::from_millis(300)).await;
        handle.cancel();

        let result = run.await.expect("run task should not panic");
        let elapsed = started.elapsed();

        assert!(result.is_ok(), "a cancelled run should not be an error");
        assert!(
            elapsed < Duration::from_secs(10),
            "cancellation did not stop the run: took {elapsed:?} of a 30s duration"
        );
    }

    #[tokio::test]
    async fn a_cancelled_run_still_reports_what_it_measured() {
        // Discarding the numbers on abort would teach users not to abort.
        let engine = LoadTestEngine::new(long_running_config()).expect("valid config");
        let handle = engine.cancellation_handle();

        let ticks = Arc::new(AtomicUsize::new(0));
        let ticks_for_cb = ticks.clone();

        let run = tokio::spawn(async move {
            engine
                .run(move |_| {
                    ticks_for_cb.fetch_add(1, Ordering::Relaxed);
                })
                .await
        });

        tokio::time::sleep(Duration::from_millis(400)).await;
        handle.cancel();

        let progress = run.await.expect("run task").expect("cancelled run is ok");

        assert!(
            ticks.load(Ordering::Relaxed) > 0,
            "no progress was reported"
        );
        assert!(
            progress.requests_sent > 0,
            "a cancelled run reported no attempts at all"
        );
    }

    #[tokio::test]
    async fn cancelling_before_the_run_starts_stops_it_immediately() {
        let engine = LoadTestEngine::new(long_running_config()).expect("valid config");
        let handle = engine.cancellation_handle();
        handle.cancel();

        let started = Instant::now();
        let result = engine.run(|_| {}).await;

        assert!(result.is_ok());
        assert!(
            started.elapsed() < Duration::from_secs(5),
            "an already-cancelled engine still ran"
        );
    }

    #[tokio::test]
    async fn cancelling_twice_is_harmless() {
        let engine = LoadTestEngine::new(long_running_config()).expect("valid config");
        let handle = engine.cancellation_handle();

        handle.cancel();
        handle.cancel();

        assert!(engine.run(|_| {}).await.is_ok());
    }
}
