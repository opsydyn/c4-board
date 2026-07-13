import {
  type ArchitecturePattern,
  type ArchitectureRoleAssignment,
  type ArchitectureRoleClassification,
  type ArchitectureSemanticRole,
  getRolesForPattern,
  isRoleAllowedForPattern,
} from "./architecture-role-classification";

export interface ArchitectureRoleGoldAssignment {
  readonly caseId: string;
  readonly category: string;
  readonly nodeId: string;
  readonly expectedRole: ArchitectureSemanticRole;
  readonly thresholdEligible: boolean;
}

export interface ArchitectureRoleEvaluationInput {
  readonly pattern: ArchitecturePattern;
  readonly goldAssignments: ReadonlyArray<ArchitectureRoleGoldAssignment>;
  readonly classifications: ReadonlyArray<{
    readonly caseId: string;
    readonly classification: ArchitectureRoleClassification;
  }>;
  readonly policy: {
    readonly minimumPrecision: number;
    readonly minimumCorrectPerRole: number;
  };
}

export type EvaluationBreakdownDimension =
  | "expected-role"
  | "predicted-role"
  | "source"
  | "confidence-band"
  | "category";

export interface EvaluationBreakdown {
  readonly key: string;
  readonly total: number;
  readonly correct: number;
  readonly incorrect: number;
  readonly fallback: number;
}

export interface ThresholdRoleSupport {
  readonly role: ArchitectureSemanticRole;
  readonly exposedCount: number;
  readonly correctExposedCount: number;
  readonly incorrectExposedCount: number;
  readonly precision: number | null;
  readonly recommended: boolean;
}

export interface ThresholdEvaluation {
  readonly threshold: number;
  readonly exposedCount: number;
  readonly correctExposedCount: number;
  readonly incorrectExposedCount: number;
  readonly precision: number | null;
  readonly coverage: number;
  readonly overconfidentErrorCount: number;
  readonly roleSupport: ReadonlyArray<ThresholdRoleSupport>;
  readonly recommendedRoles: ReadonlyArray<ArchitectureSemanticRole>;
  readonly qualifies: boolean;
}

export type ThresholdRecommendation =
  | {
    readonly status: "selected";
    readonly threshold: number;
    readonly roles: ReadonlyArray<ArchitectureSemanticRole>;
  }
  | {
    readonly status: "insufficient-evidence";
    readonly reason: string;
  };

export interface ArchitectureRoleEvaluation {
  readonly pattern: ArchitecturePattern;
  readonly totalAssignmentCount: number;
  readonly eligibleAssignmentCount: number;
  readonly controlAssignmentCount: number;
  readonly correctAssignmentCount: number;
  readonly incorrectAssignmentCount: number;
  readonly fallbackAssignmentCount: number;
  readonly correctionFrequency: number;
  readonly fallbackRate: number;
  readonly breakdowns: Readonly<Record<EvaluationBreakdownDimension, ReadonlyArray<EvaluationBreakdown>>>;
  readonly candidates: ReadonlyArray<ThresholdEvaluation>;
  readonly recommendation: ThresholdRecommendation;
}

export interface ArchitectureRoleEvaluationValidationError {
  readonly _tag: "ArchitectureRoleEvaluationValidationError";
  readonly caseId: string | null;
  readonly problem:
    | "duplicate-gold-assignment"
    | "duplicate-classification-case"
    | "unknown-assignment"
    | "duplicate-assignment"
    | "missing-assignment"
    | "invalid-assignment-confidence"
    | "pattern-mismatch"
    | "role-pattern-mismatch"
    | "no-threshold-eligible-assignments"
    | "invalid-policy";
  readonly message: string;
}

export type ArchitectureRoleEvaluationResult =
  | { readonly status: "success"; readonly evaluation: ArchitectureRoleEvaluation }
  | { readonly status: "validation-failure"; readonly error: ArchitectureRoleEvaluationValidationError };

const ratio = (numerator: number, denominator: number): number | null =>
  denominator === 0 ? null : numerator / denominator;

