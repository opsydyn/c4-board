import type { Edge, Node } from "@xyflow/react";
import { ParentSize } from "@visx/responsive";
import { useMemo } from "react";
import { Group } from "@visx/group";
import { LinePath } from "@visx/shape";
import { curveMonotoneX } from "@visx/curve";
import { scaleLinear, scaleTime } from "@visx/scale";
import { Circle } from "@visx/shape";
import {
	CubeIcon,
	GitBranchIcon,
	ClockIcon,
	UserIcon,
	PackageIcon,
	CloudIcon,
	StackIcon,
	BoundingBoxIcon,
	LightningIcon,
	SquareIcon,
	DiamondIcon,
	GearIcon,
	DatabaseIcon,
	FactoryIcon,
	ArrowRightIcon,
	MagnifyingGlassIcon,
	UsersIcon,
	ShareNetworkIcon,
	ShieldIcon,
	GitBranchIcon as SagaIcon,
} from "@phosphor-icons/react";
import {
	evolutionCard,
	evolutionHeader,
	evolutionTitle,
	evolutionMeta,
	evolutionChart,
	evolutionLegend,
	evolutionLegendItem,
	evolutionLegendSwatch,
	evolutionLegendLabel,
	evolutionSummaryGrid,
	evolutionSummaryItem,
	evolutionSummaryLabel,
	evolutionSummaryValue,
	evolutionEmptyState,
} from "./styles.css";
import { theme } from "../../styles/theme.css";
import type { C4Type, DDDType, NodeType, NodeData } from "../../core/effects/node-operations";
import type { DiagramDomain } from "../machines/canvas.machine";

const C4_TYPE_ORDER: C4Type[] = ["person", "system", "externalSystem", "container", "component"];

const DDD_TYPE_ORDER: DDDType[] = [
	"boundedContext",
	"aggregate",
	"domainEvent",
	"entity",
	"valueObject",
	"domainService",
	"repository",
	"factory",
	"command",
	"query",
	"applicationService",
	"integrationEvent",
	"antiCorruptionLayer",
	"saga",
];

const C4_SINGULAR_LABEL: Record<C4Type, string> = {
	person: "Person",
	system: "System",
	externalSystem: "External System",
	container: "Container",
	component: "Component",
};

const C4_PLURAL_LABEL: Record<C4Type, string> = {
	person: "People",
	system: "Systems",
	externalSystem: "External Systems",
	container: "Containers",
	component: "Components",
};

const DDD_SINGULAR_LABEL: Record<DDDType, string> = {
	boundedContext: "Bounded Context",
	aggregate: "Aggregate",
	domainEvent: "Domain Event",
	entity: "Entity",
	valueObject: "Value Object",
	domainService: "Domain Service",
	repository: "Repository",
	factory: "Factory",
	command: "Command",
	query: "Query",
	applicationService: "Application Service",
	integrationEvent: "Integration Event",
	antiCorruptionLayer: "ACL",
	saga: "Saga",
};

const DDD_PLURAL_LABEL: Record<DDDType, string> = {
	boundedContext: "Bounded Contexts",
	aggregate: "Aggregates",
	domainEvent: "Domain Events",
	entity: "Entities",
	valueObject: "Value Objects",
	domainService: "Domain Services",
	repository: "Repositories",
	factory: "Factories",
	command: "Commands",
	query: "Queries",
	applicationService: "Application Services",
	integrationEvent: "Integration Events",
	antiCorruptionLayer: "ACLs",
	saga: "Sagas",
};

const C4_COLOR: Record<C4Type, string> = {
	person: theme.color.semantic.person,
	system: theme.color.semantic.system,
	externalSystem: theme.color.semantic.external,
	container: theme.color.semantic.container,
	component: theme.color.semantic.component,
};

const DDD_COLOR: Record<DDDType, string> = {
	boundedContext: theme.color.semantic.boundedContext,
	aggregate: theme.color.semantic.aggregate,
	domainEvent: theme.color.semantic.domainEvent,
	entity: theme.color.semantic.entity,
	valueObject: theme.color.semantic.valueObject,
	domainService: theme.color.semantic.domainService,
	repository: theme.color.semantic.repository,
	factory: theme.color.semantic.factory,
	command: theme.color.semantic.command,
	query: theme.color.semantic.query,
	applicationService: theme.color.semantic.applicationService,
	integrationEvent: theme.color.semantic.integrationEvent,
	antiCorruptionLayer: theme.color.semantic.acl,
	saga: theme.color.semantic.saga,
};

