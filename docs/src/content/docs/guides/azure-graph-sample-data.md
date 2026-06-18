---
title: "Azure Resource Graph - Full Dataset Reference"
---

# Azure Resource Graph - Full Dataset Reference

**Subscription**: `e1289da2-5faa-44b8-b780-7609260fa273` (Azure subscription 1)
**Queried**: 2026-02-12
**Total Resources**: 13
**Edges**: 3 (1 property ref + 2 ARM parent)

---

## Full Raw Dataset (az graph query)

All 13 resources as returned by the enriched KQL query.

### 1. bing-search-tester-2025

```json
{
  "id": "/subscriptions/e1289da2-5faa-44b8-b780-7609260fa273/resourceGroups/ai-foundry-tester-2025/providers/Microsoft.Bing/accounts/bing-search-tester-2025",
  "type": "microsoft.bing/accounts",
  "name": "bing-search-tester-2025",
  "location": "global",
  "subscriptionId": "e1289da2-5faa-44b8-b780-7609260fa273",
  "resourceGroup": "ai-foundry-tester-2025",
  "tags": {},
  "dependsOn": null,
  "_ref_serverFarmId": null,
  "_ref_workspaceId": null,
  "_ref_subnetId": null,
  "_ref_vnetSubnetId": null,
  "_ref_nsgId": null,
  "_ref_storageAccountId": null
}
```

### 2. alanc-me2llwan-eastus2

```json
{
  "id": "/subscriptions/e1289da2-5faa-44b8-b780-7609260fa273/resourceGroups/ai-foundry-tester-2025/providers/Microsoft.CognitiveServices/accounts/alanc-me2llwan-eastus2",
  "type": "microsoft.cognitiveservices/accounts",
  "name": "alanc-me2llwan-eastus2",
  "location": "eastus2",
  "subscriptionId": "e1289da2-5faa-44b8-b780-7609260fa273",
  "resourceGroup": "ai-foundry-tester-2025",
  "tags": null,
  "dependsOn": null,
  "_ref_serverFarmId": null,
  "_ref_workspaceId": null,
  "_ref_subnetId": null,
  "_ref_vnetSubnetId": null,
  "_ref_nsgId": null,
  "_ref_storageAccountId": null
}
```

### 3. alanc-me2llwan-eastus2_project (child of #2)

```json
{
  "id": "/subscriptions/e1289da2-5faa-44b8-b780-7609260fa273/resourceGroups/ai-foundry-tester-2025/providers/Microsoft.CognitiveServices/accounts/alanc-me2llwan-eastus2/projects/alanc-me2llwan-eastus2_project",
  "type": "microsoft.cognitiveservices/accounts/projects",
  "name": "alanc-me2llwan-eastus2/alanc-me2llwan-eastus2_project",
  "location": "eastus2",
  "subscriptionId": "e1289da2-5faa-44b8-b780-7609260fa273",
  "resourceGroup": "ai-foundry-tester-2025",
  "tags": null,
  "dependsOn": null,
  "_ref_serverFarmId": null,
  "_ref_workspaceId": null,
  "_ref_subnetId": null,
  "_ref_vnetSubnetId": null,
  "_ref_nsgId": null,
  "_ref_storageAccountId": null
}
```

**ARM parent edge**: `#3 → #2` (depends_on, high) — inferred from ID hierarchy

### 4. az-ai-test-project

```json
{
  "id": "/subscriptions/e1289da2-5faa-44b8-b780-7609260fa273/resourceGroups/ai-foundry-tester-2025/providers/Microsoft.CognitiveServices/accounts/az-ai-test-project",
  "type": "microsoft.cognitiveservices/accounts",
  "name": "az-ai-test-project",
  "location": "eastus",
  "subscriptionId": "e1289da2-5faa-44b8-b780-7609260fa273",
  "resourceGroup": "ai-foundry-tester-2025",
  "tags": {},
  "dependsOn": null,
  "_ref_serverFarmId": null,
  "_ref_workspaceId": null,
  "_ref_subnetId": null,
  "_ref_vnetSubnetId": null,
  "_ref_nsgId": null,
  "_ref_storageAccountId": null
}
```

### 5. aiFoundryTestProject (child of #4)

