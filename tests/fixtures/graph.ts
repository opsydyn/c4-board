import type { Edge, Node } from "@xyflow/react";
import type { NodeData } from "../../src/core/effects/node-operations";
import { DEFAULT_ICON_BY_TYPE } from "../../src/core/effects/node-operations";

/**
 * Minimal node fixture set used across suites. Mirrors the default types created
 * in the application so behaviour (volatility, coupling, etc.) stays realistic.
 */
export const sampleNodes: Node<NodeData>[] = [
  {
    id: "person-1",
    type: "person",
    position: { x: 100, y: 200 },
    data: {
      label: "Ops Engineer",
      description: "Coordinates platform rollouts",
      technology: "Human",
      c4Type: "person",
      createdAt: Date.now() - 60_000,
      iconId: DEFAULT_ICON_BY_TYPE.person!,
    },
  },
  {
    id: "system-1",
    type: "system",
    position: { x: 420, y: 180 },
    data: {
      label: "Core Platform",
      description: "Authoritative source of deployment truth",
      technology: "Rust",
      c4Type: "system",
      createdAt: Date.now() - 30_000,
      iconId: DEFAULT_ICON_BY_TYPE.system!,
    },
  },
  {
    id: "container-1",
    type: "container",
    position: { x: 700, y: 340 },
    data: {
      label: "Telemetry",
      description: "Collects usage metrics",
      technology: "TypeScript",
      c4Type: "container",
      createdAt: Date.now() - 10_000,
      iconId: DEFAULT_ICON_BY_TYPE.container!,
    },
  },
];

export const sampleEdges: Edge[] = [
  {
    id: "person-system",
    source: "person-1",
    target: "system-1",
    label: "Coordinates releases",
    data: { createdAt: Date.now() - 15_000 },
  },
  {
    id: "system-container",
    source: "system-1",
    target: "container-1",
    label: "Streams events",
    data: { createdAt: Date.now() - 5_000 },
  },
];

/**
 * Helper for generating a new node/edge set in suites that need isolation.
 */
export function createGraphFixture(): { nodes: Node<NodeData>[]; edges: Edge[] } {
  return {
    nodes: sampleNodes.map((node) => ({ ...node, data: { ...node.data } })),
    edges: sampleEdges.map((edge) => ({ ...edge, data: { ...edge.data } })),
  };
}
