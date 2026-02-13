import type { AzureGraphSnapshot, AzureRelationshipSnapshot, AzureResourceSnapshot } from "./azure-sync.types";
import { normalizeAzureResourceId, toAzureEdgeId, toAzureNodeId } from "./azure-sync.types";

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

const mapResource = (
  resource: AzureResourceSnapshot,
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
  const nodes = snapshot.resources.map((resource) => mapResource(resource, options));
  const validNodeIds = new Set(nodes.map((node) => node.id));

  const edges = snapshot.relationships
    .map((relationship) => mapRelationship(relationship, validNodeIds, options))
    .filter((edge): edge is AzureMappedEdge => edge !== null);

  return {
    nodes,
    edges,
  };
};
