use crate::db::AppDb;
use rig::{client::CompletionClient, completion::Prompt, providers::openai};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::collections::HashSet;
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
const MAX_REVIEW_LIST_ITEMS: usize = 8;
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

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RigC4BoardSummaryNode {
    pub id: String,
    pub label: String,
    pub node_type: RigC4ProposalNodeType,
    pub description: Option<String>,
    pub technology: Option<String>,
    pub team_ownership: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RigC4BoardSummaryEdge {
    pub id: String,
    pub source_id: String,
    pub target_id: String,
    pub source_label: String,
    pub target_label: String,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
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

fn normalize_optional_string(value: Option<String>) -> Option<String> {
    value.and_then(|raw| normalize_secret(&raw))
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

fn build_c4_diagram_plan_preamble() -> &'static str {
    "You are OPY Net, a proposal-only C4 architecture planner.
Convert architecture descriptions into concise C4 node and edge proposals.
Always return a realistic draft, even when details are missing.
When current-board context shows an existing node already fits the request, prefer reusing that concept instead of duplicating it.
Use the warnings field for ambiguity, assumptions, guessed boundaries, or unresolved relationships.
Do not describe implementation code, database tables, deployment YAML, or anything outside C4 concepts.
Node keys must be unique kebab-case identifiers.
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
    let model = first_non_empty(model, DEFAULT_MODEL);
    let max_tokens = normalize_max_tokens(max_tokens).unwrap_or(DEFAULT_MAX_TOKENS);
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

    let secret = resolve_openai_secret(&state).await.ok_or_else(|| {
        "Rig agent requires an OpenAI key. Add one in Settings > AI Agent or set OPSYDYN_OPENAI_API_KEY / OPENAI_API_KEY.".to_string()
    })?;

    let client: openai::Client = openai::Client::builder()
        .api_key(&secret.value)
        .build()
        .map_err(|error| format!("Failed to initialize OpenAI client: {error}"))?;

    let mut extractor = client
        .extractor::<RigC4DiagramProposalPayload>(&model)
        .preamble(build_c4_diagram_plan_preamble())
        .max_tokens(max_tokens)
        .retries(1);

    if let Some(ref context) = combined_context {
        extractor = extractor.context(context);
    }

    let proposal = extractor
        .build()
        .extract(prompt_text)
        .await
        .map_err(|error| format!("rig_agent_plan_c4_diagram failed: {error}"))?;

    validate_c4_diagram_plan(&proposal)?;

    Ok(RigC4DiagramPlanResponse {
        proposal,
        provider: "openai".to_string(),
        model,
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
    let model = first_non_empty(model, DEFAULT_MODEL);
    let max_tokens = normalize_max_tokens(max_tokens).unwrap_or(DEFAULT_MAX_TOKENS);
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

    let secret = resolve_openai_secret(&state).await.ok_or_else(|| {
        "Rig agent requires an OpenAI key. Add one in Settings > AI Agent or set OPSYDYN_OPENAI_API_KEY / OPENAI_API_KEY.".to_string()
    })?;

    let client: openai::Client = openai::Client::builder()
        .api_key(&secret.value)
        .build()
        .map_err(|error| format!("Failed to initialize OpenAI client: {error}"))?;

    let mut extractor = client
        .extractor::<RigC4BoardReviewPayload>(&model)
        .preamble(build_c4_board_review_preamble())
        .max_tokens(max_tokens)
        .retries(1);

    if let Some(ref context) = combined_context {
        extractor = extractor.context(context);
    }

    let review = extractor
        .build()
        .extract(prompt_text)
        .await
        .map_err(|error| format!("rig_agent_review_c4_board failed: {error}"))?;

    validate_c4_board_review(&review)?;

    Ok(RigC4BoardReviewResponse {
        review,
        provider: "openai".to_string(),
        model,
        responded_at_ms: now_unix_ms(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

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
}
