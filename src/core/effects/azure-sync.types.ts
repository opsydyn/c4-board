export type AzureRelationshipType =
  | "depends_on"
  | "network_link"
  | "data_link"
  | "identity_link"
  | "inferred";

export type AzureRelationshipConfidence = "high" | "medium" | "low";

export interface AzureSyncScope {
  subscriptionIds: readonly string[];
  resourceGroups?: readonly string[];
  tagFilters?: Readonly<Record<string, string>>;
  query?: string;
}

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
    return `azure:${namespace}:${normalized}`;
  }
  return `azure:${normalized}`;
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
    return `azure-edge:${namespace}:${hash}`;
  }
  return `azure-edge:${hash}`;
};
