import type { Edge, Node } from "@xyflow/react";
import type { EdgeCommunicationStyle, EdgeMetadata, EdgeProtocol } from "./effects/edge-operations";
import type {
  C4Type,
  CouplingOverrides,
  CouplingProfile,
  CouplingScoreMode,
  DDDType,
  IntegrationType,
  NodeData,
  NodeType,
  SubdomainType,
} from "./effects/node-operations";
import {
  getDefaultCouplingProfile,
  getDefaultIntegrationType,
  getDefaultSubdomainType,
} from "./effects/node-operations";

export type RiskTier = "low" | "medium" | "high";
export type BalancedCouplingModelVersion = "v1" | "v2";

export interface CouplingDimensions {
  strength: number;
  distance: number;
  volatility: number;
}

export interface CouplingFormulaExplanation {
  dimensions: CouplingDimensions;
  xorBalance: number;
  notVolatility: number;
  balance: number;
  systemicRisk: number;
}

export interface CouplingScoreContributor {
  id:
    | "profile"
    | "nodeType"
    | "integration"
    | "subdomain"
    | "topology"
    | "operational"
    | "organizational"
    | "hybridOverrides"
    | "manualOverrides";
  label: string;
  strength: number;
  distance: number;
  volatility: number;
  impact: number;
  note?: string;
}

export interface CouplingScoreProvenance {
  mode: CouplingScoreMode;
  modelVersion: BalancedCouplingModelVersion;
  strategy: "legacy-v1" | "auto-derived" | "hybrid-override" | "manual-curated";
  overrideKeys: string[];
  taxonomyOverrides: Array<"integrationType" | "subdomainType">;
  signals: {
    topology: boolean;
    operational: boolean;
    organizational: boolean;
  };
}

export interface ModuleCouplingSnapshot {
  id: string;
  label: string;
  type: NodeType;
  scoreMode: CouplingScoreMode;
  subdomainType: SubdomainType;
  integrationType: IntegrationType;
  profile: CouplingProfile;
  modelVersion: BalancedCouplingModelVersion;
  modularity: number;
  balance: number;
  systemicRisk: number;
  riskTier: RiskTier;
  volatilityPropagation: number;
  outboundDependencies: string[];
  inboundDependents: string[];
  technology?: string | undefined;
  description?: string | undefined;
  formulaExplanation?: CouplingFormulaExplanation;
  contributors?: CouplingScoreContributor[];
  provenance?: CouplingScoreProvenance;
}

export interface CouplingAggregateMetrics {
  totalModules: number;
  averageModularity: number;
  averageBalance: number;
  averageRisk: number;
  maxRisk: number;
  riskDistribution: Record<RiskTier, number>;
  totalPropagation: number;
}

export interface BalancedCouplingModel {
  version: BalancedCouplingModelVersion;
  snapshots: ModuleCouplingSnapshot[];
  aggregate: CouplingAggregateMetrics;
}

export interface BuildBalancedCouplingModelOptions {
  version?: BalancedCouplingModelVersion;
}

let activeModelVersion: BalancedCouplingModelVersion = "v2";

const clamp = (value: number, min = 1, max = 10): number => Math.max(min, Math.min(max, value));

const round1 = (value: number): number => Number(value.toFixed(1));

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const normalizeProfile = (profile: CouplingProfile): CouplingProfile => ({
  strength: clamp(Math.round(profile.strength)),
  distance: clamp(Math.round(profile.distance)),
  volatility: clamp(Math.round(profile.volatility)),
});

const toNodeData = (node: Node): Partial<NodeData> => {
  if (node && typeof node.data === "object" && node.data !== null) {
    return node.data as Partial<NodeData>;
  }
  return {};
};

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

const isSubdomainType = (value: unknown): value is SubdomainType =>
  value === "core" || value === "generic" || value === "supporting";

const isIntegrationType = (value: unknown): value is IntegrationType =>
  value === "intrusive" || value === "contract" || value === "functional";

const isCouplingScoreMode = (value: unknown): value is CouplingScoreMode =>
  value === "auto" || value === "hybrid" || value === "manual";

const isEdgeProtocol = (value: unknown): value is EdgeProtocol =>
  value === "http"
  || value === "https"
  || value === "grpc"
  || value === "graphql"
  || value === "websocket"
  || value === "mcp"
  || value === "kafka"
  || value === "rabbitmq"
  || value === "redis"
  || value === "rest"
  || value === "soap"
  || value === "tcp"
  || value === "udp"
  || value === "custom";

const isEdgeCommunicationStyle = (
  value: unknown,
): value is EdgeCommunicationStyle =>
  value === "synchronous"
  || value === "asynchronous"
  || value === "optional";

const integrationDimensionDelta: Record<IntegrationType, CouplingDimensions> = {
  intrusive: {
    strength: 1.4,
    distance: -0.8,
    volatility: 0.6,
  },
  contract: {
    strength: 0.4,
    distance: 0.6,
    volatility: 0.2,
  },
  functional: {
    strength: -0.4,
    distance: 0.9,
    volatility: -0.2,
  },
};

