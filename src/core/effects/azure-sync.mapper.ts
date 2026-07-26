import type {
  AzureGraphSnapshot,
  AzureRelationshipSnapshot,
  AzureRelationshipSource,
  AzureResourceSnapshot,
} from "./azure-sync.types";
import {
  normalizeAzureResourceId,
  toAzureEdgeId,
  toAzureNodeId,
  toAzureResourceGroupNodeId,
  toAzureResourceGroupResourceId,
} from "./azure-sync.types";

export type AzureMappedC4Type =
  | "person"
  | "system"
  | "externalSystem"
  | "container"
  | "component";

export interface AzureMappedNode {
  id: string;
  type: AzureMappedC4Type;
  label: string;
  technology: string;
  description: string;
  sourceResourceId: string;
  sourceResourceType: string;
  parentGroupId?: string;
  isSyntheticContainer?: boolean;
  teamOwnership?: string;
}

export interface AzureMappedEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  relationshipType: string;
  confidence: string;
  provenanceSource: AzureRelationshipSource;
  provenanceDetail?: string;
}

export interface AzureMappedGraph {
  nodes: readonly AzureMappedNode[];
  edges: readonly AzureMappedEdge[];
}

export interface AzureMappingOptions {
  namespace?: string;
}

const normalizeType = (azureType: string): string => azureType.trim().toLowerCase();

/**
 * Azure resource type to C4 type. ADR-017.
 *
 * Exact keys, not substring tests. The previous implementation asked whether the
 * type *contained* `microsoft.web/sites`, which quietly fails for
 * `microsoft.web/staticsites` — a different resource whose name happens not to
 * contain the other. Exact lookup makes a miss a miss rather than a wrong answer.
 *
 * The shape of the judgement: a boundary other things run inside is a container,
 * something that runs or acts is a component, a publicly reachable surface is an
 * externalSystem, and a top-level platform is a system.
 */
const C4_TYPE_BY_AZURE_TYPE: Readonly<Record<string, AzureMappedC4Type>> = {
  // Boundaries and stores.
  "microsoft.app/managedenvironments": "container",
  "microsoft.compute/virtualmachines": "container",
  "microsoft.containerregistry/registries": "container",
  "microsoft.network/virtualnetworks": "container",
  "microsoft.operationalinsights/workspaces": "container",
  "microsoft.storage/storageaccounts": "container",

  // Things that run or act.
  "microsoft.app/containerapps": "component",
  "microsoft.dashboard/grafana": "component",
  "microsoft.insights/actiongroups": "component",
  "microsoft.insights/components": "component",
  "microsoft.managedidentity/userassignedidentities": "component",
  "microsoft.network/networkwatchers": "component",
  "microsoft.portal/dashboards": "component",
  "microsoft.web/sites": "component",

  // Reachable from outside the boundary.
  "microsoft.bing/accounts": "externalSystem",
  "microsoft.web/staticsites": "externalSystem",

  // Top-level platforms.
  "microsoft.cognitiveservices/accounts": "system",
  "microsoft.containerservice/managedclusters": "system",
};

/**
 * Provider namespace to C4 type. ADR-017, second tier.
 *
 * `az provider list` reports 4,654 resource types across 316 providers, so an
 * exact table covering 19 of them can never be the primary mechanism. The
 * namespace carries most of the signal — anything under `microsoft.keyvault` or
 * `microsoft.cache` is a store regardless of its leaf name — which turns a few
 * entries here into coverage across whole product families.
 *
 * Consulted only when the exact table has no entry, so a specific override
 * (a vnet inside the component-leaning network namespace) still wins.
 */
const C4_TYPE_BY_PROVIDER: Readonly<Record<string, AzureMappedC4Type>> = {
  // Stores and boundaries.
  "microsoft.cache": "container",
  "microsoft.compute": "container",
  "microsoft.containerregistry": "container",
  "microsoft.dbformariadb": "container",
  "microsoft.dbformysql": "container",
  "microsoft.dbforpostgresql": "container",
  "microsoft.documentdb": "container",
  "microsoft.eventhub": "container",
  "microsoft.keyvault": "container",
  "microsoft.operationalinsights": "container",
  "microsoft.servicebus": "container",
  "microsoft.sql": "container",
  "microsoft.storage": "container",

  // Things that run or act.
  "microsoft.app": "component",
  "microsoft.dashboard": "component",
  "microsoft.eventgrid": "component",
  "microsoft.insights": "component",
  "microsoft.logic": "component",
  "microsoft.managedidentity": "component",
  "microsoft.network": "component",
  "microsoft.portal": "component",
  "microsoft.web": "component",

  // Platforms other things are built on.
  "microsoft.apimanagement": "system",
  "microsoft.cognitiveservices": "system",
  "microsoft.containerservice": "system",
};

/**
 * Three tiers, most specific first: the exact type, then its provider namespace,
 * then shape. The shape tier only runs for providers nothing here has an opinion
 * on — a nested type (`provider/type/child`) lives inside something else and
 * reads as a component, a top-level type reads as a system.
 *
 * Documented in the Azure sync guide so a reader can predict what an unmapped
 * resource will look like without reading this file.
 */
const inferC4Type = (azureType: string): AzureMappedC4Type => {
  const normalized = normalizeType(azureType);

  const exact = C4_TYPE_BY_AZURE_TYPE[normalized];
  if (exact) {
    return exact;
  }

  const provider = normalized.split("/")[0];
  const byProvider = provider ? C4_TYPE_BY_PROVIDER[provider] : undefined;
  if (byProvider) {
    return byProvider;
  }

  // `provider/type` is top level; `provider/type/child` is nested.
  return normalized.split("/").length > 2 ? "component" : "system";
};

