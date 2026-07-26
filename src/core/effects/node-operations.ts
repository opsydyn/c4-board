/**
 * Node Operations (Effect-TS)
 *
 * FUNCTIONAL CORE - Pure business logic for node operations.
 * NO side effects: no invoke(), no DOM, no localStorage.
 * All functions return Effect<Env, Error, Result> for composition and testability.
 */

import type { Node } from "@xyflow/react";
import { Effect } from "effect";
import { nanoid } from "nanoid";
import type { ArchitectureSemanticRole } from "./architecture-role-classification";

/**
 * C4 model node types
 */
export type C4Type = "person" | "system" | "externalSystem" | "container" | "component";

/**
 * DDD model node types
 */
export type DDDType =
  // Strategic DDD
  | "boundedContext"
  | "aggregate"
  | "domainEvent"
  // Tactical DDD
  | "entity"
  | "valueObject"
  | "domainService"
  | "repository"
  | "factory"
  // Application Layer
  | "command"
  | "query"
  | "applicationService"
  // Infrastructure
  | "integrationEvent"
  | "antiCorruptionLayer"
  | "saga";

/**
 * Event Storming introduces only what has no equivalent already: a storm's event
 * is a `domainEvent` and its actor a `person` (ADR-016).
 */
export type EventStormingOnlyType = "hotspot" | "opportunity";

/**
 * Combined node type (C4 + DDD + Event Storming)
 */
export type NodeType = C4Type | DDDType | EventStormingOnlyType;

/**
 * Node domain discriminator
 */
/**
 * The domains a diagram can be in.
 *
 * Kept as a value, not only a type, because migration 034's CHECK constraints
 * accept exactly these — a domain that exists in TypeScript and not in SQLite is
 * a failure on save rather than at compile time (ADR-016).
 */
export const DIAGRAM_DOMAINS = ["c4", "ddd", "eventStorming"] as const;

export type NodeDomain = (typeof DIAGRAM_DOMAINS)[number];

export const isDiagramDomain = (value: unknown): value is NodeDomain =>
  typeof value === "string" && (DIAGRAM_DOMAINS as ReadonlyArray<string>).includes(value);

export type SubdomainType = "core" | "generic" | "supporting";

export type IntegrationType = "intrusive" | "contract" | "functional";

export type CouplingScoreMode = "auto" | "hybrid" | "manual";

export interface CouplingProfile {
  strength: number;
  distance: number;
  volatility: number;
}

export interface CouplingOverrides {
  strength?: number;
  distance?: number;
  volatility?: number;
  integrationType?: IntegrationType;
  subdomainType?: SubdomainType;
}

/**
 * Node data shape
 * Extends Record<string, unknown> to be compatible with ReactFlow's Node data type
 */
export type BuiltInIconId =
  | "phosphor:user-duotone"
  | "phosphor:package-duotone"
  | "phosphor:cloud-duotone"
  | "phosphor:stack-duotone"
  | "phosphor:cube-duotone";

export type CustomIconId = `custom:${string}`;

export type NodeIconId = BuiltInIconId | CustomIconId;

export const CUSTOM_ICON_PREFIX = "custom:" as const;

export const isCustomIconId = (iconId: unknown): iconId is CustomIconId =>
  typeof iconId === "string" && iconId.startsWith(CUSTOM_ICON_PREFIX);

export const createCustomIconId = (filename: string): CustomIconId => `${CUSTOM_ICON_PREFIX}${filename}`;

export const extractCustomIconFilename = (iconId: CustomIconId): string => iconId.slice(CUSTOM_ICON_PREFIX.length);

export interface NodeData extends Record<string, unknown> {
  label: string;
  description: string;
  technology: string;
  c4Type?: C4Type; // Optional now, may be dddType instead
  dddType?: DDDType; // DDD type
  createdAt?: number;
  subdomainType?: SubdomainType;
  integrationType?: IntegrationType;
  couplingProfile?: CouplingProfile;
  couplingScoreMode?: CouplingScoreMode;
  couplingOverrides?: CouplingOverrides;
  iconId?: NodeIconId;
  layoutRole?: ArchitectureSemanticRole;
  /** Event Storming: marks an event as a phase boundary on the timeline (ADR-016). */
  isPivotal?: boolean;

