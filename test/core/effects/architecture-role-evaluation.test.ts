import type { ArchitectureRoleAssignment } from "@/core/effects/architecture-role-classification";
import {
  type ArchitectureRoleEvaluationInput,
  evaluateArchitectureRoles,
} from "@/core/effects/architecture-role-evaluation";
import { describe, expect, it } from "vitest";

const assignment = (
  nodeId: string,
  role: ArchitectureRoleAssignment["role"],
  confidence: number,
  source: ArchitectureRoleAssignment["source"],
): ArchitectureRoleAssignment => ({
  nodeId,
  pattern: "client-server",
  role,
  confidence,
  source,
  evidence: [`${source}:${role}`],
});

const input = (): ArchitectureRoleEvaluationInput => ({
  pattern: "client-server",
  goldAssignments: [
    { caseId: "case-a", category: "canonical", nodeId: "client-a", expectedRole: "client", thresholdEligible: true },
    { caseId: "case-a", category: "canonical", nodeId: "service-a", expectedRole: "service", thresholdEligible: true },
    {
      caseId: "case-b",
      category: "ambiguous",
      nodeId: "unknown-b",
      expectedRole: "unclassified",
      thresholdEligible: true,
    },
    {
      caseId: "control",
      category: "explicit-control",
      nodeId: "domain-control",
      expectedRole: "domain",
      thresholdEligible: false,
    },
  ],
  classifications: [
    {
      caseId: "case-a",
      classification: {
        pattern: "client-server",
        assignments: [
          assignment("client-a", "client", 0.9, "node-type"),
          assignment("service-a", "domain", 0.85, "label"),
        ],
        diagnostics: [],
      },
    },
    {
      caseId: "case-b",
      classification: {
        pattern: "client-server",
        assignments: [assignment("unknown-b", "unclassified", 0.25, "fallback")],
        diagnostics: [],
      },
    },
    {
      caseId: "control",
      classification: {
        pattern: "client-server",
        assignments: [assignment("domain-control", "domain", 1, "explicit")],
        diagnostics: [],
      },
    },
  ],
  policy: { minimumPrecision: 0.98, minimumCorrectPerRole: 3 },
});

const expectValidation = (
  candidate: ArchitectureRoleEvaluationInput,
  problem: string,
  caseId: string | null = null,
) => {
  expect(evaluateArchitectureRoles(candidate)).toEqual({
    status: "validation-failure",
    error: expect.objectContaining({
      _tag: "ArchitectureRoleEvaluationValidationError",
      caseId,
      problem,
    }),
  });
};

