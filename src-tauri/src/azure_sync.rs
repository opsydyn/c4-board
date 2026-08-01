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
    /// Values naming another resource without being its ARM id (ADR-018 Phase 6).
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub alias_refs: BTreeMap<String, String>,
    /// Values other resources may refer to this one by.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub identity_keys: BTreeMap<String, String>,
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

/// Prefix for a value that *names* another resource without being its ARM id
/// (ADR-018 Phase 6).
///
/// `_ref_` columns hold resource ids and can be matched directly. Some of the
/// most useful relationships are not recorded that way: a Container App records
/// its registry as a login-server hostname, and a Container Apps environment
/// records its workspace by that workspace's `customerId` GUID. ADR-017 saw the
/// registry case and left it, because resolving it needs a second pass rather
/// than another `_ref_` column.
///
/// An alias is resolved against the `_key_` values of the resources in the same
/// snapshot. Labels pair by name: `_alias_loginServer` looks up `_key_loginServer`.
const ALIAS_REF_PREFIX: &str = "_alias_";

/// Prefix for a value another resource may refer to this one by.
const IDENTITY_KEY_PREFIX: &str = "_key_";

/// Reads prefixed string columns out of a projected row.
fn extract_prefixed_strings(row: &JsonValue, prefix: &str) -> BTreeMap<String, String> {
    let mut found = BTreeMap::new();
    let Some(obj) = row.as_object() else {
        return found;
    };

    for (key, value) in obj {
        let Some(label) = key.strip_prefix(prefix) else {
            continue;
        };
        if label.is_empty() {
            continue;
        }

        if let JsonValue::String(text) = value {
            let trimmed = text.trim();
            if !trimmed.is_empty() {
                found.insert(label.to_string(), trimmed.to_string());
            }
        }
    }

    found
}

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
        alias_refs: extract_prefixed_strings(row, ALIAS_REF_PREFIX),
        identity_keys: extract_prefixed_strings(row, IDENTITY_KEY_PREFIX),
    })
}

/// Relationship semantics for an alias label (ADR-018 Phase 6).
///
/// Confidence is `high` for both: these are exact identifier matches against
/// another resource in the same snapshot, not name similarity or a guess.
fn relationship_type_for_alias(label: &str) -> Option<(&'static str, &'static str)> {
    match label {
        // A Container App pulling images from a registry.
        "loginServer" => Some(("depends_on", "high")),
        // A Container Apps environment shipping logs to a workspace.
        "customerId" => Some(("data_link", "high")),
        _ => None,
    }
}

/// Indexes every resource by the values other resources may name it with.
///
/// Keyed by `(label, lowercased value)` so a `loginServer` alias can never
/// resolve against a `customerId` key that happens to share a string.
fn build_identity_index(
    resources: &[AzureResourceSnapshotDto],
) -> BTreeMap<(String, String), String> {
    let mut index: BTreeMap<(String, String), String> = BTreeMap::new();

    for resource in resources {
        for (label, value) in &resource.identity_keys {
            index.insert(
                (label.clone(), value.trim().to_lowercase()),
                resource.resource_id.clone(),
            );
        }
    }

    index
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
         _ref_environmentId = coalesce(properties.environmentId, properties.managedEnvironmentId), \
         _ref_registryId = coalesce(properties.registryId, properties.containerRegistryId), \
         _ref_managedBy = managedBy, \
         _alias_loginServer = tostring(properties.configuration.registries[0].server), \
         _alias_customerId = tostring(properties.appLogsConfiguration.logAnalyticsConfiguration.customerId), \
         _key_loginServer = tostring(properties.loginServer), \
         _key_customerId = tostring(properties.customerId)",
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

    // Tag filtering, pushed server-side (ADR-018 Phase 4).
    //
    // This is a *reduction*, not the semantics. `matches_scope_filters` remains
    // the authority on what a tag filter means, and this predicate is written to
    // be a guaranteed superset of it, because the two cannot express the same
    // thing:
    //
    //   KQL `tags['project']` matches the key case-sensitively, while the
    //   client-side filter matches keys with `eq_ignore_ascii_case`. Verified
    //   against the live endpoint — `tags['Project']` returns nothing where
    //   `tags['project']` returns six. Pushing an exact-key predicate would
    //   silently drop resources a filter used to match, and with archiving on
    //   that reads as a deleted estate.
    //
    // `contains` is case-insensitive and matches the serialized bag, so anything
    // the client-side filter would keep survives this. It may also admit
    // resources whose value sits under a different key; those are dropped
    // afterwards, which costs a row rather than a resource.
    //
    // The point is not speed. Filters used to run *after* paging, so a tag
    // filter over a large estate could spend every page on non-matching
    // resources and return none of the matching ones.
    if let Some(tag_filters) = &scope.tag_filters {
        let mut values: Vec<&str> = tag_filters
            .values()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
            .collect();
        values.sort_unstable();
        values.dedup();

        for value in values {
            query.push_str(" | where tags contains '");
            query.push_str(&escape_kql_string(value));
            query.push('\'');
        }
    }

    query
}

