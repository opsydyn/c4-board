/**
 * Mermaid Import - Pure functional parser
 *
 * Parses Mermaid flowchart diagrams back into ReactFlow nodes and edges.
 * This is part of the functional core - no side effects.
 */

import { Effect } from "effect";
import type { Node, Edge, Viewport } from "@xyflow/react";
import type { C4Type, NodeData } from "./node-operations";

/**
 * Mermaid shape syntax to C4Type mapping
 * (Not directly used but kept for documentation)
 */

interface ParsedNode {
	id: string;
	type: C4Type;
	label: string;
	technology?: string;
	description?: string;
	position?: { x: number; y: number };
	width?: number;
	height?: number;
}

interface ParsedEdge {
	source: string;
	target: string;
	label: string;
}

export interface ImportResult {
	nodes: Node[];
	edges: Edge[];
	viewport?: Viewport;
}

/**
 * Extract label content from Mermaid node definition
 * Handles HTML-like tags: <br/>, <em>, <small>
 */
function parseLabel(labelContent: string): {
	label: string;
	technology?: string;
	description?: string;
} {
	// Split by <br/> to get parts
	const parts = labelContent.split(/<br\s*\/?>/i).map((p) => p.trim());

	const label = parts[0]?.replace(/&lt;/g, "<").replace(/&gt;/g, ">") || "Unnamed";

	// Look for technology in <em> tags
	const techMatch = parts[1]?.match(/<em>(.*?)<\/em>/i);
	const technology = techMatch?.[1]?.replace(/&lt;/g, "<").replace(/&gt;/g, ">");

	// Look for description in <small> tags
	const descMatch = parts
		.slice(technology ? 2 : 1)
		.join(" ")
		.match(/<small>(.*?)<\/small>/i);
	const description = descMatch?.[1]?.replace(/&lt;/g, "<").replace(/&gt;/g, ">");

	const result: { label: string; technology?: string; description?: string } = { label };
	if (technology) result.technology = technology;
	if (description) result.description = description;

	return result;
}

/**
 * Parse a Mermaid node definition line
 * Examples:
 *   n_user(["User"])
 *   api["API<br/><em>REST</em><br/><small>Handles requests</small>"]
 *   db[("Database")]
 */