const subdomainDimensionDelta: Record<SubdomainType, CouplingDimensions> = {
  core: {
    strength: 0.5,
    distance: -0.2,
    volatility: 0.8,
  },
  supporting: {
    strength: 0.2,
    distance: 0.1,
    volatility: 0.3,
  },
  generic: {
    strength: -0.3,
    distance: 0.3,
    volatility: -0.2,
  },
};

const nodeTypeDimensionDelta: Partial<Record<NodeType, CouplingDimensions>> = {
  person: { strength: -0.7, distance: 0.8, volatility: -0.5 },
  system: { strength: 0.6, distance: 0.3, volatility: 0.6 },
  externalSystem: { strength: -0.1, distance: 1.0, volatility: -0.2 },
  container: { strength: 1.0, distance: -0.2, volatility: 0.8 },
  component: { strength: 1.2, distance: -0.5, volatility: 0.7 },
  boundedContext: { strength: 0.2, distance: 1.1, volatility: 0.5 },
  aggregate: { strength: 1.0, distance: 0.2, volatility: 0.8 },
  domainEvent: { strength: -0.5, distance: 1.0, volatility: 0.3 },
  entity: { strength: 1.1, distance: -0.3, volatility: 0.9 },
  valueObject: { strength: -0.4, distance: 0.9, volatility: -0.2 },
  domainService: { strength: 0.6, distance: 0.5, volatility: 0.5 },
  repository: { strength: 0.7, distance: 0.6, volatility: 0.4 },
  factory: { strength: 0.4, distance: 0.6, volatility: 0.3 },
  command: { strength: -0.3, distance: 0.8, volatility: 0.2 },
  query: { strength: -0.5, distance: 0.9, volatility: 0.1 },
  applicationService: { strength: 0.8, distance: 0.3, volatility: 0.6 },
  integrationEvent: { strength: -0.2, distance: 1.0, volatility: 0.5 },
  antiCorruptionLayer: { strength: 0.3, distance: 1.2, volatility: 0.4 },
  saga: { strength: 0.9, distance: 0.4, volatility: 1.0 },
};

const communicationStyleWeight: Record<EdgeCommunicationStyle, number> = {
  synchronous: 1.25,
  asynchronous: 1,
  optional: 0.7,
};

const communicationStyleStrengthPressure: Record<EdgeCommunicationStyle, number> = {
  synchronous: 1,
  asynchronous: 0.55,
  optional: 0.2,
};

const protocolDistanceWeight: Record<EdgeProtocol, number> = {
  http: 0.65,
  https: 0.65,
  grpc: 0.75,
  graphql: 0.8,
  websocket: 0.9,
  mcp: 0.85,
  kafka: 1,
  rabbitmq: 1,
  redis: 0.7,
  rest: 0.65,
  soap: 0.8,
  tcp: 0.9,
  udp: 0.95,
  custom: 0.75,
};

const defaultProtocolDistanceByIntegration: Record<IntegrationType, number> = {
  intrusive: 0.25,
  contract: 0.55,
  functional: 0.7,
};

const emptyDimensions: CouplingDimensions = {
  strength: 0,
  distance: 0,
  volatility: 0,
};

const resolveType = (node: Node): NodeType => {
  const data = toNodeData(node);
  const c4Type = data.c4Type;
  const dddType = data.dddType;
  const fallback = typeof node.type === "string" ? (node.type as NodeType) : undefined;

  if (c4Type && isC4Type(c4Type)) {
    return c4Type;
  }
  if (dddType && isDDDType(dddType)) {
    return dddType;
  }
  if (fallback && (isC4Type(fallback) || isDDDType(fallback))) {
    return fallback;
  }

  return "system";
};

const resolveSubdomainType = (
  type: NodeType,
  data: Partial<NodeData>,
): SubdomainType => {
  const candidate = data.subdomainType;
  if (candidate && isSubdomainType(candidate)) {
    return candidate;
  }
  return getDefaultSubdomainType(type);
};

const resolveIntegrationType = (
  type: NodeType,
  data: Partial<NodeData>,
): IntegrationType => {
  const candidate = data.integrationType;
  if (candidate && isIntegrationType(candidate)) {
    return candidate;
  }
  return getDefaultIntegrationType(type);
};

const resolveCouplingScoreMode = (data: Partial<NodeData>): CouplingScoreMode => {
  const mode = data.couplingScoreMode;
  if (mode && isCouplingScoreMode(mode)) {
    return mode;
  }
  return "auto";
};

