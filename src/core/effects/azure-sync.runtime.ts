import { invoke } from "@tauri-apps/api/core";
import { Data, Effect, Schema } from "effect";
import { type AzureSyncDiffResult, type AzureSyncEntitySnapshot, diffAzureSyncEntities } from "./azure-sync.diff";
import {
  type AzureMappedEdge,
  type AzureMappedGraph,
  type AzureMappedNode,
  mapAzureSnapshotToC4Graph,
} from "./azure-sync.mapper";
import type {
  AzureAuthStatus,
  AzureGraphSnapshot,
  AzureRelationshipConfidence,
  AzureRelationshipSnapshot,
  AzureRelationshipType,
  AzureResourceSnapshot,
  AzureSyncResult,
  AzureSyncScope,
} from "./azure-sync.types";

export class AzureSyncRuntimeError extends Data.TaggedError("AzureSyncRuntimeError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

const toErrorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);

const toCauseMessage = (cause: unknown): string => {
  if (typeof cause === "string") {
    return cause;
  }
  if (cause instanceof Error) {
    return cause.message;
  }
  if (typeof cause === "object" && cause !== null && "message" in cause) {
    const withMessage = cause as { message?: unknown };
    if (typeof withMessage.message === "string") {
      return withMessage.message;
    }
  }
  return String(cause);
};

const toStringArray = (value: ReadonlyArray<string> | null | undefined): string[] =>
  (value ?? [])
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

const toTagMap = (
  value: Readonly<Record<string, string>> | null | undefined,
): Record<string, string> => {
  const tags: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value ?? {})) {
    const normalizedKey = key.trim();
    const normalizedValue = raw.trim();
    if (normalizedKey.length === 0 || normalizedValue.length === 0) {
      continue;
    }
    tags[normalizedKey] = normalizedValue;
  }
  return tags;
};

