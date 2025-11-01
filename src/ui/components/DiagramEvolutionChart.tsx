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
import type { C4Type, NodeData } from "../../core/effects/node-operations";

const NODE_TYPE_ORDER: C4Type[] = ["person", "system", "externalSystem", "container", "component"];

const NODE_TYPE_SINGULAR_LABEL: Record<C4Type, string> = {
	person: "Person",
	system: "System",
	externalSystem: "External System",
	container: "Container",
	component: "Component",
};

const NODE_TYPE_PLURAL_LABEL: Record<C4Type, string> = {
	person: "People",
	system: "Systems",
	externalSystem: "External Systems",
	container: "Containers",
	component: "Components",
};

const NODE_TYPE_COLOR: Record<C4Type, string> = {
	person: theme.color.semantic.person,
	system: theme.color.semantic.system,
	externalSystem: theme.color.semantic.external,
	container: theme.color.semantic.container,
	component: theme.color.semantic.component,
};

const NODE_TYPE_ICON = {
	person: UserIcon,
	system: PackageIcon,
	externalSystem: CloudIcon,
	container: StackIcon,
	component: CubeIcon,
} as const;

const isC4Type = (value: unknown): value is C4Type =>
	typeof value === "string" && (NODE_TYPE_ORDER as readonly string[]).includes(value);

const createEmptyTypeCounts = (): Record<C4Type, number> => {
	const counts = {} as Record<C4Type, number>;
	for (const type of NODE_TYPE_ORDER) {
		counts[type] = 0;
	}
	return counts;
};

type EvolutionPoint = {
	time: number;
	totalNodes: number;
	edgeCount: number;
	typeCounts: Record<C4Type, number>;
};

type EvolutionEvent =
	| {
			time: number;
			type: "node";
			label: string;
			nodeType: C4Type;
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
	typeTotals: Record<C4Type, number>;
	firstSeenAt: number | null;
	lastUpdatedAt: number | null;
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
		const typeLabel = NODE_TYPE_SINGULAR_LABEL[event.nodeType] ?? "Node";
		return `+ ${typeLabel} · ${event.label} · ${timeLabel}`;
	}

	return `+ Connection · ${event.label} · ${timeLabel}`;
};

const useEvolutionModel = (nodes: Node[], edges: Edge[]): EvolutionModel =>
	useMemo(() => {
		if (nodes.length === 0 && edges.length === 0) {
			return {
				points: [],
				latestEvent: null,
				totalNodes: 0,
				totalEdges: 0,
				typeTotals: createEmptyTypeCounts(),
				firstSeenAt: null,
				lastUpdatedAt: null,
			};
		}

		const nodeMap = new Map<string, Node>();
		nodes.forEach((node) => nodeMap.set(node.id, node));

		const eventCount = nodes.length + edges.length;
		const fallbackBase = Date.now() - eventCount * 60000;

		const nodeEvents: EvolutionEvent[] = nodes.map((node, index) => {
			const data = (node.data ?? {}) as Partial<NodeData>;
			const timestamp = ensureTimestamp(data.createdAt, fallbackBase + index * 60000);
			const label =
				typeof data.label === "string" && data.label.trim().length > 0
					? data.label.trim()
					: node.id;
			const nodeType =
				(isC4Type(data.c4Type) ? data.c4Type : undefined) ??
				(isC4Type(node.type) ? (node.type as C4Type) : undefined) ??
				"system";

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

		const typeCounts = createEmptyTypeCounts();
		let totalNodeCount = 0;
		let totalEdgeCount = 0;

		const points: EvolutionPoint[] = [];

		for (const event of combined) {
			if (event.type === "node") {
				totalNodeCount += 1;
				typeCounts[event.nodeType] += 1;
			} else {
				totalEdgeCount += 1;
			}

			const snapshot: EvolutionPoint = {
				time: event.time,
				totalNodes: totalNodeCount,
				edgeCount: totalEdgeCount,
				typeCounts: { ...typeCounts },
			};

			const lastPoint = points[points.length - 1];
			if (lastPoint && lastPoint.time === event.time) {
				lastPoint.totalNodes = snapshot.totalNodes;
				lastPoint.edgeCount = snapshot.edgeCount;
				lastPoint.typeCounts = snapshot.typeCounts;
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
			typeTotals: { ...typeCounts },
			firstSeenAt: firstPoint ? firstPoint.time : null,
			lastUpdatedAt: lastPoint ? lastPoint.time : null,
		};
	}, [nodes, edges]);

interface EvolutionVizProps {
	points: EvolutionPoint[];
	width: number;
	height: number;
}

const EvolutionViz = ({ points, width, height }: EvolutionVizProps) => {
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

	const maxValue = Math.max(
		0,
		...points.flatMap((point) => [
			point.totalNodes,
			point.edgeCount,
			...NODE_TYPE_ORDER.map((type) => point.typeCounts[type]),
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

				{/* Node lines by type */}
				{NODE_TYPE_ORDER.map((type) => (
					<LinePath<EvolutionPoint>
						key={type}
						data={points}
						x={(d) => xScale(d.time)}
						y={(d) => yScale(d.typeCounts[type])}
						curve={curveMonotoneX}
						stroke={NODE_TYPE_COLOR[type]}
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
						{NODE_TYPE_ORDER.map((type) => {
							const value = latestPoint.typeCounts[type];
							if (value === 0) {
								return null;
							}
							return (
								<Circle
									key={type}
									cx={xScale(latestPoint.time)}
									cy={yScale(value)}
									r={3.5}
									fill={NODE_TYPE_COLOR[type]}
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
}

export function DiagramEvolutionChart({ nodes, edges }: DiagramEvolutionChartProps) {
	const model = useEvolutionModel(nodes, edges);

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
					{({ width, height }) => (
						<EvolutionViz points={model.points} width={width} height={height} />
					)}
				</ParentSize>
			</div>

			<div className={evolutionLegend}>
				{NODE_TYPE_ORDER.map((type) => (
					<div key={`legend-${type}`} className={evolutionLegendItem}>
						<span
							className={evolutionLegendSwatch}
							style={{ backgroundColor: NODE_TYPE_COLOR[type] }}
						/>
						<span className={evolutionLegendLabel}>
							{NODE_TYPE_PLURAL_LABEL[type]}
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
				{NODE_TYPE_ORDER.map((type) => {
					const Icon = NODE_TYPE_ICON[type];
					return (
						<div key={`summary-${type}`} className={evolutionSummaryItem}>
							<span className={evolutionSummaryLabel}>
								<Icon
									size={14}
									weight="duotone"
									color={NODE_TYPE_COLOR[type]}
								/>{" "}
								{NODE_TYPE_PLURAL_LABEL[type]}
							</span>
							<span className={evolutionSummaryValue}>
								{model.typeTotals[type]}
							</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}
