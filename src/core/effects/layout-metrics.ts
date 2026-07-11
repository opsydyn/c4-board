import type { Edge, Node, XYPosition } from "@xyflow/react";
import { getNodeDimensions } from "./layout-node-size";
import type { LayoutEdgeRoute, LayoutQualityMetrics, LayoutRoutedQualityMetrics } from "./layout.types";

interface NodeBox {
  id: string;
  parentId: string | undefined;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LineSegment {
  sourceId: string;
  targetId: string;
  start: XYPosition;
  end: XYPosition;
}

const EMPTY_METRICS: LayoutQualityMetrics = {
  nodeOverlapCount: 0,
  nodeOverlapArea: 0,
  straightLineCrossingCount: 0,
  totalEdgeLength: 0,
  maximumEdgeLength: 0,
  boundingBox: { x: 0, y: 0, width: 0, height: 0 },
  aspectRatio: 0,
  occupiedArea: 0,
  displacedNodeCount: 0,
  averageNodeDisplacement: 0,
  maximumNodeDisplacement: 0,
};

export function evaluateLayoutQuality(
  nodes: Node[],
  edges: Edge[],
  previousNodes: Node[] = [],
): LayoutQualityMetrics {
  if (nodes.length === 0) {
    return { ...EMPTY_METRICS, boundingBox: { ...EMPTY_METRICS.boundingBox } };
  }

  const boxes = buildNodeBoxes(nodes);
  const boxById = new Map(boxes.map((box) => [box.id, box]));
  const overlap = calculateOverlaps(boxes);
  const edgeGeometry = calculateEdgeGeometry(edges, boxById);
  const bounds = calculateBounds(boxes);
  const displacement = calculateDisplacement(nodes, previousNodes);

  return {
    nodeOverlapCount: overlap.count,
    nodeOverlapArea: overlap.area,
    straightLineCrossingCount: countCrossings(edgeGeometry.segments),
    totalEdgeLength: edgeGeometry.totalLength,
    maximumEdgeLength: edgeGeometry.maximumLength,
    boundingBox: bounds,
    aspectRatio: bounds.height === 0 ? 0 : bounds.width / bounds.height,
    occupiedArea: bounds.width * bounds.height,
    displacedNodeCount: displacement.count,
    averageNodeDisplacement: displacement.average,
    maximumNodeDisplacement: displacement.maximum,
  };
}

export function evaluateRoutedEdgeQuality(
  routes: LayoutEdgeRoute[],
): LayoutRoutedQualityMetrics {
  const segments = routes.flatMap((route) =>
    route.sections.flatMap((section) => {
      const points = [section.start, ...section.bends, section.end];
      return points.slice(1).map((end, index) => ({
        edgeId: route.edgeId,
        start: points[index]!,
        end,
      }));
    })
  );
  let edgeCrossingCount = 0;
  let totalEdgeLength = 0;

  for (const segment of segments) {
    totalEdgeLength += Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y);
  }
  for (let leftIndex = 0; leftIndex < segments.length; leftIndex += 1) {
    const left = segments[leftIndex]!;
    for (let rightIndex = leftIndex + 1; rightIndex < segments.length; rightIndex += 1) {
      const right = segments[rightIndex]!;
      if (left.edgeId === right.edgeId) continue;
      if (segmentsProperlyIntersect(left.start, left.end, right.start, right.end)) {
        edgeCrossingCount += 1;
      }
    }
  }

  return { edgeCrossingCount, totalEdgeLength };
}

function buildNodeBoxes(nodes: Node[]): NodeBox[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const absolutePositionById = new Map<string, XYPosition>();

  const resolvePosition = (node: Node, resolving: Set<string>): XYPosition => {
    const cached = absolutePositionById.get(node.id);
    if (cached) return cached;

    if (!node.parentId || resolving.has(node.id)) {
      absolutePositionById.set(node.id, node.position);
      return node.position;
    }

    const parent = nodeById.get(node.parentId);
    if (!parent) {
      absolutePositionById.set(node.id, node.position);
      return node.position;
    }

    const nextResolving = new Set(resolving).add(node.id);
    const parentPosition = resolvePosition(parent, nextResolving);
    const position = {
      x: parentPosition.x + node.position.x,
      y: parentPosition.y + node.position.y,
    };
    absolutePositionById.set(node.id, position);
    return position;
  };

  return nodes.map((node) => {
    const position = resolvePosition(node, new Set());
    const dimensions = getNodeDimensions(node);
    return { id: node.id, parentId: node.parentId, ...position, ...dimensions };
  });
}