const firstNonEmptyString = (
  ...values: ReadonlyArray<string | null | undefined>
): string | null => {
  for (const value of values) {
    if (!value) {
      continue;
    }

    const normalized = value.trim();
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return null;
};

const firstStringArray = (
  ...values: ReadonlyArray<ReadonlyArray<string> | null | undefined>
): string[] => {
  for (const value of values) {
    const normalized = toStringArray(value);
    if (normalized.length > 0) {
      return normalized;
    }
  }
  return [];
};

const StringArraySchema = Schema.Array(Schema.String);
const StringRecordSchema = Schema.Record({
  key: Schema.String,
  value: Schema.String,
});

const AzureScopePayloadSchema = Schema.Struct({
  subscriptionIds: Schema.optional(Schema.NullOr(StringArraySchema)),
  subscription_ids: Schema.optional(Schema.NullOr(StringArraySchema)),
  resourceGroups: Schema.optional(Schema.NullOr(StringArraySchema)),
  resource_groups: Schema.optional(Schema.NullOr(StringArraySchema)),
  tagFilters: Schema.optional(Schema.NullOr(StringRecordSchema)),
  tag_filters: Schema.optional(Schema.NullOr(StringRecordSchema)),
  query: Schema.optional(Schema.NullOr(Schema.String)),
});

const AzureResourcePayloadSchema = Schema.Struct({
  resourceId: Schema.optional(Schema.NullOr(Schema.String)),
  resource_id: Schema.optional(Schema.NullOr(Schema.String)),
  type: Schema.optional(Schema.NullOr(Schema.String)),
  name: Schema.optional(Schema.NullOr(Schema.String)),
  location: Schema.optional(Schema.NullOr(Schema.String)),
  subscriptionId: Schema.optional(Schema.NullOr(Schema.String)),
  subscription_id: Schema.optional(Schema.NullOr(Schema.String)),
  resourceGroup: Schema.optional(Schema.NullOr(Schema.String)),
  resource_group: Schema.optional(Schema.NullOr(Schema.String)),
  tags: Schema.optional(Schema.NullOr(StringRecordSchema)),
  dependsOn: Schema.optional(Schema.NullOr(StringArraySchema)),
  depends_on: Schema.optional(Schema.NullOr(StringArraySchema)),
});

const AzureRelationshipPayloadSchema = Schema.Struct({
  fromResourceId: Schema.optional(Schema.NullOr(Schema.String)),
  from_resource_id: Schema.optional(Schema.NullOr(Schema.String)),
  toResourceId: Schema.optional(Schema.NullOr(Schema.String)),
  to_resource_id: Schema.optional(Schema.NullOr(Schema.String)),
  relationshipType: Schema.optional(Schema.NullOr(Schema.String)),
  relationship_type: Schema.optional(Schema.NullOr(Schema.String)),
  confidence: Schema.optional(Schema.NullOr(Schema.String)),
});

const AzureGraphSnapshotPayloadSchema = Schema.Struct({
  collectedAt: Schema.optional(Schema.NullOr(Schema.Number)),
  collected_at: Schema.optional(Schema.NullOr(Schema.Number)),
  scope: Schema.optional(Schema.NullOr(Schema.Unknown)),
  resources: Schema.optional(Schema.NullOr(Schema.Array(Schema.Unknown))),
  relationships: Schema.optional(Schema.NullOr(Schema.Array(Schema.Unknown))),
  warnings: Schema.optional(Schema.NullOr(StringArraySchema)),
});

const AzureAuthStatusSchema = Schema.Struct({
  available: Schema.Boolean,
  authenticated: Schema.Boolean,
  strategy: Schema.String,
  details: Schema.optional(Schema.NullOr(Schema.String)),
});

const decodeUnknownSync = <A>(
  schema: Schema.Schema<A>,
  value: unknown,
  message: string,
): A => {
  try {
    return Schema.decodeUnknownSync(schema)(value);
  } catch (cause) {
    throw new AzureSyncRuntimeError({
      message,
      cause,
    });
  }
};

const decodeScope = (value: unknown): AzureSyncScope => {
  const payload = decodeUnknownSync(
    AzureScopePayloadSchema,
    value,
    "Invalid Azure sync scope payload",
  );

  const subscriptionIds = firstStringArray(
    payload.subscriptionIds,
    payload.subscription_ids,
  );

  if (subscriptionIds.length === 0) {
    throw new AzureSyncRuntimeError({
      message: "Azure sync scope must include at least one subscription ID",
    });
  }

  const resourceGroups = firstStringArray(
    payload.resourceGroups,
    payload.resource_groups,
  );
  const tagFilters = toTagMap(payload.tagFilters ?? payload.tag_filters);
  const query = firstNonEmptyString(payload.query);

  return {
    subscriptionIds,
    ...(resourceGroups.length > 0 ? { resourceGroups } : {}),
    ...(Object.keys(tagFilters).length > 0 ? { tagFilters } : {}),
    ...(query ? { query } : {}),
  };
};

const decodeRelationshipType = (value: unknown): AzureRelationshipType => {
  switch (value) {
    case "depends_on":
    case "network_link":
    case "data_link":
    case "identity_link":
    case "inferred":
      return value;
    default:
      return "inferred";
  }
};

const decodeRelationshipConfidence = (
  value: unknown,
): AzureRelationshipConfidence => {
  switch (value) {
    case "high":
    case "medium":
    case "low":
      return value;
    default:
      return "low";
  }
};

const decodeResourceSnapshot = (value: unknown): AzureResourceSnapshot => {
  const payload = decodeUnknownSync(
    AzureResourcePayloadSchema,
    value,
    "Invalid Azure resource snapshot payload",
  );

  const resourceId = firstNonEmptyString(payload.resourceId, payload.resource_id);
  const type = firstNonEmptyString(payload.type);
  const name = firstNonEmptyString(payload.name);
  const subscriptionId = firstNonEmptyString(
    payload.subscriptionId,
    payload.subscription_id,
  );

  if (!resourceId || !type || !name || !subscriptionId) {
    throw new AzureSyncRuntimeError({
      message: "Azure resource snapshot is missing required string fields",
    });
  }

  const location = firstNonEmptyString(payload.location);
  const resourceGroup = firstNonEmptyString(
    payload.resourceGroup,
    payload.resource_group,
  );
  const dependsOn = firstStringArray(payload.dependsOn, payload.depends_on);

  return {
    resourceId,
    type,
    name,
    subscriptionId,
    tags: toTagMap(payload.tags),
    ...(location ? { location } : {}),
    ...(resourceGroup ? { resourceGroup } : {}),
    ...(dependsOn.length > 0 ? { dependsOn } : {}),
  };
};

const decodeRelationshipSnapshot = (
  value: unknown,
): AzureRelationshipSnapshot => {
  const payload = decodeUnknownSync(
    AzureRelationshipPayloadSchema,
    value,
    "Invalid Azure relationship snapshot payload",
  );

  const fromResourceId = firstNonEmptyString(
    payload.fromResourceId,
    payload.from_resource_id,
  );
  const toResourceId = firstNonEmptyString(
    payload.toResourceId,
    payload.to_resource_id,
  );

  if (!fromResourceId || !toResourceId) {
    throw new AzureSyncRuntimeError({
      message: "Azure relationship snapshot is missing endpoint IDs",
    });
  }

  return {
    fromResourceId,
    toResourceId,
    relationshipType: decodeRelationshipType(
      firstNonEmptyString(payload.relationshipType, payload.relationship_type),
    ),
    confidence: decodeRelationshipConfidence(firstNonEmptyString(payload.confidence)),
  };
};

const decodeGraphSnapshot = (
  payload: unknown,
  scopeFallback: AzureSyncScope,
): AzureGraphSnapshot => {
  const decoded = decodeUnknownSync(
    AzureGraphSnapshotPayloadSchema,
    payload,
    "Invalid Azure graph snapshot payload",
  );

  const collectedAt = decoded.collectedAt ?? decoded.collected_at ?? Date.now();

  const scope = decoded.scope !== undefined && decoded.scope !== null
    ? decodeScope(decoded.scope)
    : scopeFallback;
  const resources = (decoded.resources ?? []).map(decodeResourceSnapshot);
  const relationships = (decoded.relationships ?? []).map(decodeRelationshipSnapshot);
  const warnings = toStringArray(decoded.warnings);

  return {
    collectedAt,
    scope,
    resources,
    relationships,
    warnings,
  };
};

const decodeAuthStatus = (payload: unknown): AzureAuthStatus => {
  const decoded = decodeUnknownSync(
    AzureAuthStatusSchema,
    payload,
    "Invalid Azure auth status payload",
  );

  return {
    available: decoded.available,
    authenticated: decoded.authenticated,
    strategy: decoded.strategy,
    ...(decoded.details ? { details: decoded.details } : {}),
  };
};

const createRunId = (): string => `azure-sync-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const toNodeEntitySnapshot = (
  node: AzureMappedNode,
): AzureSyncEntitySnapshot => ({
  id: node.id,
  fingerprint: JSON.stringify({
    type: node.type,
    label: node.label,
    technology: node.technology,
    description: node.description,
    sourceResourceId: node.sourceResourceId,
    sourceResourceType: node.sourceResourceType,
    parentGroupId: node.parentGroupId ?? null,
    isSyntheticContainer: node.isSyntheticContainer ?? false,
    teamOwnership: node.teamOwnership ?? null,
  }),
});

const toEdgeEntitySnapshot = (
  edge: AzureMappedEdge,
): AzureSyncEntitySnapshot => ({
  id: edge.id,
  fingerprint: JSON.stringify({
    source: edge.source,
    target: edge.target,
    label: edge.label,
    relationshipType: edge.relationshipType,
    confidence: edge.confidence,
  }),
});

const toSyncResult = (
  nodeDiff: AzureSyncDiffResult,
  edgeDiff: AzureSyncDiffResult,
  warnings: ReadonlyArray<string>,
): AzureSyncResult => ({
  runId: createRunId(),
  status: "planned",
  delta: {
    nodesToCreate: nodeDiff.create.length,
    nodesToUpdate: nodeDiff.update.length,
    nodesToArchive: nodeDiff.archive.length,
    edgesToCreate: edgeDiff.create.length,
    edgesToUpdate: edgeDiff.update.length,
    edgesToArchive: edgeDiff.archive.length,
  },
  warnings,
  errors: [],
});

export interface AzureSyncDryRunInput {
  scope: AzureSyncScope;
  existingNodes: ReadonlyArray<AzureSyncEntitySnapshot>;
  existingEdges: ReadonlyArray<AzureSyncEntitySnapshot>;
  idNamespace?: string;
}

export interface AzureSyncDryRunOutput {
  snapshot: AzureGraphSnapshot;
  mapped: AzureMappedGraph;
  nodeDiff: AzureSyncDiffResult;
  edgeDiff: AzureSyncDiffResult;
  result: AzureSyncResult;
}

export const queryAzureGraph = (
  scope: AzureSyncScope,
): Effect.Effect<AzureGraphSnapshot, AzureSyncRuntimeError> =>
  Effect.tryPromise({
    try: async () => {
      const payload = await invoke("azure_graph_query", {
        scope: {
          subscriptionIds: scope.subscriptionIds,
          ...(scope.resourceGroups ? { resourceGroups: scope.resourceGroups } : {}),
          ...(scope.tagFilters ? { tagFilters: scope.tagFilters } : {}),
          ...(scope.query ? { query: scope.query } : {}),
        },
      });
      return decodeGraphSnapshot(payload, scope);
    },
    catch: (cause) => {
      const detail = toCauseMessage(cause);
      return new AzureSyncRuntimeError({
        message: `Azure graph query failed: ${detail}`,
        cause,
      });
    },
  });

export const validateAzureGraphAuth = (): Effect.Effect<
  AzureAuthStatus,
  AzureSyncRuntimeError
> =>
  Effect.tryPromise({
    try: async () => {
      const payload = await invoke("azure_graph_validate_auth");
      return decodeAuthStatus(payload);
    },
    catch: (cause) => {
      const detail = toCauseMessage(cause);
      return new AzureSyncRuntimeError({
        message: `Azure auth validation failed: ${detail}`,
        cause,
      });
    },
  });

export const planAzureSyncDryRun = (
  input: AzureSyncDryRunInput,
): Effect.Effect<AzureSyncDryRunOutput, AzureSyncRuntimeError> =>
  queryAzureGraph(input.scope).pipe(
    Effect.map((snapshot): AzureSyncDryRunOutput => {
      const mapped = mapAzureSnapshotToC4Graph(snapshot, {
        ...(input.idNamespace ? { namespace: input.idNamespace } : {}),
      });
      const incomingNodes = mapped.nodes.map(toNodeEntitySnapshot);
      const incomingEdges = mapped.edges.map(toEdgeEntitySnapshot);
      const nodeDiff = diffAzureSyncEntities(input.existingNodes, incomingNodes);
      const edgeDiff = diffAzureSyncEntities(input.existingEdges, incomingEdges);

      const warnings = [...snapshot.warnings];
      if (snapshot.resources.length === 0) {
        warnings.push("Azure query returned zero resources for selected scope");
      }

      return {
        snapshot,
        mapped,
        nodeDiff,
        edgeDiff,
        result: toSyncResult(nodeDiff, edgeDiff, warnings),
      };
    }),
    Effect.mapError((error) =>
      error instanceof AzureSyncRuntimeError
        ? error
        : new AzureSyncRuntimeError({
          message: toErrorMessage(error),
          cause: error,
        })
    ),
  );
