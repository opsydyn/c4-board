import type { Edge, Node } from "@xyflow/react";
import type { LayoutPresetName } from "./layout";

export type LayoutVisualFixtureName =
  | "event-driven"
  | "event-driven-bridges"
  | "event-driven-bridges-detail"
  | "client-server-inferred"
  | "client-server-corrected"
  | "hexagonal-inferred"
  | "hexagonal-corrected";

export interface LayoutVisualFixture {
  name: LayoutVisualFixtureName;
  title: string;
  preset: LayoutPresetName;
  nodes: Node[];
  edges: Edge[];
  viewportFitNodeIds?: string[];
}

const node = (id: string, type: string, data: Record<string, unknown> = {}): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  style: { width: 160, height: 100 },
  data: { label: id, ...data },
});

const edge = (source: string, target: string, label: string): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
  label,
});

const EVENT_DRIVEN_BRIDGES_GRAPH: Pick<LayoutVisualFixture, "nodes" | "edges"> = {
  nodes: [
    node("orders-publisher", "container", { layoutRole: "publisher" }),
    node("a-bus", "system", { layoutRole: "event-bus" }),
    node("b-bus", "system", { layoutRole: "event-bus" }),
    node("c-bus", "system", { layoutRole: "event-bus" }),
    node("a-local", "component", { layoutRole: "processor" }),
    node("a-to-b", "component", { layoutRole: "processor" }),
    node("a-to-c", "component", { layoutRole: "processor" }),
    node("b-to-c", "component", { layoutRole: "processor" }),
    node("a-subscriber", "component", { layoutRole: "subscriber" }),
    node("b-subscriber", "component", { layoutRole: "subscriber" }),
    node("c-subscriber", "component", { layoutRole: "subscriber" }),
    node("telemetry", "component", { layoutRole: "infrastructure" }),
    node("external-monitor", "externalSystem", { layoutRole: "external-dependency" }),
    node("review-node", "component", { layoutRole: "unclassified" }),
  ],
  edges: [
    edge("orders-publisher", "a-bus", "order accepted"),
    edge("a-bus", "a-local", "local event"),
    edge("a-local", "a-subscriber", "local result"),
    edge("a-bus", "a-to-b", "bridge event"),
    edge("a-to-b", "b-bus", "forwarded event"),
    edge("a-bus", "a-to-c", "bridge event"),
    edge("a-to-c", "c-bus", "forwarded event"),
    edge("b-bus", "b-to-c", "bridge event"),
    edge("b-to-c", "c-bus", "forwarded event"),
    edge("a-bus", "a-subscriber", "subscriber event"),
    edge("b-bus", "b-subscriber", "subscriber event"),
    edge("c-bus", "c-subscriber", "subscriber event"),
    edge("a-bus", "telemetry", "metrics event"),
    edge("c-bus", "external-monitor", "monitoring event"),
    edge("b-bus", "review-node", "review event"),
  ],
};

const CLIENT_SERVER_GRAPH: Pick<LayoutVisualFixture, "nodes" | "edges"> = {
  nodes: [
    node("web-client", "person"),
    node("mobile-client", "person"),
    node("api-server", "container", { label: "Customer API Server" }),
    node("customer-domain", "aggregate", { label: "Customer Aggregate" }),
    node("customer-repository", "repository", { label: "Customer Repository" }),
    node("identity-provider", "externalSystem", { label: "Identity Provider" }),
    node("decision-module", "component", { label: "Decision Module" }),
  ],
  edges: [
    edge("web-client", "api-server", "request"),
    edge("mobile-client", "api-server", "request"),
    edge("api-server", "customer-domain", "calls"),
    edge("customer-domain", "customer-repository", "customer data"),
    edge("api-server", "identity-provider", "token request"),
    edge("api-server", "decision-module", "evaluate"),
    edge("decision-module", "customer-domain", "decision"),
  ],
};

