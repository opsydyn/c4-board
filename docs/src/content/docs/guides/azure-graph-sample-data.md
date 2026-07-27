---
title: "Azure Resource Graph reference"
---

# Azure Resource Graph reference

What `az graph query` returns and how the app turns it into a board. Read this to understand the row shape and the edge-discovery columns without running a sync first.

**This is a reference, not a capture.** It was originally a verbatim dump of one tenant's inventory, which went stale the moment that tenant changed and published its resource names besides. Identifiers and names here are illustrative; the structure is real. To see your own, follow the [Azure sync guide](azure-sync.md).

## The row shape

Every resource comes back as one row. The `_ref_*` columns are projected by the app, not by Resource Graph — each one is a property that may hold another resource's id, and each becomes a candidate edge.

```json
{
  "id": "/subscriptions/<subscription-id>/resourceGroups/example-rg/providers/Microsoft.App/containerApps/example-app",
  "type": "microsoft.app/containerapps",
  "name": "example-app",
  "location": "westeurope",
  "subscriptionId": "<subscription-id>",
  "resourceGroup": "example-rg",
  "tags": { "team": "platform" },
  "dependsOn": null,
  "_ref_environmentId": "/subscriptions/<subscription-id>/resourceGroups/example-rg/providers/Microsoft.App/managedEnvironments/example-env",
  "_ref_serverFarmId": null,
  "_ref_workspaceId": null,
  "_ref_storageAccountId": null
}
```

A row whose `_ref_*` columns are all `null` still becomes a node; it simply has no discovered relationships. That is common and is not a failure.

## The projection

Sixteen `_ref_*` columns are projected, several of them coalescing two spellings that differ across API versions. The authoritative list is `build_default_query` in `src-tauri/src/azure_sync.rs`.

```kql
Resources
| project id, type, name, location, subscriptionId, resourceGroup, tags,
    dependsOn = properties.dependsOn,
    _ref_serverFarmId       = properties.serverFarmId,
    _ref_workspaceId        = coalesce(properties.WorkspaceResourceId, properties.workspaceResourceId),
    _ref_subnetId           = coalesce(properties.subnet.id, properties.subnetId),
    _ref_vnetSubnetId       = properties.vnetSubnetResourceId,
    _ref_nsgId              = coalesce(properties.networkSecurityGroup.id, properties.networkSecurityGroupId),
    _ref_storageAccountId   = coalesce(properties.storageAccount.id, properties.storageAccountId),
    _ref_virtualNetworkId   = coalesce(properties.virtualNetwork.id, properties.virtualNetworkId),
    _ref_publicIpAddressId  = coalesce(properties.publicIPAddress.id, properties.publicIpAddressId),
    _ref_routeTableId       = coalesce(properties.routeTable.id, properties.routeTableId),
    _ref_natGatewayId       = coalesce(properties.natGateway.id, properties.natGatewayId),
    _ref_privateEndpointId  = properties.privateEndpoint.id,
    _ref_privateLinkServiceId = properties.privateLinkService.id,
    _ref_dnsZoneId          = coalesce(properties.privateDnsZoneId, properties.privateDnsZone.id),
    _ref_keyVaultId         = properties.keyVault.id,
    _ref_environmentId      = coalesce(properties.environmentId, properties.managedEnvironmentId),
    _ref_registryId         = coalesce(properties.registryId, properties.containerRegistryId),
    _ref_managedBy          = managedBy
```

Adding a relationship means adding one column here and one label below. The `_ref_` prefix is stripped generically, so an unknown label is consumed rather than rejected.

## Property ref to relationship type

From `relationship_type_for_property_ref`:

| Ref label | Relationship | Confidence |
| --------- | ------------ | ---------- |
| `serverFarmId` | depends_on | high |
| `environmentId` | depends_on | high |
| `registryId` | depends_on | high |
| `workspaceId` | data_link | high |
| `storageAccountId` | data_link | high |
| `subnetId`, `vnetSubnetId`, `nsgId`, `virtualNetworkId`, `publicIpAddressId`, `routeTableId`, `natGatewayId`, `privateEndpointId`, `privateLinkServiceId`, `dnsZoneId` | network_link | high |
| `keyVaultId` | identity_link | medium |
| `managedBy` | depends_on | medium |
| *anything else* | inferred | medium |

`_ref_registryId` is projected but has never been observed firing: a Container App holds its registries under `properties.configuration.registries[]`, an array of login-server hostnames rather than a resource id. It is kept because it is the documented property for AKS. See [ADR-017](../architecture/adr/017-azure-resource-type-mapping.md).

## The three ways an edge is found

1. **ARM parent** — one resource id is a prefix of another's.
2. **`dependsOn`** — ARM deployment authoring. Frequently empty; it reflects how something was deployed, not how it runs.
3. **Property ref** — the `_ref_*` columns above. In practice this is where most real edges come from.

## C4 type mapping

Resolved in three tiers — exact type, then provider namespace, then shape. Azure has roughly 4,650 resource types, so the exact table is an override layer rather than the mechanism. Fully described in [ADR-017](../architecture/adr/017-azure-resource-type-mapping.md) and summarised for users in the [Azure sync guide](azure-sync.md).

## Growing an estate to exercise more types

A subscription with only web apps produces a monotonous board. These are cheap ways to get more shapes into a test tenant.

**Network topology** — yields `container` nodes and `network_link` edges:

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

**App Service plan and web app** — yields a `component` with a `depends_on` edge via `serverFarmId`:

```bash
az appservice plan create -g graph-sync-demo -n demo-plan --sku F1
az webapp create -g graph-sync-demo -n demo-webapp-graphsync --plan demo-plan
```

Between them these exercise all three edge-discovery paths.

## Still open

- **Ownership tags.** `readTeamOwnership` checks `team`, `owner`, `domain` and `managed-by`. Candidates worth adding: `cost-center`, `environment`, and `app`/`application` as a natural system grouping.
- **Namespace for multi-subscription sync.** `AzureMappingOptions.namespace` is wired through but unused by the UI. It exists to prevent node id collisions when syncing more than one subscription, and would be a natural grouping key for layout.
- **Further `_ref_` candidates.** `properties.dnsSettings.fqdn` for public IPs and Traffic Manager, and `properties.containerRegistryId` for AKS, are documented properties nothing has needed yet.

Expanding `inferC4Type` and projecting the Container App environment reference were both previously listed here as future work. Both shipped in ADR-017.
