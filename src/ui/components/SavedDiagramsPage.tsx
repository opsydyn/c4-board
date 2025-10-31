/**
 * SavedDiagramsPage - Wrapper for SavedDiagramsTable with navigation
 */

import { useCallback } from "react";
import { DocumentationTable } from "./DocumentationTable";
import { SavedDiagramsTable } from "./SavedDiagramsTable";

export function SavedDiagramsPage() {
	const handleLoadDiagram = useCallback((diagramId: string) => {
		// Navigate to canvas with the diagram ID as a query parameter
		window.location.href = `/?load=${diagramId}`;
	}, []);

	return (
		<div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", gap: "24px" }}>
			<DocumentationTable />
			<SavedDiagramsTable onLoadDiagram={handleLoadDiagram} />
		</div>
	);
}
