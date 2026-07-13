import { inferClientServerRoles } from "./architecture-role-classification";
import {
  type ArchitectureRoleEvaluation,
  type ArchitectureRoleEvaluationValidationError,
  evaluateArchitectureRoles,
} from "./architecture-role-evaluation";
import {
  type ClientServerRoleEvalCase,
  type ClientServerRoleEvalCorpusValidationError,
  getClientServerRoleEvalCases,
  validateClientServerRoleEvalCases,
} from "./client-server-role-evals";

export type ClientServerRoleEvaluationRunResult =
  | { readonly status: "success"; readonly evaluation: ArchitectureRoleEvaluation }
  | {
    readonly status: "validation-failure";
    readonly error: ClientServerRoleEvalCorpusValidationError | ArchitectureRoleEvaluationValidationError;
  };

export const runClientServerRoleEvaluationFromClassifications = (
  cases: ReadonlyArray<ClientServerRoleEvalCase>,
  classify: typeof inferClientServerRoles,
): ClientServerRoleEvaluationRunResult => {
  const validation = validateClientServerRoleEvalCases(cases);
  if (validation.status === "validation-failure") return validation;

  const result = evaluateArchitectureRoles({
    pattern: "client-server",
    goldAssignments: cases.flatMap((evalCase) =>
      Object.entries(evalCase.expectedRoles).map(([nodeId, expectedRole]) => ({
        caseId: evalCase.id,
        category: evalCase.category,
        nodeId,
        expectedRole,
        thresholdEligible: evalCase.thresholdEligible,
      }))
    ),
    classifications: cases.map((evalCase) => ({
      caseId: evalCase.id,
      classification: classify(evalCase.nodes, evalCase.edges),
    })),
    policy: { minimumPrecision: 0.98, minimumCorrectPerRole: 3 },
  });

  return result.status === "validation-failure"
    ? result
    : { status: "success", evaluation: result.evaluation };
};

export const runClientServerRoleEvaluation = (
  cases: ReadonlyArray<ClientServerRoleEvalCase> = getClientServerRoleEvalCases(),
): ClientServerRoleEvaluationRunResult =>
  runClientServerRoleEvaluationFromClassifications(cases, inferClientServerRoles);