const C4_ICON = {
	person: UserIcon,
	system: PackageIcon,
	externalSystem: CloudIcon,
	container: StackIcon,
	component: CubeIcon,
} as const;

const DDD_ICON = {
	boundedContext: BoundingBoxIcon,
	aggregate: CubeIcon,
	domainEvent: LightningIcon,
	entity: SquareIcon,
	valueObject: DiamondIcon,
	domainService: GearIcon,
	repository: DatabaseIcon,
	factory: FactoryIcon,
	command: ArrowRightIcon,
	query: MagnifyingGlassIcon,
	applicationService: UsersIcon,
	integrationEvent: ShareNetworkIcon,
	antiCorruptionLayer: ShieldIcon,
	saga: SagaIcon,
} as const;

const isC4Type = (value: unknown): value is C4Type =>
	typeof value === "string" && (C4_TYPE_ORDER as readonly string[]).includes(value);

const isDDDType = (value: unknown): value is DDDType =>
	typeof value === "string" && (DDD_TYPE_ORDER as readonly string[]).includes(value);

const createEmptyC4TypeCounts = (): Record<C4Type, number> => {
	const counts = {} as Record<C4Type, number>;
	for (const type of C4_TYPE_ORDER) {
		counts[type] = 0;
	}
	return counts;
};

const createEmptyDDDTypeCounts = (): Record<DDDType, number> => {
	const counts = {} as Record<DDDType, number>;
	for (const type of DDD_TYPE_ORDER) {
		counts[type] = 0;
	}
	return counts;
};

type EvolutionPoint = {
	time: number;
	totalNodes: number;
	edgeCount: number;
	c4TypeCounts: Record<C4Type, number>;
	dddTypeCounts: Record<DDDType, number>;
};

type EvolutionEvent =
	| {
			time: number;
			type: "node";
			label: string;
			nodeType: NodeType;
	  }
	| {
			time: number;
			type: "edge";
			label: string;
	  };

interface EvolutionModel {
	points: EvolutionPoint[];
	latestEvent: EvolutionEvent | null;
	totalNodes: number;
	totalEdges: number;
	c4TypeTotals: Record<C4Type, number>;
	dddTypeTotals: Record<DDDType, number>;
	firstSeenAt: number | null;
	lastUpdatedAt: number | null;
	domain: DiagramDomain;
}

const ensureTimestamp = (value: unknown, fallback: number): number => {
	if (typeof value === "number" && Number.isFinite(value) && value > 0) {
		return value;
	}
	return fallback;
};

const formatEventLabel = (event: EvolutionEvent | null): string => {
	if (!event) {
		return "Awaiting first change";
	}

	const time = new Date(event.time);
	const timeLabel = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

	if (event.type === "node") {
		const typeLabel = isC4Type(event.nodeType)
			? C4_SINGULAR_LABEL[event.nodeType]
			: isDDDType(event.nodeType)
			? DDD_SINGULAR_LABEL[event.nodeType]
			: "Node";
		return `+ ${typeLabel} · ${event.label} · ${timeLabel}`;
	}

	return `+ Connection · ${event.label} · ${timeLabel}`;
};