const confidenceBand = (confidence: number): string => {
  if (confidence < 0.5) return "0.00-0.49";
  if (confidence < 0.65) return "0.50-0.64";
  if (confidence < 0.8) return "0.65-0.79";
  if (confidence < 0.9) return "0.80-0.89";
  return "0.90-1.00";
};

const sortedUnique = (values: ReadonlyArray<number>): number[] =>
  [...new Set(values)].sort((left, right) => left - right);

const keyFor = (caseId: string, nodeId: string): string => `${caseId}\u0000${nodeId}`;

const validationFailure = (
  problem: ArchitectureRoleEvaluationValidationError["problem"],
  caseId: string | null,
  message: string,
): ArchitectureRoleEvaluationResult => ({
  status: "validation-failure",
  error: { _tag: "ArchitectureRoleEvaluationValidationError", caseId, problem, message },
});

const isValidPolicy = (policy: ArchitectureRoleEvaluationInput["policy"]): boolean =>
  Number.isFinite(policy.minimumPrecision)
  && policy.minimumPrecision >= 0.98
  && policy.minimumPrecision <= 1
  && Number.isFinite(policy.minimumCorrectPerRole)
  && Number.isInteger(policy.minimumCorrectPerRole)
  && policy.minimumCorrectPerRole >= 3;

interface EvaluatedAssignment {
  readonly gold: ArchitectureRoleGoldAssignment;
  readonly prediction: ArchitectureRoleAssignment;
  readonly correct: boolean;
  readonly fallback: boolean;
}

const addBreakdown = (
  breakdowns: Map<string, EvaluationBreakdown>,
  key: string,
  correct: boolean,
  fallback: boolean,
): void => {
  const current = breakdowns.get(key) ?? { key, total: 0, correct: 0, incorrect: 0, fallback: 0 };
  breakdowns.set(key, {
    key,
    total: current.total + 1,
    correct: current.correct + (correct ? 1 : 0),
    incorrect: current.incorrect + (correct ? 0 : 1),
    fallback: current.fallback + (fallback ? 1 : 0),
  });
};

const sortedBreakdowns = (breakdowns: Map<string, EvaluationBreakdown>): EvaluationBreakdown[] =>
  [...breakdowns.values()].sort((left, right) => left.key.localeCompare(right.key));

const buildCandidates = (
  assignments: ReadonlyArray<EvaluatedAssignment>,
  pattern: ArchitecturePattern,
  minimumPrecision: number,
  minimumCorrectPerRole: number,
): ThresholdEvaluation[] => {
  const roles = getRolesForPattern(pattern)
    .filter((role) => role !== "unclassified")
    .sort((left, right) => left.localeCompare(right));
  const thresholds = sortedUnique(
    assignments
      .filter(({ prediction }) => prediction.role !== "unclassified")
      .map(({ prediction }) => prediction.confidence),
  );

  return thresholds.map((threshold) => {
    const exposed = assignments.filter(({ prediction }) =>
      prediction.role !== "unclassified" && prediction.confidence >= threshold
    );
    const correctExposedCount = exposed.filter(({ correct }) => correct).length;
    const incorrectExposedCount = exposed.length - correctExposedCount;
    const roleSupport = roles.map((role) => {
      const roleAssignments = exposed.filter(({ prediction }) => prediction.role === role);
      const correctRoleCount = roleAssignments.filter(({ correct }) => correct).length;
      const incorrectRoleCount = roleAssignments.length - correctRoleCount;
      return {
        role,
        exposedCount: roleAssignments.length,
        correctExposedCount: correctRoleCount,
        incorrectExposedCount: incorrectRoleCount,
        precision: ratio(correctRoleCount, roleAssignments.length),
        recommended: incorrectRoleCount === 0 && correctRoleCount >= minimumCorrectPerRole,
      };
    });
    const recommendedRoles = roleSupport
      .filter(({ recommended }) => recommended)
      .map(({ role }) => role)
      .sort((left, right) => left.localeCompare(right));
    const precision = ratio(correctExposedCount, exposed.length);

    return {
      threshold,
      exposedCount: exposed.length,
      correctExposedCount,
      incorrectExposedCount,
      precision,
      coverage: assignments.length === 0 ? 0 : exposed.length / assignments.length,
      overconfidentErrorCount: incorrectExposedCount,
      roleSupport,
      recommendedRoles,
      qualifies: exposed.length > 0
        && incorrectExposedCount === 0
        && precision !== null
        && precision >= minimumPrecision
        && recommendedRoles.length > 0,
    };
  });
};

