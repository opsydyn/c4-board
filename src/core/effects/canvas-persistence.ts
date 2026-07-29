/**
 * Canvas Persistence Effect Services (Functional Core)
 *
 * Pure functions for saving/loading C4 diagrams to/from database
 * Handles conversion between ReactFlow format and database schema
 *
 * Architecture:
 * - Effect functions describe WHAT to do (pure logic)
 * - DatabaseService provides HOW to do it (I/O)
 * - XState machines orchestrate WHEN to do it (flow control)
 *
 * Idiomatic Effect patterns:
 * - Effect.forEach for async iterations (replaces imperative for loops)
 * - Either.match for pattern matching on Result types
 * - pipe for composition and readability
 * - Extracted reusable upsert patterns
 */

import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react";
import { Effect, pipe } from "effect";
import { isArchitectureSemanticRole } from "./architecture-role-classification";
import {
  createDiagram,
  type CreateDiagramInput,
  createEdge,
  type CreateEdgeInput,
  createNode,
  type CreateNodeInput,
  DatabaseError,
  DatabaseService,
  deleteDiagram,
  deleteEdge,
  deleteNode,
  type Edge as DbEdge,
  getDiagram,
  getEdgesByDiagram,
  getNodesByDiagram,
  listDiagrams,
  type Node as DbNode,
  NotFoundError,
  updateDiagram,
  updateEdge,
  type UpdateEdgeInput,
  updateNode,
  type UpdateNodeInput,
  ValidationError,
} from "./database";
import type { EdgeData, EdgeMetadata } from "./edge-operations";
import { LAYOUT_AUDIT_RETENTION_LIMIT, type LayoutApplicationAudit } from "./layout.types";
export { LAYOUT_AUDIT_RETENTION_LIMIT } from "./layout.types";
import {
  type C4Type,
  type CouplingOverrides,
  type CouplingProfile,
  type CouplingScoreMode,
  getDefaultIconId,
  type IntegrationType,
  type NodeData,
  type NodeIconId,
  type SubdomainType,
} from "./node-operations";

// ============================================================================
// Type Definitions
// ============================================================================

export interface CanvasDiagram {
  id: string;
  name: string;
  description?: string;
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
  createdAt: number;
  updatedAt: number;
  layoutAudit?: LayoutApplicationAudit;
  layoutAudits: LayoutApplicationAudit[];
}

export interface SaveDiagramInput {
  id: string;
  name: string;
  description?: string;
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
  layoutAudit?: LayoutApplicationAudit;
}

interface LayoutAuditRow {
  audit_json: string;
}

const parseLayoutAudit = (value: unknown): LayoutApplicationAudit | null => {
  if (!isRecord(value) || value.version !== 1 || !isFiniteNumber(value.appliedAt)) return null;
  if (
    typeof value.preset !== "string"
    || typeof value.strategyId !== "string"
    || (value.engine !== "dagre" && value.engine !== "elk" && value.engine !== "custom")
    || (value.selectedVariant !== "single"
      && value.selectedVariant !== "original"
      && value.selectedVariant !== "recommended")
    || !Array.isArray(value.comparisonMetrics)
  ) return null;
  return value as unknown as LayoutApplicationAudit;
};

