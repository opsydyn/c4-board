/**
 * Load Test Configuration
 *
 * Pure data structures with no I/O.
 */
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadTestConfig {
    /// Target URL to test
    pub url: String,

    /// HTTP method (GET, POST, PUT, etc.)
    #[serde(default = "default_method")]
    pub method: String,

    /// Request headers (key-value pairs)
    #[serde(default)]
    pub headers: Vec<(String, String)>,

    /// Request body (optional)
    pub body: Option<String>,

    /// Test duration in seconds
    #[serde(default = "default_duration_secs")]
    pub duration_secs: u64,

    /// Number of concurrent workers
    #[serde(default = "default_concurrency")]
    pub concurrency: usize,

    /// Requests per second limit (None = unlimited)
    pub rps_limit: Option<u64>,

    /// Connection timeout in milliseconds
    #[serde(default = "default_timeout_ms")]
    pub timeout_ms: u64,
}

fn default_method() -> String {
    "GET".to_string()
}

fn default_duration_secs() -> u64 {
    10
}

fn default_concurrency() -> usize {
    10
}

fn default_timeout_ms() -> u64 {
    30000 // 30 seconds
}

impl LoadTestConfig {
    pub fn duration(&self) -> Duration {
        Duration::from_secs(self.duration_secs)
    }

    pub fn timeout(&self) -> Duration {
        Duration::from_millis(self.timeout_ms)
    }

    /// Validate configuration
    pub fn validate(&self) -> Result<(), String> {
        if self.url.is_empty() {
            return Err("URL cannot be empty".to_string());
        }

        if self.concurrency == 0 {
            return Err("Concurrency must be at least 1".to_string());
        }

        if self.duration_secs == 0 {
            return Err("Duration must be at least 1 second".to_string());
        }

        if let Some(rps_limit) = self.rps_limit {
            if rps_limit == 0 {
                return Err("RPS limit must be greater than 0".to_string());
            }

            if rps_limit > u32::MAX as u64 {
                return Err(format!(
                    "RPS limit {rps_limit} exceeds maximum supported value {}",
                    u32::MAX
                ));
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_defaults() {
        let config = LoadTestConfig {
            url: "https://example.com".to_string(),
            method: default_method(),
            headers: vec![],
            body: None,
            duration_secs: default_duration_secs(),
            concurrency: default_concurrency(),
            rps_limit: None,
            timeout_ms: default_timeout_ms(),
        };

        assert_eq!(config.method, "GET");
        assert_eq!(config.concurrency, 10);
        assert_eq!(config.duration_secs, 10);
    }

    #[test]
    fn test_config_validation() {
        let mut config = LoadTestConfig {
            url: "".to_string(),
            method: "GET".to_string(),
            headers: vec![],
            body: None,
            duration_secs: 10,
            concurrency: 10,
            rps_limit: None,
            timeout_ms: 30000,
        };

        assert!(config.validate().is_err());

        config.url = "https://example.com".to_string();
        assert!(config.validate().is_ok());

        config.concurrency = 0;
        assert!(config.validate().is_err());

        config.concurrency = 10;
        config.rps_limit = Some(0);
        assert!(config.validate().is_err());

        config.rps_limit = Some(u32::MAX as u64 + 1);
        assert!(config.validate().is_err());

        config.rps_limit = Some(1000);
        assert!(config.validate().is_ok());
    }
}
