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
	ConnectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo, forwardRef, useImperativeHandle, useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { ExternalSystemNode } from "./nodes/ExternalSystemNode";
import { PersonNode } from "./nodes/PersonNode";
import { SystemNode } from "./nodes/SystemNode";
import { ContainerNode } from "./nodes/ContainerNode";
import { ComponentNode } from "./nodes/ComponentNode";
import {
	canvasContainer,
	canvasStack,
	commandBar,
	commandBarButton,
	commandBarHandle,
	commandBarToggle,
	commandBarLeft,
	commandBarRight,
	commandBarSearch,
	reactFlowControls,
} from "./styles.css";
import { theme } from "../../styles/theme.css";
import { DownloadButton } from "./DownloadButton";
import { ToggleButton } from "react-aria-components";
import { CaretDownIcon, CaretUpIcon } from "@phosphor-icons/react";
import { SearchBox } from "./SearchBox";

interface C4CanvasProps {
	nodes: Node[];
	edges: Edge[];
	onNodesChange?: OnNodesChange<Node>;
	onEdgesChange?: OnEdgesChange<Edge>;
	onConnect?: OnConnect;
	onNodeClick?: NodeMouseHandler<Node>;
	isCommandBarOpen: boolean;
	onToggleCommandBar: (open: boolean) => void;
	onSelectNode: (nodeId: string) => void;
}

export interface C4CanvasRef {
	fitViewToNode: (nodeId: string) => void;
	fitViewToGraph: () => void;
}

function C4CanvasInner(
	{
		nodes,
		edges,
		onNodesChange,
		onEdgesChange,
		onConnect,
		onNodeClick,
		isCommandBarOpen,
		onToggleCommandBar,
		onSelectNode,
	}: C4CanvasProps,
	ref: React.Ref<C4CanvasRef>,
) {
	const { setCenter, getNode, fitView } = useReactFlow();

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
		fitViewToGraph: () => {
			fitView({ padding: 0.2, duration: 600 });
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

	// Default edge styling for C4 relationships with directional arrows
	const defaultEdgeOptions = useMemo(
		() => ({
			type: "smoothstep", // Smooth step edges for cleaner routing
			animated: false, // Disable animation for cleaner look
			style: {
				stroke: theme.color.semantic.relationship,
				strokeWidth: 2,
				strokeDasharray: "5,5", // Dotted line pattern
			},
			labelStyle: {
				fill: "#FFFFFF", // White text for clarity
				fontSize: 12,
				fontFamily: theme.typography.family.mono,
				fontWeight: 600,
				letterSpacing: "0.05em",
			},
			labelBgStyle: {
				fill: theme.color.background.base,
				fillOpacity: 0.9, // Higher opacity for better contrast
			},
			// Add directional arrow marker
			markerEnd: {
				type: "arrowclosed" as const,
				width: 20,
				height: 20,
				color: theme.color.semantic.relationship,
			},
		}),
		[],
	);

	const handleNodeDoubleClick = useCallback(
		(event: React.MouseEvent, node: Node) => {
			if (onNodeClick) {
				onNodeClick(event, node);
			}
			if (node?.position) {
				setCenter(
					node.position.x + (node.measured?.width || 0) / 2,
					node.position.y + (node.measured?.height || 0) / 2,
					{ zoom: 1.4, duration: 400 },
				);
			}
		},
		[onNodeClick, setCenter],
	);

	return (
		<div className={canvasStack}>
			{isCommandBarOpen ? (
				<div className={commandBar}>
					<div className={commandBarLeft}>
						<DownloadButton variant="inline" className={commandBarButton} />
					</div>
					<div className={commandBarRight}>
						<div className={commandBarSearch}>
							<SearchBox nodes={nodes} onSelectNode={onSelectNode} />
						</div>
						<ToggleButton
							isSelected={isCommandBarOpen}
							onChange={onToggleCommandBar}
							className={commandBarToggle}
							aria-label="Collapse command bar"
						>
							<CaretUpIcon size={14} weight="bold" />
							ESC
						</ToggleButton>
					</div>
				</div>
			) : (
				<ToggleButton
					isSelected={isCommandBarOpen}
					onChange={onToggleCommandBar}
					className={commandBarHandle}
					aria-label="Expand command bar"
				>
					<CaretDownIcon size={16} weight="bold" />
				</ToggleButton>
			)}
			<div className={canvasContainer}>
				<ReactFlow
					proOptions={{ hideAttribution: true }}
					nodes={nodes}
					edges={edges}
					{...(onNodesChange && { onNodesChange })}
					{...(onEdgesChange && { onEdgesChange })}
					{...(onConnect && { onConnect })}
					{...(onNodeClick && { onNodeClick })}
					onNodeDoubleClick={handleNodeDoubleClick}
					nodeTypes={nodeTypes}
					defaultEdgeOptions={defaultEdgeOptions}
					fitView
					snapToGrid
					snapGrid={[20, 20]}
					nodesDraggable
					nodesConnectable
					elementsSelectable
					connectionMode={ConnectionMode.Loose}
				>
					<Background color={theme.color.border.primary} />
					<Controls className={reactFlowControls} />
					<MiniMap
						pannable
						zoomable
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
		</div>
	);
}

const C4CanvasWithRef = forwardRef(C4CanvasInner);

export const C4Canvas = forwardRef<C4CanvasRef, C4CanvasProps>((props, ref) => (
	<ReactFlowProvider>
		<C4CanvasWithRef {...props} ref={ref} />
	</ReactFlowProvider>
));


C4Canvas.displayName = 'C4Canvas';
