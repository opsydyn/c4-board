/**
 * DiagramDetailPanel - Expandable row detail for diagram statistics
 *
 * Displays node count, edge count, and breakdown by node type
 */

import { useEffect, useState } from "react";
import type { IDetailCellRendererParams } from "ag-grid-community";
import { useDatabase } from "../../core/effects/useDatabase";
import { getDiagramStats } from "../../core/effects/canvas-persistence";
import {
	detailPanel,
	detailPanelContent,
	detailPanelLoading,
	statGrid,
	statItem,
	statLabel,
	statValue,
	nodeTypeBreakdown,
	nodeTypeItem,
} from "./DiagramDetailPanel.css";

interface DiagramRow {
	id: string;
	name: string;
	description?: string;
	createdAt: number;
	updatedAt: number;
	lastUpdatedRelative: string;
}

interface DiagramStats {
	diagramId: string;
	nodeCount: number;
	edgeCount: number;
	nodesByType: Record<string, number>;
}

// Map node type keys to display names
const NODE_TYPE_LABELS: Record<string, string> = {
	person: "People",
	system: "Systems",
	external: "External Systems",
	container: "Containers",
	component: "Components",
};

export function DiagramDetailPanel(props: IDetailCellRendererParams<DiagramRow>) {
	const { runEffect } = useDatabase();
	const [stats, setStats] = useState<DiagramStats | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!props.data?.id) return;

		const fetchStats = async () => {
			try {
				setLoading(true);
				const result = await runEffect(getDiagramStats(props.data!.id));
				setStats(result);
				setError(null);
			} catch (err) {
				console.error("Failed to load diagram stats", err);
				setError(err instanceof Error ? err.message : "Failed to load stats");
			} finally {
				setLoading(false);
			}
		};

		void fetchStats();
	}, [props.data?.id, runEffect]);

	if (loading) {
		return (
			<div className={detailPanel}>
				<div className={detailPanelLoading}>Loading diagram details...</div>
			</div>
		);
	}

	if (error || !stats) {
		return (
			<div className={detailPanel}>
				<div className={detailPanelLoading}>Failed to load diagram details</div>
			</div>
		);
	}

	const hasNodeTypes = Object.keys(stats.nodesByType).length > 0;

	return (
		<div className={detailPanel}>
			<div className={detailPanelContent}>
				<div className={statGrid}>
					<div className={statItem}>
						<div className={statLabel}>Total Nodes</div>
						<div className={statValue}>{stats.nodeCount}</div>
					</div>
					<div className={statItem}>
						<div className={statLabel}>Total Edges</div>
						<div className={statValue}>{stats.edgeCount}</div>
					</div>
					<div className={statItem}>
						<div className={statLabel}>Complexity</div>
						<div className={statValue}>
							{stats.nodeCount + stats.edgeCount}
						</div>
					</div>
				</div>

				{hasNodeTypes && (
					<div className={nodeTypeBreakdown}>
						<div className={statLabel}>Node Types</div>
						<div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
							{Object.entries(stats.nodesByType).map(([type, count]) => (
								<div key={type} className={nodeTypeItem}>
									<span>{NODE_TYPE_LABELS[type] || type}:</span>{" "}
									<strong>{count}</strong>
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
