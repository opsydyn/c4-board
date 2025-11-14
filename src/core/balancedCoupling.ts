import type { Edge, Node } from "@xyflow/react";
import type {
	C4Type,
	DDDType,
	NodeType,
	CouplingProfile,
	IntegrationType,
	NodeData,
	SubdomainType,
} from "./effects/node-operations";
import {
	getDefaultCouplingProfile,
	getDefaultIntegrationType,
	getDefaultSubdomainType,
} from "./effects/node-operations";

export type RiskTier = "low" | "medium" | "high";

export interface ModuleCouplingSnapshot {
	id: string;
	label: string;
	type: NodeType; // Changed from C4Type to NodeType to support both C4 and DDD
	subdomainType: SubdomainType;
	integrationType: IntegrationType;
	profile: CouplingProfile;
	modularity: number;
	balance: number;
	systemicRisk: number;
	riskTier: RiskTier;
	volatilityPropagation: number;
	outboundDependencies: string[];
	inboundDependents: string[];
	technology?: string | undefined;
	description?: string | undefined;
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
	snapshots: ModuleCouplingSnapshot[];
	aggregate: CouplingAggregateMetrics;
}

const clamp = (value: number, min = 1, max = 10): number =>
	Math.max(min, Math.min(max, value));

const toNodeData = (node: Node): Partial<NodeData> => {
	if (node && typeof node.data === "object" && node.data !== null) {
		return node.data as Partial<NodeData>;
	}
	return {};
};

const resolveType = (node: Node): NodeType => {
	const data = toNodeData(node);
	const c4Type = data.c4Type;
	const dddType = data.dddType;
	const fallback = typeof node.type === "string" ? (node.type as NodeType) : undefined;

	// Prefer explicit type annotations
	if (c4Type && isC4Type(c4Type)) {
		return c4Type;
	}
	if (dddType && isDDDType(dddType)) {
		return dddType;
	}
	// Fallback to node.type
	if (fallback && (isC4Type(fallback) || isDDDType(fallback))) {
		return fallback;
	}

	return "system"; // Default fallback
};

