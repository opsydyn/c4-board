/**
 * C4Canvas - Main ReactFlow Canvas Component
 *
 * Renders the interactive C4 diagram canvas.
 * Pure view component - state managed by XState machine.
 */

import {
	Background,
	Controls,
	type Edge,
	type Node,
	ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo } from "react";
import { ExternalSystemNode } from "./nodes/ExternalSystemNode";
import { PersonNode } from "./nodes/PersonNode";
import { SystemNode } from "./nodes/SystemNode";
import { canvasContainer } from "./styles.css";

interface C4CanvasProps {
	nodes: Node[];
	edges: Edge[];
	onNodesChange?: (changes: any) => void;
	onEdgesChange?: (changes: any) => void;
	onConnect?: (connection: any) => void;
	onNodeClick?: ((event: React.MouseEvent, node: Node) => void) | undefined;
}

export function C4Canvas({
	nodes,
	edges,
	onNodesChange,
	onEdgesChange,
	onConnect,
	onNodeClick,
}: C4CanvasProps) {
	// Define custom node types for C4 elements
	const nodeTypes = useMemo(
		() => ({
			person: PersonNode,
			system: SystemNode,
			external_system: ExternalSystemNode,
		}),
		[],
	);

	// Default edge styling for C4 relationships
	const defaultEdgeOptions = useMemo(
		() => ({
			animated: true,
			style: { stroke: "#666", strokeWidth: 2 },
			labelStyle: { fill: "#666", fontSize: 12 },
			labelBgStyle: { fill: "white" },
		}),
		[],
	);

	return (
		<div className={canvasContainer}>
			<ReactFlow
				nodes={nodes}
				edges={edges}
				onNodesChange={onNodesChange}
				onEdgesChange={onEdgesChange}
				onConnect={onConnect}
				onNodeClick={onNodeClick}
				nodeTypes={nodeTypes}
				defaultEdgeOptions={defaultEdgeOptions}
				fitView
				snapToGrid
				snapGrid={[15, 15]}
			>
				<Background />
				<Controls />
			</ReactFlow>
		</div>
	);
}