function calculateOverlaps(boxes: NodeBox[]): { count: number; area: number } {
  let count = 0;
  let area = 0;
  const boxById = new Map(boxes.map((box) => [box.id, box]));

  for (let leftIndex = 0; leftIndex < boxes.length; leftIndex += 1) {
    const left = boxes[leftIndex];
    if (!left) continue;

    for (let rightIndex = leftIndex + 1; rightIndex < boxes.length; rightIndex += 1) {
      const right = boxes[rightIndex];
      if (!right) continue;
      if (isAncestor(left, right, boxById) || isAncestor(right, left, boxById)) continue;

      const overlapWidth = Math.min(left.x + left.width, right.x + right.width)
        - Math.max(left.x, right.x);
      const overlapHeight = Math.min(left.y + left.height, right.y + right.height)
        - Math.max(left.y, right.y);

      if (overlapWidth > 0 && overlapHeight > 0) {
        count += 1;
        area += overlapWidth * overlapHeight;
      }
    }
  }

  return { count, area };
}

function isAncestor(
  candidate: NodeBox,
  node: NodeBox,
  boxById: Map<string, NodeBox>,
): boolean {
  let parentId = node.parentId;
  const visited = new Set<string>();

  while (parentId && !visited.has(parentId)) {
    if (parentId === candidate.id) return true;
    visited.add(parentId);
    parentId = boxById.get(parentId)?.parentId;
  }

  return false;
}

function calculateEdgeGeometry(
  edges: Edge[],
  boxById: Map<string, NodeBox>,
): { segments: LineSegment[]; totalLength: number; maximumLength: number } {
  const segments: LineSegment[] = [];
  let totalLength = 0;
  let maximumLength = 0;

  for (const edge of edges) {
    const source = boxById.get(edge.source);
    const target = boxById.get(edge.target);
    if (!source || !target) continue;

    const start = centerOf(source);
    const end = centerOf(target);
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    totalLength += length;
    maximumLength = Math.max(maximumLength, length);
    segments.push({ sourceId: edge.source, targetId: edge.target, start, end });
  }

  return { segments, totalLength, maximumLength };
}

function centerOf(box: NodeBox): XYPosition {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function countCrossings(segments: LineSegment[]): number {
  let crossings = 0;

  for (let leftIndex = 0; leftIndex < segments.length; leftIndex += 1) {
    const left = segments[leftIndex];
    if (!left) continue;

    for (let rightIndex = leftIndex + 1; rightIndex < segments.length; rightIndex += 1) {
      const right = segments[rightIndex];
      if (!right || sharesEndpoint(left, right)) continue;
      if (segmentsProperlyIntersect(left.start, left.end, right.start, right.end)) crossings += 1;
    }
  }

  return crossings;
}

function sharesEndpoint(left: LineSegment, right: LineSegment): boolean {
  return left.sourceId === right.sourceId
    || left.sourceId === right.targetId
    || left.targetId === right.sourceId
    || left.targetId === right.targetId;
}

function segmentsProperlyIntersect(
  firstStart: XYPosition,
  firstEnd: XYPosition,
  secondStart: XYPosition,
  secondEnd: XYPosition,
): boolean {
  const firstSideStart = orientation(firstStart, firstEnd, secondStart);
  const firstSideEnd = orientation(firstStart, firstEnd, secondEnd);
  const secondSideStart = orientation(secondStart, secondEnd, firstStart);
  const secondSideEnd = orientation(secondStart, secondEnd, firstEnd);

  return firstSideStart * firstSideEnd < 0 && secondSideStart * secondSideEnd < 0;
}

function orientation(start: XYPosition, end: XYPosition, point: XYPosition): number {
  return (end.x - start.x) * (point.y - start.y)
    - (end.y - start.y) * (point.x - start.x);
}

function calculateBounds(boxes: NodeBox[]): LayoutQualityMetrics["boundingBox"] {
  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const maxX = Math.max(...boxes.map((box) => box.x + box.width));
  const maxY = Math.max(...boxes.map((box) => box.y + box.height));

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function calculateDisplacement(
  nodes: Node[],
  previousNodes: Node[],
): { count: number; average: number; maximum: number } {
  const previousById = new Map(previousNodes.map((node) => [node.id, node]));
  const distances: number[] = [];

  for (const node of nodes) {
    const previous = previousById.get(node.id);
    if (!previous) continue;
    const distance = Math.hypot(
      node.position.x - previous.position.x,
      node.position.y - previous.position.y,
    );
    if (distance > 0) distances.push(distance);
  }

  if (distances.length === 0) return { count: 0, average: 0, maximum: 0 };

  return {
    count: distances.length,
    average: distances.reduce((sum, distance) => sum + distance, 0) / distances.length,
    maximum: Math.max(...distances),
  };
}
