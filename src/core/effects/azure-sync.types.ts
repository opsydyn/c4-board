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

/**
 * The dry-run fingerprint — one projection, used by both sides of the diff.
 *
 * Before this existed, the panel fingerprinted board nodes over
 * `{type, width, height, position, data}` while the runtime fingerprinted mapper
 * output over a different set entirely. The two could never be equal, so every
 * surviving node reported as an update and `unchanged` was always empty. The
 * numbers an operator reviewed before a destructive apply were not real.
 *
 * Two rules keep this honest, and both are load-bearing:
 *
 * 1. **Only fields that survive a save.** Provenance written by the apply merge
 *    (`sourceResourceId`, `sourceResourceType`, `lastSyncedAt`) has no columns
 *    in the `nodes` table and is dropped on write. Fingerprinting it would make
 *    every node drift the moment the board reloaded.
 * 2. **Nothing the operator owns.** Position and size are theirs to change;
 *    Azure has no opinion on them. Including them would report a dragged node
 *    as a change Azure wants to make.
 *
 * `sourceResourceId` is absent for a third reason: it is already encoded in the
 * node id, which is what the diff matches on, so fingerprinting it would be
 * asking the same question twice.
 *
 * The edge projection is deliberately thin — `relationshipType`, `confidence`,
 * and provenance are dropped at save too, so a confidence downgrade is
 * currently invisible to the diff. Widen this once those are persisted.
 */

/** Absent, null, and empty string all mean "not set" once a row round-trips. */
const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const stableFingerprint = (fields: ReadonlyArray<readonly [string, string]>): string =>
  JSON.stringify(Object.fromEntries([...fields].sort(([a], [b]) => a.localeCompare(b))));

interface AzureFingerprintableNode {
  readonly type?: string | undefined;
  readonly parentId?: string | undefined;
  readonly data?: unknown;
}

interface AzureFingerprintableEdge {
  readonly source: string;
  readonly target: string;
  readonly label?: unknown;
}

interface AzureFingerprintableMappedNode {
  readonly type: string;
  readonly label: string;
  readonly technology: string;
  readonly description: string;
  readonly parentGroupId?: string | undefined;
  readonly teamOwnership?: string | undefined;
}

interface AzureFingerprintableMappedEdge {
  readonly source: string;
  readonly target: string;
  readonly label: string;
}

/** Fingerprints a node as the mapper produced it. */
export const fingerprintAzureMappedNode = (node: AzureFingerprintableMappedNode): string =>
  stableFingerprint([
    ["type", text(node.type)],
    ["label", text(node.label)],
    ["technology", text(node.technology)],
    ["description", text(node.description)],
    ["parentGroupId", text(node.parentGroupId)],
    ["teamOwnership", text(node.teamOwnership)],
  ]);

/** Fingerprints the same node as it exists on the board, after a save and load. */
export const fingerprintAzureBoardNode = (node: AzureFingerprintableNode): string => {
  const data = (typeof node.data === "object" && node.data !== null ? node.data : {}) as Record<string, unknown>;

  return stableFingerprint([
    // `reactFlowNodeToDb` resolves the stored type from `node.type` first and
    // falls back to `data.c4Type`, so read them in the same order here.
    ["type", text(node.type) || text(data.c4Type)],
    ["label", text(data.label)],
    ["technology", text(data.technology)],
    ["description", text(data.description)],
    ["parentGroupId", text(node.parentId)],
    ["teamOwnership", text(data.teamOwnership)],
  ]);
};

export const fingerprintAzureMappedEdge = (edge: AzureFingerprintableMappedEdge): string =>
  stableFingerprint([
    ["source", text(edge.source)],
    ["target", text(edge.target)],
    ["label", text(edge.label)],
  ]);

export const fingerprintAzureBoardEdge = (edge: AzureFingerprintableEdge): string =>
  stableFingerprint([
    ["source", text(edge.source)],
    ["target", text(edge.target)],
    ["label", text(edge.label)],
  ]);
