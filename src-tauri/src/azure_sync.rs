use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::collections::BTreeMap;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::process::Command;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AzureSyncScopeDto {
    pub subscription_ids: Vec<String>,
    pub resource_groups: Option<Vec<String>>,
    pub tag_filters: Option<BTreeMap<String, String>>,
    pub query: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AzureResourceSnapshotDto {
    pub resource_id: String,
    pub r#type: String,
    pub name: String,
    pub location: Option<String>,
    pub subscription_id: String,
    pub resource_group: Option<String>,
    pub tags: BTreeMap<String, String>,
    pub depends_on: Option<Vec<String>>,
    /// Property-based resource references extracted from the enriched KQL query.
    /// Keys are relationship labels (e.g. "serverFarmId"), values are target ARM resource IDs.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub property_refs: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AzureRelationshipSnapshotDto {
    pub from_resource_id: String,
    pub to_resource_id: String,
    pub relationship_type: String,
    pub confidence: String,
    pub source: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_detail: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AzureGraphSnapshotDto {
    pub collected_at: i64,
    pub scope: AzureSyncScopeDto,
    pub resources: Vec<AzureResourceSnapshotDto>,
    pub relationships: Vec<AzureRelationshipSnapshotDto>,
    #[serde(default)]
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AzureAuthStatusDto {
    pub available: bool,
    pub authenticated: bool,
    pub strategy: String,
    pub details: String,
}

#[derive(Debug, Deserialize)]
struct AzureGraphQueryResponse {
    #[serde(default)]
    data: Vec<JsonValue>,
    #[serde(default, alias = "skipToken", alias = "skip_token")]
    skip_token: Option<String>,
}

struct AzureGraphQueryRows {
    rows: Vec<JsonValue>,
    warnings: Vec<String>,
}

struct PaginationSettings {
    page_size: usize,
    max_pages: usize,
}

struct AzCommandOutput {
    success: bool,
    status_code: Option<i32>,
    stdout: String,
    stderr: String,
}

const AZURE_GRAPH_DEFAULT_PAGE_SIZE: usize = 1000;
const AZURE_GRAPH_DEFAULT_MAX_PAGES: usize = 20;
const AZURE_GRAPH_MAX_PAGE_SIZE: usize = 1000;
const AZURE_GRAPH_MAX_MAX_PAGES: usize = 500;
const AZURE_GRAPH_PAGE_SIZE_ENV: &str = "OPSYDYN_AZURE_GRAPH_PAGE_SIZE";
const AZURE_GRAPH_MAX_PAGES_ENV: &str = "OPSYDYN_AZURE_GRAPH_MAX_PAGES";

fn now_epoch_millis() -> i64 {
    match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(duration) => duration.as_millis() as i64,
        Err(_) => 0,
    }
}

fn read_env_usize(name: &str, default: usize, min: usize, max: usize) -> usize {
    std::env::var(name)
        .ok()
        .and_then(|value| value.trim().parse::<usize>().ok())
        .map(|value| value.clamp(min, max))
        .unwrap_or(default)
}

fn pagination_settings() -> PaginationSettings {
    let page_size = read_env_usize(
        AZURE_GRAPH_PAGE_SIZE_ENV,
        AZURE_GRAPH_DEFAULT_PAGE_SIZE,
        1,
        AZURE_GRAPH_MAX_PAGE_SIZE,
    );
    let max_pages = read_env_usize(
        AZURE_GRAPH_MAX_PAGES_ENV,
        AZURE_GRAPH_DEFAULT_MAX_PAGES,
        1,
        AZURE_GRAPH_MAX_MAX_PAGES,
    );

    PaginationSettings {
        page_size,
        max_pages,
    }
}

fn normalize_resource_id(resource_id: &str) -> String {
    resource_id.trim().to_lowercase()
}

fn split_subscription_tokens(raw_value: &str) -> Vec<String> {
    raw_value
        .split(|character: char| {
            character == ',' || character == ';' || character.is_ascii_whitespace()
        })
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_string())
        .collect()
}

fn is_valid_guid(value: &str) -> bool {
    let parts: Vec<&str> = value.split('-').collect();
    if parts.len() != 5 {
        return false;
    }

    let expected_lengths = [8usize, 4, 4, 4, 12];
    parts
        .iter()
        .zip(expected_lengths.iter())
        .all(|(part, expected_length)| {
            part.len() == *expected_length
                && part.chars().all(|character| character.is_ascii_hexdigit())
        })
}

fn summarize_command_output(text: &str) -> String {
    let lines: Vec<&str> = text
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .take(8)
        .collect();

    if lines.is_empty() {
        return String::new();
    }

    let joined = lines.join(" | ");
    if joined.chars().count() <= 1200 {
        return joined;
    }

    joined.chars().take(1200).collect()
}

fn command_failure_message(operation: &str, output: &AzCommandOutput) -> String {
    let detail = if !output.stderr.trim().is_empty() {
        summarize_command_output(&output.stderr)
    } else if !output.stdout.trim().is_empty() {
        summarize_command_output(&output.stdout)
    } else {
        "command returned no output".to_string()
    };

    let status = output
        .status_code
        .map(|code| code.to_string())
        .unwrap_or_else(|| "unknown".to_string());

    format!("{operation} failed (exit {status}): {detail}")
}

async fn run_az_command(args: &[String]) -> Result<AzCommandOutput, String> {
    let output = Command::new("az")
        .args(args)
        .output()
        .await
        .map_err(|error| format!("Azure CLI (az) was not found or failed to launch: {error}"))?;

    Ok(AzCommandOutput {
        success: output.status.success(),
        status_code: output.status.code(),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}

async fn run_az_json(args: &[String], operation: &str) -> Result<JsonValue, String> {
    let output = run_az_command(args).await?;
    if !output.success {
        return Err(command_failure_message(operation, &output));
    }

    serde_json::from_str(&output.stdout)
        .map_err(|error| format!("{operation} returned invalid JSON: {error}"))
}

async fn validate_azure_cli_available() -> Result<(), String> {
    let args = vec![
        "version".to_string(),
        "--output".to_string(),
        "json".to_string(),
    ];

    run_az_json(&args, "az version").await.map(|_| ())
}

async fn query_azure_account() -> Result<JsonValue, String> {
    let args = vec![
        "account".to_string(),
        "show".to_string(),
        "--output".to_string(),
        "json".to_string(),
    ];

    run_az_json(&args, "az account show").await
}

fn read_row_string(row: &JsonValue, keys: &[&str]) -> Option<String> {
    for key in keys {
        let value = row.get(*key).and_then(|entry| entry.as_str());
        if let Some(found) = value {
            let trimmed = found.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }

    None
}

fn read_arm_segment(resource_id: &str, marker: &str) -> Option<String> {
    let segments: Vec<&str> = resource_id
        .split('/')
        .filter(|segment| !segment.is_empty())
        .collect();

    for index in 0..segments.len().saturating_sub(1) {
        if segments[index].eq_ignore_ascii_case(marker) {
            return Some(segments[index + 1].to_string());
        }
    }

    None
}

fn parse_tags(value: Option<&JsonValue>) -> BTreeMap<String, String> {
    let mut tags = BTreeMap::new();
    let Some(JsonValue::Object(raw_tags)) = value else {
        return tags;
    };

    for (key, entry) in raw_tags {
        let rendered = match entry {
            JsonValue::String(text) => text.trim().to_string(),
            JsonValue::Number(number) => number.to_string(),
            JsonValue::Bool(boolean) => boolean.to_string(),
            _ => continue,
        };

        if !rendered.is_empty() {
            tags.insert(key.clone(), rendered);
        }
    }

    tags
}

fn parse_depends_on(row: &JsonValue) -> Option<Vec<String>> {
    let mut depends_on: Vec<String> = Vec::new();

    let direct = row.get("dependsOn");
    let nested = row
        .get("properties")
        .and_then(|props| props.get("dependsOn"));

    for candidate in [direct, nested].into_iter().flatten() {
        if let JsonValue::Array(entries) = candidate {
            for entry in entries {
                if let Some(id) = entry.as_str() {
                    let trimmed = id.trim();
                    if !trimmed.is_empty() {
                        depends_on.push(trimmed.to_string());
                    }
                }
            }
        }
    }

    if depends_on.is_empty() {
        None
    } else {
        Some(depends_on)
    }
}

/// Prefix used in KQL projections to mark property-based resource references.
const PROPERTY_REF_PREFIX: &str = "_ref_";

fn extract_property_refs(row: &JsonValue) -> BTreeMap<String, String> {
    let mut refs = BTreeMap::new();
    let Some(obj) = row.as_object() else {
        return refs;
    };

    for (key, value) in obj {
        let Some(label) = key.strip_prefix(PROPERTY_REF_PREFIX) else {
            continue;
        };
        if label.is_empty() {
            continue;
        }

        let target = match value {
            JsonValue::String(s) => s.trim().to_string(),
            _ => continue,
        };

        // Only keep values that look like ARM resource IDs
        if target.starts_with('/') && target.contains("/providers/") {
            refs.insert(label.to_string(), target);
        }
    }

    refs
}

/// Infer the ARM parent resource ID from a child resource ID.
/// e.g. `.../accounts/foo/projects/bar` -> `.../accounts/foo`
fn infer_arm_parent_id(resource_id: &str) -> Option<String> {
    // ARM child resources have at least 2 segments after the provider:
    // /subscriptions/.../providers/Microsoft.CognitiveServices/accounts/foo/projects/bar
    // We strip the last two path segments (the child type + child name).
    let segments: Vec<&str> = resource_id.split('/').collect();
    if segments.len() < 2 {
        return None;
    }

    // Find the provider index to count type/name pairs after it
    let provider_idx = segments
        .iter()
        .position(|s| s.eq_ignore_ascii_case("providers"))?;
    let after_provider = &segments[provider_idx + 1..]; // e.g. ["Microsoft.X", "accounts", "foo", "projects", "bar"]

    // Need namespace + at least 2 type/name pairs (4 segments) to have a parent
    if after_provider.len() < 5 {
        return None;
    }

    // Drop last two segments (child type + child name)
    let parent_segments = &segments[..segments.len() - 2];
    Some(parent_segments.join("/"))
}

fn decode_resource_row(row: &JsonValue) -> Option<AzureResourceSnapshotDto> {
    let resource_id = read_row_string(row, &["id", "resourceId", "resource_id"])?;
    let resource_type = read_row_string(row, &["type"])?;
    let name = read_row_string(row, &["name"])?;

    let subscription_id = read_row_string(row, &["subscriptionId", "subscription_id"])
        .or_else(|| read_arm_segment(&resource_id, "subscriptions"))?;

    let resource_group = read_row_string(row, &["resourceGroup", "resource_group"])
        .or_else(|| read_arm_segment(&resource_id, "resourceGroups"));

    Some(AzureResourceSnapshotDto {
        resource_id,
        r#type: resource_type,
        name,
        location: read_row_string(row, &["location"]),
        subscription_id,
        resource_group,
        tags: parse_tags(row.get("tags")),
        depends_on: parse_depends_on(row),
        property_refs: extract_property_refs(row),
    })
}

fn matches_scope_filters(resource: &AzureResourceSnapshotDto, scope: &AzureSyncScopeDto) -> bool {
    if let Some(resource_groups) = &scope.resource_groups {
        let expected: Vec<String> = resource_groups
            .iter()
            .map(|value| value.trim().to_lowercase())
            .filter(|value| !value.is_empty())
            .collect();

        if !expected.is_empty() {
            let Some(group) = resource.resource_group.as_ref() else {
                return false;
            };
            let normalized_group = group.trim().to_lowercase();
            if !expected
                .iter()
                .any(|candidate| candidate == &normalized_group)
            {
                return false;
            }
        }
    }

    if let Some(tag_filters) = &scope.tag_filters {
        for (filter_key, filter_value) in tag_filters {
            let target = filter_value.trim();
            let Some((_, actual_value)) = resource
                .tags
                .iter()
                .find(|(tag_key, _)| tag_key.eq_ignore_ascii_case(filter_key))
            else {
                return false;
            };

            if !actual_value.eq_ignore_ascii_case(target) {
                return false;
            }
        }
    }

    true
}

fn escape_kql_string(value: &str) -> String {
    value.replace('\'', "''")
}

fn build_default_query(scope: &AzureSyncScopeDto) -> String {
    let mut query = String::from(
        "Resources | project id, type, name, location, subscriptionId, resourceGroup, tags, \
         dependsOn = properties.dependsOn, \
         _ref_serverFarmId = properties.serverFarmId, \
         _ref_workspaceId = coalesce(properties.WorkspaceResourceId, properties.workspaceResourceId), \
         _ref_subnetId = coalesce(properties.subnet.id, properties.subnetId), \
         _ref_vnetSubnetId = properties.vnetSubnetResourceId, \
         _ref_nsgId = coalesce(properties.networkSecurityGroup.id, properties.networkSecurityGroupId), \
         _ref_storageAccountId = coalesce(properties.storageAccount.id, properties.storageAccountId), \
         _ref_virtualNetworkId = coalesce(properties.virtualNetwork.id, properties.virtualNetworkId), \
         _ref_publicIpAddressId = coalesce(properties.publicIPAddress.id, properties.publicIpAddressId), \
         _ref_routeTableId = coalesce(properties.routeTable.id, properties.routeTableId), \
         _ref_natGatewayId = coalesce(properties.natGateway.id, properties.natGatewayId), \
         _ref_privateEndpointId = properties.privateEndpoint.id, \
         _ref_privateLinkServiceId = properties.privateLinkService.id, \
         _ref_dnsZoneId = coalesce(properties.privateDnsZoneId, properties.privateDnsZone.id), \
         _ref_keyVaultId = properties.keyVault.id, \
         _ref_managedBy = managedBy",
    );

    if let Some(resource_groups) = &scope.resource_groups {
        let quoted: Vec<String> = resource_groups
            .iter()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
            .map(|value| format!("'{}'", escape_kql_string(value)))
            .collect();

        if !quoted.is_empty() {
            query.push_str(" | where resourceGroup in~ (");
            query.push_str(&quoted.join(", "));
            query.push(')');
        }
    }

    query
}

/// Mapping from property ref label to (relationship_type, confidence).
fn relationship_type_for_property_ref(label: &str) -> (&'static str, &'static str) {
    match label {
        "serverFarmId" => ("depends_on", "high"),
        "workspaceId" => ("data_link", "high"),
        "storageAccountId" => ("data_link", "high"),
        "subnetId"
        | "vnetSubnetId"
        | "nsgId"
        | "virtualNetworkId"
        | "publicIpAddressId"
        | "routeTableId"
        | "natGatewayId"
        | "privateEndpointId"
        | "privateLinkServiceId"
        | "dnsZoneId" => ("network_link", "high"),
        "keyVaultId" => ("identity_link", "medium"),
        "managedBy" => ("depends_on", "medium"),
        _ => ("inferred", "medium"),
    }
}

fn confidence_rank(confidence: &str) -> i8 {
    match confidence {
        "high" => 3,
        "medium" => 2,
        "low" => 1,
        _ => 0,
    }
}

fn relationship_source_rank(source: &str) -> i8 {
    match source {
        "arm_depends_on" => 4,
        "property_ref" => 3,
        "arm_parent" => 2,
        "inferred" => 1,
        _ => 0,
    }
}

fn should_replace_relationship(
    current: &AzureRelationshipSnapshotDto,
    candidate: &AzureRelationshipSnapshotDto,
) -> bool {
    let current_confidence = confidence_rank(&current.confidence);
    let candidate_confidence = confidence_rank(&candidate.confidence);
    if candidate_confidence != current_confidence {
        return candidate_confidence > current_confidence;
    }

    let current_source = relationship_source_rank(&current.source);
    let candidate_source = relationship_source_rank(&candidate.source);
    if candidate_source != current_source {
        return candidate_source > current_source;
    }

    let current_detail = current.source_detail.as_deref().unwrap_or("");
    let candidate_detail = candidate.source_detail.as_deref().unwrap_or("");
    candidate_detail.len() > current_detail.len()
}

fn build_relationships(
    resources: &[AzureResourceSnapshotDto],
) -> Vec<AzureRelationshipSnapshotDto> {
    let canonical_ids: BTreeMap<String, String> = resources
        .iter()
        .map(|resource| {
            (
                normalize_resource_id(&resource.resource_id),
                resource.resource_id.clone(),
            )
        })
        .collect();

    let mut dedupe: BTreeMap<(String, String, String), AzureRelationshipSnapshotDto> =
        BTreeMap::new();

    let try_add_edge =
        |from_canonical: &str,
         target_id: &str,
         relationship_type: &str,
         confidence: &str,
         source: &str,
         source_detail: Option<&str>,
         dedupe: &mut BTreeMap<(String, String, String), AzureRelationshipSnapshotDto>| {
            let from_normalized = normalize_resource_id(from_canonical);
            let target_normalized = normalize_resource_id(target_id);

            if target_normalized.is_empty() || target_normalized == from_normalized {
                return;
            }

            let Some(target_canonical) = canonical_ids.get(&target_normalized) else {
                return;
            };

            let key = (
                from_normalized,
                target_normalized,
                relationship_type.to_string(),
            );

            let candidate = AzureRelationshipSnapshotDto {
                from_resource_id: from_canonical.to_string(),
                to_resource_id: target_canonical.clone(),
                relationship_type: relationship_type.to_string(),
                confidence: confidence.to_string(),
                source: source.to_string(),
                source_detail: source_detail
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(str::to_string),
            };

            if let Some(existing) = dedupe.get(&key) {
                if should_replace_relationship(existing, &candidate) {
                    dedupe.insert(key, candidate);
                }
            } else {
                dedupe.insert(key, candidate);
            }
        };

    for resource in resources {
        // 1. dependsOn edges (from ARM deployment metadata)
        if let Some(depends_on) = &resource.depends_on {
            for dependency in depends_on {
                try_add_edge(
                    &resource.resource_id,
                    dependency,
                    "depends_on",
                    "high",
                    "arm_depends_on",
                    Some("dependsOn"),
                    &mut dedupe,
                );
            }
        }

        // 2. Property-based reference edges (from enriched KQL projections)
        for (label, target_id) in &resource.property_refs {
            let (rel_type, confidence) = relationship_type_for_property_ref(label);
            try_add_edge(
                &resource.resource_id,
                target_id,
                rel_type,
                confidence,
                "property_ref",
                Some(label),
                &mut dedupe,
            );
        }

        // 3. ARM ID hierarchy: child -> parent (free, no extra query)
        if let Some(parent_id) = infer_arm_parent_id(&resource.resource_id) {
            try_add_edge(
                &resource.resource_id,
                &parent_id,
                "depends_on",
                "high",
                "arm_parent",
                Some("resource_id_hierarchy"),
                &mut dedupe,
            );
        }
    }

    dedupe.into_values().collect()
}

fn summarize_account(payload: &JsonValue) -> String {
    let subscription_id = payload
        .get("id")
        .and_then(JsonValue::as_str)
        .unwrap_or("unknown");
    let subscription_name = payload
        .get("name")
        .and_then(JsonValue::as_str)
        .unwrap_or("unknown");
    let tenant_id = payload
        .get("tenantId")
        .and_then(JsonValue::as_str)
        .unwrap_or("unknown");
    let principal = payload
        .get("user")
        .and_then(|user| user.get("name"))
        .and_then(JsonValue::as_str)
        .unwrap_or("unknown");

    format!(
        "subscription={subscription_name} ({subscription_id}), tenant={tenant_id}, principal={principal}"
    )
}

fn normalize_scope(scope: AzureSyncScopeDto) -> AzureSyncScopeDto {
    let mut subscription_ids: Vec<String> = Vec::new();
    for raw_value in scope.subscription_ids {
        for parsed in split_subscription_tokens(&raw_value) {
            if !subscription_ids
                .iter()
                .any(|existing| existing.eq_ignore_ascii_case(&parsed))
            {
                subscription_ids.push(parsed);
            }
        }
    }

    let resource_groups = scope.resource_groups.map(|groups| {
        groups
            .into_iter()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .collect()
    });

    let tag_filters = scope.tag_filters.map(|filters| {
        filters
            .into_iter()
            .map(|(key, value)| (key.trim().to_string(), value.trim().to_string()))
            .filter(|(key, value)| !key.is_empty() && !value.is_empty())
            .collect()
    });

    let query = scope.query.and_then(|value| {
        let trimmed = value.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    });

    AzureSyncScopeDto {
        subscription_ids,
        resource_groups,
        tag_filters,
        query,
    }
}

async fn query_resource_rows(
    scope: &AzureSyncScopeDto,
    query: &str,
) -> Result<AzureGraphQueryRows, String> {
    let limits = pagination_settings();
    let mut rows: Vec<JsonValue> = Vec::new();
    let mut warnings: Vec<String> = Vec::new();
    let mut skip_token: Option<String> = None;

    for _ in 0..limits.max_pages {
        let mut args = vec![
            "graph".to_string(),
            "query".to_string(),
            "--output".to_string(),
            "json".to_string(),
            "--first".to_string(),
            limits.page_size.to_string(),
            "-q".to_string(),
            query.to_string(),
            "--subscriptions".to_string(),
        ];
        args.extend(scope.subscription_ids.iter().cloned());

        if let Some(token) = skip_token
            .as_deref()
            .filter(|token| !token.trim().is_empty())
        {
            args.push("--skip-token".to_string());
            args.push(token.to_string());
        }

        let payload = run_az_json(&args, "az graph query").await?;
        let page: AzureGraphQueryResponse = serde_json::from_value(payload)
            .map_err(|error| format!("Failed to decode az graph query response: {error}"))?;

        rows.extend(page.data);

        let next_token = page.skip_token.filter(|token| !token.trim().is_empty());
        if next_token.is_none() {
            return Ok(AzureGraphQueryRows { rows, warnings });
        }
        skip_token = next_token;
    }

    if skip_token.is_some() {
        warnings.push(format!(
            "Azure Resource Graph pagination guardrail reached; returning partial results (maxPages={}, pageSize={}, collectedRows={}). Set {} and {} to tune limits.",
            limits.max_pages,
            limits.page_size,
            rows.len(),
            AZURE_GRAPH_MAX_PAGES_ENV,
            AZURE_GRAPH_PAGE_SIZE_ENV,
        ));
    }

    Ok(AzureGraphQueryRows { rows, warnings })
}

#[tauri::command]
pub async fn azure_graph_validate_auth() -> Result<AzureAuthStatusDto, String> {
    let strategy = "azure-cli".to_string();

    if let Err(error) = validate_azure_cli_available().await {
        return Ok(AzureAuthStatusDto {
            available: false,
            authenticated: false,
            strategy,
            details: error,
        });
    }

    match query_azure_account().await {
        Ok(account) => Ok(AzureAuthStatusDto {
            available: true,
            authenticated: true,
            strategy,
            details: summarize_account(&account),
        }),
        Err(error) => Ok(AzureAuthStatusDto {
            available: true,
            authenticated: false,
            strategy,
            details: format!("{error}. Run `az login` and retry."),
        }),
    }
}

#[tauri::command]
pub async fn azure_graph_query(scope: AzureSyncScopeDto) -> Result<AzureGraphSnapshotDto, String> {
    let scope = normalize_scope(scope);
    if scope.subscription_ids.is_empty() {
        return Err("azure_graph_query requires at least one subscriptionId".to_string());
    }

    let invalid_subscription_ids: Vec<String> = scope
        .subscription_ids
        .iter()
        .filter(|value| !is_valid_guid(value))
        .cloned()
        .collect();
    if !invalid_subscription_ids.is_empty() {
        return Err(format!(
            "azure_graph_query received invalid subscription GUID(s): {}",
            invalid_subscription_ids.join(", ")
        ));
    }

    validate_azure_cli_available().await?;
    query_azure_account().await.map_err(|error| {
        format!("Azure CLI is not authenticated for query execution: {error}. Run `az login`.")
    })?;

    let query = scope
        .query
        .as_deref()
        .map(str::to_string)
        .unwrap_or_else(|| build_default_query(&scope));

    let query_result = query_resource_rows(&scope, &query).await?;
    let rows = query_result.rows;
    let warnings = query_result.warnings;
    let mut resources_by_id: BTreeMap<String, AzureResourceSnapshotDto> = BTreeMap::new();

    for row in &rows {
        let Some(resource) = decode_resource_row(row) else {
            continue;
        };

        if !matches_scope_filters(&resource, &scope) {
            continue;
        }

        resources_by_id.insert(normalize_resource_id(&resource.resource_id), resource);
    }

    let resources: Vec<AzureResourceSnapshotDto> = resources_by_id.into_values().collect();
    let relationships = build_relationships(&resources);

    if !rows.is_empty() && resources.is_empty() {
        return Err(
            "Azure query returned rows but none included required fields (id/type/name/subscriptionId). \
Use the default query or ensure custom query projects those columns."
                .to_string(),
        );
    }

    Ok(AzureGraphSnapshotDto {
        collected_at: now_epoch_millis(),
        scope,
        resources,
        relationships,
        warnings,
    })
}

#[cfg(test)]
mod property_tests {
    use super::{normalize_scope, AzureSyncScopeDto};
    use proptest::collection::{btree_map, vec};
    use proptest::prelude::*;

    fn scope_strategy() -> impl Strategy<Value = AzureSyncScopeDto> {
        let token = "[A-Fa-f0-9,;\\- \\t\\n\\r\\x0B\\x0C]{0,80}";
        let text = "[A-Za-z0-9 _-]{0,40}";

        (
            vec(token, 0..8),
            prop::option::of(vec(text, 0..8)),
            prop::option::of(btree_map(text, text, 0..8)),
            prop::option::of(text),
        )
            .prop_map(|(subscription_ids, resource_groups, tag_filters, query)| {
                AzureSyncScopeDto {
                    subscription_ids,
                    resource_groups,
                    tag_filters,
                    query,
                }
            })
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(128))]

        #[test]
        fn normalize_scope_is_idempotent(scope in scope_strategy()) {
            let once = normalize_scope(scope);
            let twice = normalize_scope(AzureSyncScopeDto {
                subscription_ids: once.subscription_ids.clone(),
                resource_groups: once.resource_groups.clone(),
                tag_filters: once.tag_filters.clone(),
                query: once.query.clone(),
            });

            prop_assert_eq!(&twice.subscription_ids, &once.subscription_ids);
            prop_assert_eq!(&twice.resource_groups, &once.resource_groups);
            prop_assert_eq!(&twice.tag_filters, &once.tag_filters);
            prop_assert_eq!(&twice.query, &once.query);
        }
    }
}
