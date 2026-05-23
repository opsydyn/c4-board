use crate::db::AppDb;
use rig::{client::CompletionClient, completion::Prompt, providers::openai};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

const DEFAULT_MODEL: &str = "gpt-4o-mini";
const DEFAULT_PROMPT: &str = "Say hello to OPSYDYN // PRECISION TOOLS and keep it short.";
const DEFAULT_TEMPERATURE: f64 = 0.2;
const DEFAULT_MAX_TOKENS: u64 = 1024;
const MIN_TEMPERATURE: f64 = 0.0;
const MAX_TEMPERATURE: f64 = 2.0;
const MIN_MAX_TOKENS: u64 = 64;
const MAX_MAX_TOKENS: u64 = 32_768;
const OPENAI_API_KEY_SETTING_KEY: &str = "openAiApiKey";
const OPENAI_KEY_ENV_KEYS: [&str; 2] = ["OPSYDYN_OPENAI_API_KEY", "OPENAI_API_KEY"];
const KEY_RESOLUTION_ORDER: [&str; 3] = ["keychain", "settings-db", "env"];
const SETTINGS_DB_STORAGE_WARNING: &str =
    "OpenAI key currently resolves from app settings (fallback). Keychain-first storage is recommended.";
const ENV_STORAGE_WARNING: &str =
    "OpenAI key currently resolves from environment variable fallback.";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RigAgentHelloRequest {
    pub prompt: Option<String>,
    pub model: Option<String>,
    pub temperature: Option<f64>,
    pub max_tokens: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RigAgentHelloResponse {
    pub message: String,
    pub provider: String,
    pub model: String,
    pub prompt: String,
    pub temperature: f64,
    pub max_tokens: u64,
    pub responded_at_ms: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum RigAgentSecretSource {
    Keychain,
    SettingsDb,
    Env,
    None,
}

#[derive(Debug, Clone)]
struct ResolvedSecret {
    value: String,
    source: RigAgentSecretSource,
    warning: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RigAgentSecretStatusResponse {
    pub configured: bool,
    pub source: RigAgentSecretSource,
    pub warning: Option<String>,
    pub resolution_order: Vec<String>,
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

fn normalize_temperature(value: Option<f64>) -> Option<f64> {
    match value {
        Some(raw) if raw.is_finite() && (MIN_TEMPERATURE..=MAX_TEMPERATURE).contains(&raw) => {
            Some(raw)
        }
        _ => None,
    }
}

fn normalize_max_tokens(value: Option<u64>) -> Option<u64> {
    match value {
        Some(raw) if (MIN_MAX_TOKENS..=MAX_MAX_TOKENS).contains(&raw) => Some(raw),
        _ => None,
    }
}

fn resolve_openai_api_key_from_keychain() -> Option<String> {
    // Keychain provider is intentionally a no-op placeholder for now.
    // This keeps resolver ordering stable while the native keychain backend
    // is introduced in a follow-up phase.
    None
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

async fn resolve_openai_secret(state: &State<'_, AppDb>) -> Option<ResolvedSecret> {
    if let Some(from_keychain) = resolve_openai_api_key_from_keychain() {
        return Some(ResolvedSecret {
            value: from_keychain,
            source: RigAgentSecretSource::Keychain,
            warning: None,
        });
    }

    if let Some(from_settings) = resolve_openai_api_key_from_settings(state).await {
        return Some(ResolvedSecret {
            value: from_settings,
            source: RigAgentSecretSource::SettingsDb,
            warning: Some(SETTINGS_DB_STORAGE_WARNING.to_string()),
        });
    }

    if let Some(from_env) = resolve_openai_api_key_from_env() {
        return Some(ResolvedSecret {
            value: from_env,
            source: RigAgentSecretSource::Env,
            warning: Some(ENV_STORAGE_WARNING.to_string()),
        });
    }

    None
}

fn now_unix_ms() -> i64 {
    match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(duration) => duration.as_millis() as i64,
        Err(_) => 0,
    }
}

#[tauri::command]
pub async fn rig_agent_secret_status(
    state: State<'_, AppDb>,
) -> Result<RigAgentSecretStatusResponse, String> {
    let resolved = resolve_openai_secret(&state).await;

    Ok(match resolved {
        Some(secret) => RigAgentSecretStatusResponse {
            configured: true,
            source: secret.source,
            warning: secret.warning,
            resolution_order: KEY_RESOLUTION_ORDER
                .iter()
                .map(|source| source.to_string())
                .collect(),
        },
        None => RigAgentSecretStatusResponse {
            configured: false,
            source: RigAgentSecretSource::None,
            warning: None,
            resolution_order: KEY_RESOLUTION_ORDER
                .iter()
                .map(|source| source.to_string())
                .collect(),
        },
    })
}

#[tauri::command]
pub async fn rig_agent_hello(
    state: State<'_, AppDb>,
    input: RigAgentHelloRequest,
) -> Result<RigAgentHelloResponse, String> {
    let model = first_non_empty(input.model, DEFAULT_MODEL);
    let prompt = first_non_empty(input.prompt, DEFAULT_PROMPT);
    let temperature = normalize_temperature(input.temperature).unwrap_or(DEFAULT_TEMPERATURE);
    let max_tokens = normalize_max_tokens(input.max_tokens).unwrap_or(DEFAULT_MAX_TOKENS);

    let secret = resolve_openai_secret(&state).await.ok_or_else(|| {
        "Rig agent requires an OpenAI key. Add one in Settings > AI Agent or set OPSYDYN_OPENAI_API_KEY / OPENAI_API_KEY.".to_string()
    })?;

    let client: openai::Client = openai::Client::builder()
        .api_key(&secret.value)
        .build()
        .map_err(|error| format!("Failed to initialize OpenAI client: {error}"))?;
    let agent = client
        .agent(&model)
        .preamble("You are the OPSYDYN assistant. Reply with one concise sentence.")
        .temperature(temperature)
        .max_tokens(max_tokens)
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
        temperature,
        max_tokens,
        responded_at_ms: now_unix_ms(),
    })
}
