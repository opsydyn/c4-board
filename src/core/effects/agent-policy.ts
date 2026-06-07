import { pipe, Schema } from "effect";

export const RigToolCapabilitySchema = Schema.Literal("read", "mutate", "admin");
export type RigToolCapability = Schema.Schema.Type<typeof RigToolCapabilitySchema>;

export const RigToolRiskSchema = Schema.Literal("low", "medium", "high");
export type RigToolRisk = Schema.Schema.Type<typeof RigToolRiskSchema>;

export const RigToolScopeSchema = Schema.Literal("c4", "ddd", "azure", "settings");
export type RigToolScope = Schema.Schema.Type<typeof RigToolScopeSchema>;

export const RigMutationModeSchema = Schema.Literal("disabled", "confirm", "policy");
export type RigMutationMode = Schema.Schema.Type<typeof RigMutationModeSchema>;

export const RigProviderIdentifierSchema = Schema.Literal("openai", "anthropic", "openrouter");
export type RigProviderIdentifier = Schema.Schema.Type<typeof RigProviderIdentifierSchema>;

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

const RigAllowedModelSchema = pipe(
  Schema.String,
  Schema.filter(
    (value) => value.trim().length > 0 && value.trim().length <= 128,
    {
      message: () => "allowedModels entries must be between 1 and 128 characters",
    },
  ),
);

const RigAllowedProvidersSchema = pipe(
  Schema.Array(RigProviderIdentifierSchema),
  Schema.filter(
    (value) => value.length <= 8,
    {
      message: () => "allowedProviders must contain 8 entries or fewer",
    },
  ),
);

const RigAllowedModelsSchema = pipe(
  Schema.Array(RigAllowedModelSchema),
  Schema.filter(
    (value) => value.length <= 32,
    {
      message: () => "allowedModels must contain 32 entries or fewer",
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

export const RigExecutionPolicySettingsSchema = Schema.Struct({
  killSwitchEnabled: Schema.Boolean,
  allowedProviders: RigAllowedProvidersSchema,
  allowedModels: RigAllowedModelsSchema,
});
export type RigExecutionPolicySettings = Schema.Schema.Type<typeof RigExecutionPolicySettingsSchema>;

export interface RigMutationPolicyViolation {
  readonly kind: "actions" | "nodes" | "edges" | "settings";
  readonly actual: number | null;
  readonly limit: number | null;
  readonly message: string;
}

export interface RigExecutionPolicyViolation {
  readonly kind: "kill-switch" | "provider" | "model";
  readonly actual: string | null;
  readonly allowed: ReadonlyArray<string> | null;
  readonly message: string;
  readonly recommendedAction: string;
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

const normalizeRigAllowedValue = (value: string): string => value.trim().toLowerCase();

export const isRigProviderAllowed = (
  policy: RigExecutionPolicySettings,
  provider: string,
): boolean => {
  const normalizedProvider = normalizeRigAllowedValue(provider);
  return policy.allowedProviders.some(
    (allowedProvider) => normalizeRigAllowedValue(allowedProvider) === normalizedProvider,
  );
};

export const isRigModelAllowed = (
  policy: RigExecutionPolicySettings,
  model: string,
): boolean => {
  const normalizedModel = normalizeRigAllowedValue(model);
  return policy.allowedModels.some(
    (allowedModel) => normalizeRigAllowedValue(allowedModel) === normalizedModel,
  );
};

const summarizeRigAllowedValues = (
  values: ReadonlyArray<string>,
): string => values.length === 0 ? "NONE" : values.map((value) => value.toUpperCase()).join("/");

export const summarizeRigExecutionPolicySettings = (
  policy: RigExecutionPolicySettings,
): string =>
  `EXEC::${policy.killSwitchEnabled ? "OFFLINE" : "LIVE"} · PROVIDERS::${summarizeRigAllowedValues(policy.allowedProviders)} · MODELS::${summarizeRigAllowedValues(policy.allowedModels)}`;

export const detectRigExecutionPolicyViolation = (input: {
  readonly policy: RigExecutionPolicySettings;
  readonly provider: string;
  readonly model: string;
}): RigExecutionPolicyViolation | null => {
  if (input.policy.killSwitchEnabled) {
    return {
      kind: "kill-switch",
      actual: null,
      allowed: null,
      message: "Rig execution is blocked by the global kill switch.",
      recommendedAction: "Disable the kill switch in Settings > AI Agent to restore execution.",
    };
  }

  if (!isRigProviderAllowed(input.policy, input.provider)) {
    return {
      kind: "provider",
      actual: input.provider,
      allowed: input.policy.allowedProviders,
      message: `Provider ${input.provider.toUpperCase()} is not on the allow-list.`,
      recommendedAction: "Allow the provider in Settings > AI Agent or switch to an allowed provider.",
    };
  }

  if (!isRigModelAllowed(input.policy, input.model)) {
    return {
      kind: "model",
      actual: input.model,
      allowed: input.policy.allowedModels,
      message: `Model ${input.model.toUpperCase()} is not on the allow-list.`,
      recommendedAction: "Allow the model in Settings > AI Agent or switch to an allowed model.",
    };
  }

  return null;
};

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