const resolveCouplingOverrides = (
  data: Partial<NodeData>,
): CouplingOverrides => {
  const candidate = data.couplingOverrides;

  if (!candidate || typeof candidate !== "object") {
    return {};
  }

  const record = candidate as Record<string, unknown>;
  const strength = isFiniteNumber(record.strength)
    ? clamp(round1(record.strength))
    : undefined;
  const distance = isFiniteNumber(record.distance)
    ? clamp(round1(record.distance))
    : undefined;
  const volatility = isFiniteNumber(record.volatility)
    ? clamp(round1(record.volatility))
    : undefined;
  const integrationType = isIntegrationType(record.integrationType)
    ? record.integrationType
    : undefined;
  const subdomainType = isSubdomainType(record.subdomainType)
    ? record.subdomainType
    : undefined;

  return {
    ...(strength !== undefined ? { strength } : {}),
    ...(distance !== undefined ? { distance } : {}),
    ...(volatility !== undefined ? { volatility } : {}),
    ...(integrationType ? { integrationType } : {}),
    ...(subdomainType ? { subdomainType } : {}),
  };
};

const resolveEffectiveSubdomainType = (
  type: NodeType,
  data: Partial<NodeData>,
  scoreMode: CouplingScoreMode,
  overrides: CouplingOverrides,
): SubdomainType => {
  const base = resolveSubdomainType(type, data);
  if (scoreMode === "auto") {
    return base;
  }
  return overrides.subdomainType ?? base;
};

const resolveEffectiveIntegrationType = (
  type: NodeType,
  data: Partial<NodeData>,
  scoreMode: CouplingScoreMode,
  overrides: CouplingOverrides,
): IntegrationType => {
  const base = resolveIntegrationType(type, data);
  if (scoreMode === "auto") {
    return base;
  }
  return overrides.integrationType ?? base;
};

const resolveCouplingProfile = (
  type: NodeType,
  data: Partial<NodeData>,
): CouplingProfile => {
  const candidate = data.couplingProfile;

  if (
    candidate
    && isFiniteNumber(candidate.strength)
    && isFiniteNumber(candidate.distance)
    && isFiniteNumber(candidate.volatility)
  ) {
    return normalizeProfile(candidate);
  }

  return { ...getDefaultCouplingProfile(type) };
};

const getNodeTypeDelta = (type: NodeType): CouplingDimensions => nodeTypeDimensionDelta[type] ?? emptyDimensions;

const readTeamOwnership = (data: Partial<NodeData>): string | null => {
  const value = data.teamOwnership;

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  return trimmed.toLowerCase();
};

const toEdgeMetadata = (edge: Edge): EdgeMetadata | null => {
  const edgeData = edge.data;
  if (!edgeData || typeof edgeData !== "object") {
    return null;
  }

  const metadataCandidate = (edgeData as { metadata?: unknown }).metadata;
  if (!metadataCandidate || typeof metadataCandidate !== "object") {
    return null;
  }

  const metadataRecord = metadataCandidate as Record<string, unknown>;
  const protocolCandidate = metadataRecord.protocol;
  const styleCandidate = metadataRecord.communicationStyle;
  const requestVolumeCandidate = metadataRecord.requestVolume;
  const latencyCandidate = metadataRecord.latency;
  const notesCandidate = metadataRecord.notes;

  return {
    ...(isEdgeProtocol(protocolCandidate) ? { protocol: protocolCandidate } : {}),
    ...(isEdgeCommunicationStyle(styleCandidate)
      ? { communicationStyle: styleCandidate }
      : {}),
    ...(isFiniteNumber(requestVolumeCandidate)
      ? { requestVolume: requestVolumeCandidate }
      : {}),
    ...(isFiniteNumber(latencyCandidate) ? { latency: latencyCandidate } : {}),
    ...(typeof notesCandidate === "string" ? { notes: notesCandidate } : {}),
  };
};

const edgeStructuralWeight = (
  metadata: EdgeMetadata | null,
): number => {
  const style = metadata?.communicationStyle ?? "asynchronous";
  const requestVolume = metadata?.requestVolume;
  const volumeWeight = isFiniteNumber(requestVolume) && requestVolume > 0
    ? 1 + Math.min(1.5, Math.log10(requestVolume + 1) * 0.35)
    : 1;

  return communicationStyleWeight[style] * volumeWeight;
};

const toRequestVolumePressure = (requestVolume: number | undefined): number => {
  if (!isFiniteNumber(requestVolume) || requestVolume <= 0) {
    return 0;
  }
  return Math.min(1.8, Math.log10(requestVolume + 1));
};

const toLatencyPressure = (latency: number | undefined): number => {
  if (!isFiniteNumber(latency) || latency <= 0) {
    return 0;
  }
  return Math.min(1.5, latency / 400);
};

const sumDimensions = (
  ...entries: ReadonlyArray<CouplingDimensions>
): CouplingDimensions =>
  entries.reduce(
    (acc, entry) => ({
      strength: acc.strength + entry.strength,
      distance: acc.distance + entry.distance,
      volatility: acc.volatility + entry.volatility,
    }),
    {
      strength: 0,
      distance: 0,
      volatility: 0,
    },
  );

const normalizeDimensions = (
  dimensions: CouplingDimensions,
): CouplingDimensions => ({
  strength: clamp(round1(dimensions.strength)),
  distance: clamp(round1(dimensions.distance)),
  volatility: clamp(round1(dimensions.volatility)),
});