/// Mapping from property ref label to (relationship_type, confidence).
fn relationship_type_for_property_ref(label: &str) -> (&'static str, &'static str) {
    match label {
        "serverFarmId" => ("depends_on", "high"),
        // A Container App runs inside its managed environment and pulls from its
        // registry. Both are as load-bearing as an App Service Plan. ADR-017.
        "environmentId" => ("depends_on", "high"),
        "registryId" => ("depends_on", "high"),
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

    let identity_index = build_identity_index(resources);

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

        // 3. Alias edges: a value that names another resource without being its
        //    ARM id, resolved against that resource's `_key_` values.
        //
        //    This is what lets a Container App reach its registry — it records
        //    `planetnikacre1289.azurecr.io`, never the registry's resource id —
        //    and an environment reach the workspace it logs to, which it records
        //    by that workspace's `customerId` GUID.
        //
        //    Unresolved aliases produce nothing. Naming a resource outside the
        //    synced scope is ordinary, and inventing an edge to a node that is
        //    not on the board would be worse than the missing edge.
        for (label, alias_value) in &resource.alias_refs {
            let Some((rel_type, confidence)) = relationship_type_for_alias(label) else {
                continue;
            };

            let Some(target_id) =
                identity_index.get(&(label.clone(), alias_value.trim().to_lowercase()))
            else {
                continue;
            };

            try_add_edge(
                &resource.resource_id,
                target_id,
                rel_type,
                confidence,
                "alias_ref",
                Some(label),
                &mut dedupe,
            );
        }

        // 4. ARM ID hierarchy: child -> parent (free, no extra query)
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

    let mut total_records: u64 = 0;

    for _ in 0..limits.max_pages {
        let page = crate::azure_rest::query_page(
            &scope.subscription_ids,
            query,
            limits.page_size,
            skip_token.as_deref(),
        )
        .await
        .map_err(|error| error.to_string())?;

        total_records = page.total_records;
        rows.extend(page.rows);

        // The service truncated the result set itself, independently of our
        // paging. Reported separately because narrowing the scope is the fix,
        // and raising our page limits is not.
        if page.result_truncated {
            warnings.push(
                "Azure Resource Graph truncated the result set. Narrow the scope and retry."
                    .to_string(),
            );
        }

        if page.skip_token.is_none() {
            break;
        }
        skip_token = page.skip_token;
    }

    // Now a fact rather than an inference. Over the CLI the only evidence of a
    // short read was a leftover skip token; the REST response states how many
    // rows matched, so a partial result can say how much is missing.
    if (rows.len() as u64) < total_records {
        warnings.push(format!(
            "Azure Resource Graph pagination guardrail reached; returning partial results ({} of {} rows, maxPages={}, pageSize={}). Set {} and {} to tune limits.",
            rows.len(),
            total_records,
            limits.max_pages,
            limits.page_size,
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
mod alias_tests {
    use super::{build_relationships, AzureResourceSnapshotDto};
    use std::collections::BTreeMap;

    /// ADR-018 Phase 6, from real values in a live subscription.
    ///
    /// ADR-017 projected `_ref_registryId` and recorded that it fired on
    /// nothing: a Container App stores its registry as a login-server hostname,
    /// never as a resource id, so there was nothing for a `_ref_` column to
    /// match. The same is true of a Container Apps environment and its
    /// workspace, which it names by that workspace's `customerId` GUID.
    fn resource(
        id: &str,
        kind: &str,
        aliases: &[(&str, &str)],
        keys: &[(&str, &str)],
    ) -> AzureResourceSnapshotDto {
        AzureResourceSnapshotDto {
            resource_id: id.to_string(),
            r#type: kind.to_string(),
            name: id.rsplit('/').next().unwrap_or(id).to_string(),
            location: None,
            subscription_id: "sub".to_string(),
            resource_group: None,
            tags: BTreeMap::new(),
            depends_on: None,
            property_refs: BTreeMap::new(),
            alias_refs: aliases
                .iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect(),
            identity_keys: keys
                .iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect(),
        }
    }

    #[test]
    fn a_container_app_reaches_the_registry_it_pulls_from() {
        let app = resource(
            "/subscriptions/s/providers/Microsoft.App/containerApps/planetnik-app",
            "microsoft.app/containerapps",
            &[("loginServer", "planetnikacre1289.azurecr.io")],
            &[],
        );
        let registry = resource(
            "/subscriptions/s/providers/Microsoft.ContainerRegistry/registries/planetnikacre1289",
            "microsoft.containerregistry/registries",
            &[],
            &[("loginServer", "planetnikacre1289.azurecr.io")],
        );

        let edges = build_relationships(&[app.clone(), registry.clone()]);
        let edge = edges
            .iter()
            .find(|edge| edge.source == "alias_ref")
            .expect("the registry edge ADR-017 could not build");

        assert_eq!(edge.from_resource_id, app.resource_id);
        assert_eq!(edge.to_resource_id, registry.resource_id);
        assert_eq!(edge.confidence, "high");
    }

    #[test]
    fn an_environment_reaches_the_workspace_it_logs_to() {
        let environment = resource(
            "/subscriptions/s/providers/Microsoft.App/managedEnvironments/planetnik-env",
            "microsoft.app/managedenvironments",
            &[("customerId", "c9737900-cd5b-4ce4-b101-6622718c539e")],
            &[],
        );
        let workspace = resource(
            "/subscriptions/s/providers/Microsoft.OperationalInsights/workspaces/planetnik-logs",
            "microsoft.operationalinsights/workspaces",
            &[],
            &[("customerId", "c9737900-cd5b-4ce4-b101-6622718c539e")],
        );

        let edges = build_relationships(&[environment, workspace.clone()]);
        let edge = edges
            .iter()
            .find(|edge| edge.source == "alias_ref")
            .expect("the workspace edge");

        assert_eq!(edge.to_resource_id, workspace.resource_id);
        assert_eq!(edge.relationship_type, "data_link");
    }

    #[test]
    fn an_alias_that_resolves_to_nothing_produces_no_edge() {
        // Naming a resource outside the synced scope is ordinary. An edge to a
        // node that is not on the board would be worse than the missing edge.
        let app = resource(
            "/subscriptions/s/providers/Microsoft.App/containerApps/app",
            "microsoft.app/containerapps",
            &[("loginServer", "somewhere-else.azurecr.io")],
            &[],
        );

        let edges = build_relationships(&[app]);

        assert!(edges.iter().all(|edge| edge.source != "alias_ref"));
    }

    #[test]
    fn an_alias_never_resolves_against_a_different_labels_key() {
        // Both are opaque identifiers; matching on value alone would let a
        // login server resolve against a workspace that happened to share it.
        let app = resource(
            "/subscriptions/s/providers/Microsoft.App/containerApps/app",
            "microsoft.app/containerapps",
            &[("loginServer", "shared-value")],
            &[],
        );
        let workspace = resource(
            "/subscriptions/s/providers/Microsoft.OperationalInsights/workspaces/w",
            "microsoft.operationalinsights/workspaces",
            &[],
            &[("customerId", "shared-value")],
        );

        let edges = build_relationships(&[app, workspace]);

        assert!(edges.iter().all(|edge| edge.source != "alias_ref"));
    }

    #[test]
    fn alias_matching_ignores_case_because_azure_is_inconsistent_about_it() {
        let app = resource(
            "/subscriptions/s/providers/Microsoft.App/containerApps/app",
            "microsoft.app/containerapps",
            &[("loginServer", "PlanetnikACRe1289.azurecr.io")],
            &[],
        );
        let registry = resource(
            "/subscriptions/s/providers/Microsoft.ContainerRegistry/registries/r",
            "microsoft.containerregistry/registries",
            &[],
            &[("loginServer", "planetnikacre1289.azurecr.io")],
        );

        let edges = build_relationships(&[app, registry]);

        assert!(edges.iter().any(|edge| edge.source == "alias_ref"));
    }

    #[test]
    fn an_unknown_alias_label_is_ignored_rather_than_guessed_at() {
        let app = resource(
            "/subscriptions/s/providers/Microsoft.App/containerApps/app",
            "microsoft.app/containerapps",
            &[("somethingNew", "value")],
            &[],
        );
        let other = resource(
            "/subscriptions/s/providers/Microsoft.Other/things/t",
            "microsoft.other/things",
            &[],
            &[("somethingNew", "value")],
        );

        let edges = build_relationships(&[app, other]);

        assert!(edges.iter().all(|edge| edge.source != "alias_ref"));
    }
}

#[cfg(test)]
mod projection_tests {
    use super::{build_default_query, relationship_type_for_property_ref, AzureSyncScopeDto};

    /// ADR-017.
    ///
    /// The first end-to-end run against a real subscription produced zero edges.
    /// Not because the estate was flat — its Container Apps each carried
    /// `properties.environmentId` pointing at their managed environment — but
    /// because the projection never selected that column, so the relationship was
    /// discarded before it left the CLI. A board of disconnected nodes looks like
    /// an answer, which is worse than importing nothing.
    fn empty_scope() -> AzureSyncScopeDto {
        AzureSyncScopeDto {
            subscription_ids: vec![],
            resource_groups: None,
            tag_filters: None,
            query: None,
        }
    }

    fn scope_with_tags(pairs: &[(&str, &str)]) -> AzureSyncScopeDto {
        AzureSyncScopeDto {
            subscription_ids: vec![],
            resource_groups: None,
            tag_filters: Some(
                pairs
                    .iter()
                    .map(|(key, value)| (key.to_string(), value.to_string()))
                    .collect(),
            ),
            query: None,
        }
    }

    /// ADR-018 Phase 4. Filters used to run after paging, so a tag filter over a
    /// large estate could spend every page on non-matching resources and return
    /// none of the matching ones.
    #[test]
    fn tag_filters_reach_the_query_instead_of_only_the_client() {
        let query = build_default_query(&scope_with_tags(&[("project", "planetnik")]));

        assert!(query.contains("| where tags contains 'planetnik'"));
    }

    /// The predicate must be a superset of `matches_scope_filters`, which
    /// compares keys case-insensitively. KQL's `tags['Project']` does not, so an
    /// exact-key predicate would silently drop resources a filter used to match.
    #[test]
    fn the_pushed_predicate_does_not_pin_the_tag_key() {
        let query = build_default_query(&scope_with_tags(&[("Project", "planetnik")]));

        assert!(!query.contains("tags['Project']"));
        assert!(!query.contains("tags[\"Project\"]"));
        assert!(query.contains("contains 'planetnik'"));
    }

    #[test]
    fn tag_values_are_escaped_like_every_other_operator_string() {
        let query = build_default_query(&scope_with_tags(&[("owner", "o'brien")]));

        assert!(query.contains("contains 'o''brien'"));
    }

    #[test]
    fn an_empty_tag_value_adds_no_predicate() {
        // An empty value would push `contains ''`, which matches everything and
        // reads as a filter that silently does nothing.
        let query = build_default_query(&scope_with_tags(&[("project", "   ")]));

        assert!(!query.contains("| where tags contains"));
    }

    #[test]
    fn the_tag_predicate_follows_the_projection_that_selects_tags() {
        let query = build_default_query(&scope_with_tags(&[("project", "planetnik")]));

        assert!(query.find("project id").unwrap() < query.find("where tags contains").unwrap());
    }

    #[test]
    fn projects_the_container_app_environment_reference() {
        let query = build_default_query(&empty_scope());

        assert!(
            query.contains("_ref_environmentId"),
            "container apps lose their environment edge without this column"
        );
        // Both spellings exist across API versions; coalesce covers them.
        assert!(query.contains("properties.environmentId"));
        assert!(query.contains("properties.managedEnvironmentId"));
    }

    #[test]
    fn projects_the_container_registry_reference() {
        assert!(build_default_query(&empty_scope()).contains("_ref_registryId"));
    }

    #[test]
    fn labels_the_new_refs_rather_than_leaving_them_inferred() {
        // Unknown labels degrade to ("inferred", "medium"), which is safe but
        // loses fidelity. These two are known relationships, so name them.
        assert_eq!(
            relationship_type_for_property_ref("environmentId"),
            ("depends_on", "high")
        );
        assert_eq!(
            relationship_type_for_property_ref("registryId"),
            ("depends_on", "high")
        );
    }

    #[test]
    fn still_degrades_gracefully_for_labels_it_does_not_know() {
        assert_eq!(
            relationship_type_for_property_ref("somethingNew"),
            ("inferred", "medium")
        );
    }
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