const resolveSubdomainType = (type: NodeType, data: Partial<NodeData>): SubdomainType => {
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

const resolveCouplingProfile = (type: NodeType, data: Partial<NodeData>): CouplingProfile => {
	const candidate = data.couplingProfile;

	if (
		candidate &&
		isFiniteNumber(candidate.strength) &&
		isFiniteNumber(candidate.distance) &&
		isFiniteNumber(candidate.volatility)
	) {
		return normalizeProfile(candidate);
	}

	return { ...getDefaultCouplingProfile(type) };
};

const isFiniteNumber = (value: unknown): value is number =>
	typeof value === "number" && Number.isFinite(value);

const normalizeProfile = (profile: CouplingProfile): CouplingProfile => ({
	strength: clamp(Math.round(profile.strength)),
	distance: clamp(Math.round(profile.distance)),
	volatility: clamp(Math.round(profile.volatility)),
});

const isC4Type = (value: unknown): value is C4Type =>
	value === "person" ||
	value === "system" ||
	value === "externalSystem" ||
	value === "container" ||
	value === "component";

const isDDDType = (value: unknown): value is DDDType =>
	value === "boundedContext" ||
	value === "aggregate" ||
	value === "domainEvent" ||
	value === "entity" ||
	value === "valueObject" ||
	value === "domainService" ||
	value === "repository" ||
	value === "factory" ||
	value === "command" ||
	value === "query" ||
	value === "applicationService" ||
	value === "integrationEvent" ||
	value === "antiCorruptionLayer" ||
	value === "saga";

const isSubdomainType = (value: unknown): value is SubdomainType =>
	value === "core" || value === "generic" || value === "supporting";

const isIntegrationType = (value: unknown): value is IntegrationType =>
	value === "intrusive" || value === "contract" || value === "functional";

const computeModularity = ({ strength, distance }: CouplingProfile): number =>
	clamp(Math.abs(strength - distance) + 1);

const computeBalance = (modularity: number, volatility: number): number =>
	clamp(Math.max(modularity, 10 - volatility + 1));

const integrationWeight: Record<IntegrationType, number> = {
	intrusive: 3,
	contract: 1,
	functional: 0,
};

const subdomainWeight: Record<SubdomainType, number> = {
	core: 2,
	supporting: 1,
	generic: 0,
};

const computeVolatilityPropagation = (
	volatility: number,
	outboundCount: number,
): number => {
	const propagationFactor = 0.5 + Math.min(0.6, outboundCount * 0.15);
	return clamp(Math.round(volatility * propagationFactor));
};

const computeSystemicRisk = ({
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
	const integrationImpact = integrationWeight[integrationType] * 1.5;
	const subdomainImpact = subdomainWeight[subdomainType] * 1.2;
	const connectionImpact = Math.min(4, dependencyLoad + dependentCount) * 0.6;
	const raw =
		volatility * 0.35 +
		balance * 0.35 +
		modularity * 0.2 +
		integrationImpact +
		subdomainImpact +
		connectionImpact;

	return clamp(Math.round(raw));
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

interface AdjacencyEntry {
	outbound: string[];
	inbound: string[];
}

const buildAdjacencyMap = (nodes: Node[], edges: Edge[]): Map<string, AdjacencyEntry> => {
	const map = new Map<string, AdjacencyEntry>();

	nodes.forEach((node) => {
		map.set(node.id, { outbound: [], inbound: [] });
	});

	edges.forEach((edge) => {
		const source = map.get(edge.source);
		const target = map.get(edge.target);

		if (source) {
			source.outbound.push(edge.target);
		}

		if (target) {
			target.inbound.push(edge.source);
		}
	});

	return map;
};

export const buildModuleSnapshots = (
	nodes: Node[],
	edges: Edge[],
): ModuleCouplingSnapshot[] => {
	if (nodes.length === 0) {
		return [];
	}

	const adjacency = buildAdjacencyMap(nodes, edges);

	return nodes.map((node) => {
		const adjacencyEntry = adjacency.get(node.id) ?? { outbound: [], inbound: [] };
		const data = toNodeData(node);
		const type = resolveType(node);
		const subdomainType = resolveSubdomainType(type, data);
		const integrationType = resolveIntegrationType(type, data);
		const profile = resolveCouplingProfile(type, data);
		const modularity = computeModularity(profile);
		const balance = computeBalance(modularity, profile.volatility);
		const volatilityPropagation = computeVolatilityPropagation(
			profile.volatility,
			adjacencyEntry.outbound.length,
		);
		const systemicRisk = computeSystemicRisk({
			volatility: profile.volatility,
			modularity,
			balance,
			integrationType,
			subdomainType,
			dependencyLoad: adjacencyEntry.outbound.length,
			dependentCount: adjacencyEntry.inbound.length,
		});

		const label =
			typeof data.label === "string" && data.label.trim().length > 0
				? data.label.trim()
				: node.id;

		const technology =
			typeof data.technology === "string" && data.technology.trim().length > 0
				? data.technology.trim()
				: undefined;

		const description =
			typeof data.description === "string" && data.description.trim().length > 0
				? data.description.trim()
				: undefined;

		return {
			id: node.id,
			label,
			type,
			subdomainType,
			integrationType,
			profile,
			modularity,
			balance,
			systemicRisk,
			riskTier: toRiskTier(systemicRisk),
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
		averageModularity: Number((totals.modularity / count).toFixed(1)),
		averageBalance: Number((totals.balance / count).toFixed(1)),
		averageRisk: Number((totals.risk / count).toFixed(1)),
		maxRisk: totals.maxRisk,
		totalPropagation: totals.propagation,
		riskDistribution: totals.riskBuckets,
	};
};

export const buildBalancedCouplingModel = (
	nodes: Node[],
	edges: Edge[],
): BalancedCouplingModel => {
	const snapshots = buildModuleSnapshots(nodes, edges);
	const aggregate = summarizeSnapshots(snapshots);
	return { snapshots, aggregate };
};