```json
{
  "id": "/subscriptions/e1289da2-5faa-44b8-b780-7609260fa273/resourceGroups/ai-foundry-tester-2025/providers/Microsoft.CognitiveServices/accounts/az-ai-test-project/projects/aiFoundryTestProject",
  "type": "microsoft.cognitiveservices/accounts/projects",
  "name": "az-ai-test-project/aiFoundryTestProject",
  "location": "eastus",
  "subscriptionId": "e1289da2-5faa-44b8-b780-7609260fa273",
  "resourceGroup": "ai-foundry-tester-2025",
  "tags": null,
  "dependsOn": null,
  "_ref_serverFarmId": null,
  "_ref_workspaceId": null,
  "_ref_subnetId": null,
  "_ref_vnetSubnetId": null,
  "_ref_nsgId": null,
  "_ref_storageAccountId": null
}
```

**ARM parent edge**: `#5 → #4` (depends_on, high) — inferred from ID hierarchy

### 6. grafana-ai-o11y

```json
{
  "id": "/subscriptions/e1289da2-5faa-44b8-b780-7609260fa273/resourceGroups/ai-foundry-tester-2025/providers/Microsoft.Dashboard/grafana/grafana-ai-o11y",
  "type": "microsoft.dashboard/grafana",
  "name": "grafana-ai-o11y",
  "location": "centralus",
  "subscriptionId": "e1289da2-5faa-44b8-b780-7609260fa273",
  "resourceGroup": "ai-foundry-tester-2025",
  "tags": {},
  "dependsOn": null,
  "_ref_serverFarmId": null,
  "_ref_workspaceId": null,
  "_ref_subnetId": null,
  "_ref_vnetSubnetId": null,
  "_ref_nsgId": null,
  "_ref_storageAccountId": null
}
```

### 7. Application Insights Smart Detection

```json
{
  "id": "/subscriptions/e1289da2-5faa-44b8-b780-7609260fa273/resourceGroups/ai-foundry-tester-2025/providers/microsoft.insights/actiongroups/Application Insights Smart Detection",
  "type": "microsoft.insights/actiongroups",
  "name": "Application Insights Smart Detection",
  "location": "global",
  "subscriptionId": "e1289da2-5faa-44b8-b780-7609260fa273",
  "resourceGroup": "ai-foundry-tester-2025",
  "tags": null,
  "dependsOn": null,
  "_ref_serverFarmId": null,
  "_ref_workspaceId": null,
  "_ref_subnetId": null,
  "_ref_vnetSubnetId": null,
  "_ref_nsgId": null,
  "_ref_storageAccountId": null
}
```

### 8. ai_o11y (has property ref edge)

```json
{
  "id": "/subscriptions/e1289da2-5faa-44b8-b780-7609260fa273/resourceGroups/ai-foundry-tester-2025/providers/microsoft.insights/components/ai_o11y",
  "type": "microsoft.insights/components",
  "name": "ai_o11y",
  "location": "centralus",
  "subscriptionId": "e1289da2-5faa-44b8-b780-7609260fa273",
  "resourceGroup": "ai-foundry-tester-2025",
  "tags": {},
  "dependsOn": null,
  "_ref_serverFarmId": null,
  "_ref_workspaceId": "/subscriptions/e1289da2-5faa-44b8-b780-7609260fa273/resourcegroups/DefaultResourceGroup-CUS/providers/Microsoft.OperationalInsights/workspaces/DefaultWorkspace-e1289da2-5faa-44b8-b780-7609260fa273-CUS",
  "_ref_subnetId": null,
  "_ref_vnetSubnetId": null,
  "_ref_nsgId": null,
  "_ref_storageAccountId": null
}
```

**Property ref edge**: `#8 → #12` (data_link, high) — via `_ref_workspaceId`

### 9. ae2c2bcc-...-dashboard

