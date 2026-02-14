export type AzureRelationshipType =
  | "depends_on"
  | "network_link"
  | "data_link"
  | "identity_link"
  | "inferred";

export type AzureRelationshipConfidence = "high" | "medium" | "low";
export type AzureRelationshipSource =
  | "arm_depends_on"
  | "property_ref"
  | "arm_parent"
  | "inferred";

export interface AzureSyncScope {
  subscriptionIds: readonly string[];
  resourceGroups?: readonly string[];
  tagFilters?: Readonly<Record<string, string>>;
  query?: string;
}

export const AZURE_RESOURCE_NODE_PREFIX = "azure:";
export const AZURE_RESOURCE_GROUP_NODE_PREFIX = "azure-rg:";
export const AZURE_EDGE_PREFIX = "azure-edge:";

export const isAzureNodeId = (id: string): boolean =>
  id.startsWith(AZURE_RESOURCE_NODE_PREFIX)
  || id.startsWith(AZURE_RESOURCE_GROUP_NODE_PREFIX);

export const isAzureEdgeId = (id: string): boolean => id.startsWith(AZURE_EDGE_PREFIX);

export interface AzureResourceSnapshot {
  resourceId: string;
  type: string;
  name: string;
  location?: string;
  subscriptionId: string;
  resourceGroup?: string;
  tags: Readonly<Record<string, string>>;
  dependsOn?: readonly string[];
  raw?: unknown;
}

export interface AzureRelationshipSnapshot {
  fromResourceId: string;
  toResourceId: string;
  relationshipType: AzureRelationshipType;
  confidence: AzureRelationshipConfidence;
  source: AzureRelationshipSource;
  sourceDetail?: string;
}

export interface AzureGraphSnapshot {
  collectedAt: number;
  scope: AzureSyncScope;
  resources: readonly AzureResourceSnapshot[];
  relationships: readonly AzureRelationshipSnapshot[];
  warnings: readonly string[];
}

export interface AzureSyncDelta {
  nodesToCreate: number;
  nodesToUpdate: number;
  nodesToArchive: number;
  edgesToCreate: number;
  edgesToUpdate: number;
  edgesToArchive: number;
}

export interface AzureSyncResult {
  runId: string;
  status: "planned" | "applied" | "aborted" | "failed";
  delta: AzureSyncDelta;
  warnings: readonly string[];
  errors: readonly string[];
}

export interface AzureAuthStatus {
  available: boolean;
  authenticated: boolean;
  strategy: string;
  details?: string;
}

export const normalizeAzureResourceId = (resourceId: string): string => resourceId.trim().toLowerCase();

export const toAzureNodeId = (resourceId: string, namespace?: string): string => {
  const normalized = normalizeAzureResourceId(resourceId);
  if (namespace && namespace.trim().length > 0) {
    return `${AZURE_RESOURCE_NODE_PREFIX}${namespace}:${normalized}`;
  }
  return `${AZURE_RESOURCE_NODE_PREFIX}${normalized}`;
};

export const toAzureResourceGroupResourceId = (
  subscriptionId: string,
  resourceGroup: string,
): string =>
  `/subscriptions/${subscriptionId.trim().toLowerCase()}/resourcegroups/${resourceGroup.trim().toLowerCase()}`;

export const toAzureResourceGroupNodeId = (
  subscriptionId: string,
  resourceGroup: string,
  namespace?: string,
): string => {
  const resourceGroupResourceId = normalizeAzureResourceId(
    toAzureResourceGroupResourceId(subscriptionId, resourceGroup),
  );
  if (namespace && namespace.trim().length > 0) {
    return `${AZURE_RESOURCE_GROUP_NODE_PREFIX}${namespace}:${resourceGroupResourceId}`;
  }
  return `${AZURE_RESOURCE_GROUP_NODE_PREFIX}${resourceGroupResourceId}`;
};

const hashFNV1a32 = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
};

export const toAzureEdgeId = (
  fromResourceId: string,
  toResourceId: string,
  relationshipType: AzureRelationshipType,
  namespace?: string,
): string => {
  const from = normalizeAzureResourceId(fromResourceId);
  const to = normalizeAzureResourceId(toResourceId);
  const hash = hashFNV1a32(`${from}|${to}|${relationshipType}`);
  if (namespace && namespace.trim().length > 0) {
    return `${AZURE_EDGE_PREFIX}${namespace}:${hash}`;
  }
  return `${AZURE_EDGE_PREFIX}${hash}`;
};
