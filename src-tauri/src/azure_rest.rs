//! The Azure Resource Graph transport (ADR-018 Phase 1).
//!
//! Queries used to run through `az graph query`, which made the CLI both the
//! credential source and the wire. That had three costs. Throttling could not be
//! handled, because `az` had already swallowed the 429 by the time we saw a
//! non-zero exit. Truncation could only be *inferred* from the presence of a
//! skip token. And the `resource-graph` CLI extension had to be installed on
//! every machine.
//!
//! This module owns the HTTP call and nothing else. Authentication is
//! deliberately unchanged in this phase — the bearer token still comes from
//! `az account get-access-token` — so the transport swap is verifiable on its
//! own before credentials become pluggable (ADR-018 Phase 3).
//!
//! Verified against the live endpoint before it was written: the response
//! carries `totalRecords` alongside `count`, so "there is more than we
//! fetched" becomes a fact rather than a guess.

use serde::Deserialize;
use serde_json::{json, Value as JsonValue};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::process::Command;

const RESOURCE_GRAPH_URL: &str =
    "https://management.azure.com/providers/Microsoft.ResourceGraph/resources?api-version=2022-10-01";
const MANAGEMENT_RESOURCE: &str = "https://management.azure.com";

#[derive(Debug, thiserror::Error)]
pub enum AzureRestError {
    #[error("Azure CLI (az) was not found or failed to launch: {0}")]
    CliMissing(String),
    #[error("Azure authentication is required. Run `az login` and retry.")]
    NotAuthenticated,
    #[error("Azure denied this request (403). The signed-in principal lacks Reader on the requested scope.")]
    Forbidden,
    #[error("Azure rate limited this request (429). Retry shortly.")]
    Throttled,
    #[error("Azure Resource Graph rejected the query (400): {0}")]
    BadQuery(String),
    #[error("Azure Resource Graph request failed (HTTP {status}): {detail}")]
    Http { status: u16, detail: String },
    #[error("Azure Resource Graph returned a response that could not be read: {0}")]
    Malformed(String),
    #[error("Azure Resource Graph still failing after {attempts} attempts: {detail}")]
    RetriesExhausted { attempts: u32, detail: String },
}

/// One page of results, plus what the service says about the whole result set.
#[derive(Debug, Clone)]
pub struct ResourceGraphPage {
    pub rows: Vec<JsonValue>,
    pub skip_token: Option<String>,
    /// Rows matching the query in total, which may exceed what was returned.
    pub total_records: u64,
    /// Set by the service when it truncated the result set itself.
    pub result_truncated: bool,
}

#[derive(Debug, Deserialize)]
struct RawPage {
    #[serde(default)]
    data: Vec<JsonValue>,
    #[serde(rename = "$skipToken", default)]
    skip_token: Option<String>,
    #[serde(rename = "totalRecords", default)]
    total_records: u64,
    /// The service sends this as a JSON string ("true"/"false"), not a boolean.
    /// Typed loosely so a future shape change degrades to "not truncated"
    /// rather than failing the whole decode.
    #[serde(rename = "resultTruncated", default)]
    result_truncated: Option<JsonValue>,
}

fn is_truncated(value: Option<&JsonValue>) -> bool {
    match value {
        Some(JsonValue::Bool(flag)) => *flag,
        Some(JsonValue::String(text)) => text.eq_ignore_ascii_case("true"),
        _ => false,
    }
}

/// Acquires a management-plane bearer token from the Azure CLI.
///
/// The token never leaves this module's callers as data: it goes into a header
/// and is never logged, returned, or included in an error (ADR-012).
async fn acquire_token() -> Result<String, AzureRestError> {
    let output = Command::new("az")
        .args([
            "account",
            "get-access-token",
            "--resource",
            MANAGEMENT_RESOURCE,
            "--output",
            "json",
        ])
        .output()
        .await
        .map_err(|error| AzureRestError::CliMissing(error.to_string()))?;

    if !output.status.success() {
        return Err(AzureRestError::NotAuthenticated);
    }

    let payload: JsonValue = serde_json::from_slice(&output.stdout)
        .map_err(|error| AzureRestError::Malformed(error.to_string()))?;

    payload
        .get("accessToken")
        .and_then(|value| value.as_str())
        .filter(|token| !token.trim().is_empty())
        .map(str::to_string)
        .ok_or(AzureRestError::NotAuthenticated)
}

