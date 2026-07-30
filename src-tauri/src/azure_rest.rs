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

/// Runs one Resource Graph query page.
pub async fn query_page(
    subscription_ids: &[String],
    query: &str,
    page_size: usize,
    skip_token: Option<&str>,
) -> Result<ResourceGraphPage, AzureRestError> {
    let token = acquire_token().await?;

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
        .map_err(|error| AzureRestError::Http {
            status: 0,
            detail: error.to_string(),
        })?;

    let status = response.status().as_u16();
    let text = response
        .text()
        .await
        .map_err(|error| AzureRestError::Malformed(error.to_string()))?;

    if !(200..300).contains(&status) {
        return Err(classify_status(status, &text));
    }

    let raw: RawPage = serde_json::from_str(&text)
        .map_err(|error| AzureRestError::Malformed(error.to_string()))?;

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