  // DDD-specific fields
  aggregateRoot?: string;
  invariants?: string[];
  ubiquitousLanguage?: string[];
  teamOwnership?: string;
  eventSchema?: string;
  identityField?: string;
  attributes?: string[];
  parentAggregate?: string;
  parentContext?: string;
  operations?: string[];
  managedAggregate?: string;
  persistenceTechnology?: string;
  createdObjects?: string[];
  creationRules?: string[];
  parameters?: string;
  targetAggregate?: string;
  returnType?: string;
  useCases?: string[];
  dependencies?: string[];
  publishingContext?: string;
  subscribingContexts?: string[];
  fromContext?: string;
  toContext?: string;
  translationRules?: string[];
  sagaSteps?: string[];
  compensationLogic?: string[];
}

/**
 * Position for a new node
 */
export interface NodePosition {
  x: number;
  y: number;
}

/**
 * Options for creating a new node
 */
export interface CreateNodeOptions {
  type: NodeType; // Now supports both C4 and DDD types
  label: string;
  nodeCounter: number;
  selectedNodeId: string | null;
  existingNodes: Node[];
}

const GRID_SIZE = 20;
const DEFAULT_PLACEMENT_CENTER = { x: 360, y: 280 };

/**
 * Every type a node may have. Derived from the dimensions record below, which the
 * type system already forces to cover all of them — so this cannot drift from
 * `NodeType` without a compile error.
 */
export const isNodeType = (value: unknown): value is NodeType =>
  typeof value === "string" && value !== "default"
  && Object.prototype.hasOwnProperty.call(DEFAULT_DIMENSIONS, value);

const DEFAULT_DIMENSIONS: Record<NodeType | "default", { width: number; height: number }> = {
  // C4 types
  person: { width: 220, height: 160 },
  system: { width: 240, height: 170 },
  externalSystem: { width: 240, height: 170 },
  container: { width: 400, height: 300 },
  component: { width: 200, height: 140 },

  // DDD Strategic types (larger, grouping)
  boundedContext: { width: 500, height: 400 },
  aggregate: { width: 320, height: 240 },
  domainEvent: { width: 180, height: 120 },

  // DDD Tactical types (medium)
  entity: { width: 220, height: 160 },
  valueObject: { width: 180, height: 140 },
  domainService: { width: 200, height: 150 },
  repository: { width: 200, height: 150 },
  factory: { width: 200, height: 150 },

  // Event Storming (ADR-016). Stickies, so square-ish and small — a wall is read
  // by the shape and colour of a note, not by how much text fits in it. Sized to
  // match `domainEvent`, which a storm reuses as its event.
  hotspot: { width: 180, height: 120 },
  opportunity: { width: 180, height: 120 },

  // DDD Application types (medium)
  command: { width: 180, height: 120 },
  query: { width: 180, height: 120 },
  applicationService: { width: 240, height: 170 },

  // DDD Infrastructure types (medium to large)
  integrationEvent: { width: 200, height: 140 },
  antiCorruptionLayer: { width: 280, height: 200 },
  saga: { width: 300, height: 200 },

  default: { width: 240, height: 170 },
};

const DEFAULT_SUBDOMAIN: Record<C4Type, SubdomainType> = {
  person: "supporting",
  system: "core",
  externalSystem: "generic",
  container: "core",
  component: "supporting",
};

const DEFAULT_INTEGRATION: Record<C4Type, IntegrationType> = {
  person: "functional",
  system: "contract",
  externalSystem: "contract",
  container: "intrusive",
  component: "intrusive",
};

const DEFAULT_COUPLING_PROFILE: Record<C4Type, CouplingProfile> = {
  person: { strength: 2, distance: 8, volatility: 2 },
  system: { strength: 6, distance: 5, volatility: 6 },
  externalSystem: { strength: 4, distance: 9, volatility: 3 },
  container: { strength: 8, distance: 3, volatility: 7 },
  component: { strength: 7, distance: 4, volatility: 5 },
};

// DDD type defaults
const DDD_DEFAULT_SUBDOMAIN: Record<DDDType, SubdomainType> = {
  // Strategic - typically core domain
  boundedContext: "core",
  aggregate: "core",
  domainEvent: "core",
  // Tactical - core domain elements
  entity: "core",
  valueObject: "core",
  domainService: "core",
  repository: "supporting",
  factory: "supporting",
  // Application - supporting
  command: "supporting",
  query: "supporting",
  applicationService: "supporting",
  // Infrastructure - generic/supporting
  integrationEvent: "generic",
  antiCorruptionLayer: "supporting",
  saga: "supporting",
};

const DDD_DEFAULT_INTEGRATION: Record<DDDType, IntegrationType> = {
  // Strategic - contract-based boundaries
  boundedContext: "contract",
  aggregate: "contract",
  domainEvent: "functional",
  // Tactical - varies by role
  entity: "intrusive",
  valueObject: "functional",
  domainService: "contract",
  repository: "contract",
  factory: "contract",
  // Application - contract-based
  command: "functional",
  query: "functional",
  applicationService: "contract",
  // Infrastructure - contract boundaries
  integrationEvent: "functional",
  antiCorruptionLayer: "contract",
  saga: "contract",
};