const useEvolutionModel = (nodes: Node[], edges: Edge[], domain: DiagramDomain): EvolutionModel =>
	useMemo(() => {
		if (nodes.length === 0 && edges.length === 0) {
			return {
				points: [],
				latestEvent: null,
				totalNodes: 0,
				totalEdges: 0,
				c4TypeTotals: createEmptyC4TypeCounts(),
				dddTypeTotals: createEmptyDDDTypeCounts(),
				firstSeenAt: null,
				lastUpdatedAt: null,
				domain,
			};
		}

		const nodeMap = new Map<string, Node>();
		nodes.forEach((node) => nodeMap.set(node.id, node));

		const eventCount = nodes.length + edges.length;
		const fallbackBase = Date.now() - eventCount * 60000;

		// Filter nodes based on domain
		const filteredNodes = nodes.filter((node) => {
			const data = (node.data ?? {}) as Partial<NodeData>;
			const nodeType = data.c4Type ?? data.dddType ?? node.type;

			if (domain === "c4") {
				return isC4Type(nodeType);
			} else if (domain === "ddd") {
				return isDDDType(nodeType);
			}
			// domain === "combined" - show all
			return true;
		});

		const nodeEvents: EvolutionEvent[] = filteredNodes.map((node, index) => {
			const data = (node.data ?? {}) as Partial<NodeData>;
			const timestamp = ensureTimestamp(data.createdAt, fallbackBase + index * 60000);
			const label =
				typeof data.label === "string" && data.label.trim().length > 0
					? data.label.trim()
					: node.id;

			// Determine node type - prefer explicit type from data, fallback to node.type
			let nodeType: NodeType;
			if (data.c4Type && isC4Type(data.c4Type)) {
				nodeType = data.c4Type;
			} else if (data.dddType && isDDDType(data.dddType)) {
				nodeType = data.dddType;
			} else if (isC4Type(node.type)) {
				nodeType = node.type as C4Type;
			} else if (isDDDType(node.type)) {
				nodeType = node.type as DDDType;
			} else {
				// Fallback
				nodeType = "system";
			}

			return {
				time: timestamp,
				type: "node",
				label,
				nodeType,
			};
		});

		const edgeEvents: EvolutionEvent[] = edges.map((edge, index) => {
			const data = (edge.data ?? {}) as { createdAt?: number };
			const timestamp = ensureTimestamp(
				data?.createdAt,
				fallbackBase + (nodes.length + index) * 60000,
			);

			const sourceLabel =
				typeof nodeMap.get(edge.source)?.data?.label === "string"
					? (nodeMap.get(edge.source)?.data?.label as string)
					: edge.source;
			const targetLabel =
				typeof nodeMap.get(edge.target)?.data?.label === "string"
					? (nodeMap.get(edge.target)?.data?.label as string)
					: edge.target;

			return {
				time: timestamp,
				type: "edge",
				label: `${sourceLabel} → ${targetLabel}`,
			};
		});

		const combined = [...nodeEvents, ...edgeEvents].sort((a, b) => a.time - b.time);

		const c4TypeCounts = createEmptyC4TypeCounts();
		const dddTypeCounts = createEmptyDDDTypeCounts();
		let totalNodeCount = 0;
		let totalEdgeCount = 0;

		const points: EvolutionPoint[] = [];

		for (const event of combined) {
			if (event.type === "node") {
				totalNodeCount += 1;
				if (isC4Type(event.nodeType)) {
					c4TypeCounts[event.nodeType] += 1;
				} else if (isDDDType(event.nodeType)) {
					dddTypeCounts[event.nodeType] += 1;
				}
			} else {
				totalEdgeCount += 1;
			}

			const snapshot: EvolutionPoint = {
				time: event.time,
				totalNodes: totalNodeCount,
				edgeCount: totalEdgeCount,
				c4TypeCounts: { ...c4TypeCounts },
				dddTypeCounts: { ...dddTypeCounts },
			};

			const lastPoint = points[points.length - 1];
			if (lastPoint && lastPoint.time === event.time) {
				lastPoint.totalNodes = snapshot.totalNodes;
				lastPoint.edgeCount = snapshot.edgeCount;
				lastPoint.c4TypeCounts = snapshot.c4TypeCounts;
				lastPoint.dddTypeCounts = snapshot.dddTypeCounts;
			} else {
				points.push(snapshot);
			}
		}

		const firstPoint = points[0];
		const lastPoint = points[points.length - 1] ?? null;
		const latestEvent: EvolutionEvent | null =
			combined.length > 0 ? combined[combined.length - 1] ?? null : null;

		return {
			points,
			latestEvent,
			totalNodes: totalNodeCount,
			totalEdges: totalEdgeCount,
			c4TypeTotals: { ...c4TypeCounts },
			dddTypeTotals: { ...dddTypeCounts },
			firstSeenAt: firstPoint ? firstPoint.time : null,
			lastUpdatedAt: lastPoint ? lastPoint.time : null,
			domain,
		};
	}, [nodes, edges, domain]);

interface EvolutionVizProps {
	points: EvolutionPoint[];
	width: number;
	height: number;
	domain: DiagramDomain;
}