const mergeDimensionOverrides = ({
  baseDimensions,
  overrides,
}: {
  baseDimensions: CouplingDimensions;
  overrides: CouplingOverrides;
}): CouplingDimensions =>
  normalizeDimensions({
    strength: overrides.strength ?? baseDimensions.strength,
    distance: overrides.distance ?? baseDimensions.distance,
    volatility: overrides.volatility ?? baseDimensions.volatility,
  });

const toManualDimensions = ({
  profile,
  overrides,
}: {
  profile: CouplingProfile;
  overrides: CouplingOverrides;
}): CouplingDimensions =>
  normalizeDimensions({
    strength: overrides.strength ?? profile.strength,
    distance: overrides.distance ?? profile.distance,
    volatility: overrides.volatility ?? profile.volatility,
  });

const toContributor = (
  id: CouplingScoreContributor["id"],
  label: string,
  dimensions: CouplingDimensions,
  note?: string,
): CouplingScoreContributor => {
  const strength = round1(dimensions.strength);
  const distance = round1(dimensions.distance);
  const volatility = round1(dimensions.volatility);
  const impact = round1(
    Math.abs(strength)
      + Math.abs(distance)
      + Math.abs(volatility),
  );

  return {
    id,
    label,
    strength,
    distance,
    volatility,
    impact,
    ...(note ? { note } : {}),
  };
};

const toContributorDelta = (
  from: CouplingDimensions,
  to: CouplingDimensions,
): CouplingDimensions => ({
  strength: round1(to.strength - from.strength),
  distance: round1(to.distance - from.distance),
  volatility: round1(to.volatility - from.volatility),
});

const isNonZeroContributor = (contributor: CouplingScoreContributor): boolean => contributor.impact > 0;

const sortContributors = (
  contributors: CouplingScoreContributor[],
): CouplingScoreContributor[] => [...contributors].sort((left, right) => right.impact - left.impact);

const toProvenance = ({
  mode,
  modelVersion,
  overrides,
  includeDerivedSignals,
}: {
  mode: CouplingScoreMode;
  modelVersion: BalancedCouplingModelVersion;
  overrides: CouplingOverrides;
  includeDerivedSignals: boolean;
}): CouplingScoreProvenance => {
  const taxonomyOverrides: Array<"integrationType" | "subdomainType"> = [];
  if (overrides.integrationType !== undefined) {
    taxonomyOverrides.push("integrationType");
  }
  if (overrides.subdomainType !== undefined) {
    taxonomyOverrides.push("subdomainType");
  }

  return {
    mode,
    modelVersion,
    strategy: modelVersion === "v1"
      ? "legacy-v1"
      : mode === "manual"
      ? "manual-curated"
      : mode === "hybrid"
      ? "hybrid-override"
      : "auto-derived",
    overrideKeys: Object.keys(overrides),
    taxonomyOverrides,
    signals: {
      topology: includeDerivedSignals,
      operational: includeDerivedSignals,
      organizational: includeDerivedSignals,
    },
  };
};

const computeVolatilityPropagation = (
  volatility: number,
  outboundCount: number,
): number => {
  const propagationFactor = 0.5 + Math.min(0.6, outboundCount * 0.15);
  return clamp(Math.round(volatility * propagationFactor));
};

const toRiskTier = (risk: number): RiskTier => {
  if (risk >= 8) {
    return "high";
  }
  if (risk >= 5) {
    return "medium";
  }
  return "low";
};

const computeLegacyModularity = ({ strength, distance }: CouplingProfile): number =>
  clamp(Math.abs(strength - distance) + 1);

const computeLegacyBalance = (modularity: number, volatility: number): number =>
  clamp(Math.max(modularity, 10 - volatility + 1));

const legacyIntegrationWeight: Record<IntegrationType, number> = {
  intrusive: 3,
  contract: 1,
  functional: 0,
};

const legacySubdomainWeight: Record<SubdomainType, number> = {
  core: 2,
  supporting: 1,
  generic: 0,
};

const computeLegacySystemicRisk = ({
  volatility,
  modularity,
  balance,
  integrationType,
  subdomainType,
  dependencyLoad,
  dependentCount,
}: {
  volatility: number;
  modularity: number;
  balance: number;
  integrationType: IntegrationType;
  subdomainType: SubdomainType;
  dependencyLoad: number;
  dependentCount: number;
}): number => {
  const integrationImpact = legacyIntegrationWeight[integrationType] * 1.5;
  const subdomainImpact = legacySubdomainWeight[subdomainType] * 1.2;
  const connectionImpact = Math.min(4, dependencyLoad + dependentCount) * 0.6;
  const raw = volatility * 0.35
    + balance * 0.35
    + modularity * 0.2
    + integrationImpact
    + subdomainImpact
    + connectionImpact;

  return clamp(Math.round(raw));
};

const toCouplingDimensions = (profile: CouplingProfile): CouplingDimensions => ({
  strength: clamp(profile.strength),
  distance: clamp(profile.distance),
  volatility: clamp(profile.volatility),
});

