import {
  ArchitectureRoleAssignmentSchema,
  ArchitectureRoleClassificationSchema,
  inferHexagonalRoles,
} from "@/core/effects/architecture-role-classification";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { cloneLayoutFixture, layoutGraphFixtures } from "../../../tests/fixtures/layoutGraphs";

const hexagonalFixture = () => cloneLayoutFixture(layoutGraphFixtures.find(({ name }) => name === "hexagonal")!);

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