const readTeamOwnership = (tags: Readonly<Record<string, string>>): string | undefined => {
  const keys = ["team", "owner", "domain", "managed-by"];
  for (const key of keys) {
    const value = tags[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
};

const RESOURCE_GROUP_RESOURCE_TYPE = "microsoft.resources/subscriptions/resourcegroups";

const isResourceGroupType = (azureType: string): boolean => normalizeType(azureType) === RESOURCE_GROUP_RESOURCE_TYPE;

interface ResourceGroupDescriptor {
  id: string;
  sourceResourceId: string;
  sourceResourceType: string;
  subscriptionId: string;
  resourceGroup: string;
}

const toResourceGroupKey = (
  subscriptionId: string,
  resourceGroup: string,
): string => `${subscriptionId.trim().toLowerCase()}::${resourceGroup.trim().toLowerCase()}`;

const toResourceGroupDescriptor = (
  resource: AzureResourceSnapshot,
  options?: AzureMappingOptions,
): ResourceGroupDescriptor | null => {
  const resourceGroup = resource.resourceGroup?.trim();
  const subscriptionId = resource.subscriptionId.trim();
  if (!resourceGroup || subscriptionId.length === 0) {
    return null;
  }

  return {
    id: toAzureResourceGroupNodeId(subscriptionId, resourceGroup, options?.namespace),
    sourceResourceId: normalizeAzureResourceId(
      toAzureResourceGroupResourceId(subscriptionId, resourceGroup),
    ),
    sourceResourceType: RESOURCE_GROUP_RESOURCE_TYPE,
    subscriptionId,
    resourceGroup,
  };
};

const mapResourceGroupContainer = (
  descriptor: ResourceGroupDescriptor,
  teamOwnership?: string,
): AzureMappedNode => ({
  id: descriptor.id,
  type: "container",
  label: descriptor.resourceGroup,
  technology: "azure:resource-group",
  description: `resource group @ subscription ${descriptor.subscriptionId.toLowerCase()}`,
  sourceResourceId: descriptor.sourceResourceId,
  sourceResourceType: descriptor.sourceResourceType,
  isSyntheticContainer: true,
  ...(teamOwnership ? { teamOwnership } : {}),
});

const mapResource = (
  resource: AzureResourceSnapshot,
  parentGroupId: string | undefined,
  options?: AzureMappingOptions,
): AzureMappedNode => {
  const normalizedResourceId = normalizeAzureResourceId(resource.resourceId);
  const resourceType = normalizeType(resource.type);
  const technology = resourceType.length > 0 ? resourceType : "azure:resource";
  const teamOwnership = readTeamOwnership(resource.tags);

  return {
    id: toAzureNodeId(normalizedResourceId, options?.namespace),
    type: inferC4Type(resourceType),
    label: resource.name,
    technology,
    description: resource.location
      ? `${resourceType} @ ${resource.location}`
      : resourceType,
    sourceResourceId: normalizedResourceId,
    sourceResourceType: resourceType,
    ...(parentGroupId ? { parentGroupId } : {}),
    ...(teamOwnership ? { teamOwnership } : {}),
  };
};

const mapRelationship = (
  relationship: AzureRelationshipSnapshot,
  validNodeIds: ReadonlySet<string>,
  options?: AzureMappingOptions,
): AzureMappedEdge | null => {
  const source = toAzureNodeId(relationship.fromResourceId, options?.namespace);
  const target = toAzureNodeId(relationship.toResourceId, options?.namespace);

  if (!validNodeIds.has(source) || !validNodeIds.has(target)) {
    return null;
  }

  return {
    id: toAzureEdgeId(
      relationship.fromResourceId,
      relationship.toResourceId,
      relationship.relationshipType,
      options?.namespace,
    ),
    source,
    target,
    label: relationship.relationshipType,
    relationshipType: relationship.relationshipType,
    confidence: relationship.confidence,
    provenanceSource: relationship.source,
    ...(relationship.sourceDetail ? { provenanceDetail: relationship.sourceDetail } : {}),
  };
};

export const mapAzureSnapshotToC4Graph = (
  snapshot: AzureGraphSnapshot,
  options?: AzureMappingOptions,
): AzureMappedGraph => {
  const resourceGroupDescriptorsByKey = new Map<string, ResourceGroupDescriptor>();
  const resourceGroupOwnership = new Map<string, string>();

  for (const resource of snapshot.resources) {
    const descriptor = toResourceGroupDescriptor(resource, options);
    if (!descriptor) {
      continue;
    }

    const key = toResourceGroupKey(
      descriptor.subscriptionId,
      descriptor.resourceGroup,
    );
    if (!resourceGroupDescriptorsByKey.has(key)) {
      resourceGroupDescriptorsByKey.set(key, descriptor);
    }

    if (!resourceGroupOwnership.has(key)) {
      const teamOwnership = readTeamOwnership(resource.tags);
      if (teamOwnership) {
        resourceGroupOwnership.set(key, teamOwnership);
      }
    }
  }

  const groupNodes = [...resourceGroupDescriptorsByKey.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, descriptor]) => mapResourceGroupContainer(descriptor, resourceGroupOwnership.get(key)));

  const resourceNodes = snapshot.resources
    .filter((resource) => !isResourceGroupType(resource.type))
    .map((resource) => {
      const descriptor = toResourceGroupDescriptor(resource, options);
      const parentGroupId = descriptor?.id;
      return mapResource(resource, parentGroupId, options);
    });

  const nodes = [...groupNodes, ...resourceNodes];
  const validNodeIds = new Set(nodes.map((node) => node.id));

  const edges = snapshot.relationships
    .map((relationship) => mapRelationship(relationship, validNodeIds, options))
    .filter((edge): edge is AzureMappedEdge => edge !== null);

  return {
    nodes,
    edges,
  };
};
