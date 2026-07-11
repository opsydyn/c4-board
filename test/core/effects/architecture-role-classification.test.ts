import {
  ArchitectureRoleAssignmentSchema,
  ArchitectureRoleClassificationSchema,
  inferEventDrivenRoles,
  inferHexagonalRoles,
} from "@/core/effects/architecture-role-classification";
import type { Edge, Node } from "@xyflow/react";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { cloneLayoutFixture, layoutGraphFixtures } from "../../../tests/fixtures/layoutGraphs";

const hexagonalFixture = () => cloneLayoutFixture(layoutGraphFixtures.find(({ name }) => name === "hexagonal")!);

const eventDrivenFixture = (): { nodes: Node[]; edges: Edge[] } => ({
  nodes: [
    { id: "orders-publisher", type: "container", position: { x: 0, y: 0 }, data: { label: "Orders Publisher" } },
    { id: "orders-bus", type: "system", position: { x: 0, y: 0 }, data: { label: "Orders Event Bus" } },
    { id: "fraud-handler", type: "component", position: { x: 0, y: 0 }, data: { label: "Fraud Handler" } },
    { id: "audit-consumer", type: "component", position: { x: 0, y: 0 }, data: { label: "Audit Consumer" } },
    {
      id: "notification-listener",
      type: "component",
      position: { x: 0, y: 0 },
      data: { label: "Notification Listener" },
    },
    { id: "telemetry", type: "component", position: { x: 0, y: 0 }, data: { label: "Telemetry" } },
    { id: "payment-provider", type: "externalSystem", position: { x: 0, y: 0 }, data: { label: "Payment Provider" } },
  ],
  edges: [
    { id: "publish", source: "orders-publisher", target: "orders-bus", label: "order event" },
    { id: "process", source: "orders-bus", target: "fraud-handler", label: "order event" },
    { id: "continue", source: "fraud-handler", target: "audit-consumer", label: "audit command" },
    { id: "notify", source: "orders-bus", target: "notification-listener", label: "order event" },
  ],
});

describe("architecture role classification", () => {
  it("rejects roles that belong to a different architecture pattern", () => {
    expect(() =>
      Schema.decodeUnknownSync(ArchitectureRoleAssignmentSchema)({
        nodeId: "publisher",
        pattern: "hexagonal",
        role: "publisher",
        confidence: 1,
        source: "explicit",
        evidence: ["User supplied."],
      })
    ).toThrow();
  });

  it("classifies the representative Hexagonal fixture with grounded evidence", () => {
    const fixture = hexagonalFixture();
    const result = inferHexagonalRoles(fixture.nodes, fixture.edges);
    const roles = Object.fromEntries(result.assignments.map(({ nodeId, role }) => [nodeId, role]));

    expect(roles).toEqual({
      "database-adapter": "outbound-adapter",
      "domain-core": "core",
      "email-adapter": "outbound-adapter",
      "event-adapter": "inbound-adapter",
      "repository-port": "outbound-port",
      "rest-adapter": "inbound-adapter",
    });
    expect(result.assignments.every(({ confidence, evidence }) => confidence >= 0.7 && evidence.length > 0)).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(() => Schema.decodeUnknownSync(ArchitectureRoleClassificationSchema)(result)).not.toThrow();
  });

  it("classifies representative Event-Driven roles with grounded evidence", () => {
    const fixture = eventDrivenFixture();
    const result = inferEventDrivenRoles(fixture.nodes, fixture.edges);

    expect(Object.fromEntries(result.assignments.map(({ nodeId, role }) => [nodeId, role]))).toEqual({
      "audit-consumer": "subscriber",
      "fraud-handler": "processor",
      "notification-listener": "subscriber",
      "orders-bus": "event-bus",
      "orders-publisher": "publisher",
      "payment-provider": "external-dependency",
      telemetry: "infrastructure",
    });
    expect(result.assignments.every(({ confidence, evidence }) => confidence >= 0.65 && evidence.length > 0)).toBe(
      true,
    );
    expect(result.diagnostics).toEqual([]);
    expect(() => Schema.decodeUnknownSync(ArchitectureRoleClassificationSchema)(result)).not.toThrow();
  });

  it("keeps valid explicit Event-Driven roles authoritative", () => {
    const fixture = eventDrivenFixture();
    const node = fixture.nodes.find(({ id }) => id === "notification-listener")!;
    node.data = { ...node.data, layoutRole: "processor" };

    const assignment = inferEventDrivenRoles(fixture.nodes, fixture.edges).assignments
      .find(({ nodeId }) => nodeId === node.id)!;

    expect(assignment).toMatchObject({ role: "processor", confidence: 1, source: "explicit" });
  });

  it("falls through after contradictory explicit Event-Driven role evidence", () => {
    const fixture = eventDrivenFixture();
    const node = fixture.nodes.find(({ id }) => id === "orders-publisher")!;
    node.data = { ...node.data, layoutRole: "core" };

    const result = inferEventDrivenRoles(fixture.nodes, fixture.edges);
    expect(result.assignments.find(({ nodeId }) => nodeId === node.id)?.role).toBe("publisher");
    expect(result.diagnostics.map(({ code, nodeIds }) => ({ code, nodeIds }))).toContainEqual({
      code: "semantic-role-pattern-mismatch",
      nodeIds: [node.id],
    });
  });

  it("reports weak Event-Driven evidence as ambiguous", () => {
    const result = inferEventDrivenRoles([
      { id: "worker", type: "component", position: { x: 0, y: 0 }, data: { label: "Worker" } },
    ], []);

    expect(result.assignments[0]).toMatchObject({ role: "unclassified", confidence: 0.25, source: "fallback" });
    expect(result.diagnostics.map(({ code }) => code)).toEqual(["semantic-role-ambiguous"]);
  });

  it("keeps Event-Driven inference stable across input order", () => {
    const fixture = eventDrivenFixture();
    const forward = inferEventDrivenRoles(fixture.nodes, fixture.edges);
    const reversed = inferEventDrivenRoles([...fixture.nodes].reverse(), [...fixture.edges].reverse());

    expect(reversed).toEqual(forward);
  });

  it("is stable across input order", () => {
    const fixture = hexagonalFixture();
    const forward = inferHexagonalRoles(fixture.nodes, fixture.edges);
    const reversed = inferHexagonalRoles([...fixture.nodes].reverse(), [...fixture.edges].reverse());

    expect(reversed).toEqual(forward);
  });

  it("reports ambiguous and contradictory role evidence", () => {
    const fixture = hexagonalFixture();
    fixture.nodes.push({
      id: "worker",
      type: "component",
      position: { x: 0, y: 0 },
      data: { label: "Worker", layoutRole: "publisher" },
    });

    const result = inferHexagonalRoles(fixture.nodes, fixture.edges);
    const worker = result.assignments.find(({ nodeId }) => nodeId === "worker")!;

    expect(worker.role).toBe("unclassified");
    expect(worker.confidence).toBeLessThan(0.65);
    expect(result.diagnostics.map(({ code }) => ({ code }))).toEqual([
      { code: "semantic-role-pattern-mismatch" },
      { code: "semantic-role-ambiguous" },
    ]);
  });
});
