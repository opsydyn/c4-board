/**
 * The layout an event storm needs.
 *
 * ADR-016. Every other preset in this codebase ranks by dependency, which is
 * exactly the shape Event Storming exists to avoid drawing. Here edges are
 * annotation rather than structure: a layout that derives order from them fights
 * the user every time they drag a sticky earlier on the timeline.
 *
 * So order comes from where a sticky already is. Dragging it left makes it
 * earlier, which is how the workshop works. The `edges` parameter exists only to
 * match the shape of the other layouts — it is deliberately unused.
 *
 * Pure: returns new nodes, mutates nothing.
 */

import type { Edge, Node } from "@xyflow/react";
import type { NodeData } from "./node-operations";

/**
 * Lanes, top to bottom, as a wall reads. Hotspots sit above the line because they
 * interrupt the story; everything else hangs below it.
 */
export const TIMELINE_LANES = [
  "hotspot",
  "domainEvent",
  "person",
  "externalSystem",
  "opportunity",
] as const;

/** Anything the layout has no opinion about lands here rather than disappearing. */
const UNKNOWN_LANE = TIMELINE_LANES.length;

const COLUMN_WIDTH = 260;
const LANE_HEIGHT = 190;
/** The visual break a pivotal event opens in the timeline. */
const PHASE_GAP = COLUMN_WIDTH;
const ORIGIN = { x: 80, y: 120 };

const laneOf = (node: Node): number => {
  const index = (TIMELINE_LANES as ReadonlyArray<string>).indexOf(node.type ?? "");
  return index === -1 ? UNKNOWN_LANE : index;
};

/** Only an event divides the timeline; a pivotal hotspot would mean nothing. */
const isPhaseBoundary = (node: Node): boolean =>
  node.type === "domainEvent" && (node.data as NodeData | undefined)?.isPivotal === true;

export const timelineLayout = (nodes: Node[], _edges: Edge[] = []): Node[] => {
  if (nodes.length === 0) return [];

  // Each lane keeps its own sequence, so a hotspot's position never shifts an
  // event's and vice versa.
  const columnByNodeId = new Map<string, number>();

  for (let lane = 0; lane <= UNKNOWN_LANE; lane += 1) {
    const inLane = nodes
      .filter((node) => laneOf(node) === lane)
      .sort((left, right) => left.position.x - right.position.x);

    let column = 0;
    for (const node of inLane) {
      columnByNodeId.set(node.id, column);
      // A pivotal event takes an extra column after it, which reads as the phase
      // break rather than needing a separate divider element.
      column += isPhaseBoundary(node) ? 2 : 1;
    }
  }

  return nodes.map((node) => ({
    ...node,
    position: {
      x: ORIGIN.x + (columnByNodeId.get(node.id) ?? 0) * COLUMN_WIDTH,
      y: ORIGIN.y + laneOf(node) * LANE_HEIGHT,
    },
  }));
};

export const TIMELINE_LAYOUT_SPACING = {
  columnWidth: COLUMN_WIDTH,
  laneHeight: LANE_HEIGHT,
  phaseGap: PHASE_GAP,
} as const;
