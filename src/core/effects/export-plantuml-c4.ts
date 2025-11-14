/**
 * PlantUML C4 Export (Functional Core)
 *
 * Pure functions for exporting ReactFlow C4 diagrams to PlantUML format.
 * Uses the C4-PlantUML library syntax: https://github.com/plantuml-stdlib/C4-PlantUML
 *
 * Architecture:
 * - Effect functions describe WHAT to export (pure logic)
 * - No side effects: no file I/O, no clipboard access
 * - Returns Effect<string> for composition
 *
 * PlantUML C4 Format:
 * @startuml
 * !include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml
 *
 * Person(user, "User", "A user of the system")
 * System(api, "API", "Spring Boot")
 * Rel(user, api, "Uses", "HTTPS")
 * @enduml
 */

import { Effect } from "effect";
import type { Node, Edge } from "@xyflow/react";
import type { C4Type, NodeData } from "./node-operations";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * PlantUML C4 element types mapped to C4-PlantUML macros
 */
const C4_PLANTUML_MACROS: Record<C4Type, string> = {
	person: "Person",
	system: "System",
	externalSystem: "System_Ext",
	container: "Container",
	component: "Component",
};

/**
 * Export options for PlantUML generation
 */
export interface PlantUMLExportOptions {
	/** Include description fields as third parameter */
	includeDescriptions?: boolean;
	/** Include technology/stack as second parameter */
	includeTechnology?: boolean;
	/** Diagram title */
	title?: string;
	/** Include C4-PlantUML library import */
	includeLibraryImport?: boolean;
}

// ============================================================================
// Helper Functions (Pure)
// ============================================================================

/**
 * Escape special characters for PlantUML strings
 */
function escapeString(str: string): string {
	return str
		.replace(/\\/g, "\\\\")
		.replace(/"/g, '\\"')
		.replace(/\n/g, "\\n");
}

/**
 * Extract C4Type from node
 */
function getNodeC4Type(node: Node): C4Type | null {
	const data = (node.data ?? {}) as Partial<NodeData>;
	const c4Type = data.c4Type ?? (node.type as C4Type | undefined);

	if (!c4Type || !isC4Type(c4Type)) {
		return null;
	}

	return c4Type;
}

/**
 * Type guard for C4Type
 */
function isC4Type(value: unknown): value is C4Type {
	return (
		value === "person" ||
		value === "system" ||
		value === "externalSystem" ||
		value === "container" ||
		value === "component"
	);
}

/**
 * Extract node data safely
 */
function getNodeData(node: Node): Partial<NodeData> {
	return (node.data ?? {}) as Partial<NodeData>;
}

/**
 * Generate a valid PlantUML identifier from node ID
 * PlantUML identifiers must start with letter and contain only alphanumeric + underscore
 */
function toPlantUMLId(id: string): string {
	// Remove hyphens and special chars, replace with underscore
	const cleaned = id.replace(/[^a-zA-Z0-9_]/g, "_");
	// Ensure starts with letter
	return /^[a-zA-Z]/.test(cleaned) ? cleaned : `n_${cleaned}`;
}

/**
 * Convert a single C4 node to PlantUML element definition
 */
function nodeToPlantUML(node: Node, options: PlantUMLExportOptions): string | null {
	const c4Type = getNodeC4Type(node);
	if (!c4Type) {
		return null; // Skip non-C4 nodes (DDD nodes)
	}

	const data = getNodeData(node);
	const macro = C4_PLANTUML_MACROS[c4Type];
	const id = toPlantUMLId(node.id);
	const label = escapeString(data.label ?? "Unnamed");

	// Build parameters array
	const params: string[] = [id, `"${label}"`];

	// Add technology/stack (optional second parameter)
	if (options.includeTechnology && data.technology) {
		params.push(`"${escapeString(data.technology)}"`);
	} else if (options.includeDescriptions && data.description) {
		// If we want description but no technology, add empty string for technology
		params.push('""');
	}

	// Add description (optional third parameter)
	if (options.includeDescriptions && data.description) {
		params.push(`"${escapeString(data.description)}"`);
	}

	return `${macro}(${params.join(", ")})`;
}

/**
 * Convert an edge to PlantUML relationship
 */
function edgeToPlantUML(edge: Edge, nodes: Node[]): string | null {
	// Find source and target nodes to verify they're C4 types
	const sourceNode = nodes.find(n => n.id === edge.source);
	const targetNode = nodes.find(n => n.id === edge.target);

	if (!sourceNode || !targetNode) {
		return null;
	}

	// Skip if either node is not a C4 node
	const sourceC4Type = getNodeC4Type(sourceNode);
	const targetC4Type = getNodeC4Type(targetNode);

	if (!sourceC4Type || !targetC4Type) {
		return null;
	}

	const sourceId = toPlantUMLId(edge.source);
	const targetId = toPlantUMLId(edge.target);
	const label = typeof edge.label === "string" ? escapeString(edge.label) : "uses";

	// Rel(from, to, "label", "technology")
	return `Rel(${sourceId}, ${targetId}, "${label}")`;
}

// ============================================================================
// Export Functions (Pure Effects)
// ============================================================================

/**
 * Export C4 diagram to PlantUML format
 *
 * Returns an Effect that produces PlantUML source code string.
 * This is a pure function - no side effects, just string transformation.
 */
export const exportC4ToPlantUML = (
	nodes: Node[],
	edges: Edge[],
	options: PlantUMLExportOptions = {}
): Effect.Effect<string> =>
	Effect.gen(function* () {
		const opts: Required<PlantUMLExportOptions> = {
			includeDescriptions: options.includeDescriptions ?? true,
			includeTechnology: options.includeTechnology ?? true,
			title: options.title ?? "C4 Diagram",
			includeLibraryImport: options.includeLibraryImport ?? true,
		};

		const lines: string[] = [];

		// Header
		lines.push("@startuml");

		// C4-PlantUML library import
		if (opts.includeLibraryImport) {
			lines.push("!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml");
			lines.push("");
		}

		// Title
		if (opts.title) {
			lines.push(`title ${opts.title}`);
			lines.push("");
		}

		// Filter to only C4 nodes
		const c4Nodes = nodes.filter(node => getNodeC4Type(node) !== null);

		if (c4Nodes.length === 0) {
			lines.push("' No C4 elements found in diagram");
		} else {
			// Convert nodes to PlantUML elements
			lines.push("' Elements");
			for (const node of c4Nodes) {
				const element = nodeToPlantUML(node, opts);
				if (element) {
					lines.push(element);
				}
			}

			lines.push("");

			// Convert edges to PlantUML relationships
			if (edges.length > 0) {
				lines.push("' Relationships");
				for (const edge of edges) {
					const relationship = edgeToPlantUML(edge, nodes);
					if (relationship) {
						lines.push(relationship);
					}
				}
			}
		}

		lines.push("");
		lines.push("@enduml");

		return lines.join("\n");
	});

/**
 * Generate PlantUML filename from diagram name
 */
export const generatePlantUMLFilename = (diagramName?: string): Effect.Effect<string> =>
	Effect.succeed(
		diagramName
			? `${diagramName.replace(/[^a-zA-Z0-9-_]/g, "_")}.puml`
			: "c4-diagram.puml"
	);
