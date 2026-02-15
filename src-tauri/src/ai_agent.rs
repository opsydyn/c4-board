use crate::db::AppDb;
use rig::{client::CompletionClient, completion::Prompt, providers::openai};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

const DEFAULT_MODEL: &str = "gpt-4o-mini";
const DEFAULT_PROMPT: &str = "Say hello to OPSYDYN // PRECISION TOOLS and keep it short.";
const OPENAI_API_KEY_SETTING_KEY: &str = "openAiApiKey";
const OPENAI_KEY_ENV_KEYS: [&str; 2] = ["OPSYDYN_OPENAI_API_KEY", "OPENAI_API_KEY"];

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RigAgentHelloRequest {
    pub prompt: Option<String>,
    pub model: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RigAgentHelloResponse {
    pub message: String,
    pub provider: String,
    pub model: String,
    pub prompt: String,
    pub responded_at_ms: i64,
}

fn first_non_empty(value: Option<String>, fallback: &str) -> String {
    match value {
        Some(raw) => {
            let normalized = raw.trim();
            if normalized.is_empty() {
                fallback.to_string()
            } else {
                normalized.to_string()
            }
        }
        None => fallback.to_string(),
    }
}

fn normalize_secret(value: &str) -> Option<String> {
    let normalized = value.trim();
    if normalized.is_empty() {
        None
    } else {
        Some(normalized.to_string())
    }
}

fn resolve_openai_api_key_from_env() -> Option<String> {
    for key in OPENAI_KEY_ENV_KEYS {
        if let Ok(value) = std::env::var(key) {
            if let Some(normalized) = normalize_secret(&value) {
                return Some(normalized);
            }
        }
    }
    None
}

fn parse_stored_setting_value(raw: &str) -> Option<String> {
    if let Ok(decoded) = serde_json::from_str::<String>(raw) {
        return normalize_secret(&decoded);
    }
    normalize_secret(raw.trim_matches('"'))
}

async fn resolve_openai_api_key_from_settings(state: &State<'_, AppDb>) -> Option<String> {
    let row = sqlx::query("SELECT value FROM app_settings WHERE key = ? LIMIT 1")
        .bind(OPENAI_API_KEY_SETTING_KEY)
        .fetch_optional(&state.0)
        .await
        .ok()?;

    let raw = row?.try_get::<String, _>("value").ok()?;
    parse_stored_setting_value(&raw)
}

async fn resolve_openai_api_key(state: &State<'_, AppDb>) -> Option<String> {
    if let Some(from_settings) = resolve_openai_api_key_from_settings(state).await {
        return Some(from_settings);
    }
    resolve_openai_api_key_from_env()
}

fn now_unix_ms() -> i64 {
    match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(duration) => duration.as_millis() as i64,
        Err(_) => 0,
    }
}

#[tauri::command]
pub async fn rig_agent_hello(
    state: State<'_, AppDb>,
    input: RigAgentHelloRequest,
) -> Result<RigAgentHelloResponse, String> {
    let model = first_non_empty(input.model, DEFAULT_MODEL);
    let prompt = first_non_empty(input.prompt, DEFAULT_PROMPT);

    let api_key = resolve_openai_api_key(&state).await.ok_or_else(|| {
        "Rig agent requires an OpenAI key. Add one in Settings > AI Agent or set OPSYDYN_OPENAI_API_KEY / OPENAI_API_KEY.".to_string()
    })?;

    let client: openai::Client = openai::Client::builder()
        .api_key(&api_key)
        .build()
        .map_err(|error| format!("Failed to initialize OpenAI client: {error}"))?;
    let agent = client
        .agent(&model)
        .preamble("You are the OPSYDYN assistant. Reply with one concise sentence.")
        .build();

    let message = agent
        .prompt(&prompt)
        .await
        .map_err(|error| format!("rig_agent_hello failed: {error}"))?;

    Ok(RigAgentHelloResponse {
        message,
        provider: "openai".to_string(),
        model,
        prompt,
        responded_at_ms: now_unix_ms(),
    })
}
