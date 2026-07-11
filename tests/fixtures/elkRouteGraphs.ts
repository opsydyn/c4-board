import type { Edge, Node } from "@xyflow/react";
import type { LayoutInput } from "../../src/core/effects/layout.types";

const node = (id: string, type = "component", parentId?: string): Node => ({
  id,
  type,
  ...(parentId && { parentId }),
  position: { x: 0, y: 0 },
  style: { width: type === "system" ? 240 : 160, height: type === "system" ? 140 : 100 },
  data: { label: id },
});

const edge = (source: string, target: string): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
});

export const elkRouteGraphFixtures: Array<LayoutInput & { name: string }> = [
  {
    name: "two-boundaries",
    nodes: [
      node("shop", "system"),
      node("orders", "container", "shop"),
      node("catalog", "container", "shop"),
      node("platform", "system"),
      node("billing", "container", "platform"),
      node("identity", "container", "platform"),
      node("customer", "person"),
      node("bank", "externalSystem"),
    ],
    edges: [
      edge("customer", "orders"),
      edge("customer", "catalog"),
      edge("orders", "billing"),
      edge("orders", "identity"),
      edge("catalog", "identity"),
      edge("billing", "bank"),
      edge("identity", "bank"),
    ],
    options: { direction: "LR" },
  },
  {
    name: "dense-three-boundaries",
    nodes: [
      node("sales", "system"),
      node("orders", "container", "sales"),
      node("catalog", "container", "sales"),
      node("ops", "system"),
      node("fulfilment", "container", "ops"),
      node("inventory", "container", "ops"),
      node("data", "system"),
      node("warehouse", "container", "data"),
      node("analytics", "container", "data"),
      node("customer", "person"),
      node("partner", "externalSystem"),
    ],
    edges: [
      edge("customer", "orders"),
      edge("customer", "catalog"),
      edge("orders", "fulfilment"),
      edge("orders", "inventory"),
      edge("catalog", "inventory"),
      edge("catalog", "analytics"),
      edge("fulfilment", "warehouse"),
      edge("inventory", "warehouse"),
      edge("inventory", "analytics"),
      edge("warehouse", "partner"),
      edge("analytics", "partner"),
    ],
    options: { direction: "LR" },
  },
  {
    name: "crossing-pressure-mesh",
    nodes: Array.from({ length: 10 }, (_, index) => node(`node-${index}`)),
    edges: [
      edge("node-0", "node-4"),
      edge("node-0", "node-5"),
      edge("node-1", "node-5"),
      edge("node-1", "node-6"),
      edge("node-2", "node-6"),
      edge("node-2", "node-7"),
      edge("node-3", "node-4"),
      edge("node-3", "node-7"),
      edge("node-4", "node-8"),
      edge("node-5", "node-9"),
      edge("node-6", "node-8"),
      edge("node-7", "node-9"),
    ],
    options: { direction: "LR" },
  },
];