/// Maps an HTTP status onto an error a caller can act on.
///
/// The body is included only for 400, where it names the offending KQL and is
/// the difference between a fixable message and a shrug. Other statuses carry a
/// short detail; nothing here echoes request headers, which would carry the
/// bearer token.
fn classify_status(status: u16, body: &str) -> AzureRestError {
    let detail: String = body.trim().chars().take(600).collect();

    match status {
        400 => AzureRestError::BadQuery(detail),
        401 => AzureRestError::NotAuthenticated,
        403 => AzureRestError::Forbidden,
        429 => AzureRestError::Throttled,
        _ => AzureRestError::Http { status, detail },
    }
}

/// What to do after a failed attempt (ADR-018 Phase 2).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RetryDecision {
    /// Wait this long, then try again.
    RetryAfter(Duration),
    /// Either the failure is not transient, or the attempts are spent.
    GiveUp,
}

/// Attempts in total, including the first. Bounded so a throttled tenant fails
/// with a clear message rather than hanging the panel indefinitely.
const MAX_ATTEMPTS: u32 = 4;
/// Longest wait we will honour from a `Retry-After`. A service asking for ten
/// minutes should surface as a clear failure, not a frozen UI.
const MAX_HONOURED_DELAY: Duration = Duration::from_secs(30);
const BASE_BACKOFF: Duration = Duration::from_millis(500);

/// Parses `Retry-After`, which Azure sends as whole seconds.
///
/// The HTTP-date form is not handled: Azure Resource Graph does not use it, and
/// guessing at a date format would risk a wildly wrong delay. Unparseable
/// values fall back to our own backoff, which is the safe direction.
fn parse_retry_after(header: Option<&str>) -> Option<Duration> {
    header?.trim().parse::<u64>().ok().map(Duration::from_secs)
}

/// Capped exponential backoff. `jitter_ratio` is supplied by the caller so the
/// policy stays deterministic under test; it spreads retries so several callers
/// do not return in lockstep.
fn backoff_delay(attempt: u32, jitter_ratio: f64) -> Duration {
    let exponent = attempt.saturating_sub(1).min(5);
    let base = BASE_BACKOFF.saturating_mul(1u32 << exponent);
    let capped = base.min(MAX_HONOURED_DELAY);
    let jitter = capped.mul_f64(jitter_ratio.clamp(0.0, 1.0) * 0.25);
    capped + jitter
}

/// Decides whether a failure is worth another attempt.
///
/// Only conditions that retrying can actually fix: throttling, service
/// unavailability, and network-level failures. A 400, 401 or 403 is retried
/// never — the query is malformed, or the principal lacks access, and trying
/// again only delays a message the operator needs now.
pub fn retry_decision(
    attempt: u32,
    error: &AzureRestError,
    retry_after: Option<&str>,
    jitter_ratio: f64,
) -> RetryDecision {
    if attempt >= MAX_ATTEMPTS {
        return RetryDecision::GiveUp;
    }

    let transient = match error {
        AzureRestError::Throttled => true,
        AzureRestError::Http { status, .. } => *status == 503 || *status == 0,
        _ => false,
    };

    if !transient {
        return RetryDecision::GiveUp;
    }

    // The service's own instruction beats our formula — it knows when it will
    // be ready and we are guessing.
    match parse_retry_after(retry_after) {
        Some(delay) if delay > MAX_HONOURED_DELAY => RetryDecision::GiveUp,
        Some(delay) => RetryDecision::RetryAfter(delay),
        None => RetryDecision::RetryAfter(backoff_delay(attempt, jitter_ratio)),
    }
}

/// Cheap jitter source. Not random enough for anything security-shaped, which
/// is fine — it exists only to stop retries returning in lockstep.
fn jitter_ratio() -> f64 {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.subsec_nanos())
        .unwrap_or(0);
    f64::from(nanos % 1_000) / 1_000.0
}

