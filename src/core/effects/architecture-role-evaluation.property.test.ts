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

const generatedRow = FastCheck.record({
  expectedRole: role,
  predictedRole: role,
  confidence: FastCheck.integer({ min: 0, max: 100 }),
});

const mandatoryRows = [
  { expectedRole: "client", predictedRole: "client", confidence: 0 },
  { expectedRole: "service", predictedRole: "service", confidence: 100 },
  { expectedRole: "domain", predictedRole: "domain", confidence: 25 },
  { expectedRole: "persistence", predictedRole: "persistence", confidence: 50 },
  { expectedRole: "external-dependency", predictedRole: "external-dependency", confidence: 75 },
  { expectedRole: "unclassified", predictedRole: "unclassified", confidence: 50 },
] satisfies ReadonlyArray<{
  expectedRole: ArchitectureRoleAssignment["role"];
  predictedRole: ArchitectureRoleAssignment["role"];
  confidence: number;
}>;

const caseIdFor = (index: number): string => `case-${index < 2 ? 0 : index - 1}`;

const cases = FastCheck.array(generatedRow, { minLength: 0, maxLength: 34 })
  .map((optionalRows) => [...mandatoryRows, ...optionalRows])
  .map((rows): ArchitectureRoleEvaluationInput => {
    const rowsByCase = new Map<string, Array<{ index: number; row: (typeof rows)[number] }>>();
    rows.forEach((row, index) => {
      const caseId = caseIdFor(index);
      const entries = rowsByCase.get(caseId) ?? [];
      entries.push({ index, row });
      rowsByCase.set(caseId, entries);
    });

    return {
      pattern: "client-server",
      goldAssignments: rows.map(({ expectedRole }, index) => ({
        caseId: caseIdFor(index),
        category: index % 2 === 0 ? "even" : "odd",
        nodeId: `node-${index}`,
        expectedRole,
        thresholdEligible: true,
      })),
      classifications: [...rowsByCase].map(([caseId, entries]) => ({
        caseId,
        classification: {
          pattern: "client-server" as const,
          assignments: entries.map(({ index, row }) => ({
            nodeId: `node-${index}`,
            pattern: "client-server" as const,
            role: row.predictedRole,
            confidence: row.confidence / 100,
            source: row.predictedRole === "unclassified" ? "fallback" as const : "label" as const,
            evidence: ["generated"],
          } satisfies ArchitectureRoleAssignment)),
          diagnostics: [],
        },
      })),
      policy: { minimumPrecision: 0.98, minimumCorrectPerRole: 3 },
    };
  });

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
          if (candidate.precision !== null) {
            expect(candidate.precision).toBeGreaterThanOrEqual(0);
            expect(candidate.precision).toBeLessThanOrEqual(1);
          }
          expect(Number.isFinite(candidate.coverage)).toBe(true);
          expect(candidate.coverage).toBeGreaterThanOrEqual(0);
          expect(candidate.coverage).toBeLessThanOrEqual(1);
          for (const roleSupport of candidate.roleSupport) {
            expect(roleSupport.precision === null || Number.isFinite(roleSupport.precision)).toBe(true);
            if (roleSupport.precision !== null) {
              expect(roleSupport.precision).toBeGreaterThanOrEqual(0);
              expect(roleSupport.precision).toBeLessThanOrEqual(1);
            }
          }
          expect(candidate.correctExposedCount + candidate.incorrectExposedCount).toBe(candidate.exposedCount);
        }
      }),
      { numRuns: 100, seed: 20260713 },
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
      { numRuns: 100, seed: 20260713 },
    );
  });
});
