import type { Edge, Node } from "@xyflow/react";
import type { LayoutPresetName } from "./layout";

export type LayoutVisualFixtureName =
  | "event-driven"
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
    preset: "elkLayered",
    nodes: [
      node("orders", "container"),
      node("billing", "container"),
      node("event-bus", "system"),
      node("fulfilment", "container"),
      node("analytics", "container"),
    ],
    edges: [
      edge("orders", "event-bus", "command: order accepted"),
      edge("billing", "event-bus", "payment event"),
      edge("event-bus", "fulfilment", "integration event"),
      edge("event-bus", "analytics", "event data"),
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
