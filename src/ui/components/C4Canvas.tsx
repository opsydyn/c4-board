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
	type NodeMouseHandler,
	type OnNodesChange,
	type OnEdgesChange,
	type OnConnect,
	ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo } from "react";
import { ExternalSystemNode } from "./nodes/ExternalSystemNode";
import { PersonNode } from "./nodes/PersonNode";
import { SystemNode } from "./nodes/SystemNode";
import { canvasContainer, reactFlowControls } from "./styles.css";
import { theme } from "../../styles/theme.css";

interface C4CanvasProps {
	nodes: Node[];
	edges: Edge[];
	onNodesChange?: OnNodesChange<Node>;
	onEdgesChange?: OnEdgesChange<Edge>;
	onConnect?: OnConnect;
	onNodeClick?: NodeMouseHandler<Node>;
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
			style: { stroke: theme.color.semantic.relationship, strokeWidth: 2 },
			labelStyle: {
				fill: theme.color.semantic.relationship,
				fontSize: 12,
				fontFamily: theme.typography.family.mono
			},
			labelBgStyle: {
				fill: theme.color.background.base,
				fillOpacity: Number(theme.opacity.overlay)
			},
		}),
		[],
	);

	return (
		<div className={canvasContainer}>
			<ReactFlow
				nodes={nodes}
				edges={edges}
				{...(onNodesChange && { onNodesChange })}
				{...(onEdgesChange && { onEdgesChange })}
				{...(onConnect && { onConnect })}
				{...(onNodeClick && { onNodeClick })}
				nodeTypes={nodeTypes}
				defaultEdgeOptions={defaultEdgeOptions}
				fitView
				snapToGrid
				snapGrid={[15, 15]}
			>
				<Background color={theme.color.border.primary} />
				<Controls className={reactFlowControls} />
			</ReactFlow>
		</div>
	);
}
