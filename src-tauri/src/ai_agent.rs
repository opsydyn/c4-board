use crate::db::AppDb;
use crate::rig_runtime::{extract_openai, prompt_openai, RigRuntimeError, RigUsageMetadata};
use keyring::Entry;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::collections::HashSet;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;
use tokio::task::spawn_blocking;

const DEFAULT_MODEL: &str = "gpt-4o-mini";
const DEFAULT_PROMPT: &str = "Say hello to OPSYDYN // PRECISION TOOLS and keep it short.";
const DEFAULT_TEMPERATURE: f64 = 0.2;
const DEFAULT_MAX_TOKENS: u64 = 1024;
const MIN_TEMPERATURE: f64 = 0.0;
const MAX_TEMPERATURE: f64 = 2.0;
const MIN_MAX_TOKENS: u64 = 64;
const MAX_MAX_TOKENS: u64 = 32_768;
const MAX_REVIEW_LIST_ITEMS: usize = 8;
const OPENAI_API_KEY_SETTING_KEY: &str = "openAiApiKey";
const OPENAI_KEY_ENV_KEYS: [&str; 2] = ["OPSYDYN_OPENAI_API_KEY", "OPENAI_API_KEY"];
const KEY_RESOLUTION_ORDER: [&str; 3] = ["keychain", "settings-db", "env"];
const KEYCHAIN_SERVICE_NAME: &str = "com.opsydyn.c4board";
const OPENAI_KEYCHAIN_ACCOUNT_NAME: &str = "openai-api-key";
const SETTINGS_DB_STORAGE_WARNING: &str =
    "OpenAI key currently resolves from app settings (fallback). Keychain-first storage is recommended.";
const ENV_STORAGE_WARNING: &str =
    "OpenAI key currently resolves from environment variable fallback.";
const DEV_KEYCHAIN_FALLBACK_WARNING: &str =
    "Keychain access is unavailable in this runtime. Using app settings fallback.";