const FIXTURES: Record<LayoutVisualFixtureName, LayoutVisualFixture> = {
  "event-driven": {
    name: "event-driven",
    title: "VISUAL::EVENT DRIVEN",
    preset: "eventDriven",
    nodes: [
      node("orders-publisher", "container", { layoutRole: "publisher" }),
      node("billing-publisher", "container", { layoutRole: "publisher" }),
      node("event-bus", "system", { layoutRole: "event-bus" }),
      node("fulfilment-processor", "component", { layoutRole: "processor" }),
      node("analytics-subscriber", "container", { layoutRole: "subscriber" }),
      node("notifications-subscriber", "container", { layoutRole: "subscriber" }),
      node("telemetry", "component", { layoutRole: "infrastructure" }),
    ],
    edges: [
      edge("orders-publisher", "event-bus", "order accepted"),
      edge("billing-publisher", "event-bus", "payment received"),
      edge("event-bus", "fulfilment-processor", "fulfilment event"),
      edge("event-bus", "analytics-subscriber", "event data"),
      edge("event-bus", "notifications-subscriber", "notification requested"),
      edge("fulfilment-processor", "notifications-subscriber", "notification event"),
      edge("event-bus", "telemetry", "metrics event"),
    ],
  },
  "event-driven-bridges": {
    name: "event-driven-bridges",
    title: "VISUAL::EVENT DRIVEN BRIDGES",
    preset: "eventDriven",
    ...EVENT_DRIVEN_BRIDGES_GRAPH,
  },
  "event-driven-bridges-detail": {
    name: "event-driven-bridges-detail",
    title: "VISUAL::EVENT DRIVEN BRIDGES DETAIL",
    preset: "eventDriven",
    ...EVENT_DRIVEN_BRIDGES_GRAPH,
    viewportFitNodeIds: [
      "orders-publisher",
      "a-bus",
      "b-bus",
      "c-bus",
      "a-local",
      "a-to-b",
      "a-to-c",
      "b-to-c",
      "a-subscriber",
      "b-subscriber",
      "c-subscriber",
    ],
  },
  "client-server-inferred": {
    name: "client-server-inferred",
    title: "VISUAL::CLIENT SERVER INFERRED",
    preset: "clientServer",
    ...CLIENT_SERVER_GRAPH,
  },
  "client-server-corrected": {
    name: "client-server-corrected",
    title: "VISUAL::CLIENT SERVER CORRECTED",
    preset: "clientServer",
    nodes: CLIENT_SERVER_GRAPH.nodes.map((fixtureNode) => ({
      ...fixtureNode,
      data: {
        ...fixtureNode.data,
        ...(fixtureNode.id === "decision-module" && { layoutRole: "domain" }),
      },
    })),
    edges: CLIENT_SERVER_GRAPH.edges.map((fixtureEdge) => ({ ...fixtureEdge })),
  },
  "hexagonal-inferred": {
    name: "hexagonal-inferred",
    title: "VISUAL::HEXAGONAL INFERRED",
    preset: "hexagonal",
    nodes: [
      node("rest-adapter", "component"),
      node("event-adapter", "component"),
      node("domain-core", "component"),
      node("repository-port", "component"),
      node("database-adapter", "container"),
      node("email-adapter", "externalSystem"),
    ],
    edges: [
      edge("rest-adapter", "domain-core", "request"),
      edge("event-adapter", "domain-core", "event"),
      edge("domain-core", "repository-port", "data"),
      edge("repository-port", "database-adapter", "database"),
      edge("domain-core", "email-adapter", "notification"),
    ],
  },
  "hexagonal-corrected": {
    name: "hexagonal-corrected",
    title: "VISUAL::HEXAGONAL CORRECTED",
    preset: "hexagonal",
    nodes: [
      node("rest-adapter", "component"),
      node("event-adapter", "component", { layoutRole: "outbound-adapter" }),
      node("domain-core", "component"),
      node("repository-port", "component"),
      node("database-adapter", "container"),
      node("email-adapter", "externalSystem"),
      node("telemetry", "component", { layoutRole: "infrastructure" }),
    ],
    edges: [
      edge("rest-adapter", "domain-core", "request"),
      edge("domain-core", "event-adapter", "published event"),
      edge("domain-core", "repository-port", "data"),
      edge("repository-port", "database-adapter", "database"),
      edge("domain-core", "email-adapter", "notification"),
      edge("domain-core", "telemetry", "metrics"),
    ],
  },
};

export function isLayoutVisualFixtureName(value: unknown): value is LayoutVisualFixtureName {
  return value === "event-driven"
    || value === "event-driven-bridges"
    || value === "event-driven-bridges-detail"
    || value === "client-server-inferred"
    || value === "client-server-corrected"
    || value === "hexagonal-inferred"
    || value === "hexagonal-corrected";
}

export function getLayoutVisualFixture(name: LayoutVisualFixtureName): LayoutVisualFixture {
  const fixture = FIXTURES[name];
  return {
    ...fixture,
    ...(fixture.viewportFitNodeIds && { viewportFitNodeIds: [...fixture.viewportFitNodeIds] }),
    nodes: fixture.nodes.map((fixtureNode) => ({
      ...fixtureNode,
      position: { ...fixtureNode.position },
      data: { ...fixtureNode.data },
      style: { ...fixtureNode.style },
    })),
    edges: fixture.edges.map((fixtureEdge) => ({ ...fixtureEdge })),
  };
}
