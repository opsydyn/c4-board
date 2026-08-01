/**
 * OPY's Azure read tools (Gate 5).
 *
 * The Azure roadmap asks that OPY be able to *cite* Azure resources. It could
 * not. Citations are produced only by read-tool results, no Azure read tool
 * existed, and the single Azure document in retrieval was a counts-only summary
 * built from live panel state — so it existed only if the operator had the panel
 * open in that session, and never survived a reload.
 *
 * These tools read what now persists: board nodes carrying Azure provenance
 * (migration 039) and the sync run trail (migration 040). They are pure over
 * that input, so what OPY is told and what an operator can check are the same
 * data.
 *
 * Read-only by construction. There is no Azure mutation path here and this
 * module is not the place to add one — ADR-018 keeps Azure writes out of scope
 * entirely.
 */

import type { Edge, Node } from "@xyflow/react";
import type { AzureSyncRunRecord } from "../azure-sync.runs";
import { isAzureNodeId } from "../azure-sync.types";
import type { RedactionMode } from "../settings.types";

export type RigAzureToolName = "azure_resource_lookup" | "azure_sync_summary";

export interface RigAzureToolContext {
  readonly nodes: ReadonlyArray<Node>;
  /** Needed for directional grounding facts, not by the lookup tools. */
  readonly edges: ReadonlyArray<Edge>;
  readonly runs: ReadonlyArray<AzureSyncRunRecord>;
}

export interface AzureResourceMatch {
  readonly nodeId: string;
  readonly label: string;
  readonly resourceId: string | null;
  readonly resourceType: string | null;
  readonly lastSyncedAt: number | null;
}

export interface AzureResourceLookupResult {
  readonly found: boolean;
  readonly query: string | null;
  /** Every Azure-derived node on the board, matched or not. */
  readonly totalAzureNodes: number;
  readonly matches: ReadonlyArray<AzureResourceMatch>;
}

export interface AzureSyncRunSummary {
  readonly runId: string;
  readonly status: AzureSyncRunRecord["status"];
  readonly resourceCount: number;
  readonly relationshipCount: number;
  readonly nodesCreated: number;
  readonly nodesUpdated: number;
  readonly nodesArchived: number;
  readonly nodesRetained: number;
  readonly truncated: boolean;
  readonly warningCount: number;
  readonly collectedAt: number;
}

export interface AzureSyncSummaryResult {
  /**
   * Whether any sync has ever run.
   *
   * Kept apart from an empty result: a board that has never synced is not a
   * board whose estate is empty, and answering "there is nothing in Azure" to
   * the first would be wrong.
   */
  readonly hasSynced: boolean;
  readonly lastRun: AzureSyncRunSummary | null;
  readonly runCount: number;
}

/** Maximum matches returned, so a large estate cannot flood the prompt. */
const MAX_MATCHES = 12;

const text = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readNodeData = (node: Node): Record<string, unknown> =>
  typeof node.data === "object" && node.data !== null ? node.data as Record<string, unknown> : {};

/**
 * An Azure-derived node.
 *
 * Persisted provenance is the authority; the `azure:` id prefix is a fallback
 * for nodes synced before migration 039, which carry the prefix but no columns.
 */
const isAzureDerived = (node: Node): boolean =>
  text(readNodeData(node).sourceProvider) === "azure" || isAzureNodeId(node.id);

const toMatch = (node: Node): AzureResourceMatch => {
  const data = readNodeData(node);
  const lastSyncedAt = data.lastSyncedAt;

  return {
    nodeId: node.id,
    label: text(data.label) ?? node.id,
    resourceId: text(data.sourceResourceId),
    resourceType: text(data.sourceResourceType),
    lastSyncedAt: typeof lastSyncedAt === "number" && Number.isFinite(lastSyncedAt)
      ? lastSyncedAt
      : null,
  };
};

const matchesQuery = (match: AzureResourceMatch, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) {
    return true;
  }

  return [match.label, match.resourceId, match.resourceType, match.nodeId]
    .some((field) => field !== null && field.toLowerCase().includes(needle));
};

/**
 * Finds Azure-derived board nodes, optionally narrowed by a query.
 *
 * The query is matched against label, resource id, and resource type, because
 * an operator may ask by any of them — a name they recognise, an ARM id pasted
 * from the portal, or a class of resource.
 */
export const azureResourceLookup = (
  input: { readonly query: string | null },
  context: RigAzureToolContext,
): AzureResourceLookupResult => {
  const azureNodes = context.nodes.filter(isAzureDerived).map(toMatch);
  const query = text(input.query);

  const matches = (query === null ? azureNodes : azureNodes.filter((match) => matchesQuery(match, query)))
    .slice(0, MAX_MATCHES);

  return {
    found: matches.length > 0,
    query,
    totalAzureNodes: azureNodes.length,
    matches,
  };
};

/** Reports the most recent sync, and whether one has ever happened. */
export const azureSyncSummary = (
  _input: Record<string, never>,
  context: RigAzureToolContext,
): AzureSyncSummaryResult => {
  const latest = [...context.runs].sort((left, right) => right.createdAt - left.createdAt)[0];

  return {
    hasSynced: context.runs.length > 0,
    runCount: context.runs.length,
    lastRun: latest === undefined ? null : {
      runId: latest.id,
      status: latest.status,
      resourceCount: latest.resourceCount,
      relationshipCount: latest.relationshipCount,
      nodesCreated: latest.nodesCreated,
      nodesUpdated: latest.nodesUpdated,
      nodesArchived: latest.nodesArchived,
      nodesRetained: latest.nodesRetained,
      truncated: latest.truncated,
      warningCount: latest.warnings.length,
      collectedAt: latest.collectedAt,
    },
  };
};

export interface RigAzureCitation {
  readonly id: string;
  readonly tool: RigAzureToolName;
  readonly label: string;
  readonly detail: string;
  readonly sourceId: string | null;
}

/**
 * A citation survives redaction even when the identifier does not.
 *
 * The citation is what lets an operator check a claim. Dropping it under strict
 * redaction would leave the claim standing with nothing behind it, which is
 * worse than a citation that names a resource without its ARM id.
 */
export const buildAzureResourceCitation = (
  result: AzureResourceLookupResult,
  redactionMode: RedactionMode,
): RigAzureCitation | null => {
  const first = result.matches[0];
  if (first === undefined) {
    return null;
  }

  const others = result.matches.length - 1;

  return {
    id: `azure-resource:${first.nodeId}`,
    tool: "azure_resource_lookup",
    label: first.label,
    detail: [
      first.resourceType ?? "unknown type",
      others > 0
        ? `+${others} more of ${result.totalAzureNodes} Azure nodes`
        : `of ${result.totalAzureNodes} Azure nodes`,
    ].join(" · "),
    sourceId: redactionMode === "off" ? first.resourceId : null,
  };
};

export const buildAzureSyncCitation = (
  result: AzureSyncSummaryResult,
  redactionMode: RedactionMode,
): RigAzureCitation | null => {
  const run = result.lastRun;
  if (run === null) {
    return null;
  }

  return {
    id: `azure-sync-run:${run.runId}`,
    tool: "azure_sync_summary",
    label: `AZURE SYNC ${run.status.toUpperCase()}`,
    detail: [
      `${run.resourceCount} resources`,
      `${run.relationshipCount} links`,
      run.nodesRetained > 0 ? `${run.nodesRetained} retained` : null,
      run.truncated ? "TRUNCATED" : null,
    ].filter((part): part is string => part !== null).join(" · "),
    sourceId: redactionMode === "off" ? run.runId : null,
  };
};
