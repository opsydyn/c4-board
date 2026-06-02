import { Schema } from "effect";

export const RigToolCapabilitySchema = Schema.Literal("read", "mutate", "admin");
export type RigToolCapability = Schema.Schema.Type<typeof RigToolCapabilitySchema>;

export const RigToolRiskSchema = Schema.Literal("low", "medium", "high");
export type RigToolRisk = Schema.Schema.Type<typeof RigToolRiskSchema>;

export const RigToolScopeSchema = Schema.Literal("c4", "ddd", "azure", "settings");
export type RigToolScope = Schema.Schema.Type<typeof RigToolScopeSchema>;

export const RigMutationModeSchema = Schema.Literal("disabled", "confirm", "policy");
export type RigMutationMode = Schema.Schema.Type<typeof RigMutationModeSchema>;

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