function parseNode(line: string): ParsedNode | null {
	// Match: id + shape + "label"
	// Pattern: id + opening-shape + "content" + closing-shape
	const patterns = [
		// Stadium: id(["label"])
		{ regex: /^(\w+)\(\["([^"]+)"\]\)/, shape: "([", type: "person" as C4Type },
		// Cylindrical: id[("label")]
		{ regex: /^(\w+)\[\("([^"]+)"\)\]/, shape: "[(", type: "container" as C4Type },
		// Subroutine: id[["label"]]
		{ regex: /^(\w+)\[\["([^"]+)"\]\]/, shape: "[[", type: "externalSystem" as C4Type },
		// Hexagon: id{{"label"}}
		{ regex: /^(\w+)\{\{"([^"]+)"\}\}/, shape: "{{", type: "component" as C4Type },
		// Rectangle: id["label"]
		{ regex: /^(\w+)\["([^"]+)"\]/, shape: "[", type: "system" as C4Type },
	];

	for (const { regex, type } of patterns) {
		const match = line.match(regex);
		if (match) {
			const [, id, labelContent] = match;

			if (!id || !labelContent) continue;

			const { label, technology, description } = parseLabel(labelContent);

			const result: ParsedNode = {
				id: id.trim(),
				type,
				label,
			};

			if (technology) result.technology = technology;
			if (description) result.description = description;

			return result;
		}
	}

	return null;
}

/**
 * Parse a Mermaid edge/relationship line
 * Examples:
 *   user -->|"uses"| api
 *   api --> db
 */
function parseEdge(line: string): ParsedEdge | null {
	// Match: source -->|"label"| target OR source --> target
	const withLabel = line.match(/^(\w+)\s+-->\s*\|\s*"([^"]+)"\s*\|\s*(\w+)/);
	if (withLabel) {
		const [, source, label, target] = withLabel;
		if (!source || !label || !target) return null;

		return {
			source: source.trim(),
			target: target.trim(),
			label: label.replace(/#quot;/g, '"'),
		};
	}

	const withoutLabel = line.match(/^(\w+)\s+-->\s*(\w+)/);
	if (withoutLabel) {
		const [, source, target] = withoutLabel;
		if (!source || !target) return null;

		return {
			source: source.trim(),
			target: target.trim(),
			label: "uses",
		};
	}

	return null;
}

/**
 * Generate ReactFlow node from parsed node
 */
function createReactFlowNode(node: ParsedNode, index: number): Node {
	const nodeData: NodeData = {
		label: node.label,
		description: node.description || "",
		technology: node.technology || "",
		c4Type: node.type,
	};

	// Use position from metadata if available, otherwise use grid layout
	let position: { x: number; y: number };
	if (node.position) {
		position = node.position;
	} else {
		// Fallback: grid layout
		const gridSize = 5;
		const col = index % gridSize;
		const row = Math.floor(index / gridSize);
		position = { x: col * 300, y: row * 250 };
	}

	const reactFlowNode: Node = {
		id: node.id,
		type: node.type,
		position,
		data: nodeData,
	};

	// Apply width/height if available
	if (node.width && node.height) {
		reactFlowNode.style = {
			width: node.width,
			height: node.height,
		};
	}

	return reactFlowNode;
}

/**
 * Generate ReactFlow edge from parsed edge
 */
function createReactFlowEdge(edge: ParsedEdge, index: number): Edge {
	return {
		id: `edge-${edge.source}-${edge.target}-${index}`,
		source: edge.source,
		target: edge.target,
		label: edge.label,
		type: "smoothstep",
	};
}

/**
 * Parse Mermaid flowchart content and convert to ReactFlow nodes and edges
 *
 * Pure function that parses Mermaid text into diagram structure.
 * Returns an Effect that yields the import result.
 */
export const importMermaid = (
	content: string
): Effect.Effect<ImportResult, Error> =>
	Effect.gen(function* () {
		const lines = content.split("\n").map((line) => line.trim());
		const parsedNodes: ParsedNode[] = [];
		const parsedEdges: ParsedEdge[] = [];
		let viewport: Viewport | undefined;

		for (const line of lines) {
			// Parse ReactFlow viewport metadata from comment
			if (line.startsWith("%% ReactFlow Viewport:")) {
				try {
					const jsonStr = line.substring("%% ReactFlow Viewport:".length).trim();
					viewport = JSON.parse(jsonStr) as Viewport;
				} catch {
					// Ignore invalid JSON
				}
				continue;
			}

			// Parse position metadata comment: %% @pos(x,y,width,height)
			if (line.includes("%% @pos(")) {
				const match = line.match(/%% @pos\(([^,]+),([^,]+),([^,]+),([^)]+)\)/);
				if (match && parsedNodes.length > 0) {
					const [, x, y, width, height] = match;
					const lastNode = parsedNodes[parsedNodes.length - 1];
					if (lastNode && x && y && width && height) {
						lastNode.position = { x: parseFloat(x), y: parseFloat(y) };
						lastNode.width = parseFloat(width);
						lastNode.height = parseFloat(height);
					}
				}
				continue;
			}

			// Skip empty lines, comments, and directives
			if (
				!line ||
				line.startsWith("%%") ||
				line.startsWith("flowchart") ||
				line.startsWith("graph")
			) {
				continue;
			}

			// Try to parse as node
			const node = parseNode(line);
			if (node) {
				parsedNodes.push(node);
				continue;
			}

			// Try to parse as edge
			const edge = parseEdge(line);
			if (edge) {
				parsedEdges.push(edge);
			}
		}

		// Validate that we found at least some nodes
		if (parsedNodes.length === 0) {
			return yield* Effect.fail(
				new Error("No valid nodes found in Mermaid file")
			);
		}

		// Create ReactFlow nodes
		const nodes = parsedNodes.map((node, index) =>
			createReactFlowNode(node, index)
		);

		// Create ReactFlow edges
		// Filter out edges that reference non-existent nodes
		const nodeIds = new Set(parsedNodes.map((n) => n.id));
		const validEdges = parsedEdges.filter(
			(edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)
		);

		const edges = validEdges.map((edge, index) =>
			createReactFlowEdge(edge, index)
		);

		return { nodes, edges, ...(viewport && { viewport }) };
	});