/// Runs one Resource Graph query page, retrying transient failures.
pub async fn query_page(
    subscription_ids: &[String],
    query: &str,
    page_size: usize,
    skip_token: Option<&str>,
) -> Result<ResourceGraphPage, AzureRestError> {
    let mut attempt = 1;

    loop {
        let outcome = attempt_page(subscription_ids, query, page_size, skip_token).await;

        let (error, retry_after) = match outcome {
            Ok(page) => return Ok(page),
            Err((error, retry_after)) => (error, retry_after),
        };

        match retry_decision(attempt, &error, retry_after.as_deref(), jitter_ratio()) {
            RetryDecision::GiveUp => {
                return Err(if attempt > 1 {
                    AzureRestError::RetriesExhausted {
                        attempts: attempt,
                        detail: error.to_string(),
                    }
                } else {
                    error
                });
            }
            RetryDecision::RetryAfter(delay) => {
                tokio::time::sleep(delay).await;
                attempt += 1;
            }
        }
    }
}

/// One HTTP attempt. Returns the `Retry-After` alongside the error so the
/// retry policy can honour it without this function knowing the policy.
async fn attempt_page(
    subscription_ids: &[String],
    query: &str,
    page_size: usize,
    skip_token: Option<&str>,
) -> Result<ResourceGraphPage, (AzureRestError, Option<String>)> {
    let token = acquire_token().await.map_err(|error| (error, None))?;

    let mut options = json!({
        "resultFormat": "objectArray",
        "$top": page_size,
    });
    if let Some(skip) = skip_token.filter(|value| !value.trim().is_empty()) {
        options["$skipToken"] = JsonValue::String(skip.to_string());
    }

    let body = json!({
        "subscriptions": subscription_ids,
        "query": query,
        "options": options,
    });

    let response = reqwest::Client::new()
        .post(RESOURCE_GRAPH_URL)
        .bearer_auth(token)
        .json(&body)
        .send()
        .await
        .map_err(|error| {
            // Status 0 marks a network-level failure: no response arrived, so
            // there is nothing to classify and a retry is worth making.
            (
                AzureRestError::Http {
                    status: 0,
                    detail: error.to_string(),
                },
                None,
            )
        })?;

    let status = response.status().as_u16();
    let retry_after = response
        .headers()
        .get("retry-after")
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);

    let text = response
        .text()
        .await
        .map_err(|error| (AzureRestError::Malformed(error.to_string()), None))?;

    if !(200..300).contains(&status) {
        return Err((classify_status(status, &text), retry_after));
    }

    let raw: RawPage = serde_json::from_str(&text)
        .map_err(|error| (AzureRestError::Malformed(error.to_string()), None))?;

    Ok(ResourceGraphPage {
        rows: raw.data,
        skip_token: raw.skip_token.filter(|value| !value.trim().is_empty()),
        total_records: raw.total_records,
        result_truncated: is_truncated(raw.result_truncated.as_ref()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn truncation_reads_the_string_the_service_actually_sends() {
        // Verified against the live endpoint: this field is "false", not false.
        assert!(is_truncated(Some(&JsonValue::String("true".into()))));
        assert!(is_truncated(Some(&JsonValue::String("True".into()))));
        assert!(!is_truncated(Some(&JsonValue::String("false".into()))));
    }

    #[test]
    fn truncation_still_reads_a_real_boolean_if_the_shape_changes() {
        assert!(is_truncated(Some(&JsonValue::Bool(true))));
        assert!(!is_truncated(Some(&JsonValue::Bool(false))));
    }

    #[test]
    fn absent_truncation_flag_is_not_truncated() {
        assert!(!is_truncated(None));
        assert!(!is_truncated(Some(&JsonValue::Null)));
    }

    #[test]
    fn a_page_decodes_with_the_dollar_prefixed_skip_token() {
        let raw: RawPage = serde_json::from_str(
            r#"{"data":[{"id":"a"}],"$skipToken":"tok","totalRecords":20,"resultTruncated":"false"}"#,
        )
        .expect("page should decode");

        assert_eq!(raw.data.len(), 1);
        assert_eq!(raw.skip_token.as_deref(), Some("tok"));
        assert_eq!(raw.total_records, 20);
    }

    #[test]
    fn a_final_page_decodes_without_a_skip_token() {
        let raw: RawPage =
            serde_json::from_str(r#"{"data":[],"totalRecords":0,"resultTruncated":"false"}"#)
                .expect("page should decode");

        assert!(raw.skip_token.is_none());
    }

    #[test]
    fn statuses_map_onto_actions_rather_than_numbers() {
        assert!(matches!(
            classify_status(401, ""),
            AzureRestError::NotAuthenticated
        ));
        assert!(matches!(
            classify_status(403, ""),
            AzureRestError::Forbidden
        ));
        assert!(matches!(
            classify_status(429, ""),
            AzureRestError::Throttled
        ));
        assert!(matches!(
            classify_status(400, "bad kql"),
            AzureRestError::BadQuery(_)
        ));
    }

    // Retry policy (ADR-018 Phase 2). Throttling cannot be triggered against
    // the available tenant — it is far too small — so the policy is written to
    // be decidable without a live 429 and tested that way.

    #[test]
    fn throttling_is_retried() {
        assert!(matches!(
            retry_decision(1, &AzureRestError::Throttled, None, 0.0),
            RetryDecision::RetryAfter(_)
        ));
    }

    #[test]
    fn a_permission_or_query_error_is_never_retried() {
        // Retrying these only delays a message the operator needs immediately.
        for error in [
            AzureRestError::Forbidden,
            AzureRestError::NotAuthenticated,
            AzureRestError::BadQuery("bad kql".into()),
        ] {
            assert_eq!(
                retry_decision(1, &error, Some("1"), 0.0),
                RetryDecision::GiveUp,
                "{error} should not be retried"
            );
        }
    }

    #[test]
    fn a_network_failure_is_retried_but_a_500_is_not() {
        let network = AzureRestError::Http {
            status: 0,
            detail: "connection reset".into(),
        };
        let server = AzureRestError::Http {
            status: 500,
            detail: String::new(),
        };

        assert!(matches!(
            retry_decision(1, &network, None, 0.0),
            RetryDecision::RetryAfter(_)
        ));
        assert_eq!(retry_decision(1, &server, None, 0.0), RetryDecision::GiveUp);
    }

    #[test]
    fn service_unavailable_is_retried_since_it_says_come_back() {
        let unavailable = AzureRestError::Http {
            status: 503,
            detail: String::new(),
        };

        assert!(matches!(
            retry_decision(1, &unavailable, None, 0.0),
            RetryDecision::RetryAfter(_)
        ));
    }

    #[test]
    fn the_services_own_retry_after_beats_our_backoff() {
        // It knows when it will be ready; we are guessing.
        assert_eq!(
            retry_decision(1, &AzureRestError::Throttled, Some("7"), 0.0),
            RetryDecision::RetryAfter(Duration::from_secs(7)),
        );
    }

    #[test]
    fn an_unreasonable_retry_after_is_refused_rather_than_slept_through() {
        assert_eq!(
            retry_decision(1, &AzureRestError::Throttled, Some("600"), 0.0),
            RetryDecision::GiveUp,
        );
    }

    #[test]
    fn an_unparseable_retry_after_falls_back_to_backoff() {
        // Including the HTTP-date form, which is deliberately not parsed.
        assert!(matches!(
            retry_decision(
                1,
                &AzureRestError::Throttled,
                Some("Wed, 21 Oct 2026 07:28:00 GMT"),
                0.0
            ),
            RetryDecision::RetryAfter(_)
        ));
    }

    #[test]
    fn attempts_are_bounded() {
        assert_eq!(
            retry_decision(MAX_ATTEMPTS, &AzureRestError::Throttled, None, 0.0),
            RetryDecision::GiveUp,
        );
    }

    #[test]
    fn backoff_grows_and_then_stops_growing() {
        let first = backoff_delay(1, 0.0);
        let second = backoff_delay(2, 0.0);

        assert!(second > first);
        assert!(backoff_delay(20, 0.0) <= MAX_HONOURED_DELAY.mul_f64(1.25));
    }

    #[test]
    fn jitter_only_ever_adds_a_little() {
        let plain = backoff_delay(2, 0.0);
        let jittered = backoff_delay(2, 1.0);

        assert!(jittered > plain);
        assert!(jittered <= plain.mul_f64(1.25));
    }

    #[test]
    fn errors_never_carry_a_bearer_token() {
        // The body is echoed for 400s; a token would only reach here through a
        // caller mistake, and this pins that it is not echoed wholesale.
        let error = classify_status(500, &"x".repeat(5_000));
        let rendered = error.to_string();

        assert!(!rendered.contains("Bearer"));
        assert!(rendered.len() < 800);
    }
}