const EvolutionViz = ({ points, width, height, domain }: EvolutionVizProps) => {
	if (width === 0 || height === 0 || points.length === 0) {
		return null;
	}

	const margin = { top: 16, right: 12, bottom: 16, left: 28 };
	const innerWidth = Math.max(0, width - margin.left - margin.right);
	const innerHeight = Math.max(0, height - margin.top - margin.bottom);

	const firstPoint = points[0];
	const lastPoint = points[points.length - 1] ?? firstPoint;
	if (!firstPoint || !lastPoint) {
		return null;
	}

	const timeExtent: [number, number] = [
		firstPoint.time,
		lastPoint.time === firstPoint.time ? firstPoint.time + 60000 : lastPoint.time,
	];

	// Determine which type orders to use based on domain
	const c4TypeOrder = domain === "ddd" ? [] : C4_TYPE_ORDER;
	const dddTypeOrder = domain === "c4" ? [] : DDD_TYPE_ORDER;

	const maxValue = Math.max(
		0,
		...points.flatMap((point) => [
			point.totalNodes,
			point.edgeCount,
			...c4TypeOrder.map((type) => point.c4TypeCounts[type]),
			...dddTypeOrder.map((type) => point.dddTypeCounts[type]),
		]),
	);

	const yMax = maxValue === 0 ? 5 : maxValue + 1;

	const xScale = scaleTime<number>({
		domain: timeExtent,
		range: [0, innerWidth],
	});

	const yScale = scaleLinear<number>({
		domain: [0, yMax],
		range: [innerHeight, 0],
		nice: true,
	});

	const edgeColor = theme.color.semantic.relationship;

	const latestPoint = points[points.length - 1] ?? null;

	return (
		<svg width={width} height={height}>
			<Group top={margin.top} left={margin.left}>
				{/* Baseline */}
				<LinePath
					data={[
						{ time: timeExtent[0], value: 0 },
						{ time: timeExtent[1], value: 0 },
					]}
					x={(d) => xScale(d.time)}
					y={() => yScale(0)}
					stroke={theme.color.border.secondary}
					strokeWidth={1}
					strokeDasharray="4 4"
				/>

				{/* C4 Node lines by type */}
				{c4TypeOrder.map((type) => (
					<LinePath<EvolutionPoint>
						key={`c4-${type}`}
						data={points}
						x={(d) => xScale(d.time)}
						y={(d) => yScale(d.c4TypeCounts[type])}
						curve={curveMonotoneX}
						stroke={C4_COLOR[type]}
						strokeWidth={1.6}
						opacity={0.9}
					/>
				))}

				{/* DDD Node lines by type */}
				{dddTypeOrder.map((type) => (
					<LinePath<EvolutionPoint>
						key={`ddd-${type}`}
						data={points}
						x={(d) => xScale(d.time)}
						y={(d) => yScale(d.dddTypeCounts[type])}
						curve={curveMonotoneX}
						stroke={DDD_COLOR[type]}
						strokeWidth={1.6}
						opacity={0.9}
					/>
				))}

				{/* Edge line */}
				<LinePath<EvolutionPoint>
					data={points}
					x={(d) => xScale(d.time)}
					y={(d) => yScale(d.edgeCount)}
					curve={curveMonotoneX}
					stroke={edgeColor}
					strokeWidth={1.8}
					opacity={0.9}
				/>

				{/* Latest markers */}
				{latestPoint ? (
					<>
						{/* C4 markers */}
						{c4TypeOrder.map((type) => {
							const value = latestPoint.c4TypeCounts[type];
							if (value === 0) {
								return null;
							}
							return (
								<Circle
									key={`c4-marker-${type}`}
									cx={xScale(latestPoint.time)}
									cy={yScale(value)}
									r={3.5}
									fill={C4_COLOR[type]}
									stroke={theme.color.background.base}
									strokeWidth={1}
								/>
							);
						})}
						{/* DDD markers */}
						{dddTypeOrder.map((type) => {
							const value = latestPoint.dddTypeCounts[type];
							if (value === 0) {
								return null;
							}
							return (
								<Circle
									key={`ddd-marker-${type}`}
									cx={xScale(latestPoint.time)}
									cy={yScale(value)}
									r={3.5}
									fill={DDD_COLOR[type]}
									stroke={theme.color.background.base}
									strokeWidth={1}
								/>
							);
						})}
						{latestPoint.edgeCount > 0 ? (
							<Circle
								cx={xScale(latestPoint.time)}
								cy={yScale(latestPoint.edgeCount)}
								r={3.5}
								fill={edgeColor}
								stroke={theme.color.background.base}
								strokeWidth={1}
							/>
						) : null}
					</>
				) : null}
			</Group>
		</svg>
	);
};

interface DiagramEvolutionChartProps {
	nodes: Node[];
	edges: Edge[];
	domain: DiagramDomain;
}

