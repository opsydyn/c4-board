/**
 * C4Canvas - Main ReactFlow Canvas Component
 *
 * Renders the interactive C4 diagram canvas.
 * Pure view component - state managed by XState machine.
 */

import {
  Background,
  ConnectionMode,
  Controls,
  type Edge,
  type EdgeMouseHandler,
  MiniMap,
  type Node,
  type NodeMouseHandler,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
  ReactFlow,
  ReactFlowProvider,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useNodesInitialized, useReactFlow } from "@xyflow/react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { NodeDomain } from "../../core/effects/node-operations";
import { nodeTypesForDomain } from "./nodes/nodeTypesByDomain";
// DDD Strategic Nodes
// DDD Tactical Nodes
// DDD Application Nodes
// DDD Infrastructure Nodes
import { CaretDownIcon, CaretUpIcon, FileCodeIcon } from "@phosphor-icons/react";
import { PhysicalPosition } from "@tauri-apps/api/dpi";
import { ToggleButton } from "react-aria-components";
import {
  type EdgeData,
  type EdgeMetadata,
  getEdgeAnimation,
  getEdgeColor,
  getEdgeStyle,
  getEdgeThickness,
} from "../../core/effects/edge-operations";
import { flex } from "../../styles/sprinkles.css";
import { theme } from "../../styles/theme.css";
import {
  type ContextMenuAction,
  createCanvasContextMenu,
  createEdgeContextMenu,
  createNodeContextMenu,
  showContextMenu,
} from "../utils/contextMenu";
import { CustomAnimatedEdge } from "./CustomAnimatedEdge";
import { DownloadButton } from "./DownloadButton";
import { EdgeMetadataEditor } from "./EdgeMetadataEditor";
import { ImportButton } from "./ImportButton";
import { RoutedEdge } from "./RoutedEdge";
import { SearchBox } from "./SearchBox";
import * as styles from "./styles.css";

// Re-exported, not redeclared: one definition per concept (ADR-016).
import type { CanvasAmbientTone } from "../../core/effects/canvas-ambient-tone";

interface C4CanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange?: OnNodesChange<Node>;
  onEdgesChange?: OnEdgesChange<Edge>;
  onConnect?: OnConnect;
  onNodeClick?: NodeMouseHandler<Node>;
  onUpdateEdgeLabel?: (edgeId: string, label: string) => void;
  onUpdateEdgeMetadata?: (edgeId: string, label: string, metadata: EdgeMetadata) => void;
  isCommandBarOpen: boolean;
  onToggleCommandBar: (open: boolean) => void;
  onSelectNode: (nodeId: string) => void;
  onExportPlantUML?: (viewport: Viewport) => void;
  onExportMermaid?: (viewport: Viewport) => void;
  onImportDiagram?: (content: string, format: "plantuml" | "mermaid", mode: "replace" | "merge") => void;
  viewportToApply?: Viewport | null;
  onContextMenuAction?: (action: ContextMenuAction, nodeId?: string, edgeId?: string) => void;
  animationsEnabled?: boolean;
  ambientTone?: CanvasAmbientTone;
  /** Chooses how node types are drawn (ADR-016). */
  domain?: NodeDomain;
  readOnly?: boolean;
  visualHarness?: boolean;
  viewportFitNodeIds?: readonly string[];
}

export interface C4CanvasRef {
  fitViewToNode: (nodeId: string) => void;
  fitViewToGraph: (options?: { animated?: boolean }) => void;
}

export function resolveCanvasFitNodeIds(
  nodes: readonly Node[],
  viewportFitNodeIds?: readonly string[],
): string[] {
  const graphNodeIds = nodes.map(({ id }) => id);
  if (!viewportFitNodeIds) return graphNodeIds;

  const graphNodeIdSet = new Set(graphNodeIds);
  const selectedNodeIds = viewportFitNodeIds.filter(nodeId => graphNodeIdSet.has(nodeId));
  return selectedNodeIds.length > 0 ? selectedNodeIds : graphNodeIds;
}