describe("architecture role evaluation", () => {
  it("computes eligible metrics without allowing controls to improve them", () => {
    const result = evaluateArchitectureRoles(input());
    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    expect(result.evaluation).toMatchObject({
      totalAssignmentCount: 4,
      eligibleAssignmentCount: 3,
      controlAssignmentCount: 1,
      correctAssignmentCount: 2,
      incorrectAssignmentCount: 1,
      fallbackAssignmentCount: 1,
      correctionFrequency: 1 / 3,
      fallbackRate: 1 / 3,
    });
    expect(result.evaluation.recommendation).toMatchObject({
      status: "insufficient-evidence",
    });
  });

  it("uses null precision for a role with no exposed assignments", () => {
    const result = evaluateArchitectureRoles(input());
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    const highest = result.evaluation.candidates.at(-1)!;
    expect(highest.threshold).toBe(0.9);
    expect(highest.roleSupport.find(({ role }) => role === "service")).toMatchObject({
      exposedCount: 0,
      precision: null,
      recommended: false,
    });
  });

  it("selects the lowest threshold with zero errors and supported roles", () => {
    const goldAssignments = ["client-1", "client-2", "client-3", "service-1", "service-2", "service-3"]
      .map((nodeId) => ({
        caseId: "threshold",
        category: "threshold",
        nodeId,
        expectedRole: nodeId.startsWith("client") ? "client" as const : "service" as const,
        thresholdEligible: true,
      }));
    const classifications = [{
      caseId: "threshold",
      classification: {
        pattern: "client-server" as const,
        assignments: [
          assignment("client-1", "client", 0.9, "node-type"),
          assignment("client-2", "client", 0.9, "node-type"),
          assignment("client-3", "client", 0.9, "node-type"),
          assignment("service-1", "service", 0.8, "label"),
          assignment("service-2", "service", 0.8, "label"),
          assignment("service-3", "domain", 0.8, "label"),
        ],
        diagnostics: [],
      },
    }];

    const result = evaluateArchitectureRoles({
      pattern: "client-server",
      goldAssignments,
      classifications,
      policy: { minimumPrecision: 0.98, minimumCorrectPerRole: 3 },
    });

    expect(result).toMatchObject({
      status: "success",
      evaluation: {
        candidates: [
          { threshold: 0.8, exposedCount: 6, incorrectExposedCount: 1, qualifies: false },
          { threshold: 0.9, exposedCount: 3, incorrectExposedCount: 0, recommendedRoles: ["client"], qualifies: true },
        ],
        recommendation: { status: "selected", threshold: 0.9, roles: ["client"] },
      },
    });
  });

  it.each(
    [
      ["duplicate-gold-assignment", (candidate: ArchitectureRoleEvaluationInput) => ({
        ...candidate,
        goldAssignments: [...candidate.goldAssignments, candidate.goldAssignments[0]!],
      }), "case-a"],
      ["duplicate-classification-case", (candidate: ArchitectureRoleEvaluationInput) => ({
        ...candidate,
        classifications: [...candidate.classifications, candidate.classifications[0]!],
      }), "case-a"],
      ["unknown-assignment", (candidate: ArchitectureRoleEvaluationInput) => ({
        ...candidate,
        classifications: candidate.classifications.map((entry) =>
          entry.caseId === "case-a"
            ? {
              ...entry,
              classification: {
                ...entry.classification,
                assignments: [...entry.classification.assignments, assignment("unknown", "client", 0.8, "label")],
              },
            }
            : entry
        ),
      }), "case-a"],
      ["duplicate-assignment", (candidate: ArchitectureRoleEvaluationInput) => ({
        ...candidate,
        classifications: candidate.classifications.map((entry) =>
          entry.caseId === "case-a"
            ? {
              ...entry,
              classification: {
                ...entry.classification,
                assignments: [...entry.classification.assignments, entry.classification.assignments[0]!],
              },
            }
            : entry
        ),
      }), "case-a"],
      ["missing-assignment", (candidate: ArchitectureRoleEvaluationInput) => ({
        ...candidate,
        classifications: candidate.classifications.map((entry) =>
          entry.caseId === "case-a"
            ? {
              ...entry,
              classification: {
                ...entry.classification,
                assignments: entry.classification.assignments.slice(0, 1),
              },
            }
            : entry
        ),
      }), "case-a"],
      ["pattern-mismatch", (candidate: ArchitectureRoleEvaluationInput) => ({
        ...candidate,
        classifications: candidate.classifications.map((entry) =>
          entry.caseId === "case-a"
            ? {
              ...entry,
              classification: {
                ...entry.classification,
                pattern: "hexagonal" as const,
                assignments: [{
                  nodeId: "client-a",
                  pattern: "hexagonal" as const,
                  role: "core" as const,
                  confidence: 0.9,
                  source: "node-type" as const,
                  evidence: ["node-type:core"],
                }, ...entry.classification.assignments.slice(1)],
              },
            }
            : entry
        ),
      }), "case-a"],
    ] as const,
  )("rejects invalid classifier output: $0", (problem, mutate, caseId) => {
    expectValidation(mutate(input()), problem, caseId);
  });

  it.each(
    [
      ["minimumPrecision below approved floor", { minimumPrecision: 0.979999, minimumCorrectPerRole: 3 }],
      ["minimumPrecision below zero", { minimumPrecision: -0.01, minimumCorrectPerRole: 3 }],
      ["minimumPrecision above one", { minimumPrecision: 1.01, minimumCorrectPerRole: 3 }],
      ["minimumCorrectPerRole below approved floor", { minimumPrecision: 0.98, minimumCorrectPerRole: 2 }],
      ["minimumCorrectPerRole below one", { minimumPrecision: 0.98, minimumCorrectPerRole: 0 }],
      ["minimumCorrectPerRole is fractional", { minimumPrecision: 0.98, minimumCorrectPerRole: 1.5 }],
      ["minimumPrecision is NaN", { minimumPrecision: NaN, minimumCorrectPerRole: 3 }],
      ["minimumPrecision is infinite", { minimumPrecision: Infinity, minimumCorrectPerRole: 3 }],
      ["minimumCorrectPerRole is NaN", { minimumPrecision: 0.98, minimumCorrectPerRole: NaN }],
      ["minimumCorrectPerRole is infinite", { minimumPrecision: 0.98, minimumCorrectPerRole: Infinity }],
    ] as const,
  )("rejects %s", (_name, policy) => {
    expectValidation({ ...input(), policy }, "invalid-policy");
  });

  it.each(
    [
      ["NaN", NaN],
      ["positive Infinity", Infinity],
      ["negative Infinity", -Infinity],
      ["below zero", -0.01],
      ["above one", 1.01],
    ] as const,
  )("rejects classifier confidence %s", (_name, confidence) => {
    const candidate = input();
    const firstClassification = candidate.classifications[0]!;
    const firstAssignment = firstClassification.classification.assignments[0]!;
    const classifications = candidate.classifications.map((entry, index) =>
      index === 0
        ? {
          ...entry,
          classification: {
            ...entry.classification,
            assignments: [{ ...firstAssignment, confidence }, ...entry.classification.assignments.slice(1)],
          },
        }
        : entry
    );

    expectValidation({ ...candidate, classifications }, "invalid-assignment-confidence", "case-a");
  });

  it("rejects a corpus with no threshold-eligible assignments", () => {
    const candidate = input();
    expectValidation({
      ...candidate,
      goldAssignments: candidate.goldAssignments.map((gold) => ({ ...gold, thresholdEligible: false })),
    }, "no-threshold-eligible-assignments");
  });

  it("reports insufficient evidence when every emitted candidate has an error", () => {
    const result = evaluateArchitectureRoles({
      pattern: "client-server",
      goldAssignments: [
        { caseId: "errors", category: "errors", nodeId: "client", expectedRole: "client", thresholdEligible: true },
        { caseId: "errors", category: "errors", nodeId: "service", expectedRole: "service", thresholdEligible: true },
      ],
      classifications: [{
        caseId: "errors",
        classification: {
          pattern: "client-server",
          assignments: [
            assignment("client", "domain", 0.9, "label"),
            assignment("service", "domain", 0.8, "label"),
          ],
          diagnostics: [],
        },
      }],
      policy: { minimumPrecision: 0.98, minimumCorrectPerRole: 3 },
    });

    expect(result).toMatchObject({
      status: "success",
      evaluation: {
        candidates: [
          { threshold: 0.8, incorrectExposedCount: 2, qualifies: false },
          { threshold: 0.9, incorrectExposedCount: 1, qualifies: false },
        ],
        recommendation: {
          status: "insufficient-evidence",
          reason: "No emitted confidence threshold satisfies the precision and role-support policy.",
        },
      },
    });
  });
});
