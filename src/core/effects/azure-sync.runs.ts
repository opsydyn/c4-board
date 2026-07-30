/**
 * Azure sync run history (ADR-020 Phase 2).
 *
 * Before this, nothing about a sync was recorded. The run id, scope, deltas and
 * warnings lived in React state and died with the component, so the Settings
 * audit had no sync history to show and OPY's Azure evidence existed only when
 * the operator happened to have the panel open in the same session.
 *
 * A run record is an audit trail, not a cache. It stores counts and scope, not
 * the snapshot — the board and the pre-apply checkpoint already hold the data.
 */

import { Effect } from "effect";
import { DatabaseService } from "./database.base";

export type AzureSyncRunStatus = "planned" | "applied" | "blocked" | "failed";

export interface AzureSyncRunRecord {
  readonly id: string;
  readonly diagramId: string | null;
  readonly subscriptionIds: ReadonlyArray<string>;
  readonly resourceGroups: ReadonlyArray<string>;
  readonly tagFilters: Readonly<Record<string, string>>;
  /**
   * Whether operator-authored KQL replaced the default projection.
   *
   * The query text itself is never stored. It is operator input that can carry
   * anything they typed, and the audit only needs to know the default
   * projection — and with it the relationship extraction — was replaced.
   */
  readonly usedCustomQuery: boolean;
  readonly status: AzureSyncRunStatus;
  readonly resourceCount: number;
  readonly relationshipCount: number;
  readonly nodesCreated: number;
  readonly nodesUpdated: number;
  readonly nodesArchived: number;
  /** Kept distinct from archived: what a retention default spared. */
  readonly nodesRetained: number;
  readonly edgesCreated: number;
  readonly edgesUpdated: number;
  readonly edgesArchived: number;
  readonly edgesRetained: number;
  readonly truncated: boolean;
  readonly warnings: ReadonlyArray<string>;
  readonly blockedReasons: ReadonlyArray<string>;
  readonly checkpointId: string | null;
  readonly errorSummary: string | null;
  readonly collectedAt: number;
  readonly createdAt: number;
}

interface AzureSyncRunRow {
  id: string;
  diagramId: string | null;
  subscriptionIdsJson: string;
  resourceGroupsJson: string;
  tagFiltersJson: string;
  usedCustomQuery: number;
  status: string;
  resourceCount: number;
  relationshipCount: number;
  nodesCreated: number;
  nodesUpdated: number;
  nodesArchived: number;
  nodesRetained: number;
  edgesCreated: number;
  edgesUpdated: number;
  edgesArchived: number;
  edgesRetained: number;
  truncated: number;
  warningsJson: string;
  blockedReasonsJson: string | null;
  checkpointId: string | null;
  errorSummary: string | null;
  collectedAt: number;
  createdAt: number;
}

const INSERT_RUN_SQL = `
  INSERT INTO azure_sync_runs (
    id, diagram_id,
    subscription_ids_json, resource_groups_json, tag_filters_json, used_custom_query,
    status, resource_count, relationship_count,
    nodes_created, nodes_updated, nodes_archived, nodes_retained,
    edges_created, edges_updated, edges_archived, edges_retained,
    truncated, warnings_json, blocked_reasons_json,
    checkpoint_id, error_summary, collected_at, created_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const LIST_RUNS_SQL = `
  SELECT
    id,
    diagram_id AS diagramId,
    subscription_ids_json AS subscriptionIdsJson,
    resource_groups_json AS resourceGroupsJson,
    tag_filters_json AS tagFiltersJson,
    used_custom_query AS usedCustomQuery,
    status,
    resource_count AS resourceCount,
    relationship_count AS relationshipCount,
    nodes_created AS nodesCreated,
    nodes_updated AS nodesUpdated,
    nodes_archived AS nodesArchived,
    nodes_retained AS nodesRetained,
    edges_created AS edgesCreated,
    edges_updated AS edgesUpdated,
    edges_archived AS edgesArchived,
    edges_retained AS edgesRetained,
    truncated,
    warnings_json AS warningsJson,
    blocked_reasons_json AS blockedReasonsJson,
    checkpoint_id AS checkpointId,
    error_summary AS errorSummary,
    collected_at AS collectedAt,
    created_at AS createdAt
  FROM azure_sync_runs
  ORDER BY created_at DESC