const evaluateCouplingFormula = (
  dimensions: CouplingDimensions,
): CouplingFormulaExplanation => {
  const xorBalance = clamp(10 - Math.abs(dimensions.strength - dimensions.distance));
  const notVolatility = clamp(11 - dimensions.volatility);
  const balance = clamp(Math.max(xorBalance, notVolatility));
  const systemicRisk = clamp(11 - balance);

  return {
    dimensions: {
      strength: round1(dimensions.strength),
      distance: round1(dimensions.distance),
      volatility: round1(dimensions.volatility),
    },
    xorBalance: round1(xorBalance),
    notVolatility: round1(notVolatility),
    balance: round1(balance),
    systemicRisk: round1(systemicRisk),
  };
};

export const getBalancedCouplingModelVersion = (): BalancedCouplingModelVersion => activeModelVersion;

export const setBalancedCouplingModelVersion = (
  version: BalancedCouplingModelVersion,
): void => {
  activeModelVersion = version;
};

const resolveModelVersion = (
  requested?: BalancedCouplingModelVersion,
): BalancedCouplingModelVersion => requested ?? getBalancedCouplingModelVersion();

interface AdjacencyEntry {
  outbound: string[];
  inbound: string[];
  outboundEdges: Edge[];
  inboundEdges: Edge[];
}

const buildAdjacencyMap = (
  nodes: Node[],
  edges: Edge[],
): Map<string, AdjacencyEntry> => {
  const map = new Map<string, AdjacencyEntry>();

  nodes.forEach((node) => {
    map.set(node.id, {
      outbound: [],
      inbound: [],
      outboundEdges: [],
      inboundEdges: [],
    });
  });

  edges.forEach((edge) => {
    const source = map.get(edge.source);
    const target = map.get(edge.target);

    if (source) {
      source.outbound.push(edge.target);
      source.outboundEdges.push(edge);
    }

    if (target) {
      target.inbound.push(edge.source);
      target.inboundEdges.push(edge);
    }
  });

  return map;
};

const buildComponentSizeMap = (
  adjacency: Map<string, AdjacencyEntry>,
): Map<string, number> => {
  let currentIndex = 0;
  const indexByNodeId = new Map<string, number>();
  const lowLinkByNodeId = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const componentSizeByNodeId = new Map<string, number>();

  const strongConnect = (nodeId: string): void => {
    indexByNodeId.set(nodeId, currentIndex);
    lowLinkByNodeId.set(nodeId, currentIndex);
    currentIndex += 1;
    stack.push(nodeId);
    onStack.add(nodeId);

    const entry = adjacency.get(nodeId);
    if (entry) {
      for (const neighborId of entry.outbound) {
        if (!adjacency.has(neighborId)) {
          continue;
        }

        if (!indexByNodeId.has(neighborId)) {
          strongConnect(neighborId);
          const currentLowLink = lowLinkByNodeId.get(nodeId) ?? 0;
          const neighborLowLink = lowLinkByNodeId.get(neighborId) ?? 0;
          lowLinkByNodeId.set(nodeId, Math.min(currentLowLink, neighborLowLink));
        } else if (onStack.has(neighborId)) {
          const currentLowLink = lowLinkByNodeId.get(nodeId) ?? 0;
          const neighborIndex = indexByNodeId.get(neighborId) ?? 0;
          lowLinkByNodeId.set(nodeId, Math.min(currentLowLink, neighborIndex));
        }
      }
    }

    const nodeIndex = indexByNodeId.get(nodeId) ?? -1;
    const nodeLowLink = lowLinkByNodeId.get(nodeId) ?? -1;
    if (nodeLowLink !== nodeIndex) {
      return;
    }

    const componentNodeIds: string[] = [];
    while (stack.length > 0) {
      const poppedNodeId = stack.pop();
      if (!poppedNodeId) {
        break;
      }

      onStack.delete(poppedNodeId);
      componentNodeIds.push(poppedNodeId);
      if (poppedNodeId === nodeId) {
        break;
      }
    }

    const componentSize = componentNodeIds.length;
    componentNodeIds.forEach((componentNodeId) => {
      componentSizeByNodeId.set(componentNodeId, componentSize);
    });
  };

  adjacency.forEach((_entry, nodeId) => {
    if (!indexByNodeId.has(nodeId)) {
      strongConnect(nodeId);
    }
  });

  return componentSizeByNodeId;
};