const DDD_DEFAULT_COUPLING_PROFILE: Record<DDDType, CouplingProfile> = {
  // Strategic - high distance, moderate strength
  boundedContext: { strength: 4, distance: 9, volatility: 5 },
  aggregate: { strength: 7, distance: 6, volatility: 6 },
  domainEvent: { strength: 2, distance: 9, volatility: 4 },
  // Tactical - varies by role
  entity: { strength: 8, distance: 4, volatility: 7 },
  valueObject: { strength: 3, distance: 8, volatility: 2 },
  domainService: { strength: 6, distance: 5, volatility: 5 },
  repository: { strength: 5, distance: 7, volatility: 4 },
  factory: { strength: 4, distance: 7, volatility: 3 },
  // Application - moderate coupling
  command: { strength: 3, distance: 7, volatility: 4 },
  query: { strength: 2, distance: 8, volatility: 3 },
  applicationService: { strength: 6, distance: 5, volatility: 6 },
  // Infrastructure - low to moderate coupling
  integrationEvent: { strength: 2, distance: 9, volatility: 5 },
  antiCorruptionLayer: { strength: 5, distance: 8, volatility: 4 },
  saga: { strength: 7, distance: 4, volatility: 8 },
};

export const DEFAULT_ICON_BY_TYPE: Partial<Record<NodeType, BuiltInIconId>> = {
  // C4 icons
  person: "phosphor:user-duotone",
  system: "phosphor:package-duotone",
  externalSystem: "phosphor:cloud-duotone",
  container: "phosphor:stack-duotone",
  component: "phosphor:cube-duotone",

  // DDD Strategic icons
  boundedContext: "phosphor:package-duotone",
  aggregate: "phosphor:cube-duotone",
  domainEvent: "phosphor:package-duotone",

  // DDD Tactical icons
  entity: "phosphor:user-duotone",
  valueObject: "phosphor:package-duotone",
  domainService: "phosphor:package-duotone",
  repository: "phosphor:package-duotone",
  factory: "phosphor:package-duotone",

  // DDD Application icons
  command: "phosphor:package-duotone",
  query: "phosphor:package-duotone",
  applicationService: "phosphor:package-duotone",

  // DDD Infrastructure icons
  integrationEvent: "phosphor:package-duotone",
  antiCorruptionLayer: "phosphor:package-duotone",
  saga: "phosphor:package-duotone",
};

const snapToGrid = (value: number): number => Math.round(value / GRID_SIZE) * GRID_SIZE;

const resolveType = (node: Node): NodeType => {
  const data = node.data as NodeData | undefined;
  const c4Type = data?.c4Type as C4Type | undefined;
  const dddType = data?.dddType as DDDType | undefined;
  const nodeType = node.type as NodeType | undefined;

  // Prefer explicit type annotations, fallback to node.type
  return c4Type ?? dddType ?? nodeType ?? "system";
};

const getTypeDimensions = (type: NodeType): { width: number; height: number } =>
  DEFAULT_DIMENSIONS[type] ?? DEFAULT_DIMENSIONS.default;

export const getDefaultIconId = (type: NodeType): NodeIconId =>
  DEFAULT_ICON_BY_TYPE[type] ?? DEFAULT_ICON_BY_TYPE.system ?? "phosphor:package-duotone";

const isC4Type = (value: unknown): value is C4Type =>
  value === "person"
  || value === "system"
  || value === "externalSystem"
  || value === "container"
  || value === "component";

const isDDDType = (value: unknown): value is DDDType =>
  value === "boundedContext"
  || value === "aggregate"
  || value === "domainEvent"
  || value === "entity"
  || value === "valueObject"
  || value === "domainService"
  || value === "repository"
  || value === "factory"
  || value === "command"
  || value === "query"
  || value === "applicationService"
  || value === "integrationEvent"
  || value === "antiCorruptionLayer"
  || value === "saga";

export const getDefaultSubdomainType = (type: NodeType): SubdomainType => {
  if (isC4Type(type)) {
    return DEFAULT_SUBDOMAIN[type] ?? "supporting";
  }
  if (isDDDType(type)) {
    return DDD_DEFAULT_SUBDOMAIN[type] ?? "core";
  }
  return "supporting";
};

