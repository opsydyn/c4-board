/**
 * Facts about the board that OPY must not have to work out.
 *
 * Asked what was in Azure on a board, OPY answered "41 nodes, planetnik-env is
 * dependent on planetnik-runtime". The board had 19 Azure nodes, and the
 * dependency runs the other way — the container app carries `environmentId`
 * pointing at the environment, which is how Azure records it and how the board
 * stores it.
 *
 * Neither error was a retrieval failure. Both were facts held exactly, handed
 * over as a node list, and reconstructed wrongly in prose. The fix is not a
 * better detector: it is to stop asking prose to carry them. Counts are stated
 * as counts, and every relationship is written out with its direction in words,
 * because an arrow is precisely what got inverted.
 *
 * Pure. The same function feeds the prompt and can back a rendered panel, so
 * what the model is told and what an operator is shown cannot drift apart.
 */

import type { Edge, Node } from "@xyflow/react";
import { isAzureEdgeId, isAzureNodeId } from "./azure-sync.types";

export interface AzureGroundingNodeFact {
  readonly nodeId: string;
  readonly label: string;
  readonly resourceType: string | null;
  readonly incomingCount: number;
  readonly outgoingCount: number;
}

export interface AzureGroundingRelationshipFact {
  readonly fromLabel: string;
  readonly toLabel: string;
  readonly relationshipType: string;
  readonly confidence: string | null;
}

export interface AzureGroundingFacts {
  readonly boardNodeCount: number;
  readonly azureNodeCount: number;
  readonly azureEdgeCount: number;
  readonly nodes: ReadonlyArray<AzureGroundingNodeFact>;
  readonly relationships: ReadonlyArray<AzureGroundingRelationshipFact>;
}

/**
 * Caps on what is listed, not on what is counted.
 *
 * A truncated list must never become a wrong total — that would recreate the
 * exact bug this module exists to remove.
 */
const MAX_LISTED_NODES = 40;
const MAX_LISTED_RELATIONSHIPS = 40;

const readData = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? value as Record<string, unknown> : {};

const text = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const isAzureDerivedNode = (node: Node): boolean =>
  text(readData(node.data).sourceProvider) === "azure" || isAzureNodeId(node.id);

const isAzureDerivedEdge = (edge: Edge): boolean =>
  text(readData(edge.data).sourceProvider) === "azure" || isAzureEdgeId(edge.id);

export const buildAzureGroundingFacts = (input: {
  readonly nodes: ReadonlyArray<Node>;
  readonly edges: ReadonlyArray<Edge>;
}): AzureGroundingFacts => {
  const azureNodes = input.nodes.filter(isAzureDerivedNode);
  const azureNodeIds = new Set(azureNodes.map((node) => node.id));
  const azureEdges = input.edges.filter((edge) =>
    isAzureDerivedEdge(edge) && azureNodeIds.has(edge.source) && azureNodeIds.has(edge.target)
  );

  const labelById = new Map(
    azureNodes.map((node) => [node.id, text(readData(node.data).label) ?? node.id] as const),
  );

  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  for (const edge of azureEdges) {
    outgoing.set(edge.source, (outgoing.get(edge.source) ?? 0) + 1);
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
  }

  const nodes = azureNodes.map((node): AzureGroundingNodeFact => ({
    nodeId: node.id,
    label: labelById.get(node.id) ?? node.id,
    resourceType: text(readData(node.data).sourceResourceType),
    incomingCount: incoming.get(node.id) ?? 0,
    outgoingCount: outgoing.get(node.id) ?? 0,
  }));

  const relationships = azureEdges.map((edge): AzureGroundingRelationshipFact => ({
    fromLabel: labelById.get(edge.source) ?? edge.source,
    toLabel: labelById.get(edge.target) ?? edge.target,
    relationshipType: text(readData(edge.data).relationshipType) ?? "depends_on",
    confidence: text(readData(edge.data).confidence),
  }));

  return {
    boardNodeCount: input.nodes.length,
    azureNodeCount: azureNodes.length,
    azureEdgeCount: azureEdges.length,
    nodes,
    relationships,
  };
};

/** Turns a relationship type into the direction, spelled out. */
const describeRelationship = (relationship: AzureGroundingRelationshipFact): string => {
  const verb = relationship.relationshipType === "data_link"
    ? "sends data to"
    : relationship.relationshipType === "network_link"
    ? "connects over the network to"
    : relationship.relationshipType === "identity_link"
    ? "authenticates through"
    : "depends on";

  return `${relationship.fromLabel} ${verb} ${relationship.toLabel}`;
};

export const formatGroundingFactsForPrompt = (facts: AzureGroundingFacts): string => {
  const listedNodes = facts.nodes.slice(0, MAX_LISTED_NODES);
  const listedRelationships = facts.relationships.slice(0, MAX_LISTED_RELATIONSHIPS);

  const lines: string[] = [
    "AZURE_FACTS::BEGIN",
    "These values are read directly from the board. They are the only counts and",
    "relationships you may state. DO NOT calculate, estimate, or infer any other",
    "figure, and DO NOT reverse the direction of a relationship below.",
    `BOARD_NODE_COUNT=${facts.boardNodeCount}`,
    `AZURE_NODE_COUNT=${facts.azureNodeCount}`,
    `AZURE_EDGE_COUNT=${facts.azureEdgeCount}`,
  ];

  if (listedNodes.length > 0) {
    lines.push("AZURE_NODES:");
    for (const node of listedNodes) {
      lines.push(
        `- ${node.label} (${node.resourceType ?? "unknown type"}) `
          + `links_in=${node.incomingCount} links_out=${node.outgoingCount}`,
      );
    }
    if (facts.nodes.length > listedNodes.length) {
      lines.push(
        `- ...${facts.nodes.length - listedNodes.length} further nodes not listed; `
          + `AZURE_NODE_COUNT above remains the true total.`,
      );
    }
  }

  if (listedRelationships.length > 0) {
    lines.push("AZURE_RELATIONSHIPS (direction is significant):");
    for (const relationship of listedRelationships) {
      lines.push(`- ${describeRelationship(relationship)}`);
    }
    if (facts.relationships.length > listedRelationships.length) {
      lines.push(
        `- ...${facts.relationships.length - listedRelationships.length} further relationships `
          + `not listed; AZURE_EDGE_COUNT above remains the true total.`,
      );
    }
  }

  lines.push("AZURE_FACTS::END");

  return lines.join("\n");
};
