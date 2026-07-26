/**
 * Load Testing Module - Functional Core
 *
 * Pure Rust load testing engine with zero Tauri dependencies.
 * Following the Functional Core, Imperative Shell pattern.
 *
 * Features:
 * - Concurrent HTTP requests (tokio)
 * - HDR histogram for accurate latency percentiles
 * - Rate limiting (requests per second)
 * - Real-time statistics
 * - Error tracking
 */
pub mod config;
pub mod engine;
pub mod stats;

pub use config::LoadTestConfig;
pub use engine::{CancellationHandle, LoadTestEngine};
#[allow(unused_imports)]
pub use stats::{LoadTestProgress, LoadTestStats};