const DEV_KEYCHAIN_DISABLED_WARNING: &str =
    "Keychain storage is disabled for macOS debug builds. Using app settings fallback.";

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
    pub usage: RigUsageMetadata,
    pub responded_at_ms: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RigC4DiagramPlanRequest {
    pub description: String,
    pub diagram_context: Option<String>,
    pub board_summary: Option<RigC4BoardSummary>,
    pub model: Option<String>,
    pub max_tokens: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RigC4BoardReviewRequest {
    pub focus: Option<String>,
    pub diagram_context: Option<String>,
    pub board_summary: RigC4BoardSummary,
    pub model: Option<String>,
    pub max_tokens: Option<u64>,
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RigC4BoardSummaryNode {
    pub id: String,
    pub label: String,
    pub node_type: RigC4ProposalNodeType,
    pub description: Option<String>,
    pub technology: Option<String>,
    pub team_ownership: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RigC4BoardSummaryEdge {
    pub id: String,
    pub source_id: String,
    pub target_id: String,
    pub source_label: String,
    pub target_label: String,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RigC4BoardSummary {
    pub diagram_id: Option<String>,
    pub diagram_name: Option<String>,
    pub node_count: i64,
    pub edge_count: i64,
    pub nodes: Vec<RigC4BoardSummaryNode>,
    pub edges: Vec<RigC4BoardSummaryEdge>,
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub enum RigC4ProposalNodeType {
    Person,
    System,
    ExternalSystem,
    Container,
    Component,
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RigC4ProposalNode {
    pub key: String,
    pub node_type: RigC4ProposalNodeType,
    pub label: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RigC4ProposalEdge {
    pub source_key: String,
    pub target_key: String,
    pub label: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RigC4DiagramProposalPayload {
    pub summary: String,
    pub rationale: String,
    pub warnings: Vec<String>,
    pub nodes: Vec<RigC4ProposalNode>,
    pub edges: Vec<RigC4ProposalEdge>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RigC4DiagramPlanResponse {
    #[serde(flatten)]
    pub proposal: RigC4DiagramProposalPayload,
    pub provider: String,
    pub model: String,
    pub usage: RigUsageMetadata,
    pub responded_at_ms: i64,
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub enum RigC4ReviewPriority {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RigC4ReviewNote {
    pub title: String,
    pub detail: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RigC4ReviewRisk {
    pub title: String,
    pub detail: String,
    pub severity: RigC4ReviewPriority,
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RigC4RecommendedChange {
    pub title: String,
    pub rationale: String,
    pub priority: RigC4ReviewPriority,
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RigC4BoardReviewPayload {
    pub summary: String,
    pub strengths: Vec<RigC4ReviewNote>,
    pub risks: Vec<RigC4ReviewRisk>,
    pub ambiguities: Vec<RigC4ReviewNote>,
    pub missing_nodes: Vec<String>,
    pub missing_edges: Vec<String>,
    pub recommended_changes: Vec<RigC4RecommendedChange>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RigC4BoardReviewResponse {
    #[serde(flatten)]
    pub review: RigC4BoardReviewPayload,
    pub provider: String,
    pub model: String,
    pub usage: RigUsageMetadata,
    pub responded_at_ms: i64,
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RigReadToolName {
    BoardSummary,
    NodeLookup,
    EdgeLookup,
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema, Default)]
#[serde(rename_all = "camelCase")]
pub struct RigReadBoardSummaryInput {}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RigReadNodeLookupInput {
    pub node_id: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RigReadEdgeLookupInput {
    pub edge_id: String,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RigReadBoardSummaryResult {
    pub diagram_id: Option<String>,
    pub diagram_name: Option<String>,
    pub node_count: i64,
    pub edge_count: i64,
    pub ownership_teams: Vec<String>,
    pub nodes: Vec<RigC4BoardSummaryNode>,
    pub edges: Vec<RigC4BoardSummaryEdge>,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RigReadNodeLookupResult {
    pub found: bool,
    pub node: Option<RigC4BoardSummaryNode>,
    pub relationship_count: i64,
    pub connected_edges: Vec<RigC4BoardSummaryEdge>,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RigReadEdgeLookupResult {
    pub found: bool,
    pub edge: Option<RigC4BoardSummaryEdge>,
    pub source_node: Option<RigC4BoardSummaryNode>,
    pub target_node: Option<RigC4BoardSummaryNode>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RigReadToolRequest {
    pub tool: RigReadToolName,
    pub input: serde_json::Value,
    pub board_summary: RigC4BoardSummary,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RigReadToolResponse {
    pub tool: RigReadToolName,
    pub result: serde_json::Value,
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

fn resolve_model(value: Option<String>) -> String {
    first_non_empty(value, DEFAULT_MODEL)
}

fn resolve_temperature(value: Option<f64>) -> f64 {
    normalize_temperature(value).unwrap_or(DEFAULT_TEMPERATURE)
}

fn resolve_max_tokens(value: Option<u64>) -> u64 {
    normalize_max_tokens(value).unwrap_or(DEFAULT_MAX_TOKENS)
}

fn map_runtime_error(operation: &str, error: RigRuntimeError) -> String {
    format!("{operation} failed: {error}")
}

fn to_hello_response(
    message: String,
    model: String,
    prompt: String,
    temperature: f64,
    max_tokens: u64,
    usage: RigUsageMetadata,
    responded_at_ms: i64,
) -> RigAgentHelloResponse {
    RigAgentHelloResponse {
        message,
        provider: "openai".to_string(),
        model,
        prompt,
        temperature,
        max_tokens,
        usage,
        responded_at_ms,
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

fn normalize_optional_string(value: Option<String>) -> Option<String> {
    value.and_then(|raw| normalize_secret(&raw))
}

fn normalize_optional_content(value: Option<String>) -> Option<String> {
    value.and_then(|raw| {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
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

fn create_openai_keychain_entry() -> Result<Entry, String> {
    Entry::new(KEYCHAIN_SERVICE_NAME, OPENAI_KEYCHAIN_ACCOUNT_NAME)
        .map_err(|error| format!("Unable to create OpenAI keychain entry: {error}"))
}

fn is_missing_keyring_entry(error: &keyring::Error) -> bool {
    let normalized = error.to_string().to_lowercase();
    normalized.contains("no entry")
        || normalized.contains("no matching entry")
        || normalized.contains("password not found")
        || normalized.contains("credential not found")
}

async fn resolve_openai_api_key_from_keychain() -> Result<Option<String>, String> {
    spawn_blocking(|| {
        let entry = create_openai_keychain_entry()?;
        match entry.get_password() {
            Ok(value) => Ok(normalize_secret(&value)),
            Err(error) if is_missing_keyring_entry(&error) => Ok(None),
            Err(error) => Err(format!("Unable to read OpenAI key from keychain: {error}")),
        }
    })
    .await
    .map_err(|error| format!("OpenAI keychain read task failed: {error}"))?
}

async fn store_openai_api_key_in_keychain(secret: String) -> Result<(), String> {
    spawn_blocking(move || {
        let entry = create_openai_keychain_entry()?;
        entry
            .set_password(&secret)
            .map_err(|error| format!("Unable to store OpenAI key in keychain: {error}"))
    })
    .await
    .map_err(|error| format!("OpenAI keychain write task failed: {error}"))?
}

async fn clear_openai_api_key_from_keychain() -> Result<(), String> {
    spawn_blocking(|| {
        let entry = create_openai_keychain_entry()?;
        match entry.delete_credential() {
            Ok(()) => Ok(()),
            Err(error) if is_missing_keyring_entry(&error) => Ok(()),
            Err(error) => Err(format!("Unable to clear OpenAI key from keychain: {error}")),
        }
    })
    .await
    .map_err(|error| format!("OpenAI keychain delete task failed: {error}"))?
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

fn compose_secret_warning(base: &str, detail: &str) -> String {
    format!("{base} {detail}")
}

#[cfg(all(target_os = "macos", debug_assertions))]
fn keychain_supported_in_runtime() -> bool {
    false
}

#[cfg(not(all(target_os = "macos", debug_assertions)))]
fn keychain_supported_in_runtime() -> bool {
    true
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

async fn clear_openai_api_key_from_settings(state: &State<'_, AppDb>) -> Result<(), String> {
    sqlx::query("DELETE FROM app_settings WHERE key = ?")
        .bind(OPENAI_API_KEY_SETTING_KEY)
        .execute(&state.0)
        .await
        .map_err(|error| {
            format!("Unable to clear OpenAI key from app settings fallback: {error}")
        })?;

    Ok(())
}

async fn store_openai_api_key_in_settings(
    state: &State<'_, AppDb>,
    secret: &str,
) -> Result<(), String> {
    let encoded_secret = serde_json::to_string(secret).map_err(|error| {
        format!("Unable to encode OpenAI key for app settings fallback: {error}")
    })?;

    sqlx::query(
        "INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    )
    .bind(OPENAI_API_KEY_SETTING_KEY)
    .bind(encoded_secret)
    .bind(now_unix_ms())
    .execute(&state.0)
    .await
    .map_err(|error| format!("Unable to store OpenAI key in app settings fallback: {error}"))?;

    Ok(())
}

async fn resolve_openai_secret(state: &State<'_, AppDb>) -> Result<Option<ResolvedSecret>, String> {
    if !keychain_supported_in_runtime() {
        if let Some(from_settings) = resolve_openai_api_key_from_settings(state).await {
            return Ok(Some(ResolvedSecret {
                value: from_settings,
                source: RigAgentSecretSource::SettingsDb,
                warning: Some(DEV_KEYCHAIN_DISABLED_WARNING.to_string()),
            }));
        }

        if let Some(from_env) = resolve_openai_api_key_from_env() {
            return Ok(Some(ResolvedSecret {
                value: from_env,
                source: RigAgentSecretSource::Env,
                warning: Some(ENV_STORAGE_WARNING.to_string()),
            }));
        }

        return Ok(None);
    }

    let keychain_result = resolve_openai_api_key_from_keychain().await;
    let keychain_read_error = match keychain_result {
        Ok(Some(from_keychain)) => {
            return Ok(Some(ResolvedSecret {
                value: from_keychain,
                source: RigAgentSecretSource::Keychain,
                warning: None,
            }))
        }
        Ok(None) => None,
        Err(error) => Some(error),
    };

    if let Some(from_settings) = resolve_openai_api_key_from_settings(state).await {
        return Ok(Some(ResolvedSecret {
            value: from_settings,
            source: RigAgentSecretSource::SettingsDb,
            warning: Some(match keychain_read_error {
                Some(ref error) => compose_secret_warning(DEV_KEYCHAIN_FALLBACK_WARNING, error),
                None => SETTINGS_DB_STORAGE_WARNING.to_string(),
            }),
        }));
    }

    if let Some(from_env) = resolve_openai_api_key_from_env() {
        return Ok(Some(ResolvedSecret {
            value: from_env,
            source: RigAgentSecretSource::Env,
            warning: Some(match keychain_read_error {
                Some(ref error) => compose_secret_warning(ENV_STORAGE_WARNING, error),
                None => ENV_STORAGE_WARNING.to_string(),
            }),
        }));
    }

    match keychain_read_error {
        Some(error) => Err(error),
        None => Ok(None),
    }
}

fn now_unix_ms() -> i64 {
    match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(duration) => duration.as_millis() as i64,
        Err(_) => 0,
    }
}

fn build_c4_diagram_plan_preamble() -> &'static str {
    "You are OPY Net, a proposal-only C4 architecture planner.
Convert architecture descriptions into concise C4 node and edge proposals.
Always return a realistic draft, even when details are missing.
When current-board context shows an existing node already fits the request, prefer reusing that concept instead of duplicating it.
Infer safe relationships from explicit architecture language such as uses, publishes, subscribes, processes, stores, reads, writes, calls, sends to, backed by, or depends on.
For event-driven descriptions, prefer publisher -> broker/bus, broker/bus -> processor/subscriber, and processor/service -> datastore edges when those concepts are present.
Only omit edges when no defensible relationship can be inferred; if direction or label is uncertain, include the best concise edge and record the assumption in warnings.
Use the warnings field for ambiguity, assumptions, guessed boundaries, inferred relationships, or unresolved relationships.
Do not describe implementation code, database tables, deployment YAML, or anything outside C4 concepts.
Node keys must be unique kebab-case identifiers.
Define each node key once, then reuse that exact key in every edge.
Never invent a new source or target key inside an edge that is not present in the node list.
Every edge must reference valid node keys and include a concise relationship label.
Prefer 2 to 8 nodes unless the operator explicitly asks for more detail.
Treat this as preview mode only. No board mutation is being applied."
}

fn build_c4_board_review_preamble() -> &'static str {
    "You are OPY Net, a read-only C4 architecture reviewer.
Assess only what is visible or reasonably inferable from the current board snapshot.
Focus on boundary clarity, actor/system coverage, relationship clarity, coupling signals, and architectural ambiguity.
Use strengths for what is already clear and well-structured.
Use risks for concrete architectural concerns that matter to comprehension or change safety.
Use ambiguities for unclear naming, missing labels, or uncertain boundaries.
Use missingNodes and missingEdges only when their absence materially hurts understanding of the architecture.
Use recommendedChanges for concise, high-value next improvements.
Do not propose implementation details, code-level refactors, database tables, or deployment infrastructure unless they are explicitly modeled on the board.
This is review mode only. No board mutation is being applied."
}

fn build_c4_diagram_plan_text(description: &str) -> String {
    let normalized_description = description.trim();
    format!(
        "Create a proposal-only C4 diagram draft from the operator description below.\n\
         Return only the structured fields requested by the extraction schema.\n\
         \n\
         Operator description:\n\
         {normalized_description}"
    )
}

fn build_c4_board_review_text(focus: Option<&str>) -> String {
    match focus {
        Some(focus) => format!(
            "Review the current C4 board with emphasis on this focus area.\n\
             Return only the structured fields requested by the extraction schema.\n\
             \n\
             Focus:\n\
             {focus}"
        ),
        None => "Review the current C4 board holistically.\n\
                 Return only the structured fields requested by the extraction schema."
            .to_string(),
    }
}

fn build_c4_board_summary_context(board_summary: &RigC4BoardSummary) -> Option<String> {
    if board_summary.nodes.is_empty() && board_summary.edges.is_empty() {
        return Some("Current board snapshot: empty board.".to_string());
    }

    let mut sections = Vec::new();

    let diagram_name = board_summary.diagram_name.as_deref().unwrap_or("untitled");
    let diagram_id = board_summary.diagram_id.as_deref().unwrap_or("unsaved");

    sections.push(format!(
        "Current board snapshot:\n\
         - diagram name: {diagram_name}\n\
         - diagram id: {diagram_id}\n\
         - node count: {}\n\
         - edge count: {}",
        board_summary.node_count, board_summary.edge_count
    ));

    if !board_summary.nodes.is_empty() {
        let node_lines = board_summary
            .nodes
            .iter()
            .map(|node| {
                let mut fields = vec![
                    format!("id={}", node.id),
                    format!("type={:?}", node.node_type),
                    format!("label={}", node.label),
                ];

                if let Some(description) =
                    normalize_secret(node.description.as_deref().unwrap_or(""))
                {
                    fields.push(format!("description={description}"));
                }

                if let Some(technology) = normalize_secret(node.technology.as_deref().unwrap_or(""))
                {
                    fields.push(format!("technology={technology}"));
                }

                if let Some(owner) = normalize_secret(node.team_ownership.as_deref().unwrap_or(""))
                {
                    fields.push(format!("owner={owner}"));
                }

                format!("- {}", fields.join(" | "))
            })
            .collect::<Vec<_>>()
            .join("\n");
        sections.push(format!("Existing nodes:\n{node_lines}"));
    }

    if !board_summary.edges.is_empty() {
        let edge_lines = board_summary
            .edges
            .iter()
            .map(|edge| {
                let label = edge.label.as_deref().unwrap_or("(no label)");
                format!(
                    "- id={} | {} -> {} | label={} | sourceId={} | targetId={}",
                    edge.id,
                    edge.source_label,
                    edge.target_label,
                    label,
                    edge.source_id,
                    edge.target_id
                )
            })
            .collect::<Vec<_>>()
            .join("\n");
        sections.push(format!("Existing edges:\n{edge_lines}"));
    }

    Some(sections.join("\n\n"))
}

/// Postee agent context, mirroring the shape assembled and **redacted** in
/// TypeScript by `postee/agent-redaction.ts` (ADR-012).
///
/// Deliberately carries no database handle and no raw secrets. Like the board
/// tools, these operate purely on what the frontend supplies — which is what keeps
/// the redaction boundary unbypassable. A tool that queried the database here would
/// reintroduce every secret the boundary exists to remove.
#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RigPosteeContextHeader {
    pub key: String,
    /// `None` when the value was withheld, which is the default.
    pub value: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RigPosteeContextRequest {
    pub name: String,
    pub method: String,
    pub url: String,
    pub headers: Vec<RigPosteeContextHeader>,
    pub body_mode: String,
    pub body: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RigPosteeContextEnvironment {
    pub name: String,
    /// Keys only. Values never cross this boundary in any redaction mode.
    pub variable_keys: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RigPosteeContextResponse {
    pub status: i64,
    pub duration_ms: i64,
    pub size_bytes: i64,
    pub body: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RigPosteeContext {
    pub request: RigPosteeContextRequest,
    pub environment: Option<RigPosteeContextEnvironment>,
    pub last_response: Option<RigPosteeContextResponse>,
    /// What the redaction boundary withheld, so the agent can say so rather than
    /// guess at values it was never given.
    pub withheld: Vec<String>,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub enum RigPosteeReadToolName {
    ActiveRequest,
    EnvironmentKeys,
    LastResponseSummary,
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema, Default)]
#[serde(rename_all = "camelCase")]
pub struct RigPosteeEmptyInput {}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RigPosteeReadToolRequest {
    pub tool: RigPosteeReadToolName,
    pub input: serde_json::Value,
    pub context: RigPosteeContext,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RigPosteeReadToolResponse {
    pub tool: RigPosteeReadToolName,
    pub result: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RigPosteeActiveRequestResult {
    pub name: String,
    pub method: String,
    pub url: String,
    /// Header names, plus whether each value was supplied.
    pub header_keys: Vec<String>,
    pub headers_with_values: Vec<String>,
    pub body_mode: String,
    pub has_body: bool,
    pub withheld: Vec<String>,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RigPosteeEnvironmentKeysResult {
    pub name: Option<String>,
    pub variable_keys: Vec<String>,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RigPosteeLastResponseResult {
    pub has_response: bool,
    pub status: Option<i64>,
    pub duration_ms: Option<i64>,
    pub size_bytes: Option<i64>,
    pub body: Option<String>,
}

fn execute_postee_active_request_tool(context: &RigPosteeContext) -> RigPosteeActiveRequestResult {
    let mut header_keys = context
        .request
        .headers
        .iter()
        .map(|header| header.key.clone())
        .collect::<Vec<_>>();
    header_keys.sort();

    let mut headers_with_values = context
        .request
        .headers
        .iter()
        .filter(|header| header.value.is_some())
        .map(|header| header.key.clone())
        .collect::<Vec<_>>();
    headers_with_values.sort();

    RigPosteeActiveRequestResult {
        name: context.request.name.clone(),
        method: context.request.method.clone(),
        url: context.request.url.clone(),
        header_keys,
        headers_with_values,
        body_mode: context.request.body_mode.clone(),
        has_body: context.request.body.is_some(),
        withheld: context.withheld.clone(),
    }
}

fn execute_postee_environment_keys_tool(
    context: &RigPosteeContext,
) -> RigPosteeEnvironmentKeysResult {
    match context.environment.as_ref() {
        Some(environment) => {
            let mut variable_keys = environment.variable_keys.clone();
            variable_keys.sort();
            RigPosteeEnvironmentKeysResult {
                name: Some(environment.name.clone()),
                variable_keys,
            }
        }
        None => RigPosteeEnvironmentKeysResult {
            name: None,
            variable_keys: Vec::new(),
        },
    }
}

fn execute_postee_last_response_tool(context: &RigPosteeContext) -> RigPosteeLastResponseResult {
    match context.last_response.as_ref() {
        Some(response) => RigPosteeLastResponseResult {
            has_response: true,
            status: Some(response.status),
            duration_ms: Some(response.duration_ms),
            size_bytes: Some(response.size_bytes),
            body: response.body.clone(),
        },
        None => RigPosteeLastResponseResult {
            has_response: false,
            status: None,
            duration_ms: None,
            size_bytes: None,
            body: None,
        },
    }
}

fn execute_rig_postee_read_tool(
    input: RigPosteeReadToolRequest,
) -> Result<RigPosteeReadToolResponse, String> {
    let serialize = |tool: RigPosteeReadToolName, value: serde_json::Value| RigPosteeReadToolResponse {
        tool,
        result: value,
    };

    match input.tool {
        RigPosteeReadToolName::ActiveRequest => {
            serde_json::from_value::<RigPosteeEmptyInput>(input.input)
                .map_err(|error| format!("Invalid activeRequest input payload: {error}"))?;
            let result = execute_postee_active_request_tool(&input.context);
            let value = serde_json::to_value(result)
                .map_err(|error| format!("Unable to serialize activeRequest result: {error}"))?;
            Ok(serialize(RigPosteeReadToolName::ActiveRequest, value))
        }
        RigPosteeReadToolName::EnvironmentKeys => {
            serde_json::from_value::<RigPosteeEmptyInput>(input.input)
                .map_err(|error| format!("Invalid environmentKeys input payload: {error}"))?;
            let result = execute_postee_environment_keys_tool(&input.context);
            let value = serde_json::to_value(result)
                .map_err(|error| format!("Unable to serialize environmentKeys result: {error}"))?;
            Ok(serialize(RigPosteeReadToolName::EnvironmentKeys, value))
        }
        RigPosteeReadToolName::LastResponseSummary => {
            serde_json::from_value::<RigPosteeEmptyInput>(input.input)
                .map_err(|error| format!("Invalid lastResponseSummary input payload: {error}"))?;
            let result = execute_postee_last_response_tool(&input.context);
            let value = serde_json::to_value(result)
                .map_err(|error| format!("Unable to serialize lastResponseSummary result: {error}"))?;
            Ok(serialize(RigPosteeReadToolName::LastResponseSummary, value))
        }
    }
}

fn normalize_read_tool_lookup_id(
    tool: RigReadToolName,
    field_name: &str,
    value: &str,
) -> Result<String, String> {
    let normalized = value.trim();
    if normalized.is_empty() {
        return Err(format!("{tool:?} requires a non-empty {field_name}."));
    }
    Ok(normalized.to_string())
}

fn sorted_board_nodes(board_summary: &RigC4BoardSummary) -> Vec<RigC4BoardSummaryNode> {
    let mut nodes = board_summary.nodes.clone();
    nodes.sort_by(|left, right| left.label.cmp(&right.label).then(left.id.cmp(&right.id)));
    nodes
}

fn sorted_board_edges(board_summary: &RigC4BoardSummary) -> Vec<RigC4BoardSummaryEdge> {
    let mut edges = board_summary.edges.clone();
    edges.sort_by(|left, right| left.id.cmp(&right.id));
    edges
}

fn collect_ownership_teams(board_summary: &RigC4BoardSummary) -> Vec<String> {
    let mut teams = board_summary
        .nodes
        .iter()
        .filter_map(|node| normalize_secret(node.team_ownership.as_deref().unwrap_or("")))
        .collect::<Vec<_>>();
    teams.sort();
    teams.dedup();
    teams
}

fn execute_read_board_summary_tool(
    _input: RigReadBoardSummaryInput,
    board_summary: &RigC4BoardSummary,
) -> RigReadBoardSummaryResult {
    RigReadBoardSummaryResult {
        diagram_id: board_summary.diagram_id.clone(),
        diagram_name: board_summary.diagram_name.clone(),
        node_count: board_summary.node_count,
        edge_count: board_summary.edge_count,
        ownership_teams: collect_ownership_teams(board_summary),
        nodes: sorted_board_nodes(board_summary),
        edges: sorted_board_edges(board_summary),
    }
}

fn execute_read_edge_lookup_tool(
    input: RigReadEdgeLookupInput,
    board_summary: &RigC4BoardSummary,
) -> Result<RigReadEdgeLookupResult, String> {
    let edge_id =
        normalize_read_tool_lookup_id(RigReadToolName::EdgeLookup, "edgeId", &input.edge_id)?;
    let edge = board_summary
        .edges
        .iter()
        .find(|candidate| candidate.id == edge_id)
        .cloned();

    let Some(edge) = edge else {
        return Ok(RigReadEdgeLookupResult {
            found: false,
            edge: None,
            source_node: None,
            target_node: None,
        });
    };

    let source_node = board_summary
        .nodes
        .iter()
        .find(|candidate| candidate.id == edge.source_id)
        .cloned();
    let target_node = board_summary
        .nodes
        .iter()
        .find(|candidate| candidate.id == edge.target_id)
        .cloned();

    Ok(RigReadEdgeLookupResult {
        found: true,
        edge: Some(edge),
        source_node,
        target_node,
    })
}

fn execute_read_node_lookup_tool(
    input: RigReadNodeLookupInput,
    board_summary: &RigC4BoardSummary,
) -> Result<RigReadNodeLookupResult, String> {
    let node_id =
        normalize_read_tool_lookup_id(RigReadToolName::NodeLookup, "nodeId", &input.node_id)?;
    let node = board_summary
        .nodes
        .iter()
        .find(|candidate| candidate.id == node_id)
        .cloned();

    let Some(node) = node else {
        return Ok(RigReadNodeLookupResult {
            found: false,
            node: None,
            relationship_count: 0,
            connected_edges: Vec::new(),
        });
    };

    let mut connected_edges = board_summary
        .edges
        .iter()
        .filter(|edge| edge.source_id == node.id || edge.target_id == node.id)
        .map(|edge| {
            execute_read_edge_lookup_tool(
                RigReadEdgeLookupInput {
                    edge_id: edge.id.clone(),
                },
                board_summary,
            )
        })
        .collect::<Result<Vec<_>, _>>()?
        .into_iter()
        .filter_map(|lookup| lookup.edge)
        .collect::<Vec<_>>();
    connected_edges.sort_by(|left, right| left.id.cmp(&right.id));

    Ok(RigReadNodeLookupResult {
        found: true,
        node: Some(node),
        relationship_count: connected_edges.len() as i64,
        connected_edges,
    })
}

fn execute_rig_read_tool(input: RigReadToolRequest) -> Result<RigReadToolResponse, String> {
    match input.tool {
        RigReadToolName::BoardSummary => {
            let decoded = serde_json::from_value::<RigReadBoardSummaryInput>(input.input)
                .map_err(|error| format!("Invalid board_summary input payload: {error}"))?;
            let result = execute_read_board_summary_tool(decoded, &input.board_summary);
            let result = serde_json::to_value(result)
                .map_err(|error| format!("Unable to serialize board_summary result: {error}"))?;
            Ok(RigReadToolResponse {
                tool: RigReadToolName::BoardSummary,
                result,
            })
        }
        RigReadToolName::NodeLookup => {
            let decoded = serde_json::from_value::<RigReadNodeLookupInput>(input.input)
                .map_err(|error| format!("Invalid node_lookup input payload: {error}"))?;
            let result = execute_read_node_lookup_tool(decoded, &input.board_summary)?;
            let result = serde_json::to_value(result)
                .map_err(|error| format!("Unable to serialize node_lookup result: {error}"))?;
            Ok(RigReadToolResponse {
                tool: RigReadToolName::NodeLookup,
                result,
            })
        }
        RigReadToolName::EdgeLookup => {
            let decoded = serde_json::from_value::<RigReadEdgeLookupInput>(input.input)
                .map_err(|error| format!("Invalid edge_lookup input payload: {error}"))?;
            let result = execute_read_edge_lookup_tool(decoded, &input.board_summary)?;
            let result = serde_json::to_value(result)
                .map_err(|error| format!("Unable to serialize edge_lookup result: {error}"))?;
            Ok(RigReadToolResponse {
                tool: RigReadToolName::EdgeLookup,
                result,
            })
        }
    }
}

fn normalize_proposal_key(value: &str) -> String {
    let mut normalized = String::new();
    let mut last_was_separator = false;

    for character in value.trim().chars() {
        if character.is_alphanumeric() {
            for lowered in character.to_lowercase() {
                normalized.push(lowered);
            }
            last_was_separator = false;
            continue;
        }

        if normalized.is_empty() || last_was_separator {
            continue;
        }

        normalized.push('-');
        last_was_separator = true;
    }

    while normalized.ends_with('-') {
        normalized.pop();
    }

    normalized
}

fn validate_c4_diagram_plan(proposal: &RigC4DiagramProposalPayload) -> Result<(), String> {
    if proposal.summary.trim().is_empty() {
        return Err("Proposal summary cannot be empty.".to_string());
    }

    if proposal.rationale.trim().is_empty() {
        return Err("Proposal rationale cannot be empty.".to_string());
    }

    if proposal.nodes.is_empty() {
        return Err("Proposal must contain at least one node.".to_string());
    }

    if proposal.nodes.len() > 12 {
        return Err("Proposal exceeds the maximum supported node count (12).".to_string());
    }

    if proposal.edges.len() > 24 {
        return Err("Proposal exceeds the maximum supported edge count (24).".to_string());
    }

    let mut node_keys = HashSet::new();
    for node in &proposal.nodes {
        let key = node.key.trim();
        if key.is_empty() {
            return Err("Proposal contains a node with an empty key.".to_string());
        }

        if key != normalize_proposal_key(key) {
            return Err(format!(
                "Proposal node key '{key}' is not normalized kebab-case."
            ));
        }

        if !node_keys.insert(key.to_string()) {
            return Err(format!("Proposal contains duplicate node key '{key}'."));
        }

        if node.label.trim().is_empty() {
            return Err(format!("Proposal node '{key}' has an empty label."));
        }
    }

    for edge in &proposal.edges {
        let source_key = edge.source_key.trim();
        let target_key = edge.target_key.trim();
        let label = edge.label.trim();

        if source_key.is_empty() || target_key.is_empty() {
            return Err(
                "Proposal contains an edge with an empty source or target key.".to_string(),
            );
        }

        if source_key != normalize_proposal_key(source_key) {
            return Err(format!(
                "Proposal edge source key '{source_key}' is not normalized kebab-case."
            ));
        }

        if target_key != normalize_proposal_key(target_key) {
            return Err(format!(
                "Proposal edge target key '{target_key}' is not normalized kebab-case."
            ));
        }

        if !node_keys.contains(source_key) {
            return Err(format!(
                "Proposal edge references unknown source key '{source_key}'."
            ));
        }

        if !node_keys.contains(target_key) {
            return Err(format!(
                "Proposal edge references unknown target key '{target_key}'."
            ));
        }

        if label.is_empty() {
            return Err(format!(
                "Proposal edge '{source_key} -> {target_key}' has an empty label."
            ));
        }
    }

    Ok(())
}

fn sanitize_c4_diagram_plan(
    mut proposal: RigC4DiagramProposalPayload,
) -> Result<RigC4DiagramProposalPayload, String> {
    proposal.summary = proposal.summary.trim().to_string();
    proposal.rationale = proposal.rationale.trim().to_string();
    proposal.warnings = proposal
        .warnings
        .into_iter()
        .filter_map(|warning| {
            let trimmed = warning.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        })
        .collect();

    let mut node_keys = HashSet::new();
    for node in &mut proposal.nodes {
        node.key = normalize_proposal_key(&node.key);
        node.label = node.label.trim().to_string();
        node.description = normalize_optional_content(node.description.take());

        if node.key.is_empty() {
            return Err("Proposal contains a node with an empty key.".to_string());
        }

        if node.label.is_empty() {
            return Err(format!("Proposal node '{}' has an empty label.", node.key));
        }

        if !node_keys.insert(node.key.clone()) {
            return Err(format!(
                "Proposal contains duplicate node key '{}'.",
                node.key
            ));
        }
    }

    let mut filtered_edges = Vec::with_capacity(proposal.edges.len());
    for mut edge in proposal.edges.into_iter() {
        edge.source_key = normalize_proposal_key(&edge.source_key);
        edge.target_key = normalize_proposal_key(&edge.target_key);
        edge.label = edge.label.trim().to_string();

        if edge.source_key.is_empty() || edge.target_key.is_empty() || edge.label.is_empty() {
            proposal.warnings.push(
                "Dropped a proposal relationship with an empty source, target, or label."
                    .to_string(),
            );
            continue;
        }

        if !node_keys.contains(&edge.source_key) {
            proposal.warnings.push(format!(
                "Dropped proposal relationship '{} -> {}' because source key '{}' was not returned with the final node set.",
                edge.source_key, edge.target_key, edge.source_key
            ));
            continue;
        }

        if !node_keys.contains(&edge.target_key) {
            proposal.warnings.push(format!(
                "Dropped proposal relationship '{} -> {}' because target key '{}' was not returned with the final node set.",
                edge.source_key, edge.target_key, edge.target_key
            ));
            continue;
        }

        filtered_edges.push(edge);
    }

    proposal.edges = filtered_edges;
    Ok(proposal)
}

fn validate_review_note(note: &RigC4ReviewNote, field_name: &str) -> Result<(), String> {
    if note.title.trim().is_empty() {
        return Err(format!(
            "{field_name} contains an item with an empty title."
        ));
    }

    if note.detail.trim().is_empty() {
        return Err(format!(
            "{field_name} contains an item with an empty detail."
        ));
    }

    Ok(())
}

fn validate_c4_board_review(review: &RigC4BoardReviewPayload) -> Result<(), String> {
    if review.summary.trim().is_empty() {
        return Err("Board review summary cannot be empty.".to_string());
    }

    if review.strengths.len() > MAX_REVIEW_LIST_ITEMS {
        return Err(format!(
            "Board review exceeds the maximum supported strengths count ({}).",
            MAX_REVIEW_LIST_ITEMS
        ));
    }

    if review.risks.len() > MAX_REVIEW_LIST_ITEMS {
        return Err(format!(
            "Board review exceeds the maximum supported risks count ({}).",
            MAX_REVIEW_LIST_ITEMS
        ));
    }

    if review.ambiguities.len() > MAX_REVIEW_LIST_ITEMS {
        return Err(format!(
            "Board review exceeds the maximum supported ambiguities count ({}).",
            MAX_REVIEW_LIST_ITEMS
        ));
    }

    if review.missing_nodes.len() > MAX_REVIEW_LIST_ITEMS {
        return Err(format!(
            "Board review exceeds the maximum supported missing nodes count ({}).",
            MAX_REVIEW_LIST_ITEMS
        ));
    }

    if review.missing_edges.len() > MAX_REVIEW_LIST_ITEMS {
        return Err(format!(
            "Board review exceeds the maximum supported missing edges count ({}).",
            MAX_REVIEW_LIST_ITEMS
        ));
    }

    if review.recommended_changes.len() > MAX_REVIEW_LIST_ITEMS {
        return Err(format!(
            "Board review exceeds the maximum supported recommended changes count ({}).",
            MAX_REVIEW_LIST_ITEMS
        ));
    }

    if review.strengths.is_empty()
        && review.risks.is_empty()
        && review.ambiguities.is_empty()
        && review.missing_nodes.is_empty()
        && review.missing_edges.is_empty()
        && review.recommended_changes.is_empty()
    {
        return Err(
            "Board review must include at least one finding or recommendation.".to_string(),
        );
    }

    for note in &review.strengths {
        validate_review_note(note, "Board review strengths")?;
    }

    for note in &review.ambiguities {
        validate_review_note(note, "Board review ambiguities")?;
    }

    for risk in &review.risks {
        if risk.title.trim().is_empty() {
            return Err("Board review risks contains an item with an empty title.".to_string());
        }

        if risk.detail.trim().is_empty() {
            return Err("Board review risks contains an item with an empty detail.".to_string());
        }
    }

    for missing_node in &review.missing_nodes {
        if missing_node.trim().is_empty() {
            return Err("Board review missingNodes contains an empty item.".to_string());
        }
    }

    for missing_edge in &review.missing_edges {
        if missing_edge.trim().is_empty() {
            return Err("Board review missingEdges contains an empty item.".to_string());
        }
    }

    for change in &review.recommended_changes {
        if change.title.trim().is_empty() {
            return Err(
                "Board review recommendedChanges contains an item with an empty title.".to_string(),
            );
        }

        if change.rationale.trim().is_empty() {
            return Err(
                "Board review recommendedChanges contains an item with an empty rationale."
                    .to_string(),
            );
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn rig_agent_secret_status(
    state: State<'_, AppDb>,
) -> Result<RigAgentSecretStatusResponse, String> {
    let resolved = resolve_openai_secret(&state).await?;

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
pub async fn rig_agent_run_read_tool(
    input: RigReadToolRequest,
) -> Result<RigReadToolResponse, String> {
    execute_rig_read_tool(input)
}

#[tauri::command]
pub async fn rig_agent_run_postee_read_tool(
    input: RigPosteeReadToolRequest,
) -> Result<RigPosteeReadToolResponse, String> {
    execute_rig_postee_read_tool(input)
}

#[tauri::command]
pub async fn rig_agent_store_openai_api_key(
    state: State<'_, AppDb>,
    secret: String,
) -> Result<RigAgentSecretStatusResponse, String> {
    let normalized =
        normalize_secret(&secret).ok_or_else(|| "OpenAI key cannot be empty.".to_string())?;

    if !keychain_supported_in_runtime() {
        store_openai_api_key_in_settings(&state, &normalized).await?;
        return Ok(RigAgentSecretStatusResponse {
            configured: true,
            source: RigAgentSecretSource::SettingsDb,
            warning: Some(DEV_KEYCHAIN_DISABLED_WARNING.to_string()),
            resolution_order: KEY_RESOLUTION_ORDER
                .iter()
                .map(|source| source.to_string())
                .collect(),
        });
    }

    let keychain_issue = match store_openai_api_key_in_keychain(normalized.clone()).await {
        Ok(()) => match resolve_openai_api_key_from_keychain().await {
            Ok(Some(_)) => {
                clear_openai_api_key_from_settings(&state).await?;
                return rig_agent_secret_status(state).await;
            }
            Ok(None) => Some(
                "OpenAI key was written, but the dev/runtime process could not read it back from keychain."
                    .to_string(),
            ),
            Err(error) => Some(error),
        },
        Err(error) => Some(error),
    };

    store_openai_api_key_in_settings(&state, &normalized).await?;

    Ok(RigAgentSecretStatusResponse {
        configured: true,
        source: RigAgentSecretSource::SettingsDb,
        warning: Some(match keychain_issue {
            Some(detail) => compose_secret_warning(DEV_KEYCHAIN_FALLBACK_WARNING, &detail),
            None => SETTINGS_DB_STORAGE_WARNING.to_string(),
        }),
        resolution_order: KEY_RESOLUTION_ORDER
            .iter()
            .map(|source| source.to_string())
            .collect(),
    })
}

#[tauri::command]
pub async fn rig_agent_clear_openai_api_key(
    state: State<'_, AppDb>,
) -> Result<RigAgentSecretStatusResponse, String> {
    if keychain_supported_in_runtime() {
        clear_openai_api_key_from_keychain().await?;
    }
    clear_openai_api_key_from_settings(&state).await?;
    rig_agent_secret_status(state).await
}

#[tauri::command]
pub async fn rig_agent_hello(
    state: State<'_, AppDb>,
    input: RigAgentHelloRequest,
) -> Result<RigAgentHelloResponse, String> {
    let model = resolve_model(input.model);
    let prompt = first_non_empty(input.prompt, DEFAULT_PROMPT);
    let temperature = resolve_temperature(input.temperature);
    let max_tokens = resolve_max_tokens(input.max_tokens);

    let secret = resolve_openai_secret(&state).await?.ok_or_else(|| {
        "Rig agent requires an OpenAI key. Add one in Settings > AI Agent or set OPSYDYN_OPENAI_API_KEY / OPENAI_API_KEY.".to_string()
    })?;

    let output = prompt_openai(
        &secret.value,
        &model,
        "You are the OPSYDYN assistant. Reply with one concise sentence.",
        temperature,
        max_tokens,
        &prompt,
    )
    .await
    .map_err(|error| map_runtime_error("rig_agent_hello", error))?;

    Ok(to_hello_response(
        output.message,
        model,
        prompt,
        temperature,
        max_tokens,
        output.usage,
        now_unix_ms(),
    ))
}

#[tauri::command]
pub async fn rig_agent_plan_c4_diagram(
    state: State<'_, AppDb>,
    input: RigC4DiagramPlanRequest,
) -> Result<RigC4DiagramPlanResponse, String> {
    let RigC4DiagramPlanRequest {
        description,
        diagram_context,
        board_summary,
        model,
        max_tokens,
    } = input;

    let description = description.trim();
    if description.is_empty() {
        return Err("Diagram proposal description cannot be empty.".to_string());
    }

    let prompt_text = build_c4_diagram_plan_text(description);
    let model = resolve_model(model);
    let max_tokens = resolve_max_tokens(max_tokens);
    let mut context_sections = Vec::new();

    if let Some(context) = normalize_optional_string(diagram_context) {
        context_sections.push(format!("Current board context:\n{context}"));
    }

    if let Some(summary) = board_summary
        .as_ref()
        .and_then(build_c4_board_summary_context)
    {
        context_sections.push(summary);
    }

    let combined_context = if context_sections.is_empty() {
        None
    } else {
        Some(context_sections.join("\n\n"))
    };

    let secret = resolve_openai_secret(&state).await?.ok_or_else(|| {
        "Rig agent requires an OpenAI key. Add one in Settings > AI Agent or set OPSYDYN_OPENAI_API_KEY / OPENAI_API_KEY.".to_string()
    })?;

    let output = extract_openai::<RigC4DiagramProposalPayload>(
        &secret.value,
        &model,
        build_c4_diagram_plan_preamble(),
        max_tokens,
        combined_context.as_deref(),
        1,
        &prompt_text,
    )
    .await
    .map_err(|error| map_runtime_error("rig_agent_plan_c4_diagram", error))?;

    let proposal = sanitize_c4_diagram_plan(output.data)?;
    validate_c4_diagram_plan(&proposal)?;

    Ok(RigC4DiagramPlanResponse {
        proposal,
        provider: "openai".to_string(),
        model,
        usage: output.usage,
        responded_at_ms: now_unix_ms(),
    })
}

#[tauri::command]
pub async fn rig_agent_review_c4_board(
    state: State<'_, AppDb>,
    input: RigC4BoardReviewRequest,
) -> Result<RigC4BoardReviewResponse, String> {
    let RigC4BoardReviewRequest {
        focus,
        diagram_context,
        board_summary,
        model,
        max_tokens,
    } = input;

    if board_summary.nodes.is_empty() {
        return Err("Board review requires at least one C4 node in the current board.".to_string());
    }

    let focus = normalize_optional_string(focus);
    let prompt_text = build_c4_board_review_text(focus.as_deref());
    let model = resolve_model(model);
    let max_tokens = resolve_max_tokens(max_tokens);
    let mut context_sections = Vec::new();

    if let Some(context) = normalize_optional_string(diagram_context) {
        context_sections.push(format!("Current board context:\n{context}"));
    }

    if let Some(summary) = build_c4_board_summary_context(&board_summary) {
        context_sections.push(summary);
    }

    let combined_context = if context_sections.is_empty() {
        None
    } else {
        Some(context_sections.join("\n\n"))
    };

    let secret = resolve_openai_secret(&state).await?.ok_or_else(|| {
        "Rig agent requires an OpenAI key. Add one in Settings > AI Agent or set OPSYDYN_OPENAI_API_KEY / OPENAI_API_KEY.".to_string()
    })?;

    let output = extract_openai::<RigC4BoardReviewPayload>(
        &secret.value,
        &model,
        build_c4_board_review_preamble(),
        max_tokens,
        combined_context.as_deref(),
        1,
        &prompt_text,
    )
    .await
    .map_err(|error| map_runtime_error("rig_agent_review_c4_board", error))?;

    validate_c4_board_review(&output.data)?;

    Ok(RigC4BoardReviewResponse {
        review: output.data,
        provider: "openai".to_string(),
        model,
        usage: output.usage,
        responded_at_ms: now_unix_ms(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn postee_context_fixture() -> RigPosteeContext {
        RigPosteeContext {
            request: RigPosteeContextRequest {
                name: "Fetch account".to_string(),
                method: "POST".to_string(),
                url: "https://api.example.test/accounts".to_string(),
                headers: vec![
                    RigPosteeContextHeader {
                        key: "Authorization".to_string(),
                        value: None,
                    },
                    RigPosteeContextHeader {
                        key: "Accept".to_string(),
                        value: Some("application/json".to_string()),
                    },
                ],
                body_mode: "json".to_string(),
                body: None,
            },
            environment: Some(RigPosteeContextEnvironment {
                name: "Production".to_string(),
                variable_keys: vec!["ZONE".to_string(), "API_TOKEN".to_string()],
            }),
            last_response: Some(RigPosteeContextResponse {
                status: 200,
                duration_ms: 120,
                size_bytes: 512,
                body: None,
            }),
            withheld: vec!["header values".to_string()],
        }
    }

    #[test]
    fn postee_active_request_tool_reports_which_headers_had_values() {
        let result = execute_postee_active_request_tool(&postee_context_fixture());

        assert_eq!(result.header_keys, vec!["Accept", "Authorization"]);
        // Authorization arrived withheld, so it must not be listed as supplied.
        assert_eq!(result.headers_with_values, vec!["Accept"]);
        assert!(!result.has_body);
        assert_eq!(result.withheld, vec!["header values"]);
    }

    #[test]
    fn postee_environment_tool_returns_sorted_keys_and_never_values() {
        let result = execute_postee_environment_keys_tool(&postee_context_fixture());

        assert_eq!(result.name.as_deref(), Some("Production"));
        assert_eq!(result.variable_keys, vec!["API_TOKEN", "ZONE"]);
    }

    #[test]
    fn postee_environment_tool_tolerates_no_environment() {
        let mut context = postee_context_fixture();
        context.environment = None;

        let result = execute_postee_environment_keys_tool(&context);

        assert_eq!(result.name, None);
        assert!(result.variable_keys.is_empty());
    }

    #[test]
    fn postee_last_response_tool_reports_shape_without_a_body() {
        let result = execute_postee_last_response_tool(&postee_context_fixture());

        assert!(result.has_response);
        assert_eq!(result.status, Some(200));
        assert_eq!(result.size_bytes, Some(512));
        // The body was withheld upstream; the tool must not invent one.
        assert_eq!(result.body, None);
    }

    #[test]
    fn postee_last_response_tool_handles_no_run_yet() {
        let mut context = postee_context_fixture();
        context.last_response = None;

        let result = execute_postee_last_response_tool(&context);

        assert!(!result.has_response);
        assert_eq!(result.status, None);
    }

    #[test]
    fn postee_read_tool_rejects_a_malformed_input_payload() {
        let request = RigPosteeReadToolRequest {
            tool: RigPosteeReadToolName::ActiveRequest,
            input: serde_json::json!("not-an-object"),
            context: postee_context_fixture(),
        };

        assert!(execute_rig_postee_read_tool(request).is_err());
    }

    #[test]
    fn hello_defaults_are_stable() {
        assert_eq!(resolve_model(None), DEFAULT_MODEL);
        assert_eq!(resolve_temperature(None), DEFAULT_TEMPERATURE);
        assert_eq!(resolve_max_tokens(None), DEFAULT_MAX_TOKENS);
    }

    #[test]
    fn hello_response_preserves_runtime_usage() {
        let usage = RigUsageMetadata {
            input_tokens: 12,
            output_tokens: 4,
            total_tokens: 16,
            cached_input_tokens: 0,
            cache_creation_input_tokens: 0,
            tool_use_prompt_tokens: 0,
            reasoning_tokens: 0,
        };

        let response = to_hello_response(
            "ready".to_string(),
            "gpt-4o-mini".to_string(),
            "hello".to_string(),
            DEFAULT_TEMPERATURE,
            DEFAULT_MAX_TOKENS,
            usage.clone(),
            99,
        );

        assert_eq!(response.usage, usage);
        assert_eq!(response.responded_at_ms, 99);
    }

    fn create_proposal() -> RigC4DiagramProposalPayload {
        RigC4DiagramProposalPayload {
            summary: "Event flow".to_string(),
            rationale: "Capture the event-driven boundary.".to_string(),
            warnings: vec![],
            nodes: vec![
                RigC4ProposalNode {
                    key: "publisher".to_string(),
                    node_type: RigC4ProposalNodeType::System,
                    label: "Publisher".to_string(),
                    description: Some("Publishes domain events.".to_string()),
                },
                RigC4ProposalNode {
                    key: "event-bus".to_string(),
                    node_type: RigC4ProposalNodeType::Container,
                    label: "Event Bus".to_string(),
                    description: Some("Azure Event Grid or Service Bus.".to_string()),
                },
            ],
            edges: vec![RigC4ProposalEdge {
                source_key: "publisher".to_string(),
                target_key: "event-bus".to_string(),
                label: "publishes".to_string(),
            }],
        }
    }

    fn create_valid_review() -> RigC4BoardReviewPayload {
        RigC4BoardReviewPayload {
            summary: "Clear external actor coverage, but boundary naming is inconsistent."
                .to_string(),
            strengths: vec![RigC4ReviewNote {
                title: "Primary actor is explicit".to_string(),
                detail: "The board makes the Customer interaction path easy to follow.".to_string(),
            }],
            risks: vec![RigC4ReviewRisk {
                title: "System boundary is overloaded".to_string(),
                detail: "Payments API appears to absorb orchestration and domain responsibilities."
                    .to_string(),
                severity: RigC4ReviewPriority::High,
            }],
            ambiguities: vec![RigC4ReviewNote {
                title: "Container intent is unclear".to_string(),
                detail:
                    "The label does not explain whether the node is an API, worker, or datastore."
                        .to_string(),
            }],
            missing_nodes: vec!["External payment provider".to_string()],
            missing_edges: vec![
                "Payments API -> external payment provider (submits payment requests)".to_string(),
            ],
            recommended_changes: vec![RigC4RecommendedChange {
                title: "Separate orchestration from core API".to_string(),
                rationale: "This would make ownership and runtime responsibilities clearer."
                    .to_string(),
                priority: RigC4ReviewPriority::Medium,
            }],
        }
    }

    #[test]
    fn sanitize_c4_diagram_plan_drops_edges_with_unknown_node_keys() {
        let mut proposal = create_proposal();
        let missing_key = normalize_proposal_key("component-5iaM5sXpKx1t");
        proposal.edges.push(RigC4ProposalEdge {
            source_key: "component-5iaM5sXpKx1t".to_string(),
            target_key: "event-bus".to_string(),
            label: "forwards".to_string(),
        });

        let sanitized = sanitize_c4_diagram_plan(proposal).expect("proposal should sanitize");

        assert_eq!(sanitized.edges.len(), 1);
        assert_eq!(sanitized.edges[0].source_key, "publisher");
        assert!(sanitized
            .warnings
            .iter()
            .any(|warning| warning.contains(&missing_key)));
        validate_c4_diagram_plan(&sanitized).expect("sanitized proposal should validate");
    }

    #[test]
    fn sanitize_c4_diagram_plan_normalizes_node_and_edge_keys() {
        let mut proposal = create_proposal();
        proposal.nodes[0].key = "Publisher Service".to_string();
        proposal.nodes[1].key = "EVENT_BUS".to_string();
        proposal.edges[0].source_key = "publisher_service".to_string();
        proposal.edges[0].target_key = "event bus".to_string();

        let sanitized = sanitize_c4_diagram_plan(proposal).expect("proposal should sanitize");

        assert_eq!(sanitized.nodes[0].key, "publisher-service");
        assert_eq!(sanitized.nodes[1].key, "event-bus");
        assert_eq!(sanitized.edges[0].source_key, "publisher-service");
        assert_eq!(sanitized.edges[0].target_key, "event-bus");
        validate_c4_diagram_plan(&sanitized).expect("sanitized proposal should validate");
    }

    #[test]
    fn sanitize_c4_diagram_plan_trims_and_drops_empty_edges() {
        let mut proposal = create_proposal();
        proposal.summary = "  Event flow  ".to_string();
        proposal.rationale = "  Capture the event-driven boundary.  ".to_string();
        proposal.nodes[0].description = Some("   ".to_string());
        proposal.edges.push(RigC4ProposalEdge {
            source_key: "publisher".to_string(),
            target_key: "event-bus".to_string(),
            label: "   ".to_string(),
        });

        let sanitized = sanitize_c4_diagram_plan(proposal).expect("proposal should sanitize");

        assert_eq!(sanitized.summary, "Event flow");
        assert_eq!(sanitized.rationale, "Capture the event-driven boundary.");
        assert_eq!(sanitized.nodes[0].description, None);
        assert_eq!(sanitized.edges.len(), 1);
        assert!(sanitized
            .warnings
            .iter()
            .any(|warning| warning.contains("empty source, target, or label")));
    }

    #[test]
    fn validates_a_well_formed_c4_board_review() {
        let review = create_valid_review();
        assert!(validate_c4_board_review(&review).is_ok());
    }

    #[test]
    fn rejects_empty_recommended_change_rationale() {
        let mut review = create_valid_review();
        review.recommended_changes[0].rationale = "   ".to_string();

        let error = validate_c4_board_review(&review).expect_err("review should be invalid");
        assert!(error.contains("recommendedChanges"));
    }

    fn create_board_summary() -> RigC4BoardSummary {
        RigC4BoardSummary {
            diagram_id: Some("diagram-1".to_string()),
            diagram_name: Some("Payments Context".to_string()),
            node_count: 2,
            edge_count: 1,
            nodes: vec![
                RigC4BoardSummaryNode {
                    id: "person-customer".to_string(),
                    label: "Customer".to_string(),
                    node_type: RigC4ProposalNodeType::Person,
                    description: None,
                    technology: None,
                    team_ownership: None,
                },
                RigC4BoardSummaryNode {
                    id: "system-payments".to_string(),
                    label: "Payments API".to_string(),
                    node_type: RigC4ProposalNodeType::System,
                    description: Some("Accepts payment requests".to_string()),
                    technology: Some("Rust".to_string()),
                    team_ownership: Some("Core Platform".to_string()),
                },
            ],
            edges: vec![RigC4BoardSummaryEdge {
                id: "edge-customer-payments".to_string(),
                source_id: "person-customer".to_string(),
                target_id: "system-payments".to_string(),
                source_label: "Customer".to_string(),
                target_label: "Payments API".to_string(),
                label: Some("uses".to_string()),
            }],
        }
    }

    #[test]
    fn read_board_summary_tool_returns_sorted_ownership_and_snapshot() {
        let board_summary = create_board_summary();
        let result =
            execute_read_board_summary_tool(RigReadBoardSummaryInput::default(), &board_summary);

        assert_eq!(result.node_count, 2);
        assert_eq!(result.edge_count, 1);
        assert_eq!(result.ownership_teams, vec!["Core Platform".to_string()]);
        assert_eq!(result.nodes[0].label, "Customer");
    }

    #[test]
    fn read_node_lookup_tool_returns_connected_edges() {
        let board_summary = create_board_summary();
        let result = execute_read_node_lookup_tool(
            RigReadNodeLookupInput {
                node_id: "system-payments".to_string(),
            },
            &board_summary,
        )
        .expect("node lookup should succeed");

        assert!(result.found);
        assert_eq!(result.relationship_count, 1);
        assert_eq!(result.connected_edges[0].id, "edge-customer-payments");
    }

    #[test]
    fn read_tool_rejects_empty_lookup_identifiers() {
        let board_summary = create_board_summary();
        let error = execute_read_edge_lookup_tool(
            RigReadEdgeLookupInput {
                edge_id: "   ".to_string(),
            },
            &board_summary,
        )
        .expect_err("edge lookup should reject blank ids");

        assert!(error.contains("edgeId"));
    }
}
