import type { Edge, Node } from "@xyflow/react";
import type { NodeData } from "../../src/core/effects/node-operations";

export interface TeamTopologyScenario {
  id: "mono-team" | "multi-team" | "unknown-ownership";
  title: string;
  description: string;
  nodes: Node<NodeData>[];
  edges: Edge[];
}

const makeNode = (
  id: string,
  label: string,
  teamOwnership: string | null,
  position: { x: number; y: number },
): Node<NodeData> => ({
  id,
  type: "system",
  position,
  data: {
    label,
    description: `${label} service`,
    technology: "TypeScript",
    c4Type: "system",
    subdomainType: "core",
    integrationType: "intrusive",
    teamOwnership: teamOwnership ?? "",
    couplingProfile: {
      strength: 6,
      distance: 5,
      volatility: 5,
    },
  },
});

const makeEdge = (id: string, source: string, target: string): Edge => ({
  id,
  source,
  target,
  type: "default",
});

export const teamTopologyScenarios: TeamTopologyScenario[] = [
  {
    id: "mono-team",
    title: "Mono-Team Platform",
    description: "Single ownership domain with no cross-team boundaries.",
    nodes: [
      makeNode("mono-api", "API Gateway", "team-platform", { x: 80, y: 80 }),
      makeNode("mono-core", "Core Service", "team-platform", { x: 320, y: 100 }),
      makeNode("mono-db", "Data Service", "team-platform", { x: 560, y: 120 }),
      makeNode("mono-worker", "Worker", "team-platform", { x: 440, y: 320 }),
    ],
    edges: [
      makeEdge("mono-e1", "mono-api", "mono-core"),
      makeEdge("mono-e2", "mono-core", "mono-db"),
      makeEdge("mono-e3", "mono-core", "mono-worker"),
    ],
  },
  {
    id: "multi-team",
    title: "Cross-Team Product Stack",
    description: "Multiple teams with intentional dependency boundaries.",
    nodes: [
      makeNode("multi-edge", "Edge API", "team-experience", { x: 80, y: 80 }),
      makeNode("multi-catalog", "Catalog Service", "team-commerce", { x: 360, y: 80 }),
      makeNode("multi-payments", "Payments Service", "team-finance", { x: 660, y: 120 }),
      makeNode("multi-ops", "Ops Console", "team-platform", { x: 360, y: 320 }),
    ],
    edges: [
      makeEdge("multi-e1", "multi-edge", "multi-catalog"),
      makeEdge("multi-e2", "multi-catalog", "multi-payments"),
      makeEdge("multi-e3", "multi-payments", "multi-ops"),
      makeEdge("multi-e4", "multi-ops", "multi-edge"),
    ],
  },
  {
    id: "unknown-ownership",
    title: "Unknown Ownership Hotspots",
    description: "Partial ownership metadata to highlight governance gaps.",
    nodes: [
      makeNode("unknown-ingress", "Ingress", "team-platform", { x: 100, y: 80 }),
      makeNode("unknown-service-a", "Service A", null, { x: 340, y: 120 }),
      makeNode("unknown-service-b", "Service B", null, { x: 580, y: 120 }),
      makeNode("unknown-ledger", "Ledger", "team-finance", { x: 820, y: 180 }),
    ],
    edges: [
      makeEdge("unknown-e1", "unknown-ingress", "unknown-service-a"),
      makeEdge("unknown-e2", "unknown-service-a", "unknown-service-b"),
      makeEdge("unknown-e3", "unknown-service-b", "unknown-ledger"),
    ],
  },
];

