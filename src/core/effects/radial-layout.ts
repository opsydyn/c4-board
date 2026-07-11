import type { Node, XYPosition } from "@xyflow/react";
import { getNodeDimensions, type NodeDimensions } from "./layout-node-size";
import type { LayoutOptions } from "./layout.types";

const DEFAULT_MARGIN = 40;

export interface RadialRingAssignment {
  radius: number;
  nodes: Node[];
}

export function assignRadialRings(
  centerNode: Node,
  satellites: Node[],
  options: LayoutOptions,
): RadialRingAssignment[] {
  if (satellites.length === 0) return [];

  const satelliteDimensions = new Map(
    satellites.map((node) => [node.id, getNodeDimensions(node)]),
  );
  const largestSatelliteDiagonal = Math.max(
    ...satellites.map((node) => diagonal(satelliteDimensions.get(node.id)!)),
  );
  const centerRadius = diagonal(getNodeDimensions(centerNode)) / 2;
  const ringSpacing = options.ringSpacing ?? options.rankSpacing;
  let radius = centerRadius + largestSatelliteDiagonal / 2 + ringSpacing;
  let remaining = [...satellites];
  const rings: RadialRingAssignment[] = [];

  while (remaining.length > 0) {
    const largestRemainingDiagonal = Math.max(
      ...remaining.map((node) => diagonal(satelliteDimensions.get(node.id)!)),
    );
    const requiredChord = largestRemainingDiagonal + options.nodeSpacing;
    const capacity = ringCapacity(radius, requiredChord);
    const ringNodes = remaining.slice(0, capacity);
    rings.push({ radius, nodes: ringNodes });
    remaining = remaining.slice(ringNodes.length);
    radius += largestRemainingDiagonal + ringSpacing;
  }

  return rings;
}

export function positionRadialRings(
  centerNode: Node,
  rings: RadialRingAssignment[],
  options: LayoutOptions,
): Node[] {
  const rawPositions = new Map<string, XYPosition>([[centerNode.id, { x: 0, y: 0 }]]);
  const startAngle = ((options.startAngleDegrees ?? -90) * Math.PI) / 180;

  for (const ring of rings) {
    const angleStep = (Math.PI * 2) / ring.nodes.length;
    ring.nodes.forEach((node, index) => {
      const angle = startAngle + angleStep * index;
      rawPositions.set(node.id, {
        x: Math.cos(angle) * ring.radius,
        y: Math.sin(angle) * ring.radius,
      });
    });
  }

  const allNodes = [centerNode, ...rings.flatMap((ring) => ring.nodes)];
  const rawTopLeft = allNodes.map((node) => {
    const center = rawPositions.get(node.id)!;
    const { width, height } = getNodeDimensions(node);
    return {
      node,
      position: { x: center.x - width / 2, y: center.y - height / 2 },
    };
  });
  const minX = Math.min(...rawTopLeft.map(({ position }) => position.x));
  const minY = Math.min(...rawTopLeft.map(({ position }) => position.y));

  return rawTopLeft.map(({ node, position }) => ({
    ...node,
    position: snapPosition(
      { x: position.x - minX + DEFAULT_MARGIN, y: position.y - minY + DEFAULT_MARGIN },
      options,
    ),
  }));
}

function ringCapacity(radius: number, requiredChord: number): number {
  if (requiredChord >= radius * 2) return 1;
  const minimumAngle = 2 * Math.asin(requiredChord / (radius * 2));
  return Math.max(1, Math.floor((Math.PI * 2) / minimumAngle));
}

function diagonal(dimensions: NodeDimensions): number {
  return Math.hypot(dimensions.width, dimensions.height);
}

function snapPosition(position: XYPosition, options: LayoutOptions): XYPosition {
  if (!options.snapToGrid || !options.gridSize) return position;
  return {
    x: Math.round(position.x / options.gridSize) * options.gridSize,
    y: Math.round(position.y / options.gridSize) * options.gridSize,
  };
}