export const getDefaultIntegrationType = (type: NodeType): IntegrationType => {
  if (isC4Type(type)) {
    return DEFAULT_INTEGRATION[type] ?? "contract";
  }
  if (isDDDType(type)) {
    return DDD_DEFAULT_INTEGRATION[type] ?? "contract";
  }
  return "contract";
};

export const getDefaultCouplingProfile = (type: NodeType): CouplingProfile => {
  let profile: CouplingProfile | undefined;

  if (isC4Type(type)) {
    profile = DEFAULT_COUPLING_PROFILE[type];
  } else if (isDDDType(type)) {
    profile = DDD_DEFAULT_COUPLING_PROFILE[type];
  }

  return {
    strength: profile?.strength ?? 5,
    distance: profile?.distance ?? 5,
    volatility: profile?.volatility ?? 5,
  };
};

const getNodeDimensions = (node: Node): { width: number; height: number } => {
  const type = resolveType(node);
  const fallback = getTypeDimensions(type);

  const width = typeof node.measured?.width === "number"
    ? node.measured.width
    : typeof node.width === "number"
    ? node.width
    : typeof (node.style as { width?: number } | undefined)?.width === "number"
    ? (node.style as { width?: number }).width!
    : fallback.width;

  const height = typeof node.measured?.height === "number"
    ? node.measured.height
    : typeof node.height === "number"
    ? node.height
    : typeof (node.style as { height?: number } | undefined)?.height === "number"
    ? (node.style as { height?: number }).height!
    : fallback.height;

  return { width, height };
};

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

const calculateBounds = (nodes: Node[]): Bounds | null => {
  if (nodes.length === 0) {
    return null;
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  nodes.forEach((node) => {
    const { width, height } = getNodeDimensions(node);
    const x = node.position.x;
    const y = node.position.y;

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  });

  const boundsWidth = maxX - minX;
  const boundsHeight = maxY - minY;

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: boundsWidth,
    height: boundsHeight,
    centerX: minX + boundsWidth / 2,
    centerY: minY + boundsHeight / 2,
  };
};

/**
 * Generate a stable unique node id
 */
const generateNodeId = (prefix: string): string => `${prefix}-${nanoid(12)}`;

/**
 * Check if a node is a container type (can contain child nodes)
 * - C4: container
 * - DDD: boundedContext (strategic grouping), aggregate (tactical grouping)
 */
export const isContainerNode = (node: Node | null): Effect.Effect<boolean> => {
  return Effect.succeed(
    node?.type === "container"
      || node?.type === "boundedContext"
      || node?.type === "aggregate",
  );
};

/**
 * Get position for a node inside a container
 */
export const getChildPosition = (): Effect.Effect<NodePosition> => {
  return Effect.succeed({ x: 20, y: 60 });
};

/**
 * Determine the position for a new node based on parent context
 */
export const determineNodePosition = (
  nodeCount: number,
  selectedNode: Node | null,
  existingNodes: Node[],
  newNodeType: NodeType,
): Effect.Effect<NodePosition> => {
  return Effect.gen(function*() {
    const isContainer = yield* isContainerNode(selectedNode);

    if (isContainer) {
      return yield* getChildPosition();
    }

    const rootNodes = existingNodes.filter((node) => !node.parentId);
    const bounds = calculateBounds(rootNodes);
    const { width, height } = getTypeDimensions(newNodeType);

    if (!bounds) {
      return {
        x: snapToGrid(DEFAULT_PLACEMENT_CENTER.x - width / 2),
        y: snapToGrid(DEFAULT_PLACEMENT_CENTER.y - height / 2),
      };
    }

    const maxSpan = Math.max(bounds.width, bounds.height);
    const baseRadius = Math.max(maxSpan / 2, 160) + 120;
    const ringIndex = Math.floor(nodeCount / 6);
    const radius = baseRadius + ringIndex * 80;
    const angle = (Math.PI / 3) * (nodeCount % 6);

    const rawX = bounds.centerX + Math.cos(angle) * radius - width / 2;
    const rawY = bounds.centerY + Math.sin(angle) * radius - height / 2;

    return {
      x: snapToGrid(rawX),
      y: snapToGrid(rawY),
    };
  });
};

/**
 * Create parent relationship properties if parent is a container
 */
export const createParentRelationship = (
  selectedNode: Node | null,
): Effect.Effect<{ parentId: string; extent: "parent"; expandParent: boolean } | null> => {
  return Effect.gen(function*() {
    const isContainer = yield* isContainerNode(selectedNode);

    if (!isContainer || !selectedNode) {
      return null;
    }

    return {
      parentId: selectedNode.id,
      extent: "parent" as const,
      expandParent: true,
    };
  });
};