export function resolveCanvasViewportChrome(visualHarness: boolean): {
  minZoom?: number;
  showMiniMap: boolean;
} {
  return visualHarness
    ? { minZoom: 0.1, showMiniMap: false }
    : { showMiniMap: true };
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
    onUpdateEdgeMetadata,
    isCommandBarOpen,
    onToggleCommandBar,
    onSelectNode,
    onExportPlantUML,
    onExportMermaid,
    onImportDiagram,
    viewportToApply,
    onContextMenuAction,
    animationsEnabled = true,
    ambientTone = "c4",
    domain = "c4",
    readOnly = false,
    visualHarness = false,
    viewportFitNodeIds,
  }: C4CanvasProps,
  ref: React.Ref<C4CanvasRef>,
) {
  const { setCenter, getNode, fitView, getViewport, setViewport } = useReactFlow();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  /**
   * True once ReactFlow has measured every node.
   *
   * A board opened from cold rendered blank: the nodes were present and the
   * minimap drew them, but the viewport was elsewhere. The fit ran on the
   * render where the nodes arrived, which is before ReactFlow has measured
   * them — measurement happens after paint, via its own ResizeObserver — so
   * there were no bounds to fit to and the call did nothing. Adding a node
   * afterwards fitted correctly, because by then everything had dimensions.
   *
   * This is the signal to wait on instead of guessing with an animation frame.
   */
  const nodesInitialized = useNodesInitialized();
  const fitNodeIds = useMemo(
    () => resolveCanvasFitNodeIds(nodes, viewportFitNodeIds),
    [nodes, viewportFitNodeIds],
  );
  const viewportChrome = resolveCanvasViewportChrome(visualHarness);
  const fitViewOptions = useMemo(() => ({
    nodes: fitNodeIds.map((id) => ({ id })),
    padding: 0.2,
  }), [fitNodeIds]);
  const fitGraph = useCallback((duration: number) => {
    void fitView({
      ...fitViewOptions,
      duration,
    });
  }, [fitView, fitViewOptions]);

  // Edge label editor state
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [isEdgeLabelEditorOpen, setIsEdgeLabelEditorOpen] = useState(false);

  /**
   * Fit once per board, as soon as its nodes have been measured.
   *
   * Keyed on the node-id signature rather than a count so that swapping
   * diagrams of the same size still refits, and so that moving a node does not.
   */
  const fitSignature = useMemo(() => fitNodeIds.join("|"), [fitNodeIds]);
  const fittedSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (!nodesInitialized || fitNodeIds.length === 0) {
      return;
    }
    if (fittedSignatureRef.current === fitSignature) {
      return;
    }

    fittedSignatureRef.current = fitSignature;
    fitGraph(0);
  }, [fitGraph, fitNodeIds.length, fitSignature, nodesInitialized]);

  // Apply viewport after import if available
  useEffect(() => {
    if (viewportToApply) {
      // Small delay to ensure nodes are rendered before applying viewport
      setTimeout(() => {
        setViewport(viewportToApply, { duration: 300 });
      }, 100);
    }
  }, [viewportToApply, setViewport]);

  useEffect(() => {
    if (!readOnly || !canvasContainerRef.current) return;
    let frame: number | null = null;
    const observer = new ResizeObserver(() => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        fitGraph(0);
      });
    });
    observer.observe(canvasContainerRef.current);
    return () => {
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [fitGraph, readOnly]);

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
    fitViewToGraph: (options) => {
      fitGraph(options?.animated === false ? 0 : 600);
    },
  }), [fitGraph, getNode, setCenter]);

  // Define custom node types for C4 and DDD elements
  // Resolved per domain, and stable per domain: ReactFlow remounts every node
  // when this identity changes (ADR-016).
  const nodeTypes = useMemo(() => nodeTypesForDomain(domain), [domain]);

  // Define custom edge types
  const edgeTypes = useMemo(
    () => ({
      animated: CustomAnimatedEdge,
      routed: RoutedEdge,
    }),
    [],
  );

  // Enrich edges with metadata-based styling and animation
  const enrichedEdges = useMemo(() => {
    return edges.map((edge) => {
      const edgeData = edge.data as EdgeData | undefined;
      const metadata = edgeData?.metadata;

      // Get style properties based on metadata
      const strokeDasharray = getEdgeStyle(metadata?.communicationStyle);
      const stroke = getEdgeColor(metadata?.protocol);
      const strokeWidth = getEdgeThickness(metadata?.requestVolume);
      const animation = getEdgeAnimation(metadata);

      // Respect global animation toggle
      const shouldAnimate = animationsEnabled && animation.animated;

      return {
        ...edge,
        // Use custom edge type when animation is enabled for advanced effects
        type: edgeData?.layoutRoute ? "routed" : shouldAnimate ? "animated" : "smoothstep",
        animated: shouldAnimate,
        style: {
          ...edge.style,
          stroke,
          strokeWidth,
          strokeDasharray,
          ...(animation.duration && shouldAnimate && {
            animationDuration: `${animation.duration}ms`,
          }),
        },
        markerEnd: {
          type: "arrowclosed" as const,
          width: 20,
          height: 20,
          color: stroke,
        },
      };
    });
  }, [edges, animationsEnabled]);

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

  const canvasToneClassName = useMemo(() => {
    switch (ambientTone) {
      case "azure":
        return styles.canvasContainerToneAzure;
      case "ddd":
        return styles.canvasContainerToneDDD;
      case "eventStorming":
        return styles.canvasContainerToneStorm;
      case "c4":
      default:
        return styles.canvasContainerToneC4;
    }
  }, [ambientTone]);

  const handleNodeDoubleClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (!readOnly && onNodeClick) {
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
    [onNodeClick, readOnly, setCenter],
  );

  // Handle edge click to open label editor
  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      setSelectedEdgeId(edge.id);
      setIsEdgeLabelEditorOpen(true);
    },
    [],
  );

  // Handle saving edge label and metadata
  const handleSaveEdgeMetadata = useCallback(
    (edgeId: string, label: string, metadata: EdgeMetadata) => {
      if (onUpdateEdgeMetadata) {
        onUpdateEdgeMetadata(edgeId, label, metadata);
      } else if (onUpdateEdgeLabel) {
        // Fallback to label-only update
        onUpdateEdgeLabel(edgeId, label);
      }
    },
    [onUpdateEdgeMetadata, onUpdateEdgeLabel],
  );

  // Handle closing edge label editor
  const handleCloseEdgeLabelEditor = useCallback(() => {
    setIsEdgeLabelEditorOpen(false);
    setSelectedEdgeId(null);
  }, []);

  // Context menu handlers
  const handleNodeContextMenu = useCallback<NodeMouseHandler>(
    async (event, node) => {
      event.preventDefault();

      if (!onContextMenuAction) return;

      const menu = await createNodeContextMenu((action) => {
        onContextMenuAction(action, node.id);
      });

      const position = new PhysicalPosition(event.clientX, event.clientY);
      await showContextMenu(menu, position);
    },
    [onContextMenuAction],
  );

  const handleEdgeContextMenu = useCallback<EdgeMouseHandler>(
    async (event, edge) => {
      event.preventDefault();

      if (!onContextMenuAction) return;

      const menu = await createEdgeContextMenu((action) => {
        onContextMenuAction(action, undefined, edge.id);
      });

      const position = new PhysicalPosition(event.clientX, event.clientY);
      await showContextMenu(menu, position);
    },
    [onContextMenuAction],
  );

  const handlePaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault();

      if (!onContextMenuAction) return;

      // Get the ReactFlow viewport to convert screen coordinates to canvas coordinates
      const viewport = getViewport();
      const canvasX = (event.clientX - viewport.x) / viewport.zoom;
      const canvasY = (event.clientY - viewport.y) / viewport.zoom;

      // Run async operations without blocking
      (async () => {
        const menu = await createCanvasContextMenu(
          (action) => {
            onContextMenuAction(action);
          },
          { x: canvasX, y: canvasY },
        );

        const position = new PhysicalPosition(event.clientX, event.clientY);
        await showContextMenu(menu, position);
      })().catch(console.error);
    },
    [onContextMenuAction, getViewport],
  );

  return (
    <div className={styles.canvasStack}>
      {isCommandBarOpen
        ? (
          <div className={styles.commandBar}>
            <div className={styles.commandBarSearch}>
              <SearchBox nodes={nodes} onSelectNode={onSelectNode} />
            </div>
            <div className={flex({ direction: "row", justify: "between", align: "center", wrap: "wrap", gap: "2" })}>
              <div className={flex({ direction: "row", align: "center", wrap: "wrap", gap: "2" })}>
                <DownloadButton variant="inline" className={styles.commandBarButton} />
                {onExportPlantUML && (
                  <button
                    type="button"
                    className={styles.commandBarButton}
                    onClick={() => onExportPlantUML(getViewport())}
                  >
                    <FileCodeIcon size={18} weight="duotone" />
                    EXPORT::PUML
                  </button>
                )}
                {onExportMermaid && (
                  <button
                    type="button"
                    className={styles.commandBarButton}
                    onClick={() => onExportMermaid(getViewport())}
                  >
                    <FileCodeIcon size={18} weight="duotone" />
                    EXPORT::MERMAID
                  </button>
                )}
                {onImportDiagram && (
                  <ImportButton
                    onImport={onImportDiagram}
                    className={styles.commandBarButton}
                  />
                )}
              </div>
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
        )
        : (
          <ToggleButton
            isSelected={isCommandBarOpen}
            onChange={onToggleCommandBar}
            className={styles.commandBarHandle}
            aria-label="Expand command bar"
          >
            <CaretDownIcon size={16} weight="bold" />
          </ToggleButton>
        )}
      <div ref={canvasContainerRef} className={`${styles.canvasContainer} ${canvasToneClassName}`}>
        <ReactFlow
          proOptions={{ hideAttribution: true }}
          nodes={nodes}
          edges={enrichedEdges}
          {...(onNodesChange && { onNodesChange })}
          {...(onEdgesChange && { onEdgesChange })}
          {...(onConnect && { onConnect })}
          {...(onNodeClick && { onNodeClick })}
          onNodeDoubleClick={handleNodeDoubleClick}
          {...(!readOnly && { onNodeContextMenu: handleNodeContextMenu })}
          {...(!readOnly && { onEdgeClick: handleEdgeClick })}
          {...(!readOnly && { onEdgeContextMenu: handleEdgeContextMenu })}
          {...(!readOnly && { onPaneContextMenu: handlePaneContextMenu })}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          fitViewOptions={fitViewOptions}
          {...(viewportChrome.minZoom && { minZoom: viewportChrome.minZoom })}
          snapToGrid
          snapGrid={[20, 20]}
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable={!readOnly}
          connectionMode={ConnectionMode.Loose}
        >
          <Background color={theme.color.border.primary} />
          <Controls className={styles.reactFlowControls} />
          {viewportChrome.showMiniMap && (
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
          )}
        </ReactFlow>
      </div>
      {selectedEdgeId && (() => {
        const selectedEdge = edges.find((e) => e.id === selectedEdgeId);
        const edgeData = selectedEdge?.data as EdgeData | undefined;

        return (
          <EdgeMetadataEditor
            edgeId={selectedEdgeId}
            currentLabel={String(selectedEdge?.label ?? "uses")}
            currentMetadata={edgeData?.metadata}
            isOpen={isEdgeLabelEditorOpen}
            onClose={handleCloseEdgeLabelEditor}
            onSave={handleSaveEdgeMetadata}
          />
        );
      })()}
    </div>
  );
}

const C4CanvasWithRef = forwardRef(C4CanvasInner);

export const C4Canvas = forwardRef<C4CanvasRef, C4CanvasProps>((props, ref) => (
  <ReactFlowProvider>
    <C4CanvasWithRef {...props} ref={ref} />
  </ReactFlowProvider>
));

C4Canvas.displayName = "C4Canvas";
