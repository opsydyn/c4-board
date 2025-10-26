/**
 * SavedDiagramsTable - Display saved diagrams from database
 *
 * Simple table showing all saved diagrams with metadata
 */

import { useEffect, useState } from "react";
import { useDatabase } from "../../core/effects/useDatabase";
import { listAllDiagrams } from "../../core/effects/canvas-persistence";
import { table, tableHeader, tableRow, tableCell, actionButton } from "./SavedDiagramsTable.css";

interface DiagramEntry {
	id: string;
	name: string;
	description?: string;
	createdAt: number;
	updatedAt: number;
}

interface SavedDiagramsTableProps {
	onLoadDiagram: (diagramId: string) => void;
}

export function SavedDiagramsTable({ onLoadDiagram }: SavedDiagramsTableProps) {
	const [diagrams, setDiagrams] = useState<DiagramEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const { runEffect } = useDatabase();

	useEffect(() => {
		const loadDiagrams = async () => {
			try {
				setLoading(true);
				const result = await runEffect(listAllDiagrams());
				// Map to ensure description is optional, not undefined
				const mappedDiagrams: DiagramEntry[] = result.map((d) => ({
					id: d.id,
					name: d.name,
					createdAt: d.createdAt,
					updatedAt: d.updatedAt,
					...(d.description ? { description: d.description } : {}),
				}));
				setDiagrams(mappedDiagrams);
				setError(null);
			} catch (err) {
				console.error("Failed to load diagrams:", err);
				setError(err instanceof Error ? err.message : "Failed to load diagrams");
			} finally {
				setLoading(false);
			}
		};

		loadDiagrams();
	}, [runEffect]);

	const formatDate = (timestamp: number) => {
		const date = new Date(timestamp);
		return date.toLocaleString([], {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	if (loading) {
		return <div>Loading diagrams...</div>;
	}

	if (error) {
		return <div>Error: {error}</div>;
	}

	if (diagrams.length === 0) {
		return <div>No saved diagrams found.</div>;
	}

	return (
		<table className={table}>
			<thead>
				<tr className={tableHeader}>
					<th className={tableCell}>Name</th>
					<th className={tableCell}>Description</th>
					<th className={tableCell}>Created</th>
					<th className={tableCell}>Last Updated</th>
					<th className={tableCell}>Actions</th>
				</tr>
			</thead>
			<tbody>
				{diagrams.map((diagram) => (
					<tr key={diagram.id} className={tableRow}>
						<td className={tableCell}>{diagram.name}</td>
						<td className={tableCell}>{diagram.description || "-"}</td>
						<td className={tableCell}>{formatDate(diagram.createdAt)}</td>
						<td className={tableCell}>{formatDate(diagram.updatedAt)}</td>
						<td className={tableCell}>
							<button
								type="button"
								className={actionButton}
								onClick={() => onLoadDiagram(diagram.id)}
							>
								Load
							</button>
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}
