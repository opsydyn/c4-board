import * as FastCheck from "effect/FastCheck";
import { describe, expect, it } from "vitest";
import type { ArchitectureRoleAssignment } from "./architecture-role-classification";
import { type ArchitectureRoleEvaluationInput, evaluateArchitectureRoles } from "./architecture-role-evaluation";

const role = FastCheck.constantFrom(
  "client" as const,
  "service" as const,
  "domain" as const,
  "persistence" as const,
  "external-dependency" as const,
  "unclassified" as const,
);

const cases = FastCheck.array(
  FastCheck.record({
    expectedRole: role,
    predictedRole: role,
    confidence: FastCheck.integer({ min: 0, max: 100 }),
  }),
  { minLength: 1, maxLength: 40 },
).map((rows): ArchitectureRoleEvaluationInput => ({
  pattern: "client-server",
  goldAssignments: rows.map(({ expectedRole }, index) => ({
    caseId: `case-${index}`,
    category: index % 2 === 0 ? "even" : "odd",
    nodeId: `node-${index}`,
    expectedRole,
    thresholdEligible: true,
  })),
  classifications: rows.map(({ predictedRole, confidence }, index) => ({
    caseId: `case-${index}`,
    classification: {
      pattern: "client-server",
      assignments: [
        {
          nodeId: `node-${index}`,
          pattern: "client-server",
          role: predictedRole,
          confidence: confidence / 100,
          source: predictedRole === "unclassified" ? "fallback" : "label",
          evidence: ["generated"],
        } satisfies ArchitectureRoleAssignment,
      ],
      diagnostics: [],
    },
  })),
  policy: { minimumPrecision: 0.98, minimumCorrectPerRole: 3 },
}));

describe("architecture role evaluation properties", () => {
  it("keeps counts partitioned, ratios bounded, and thresholds sorted", () => {
    FastCheck.assert(
      FastCheck.property(cases, (input) => {
        const result = evaluateArchitectureRoles(input);
        expect(result.status).toBe("success");
        if (result.status !== "success") return;
        const evaluation = result.evaluation;
        expect(evaluation.correctAssignmentCount + evaluation.incorrectAssignmentCount)
          .toBe(evaluation.eligibleAssignmentCount);
        expect(evaluation.correctionFrequency).toBeGreaterThanOrEqual(0);
        expect(evaluation.correctionFrequency).toBeLessThanOrEqual(1);
        expect(evaluation.fallbackRate).toBeGreaterThanOrEqual(0);
        expect(evaluation.fallbackRate).toBeLessThanOrEqual(1);
        expect(evaluation.candidates.map(({ threshold }) => threshold))
          .toEqual([...evaluation.candidates.map(({ threshold }) => threshold)].sort((a, b) => a - b));
        for (const candidate of evaluation.candidates) {
          expect(candidate.precision === null || Number.isFinite(candidate.precision)).toBe(true);
          expect(Number.isFinite(candidate.coverage)).toBe(true);
          expect(candidate.correctExposedCount + candidate.incorrectExposedCount).toBe(candidate.exposedCount);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("is invariant to case, gold, and classification order", () => {
    FastCheck.assert(
      FastCheck.property(cases, (input) => {
        const forward = evaluateArchitectureRoles(input);
        const reversed = evaluateArchitectureRoles({
          ...input,
          goldAssignments: [...input.goldAssignments].reverse(),
          classifications: [...input.classifications].reverse().map(({ caseId, classification }) => ({
            caseId,
            classification: { ...classification, assignments: [...classification.assignments].reverse() },
          })),
        });
        expect(reversed).toEqual(forward);
      }),
      { numRuns: 100 },
    );
  });
});
