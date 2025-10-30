/**
 * SavedDiagramsPage - Wrapper for SavedDiagramsTable with navigation
 */

import { useCallback } from "react";
import { SavedDiagramsTable } from "./SavedDiagramsTable";

export function SavedDiagramsPage() {
	const handleLoadDiagram = useCallback((diagramId: string) => {
		// Navigate to canvas with the diagram ID as a query parameter
		window.location.href = `/canvas?load=${diagramId}`;
	}, []);

	return (
		<div style={{ height: "100%", width: "100%" }}>
			<SavedDiagramsTable onLoadDiagram={handleLoadDiagram} />
		</div>
	);
}
