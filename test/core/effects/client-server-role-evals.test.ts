import type { ArchitectureSemanticRole } from "@/core/effects/architecture-role-classification";
import {
  getClientServerRoleEvalCases,
  validateClientServerRoleEvalCases,
} from "@/core/effects/client-server-role-evals";
import { describe, expect, it } from "vitest";

const expectedRoleTotals = {
  client: 6,
  domain: 6,
  "external-dependency": 5,
  persistence: 6,
  service: 6,
  unclassified: 4,
} satisfies Partial<Record<ArchitectureSemanticRole, number>>;

describe("Client-Server role evaluation corpus", () => {
  it("ships the exact gold-corpus categories, totals, and eligible role support", () => {
    const cases = getClientServerRoleEvalCases();
    const eligibleCases = cases.filter(({ thresholdEligible }) => thresholdEligible);
    const eligibleAssignments = eligibleCases.flatMap(({ expectedRoles }) => Object.values(expectedRoles));
    const actualRoleTotals = Object.fromEntries(
      Object.keys(expectedRoleTotals).map((role) => [
        role,
        eligibleAssignments.filter((expectedRole) => expectedRole === role).length,
      ]),
    );

    expect(cases.map(({ category }) => category)).toEqual([
      "canonical-typed-path",
      "label-only",
      "grounded-topology",
      "ambiguous-generic",
      "misleading-label",
      "missing-tier",
      "external-directionality",
      "explicit-role-control",
    ]);
    expect(cases.flatMap(({ nodes }) => nodes)).toHaveLength(35);
    expect(eligibleAssignments).toHaveLength(33);
    expect(actualRoleTotals).toEqual(expectedRoleTotals);
    expect(Object.values(actualRoleTotals).filter((total) => total > 0).every((total) => total >= 3)).toBe(true);
    expect(eligibleCases.flatMap(({ nodes }) => nodes).every((node) => node.data.layoutRole === undefined)).toBe(true);
    expect(validateClientServerRoleEvalCases(cases)).toEqual({ status: "valid" });
  });

  it("returns isolated deep clones for every corpus access", () => {
    const baseline = getClientServerRoleEvalCases();
    const mutated = getClientServerRoleEvalCases();
    const canonical = mutated.find(({ id }) => id === "canonical-typed")!;

    canonical.nodes[0]!.data.label = "Mutated Customer";
    canonical.nodes[0]!.style!.width = 999;
    canonical.nodes[0]!.position.x = 999;
    canonical.edges[0]!.label = "mutated request";

    expect(getClientServerRoleEvalCases()).toEqual(baseline);
  });

  const invalidCases = [
    ["duplicate-case-id", "duplicate-case-id"],
    ["duplicate-node-id", "duplicate-node-id"],
    ["missing-top-level-expected-role", "missing-expected-role"],
    ["unknown-expected-node", "unknown-expected-node"],
    ["child-only-expected-node", "child-only-expected-node"],
    ["disallowed-role", "disallowed-role"],
    ["eligible-explicit-role", "threshold-eligible-explicit-role"],
    ["unknown-edge-source", "unknown-edge-endpoint"],
    ["unknown-edge-target", "unknown-edge-endpoint"],
    ["no-eligible-assignments", "no-threshold-eligible-assignments"],
  ] as const;

  it.each(invalidCases)("returns a typed validation failure for %s", (mutation, problem) => {
    const cases = getClientServerRoleEvalCases();
    const canonicalIndex = cases.findIndex(({ id }) => id === "canonical-typed");
    const canonical = cases[canonicalIndex]!;
    let expectedCaseId: string | null = "canonical-typed";

    switch (mutation) {
      case "duplicate-case-id": {
        cases[1] = { ...cases[1]!, id: canonical.id };
        break;
      }
      case "duplicate-node-id": {
        const nodes = [...canonical.nodes, structuredClone(canonical.nodes[0]!)];
        cases[canonicalIndex] = { ...canonical, nodes };
        break;
      }
      case "missing-top-level-expected-role": {
        const { "typed-client": _missing, ...expectedRoles } = canonical.expectedRoles;
        cases[canonicalIndex] = { ...canonical, expectedRoles };
        break;
      }
      case "unknown-expected-node": {
        cases[canonicalIndex] = {
          ...canonical,
          expectedRoles: { ...canonical.expectedRoles, "unknown-node": "client" },
        };
        break;
      }
      case "child-only-expected-node": {
        const nodes = canonical.nodes.map((node) =>
          node.id === "typed-client" ? { ...node, parentId: "typed-service" } : node
        );
        cases[canonicalIndex] = { ...canonical, nodes };
        break;
      }
      case "disallowed-role": {
        cases[canonicalIndex] = {
          ...canonical,
          expectedRoles: { ...canonical.expectedRoles, "typed-client": "publisher" },
        };
        break;
      }
      case "eligible-explicit-role": {
        const nodes = canonical.nodes.map((node) =>
          node.id === "typed-client" ? { ...node, data: { ...node.data, layoutRole: "client" } } : node
        );
        cases[canonicalIndex] = { ...canonical, nodes };
        break;
      }
      case "unknown-edge-source": {
        const edges = [...canonical.edges];
        edges[0] = { ...edges[0]!, source: "unknown-source" };
        cases[canonicalIndex] = { ...canonical, edges };
        break;
      }
      case "unknown-edge-target": {
        const edges = [...canonical.edges];
        edges[0] = { ...edges[0]!, target: "unknown-target" };
        cases[canonicalIndex] = { ...canonical, edges };
        break;
      }
      case "no-eligible-assignments": {
        expectedCaseId = null;
        for (const [index, roleEvalCase] of cases.entries()) {
          cases[index] = { ...roleEvalCase, thresholdEligible: false };
        }
        break;
      }
    }

    expect(validateClientServerRoleEvalCases(cases)).toMatchObject({
      status: "validation-failure",
      error: { caseId: expectedCaseId, problem },
    });
  });

  it("rejects an explicit role on an eligible child without an expected-role entry", () => {
    const cases = getClientServerRoleEvalCases();
    const canonicalIndex = cases.findIndex(({ id }) => id === "canonical-typed");
    const canonical = cases[canonicalIndex]!;
    const childNode = {
      ...structuredClone(canonical.nodes[0]!),
      id: "typed-child-explicit",
      parentId: "typed-service",
      data: { ...canonical.nodes[0]!.data, layoutRole: "domain" },
    };
    cases[canonicalIndex] = { ...canonical, nodes: [...canonical.nodes, childNode] };

    expect(validateClientServerRoleEvalCases(cases)).toEqual({
      status: "validation-failure",
      error: {
        _tag: "ClientServerRoleEvalCorpusValidationError",
        caseId: "canonical-typed",
        problem: "threshold-eligible-explicit-role",
        message:
          "Threshold-eligible node 'typed-child-explicit' has an explicit layout role in case 'canonical-typed'.",
      },
    });
  });
});