`;

const isStatus = (value: string): value is AzureSyncRunStatus =>
  value === "planned" || value === "applied" || value === "blocked" || value === "failed";

const parseStringArray = (json: string | null): ReadonlyArray<string> | null => {
  if (json === null) {
    return [];
  }

  try {
    const parsed = JSON.parse(json) as unknown;
    return Array.isArray(parsed) && parsed.every((entry) => typeof entry === "string")
      ? parsed
      : null;
  } catch {
    return null;
  }
};

const parseTagFilters = (json: string): Readonly<Record<string, string>> | null => {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return Object.values(parsed).every((value) => typeof value === "string")
      ? parsed as Record<string, string>
      : null;
  } catch {
    return null;
  }
};

/**
 * Returns `null` for a row that will not decode.
 *
 * A run whose scope is unreadable is dropped rather than reported with an empty
 * scope, which would read as "we synced everything" — the opposite of the truth.
 */
const decodeRunRow = (row: AzureSyncRunRow): AzureSyncRunRecord | null => {
  const subscriptionIds = parseStringArray(row.subscriptionIdsJson);
  const resourceGroups = parseStringArray(row.resourceGroupsJson);
  const warnings = parseStringArray(row.warningsJson);
  const blockedReasons = parseStringArray(row.blockedReasonsJson);
  const tagFilters = parseTagFilters(row.tagFiltersJson);

  if (
    subscriptionIds === null || resourceGroups === null || warnings === null
    || blockedReasons === null || tagFilters === null || !isStatus(row.status)
  ) {
    return null;
  }

  return {
    id: row.id,
    diagramId: row.diagramId,
    subscriptionIds,
    resourceGroups,
    tagFilters,
    usedCustomQuery: row.usedCustomQuery === 1,
    status: row.status,
    resourceCount: row.resourceCount,
    relationshipCount: row.relationshipCount,
    nodesCreated: row.nodesCreated,
    nodesUpdated: row.nodesUpdated,
    nodesArchived: row.nodesArchived,
    nodesRetained: row.nodesRetained,
    edgesCreated: row.edgesCreated,
    edgesUpdated: row.edgesUpdated,
    edgesArchived: row.edgesArchived,
    edgesRetained: row.edgesRetained,
    truncated: row.truncated === 1,
    warnings,
    blockedReasons,
    checkpointId: row.checkpointId,
    errorSummary: row.errorSummary,
    collectedAt: row.collectedAt,
    createdAt: row.createdAt,
  };
};

export const recordAzureSyncRun = (run: AzureSyncRunRecord) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    yield* service.execute(INSERT_RUN_SQL, [
      run.id,
      run.diagramId,
      JSON.stringify(run.subscriptionIds),
      JSON.stringify(run.resourceGroups),
      JSON.stringify(run.tagFilters),
      run.usedCustomQuery ? 1 : 0,
      run.status,
      run.resourceCount,
      run.relationshipCount,
      run.nodesCreated,
      run.nodesUpdated,
      run.nodesArchived,
      run.nodesRetained,
      run.edgesCreated,
      run.edgesUpdated,
      run.edgesArchived,
      run.edgesRetained,
      run.truncated ? 1 : 0,
      JSON.stringify(run.warnings),
      JSON.stringify(run.blockedReasons),
      run.checkpointId,
      run.errorSummary,
      run.collectedAt,
      run.createdAt,
    ]);

    return run;
  });

export const listAzureSyncRuns = () =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    const rows = yield* service.query<AzureSyncRunRow>(LIST_RUNS_SQL);

    return rows
      .map(decodeRunRow)
      .filter((row): row is AzureSyncRunRecord => row !== null)
      .sort((left, right) => right.createdAt - left.createdAt);
  });