const computeTopologyPressure = ({
  adjacencyEntry,
  totalNodes,
  componentSize,
  hasSelfLoop,
}: {
  adjacencyEntry: AdjacencyEntry;
  totalNodes: number;
  componentSize: number;
  hasSelfLoop: boolean;
}): CouplingDimensions => {
  const weightedOutbound = adjacencyEntry.outboundEdges.reduce(
    (sum, edge) => sum + edgeStructuralWeight(toEdgeMetadata(edge)),
    0,
  );
  const weightedInbound = adjacencyEntry.inboundEdges.reduce(
    (sum, edge) => sum + edgeStructuralWeight(toEdgeMetadata(edge)),
    0,
  );

  const totalWeightedDegree = weightedOutbound + weightedInbound;
  const instability = totalWeightedDegree > 0
    ? weightedOutbound / totalWeightedDegree
    : 0;
  const hubPressure = totalNodes > 1
    ? Math.min(1, totalWeightedDegree / ((totalNodes - 1) * 1.8))
    : 0;
  const cyclePressure = componentSize > 1
    ? Math.min(1, (componentSize - 1) / Math.max(1, totalNodes - 1))
    : hasSelfLoop
    ? 0.5
    : 0;
  const connectionPressure = Math.min(2.5, totalWeightedDegree * 0.22);

  return {
    strength: connectionPressure + cyclePressure * 0.8,
    distance: instability * 1.8 + hubPressure * 1.1,
    volatility: cyclePressure * 2.2
      + instability * 1.1
      + Math.min(1.5, weightedInbound * 0.12),
  };
};

const computeOperationalPressure = ({
  adjacencyEntry,
  integrationType,
}: {
  adjacencyEntry: AdjacencyEntry;
  integrationType: IntegrationType;
}): CouplingDimensions => {
  const operationalEdges = [
    ...adjacencyEntry.outboundEdges,
    ...adjacencyEntry.inboundEdges,
  ];
  if (operationalEdges.length === 0) {
    return emptyDimensions;
  }

  let stylePressureTotal = 0;
  let protocolDistanceTotal = 0;
  let requestVolumeTotal = 0;
  let latencyPressureTotal = 0;

  operationalEdges.forEach((edge) => {
    const metadata = toEdgeMetadata(edge);
    const communicationStyle = metadata?.communicationStyle ?? "asynchronous";
    const protocol = metadata?.protocol;

    stylePressureTotal += communicationStyleStrengthPressure[communicationStyle];
    protocolDistanceTotal += protocol
      ? protocolDistanceWeight[protocol]
      : defaultProtocolDistanceByIntegration[integrationType];
    requestVolumeTotal += toRequestVolumePressure(metadata?.requestVolume);
    latencyPressureTotal += toLatencyPressure(metadata?.latency);
  });

  const count = operationalEdges.length;
  const stylePressure = stylePressureTotal / count;
  const protocolDistance = protocolDistanceTotal / count;
  const requestVolumePressure = requestVolumeTotal / count;
  const latencyPressure = latencyPressureTotal / count;

  return {
    strength: stylePressure * 1.1 + requestVolumePressure * 0.9,
    distance: protocolDistance * 1.4 + latencyPressure * 0.7,
    volatility: requestVolumePressure * 1.2 + latencyPressure * 0.5,
  };
};

const computeOrganizationalPressure = ({
  nodeId,
  adjacencyEntry,
  integrationType,
  teamByNodeId,
}: {
  nodeId: string;
  adjacencyEntry: AdjacencyEntry;
  integrationType: IntegrationType;
  teamByNodeId: Map<string, string | null>;
}): CouplingDimensions => {
  const ownTeam = teamByNodeId.get(nodeId) ?? null;
  const relatedNodeIds = new Set([
    ...adjacencyEntry.outbound,
    ...adjacencyEntry.inbound,
  ]);

  let crossTeamCount = 0;
  let unknownTeamCount = 0;

  relatedNodeIds.forEach((relatedNodeId) => {
    const relatedTeam = teamByNodeId.get(relatedNodeId) ?? null;
    if (!relatedTeam) {
      unknownTeamCount += 1;
      return;
    }

    if (!ownTeam) {
      return;
    }

    if (relatedTeam !== ownTeam) {
      crossTeamCount += 1;
    }
  });

  const missingOwnershipPenalty = ownTeam ? 0 : 1.1;
  const crossTeamIntrusiveDependencies = integrationType === "intrusive"
    ? crossTeamCount
    : 0;

  return {
    strength: Math.min(1.6, crossTeamIntrusiveDependencies * 0.5),
    distance: Math.min(1.4, crossTeamCount * 0.35),
    volatility: missingOwnershipPenalty
      + Math.min(2.2, crossTeamIntrusiveDependencies * 0.7)
      + Math.min(0.8, unknownTeamCount * 0.15),
  };
};

interface SnapshotMetrics {
  modularity: number;
  balance: number;
  systemicRisk: number;
  riskTier: RiskTier;
  formulaExplanation?: CouplingFormulaExplanation;
  contributors?: CouplingScoreContributor[];
  provenance: CouplingScoreProvenance;
}

interface SnapshotComputationInput {
  nodeId: string;
  type: NodeType;
  scoreMode: CouplingScoreMode;
  overrides: CouplingOverrides;
  profile: CouplingProfile;
  integrationType: IntegrationType;
  subdomainType: SubdomainType;
  dependencyLoad: number;
  dependentCount: number;
  adjacencyEntry: AdjacencyEntry;
  totalNodes: number;
  componentSize: number;
  teamByNodeId: Map<string, string | null>;
}