export function DiagramEvolutionChart({ nodes, edges, domain }: DiagramEvolutionChartProps) {
	const model = useEvolutionModel(nodes, edges, domain);

	if (model.points.length === 0) {
		return (
			<div className={evolutionCard}>
				<div className={evolutionHeader}>
					<h3 className={evolutionTitle}>Evolution</h3>
					<p className={evolutionMeta}>Timeline will appear as you add modules.</p>
				</div>
				<div className={evolutionEmptyState}>
					[▓▓▓▓] TEMPORAL ANALYSIS OFFLINE
				</div>
			</div>
		);
	}

	const firstSeenLabel = model.firstSeenAt
		? new Date(model.firstSeenAt).toLocaleDateString([], {
			month: "short",
			day: "numeric",
		})
		: "—";

	const latestChange = formatEventLabel(model.latestEvent);

	return (
		<div className={evolutionCard}>
			<div className={evolutionHeader}>
				<h3 className={evolutionTitle}>Evolution</h3>
				<p className={evolutionMeta}>{latestChange}</p>
			</div>

			<div className={evolutionChart}>
				<ParentSize debounceTime={80}>
					{({ width, height}) => (
						<EvolutionViz points={model.points} width={width} height={height} domain={domain} />
					)}
				</ParentSize>
			</div>

			<div className={evolutionLegend}>
				{/* C4 types legend */}
				{domain !== "ddd" && C4_TYPE_ORDER.map((type) => (
					<div key={`legend-c4-${type}`} className={evolutionLegendItem}>
						<span
							className={evolutionLegendSwatch}
							style={{ backgroundColor: C4_COLOR[type] }}
						/>
						<span className={evolutionLegendLabel}>
							{C4_PLURAL_LABEL[type]}
						</span>
					</div>
				))}
				{/* DDD types legend */}
				{domain !== "c4" && DDD_TYPE_ORDER.map((type) => (
					<div key={`legend-ddd-${type}`} className={evolutionLegendItem}>
						<span
							className={evolutionLegendSwatch}
							style={{ backgroundColor: DDD_COLOR[type] }}
						/>
						<span className={evolutionLegendLabel}>
							{DDD_PLURAL_LABEL[type]}
						</span>
					</div>
				))}
				<div className={evolutionLegendItem}>
					<span
						className={evolutionLegendSwatch}
						style={{ backgroundColor: theme.color.semantic.relationship }}
					/>
					<span className={evolutionLegendLabel}>Connections</span>
				</div>
				<div className={evolutionLegendItem}>
					<span className={evolutionLegendLabel}>Since {firstSeenLabel}</span>
				</div>
			</div>

			<div className={evolutionSummaryGrid}>
				<div className={evolutionSummaryItem}>
					<span className={evolutionSummaryLabel}>
						<CubeIcon size={14} weight="duotone" /> Modules
					</span>
					<span className={evolutionSummaryValue}>{model.totalNodes}</span>
				</div>
				<div className={evolutionSummaryItem}>
					<span className={evolutionSummaryLabel}>
						<GitBranchIcon size={14} weight="duotone" /> Connections
					</span>
					<span className={evolutionSummaryValue}>{model.totalEdges}</span>
				</div>
				<div className={evolutionSummaryItem}>
					<span className={evolutionSummaryLabel}>
						<ClockIcon size={14} weight="duotone" /> Latest
					</span>
					<span className={evolutionSummaryValue}>
						{model.lastUpdatedAt
							? new Date(model.lastUpdatedAt).toLocaleTimeString([], {
								hour: "2-digit",
								minute: "2-digit",
							})
							: "—"}
					</span>
				</div>
				{/* C4 type summaries */}
				{domain !== "ddd" && C4_TYPE_ORDER.map((type) => {
					const Icon = C4_ICON[type];
					return (
						<div key={`summary-c4-${type}`} className={evolutionSummaryItem}>
							<span className={evolutionSummaryLabel}>
								<Icon
									size={14}
									weight="duotone"
									color={C4_COLOR[type]}
								/>{" "}
								{C4_PLURAL_LABEL[type]}
							</span>
							<span className={evolutionSummaryValue}>
								{model.c4TypeTotals[type]}
							</span>
						</div>
					);
				})}
				{/* DDD type summaries */}
				{domain !== "c4" && DDD_TYPE_ORDER.map((type) => {
					const Icon = DDD_ICON[type];
					return (
						<div key={`summary-ddd-${type}`} className={evolutionSummaryItem}>
							<span className={evolutionSummaryLabel}>
								<Icon
									size={14}
									weight="duotone"
									color={DDD_COLOR[type]}
								/>{" "}
								{DDD_PLURAL_LABEL[type]}
							</span>
							<span className={evolutionSummaryValue}>
								{model.dddTypeTotals[type]}
							</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}