```json
{
  "id": "/subscriptions/e1289da2-5faa-44b8-b780-7609260fa273/resourceGroups/ai-foundry-tester-2025/providers/Microsoft.Portal/dashboards/ae2c2bcc-f752-4731-8711-562b6d85587c-dashboard",
  "type": "microsoft.portal/dashboards",
  "name": "ae2c2bcc-f752-4731-8711-562b6d85587c-dashboard",
  "location": "centralus",
  "subscriptionId": "e1289da2-5faa-44b8-b780-7609260fa273",
  "resourceGroup": "ai-foundry-tester-2025",
  "tags": {
    "hidden-title": "ai_o11y Dashboard"
  },
  "dependsOn": null,
  "_ref_serverFarmId": null,
  "_ref_workspaceId": null,
  "_ref_subnetId": null,
  "_ref_vnetSubnetId": null,
  "_ref_nsgId": null,
  "_ref_storageAccountId": null
}
```

### 10. apim-learn

```json
{
  "id": "/subscriptions/e1289da2-5faa-44b8-b780-7609260fa273/resourceGroups/apim-learn/providers/Microsoft.Web/staticSites/apim-learn",
  "type": "microsoft.web/staticsites",
  "name": "apim-learn",
  "location": "centralus",
  "subscriptionId": "e1289da2-5faa-44b8-b780-7609260fa273",
  "resourceGroup": "apim-learn",
  "tags": null,
  "dependsOn": null,
  "_ref_serverFarmId": null,
  "_ref_workspaceId": null,
  "_ref_subnetId": null,
  "_ref_vnetSubnetId": null,
  "_ref_nsgId": null,
  "_ref_storageAccountId": null
}
```

### 11. astro-blog

```json
{
  "id": "/subscriptions/e1289da2-5faa-44b8-b780-7609260fa273/resourceGroups/astro-blog/providers/Microsoft.Web/staticSites/astro-blog",
  "type": "microsoft.web/staticsites",
  "name": "astro-blog",
  "location": "centralus",
  "subscriptionId": "e1289da2-5faa-44b8-b780-7609260fa273",
  "resourceGroup": "astro-blog",
  "tags": null,
  "dependsOn": null,
  "_ref_serverFarmId": null,
  "_ref_workspaceId": null,
  "_ref_subnetId": null,
  "_ref_vnetSubnetId": null,
  "_ref_nsgId": null,
  "_ref_storageAccountId": null
}
```

### 12. DefaultWorkspace-...-CUS

```json
{
  "id": "/subscriptions/e1289da2-5faa-44b8-b780-7609260fa273/resourceGroups/DefaultResourceGroup-CUS/providers/Microsoft.OperationalInsights/workspaces/DefaultWorkspace-e1289da2-5faa-44b8-b780-7609260fa273-CUS",
  "type": "microsoft.operationalinsights/workspaces",
  "name": "DefaultWorkspace-e1289da2-5faa-44b8-b780-7609260fa273-CUS",
  "location": "centralus",
  "subscriptionId": "e1289da2-5faa-44b8-b780-7609260fa273",
  "resourceGroup": "defaultresourcegroup-cus",
  "tags": null,
  "dependsOn": null,
  "_ref_serverFarmId": null,
  "_ref_workspaceId": null,
  "_ref_subnetId": null,
  "_ref_vnetSubnetId": null,
  "_ref_nsgId": null,
  "_ref_storageAccountId": null
}
```

### 13. NetworkWatcher_westeurope

```json
{
  "id": "/subscriptions/e1289da2-5faa-44b8-b780-7609260fa273/resourceGroups/NetworkWatcherRG/providers/Microsoft.Network/networkWatchers/NetworkWatcher_westeurope",
  "type": "microsoft.network/networkwatchers",
  "name": "NetworkWatcher_westeurope",
  "location": "westeurope",
  "subscriptionId": "e1289da2-5faa-44b8-b780-7609260fa273",
  "resourceGroup": "networkwatcherrg",
  "tags": null,
  "dependsOn": null,
  "_ref_serverFarmId": null,
  "_ref_workspaceId": null,
  "_ref_subnetId": null,
  "_ref_vnetSubnetId": null,
  "_ref_nsgId": null,
  "_ref_storageAccountId": null
}
```

---

## Current C4 Type Mapping

All 13 resources currently map to `system` via `inferC4Type()`:

