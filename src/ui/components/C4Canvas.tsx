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
import {
	useMemo,
	forwardRef,
	useImperativeHandle,
	useCallback,
	useState,
} from "react";
import { useReactFlow } from "@xyflow/react";
import { ExternalSystemNode } from "./nodes/ExternalSystemNode";
import { PersonNode } from "./nodes/PersonNode";
import { SystemNode } from "./nodes/SystemNode";
import { ContainerNode } from "./nodes/ContainerNode";
import { ComponentNode } from "./nodes/ComponentNode";
// DDD Strategic Nodes
import { BoundedContextNode } from "./nodes/BoundedContextNode";
import { AggregateNode } from "./nodes/AggregateNode";
import { DomainEventNode } from "./nodes/DomainEventNode";
// DDD Tactical Nodes
import { EntityNode } from "./nodes/EntityNode";
import { ValueObjectNode } from "./nodes/ValueObjectNode";
import { DomainServiceNode } from "./nodes/DomainServiceNode";
import { RepositoryNode } from "./nodes/RepositoryNode";
import { FactoryNode } from "./nodes/FactoryNode";
// DDD Application Nodes
import { CommandNode } from "./nodes/CommandNode";
import { QueryNode } from "./nodes/QueryNode";
import { ApplicationServiceNode } from "./nodes/ApplicationServiceNode";
// DDD Infrastructure Nodes
import { IntegrationEventNode } from "./nodes/IntegrationEventNode";
import { ACLNode } from "./nodes/ACLNode";
import { SagaNode } from "./nodes/SagaNode";
import * as styles from "./styles.css";
import { theme } from "../../styles/theme.css";
import { DownloadButton } from "./DownloadButton";
import { ToggleButton } from "react-aria-components";
import { CaretDownIcon, CaretUpIcon, FileCodeIcon } from "@phosphor-icons/react";
import { SearchBox } from "./SearchBox";
import { EdgeLabelEditor } from "./EdgeLabelEditor";

interface C4CanvasProps {
	nodes: Node[];
	edges: Edge[];
	onNodesChange?: OnNodesChange<Node>;
	onEdgesChange?: OnEdgesChange<Edge>;
	onConnect?: OnConnect;
	onNodeClick?: NodeMouseHandler<Node>;
	onUpdateEdgeLabel?: (edgeId: string, label: string) => void;
	isCommandBarOpen: boolean;
	onToggleCommandBar: (open: boolean) => void;
	onSelectNode: (nodeId: string) => void;
	onExportPlantUML?: () => void;
	onExportMermaid?: () => void;
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
		onUpdateEdgeLabel,
		isCommandBarOpen,
		onToggleCommandBar,
		onSelectNode,
		onExportPlantUML,
		onExportMermaid,
	}: C4CanvasProps,
	ref: React.Ref<C4CanvasRef>,
) {
	const { setCenter, getNode, fitView } = useReactFlow();

	// Edge label editor state
	const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
	const [isEdgeLabelEditorOpen, setIsEdgeLabelEditorOpen] = useState(false);

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

	// Define custom node types for C4 and DDD elements
	const nodeTypes = useMemo(
		() => ({
			// C4 Architecture nodes
			person: PersonNode,
			system: SystemNode,
			externalSystem: ExternalSystemNode,
			container: ContainerNode,
			component: ComponentNode,
			// DDD Strategic nodes
			boundedContext: BoundedContextNode,
			aggregate: AggregateNode,
			domainEvent: DomainEventNode,
			// DDD Tactical nodes
			entity: EntityNode,
			valueObject: ValueObjectNode,
			domainService: DomainServiceNode,
			repository: RepositoryNode,
			factory: FactoryNode,
			// DDD Application nodes
			command: CommandNode,
			query: QueryNode,
			applicationService: ApplicationServiceNode,
			// DDD Infrastructure nodes
			integrationEvent: IntegrationEventNode,
			antiCorruptionLayer: ACLNode,
			saga: SagaNode,
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

	// Handle edge click to open label editor
	const handleEdgeClick = useCallback(
		(_event: React.MouseEvent, edge: Edge) => {
			setSelectedEdgeId(edge.id);
			setIsEdgeLabelEditorOpen(true);
		},
		[],
	);

	// Handle saving edge label
	const handleSaveEdgeLabel = useCallback(
		(edgeId: string, label: string) => {
			if (onUpdateEdgeLabel) {
				onUpdateEdgeLabel(edgeId, label);
			}
		},
		[onUpdateEdgeLabel],
	);

	// Handle closing edge label editor
	const handleCloseEdgeLabelEditor = useCallback(() => {
		setIsEdgeLabelEditorOpen(false);
		setSelectedEdgeId(null);
	}, []);

	return (
		<div className={styles.canvasStack}>
			{isCommandBarOpen ? (
				<div className={styles.commandBar}>
					<div className={styles.commandBarSearch}>
						<SearchBox nodes={nodes} onSelectNode={onSelectNode} />
					</div>
					<div className={styles.commandBarRow}>
						<div className={styles.commandBarLeft}>
							<DownloadButton variant="inline" className={styles.commandBarButton} />
							{onExportPlantUML && (
								<button
									type="button"
									className={styles.commandBarButton}
									onClick={onExportPlantUML}
								>
									<FileCodeIcon size={18} weight="duotone" />
									EXPORT::PUML
								</button>
							)}
							{onExportMermaid && (
								<button
									type="button"
									className={styles.commandBarButton}
									onClick={onExportMermaid}
								>
									<FileCodeIcon size={18} weight="duotone" />
									EXPORT::MERMAID
								</button>
							)}
						</div>
						<div className={styles.commandBarRight}>
							<ToggleButton
								isSelected={isCommandBarOpen}
								onChange={onToggleCommandBar}
								className={styles.commandBarToggle}
								aria-label="Collapse command bar"
							>
								<CaretUpIcon size={14} weight="bold" />
								ESC
							</ToggleButton>
						</div>
					</div>
				</div>
			) : (
				<ToggleButton
					isSelected={isCommandBarOpen}
					onChange={onToggleCommandBar}
					className={styles.commandBarHandle}
					aria-label="Expand command bar"
				>
					<CaretDownIcon size={16} weight="bold" />
				</ToggleButton>
			)}
			<div className={styles.canvasContainer}>
				<ReactFlow
					proOptions={{ hideAttribution: true }}
					nodes={nodes}
					edges={edges}
					{...(onNodesChange && { onNodesChange })}
					{...(onEdgesChange && { onEdgesChange })}
					{...(onConnect && { onConnect })}
					{...(onNodeClick && { onNodeClick })}
					onNodeDoubleClick={handleNodeDoubleClick}
					onEdgeClick={handleEdgeClick}
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
					<Controls className={styles.reactFlowControls} />
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
			{selectedEdgeId && (
				<EdgeLabelEditor
					edgeId={selectedEdgeId}
					currentLabel={
						String(edges.find((e) => e.id === selectedEdgeId)?.label ?? "uses")
					}
					isOpen={isEdgeLabelEditorOpen}
					onClose={handleCloseEdgeLabelEditor}
					onSave={handleSaveEdgeLabel}
				/>
			)}
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