const computeSnapshotMetricsV1 = ({
  scoreMode,
  overrides,
  profile,
  integrationType,
  subdomainType,
  dependencyLoad,
  dependentCount,
}: SnapshotComputationInput): SnapshotMetrics => {
  const modularity = computeLegacyModularity(profile);
  const balance = computeLegacyBalance(modularity, profile.volatility);
  const systemicRisk = computeLegacySystemicRisk({
    volatility: profile.volatility,
    modularity,
    balance,
    integrationType,
    subdomainType,
    dependencyLoad,
    dependentCount,
  });

  return {
    modularity,
    balance,
    systemicRisk,
    riskTier: toRiskTier(systemicRisk),
    provenance: toProvenance({
      mode: scoreMode,
      modelVersion: "v1",
      overrides,
      includeDerivedSignals: true,
    }),
  };
};

const computeSnapshotMetricsV2 = (
  input: SnapshotComputationInput,
): SnapshotMetrics => {
  const typePressure = getNodeTypeDelta(input.type);
  const integrationPressure = integrationDimensionDelta[input.integrationType];
  const subdomainPressure = subdomainDimensionDelta[input.subdomainType];
  const topologyPressure = computeTopologyPressure({
    adjacencyEntry: input.adjacencyEntry,
    totalNodes: input.totalNodes,
    componentSize: input.componentSize,
    hasSelfLoop: input.adjacencyEntry.outbound.includes(input.nodeId),
  });
  const operationalPressure = computeOperationalPressure({
    adjacencyEntry: input.adjacencyEntry,
    integrationType: input.integrationType,
  });
  const organizationalPressure = computeOrganizationalPressure({
    nodeId: input.nodeId,
    adjacencyEntry: input.adjacencyEntry,
    integrationType: input.integrationType,
    teamByNodeId: input.teamByNodeId,
  });
  const rawDimensions = sumDimensions(
    toCouplingDimensions(input.profile),
    typePressure,
    integrationPressure,
    subdomainPressure,
    topologyPressure,
    operationalPressure,
    organizationalPressure,
  );
  const autoDimensions = normalizeDimensions(rawDimensions);
  const hybridDimensions = mergeDimensionOverrides({
    baseDimensions: autoDimensions,
    overrides: input.overrides,
  });
  const manualDimensions = toManualDimensions({
    profile: input.profile,
    overrides: input.overrides,
  });
  const normalizedDimensions = input.scoreMode === "manual"
    ? manualDimensions
    : input.scoreMode === "hybrid"
    ? hybridDimensions
    : autoDimensions;
  const formulaExplanation = evaluateCouplingFormula(normalizedDimensions);
  const modularity = formulaExplanation.xorBalance;
  const balance = formulaExplanation.balance;
  const systemicRisk = formulaExplanation.systemicRisk;

  const profileDimensions = toCouplingDimensions(input.profile);
  const contributors: CouplingScoreContributor[] = input.scoreMode === "manual"
    ? [
      toContributor(
        "profile",
        "NODE PROFILE",
        profileDimensions,
        "Base coupling profile for the node.",
      ),
      toContributor(
        "manualOverrides",
        "MANUAL OVERRIDES",
        toContributorDelta(profileDimensions, manualDimensions),
        "Manual mode ignores derived topology/operational/organizational signals.",
      ),
    ]
    : [
      toContributor(
        "profile",
        "NODE PROFILE",
        profileDimensions,
        "Base coupling profile for the node.",
      ),
      toContributor("nodeType", "NODE TYPE PRESSURE", typePressure),
      toContributor(
        "integration",
        "INTEGRATION PRESSURE",
        integrationPressure,
      ),
      toContributor("subdomain", "SUBDOMAIN PRESSURE", subdomainPressure),
      toContributor("topology", "TOPOLOGY PRESSURE", topologyPressure),
      toContributor(
        "operational",
        "OPERATIONAL PRESSURE",
        operationalPressure,
      ),
      toContributor(
        "organizational",
        "ORGANIZATIONAL PRESSURE",
        organizationalPressure,
      ),
      ...(input.scoreMode === "hybrid"
        ? [
          toContributor(
            "hybridOverrides",
            "HYBRID OVERRIDES",
            toContributorDelta(autoDimensions, hybridDimensions),
            "Hybrid mode starts from derived dimensions, then applies explicit numeric overrides.",
          ),
        ]
        : []),
    ];

  return {
    modularity,
    balance,
    systemicRisk,
    riskTier: toRiskTier(systemicRisk),
    formulaExplanation,
    contributors: sortContributors(
      contributors.filter(isNonZeroContributor),
    ),
    provenance: toProvenance({
      mode: input.scoreMode,
      modelVersion: "v2",
      overrides: input.overrides,
      includeDerivedSignals: input.scoreMode !== "manual",
    }),
  };
};

