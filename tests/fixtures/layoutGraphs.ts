import type { Edge, Node } from "@xyflow/react";
import type { LayoutPresetName } from "../../src/core/effects/layout";

export interface LayoutGraphFixture {
  name: string;
  preset: LayoutPresetName;
  nodes: Node[];
  edges: Edge[];
}

const node = (id: string, type: string): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  style: { width: 160, height: 100 },
  data: { label: id },
});

const edge = (source: string, target: string): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
});

export const layoutGraphFixtures: LayoutGraphFixture[] = [
  {
    name: "hierarchy",
    preset: "command",
    nodes: [
      node("command", "person"),
      node("operations", "system"),
      node("delivery", "system"),
      node("platform", "container"),
    ],
    edges: [
      edge("command", "operations"),
      edge("command", "delivery"),
      edge("operations", "platform"),
      edge("delivery", "platform"),
    ],
  },
  {
    name: "pipeline",
    preset: "pipeline",
    nodes: [
      node("source", "system"),
      node("transform", "container"),
      node("validate", "component"),
      node("sink", "externalSystem"),
    ],
    edges: [
      edge("source", "transform"),
      edge("transform", "validate"),
      edge("validate", "sink"),
    ],
  },
  {
    name: "system-context",
    preset: "systemContext",
    nodes: [
      node("customer", "person"),
      node("operator", "person"),
      node("core-system", "system"),
      node("payments", "externalSystem"),
      node("identity", "externalSystem"),
    ],
    edges: [
      edge("customer", "core-system"),
      edge("operator", "core-system"),
      edge("core-system", "payments"),
      edge("core-system", "identity"),
    ],
  },
  {
    name: "hub-spoke",
    preset: "hubSpoke",
    nodes: [
      node("integration-hub", "system"),
      node("crm", "externalSystem"),
      node("erp", "externalSystem"),
      node("billing", "externalSystem"),
      node("warehouse", "externalSystem"),
    ],
    edges: [
      edge("integration-hub", "crm"),
      edge("integration-hub", "erp"),
      edge("integration-hub", "billing"),
      edge("integration-hub", "warehouse"),
    ],
  },
  {
    name: "hexagonal",
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
      edge("rest-adapter", "domain-core"),
      edge("event-adapter", "domain-core"),
      edge("domain-core", "repository-port"),
      edge("repository-port", "database-adapter"),
      edge("domain-core", "email-adapter"),
    ],
  },
  {
    name: "event-driven",
    preset: "eventDriven",
    nodes: [
      node("orders", "container"),
      node("billing", "container"),
      node("event-bus", "system"),
      node("fulfilment", "container"),
      node("analytics", "container"),
    ],
    edges: [
      { ...edge("orders", "event-bus"), label: "command: order accepted" },
      { ...edge("billing", "event-bus"), label: "payment event" },
      { ...edge("event-bus", "fulfilment"), label: "integration event" },
      { ...edge("event-bus", "analytics"), label: "event data" },
    ],
  },
  {
    name: "client-server",
    preset: "clientServer",
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
      { ...edge("web-client", "api-server"), label: "request" },
      { ...edge("mobile-client", "api-server"), label: "request" },
      { ...edge("api-server", "command-handler"), label: "command: update customer" },
      { ...edge("api-server", "audit-event"), label: "audit event" },
      { ...edge("api-server", "customer-repository"), label: "customer data" },
      { ...edge("api-server", "identity-provider"), label: "token request" },
    ],
  },
];

export function cloneLayoutFixture(fixture: LayoutGraphFixture): LayoutGraphFixture {
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
