import { pipe, Schema } from "effect";

export const RigToolCapabilitySchema = Schema.Literal("read", "mutate", "admin");
export type RigToolCapability = Schema.Schema.Type<typeof RigToolCapabilitySchema>;

export const RigToolRiskSchema = Schema.Literal("low", "medium", "high");
export type RigToolRisk = Schema.Schema.Type<typeof RigToolRiskSchema>;

export const RigToolScopeSchema = Schema.Literal("c4", "ddd", "azure", "settings");
export type RigToolScope = Schema.Schema.Type<typeof RigToolScopeSchema>;

export const RigMutationModeSchema = Schema.Literal("disabled", "confirm", "policy");
export type RigMutationMode = Schema.Schema.Type<typeof RigMutationModeSchema>;

const RigMaxActionsPerBatchSchema = pipe(
  Schema.Number,
  Schema.filter(
    (value) => Number.isInteger(value) && value >= 0 && value <= 256,
    {
      message: () => "maxActionsPerBatch must be an integer between 0 and 256",
    },
  ),
);

const RigMaxNodesCreatedPerRunSchema = pipe(
  Schema.Number,
  Schema.filter(
    (value) => Number.isInteger(value) && value >= 0 && value <= 128,
    {
      message: () => "maxNodesCreatedPerRun must be an integer between 0 and 128",
    },
  ),
);

const RigMaxEdgesCreatedPerRunSchema = pipe(
  Schema.Number,
  Schema.filter(
    (value) => Number.isInteger(value) && value >= 0 && value <= 256,
    {
      message: () => "maxEdgesCreatedPerRun must be an integer between 0 and 256",
    },
  ),
);

export const RigMutationPolicySettingsSchema = Schema.Struct({
  maxActionsPerBatch: RigMaxActionsPerBatchSchema,
  maxNodesCreatedPerRun: RigMaxNodesCreatedPerRunSchema,
  maxEdgesCreatedPerRun: RigMaxEdgesCreatedPerRunSchema,
  allowSettingsMutation: Schema.Boolean,
});
export type RigMutationPolicySettings = Schema.Schema.Type<typeof RigMutationPolicySettingsSchema>;

export interface RigMutationPolicyViolation {
  readonly kind: "actions" | "nodes" | "edges" | "settings";
  readonly actual: number | null;
  readonly limit: number | null;
  readonly message: string;
}

export const RigToolPolicyMetadataSchema = Schema.Struct({
  capability: RigToolCapabilitySchema,
  risk: RigToolRiskSchema,
  scope: RigToolScopeSchema,
  requiresConfirmation: Schema.Boolean,
});
export type RigToolPolicyMetadata = Schema.Schema.Type<typeof RigToolPolicyMetadataSchema>;

const RISK_ORDER: Readonly<Record<RigToolRisk, number>> = {
  low: 0,
  medium: 1,
  high: 2,
};

export const compareRigToolRisk = (left: RigToolRisk, right: RigToolRisk): number =>
  RISK_ORDER[left] - RISK_ORDER[right];

export const pickHigherRigToolRisk = (left: RigToolRisk, right: RigToolRisk): RigToolRisk =>
  compareRigToolRisk(left, right) >= 0 ? left : right;

export const isRigToolScopeAllowed = (
  policy: RigToolPolicyMetadata,
  scope: RigToolScope,
): boolean => policy.scope === scope;

export const summarizeRigToolPolicy = (policy: RigToolPolicyMetadata): string =>
  `${policy.capability.toUpperCase()} · ${policy.scope.toUpperCase()} · ${policy.risk.toUpperCase()}${
    policy.requiresConfirmation ? " · CONFIRM" : ""
  }`;

export const summarizeRigMutationPolicySettings = (
  policy: RigMutationPolicySettings,
): string =>
  `LIMITS::A${policy.maxActionsPerBatch} · N${policy.maxNodesCreatedPerRun} · E${policy.maxEdgesCreatedPerRun} · SETTINGS::${
    policy.allowSettingsMutation ? "UNLOCKED" : "LOCKED"
  }`;

export const detectRigMutationPolicyViolation = (input: {
  readonly policy: RigMutationPolicySettings;
  readonly totalActions: number;
  readonly totalNodesCreated: number;
  readonly totalEdgesCreated: number;
  readonly touchesSettings?: boolean;
}): RigMutationPolicyViolation | null => {
  if (input.touchesSettings && !input.policy.allowSettingsMutation) {
    return {
      kind: "settings",
      actual: null,
      limit: null,
      message: "Settings mutation is locked by policy.",
    };
  }

  if (input.totalActions > input.policy.maxActionsPerBatch) {
    return {
      kind: "actions",
      actual: input.totalActions,
      limit: input.policy.maxActionsPerBatch,
      message: `Batch size ${input.totalActions} exceeds the max action budget ${input.policy.maxActionsPerBatch}.`,
    };
  }

  if (input.totalNodesCreated > input.policy.maxNodesCreatedPerRun) {
    return {
      kind: "nodes",
      actual: input.totalNodesCreated,
      limit: input.policy.maxNodesCreatedPerRun,
      message: `Node creation count ${input.totalNodesCreated} exceeds the max node budget ${input.policy.maxNodesCreatedPerRun}.`,
    };
  }

  if (input.totalEdgesCreated > input.policy.maxEdgesCreatedPerRun) {
    return {
      kind: "edges",
      actual: input.totalEdgesCreated,
      limit: input.policy.maxEdgesCreatedPerRun,
      message: `Edge creation count ${input.totalEdgesCreated} exceeds the max edge budget ${input.policy.maxEdgesCreatedPerRun}.`,
    };
  }

  return null;
};
