import { inferClientServerRoles } from "@/core/effects/architecture-role-classification";
import {
  type ClientServerRoleEvalCase,
  getClientServerRoleEvalCases,
  validateClientServerRoleEvalCases,
} from "@/core/effects/client-server-role-evals";
import {
  runClientServerRoleEvaluation,
  runClientServerRoleEvaluationFromClassifications,
} from "@/core/effects/client-server-role-evaluation";
import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";

const reverseAssignments: typeof inferClientServerRoles = (nodes, edges) => {
  const result = inferClientServerRoles(nodes, edges);
  return { ...result, assignments: [...result.assignments].reverse() };
};

const reverseExpectedRoles = <T extends Record<string, unknown>>(expectedRoles: T): T =>
  Object.fromEntries(Object.entries(expectedRoles).reverse()) as T;

describe("Client-Server role evaluation", () => {
  it("freezes current classifier quality and the lowest safe evidence threshold", () => {
    const result = runClientServerRoleEvaluation();
    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    expect(result.evaluation).toMatchObject({
      pattern: "client-server",
      totalAssignmentCount: 35,
      eligibleAssignmentCount: 33,
      controlAssignmentCount: 2,
      correctAssignmentCount: 31,
      incorrectAssignmentCount: 2,
      fallbackAssignmentCount: 5,
      correctionFrequency: 2 / 33,
      fallbackRate: 5 / 33,
      candidates: [
        {
          threshold: 0.65,
          exposedCount: 28,
          correctExposedCount: 27,
          incorrectExposedCount: 1,
          precision: 27 / 28,
          coverage: 28 / 33,
          qualifies: false,
        },
        {
          threshold: 0.7,
          exposedCount: 25,
          correctExposedCount: 25,
          incorrectExposedCount: 0,
          precision: 1,
          coverage: 25 / 33,
          qualifies: true,
        },
        {
          threshold: 0.8,
          exposedCount: 23,
          correctExposedCount: 23,
          incorrectExposedCount: 0,
          precision: 1,
          coverage: 23 / 33,
          qualifies: true,
        },
        {
          threshold: 0.85,
          exposedCount: 19,
          correctExposedCount: 19,
          incorrectExposedCount: 0,
          precision: 1,
          coverage: 19 / 33,
          qualifies: true,
        },
        {
          threshold: 0.9,
          exposedCount: 11,
          correctExposedCount: 11,
          incorrectExposedCount: 0,
          precision: 1,
          coverage: 11 / 33,
          qualifies: true,
        },
      ],
      recommendation: {
        status: "selected",
        threshold: 0.7,
        roles: ["client", "domain", "external-dependency", "persistence", "service"],
      },
    });
    expect(result.evaluation.breakdowns["expected-role"]).toEqual([
      { key: "client", total: 6, correct: 6, incorrect: 0, fallback: 0 },
      { key: "domain", total: 6, correct: 5, incorrect: 1, fallback: 0 },
      { key: "external-dependency", total: 5, correct: 4, incorrect: 1, fallback: 1 },
      { key: "persistence", total: 6, correct: 6, incorrect: 0, fallback: 0 },
      { key: "service", total: 6, correct: 6, incorrect: 0, fallback: 0 },
      { key: "unclassified", total: 4, correct: 4, incorrect: 0, fallback: 4 },
    ]);
    expect(result.evaluation.breakdowns["predicted-role"]).toEqual([
      { key: "client", total: 6, correct: 6, incorrect: 0, fallback: 0 },
      { key: "domain", total: 5, correct: 5, incorrect: 0, fallback: 0 },
      { key: "external-dependency", total: 4, correct: 4, incorrect: 0, fallback: 0 },
      { key: "persistence", total: 6, correct: 6, incorrect: 0, fallback: 0 },
      { key: "service", total: 7, correct: 6, incorrect: 1, fallback: 0 },
      { key: "unclassified", total: 5, correct: 4, incorrect: 1, fallback: 5 },
    ]);
    expect(result.evaluation.breakdowns.source).toEqual([
      { key: "fallback", total: 5, correct: 4, incorrect: 1, fallback: 5 },
      { key: "label", total: 4, correct: 4, incorrect: 0, fallback: 0 },
      { key: "node-type", total: 19, correct: 19, incorrect: 0, fallback: 0 },
      { key: "topology", total: 5, correct: 4, incorrect: 1, fallback: 0 },
    ]);
    expect(result.evaluation.breakdowns["confidence-band"]).toEqual([
      { key: "0.00-0.49", total: 5, correct: 4, incorrect: 1, fallback: 5 },
      { key: "0.65-0.79", total: 5, correct: 4, incorrect: 1, fallback: 0 },
      { key: "0.80-0.89", total: 12, correct: 12, incorrect: 0, fallback: 0 },
      { key: "0.90-1.00", total: 11, correct: 11, incorrect: 0, fallback: 0 },
    ]);
    expect(result.evaluation.breakdowns.category).toEqual([
      { key: "ambiguous-generic", total: 3, correct: 3, incorrect: 0, fallback: 3 },
      { key: "canonical-typed-path", total: 6, correct: 6, incorrect: 0, fallback: 1 },
      { key: "external-directionality", total: 4, correct: 4, incorrect: 0, fallback: 0 },
      { key: "grounded-topology", total: 9, correct: 8, incorrect: 1, fallback: 0 },
      { key: "label-only", total: 5, correct: 4, incorrect: 1, fallback: 1 },
      { key: "misleading-label", total: 3, correct: 3, incorrect: 0, fallback: 0 },
      { key: "missing-tier", total: 3, correct: 3, incorrect: 0, fallback: 0 },
    ]);
    expect(result.evaluation.candidates[1]?.roleSupport).toEqual([
      {
        role: "client",
        exposedCount: 6,
        correctExposedCount: 6,
        incorrectExposedCount: 0,
        precision: 1,
        recommended: true,
      },
      {
        role: "domain",
        exposedCount: 5,
        correctExposedCount: 5,
        incorrectExposedCount: 0,
        precision: 1,
        recommended: true,
      },
      {
        role: "external-dependency",
        exposedCount: 4,
        correctExposedCount: 4,
        incorrectExposedCount: 0,
        precision: 1,
        recommended: true,
      },
      {
        role: "persistence",
        exposedCount: 5,
        correctExposedCount: 5,
        incorrectExposedCount: 0,
        precision: 1,
        recommended: true,
      },
      {
        role: "service",
        exposedCount: 5,
        correctExposedCount: 5,
        incorrectExposedCount: 0,
        precision: 1,
        recommended: true,
      },
    ]);
  });

  it.each([
    ["cases", (cases: ReturnType<typeof getClientServerRoleEvalCases>) => [...cases].reverse()],
    [
      "nodes",
      (cases: ReturnType<typeof getClientServerRoleEvalCases>) =>
        cases.map((entry) => ({ ...entry, nodes: [...entry.nodes].reverse() })),
    ],
    [
      "edges",
      (cases: ReturnType<typeof getClientServerRoleEvalCases>) =>
        cases.map((entry) => ({ ...entry, edges: [...entry.edges].reverse() })),
    ],
    [
      "expected-role entries",
      (cases: ReturnType<typeof getClientServerRoleEvalCases>) =>
        cases.map((entry) => ({ ...entry, expectedRoles: reverseExpectedRoles(entry.expectedRoles) })),
    ],
  ])("preserves measurements when %s are reordered", (_name, reorder) => {
    const baseline = runClientServerRoleEvaluation();
    const reordered = runClientServerRoleEvaluation(reorder(getClientServerRoleEvalCases()));

    expect(reordered).toEqual(baseline);
  });

  it("preserves measurements when classifier assignment order changes", () => {
    const baseline = runClientServerRoleEvaluation();
    const reordered = runClientServerRoleEvaluationFromClassifications(
      getClientServerRoleEvalCases(),
      reverseAssignments,
    );

    expect(reordered).toEqual(baseline);
  });

  it("evaluates only top-level gold nodes while classifying child-node topology", () => {
    const canonical = getClientServerRoleEvalCases()[0]!;
    const child: Node = {
      id: "typed-service-child",
      parentId: "typed-service",
      type: "component",
      position: { x: 0, y: 0 },
      data: { label: "Internal Worker" },
    };
    const childEdge: Edge = {
      id: "typed-service-child-edge",
      source: "typed-service",
      target: child.id,
      label: "delegates",
    };
    const cases: ReadonlyArray<ClientServerRoleEvalCase> = [{
      ...canonical,
      nodes: [...canonical.nodes, child],
      edges: [...canonical.edges, childEdge],
    }];
    let classifiedNodes: ReadonlyArray<Node> | undefined;
    let classifiedEdges: ReadonlyArray<Edge> | undefined;
    const classify: typeof inferClientServerRoles = (nodes, edges) => {
      classifiedNodes = nodes;
      classifiedEdges = edges;
      return inferClientServerRoles(nodes, edges);
    };

    const result = runClientServerRoleEvaluationFromClassifications(cases, classify);

    expect(result.status).toBe("success");
    expect(classifiedNodes).toContainEqual(child);
    expect(classifiedEdges).toContainEqual(childEdge);
    if (result.status !== "success") return;
    expect(result.evaluation).toMatchObject({
      totalAssignmentCount: 6,
      eligibleAssignmentCount: 6,
      controlAssignmentCount: 0,
    });
  });

  it("forwards corpus validation failures without invoking the classifier", () => {
    const cases = getClientServerRoleEvalCases();
    cases[1] = { ...cases[1]!, id: cases[0]!.id };
    const expected = validateClientServerRoleEvalCases(cases);
    let classifierCalls = 0;
    const classify: typeof inferClientServerRoles = (nodes, edges) => {
      classifierCalls += 1;
      return inferClientServerRoles(nodes, edges);
    };

    expect(runClientServerRoleEvaluationFromClassifications(cases, classify)).toEqual(expected);
    expect(classifierCalls).toBe(0);
  });

  it("does not retain caller mutations in the default corpus", () => {
    const baseline = runClientServerRoleEvaluation();
    const cases = getClientServerRoleEvalCases();
    runClientServerRoleEvaluation(cases);
    cases[0]!.nodes[0]!.position.x = 999;
    cases[0]!.edges[0]!.label = "mutated request";

    expect(runClientServerRoleEvaluation()).toEqual(baseline);
  });
});