export const appendLayoutAudit = (
  diagramId: string,
  audit: LayoutApplicationAudit,
) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    yield* service.execute(
      `INSERT OR IGNORE INTO layout_audits (
        id, diagram_id, version, applied_at, audit_json
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        `${diagramId}:${audit.appliedAt}`,
        diagramId,
        audit.version,
        audit.appliedAt,
        JSON.stringify(audit),
      ],
    );
    yield* service.execute(
      `DELETE FROM layout_audits
       WHERE diagram_id = ?
         AND id NOT IN (
           SELECT id
           FROM layout_audits
           WHERE diagram_id = ?
           ORDER BY applied_at DESC, id DESC
           LIMIT ?
         )`,
      [diagramId, diagramId, LAYOUT_AUDIT_RETENTION_LIMIT],
    );
  });

export const getLayoutAudits = (diagramId: string) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    const rows = yield* service.query<LayoutAuditRow>(
      `SELECT audit_json
       FROM layout_audits
       WHERE diagram_id = ?
       ORDER BY applied_at DESC`,
      [diagramId],
    );
    return rows.flatMap((row) => {
      try {
        const audit = parseLayoutAudit(JSON.parse(row.audit_json) as unknown);
        return audit ? [audit] : [];
      } catch {
        return [];
      }
    });
  });

export const deleteLayoutAudit = (diagramId: string, appliedAt: number) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    yield* service.execute(
      `DELETE FROM layout_audits
       WHERE diagram_id = ? AND applied_at = ?`,
      [diagramId, appliedAt],
    );
  });

export const clearLayoutAudits = (diagramId: string) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    yield* service.execute(
      "DELETE FROM layout_audits WHERE diagram_id = ?",
      [diagramId],
    );
  });

// ============================================================================
// Conversion Utilities (Pure Functions)
// ============================================================================

/**
 * Helper: Add optional field if value is not null/undefined (pure function)
 * Returns a NEW object, never mutates the input
 */
const addOptional =
  <K extends string, V>(key: K, value: V | null | undefined) => <T extends Record<string, unknown>>(obj: T): T => {
    if (value !== null && value !== undefined) {
      return { ...obj, [key]: value } as T;
    }
    return obj;
  };

/**
 * Helper: Build style object from optional dimensions
 */
const buildStyle = (width: number | null, height: number | null) => {
  if (width === null && height === null) return undefined;
  return {
    ...(width !== null ? { width } : {}),
    ...(height !== null ? { height } : {}),
  };
};

/**
 * Helper: Build partial object from optional value
 * Returns empty object if value is undefined, otherwise returns {key: value}
 */
const optional = <K extends string, V>(
  key: K,
  value: V | undefined,
): Record<K, V> | Record<string, never> => {
  return value !== undefined ? ({ [key]: value } as Record<K, V>) : {};
};

const COUPLING_STATE_VERSION = 1;

type PersistedCouplingStateV1 = {
  couplingScoreMode?: CouplingScoreMode;
  integrationType?: IntegrationType;
  subdomainType?: SubdomainType;
  couplingProfile?: CouplingProfile;
  couplingOverrides?: CouplingOverrides;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const isCouplingScoreMode = (value: unknown): value is CouplingScoreMode =>
  value === "auto" || value === "hybrid" || value === "manual";

const isIntegrationType = (value: unknown): value is IntegrationType =>
  value === "intrusive" || value === "contract" || value === "functional";

const isSubdomainType = (value: unknown): value is SubdomainType =>
  value === "core" || value === "supporting" || value === "generic";

const parseCouplingProfile = (value: unknown): CouplingProfile | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const { strength, distance, volatility } = value;
  if (
    !isFiniteNumber(strength)
    || !isFiniteNumber(distance)
    || !isFiniteNumber(volatility)
  ) {
    return undefined;
  }

  return { strength, distance, volatility };
};

const parseCouplingOverrides = (value: unknown): CouplingOverrides | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const {
    strength,
    distance,
    volatility,
    integrationType,
    subdomainType,
  } = value;
  const overrides: CouplingOverrides = {
    ...(isFiniteNumber(strength) ? { strength } : {}),
    ...(isFiniteNumber(distance) ? { distance } : {}),
    ...(isFiniteNumber(volatility) ? { volatility } : {}),
    ...(isIntegrationType(integrationType) ? { integrationType } : {}),
    ...(isSubdomainType(subdomainType) ? { subdomainType } : {}),
  };

  return Object.keys(overrides).length > 0 ? overrides : undefined;
};

const parsePersistedCouplingState = (
  value: unknown,
): PersistedCouplingStateV1 | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const couplingProfile = parseCouplingProfile(value.couplingProfile);
  const couplingOverrides = parseCouplingOverrides(value.couplingOverrides);

  const state: PersistedCouplingStateV1 = {
    ...(isCouplingScoreMode(value.couplingScoreMode)
      ? { couplingScoreMode: value.couplingScoreMode }
      : {}),
    ...(isIntegrationType(value.integrationType)
      ? { integrationType: value.integrationType }
      : {}),
    ...(isSubdomainType(value.subdomainType)
      ? { subdomainType: value.subdomainType }
      : {}),
    ...(couplingProfile ? { couplingProfile } : {}),
    ...(couplingOverrides ? { couplingOverrides } : {}),
  };

  return Object.keys(state).length > 0 ? state : undefined;
};

const decodeCouplingState = (
  dbNode: DbNode,
): Partial<NodeData> => {
  if (typeof dbNode.coupling_state_json !== "string") {
    return {};
  }

  if (dbNode.coupling_state_json.trim().length === 0) {
    return {};
  }

  if (dbNode.coupling_state_version !== COUPLING_STATE_VERSION) {
    console.warn(
      `Unsupported coupling_state_version ${dbNode.coupling_state_version} for node ${dbNode.id}`,
    );
    return {};
  }

  try {
    const parsed = JSON.parse(dbNode.coupling_state_json);
    const state = parsePersistedCouplingState(parsed);
    if (!state) {
      return {};
    }

    return {
      ...(state.couplingScoreMode !== undefined
        ? { couplingScoreMode: state.couplingScoreMode }
        : {}),
      ...(state.integrationType !== undefined
        ? { integrationType: state.integrationType }
        : {}),
      ...(state.subdomainType !== undefined
        ? { subdomainType: state.subdomainType }
        : {}),
      ...(state.couplingProfile !== undefined
        ? { couplingProfile: state.couplingProfile }
        : {}),
      ...(state.couplingOverrides !== undefined
        ? { couplingOverrides: state.couplingOverrides }
        : {}),
    };
  } catch (error) {
    console.warn(
      `Failed to parse coupling state for node ${dbNode.id}:`,
      error,
    );
    return {};
  }
};

const encodeCouplingState = (data: Record<string, unknown>): string | null => {
  const couplingProfile = parseCouplingProfile(data.couplingProfile);
  const couplingOverrides = parseCouplingOverrides(data.couplingOverrides);

  const state: PersistedCouplingStateV1 = {
    ...(isCouplingScoreMode(data.couplingScoreMode)
      ? { couplingScoreMode: data.couplingScoreMode }
      : {}),
    ...(isIntegrationType(data.integrationType)
      ? { integrationType: data.integrationType }
      : {}),
    ...(isSubdomainType(data.subdomainType)
      ? { subdomainType: data.subdomainType }
      : {}),
    ...(couplingProfile ? { couplingProfile } : {}),
    ...(couplingOverrides ? { couplingOverrides } : {}),
  };

  return Object.keys(state).length > 0 ? JSON.stringify(state) : null;
};

/**
 * Convert database node to ReactFlow node format using PURE functional composition
 * Uses pipe to chain transformations - no mutations!
 */
export function dbNodeToReactFlow(dbNode: DbNode): ReactFlowNode {
  const fallbackIcon = getDefaultIconId(dbNode.type as C4Type);
  const couplingState = decodeCouplingState(dbNode);
  const teamOwnership = dbNode.team_ownership?.trim();

  // Base node (always present fields)
  const baseNode: ReactFlowNode = {
    id: dbNode.id,
    type: dbNode.type,
    position: {
      x: dbNode.position_x,
      y: dbNode.position_y,
    },
    data: {
      label: dbNode.label,
      technology: dbNode.technology ?? undefined,
      description: dbNode.description ?? undefined,
      c4Type: dbNode.type,
      createdAt: dbNode.created_at,
      iconId: (dbNode.icon_id as NodeIconId | null) ?? fallbackIcon,
      ...(teamOwnership && teamOwnership.length > 0
        ? { teamOwnership }
        : {}),
      ...(isArchitectureSemanticRole(dbNode.semantic_role)
        ? { layoutRole: dbNode.semantic_role }
        : {}),
      // Spread only when present, so an unprovenanced node stays that way rather
      // than gaining explicit nulls that read as "synced, found nothing".
      ...(dbNode.source_provider ? { sourceProvider: dbNode.source_provider } : {}),
      ...(dbNode.source_resource_id ? { sourceResourceId: dbNode.source_resource_id } : {}),
      ...(dbNode.source_resource_type ? { sourceResourceType: dbNode.source_resource_type } : {}),
      ...(typeof dbNode.last_synced_at === "number" ? { lastSyncedAt: dbNode.last_synced_at } : {}),
      ...couplingState,
    },
    // Initialize measured dimensions for ReactFlow v12+
    // This prevents "undefined is not an object (evaluating 'node.measured')" errors
    // Use conditional spread to avoid setting 'undefined' (exactOptionalPropertyTypes strict mode)
    ...(dbNode.width !== null && dbNode.height !== null
      ? {
        measured: {
          width: dbNode.width,
          height: dbNode.height,
        },
      }
      : {}),
  };

  // Pure functional composition - each function returns a NEW object
  return pipe(
    baseNode,
    addOptional("width", dbNode.width),
    addOptional("height", dbNode.height),
    addOptional("style", buildStyle(dbNode.width, dbNode.height)),
    addOptional("parentId", dbNode.parent_id),
    addOptional("extent", dbNode.extent),
    addOptional("expandParent", dbNode.expand_parent === 1 ? true : undefined),
  );
}

/**
 * Determine if a node type is C4 or DDD
 */
function determineNodeDomain(type: string): "c4" | "ddd" {
  const c4Types = ["person", "system", "externalSystem", "container", "component"];
  return c4Types.includes(type) ? "c4" : "ddd";
}

/**
 * Convert ReactFlow node to database node format using helper functions
 */
export function reactFlowNodeToDb(
  node: ReactFlowNode,
  diagramId: string,
): CreateNodeInput {
  const rawData = typeof node.data === "object" && node.data !== null ? node.data : {};
  const dataRecord = rawData as Record<string, unknown>;
  const labelValue = dataRecord.label;
  const technologyValue = dataRecord.technology;
  const descriptionValue = dataRecord.description;
  const explicitType = typeof node.type === "string" && node.type.length > 0 ? node.type : undefined;
  const dataType = typeof dataRecord.c4Type === "string" && dataRecord.c4Type.length > 0
    ? (dataRecord.c4Type as string)
    : typeof dataRecord.dddType === "string" && dataRecord.dddType.length > 0
    ? (dataRecord.dddType as string)
    : undefined;
  const resolvedType = (explicitType ?? dataType ?? "system") as CreateNodeInput["type"];
  const domain = determineNodeDomain(resolvedType);
  const styleWidth = extractNumericDimension(node.style?.width);
  const styleHeight = extractNumericDimension(node.style?.height);
  const widthValue = typeof node.width === "number" ? node.width : styleWidth;
  const heightValue = typeof node.height === "number" ? node.height : styleHeight;

  const technology = typeof technologyValue === "string" ? technologyValue : undefined;
  const description = typeof descriptionValue === "string" ? descriptionValue : undefined;
  const teamOwnershipValue = dataRecord.teamOwnership;
  const teamOwnership = typeof teamOwnershipValue === "string"
    ? teamOwnershipValue.trim()
    : "";
  const iconValue = typeof dataRecord.iconId === "string" && dataRecord.iconId.length > 0
    ? (dataRecord.iconId as string)
    : undefined;
  const resolvedIconId = iconValue ?? getDefaultIconId(resolvedType as C4Type);
  const label = typeof labelValue === "string" && labelValue.length > 0 ? labelValue : "Unnamed";
  const couplingStateJson = encodeCouplingState(dataRecord);
  const semanticRole = isArchitectureSemanticRole(dataRecord.layoutRole)
    ? dataRecord.layoutRole
    : undefined;
  // Azure provenance (migration 039). Only carried when the node actually has
  // it — a hand-drawn node must not come back claiming a provider made it.
  const text = (value: unknown): string | undefined =>
    typeof value === "string" && value.trim().length > 0 ? value : undefined;
  const sourceProvider = text(dataRecord.sourceProvider);
  const lastSyncedAt = typeof dataRecord.lastSyncedAt === "number"
      && Number.isFinite(dataRecord.lastSyncedAt)
    ? dataRecord.lastSyncedAt
    : undefined;

  return {
    id: node.id,
    diagram_id: diagramId,
    domain,
    type: resolvedType,
    label,
    ...optional("technology", technology),
    ...optional("description", description),
    position_x: node.position.x,
    position_y: node.position.y,
    ...optional("width", widthValue),
    ...optional("height", heightValue),
    // Parent-child relationship fields for sub-flows
    ...optional("parent_id", node.parentId),
    ...optional("extent", node.extent as "parent" | undefined),
    ...optional("expand_parent", node.expandParent),
    ...optional("icon_id", resolvedIconId),
    ...optional("semantic_role", semanticRole),
    ...optional("source_provider", sourceProvider),
    ...optional("source_resource_id", text(dataRecord.sourceResourceId)),
    ...optional("source_resource_type", text(dataRecord.sourceResourceType)),
    ...optional("last_synced_at", lastSyncedAt),
    ...optional(
      "team_ownership",
      teamOwnership.length > 0 ? teamOwnership : undefined,
    ),
    coupling_state_version: COUPLING_STATE_VERSION,
    coupling_state_json: couplingStateJson,
  };
}

/**
 * Convert database edge to ReactFlow edge format with metadata parsing
 */
interface PersistedEdgePayloadV1 {
  version: 1;
  metadata?: EdgeMetadata;
  layout?: {
    audit?: EdgeData["layoutAudit"];
    route?: EdgeData["layoutRoute"];
    sourceHandle?: string | null;
    targetHandle?: string | null;
  };
  /**
   * Azure provenance (ADR-020 Phase 2).
   *
   * Added to this payload rather than as columns, because edges already store
   * their extras here — the opposite call to nodes, which are flat-column
   * throughout. Optional, so rows written before this existed still decode as
   * version 1 with no provenance rather than failing.
   */
  provenance?: {
    sourceProvider?: string;
    relationshipType?: string;
    confidence?: string;
    provenanceSource?: string;
    provenanceDetail?: string;
    lastSyncedAt?: number;
  };
}

/** Reads the provenance an Azure sync wrote onto an edge, if any. */
const readEdgeProvenance = (
  edgeData: EdgeData | undefined,
): PersistedEdgePayloadV1["provenance"] => {
  const record = edgeData as Record<string, unknown> | undefined;
  if (!record) {
    return undefined;
  }

  const text = (value: unknown): string | undefined =>
    typeof value === "string" && value.trim().length > 0 ? value : undefined;

  const provenance = {
    ...(text(record.sourceProvider) ? { sourceProvider: text(record.sourceProvider)! } : {}),
    ...(text(record.relationshipType) ? { relationshipType: text(record.relationshipType)! } : {}),
    ...(text(record.confidence) ? { confidence: text(record.confidence)! } : {}),
    ...(text(record.provenanceSource) ? { provenanceSource: text(record.provenanceSource)! } : {}),
    ...(text(record.provenanceDetail) ? { provenanceDetail: text(record.provenanceDetail)! } : {}),
    ...(typeof record.lastSyncedAt === "number" && Number.isFinite(record.lastSyncedAt)
      ? { lastSyncedAt: record.lastSyncedAt }
      : {}),
  };

  return Object.keys(provenance).length > 0 ? provenance : undefined;
};

const isPersistedEdgePayloadV1 = (value: unknown): value is PersistedEdgePayloadV1 =>
  typeof value === "object"
  && value !== null
  && "version" in value
  && value.version === 1;

export function dbEdgeToReactFlow(dbEdge: DbEdge): ReactFlowEdge {
  // Parse metadata JSON if present
  let metadata: EdgeMetadata | undefined;
  let layout: PersistedEdgePayloadV1["layout"];
  let provenance: PersistedEdgePayloadV1["provenance"];
  if (dbEdge.metadata) {
    try {
      const persisted = JSON.parse(dbEdge.metadata) as unknown;
      if (isPersistedEdgePayloadV1(persisted)) {
        metadata = persisted.metadata;
        layout = persisted.layout;
        provenance = persisted.provenance;
      } else {
        metadata = persisted as EdgeMetadata;
      }
    } catch (error) {
      console.warn(`Failed to parse edge metadata for edge ${dbEdge.id}:`, error);
    }
  }

  const edgeData: EdgeData = {
    createdAt: dbEdge.created_at,
    ...(metadata && { metadata }),
    ...(layout?.audit && { layoutAudit: layout.audit }),
    ...(layout?.route && { layoutRoute: layout.route }),
    ...(provenance ?? {}),
  };

  return {
    id: dbEdge.id,
    source: dbEdge.source,
    target: dbEdge.target,
    label: dbEdge.label ?? undefined,
    type: "default",
    data: edgeData,
    sourceHandle: layout?.sourceHandle ?? null,
    targetHandle: layout?.targetHandle ?? null,
  };
}

/**
 * Convert ReactFlow edge to database edge format with metadata serialization
 */
export function reactFlowEdgeToDb(
  edge: ReactFlowEdge,
  diagramId: string,
): CreateEdgeInput {
  const labelValue = typeof edge.label === "string" ? edge.label : undefined;

  // Extract and serialize metadata from edge.data
  const edgeData = edge.data as EdgeData | undefined;
  const metadata = edgeData?.metadata;
  const hasLayout = Boolean(
    edgeData?.layoutAudit || edgeData?.layoutRoute || edge.sourceHandle || edge.targetHandle,
  );
  const provenance = readEdgeProvenance(edgeData);
  const metadataJson = metadata || hasLayout || provenance
    ? JSON.stringify(
      {
        version: 1,
        ...(metadata && { metadata }),
        ...(hasLayout && {
          layout: {
            ...(edgeData?.layoutAudit && { audit: edgeData.layoutAudit }),
            ...(edgeData?.layoutRoute && { route: edgeData.layoutRoute }),
            ...(edge.sourceHandle && { sourceHandle: edge.sourceHandle }),
            ...(edge.targetHandle && { targetHandle: edge.targetHandle }),
          },
        }),
        ...(provenance && { provenance }),
      } satisfies PersistedEdgePayloadV1,
    )
    : undefined;

  return {
    id: edge.id,
    diagram_id: diagramId,
    source: edge.source,
    target: edge.target,
    ...optional("label", labelValue),
    ...optional("metadata", metadataJson),
  };
}

const toNullableString = (value: string | undefined): string | null => value ?? null;

const toNullableNumber = (value: number | undefined): number | null => value ?? null;

const toNullableExtent = (
  value: "parent" | undefined,
): "parent" | null => value ?? null;

const toExpandParentInt = (value: boolean | undefined): number => value ? 1 : 0;

const toNullableCouplingState = (value: string | null | undefined): string | null => value ?? null;

const toCouplingStateVersion = (value: number | undefined): number => value ?? COUPLING_STATE_VERSION;

const hasNodeChanges = (
  existing: DbNode,
  next: CreateNodeInput,
): boolean => {
  return (
    existing.label !== next.label
    || existing.technology !== toNullableString(next.technology)
    || existing.description !== toNullableString(next.description)
    || existing.position_x !== next.position_x
    || existing.position_y !== next.position_y
    || existing.width !== toNullableNumber(next.width)
    || existing.height !== toNullableNumber(next.height)
    || existing.parent_id !== toNullableString(next.parent_id)
    || existing.extent !== toNullableExtent(next.extent)
    || existing.expand_parent !== toExpandParentInt(next.expand_parent)
    || existing.icon_id !== toNullableString(next.icon_id)
    || existing.semantic_role !== toNullableString(next.semantic_role)
    || existing.team_ownership !== toNullableString(next.team_ownership)
    || existing.coupling_state_version
      !== toCouplingStateVersion(next.coupling_state_version)
    || existing.coupling_state_json
      !== toNullableCouplingState(next.coupling_state_json)
  );
};

// ============================================================================
// Effect Services (Functional Core)
// ============================================================================

/**
 * Save complete diagram state (diagram + nodes + edges)
 * Uses transactional approach with Effect.forEach for iterations
 *
 * Note: The return type annotation is required because exactOptionalPropertyTypes
 * prevents Effect.gen from inferring the error union type correctly.
 */
export const saveDiagram = (
  input: SaveDiagramInput,
): Effect.Effect<
  { diagramId: string; savedAt: number },
  DatabaseError | NotFoundError | ValidationError,
  DatabaseService
> => {
  const effect = Effect.gen(function*() {
    const service = yield* DatabaseService;

    return yield* service.transaction(
      Effect.gen(function*() {
        // 1. Check if diagram exists, create or update if metadata changed
        const existingDiagram = yield* getDiagram(input.id).pipe(
          Effect.catchTag("NotFoundError", () => Effect.succeed(null)),
        );

        if (!existingDiagram) {
          const createPayload: CreateDiagramInput = {
            id: input.id,
            name: input.name,
            ...(input.description !== undefined
              ? { description: input.description }
              : {}),
          };
          yield* createDiagram(createPayload);
        } else {
          // Always update diagram to touch updated_at on every save,
          // not just when metadata changes. This keeps the DB timestamp
          // current so the UI shows an accurate "last saved" time on load.
          yield* updateDiagram(input.id, {
            name: input.name,
            ...(input.description !== undefined
              ? { description: input.description }
              : {}),
          });
        }

        if (input.layoutAudit) {
          yield* appendLayoutAudit(input.id, input.layoutAudit);
        }

        // 2. Get existing nodes and edges to determine what to delete/update
        const existingNodes = yield* getNodesByDiagram(input.id);
        const existingEdges = yield* getEdgesByDiagram(input.id);
        const existingNodeById = new Map(existingNodes.map((node) => [node.id, node]));
        const existingEdgeById = new Map(existingEdges.map((edge) => [edge.id, edge]));

        const currentNodeIds = new Set(input.nodes.map((n) => n.id));
        const currentEdgeIds = new Set(input.edges.map((e) => e.id));

        // 3. Delete nodes that no longer exist
        const nodesToDelete = existingNodes.filter((n) => !currentNodeIds.has(n.id));
        yield* Effect.forEach(nodesToDelete, (node) => deleteNode(node.id));

        // 4. Delete edges that no longer exist
        const edgesToDelete = existingEdges.filter((e) => !currentEdgeIds.has(e.id));
        yield* Effect.forEach(edgesToDelete, (edge) => deleteEdge(edge.id));

        // 5. Upsert current nodes
        yield* Effect.forEach(input.nodes, (node) => {
          const dbNodeInput = reactFlowNodeToDb(node, input.id);
          const existingNode = existingNodeById.get(node.id);

          if (existingNode) {
            // If immutable identity fields changed, recreate the row.
            if (
              existingNode.type !== dbNodeInput.type
              || existingNode.domain !== dbNodeInput.domain
            ) {
              return Effect.flatMap(deleteNode(existingNode.id), () => createNode(dbNodeInput));
            }

            if (!hasNodeChanges(existingNode, dbNodeInput)) {
              return Effect.succeed(undefined);
            }

            const couplingStateVersion = dbNodeInput.coupling_state_version ?? COUPLING_STATE_VERSION;
            const couplingStateJson = dbNodeInput.coupling_state_json ?? null;

            const updateNodePayload: UpdateNodeInput = {
              label: dbNodeInput.label,
              position_x: dbNodeInput.position_x,
              position_y: dbNodeInput.position_y,
              ...(dbNodeInput.technology !== undefined
                ? { technology: dbNodeInput.technology }
                : {}),
              ...(dbNodeInput.description !== undefined
                ? { description: dbNodeInput.description }
                : {}),
              ...(dbNodeInput.width !== undefined ? { width: dbNodeInput.width } : {}),
              ...(dbNodeInput.height !== undefined ? { height: dbNodeInput.height } : {}),
              ...(dbNodeInput.parent_id !== undefined
                ? { parent_id: dbNodeInput.parent_id }
                : {}),
              ...(dbNodeInput.extent !== undefined ? { extent: dbNodeInput.extent } : {}),
              ...(dbNodeInput.expand_parent !== undefined
                ? { expand_parent: dbNodeInput.expand_parent }
                : {}),
              ...(dbNodeInput.icon_id !== undefined
                ? { icon_id: dbNodeInput.icon_id }
                : {}),
              semantic_role: dbNodeInput.semantic_role ?? null,
              team_ownership: dbNodeInput.team_ownership ?? null,
              coupling_state_version: couplingStateVersion,
              coupling_state_json: couplingStateJson,
            };
            return updateNode(node.id, updateNodePayload);
          }

          return createNode(dbNodeInput);
        });

        // 6. Upsert current edges
        yield* Effect.forEach(input.edges, (edge) => {
          const dbEdgeInput = reactFlowEdgeToDb(edge, input.id);
          const existingEdge = existingEdgeById.get(edge.id);

          if (existingEdge) {
            const newLabel = dbEdgeInput.label ?? "uses";
            const currentLabel = existingEdge.label ?? "uses";
            const newMetadata = dbEdgeInput.metadata ?? null;
            const currentMetadata = existingEdge.metadata ?? null;
            const hasChanges = newLabel !== currentLabel || newMetadata !== currentMetadata;

            if (!hasChanges) {
              return Effect.succeed(undefined);
            }

            const updateInput: UpdateEdgeInput = {};
            if (newLabel !== currentLabel) {
              updateInput.label = newLabel;
            }
            if (newMetadata !== currentMetadata) {
              updateInput.metadata = newMetadata !== null ? newMetadata : undefined;
            }
            return updateEdge(edge.id, updateInput);
          }

          return createEdge(dbEdgeInput);
        });

        return {
          diagramId: input.id,
          savedAt: Date.now(),
        };
      }),
    );
  });

  // Return the effect with explicit type annotation to satisfy exactOptionalPropertyTypes
  return effect as Effect.Effect<
    { diagramId: string; savedAt: number },
    DatabaseError | NotFoundError | ValidationError,
    DatabaseService
  >;
};

/**
 * Sort nodes so parent nodes appear before their children
 * This is required by ReactFlow to properly initialize node dimensions and positions
 */
function sortNodesByParentHierarchy(nodes: ReactFlowNode[]): ReactFlowNode[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const sorted: ReactFlowNode[] = [];
  const visited = new Set<string>();

  function addNodeAndAncestors(node: ReactFlowNode) {
    // Already processed
    if (visited.has(node.id)) return;

    // If node has a parent, add parent first
    if (node.parentId) {
      const parent = nodeMap.get(node.parentId);
      if (parent) {
        addNodeAndAncestors(parent);
      }
    }

    // Add this node
    if (!visited.has(node.id)) {
      visited.add(node.id);
      sorted.push(node);
    }
  }

  // Process all nodes
  nodes.forEach(node => addNodeAndAncestors(node));

  return sorted;
}

/**
 * Load complete diagram state (diagram + nodes + edges)
 */
export const loadDiagram = (diagramId: string) =>
  Effect.gen(function*() {
    // 1. Load diagram metadata
    const diagram = (yield* getDiagram(diagramId))!;

    // 2. Load all nodes for this diagram
    const dbNodes = yield* getNodesByDiagram(diagramId);

    // 3. Load all edges for this diagram
    const dbEdges = yield* getEdgesByDiagram(diagramId);

    // 4. Convert to ReactFlow format and sort parent nodes before children
    const nodes = sortNodesByParentHierarchy(dbNodes.map(dbNodeToReactFlow));
    const edges = dbEdges.map(dbEdgeToReactFlow);
    const layoutAudits = yield* getLayoutAudits(diagramId);
    const legacyAudit = edges
      .map((edge) => (edge.data as EdgeData | undefined)?.layoutAudit)
      .find((audit): audit is LayoutApplicationAudit => audit !== undefined);
    const layoutAudit = layoutAudits[0] ?? legacyAudit;

    return {
      id: diagram.id,
      name: diagram.name,
      ...(diagram.description !== null
        ? { description: diagram.description }
        : {}),
      nodes,
      edges,
      createdAt: diagram.created_at,
      updatedAt: diagram.updated_at,
      ...(layoutAudit && { layoutAudit }),
      layoutAudits,
    } satisfies CanvasDiagram;
  });

/**
 * Create a new empty diagram
 */
export const createNewDiagram = (name: string, description?: string) =>
  Effect.gen(function*() {
    const id = `diagram-${Date.now()}`;

    const createPayload: CreateDiagramInput = {
      id,
      name,
      ...(description !== undefined ? { description } : {}),
    };

    yield* createDiagram(createPayload);

    return {
      id,
      name,
      ...(description !== undefined ? { description } : {}),
      nodes: [],
      edges: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      layoutAudits: [],
    } satisfies CanvasDiagram;
  });

/**
 * List all diagrams (metadata only, no nodes/edges)
 */
export const listAllDiagrams = () =>
  Effect.gen(function*() {
    const diagrams = yield* listDiagrams();

    return diagrams.map((d) => ({
      id: d.id,
      name: d.name,
      ...(d.description !== null ? { description: d.description } : {}),
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }));
  });

/**
 * Get diagram statistics (node and edge counts)
 */
export const getDiagramStats = (diagramId: string) =>
  Effect.gen(function*() {
    const dbNodes = yield* getNodesByDiagram(diagramId);
    const dbEdges = yield* getEdgesByDiagram(diagramId);

    // Count nodes by type
    const nodesByType = dbNodes.reduce(
      (acc, node) => {
        const type = node.type || "unknown";
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      diagramId,
      nodeCount: dbNodes.length,
      edgeCount: dbEdges.length,
      nodesByType,
    };
  });

/**
 * Delete diagram and all associated nodes/edges (CASCADE)
 */
export const removeDiagram = (diagramId: string) =>
  Effect.gen(function*() {
    yield* deleteDiagram(diagramId);

    return {
      deletedId: diagramId,
      deletedAt: Date.now(),
    };
  });

/**
 * Duplicate a diagram with all its nodes and edges
 */
export const duplicateDiagram = (sourceDiagramId: string, newName: string) =>
  Effect.gen(function*() {
    // 1. Load source diagram
    const source = yield* loadDiagram(sourceDiagramId);

    // 2. Create new diagram with new ID
    const newId = `diagram-${Date.now()}`;

    // 3. Map old node IDs to new node IDs
    const nodeIdMap = new Map<string, string>();
    const newNodes = source.nodes.map((node) => {
      const newNodeId = `${node.id}-copy-${Date.now()}`;
      nodeIdMap.set(node.id, newNodeId);
      return {
        ...node,
        id: newNodeId,
      };
    });

    // 4. Update edge IDs to reference new node IDs
    const newEdges = source.edges.map((edge) => ({
      ...edge,
      id: `${edge.id}-copy-${Date.now()}`,
      source: nodeIdMap.get(edge.source) || edge.source,
      target: nodeIdMap.get(edge.target) || edge.target,
    }));

    // 5. Save the duplicate
    const duplicatePayload: SaveDiagramInput = {
      id: newId,
      name: newName,
      nodes: newNodes,
      edges: newEdges,
      ...(source.description !== undefined
        ? { description: source.description }
        : {}),
    };

    yield* saveDiagram(duplicatePayload);

    return {
      id: newId,
      name: newName,
      ...(source.description !== undefined
        ? { description: source.description }
        : {}),
      nodes: newNodes,
      edges: newEdges,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      layoutAudits: [],
    } satisfies CanvasDiagram;
  });
const extractNumericDimension = (value: unknown): number | undefined => {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};