const computeSnapshotMetrics = (
  version: BalancedCouplingModelVersion,
  input: SnapshotComputationInput,
): SnapshotMetrics => {
  if (version === "v1") {
    return computeSnapshotMetricsV1(input);
  }

  return computeSnapshotMetricsV2(input);
};

export const buildModuleSnapshots = (
  nodes: Node[],
  edges: Edge[],
  options: BuildBalancedCouplingModelOptions = {},
): ModuleCouplingSnapshot[] => {
  if (nodes.length === 0) {
    return [];
  }

  const version = resolveModelVersion(options.version);
  const adjacency = buildAdjacencyMap(nodes, edges);
  const componentSizeByNodeId = buildComponentSizeMap(adjacency);
  const teamByNodeId = new Map(
    nodes.map((node) => [node.id, readTeamOwnership(toNodeData(node))] as const),
  );

  return nodes.map((node) => {
    const adjacencyEntry = adjacency.get(node.id) ?? {
      outbound: [],
      inbound: [],
      outboundEdges: [],
      inboundEdges: [],
    };
    const data = toNodeData(node);
    const type = resolveType(node);
    const scoreMode = resolveCouplingScoreMode(data);
    const overrides = resolveCouplingOverrides(data);
    const subdomainType = resolveEffectiveSubdomainType(
      type,
      data,
      scoreMode,
      overrides,
    );
    const integrationType = resolveEffectiveIntegrationType(
      type,
      data,
      scoreMode,
      overrides,
    );
    const profile = resolveCouplingProfile(type, data);
    const volatilityPropagation = computeVolatilityPropagation(
      profile.volatility,
      adjacencyEntry.outbound.length,
    );
    const metrics = computeSnapshotMetrics(version, {
      nodeId: node.id,
      type,
      scoreMode,
      overrides,
      profile,
      integrationType,
      subdomainType,
      dependencyLoad: adjacencyEntry.outbound.length,
      dependentCount: adjacencyEntry.inbound.length,
      adjacencyEntry,
      totalNodes: nodes.length,
      componentSize: componentSizeByNodeId.get(node.id) ?? 1,
      teamByNodeId,
    });

    const label = typeof data.label === "string" && data.label.trim().length > 0
      ? data.label.trim()
      : node.id;

    const technology = typeof data.technology === "string" && data.technology.trim().length > 0
      ? data.technology.trim()
      : undefined;

    const description = typeof data.description === "string" && data.description.trim().length > 0
      ? data.description.trim()
      : undefined;

    return {
      id: node.id,
      label,
      type,
      scoreMode,
      subdomainType,
      integrationType,
      profile,
      modelVersion: version,
      modularity: metrics.modularity,
      balance: metrics.balance,
      systemicRisk: metrics.systemicRisk,
      riskTier: metrics.riskTier,
      ...(metrics.formulaExplanation
        ? { formulaExplanation: metrics.formulaExplanation }
        : {}),
      ...(metrics.contributors
        ? { contributors: metrics.contributors }
        : {}),
      provenance: metrics.provenance,
      volatilityPropagation,
      outboundDependencies: adjacencyEntry.outbound,
      inboundDependents: adjacencyEntry.inbound,
      technology,
      description,
    };
  });
};

export const summarizeSnapshots = (
  snapshots: ModuleCouplingSnapshot[],
): CouplingAggregateMetrics => {
  if (snapshots.length === 0) {
    return {
      totalModules: 0,
      averageModularity: 0,
      averageBalance: 0,
      averageRisk: 0,
      maxRisk: 0,
      totalPropagation: 0,
      riskDistribution: {
        low: 0,
        medium: 0,
        high: 0,
      },
    };
  }

  const totals = snapshots.reduce(
    (acc, item) => {
      acc.modularity += item.modularity;
      acc.balance += item.balance;
      acc.risk += item.systemicRisk;
      acc.propagation += item.volatilityPropagation;
      acc.riskBuckets[item.riskTier] += 1;
      acc.maxRisk = Math.max(acc.maxRisk, item.systemicRisk);
      return acc;
    },
    {
      modularity: 0,
      balance: 0,
      risk: 0,
      propagation: 0,
      maxRisk: 0,
      riskBuckets: {
        low: 0,
        medium: 0,
        high: 0,
      },
    },
  );

  const count = snapshots.length;

  return {
    totalModules: count,
    averageModularity: round1(totals.modularity / count),
    averageBalance: round1(totals.balance / count),
    averageRisk: round1(totals.risk / count),
    maxRisk: totals.maxRisk,
    totalPropagation: totals.propagation,
    riskDistribution: totals.riskBuckets,
  };
};

export const buildBalancedCouplingModel = (
  nodes: Node[],
  edges: Edge[],
  options: BuildBalancedCouplingModelOptions = {},
): BalancedCouplingModel => {
  const version = resolveModelVersion(options.version);
  const snapshots = buildModuleSnapshots(nodes, edges, { version });
  const aggregate = summarizeSnapshots(snapshots);
  return { version, snapshots, aggregate };
};
