/**
 * C4Canvas - Main ReactFlow Canvas Component
 *
 * Renders the interactive C4 diagram canvas.
 * Pure view component - state managed by XState machine.
 */

import {
	Background,
	Controls,
	MiniMap,
	type Edge,
	type Node,
	type NodeMouseHandler,
	type OnNodesChange,
	type OnEdgesChange,
	type OnConnect,
	ReactFlow,
	ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo, forwardRef, useImperativeHandle } from "react";
import { useReactFlow } from "@xyflow/react";
import { ExternalSystemNode } from "./nodes/ExternalSystemNode";
import { PersonNode } from "./nodes/PersonNode";
import { SystemNode } from "./nodes/SystemNode";
import { ContainerNode } from "./nodes/ContainerNode";
import { ComponentNode } from "./nodes/ComponentNode";
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

export interface C4CanvasRef {
	fitViewToNode: (nodeId: string) => void;
}

function C4CanvasInner(
	{
		nodes,
		edges,
		onNodesChange,
		onEdgesChange,
		onConnect,
		onNodeClick,
	}: C4CanvasProps,
	ref: React.Ref<C4CanvasRef>,
) {
	const { setCenter, getNode } = useReactFlow();

	// Expose methods to parent via ref
	useImperativeHandle(ref, () => ({
		fitViewToNode: (nodeId: string) => {
			const node = getNode(nodeId);
			if (node?.position) {
				// Center on the node with zoom
				setCenter(
					node.position.x + (node.measured?.width || 0) / 2,
					node.position.y + (node.measured?.height || 0) / 2,
					{ zoom: 1.2, duration: 800 },
				);
			}
		},
	}));

	// Define custom node types for C4 elements
	const nodeTypes = useMemo(
		() => ({
			person: PersonNode,
			system: SystemNode,
			externalSystem: ExternalSystemNode,
			container: ContainerNode,
			component: ComponentNode,
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
				snapGrid={[20, 20]}
				nodesDraggable
				nodesConnectable
				elementsSelectable
			>
				<Background color={theme.color.border.primary} />
				<Controls className={reactFlowControls} />
				<MiniMap
					nodeColor={(node) => {
						// Color nodes based on their type using tactical colors
						switch (node.type) {
							case "person":
								return theme.color.semantic.person;
							case "system":
								return theme.color.semantic.system;
							case "externalSystem":
								return theme.color.semantic.external;
							case "container":
								return theme.color.semantic.container;
							case "component":
								return theme.color.semantic.component;
							default:
								return theme.color.foreground.secondary;
						}
					}}
					nodeStrokeColor={(node) => {
						// Highlight selected nodes with tactical cyan
						return node.selected
							? theme.color.status.selected
							: theme.color.border.primary;
					}}
					nodeStrokeWidth={3}
					maskColor={`${theme.color.background.base}cc`}
					style={{
						backgroundColor: theme.color.background.surface,
						border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
						clipPath: theme.clipPath.md,
					}}
				/>
			</ReactFlow>
		</div>
	);
}

const C4CanvasWithRef = forwardRef(C4CanvasInner);

export const C4Canvas = forwardRef<C4CanvasRef, C4CanvasProps>((props, ref) => (
	<ReactFlowProvider>
		<C4CanvasWithRef {...props} ref={ref} />
	</ReactFlowProvider>
));