export const evaluateArchitectureRoles = (
  input: ArchitectureRoleEvaluationInput,
): ArchitectureRoleEvaluationResult => {
  if (!isValidPolicy(input.policy)) {
    return validationFailure(
      "invalid-policy",
      null,
      "Evaluation policy must use a precision between 0.98 and 1 and an integer role-support floor of at least 3.",
    );
  }

  const allowedRoles = new Set(getRolesForPattern(input.pattern));
  const goldByKey = new Map<string, ArchitectureRoleGoldAssignment>();
  for (const gold of input.goldAssignments) {
    const key = keyFor(gold.caseId, gold.nodeId);
    if (goldByKey.has(key)) {
      return validationFailure(
        "duplicate-gold-assignment",
        gold.caseId,
        `Gold assignment '${gold.nodeId}' is duplicated in case '${gold.caseId}'.`,
      );
    }
    if (!allowedRoles.has(gold.expectedRole)) {
      return validationFailure(
        "pattern-mismatch",
        gold.caseId,
        `Expected role '${gold.expectedRole}' is not valid for ${input.pattern} classification.`,
      );
    }
    goldByKey.set(key, gold);
  }

  const classificationByCase = new Map<string, ArchitectureRoleClassification>();
  for (const entry of input.classifications) {
    if (classificationByCase.has(entry.caseId)) {
      return validationFailure(
        "duplicate-classification-case",
        entry.caseId,
        `Classification case '${entry.caseId}' is duplicated.`,
      );
    }
    if (!goldByKeyHasCase(goldByKey, entry.caseId)) {
      return validationFailure(
        "unknown-assignment",
        entry.caseId,
        `Classification case '${entry.caseId}' has no gold assignments.`,
      );
    }
    if (entry.classification.pattern !== input.pattern) {
      return validationFailure(
        "pattern-mismatch",
        entry.caseId,
        `Classification pattern '${entry.classification.pattern}' does not match '${input.pattern}'.`,
      );
    }
    classificationByCase.set(entry.caseId, entry.classification);
  }

  const predictionsByKey = new Map<string, ArchitectureRoleAssignment>();
  for (const [caseId, classification] of classificationByCase) {
    for (const prediction of classification.assignments) {
      const key = keyFor(caseId, prediction.nodeId);
      if (prediction.pattern !== input.pattern) {
        return validationFailure(
          "pattern-mismatch",
          caseId,
          `Assignment pattern '${prediction.pattern}' does not match '${input.pattern}'.`,
        );
      }
      if (!isRoleAllowedForPattern(input.pattern, prediction.role)) {
        return validationFailure(
          "role-pattern-mismatch",
          caseId,
          `Assignment role '${prediction.role}' is not valid for ${input.pattern} classification.`,
        );
      }
      if (!Number.isFinite(prediction.confidence) || prediction.confidence < 0 || prediction.confidence > 1) {
        return validationFailure(
          "invalid-assignment-confidence",
          caseId,
          `Classifier assignment '${prediction.nodeId}' in case '${caseId}' must have a finite confidence in [0, 1]; received ${prediction.confidence}.`,
        );
      }
      if (!goldByKey.has(key)) {
        return validationFailure(
          "unknown-assignment",
          caseId,
          `Assignment '${prediction.nodeId}' is not present in the gold case.`,
        );
      }
      if (predictionsByKey.has(key)) {
        return validationFailure(
          "duplicate-assignment",
          caseId,
          `Classifier assignment '${prediction.nodeId}' is duplicated in case '${caseId}'.`,
        );
      }
      predictionsByKey.set(key, prediction);
    }
  }

  for (const [key, gold] of goldByKey) {
    if (!predictionsByKey.has(key)) {
      return validationFailure(
        "missing-assignment",
        gold.caseId,
        `Classifier output is missing assignment '${gold.nodeId}'.`,
      );
    }
  }

  const eligibleGoldAssignments = input.goldAssignments.filter(({ thresholdEligible }) => thresholdEligible);
  if (eligibleGoldAssignments.length === 0) {
    return validationFailure(
      "no-threshold-eligible-assignments",
      null,
      "The evaluation input must contain at least one threshold-eligible assignment.",
    );
  }

  const evaluatedAssignments = [...goldByKey.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, gold]) => {
      const prediction = predictionsByKey.get(key)!;
      const correct = prediction.role === gold.expectedRole;
      return { gold, prediction, correct, fallback: prediction.role === "unclassified" };
    });
  const eligibleAssignments = evaluatedAssignments.filter(({ gold }) => gold.thresholdEligible);
  const correctAssignmentCount = eligibleAssignments.filter(({ correct }) => correct).length;
  const incorrectAssignmentCount = eligibleAssignments.length - correctAssignmentCount;
  const fallbackAssignmentCount = eligibleAssignments.filter(({ fallback }) => fallback).length;
  const breakdownMaps: Record<EvaluationBreakdownDimension, Map<string, EvaluationBreakdown>> = {
    "expected-role": new Map(),
    "predicted-role": new Map(),
    source: new Map(),
    "confidence-band": new Map(),
    category: new Map(),
  };

  for (const { gold, prediction, correct, fallback } of eligibleAssignments) {
    addBreakdown(breakdownMaps["expected-role"], gold.expectedRole, correct, fallback);
    addBreakdown(breakdownMaps["predicted-role"], prediction.role, correct, fallback);
    addBreakdown(breakdownMaps.source, prediction.source, correct, fallback);
    addBreakdown(breakdownMaps["confidence-band"], confidenceBand(prediction.confidence), correct, fallback);
    addBreakdown(breakdownMaps.category, gold.category, correct, fallback);
  }

  const breakdowns: Readonly<Record<EvaluationBreakdownDimension, ReadonlyArray<EvaluationBreakdown>>> = {
    "expected-role": sortedBreakdowns(breakdownMaps["expected-role"]),
    "predicted-role": sortedBreakdowns(breakdownMaps["predicted-role"]),
    source: sortedBreakdowns(breakdownMaps.source),
    "confidence-band": sortedBreakdowns(breakdownMaps["confidence-band"]),
    category: sortedBreakdowns(breakdownMaps.category),
  };
  const candidates = buildCandidates(
    eligibleAssignments,
    input.pattern,
    input.policy.minimumPrecision,
    input.policy.minimumCorrectPerRole,
  );
  const selected = candidates.find(({ qualifies }) => qualifies);

  return {
    status: "success",
    evaluation: {
      pattern: input.pattern,
      totalAssignmentCount: evaluatedAssignments.length,
      eligibleAssignmentCount: eligibleAssignments.length,
      controlAssignmentCount: evaluatedAssignments.length - eligibleAssignments.length,
      correctAssignmentCount,
      incorrectAssignmentCount,
      fallbackAssignmentCount,
      correctionFrequency: incorrectAssignmentCount / eligibleAssignments.length,
      fallbackRate: fallbackAssignmentCount / eligibleAssignments.length,
      breakdowns,
      candidates,
      recommendation: selected
        ? { status: "selected", threshold: selected.threshold, roles: selected.recommendedRoles }
        : {
          status: "insufficient-evidence",
          reason: "No emitted confidence threshold satisfies the precision and role-support policy.",
        },
    },
  };
};

const goldByKeyHasCase = (goldByKey: ReadonlyMap<string, ArchitectureRoleGoldAssignment>, caseId: string): boolean =>
  [...goldByKey.values()].some((gold) => gold.caseId === caseId);
