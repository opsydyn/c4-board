import type { Edge, Node } from "@xyflow/react";

export interface LayoutOptions {
  direction: "TB" | "LR" | "BT" | "RL";
  nodeSpacing: number;
  rankSpacing: number;
  edgeSpacing: number;
  snapToGrid?: boolean;
  gridSize?: number;
  strategyId?: string;
  hubNodeId?: string;
  systemOfInterestNodeId?: string;
  ringSpacing?: number;
  startAngleDegrees?: number;
}

export type LayoutEngine = "dagre" | "elk" | "custom";

export interface LayoutRecommendation {
  id: "change-direction" | "reduce-rank-spacing";
  label: string;
  rationale: string;
  options: Partial<LayoutOptions>;
}

export interface LayoutDiagnostic {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  nodeIds?: string[];
  edgeIds?: string[];
  recommendation?: LayoutRecommendation;
}

export interface LayoutQualityMetrics {
  nodeOverlapCount: number;
  nodeOverlapArea: number;
  straightLineCrossingCount: number;
  totalEdgeLength: number;
  maximumEdgeLength: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  aspectRatio: number;
  occupiedArea: number;
  displacedNodeCount: number;
  averageNodeDisplacement: number;
  maximumNodeDisplacement: number;
}

export interface LayoutInput {
  nodes: Node[];
  edges: Edge[];
  options?: Partial<LayoutOptions>;
}

export interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
  nodeBounds?: LayoutNodeBounds[];
  edgeRoutes?: LayoutEdgeRoute[];
  edgePortAssignments?: LayoutEdgePortAssignment[];
  portCongestion?: LayoutPortCongestion[];
  strategyId: string;
  engine: LayoutEngine;
  diagnostics: LayoutDiagnostic[];
  quality: LayoutQualityMetrics;
}

export interface LayoutNodeBounds {
  nodeId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutEdgeRoute {
  edgeId: string;
  sections: Array<{
    start: { x: number; y: number };
    bends: Array<{ x: number; y: number }>;
    end: { x: number; y: number };
  }>;
}

export interface LayoutRoutedQualityMetrics {
  edgeCrossingCount: number;
  totalEdgeLength: number;
}

export interface LayoutApplicationAudit {
  version: 1;
  appliedAt: number;
  preset: string;
  strategyId: string;
  engine: LayoutEngine;
  selectedVariant: "single" | "original" | "recommended";
  comparisonMetrics: Array<{
    key: "overlaps" | "canvasArea" | "routedCrossings" | "routedLength";
    original: number;
    recommended: number;
    favored: "original" | "recommended" | "tie";
  }>;
}

export const LAYOUT_AUDIT_RETENTION_LIMIT = 100;

export interface LayoutEdgePortAssignment {
  edgeId: string;
  sourceHandle: LayoutHandle;
  targetHandle: LayoutHandle;
  sourcePortId: string;
  targetPortId: string;
  sourceOrder: number;
  targetOrder: number;
  semanticClass: LayoutRelationshipClass;
}

export type LayoutHandle = "top" | "right" | "bottom" | "left";
export type LayoutRelationshipClass = "command" | "event" | "data" | "request";

export interface LayoutPortCongestion {
  nodeId: string;
  side: LayoutHandle;
  edgeCount: number;
  estimatedCapacity: number;
  congested: boolean;
}

export interface LayoutAnalysis {
  applicable: boolean;
  score: number;
  reasons: string[];
}

export interface LayoutStrategy {
  readonly id: string;
  readonly engine: LayoutEngine;
  analyse(input: LayoutInput): LayoutAnalysis;
  layout(input: LayoutInput): LayoutResult | Promise<LayoutResult>;
}

export interface SynchronousLayoutStrategy extends LayoutStrategy {
  layout(input: LayoutInput): LayoutResult;
}