| # | Name | Azure Type | C4 Type | Notes |
|---|------|-----------|---------|-------|
| 1 | bing-search-tester-2025 | microsoft.bing/accounts | system | external service |
| 2 | alanc-me2llwan-eastus2 | microsoft.cognitiveservices/accounts | system | AI foundry hub |
| 3 | alanc-me2llwan-eastus2_project | microsoft.cognitiveservices/accounts/projects | system | child of #2 |
| 4 | az-ai-test-project | microsoft.cognitiveservices/accounts | system | AI foundry hub |
| 5 | aiFoundryTestProject | microsoft.cognitiveservices/accounts/projects | system | child of #4 |
| 6 | grafana-ai-o11y | microsoft.dashboard/grafana | system | observability |
| 7 | Application Insights Smart Detection | microsoft.insights/actiongroups | system | alerting |
| 8 | ai_o11y | microsoft.insights/components | system | App Insights |
| 9 | ae2c2bcc-...-dashboard | microsoft.portal/dashboards | system | portal dashboard |
| 10 | apim-learn | microsoft.web/staticsites | system | static site |
| 11 | astro-blog | microsoft.web/staticsites | system | static site |
| 12 | DefaultWorkspace-...-CUS | microsoft.operationalinsights/workspaces | system | Log Analytics |
| 13 | NetworkWatcher_westeurope | microsoft.network/networkwatchers | system | network monitor |

---

## Edges (3 total)

| From | To | Type | Confidence | Source |
|------|----|------|------------|--------|
| #3 alanc-me2llwan-eastus2_project | #2 alanc-me2llwan-eastus2 | depends_on | high | ARM parent inference |
| #5 aiFoundryTestProject | #4 az-ai-test-project | depends_on | high | ARM parent inference |
| #8 ai_o11y | #12 DefaultWorkspace-...-CUS | data_link | high | `_ref_workspaceId` property |

---

## Type Diversity Assessment

The current estate has **zero diversity** in C4 type mapping — everything maps to `system`. Here's what `inferC4Type` currently recognizes:

| C4 Type | Azure Type Pattern | Count in Estate |
|---------|-------------------|-----------------|
| container | `microsoft.network/virtualnetworks` | 0 |
| container | `microsoft.compute/virtualmachines` | 0 |
| component | `microsoft.web/sites` | 0 |
| system | `microsoft.containerservice/managedclusters` | 0 |
| system | *(default fallback)* | 13 |

### Suggested Type Mapping Expansion

To get meaningful C4 variety from this estate:

| Azure Type | Suggested C4 Type | Rationale |
|-----------|-------------------|-----------|
| `microsoft.web/staticsites` | externalSystem | publicly accessible, externally facing |
| `microsoft.insights/components` | component | monitoring component within a system |
| `microsoft.insights/actiongroups` | component | alerting component |
| `microsoft.operationalinsights/workspaces` | container | data store / platform |
| `microsoft.dashboard/grafana` | component | visualization component |
| `microsoft.portal/dashboards` | component | portal component |
| `microsoft.cognitiveservices/accounts` | system | AI platform (keep as system) |
| `microsoft.cognitiveservices/accounts/projects` | component | project within AI platform |
| `microsoft.bing/accounts` | externalSystem | external API service |
| `microsoft.network/networkwatchers` | component | infrastructure component |

### Free Azure Resources to Demonstrate More Types

