import type { Edge, Node } from "@xyflow/react";

export interface NodeConnectivity {
  incoming: number;
  outgoing: number;
  neighbours: Set<string>;
}

export function buildNodeConnectivity(
  nodes: Node[],
  edges: Edge[],
): Map<string, NodeConnectivity> {
  const connectivity = new Map(
    nodes.map((node) => [
      node.id,
      { incoming: 0, outgoing: 0, neighbours: new Set<string>() },
    ]),
  );

  for (const edge of edges) {
    if (edge.source === edge.target) continue;
    const source = connectivity.get(edge.source);
    const target = connectivity.get(edge.target);
    if (!source || !target) continue;
    source.outgoing += 1;
    source.neighbours.add(edge.target);
    target.incoming += 1;
    target.neighbours.add(edge.source);
  }

  return connectivity;
}

export function compareNodesByConnectivity(
  left: Node,
  right: Node,
  connectivity: Map<string, NodeConnectivity>,
): number {
  const leftConnectivity = connectivity.get(left.id);
  const rightConnectivity = connectivity.get(right.id);
  const neighbourDifference = (rightConnectivity?.neighbours.size ?? 0)
    - (leftConnectivity?.neighbours.size ?? 0);
  if (neighbourDifference !== 0) return neighbourDifference;

  const edgeDifference = ((rightConnectivity?.incoming ?? 0) + (rightConnectivity?.outgoing ?? 0))
    - ((leftConnectivity?.incoming ?? 0) + (leftConnectivity?.outgoing ?? 0));
  return edgeDifference !== 0 ? edgeDifference : compareStableIds(left.id, right.id);
}

export function compareStableIds(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}
