import type {
  RigExecutionPolicySettings,
  RigExecutionPolicyViolation,
  RigMutationPolicySettings,
} from "@/core/effects/agent-policy";
import type { EffectiveRigAgentV1RolloutState } from "@/core/effects/feature-flags";
import { describeActionMode, isBlockingBoundary, type OpyActionModeSurface } from "@/core/effects/opy-action-mode";
import { describe, expect, it } from "vitest";

/**
 * The text that tells an operator why OPY will not run.
 *
 * This mattered in practice: OPY sat in an error state with the header showing
 * only `EXECUTION::BLOCKED`, while the reason — the provider allow-list had been
 * set to ["anthropic"] with the runtime configured for openai — was rendered
 * inside a collapsed disclosure. Diagnosing it required reading the settings
 * database. The wording below is the whole remedy, so it is worth pinning.
 */

const executionPolicy: RigExecutionPolicySettings = {
  killSwitchEnabled: false,
  allowedProviders: ["anthropic"],
  allowedModels: ["gpt-4o-mini", "gpt-4.1-mini"],
};

const mutationPolicy: RigMutationPolicySettings = {
  maxActionsPerBatch: 48,
  maxNodesCreatedPerRun: 12,
  maxEdgesCreatedPerRun: 24,
  allowSettingsMutation: false,
};

const rolloutState = (
  over: Partial<EffectiveRigAgentV1RolloutState> = {},
): EffectiveRigAgentV1RolloutState => ({
  mode: "enabled",
  baseMode: "enabled",
  preference: "inherit",
  source: "default",
  envKey: null,
  rawValue: null,
  isEnabled: true,
  isCanary: false,
  ...over,
});

const rollout = rolloutState();

const providerViolation: RigExecutionPolicyViolation = {
  kind: "provider",
  actual: "openai",
  allowed: ["anthropic"],
  message: "Provider OPENAI is not on the allow-list.",
  recommendedAction: "Allow the provider in Settings > AI Agent or switch to an allowed provider.",
};

const surfaceFor = (
  violation: RigExecutionPolicyViolation | null,
): OpyActionModeSurface => describeActionMode("read-only", mutationPolicy, executionPolicy, violation, rollout);

describe("describeActionMode", () => {
  it("names the offending provider when the allow-list blocks execution", () => {
    const surface = surfaceFor(providerViolation);

    expect(surface.tone).toBe("critical");
    expect(surface.label).toBe("EXECUTION POLICY BLOCK");
    expect(surface.detail).toContain("Provider OPENAI is not on the allow-list");
  });

  it("says how to fix it, not only what is wrong", () => {
    // Without this the operator is told execution is blocked and nothing else.
    expect(surfaceFor(providerViolation).detail).toContain("Settings > AI Agent");
  });

  it("includes the current policy so the mismatch is visible in one place", () => {
    const detail = surfaceFor(providerViolation).detail;

    expect(detail).toContain("PROVIDERS::ANTHROPIC");
    expect(detail).toContain("MODELS::GPT-4O-MINI/GPT-4.1-MINI");
  });

  it("distinguishes the kill switch from an allow-list block", () => {
    const surface = surfaceFor({
      ...providerViolation,
      kind: "kill-switch",
      message: "Rig execution is blocked by the global kill switch.",
    });

    expect(surface.label).toBe("KILL SWITCH ACTIVE");
  });

  it("reports the rollout gate when the workstation is not enrolled", () => {
    const surface = describeActionMode("read-only", mutationPolicy, executionPolicy, null, {
      ...rolloutState({ mode: "disabled", baseMode: "canary", isEnabled: false }),
    });

    expect(surface.label).toBe("ROLLOUT GATE ACTIVE");
    expect(surface.detail).toContain("CANARY");
  });

  it("describes an ordinary read-only boundary without calling it a fault", () => {
    const surface = surfaceFor(null);

    expect(surface.label).toBe("READ-ONLY BOUNDARY ACTIVE");
  });

  it("treats a confirmed apply boundary as ready", () => {
    const surface = describeActionMode(
      "apply-with-confirmation",
      mutationPolicy,
      executionPolicy,
      null,
      rollout,
    );

    expect(surface.tone).toBe("ready");
  });
});

describe("isBlockingBoundary", () => {
  /**
   * Decides whether the reason gets shown up front or stays behind a disclosure.
   * A policy violation stops OPY working entirely, so it cannot be a detail the
   * operator has to go looking for. A read-only boundary is a deliberate setting,
   * not a fault, and does not need to shout.
   */
  it("surfaces an execution policy block", () => {
    expect(isBlockingBoundary(surfaceFor(providerViolation))).toBe(true);
  });

  it("surfaces a rollout gate", () => {
    expect(isBlockingBoundary(describeActionMode(
      "read-only",
      mutationPolicy,
      executionPolicy,
      null,
      rolloutState({ mode: "disabled", baseMode: "canary", isEnabled: false }),
    ))).toBe(true);
  });

  it("leaves a chosen read-only boundary in its section", () => {
    expect(isBlockingBoundary(surfaceFor(null))).toBe(false);
  });

  it("leaves a ready boundary in its section", () => {
    expect(isBlockingBoundary(
      describeActionMode("apply-with-confirmation", mutationPolicy, executionPolicy, null, rollout),
    )).toBe(false);
  });
});