/**
 * Get default label for a node type
 */
export const getDefaultLabel = (type: NodeType): Effect.Effect<string> => {
  const labels: Partial<Record<NodeType, string>> = {
    // C4 labels
    person: "New Person",
    system: "New System",
    externalSystem: "External System",
    container: "Container",
    component: "Component",

    // DDD Strategic labels
    boundedContext: "Bounded Context",
    aggregate: "Aggregate",
    domainEvent: "Domain Event",

    // DDD Tactical labels
    entity: "Entity",
    valueObject: "Value Object",
    domainService: "Domain Service",
    repository: "Repository",
    factory: "Factory",

    // DDD Application labels
    command: "Command",
    query: "Query",
    applicationService: "Application Service",

    // DDD Infrastructure labels
    integrationEvent: "Integration Event",
    antiCorruptionLayer: "Anti-Corruption Layer",
    saga: "Saga",
  };

  return Effect.succeed(labels[type] ?? "New Node");
};

/**
 * Get default size for a node type
 */
export const getDefaultSize = (type: NodeType): Effect.Effect<{ width: number; height: number } | null> => {
  // Return explicit sizes for container-like types
  const sizes: Partial<Record<NodeType, { width: number; height: number }>> = {
    container: { width: 400, height: 300 },
    boundedContext: { width: 500, height: 400 },
    aggregate: { width: 320, height: 240 },
  };

  return Effect.succeed(sizes[type] ?? null);
};

/**
 * Create a new node with all necessary properties
 */
export const createNode = (options: CreateNodeOptions): Effect.Effect<Node> => {
  return Effect.gen(function*() {
    const { type, label, nodeCounter, selectedNodeId, existingNodes } = options;

    // Find selected node
    const selectedNode = selectedNodeId
      ? existingNodes.find((n) => n.id === selectedNodeId) ?? null
      : null;

    // Generate ID based on type
    const typePrefix = type === "externalSystem" ? "external" : type;
    const id = generateNodeId(typePrefix);

    // Determine position
    const position = yield* determineNodePosition(
      nodeCounter,
      selectedNode,
      existingNodes,
      type,
    );

    // Create parent relationship if applicable
    const parentRelationship = yield* createParentRelationship(selectedNode);

    // Get default label if not provided
    const defaultLabel = yield* getDefaultLabel(type);
    const finalLabel = label || defaultLabel;

    // Get default size
    const size = yield* getDefaultSize(type);

    // Determine if this is a C4 or DDD type
    const isC4 = isC4Type(type);
    const isDDD = isDDDType(type);

    // Get defaults for both C4 and DDD types
    const subdomainType = getDefaultSubdomainType(type);
    const integrationType = getDefaultIntegrationType(type);
    const couplingProfile = getDefaultCouplingProfile(type);
    const createdAt = Date.now();

    // Build node data
    const nodeData: NodeData = {
      label: finalLabel,
      description: "",
      technology: "",
      createdAt,
      iconId: getDefaultIconId(type),
      subdomainType,
      integrationType,
      couplingProfile,
      couplingScoreMode: "auto",
      ...(isC4 && {
        c4Type: type as C4Type,
      }),
      ...(isDDD && {
        dddType: type as DDDType,
      }),
    };

    // Build node
    const node: Node = {
      id,
      type: type === "externalSystem" ? "externalSystem" : type,
      position,
      data: nodeData,
      ...(size && { style: size }),
      ...(parentRelationship && parentRelationship),
    };

    return node;
  });
};

/**
 * Add a new node to the node list
 */
export const addNode = (
  nodes: Node[],
  newNode: Node,
): Effect.Effect<Node[]> => {
  return Effect.succeed([...nodes, newNode]);
};

/**
 * Update a node's data
 */
export const updateNodeData = (
  nodes: Node[],
  nodeId: string,
  updates: Partial<NodeData>,
): Effect.Effect<Node[]> => {
  return Effect.succeed(
    nodes.map((node) =>
      node.id === nodeId
        ? { ...node, data: { ...node.data, ...updates } }
        : node
    ),
  );
};

/**
 * Remove a node from the node list
 */
export const removeNode = (
  nodes: Node[],
  nodeId: string,
): Effect.Effect<Node[]> => {
  return Effect.succeed(nodes.filter((node) => node.id !== nodeId));
};

/**
 * Find a node by ID
 */
export const findNodeById = (
  nodes: Node[],
  nodeId: string,
): Effect.Effect<Node | null> => {
  return Effect.succeed(nodes.find((node) => node.id === nodeId) ?? null);
};
