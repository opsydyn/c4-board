/**
 * DiagramStatsPopover - Click-to-reveal diagram statistics
 *
 * Uses React Aria Components for accessible popover with diagram stats
 */

import { useState } from "react";
import { Button, Dialog, DialogTrigger, Popover } from "react-aria-components";
import { InfoIcon } from "@phosphor-icons/react";
import { useDatabase } from "../../core/effects/useDatabase";
import { getDiagramStats } from "../../core/effects/canvas-persistence";
import {
	infoButton,
	popoverContainer,
	popoverContent,
	popoverHeader,
	statGrid,
	statItem,
	statLabel,
	statValue,
	nodeTypeBreakdown,
	nodeTypeItem,
	nodeTypeCount,
	loadingText,
} from "./DiagramStatsPopover.css";

interface DiagramStats {
	diagramId: string;
	nodeCount: number;
	edgeCount: number;
	nodesByType: Record<string, number>;
}

const NODE_TYPE_LABELS: Record<string, string> = {
	person: "People",
	system: "Systems",
	external: "External Systems",
	container: "Containers",
	component: "Components",
};

interface DiagramStatsPopoverProps {
	diagramId: string;
}

export function DiagramStatsPopover({ diagramId }: DiagramStatsPopoverProps) {
	const { runEffect } = useDatabase();
	const [stats, setStats] = useState<DiagramStats | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const loadStats = async () => {
		if (stats) return; // Already loaded

		try {
			setLoading(true);
			const result = await runEffect(getDiagramStats(diagramId));
			setStats(result);
			setError(null);
		} catch (err) {
			console.error("Failed to load diagram stats", err);
			setError(err instanceof Error ? err.message : "Failed to load stats");
		} finally {
			setLoading(false);
		}
	};

	const hasNodeTypes = stats && Object.keys(stats.nodesByType).length > 0;

	return (
		<DialogTrigger>
			<Button
				className={infoButton}
				onPress={() => void loadStats()}
				aria-label="Show diagram statistics"
			>
				<InfoIcon size={16} weight="bold" />
			</Button>
			<Popover className={popoverContainer} placement="left">
				<Dialog className={popoverContent}>
					<div className={popoverHeader}>Diagram Statistics</div>

					{loading && <div className={loadingText}>Loading stats...</div>}

					{error && <div className={loadingText}>Failed to load stats</div>}

					{stats && !loading && (
						<>
							<div className={statGrid}>
								<div className={statItem}>
									<div className={statLabel}>Nodes</div>
									<div className={statValue}>{stats.nodeCount}</div>
								</div>
								<div className={statItem}>
									<div className={statLabel}>Edges</div>
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
									<div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
										{Object.entries(stats.nodesByType).map(([type, count]) => (
											<div key={type} className={nodeTypeItem}>
												{NODE_TYPE_LABELS[type] || type}:{" "}
												<span className={nodeTypeCount}>{count}</span>
											</div>
										))}
									</div>
								</div>
							)}
						</>
					)}
				</Dialog>
			</Popover>
		</DialogTrigger>
	);
}
