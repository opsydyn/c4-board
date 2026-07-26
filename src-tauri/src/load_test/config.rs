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

    /// Statuses that count as a pass. ADR-019 slice 4.
    ///
    /// `None` or empty means 2xx. An explicit list *replaces* that rather than
    /// extending it, so testing a rate limiter can declare 429 the expected
    /// outcome without 200 also passing.
    #[serde(default)]
    pub success_statuses: Option<Vec<u16>>,

    /// How many redirects to follow. `None` keeps the previous behaviour of ten.
    /// Zero stops following them, which is what you want when measuring the
    /// endpoint you actually named.
    #[serde(default)]
    pub max_redirects: Option<usize>,
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

/// Redirects followed when nothing says otherwise — reqwest's own default, kept
/// so this slice changes success classification and nothing else.
const DEFAULT_REDIRECT_LIMIT: usize = 10;

impl LoadTestConfig {
    /// Whether a status counts as a pass for *this* test.
    ///
    /// The old rule was `is_success() || is_redirection()`. Redirects are no
    /// longer a pass: reqwest follows them, so one arriving at the caller means
    /// the limit was exhausted — a loop, reported as healthy.
    pub fn is_success(&self, status: u16) -> bool {
        match self.success_statuses.as_ref() {
            Some(expected) if !expected.is_empty() => expected.contains(&status),
            _ => (200..300).contains(&status),
        }
    }

    pub fn redirect_limit(&self) -> usize {
        self.max_redirects.unwrap_or(DEFAULT_REDIRECT_LIMIT)
    }

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

        if let Some(expected) = self.success_statuses.as_ref() {
            if let Some(invalid) = expected.iter().find(|status| !(100..600).contains(*status)) {
                return Err(format!(
                    "Expected status {invalid} is outside the HTTP range 100-599"
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
            success_statuses: None,
            max_redirects: None,
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
            success_statuses: None,
            max_redirects: None,
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

#[cfg(test)]
mod policy_tests {
    use super::*;

    /// ADR-019 slice 4.
    ///
    /// Success was hardcoded as `is_success() || is_redirection()`. Two problems:
    /// what counts as a pass is a property of the test, not of HTTP — an endpoint
    /// under test may legitimately be expected to return 404 or 429 — and reqwest
    /// already follows up to ten redirects, so a 3xx reaching that check means the
    /// redirect limit was *exhausted*. A redirect loop was reported as healthy.
    fn config_with(success: Option<Vec<u16>>, redirects: Option<usize>) -> LoadTestConfig {
        LoadTestConfig {
            url: "https://example.com".to_string(),
            method: "GET".to_string(),
            headers: vec![],
            body: None,
            duration_secs: 1,
            concurrency: 1,
            rps_limit: None,
            timeout_ms: 1000,
            success_statuses: success,
            max_redirects: redirects,
        }
    }

    #[test]
    fn two_hundreds_pass_by_default() {
        let config = config_with(None, None);

        assert!(config.is_success(200));
        assert!(config.is_success(201));
        assert!(config.is_success(299));
    }

    #[test]
    fn a_redirect_no_longer_counts_as_success_by_default() {
        // Followed redirects never reach here; one that does means the limit was
        // exhausted, which is a failure however you look at it.
        let config = config_with(None, None);

        assert!(!config.is_success(301));
        assert!(!config.is_success(302));
    }

    #[test]
    fn errors_do_not_pass_by_default() {
        let config = config_with(None, None);

        assert!(!config.is_success(404));
        assert!(!config.is_success(429));
        assert!(!config.is_success(503));
    }

    #[test]
    fn an_explicit_list_replaces_the_default_entirely() {
        // Testing a rate limiter means 429 is the expected outcome, not a failure.
        let config = config_with(Some(vec![429]), None);

        assert!(config.is_success(429));
        assert!(!config.is_success(200), "the list is exhaustive, not additive");
    }

    #[test]
    fn an_empty_list_falls_back_to_the_default() {
        // Otherwise a cleared field would mark every response a failure.
        let config = config_with(Some(vec![]), None);

        assert!(config.is_success(200));
        assert!(!config.is_success(500));
    }

    #[test]
    fn redirects_are_followed_ten_deep_by_default() {
        assert_eq!(config_with(None, None).redirect_limit(), 10);
    }

    #[test]
    fn redirect_following_can_be_turned_off() {
        assert_eq!(config_with(None, Some(0)).redirect_limit(), 0);
    }

    #[test]
    fn validation_rejects_a_status_outside_the_http_range() {
        let config = config_with(Some(vec![99]), None);

        assert!(config.validate().is_err());
    }
}
