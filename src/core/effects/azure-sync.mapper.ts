import type { AzureGraphSnapshot, AzureRelationshipSnapshot, AzureResourceSnapshot } from "./azure-sync.types";
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
}

export interface AzureMappedGraph {
  nodes: readonly AzureMappedNode[];
  edges: readonly AzureMappedEdge[];
}

export interface AzureMappingOptions {
  namespace?: string;
}

const normalizeType = (azureType: string): string => azureType.trim().toLowerCase();

const inferC4Type = (azureType: string): AzureMappedC4Type => {
  const normalized = normalizeType(azureType);

  if (normalized.includes("microsoft.network/virtualnetworks")) {
    return "container";
  }
  if (normalized.includes("microsoft.compute/virtualmachines")) {
    return "container";
  }
  if (normalized.includes("microsoft.web/sites")) {
    return "component";
  }
  if (normalized.includes("microsoft.containerservice/managedclusters")) {
    return "system";
  }

  return "system";
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
