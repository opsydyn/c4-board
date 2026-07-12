import type { Edge, Node } from "@xyflow/react";
import type { LayoutPresetName } from "./layout";

export type LayoutVisualFixtureName =
  | "event-driven"
  | "event-driven-bridges"
  | "client-server"
  | "hexagonal-inferred"
  | "hexagonal-corrected";

export interface LayoutVisualFixture {
  name: LayoutVisualFixtureName;
  title: string;
  preset: LayoutPresetName;
  nodes: Node[];
  edges: Edge[];
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
  },
  "client-server": {
    name: "client-server",
    title: "VISUAL::CLIENT SERVER",
    preset: "elkLayered",
    nodes: [
      node("web-client", "person"),
      node("mobile-client", "person"),
      node("api-server", "container"),
      node("command-handler", "command"),
      node("audit-event", "integrationEvent"),
      node("customer-repository", "repository"),
      node("identity-provider", "externalSystem"),
    ],
    edges: [
      edge("web-client", "api-server", "request"),
      edge("mobile-client", "api-server", "request"),
      edge("api-server", "command-handler", "command: update customer"),
      edge("api-server", "audit-event", "audit event"),
      edge("api-server", "customer-repository", "customer data"),
      edge("api-server", "identity-provider", "token request"),
    ],
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
    || value === "client-server"
    || value === "hexagonal-inferred"
    || value === "hexagonal-corrected";
}

export function getLayoutVisualFixture(name: LayoutVisualFixtureName): LayoutVisualFixture {
  const fixture = FIXTURES[name];
  return {
    ...fixture,
    nodes: fixture.nodes.map((fixtureNode) => ({
      ...fixtureNode,
      position: { ...fixtureNode.position },
      data: { ...fixtureNode.data },
      style: { ...fixtureNode.style },
    })),
    edges: fixture.edges.map((fixtureEdge) => ({ ...fixtureEdge })),
  };
}