See [Recommendation section below](#recommendation-free-resources-for-type-diversity) for resources that would exercise `container`, `component`, and `externalSystem` mappings.

---

## Enriched KQL Query

Current query projects 6 additional `_ref_*` columns for property-based edges:

```kql
Resources
| project id, type, name, location, subscriptionId, resourceGroup, tags,
           dependsOn = properties.dependsOn,
           _ref_serverFarmId = properties.serverFarmId,
           _ref_workspaceId = properties.WorkspaceResourceId,
           _ref_subnetId = properties.subnet.id,
           _ref_vnetSubnetId = properties.vnetSubnetResourceId,
           _ref_nsgId = properties.networkSecurityGroup.id,
           _ref_storageAccountId = properties.storageAccount.id
```

### Property Ref → Relationship Type Mapping (Rust)

| Ref Label | Relationship Type | Confidence |
|-----------|------------------|------------|
| serverFarmId | depends_on | high |
| workspaceId | data_link | high |
| storageAccountId | data_link | high |
| subnetId / vnetSubnetId | network_link | high |
| nsgId | network_link | high |
| *(other)* | inferred | medium |

---

## Recommendation: Free Resources for Type Diversity

### Option A: VNet + Subnet + NSG (Free, Instant)

Creates network topology with `container` type nodes and `network_link` edges.

```bash
az group create -n graph-sync-demo -l centralus
az network nsg create -g graph-sync-demo -n demo-nsg
az network vnet create \
  -g graph-sync-demo -n demo-vnet \
  --address-prefix 10.0.0.0/16 \
  --subnet-name demo-subnet \
  --subnet-prefix 10.0.0.0/24 \
  --network-security-group demo-nsg
```

### Option B: App Service Plan + Web App (Free Tier)

Creates `component` type node with `depends_on` edge via `serverFarmId`.

```bash
az appservice plan create -g graph-sync-demo -n demo-plan --sku F1
az webapp create -g graph-sync-demo -n demo-webapp-graphsync --plan demo-plan
```

### Option C: Storage Account (Free Tier Usage)

Standalone — useful for testing tag-based ownership and `data_link` edges.

```bash
az storage account create -g graph-sync-demo -n demostgraphsync --sku Standard_LRS --kind StorageV2
```

---

## Next Steps

### 1. Expand `inferC4Type()` type mapping

Update `azure-sync.mapper.ts` to map Azure types to diverse C4 types instead of defaulting everything to `system`. Use a lookup table approach:

| Azure Type Pattern | C4 Type | Reasoning |
|-------------------|---------|-----------|
| `microsoft.cognitiveservices/accounts` | system | Top-level AI platform |
| `microsoft.cognitiveservices/accounts/projects` | component | Child project within a system |
| `microsoft.web/staticsites` | externalSystem | Publicly accessible, externally facing |
| `microsoft.web/sites` | component | App hosted on a platform |
| `microsoft.insights/components` | component | Monitoring component |
| `microsoft.insights/actiongroups` | component | Alerting component |
| `microsoft.operationalinsights/workspaces` | container | Data store / logging platform |
| `microsoft.dashboard/grafana` | component | Visualization component |
| `microsoft.portal/dashboards` | component | Portal UI component |
| `microsoft.bing/accounts` | externalSystem | External API service |
| `microsoft.network/networkwatchers` | component | Infrastructure component |
| `microsoft.network/virtualnetworks` | container | Network boundary |
| `microsoft.compute/virtualmachines` | container | Compute host |
| `microsoft.containerservice/managedclusters` | system | K8s platform |
| `microsoft.storage/storageaccounts` | container | Data store |

**Heuristic fallback**: Resources with `/` child segments (e.g. `accounts/projects`) default to `component`; top-level resources default to `system`.

### 2. Deploy free Azure resources for richer test data

Run Option A + B from the recommendations above to get:
- `container` nodes (VNet, Subnet)
- `component` nodes (Web App)
- `network_link` edges (NSG -> Subnet)
- `depends_on` edges (Web App -> App Service Plan via `serverFarmId`)

This exercises all 3 edge discovery paths (ARM parent, property ref, dependsOn).

### 3. Add `_ref_*` columns for additional edge discovery

Candidates for enriched KQL projection:

| Property Path | Ref Label | Relationship Type | Common On |
|--------------|-----------|-------------------|-----------|
| `properties.managedBy` | managedBy | depends_on | Managed disks, AKS node pools |
| `properties.dnsSettings.fqdn` | dnsName | network_link | Public IPs, Traffic Manager |
| `properties.keyVaultId` | keyVaultId | identity_link | App Services, Functions |
| `properties.containerRegistryId` | registryId | depends_on | AKS, Container Apps |

### 4. Tag-based team ownership

Current `readTeamOwnership` checks: `team`, `owner`, `domain`, `managed-by`. Consider adding:
- `cost-center` — maps to team/department
- `environment` — could influence C4 grouping (dev/staging/prod)
- `app` or `application` — natural C4 system grouping

### 5. Namespace support for multi-subscription sync

The `AzureMappingOptions.namespace` parameter is wired through but not yet used in the UI. Next steps:
- Pass subscription name or alias as namespace when syncing multiple subscriptions
- Namespace prevents node ID collisions across subscriptions
- Consider grouping nodes by namespace in the canvas layout
