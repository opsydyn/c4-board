import {
  detectRigExecutionPolicyViolation,
  detectRigMutationPolicyViolation,
  resolveRigActionApprovalPolicy,
  summarizeRigExecutionPolicySettings,
  summarizeRigMutationPolicySettings,
} from "@/core/effects/agent-policy";
import { DEFAULT_APP_SETTINGS } from "@/core/effects/settings.types";
import { describe, expect, it } from "vitest";

const defaultAgentPolicy = DEFAULT_APP_SETTINGS.agentPolicy;
const defaultExecutionPolicy = DEFAULT_APP_SETTINGS.rigExecutionPolicy;

describe("agent-policy", () => {
  it("summarizes mutation policy settings for operator surfaces", () => {
    expect(summarizeRigMutationPolicySettings(defaultAgentPolicy)).toBe(
      "LIMITS::A48 · N12 · E24 · SETTINGS::LOCKED",
    );
  });

  it("summarizes execution policy settings for operator surfaces", () => {
    expect(summarizeRigExecutionPolicySettings(defaultExecutionPolicy)).toBe(
      "EXEC::LIVE · PROVIDERS::OPENAI · MODELS::GPT-4O-MINI/GPT-4.1-MINI",
    );
  });

  it("detects kill switch execution violations", () => {
    const violation = detectRigExecutionPolicyViolation({
      policy: {
        ...defaultExecutionPolicy,
        killSwitchEnabled: true,
      },
      provider: "openai",
      model: "gpt-4o-mini",
    });

    expect(violation).toEqual({
      kind: "kill-switch",
      actual: null,
      allowed: null,
      message: "Rig execution is blocked by the global kill switch.",
      recommendedAction: "Disable the kill switch in Settings > AI Agent to restore execution.",
    });
  });

  it("detects provider allow-list violations", () => {
    const violation = detectRigExecutionPolicyViolation({
      policy: defaultExecutionPolicy,
      provider: "anthropic",
      model: "gpt-4o-mini",
    });

    expect(violation).toEqual({
      kind: "provider",
      actual: "anthropic",
      allowed: ["openai"],
      message: "Provider ANTHROPIC is not on the allow-list.",
      recommendedAction: "Allow the provider in Settings > AI Agent or switch to an allowed provider.",
    });
  });

  it("detects model allow-list violations", () => {
    const violation = detectRigExecutionPolicyViolation({
      policy: defaultExecutionPolicy,
      provider: "openai",
      model: "gpt-4.1",
    });

    expect(violation).toEqual({
      kind: "model",
      actual: "gpt-4.1",
      allowed: ["gpt-4o-mini", "gpt-4.1-mini"],
      message: "Model GPT-4.1 is not on the allow-list.",
      recommendedAction: "Allow the model in Settings > AI Agent or switch to an allowed model.",
    });
  });

  it("allows normalized provider and model values on the allow-list", () => {
    const violation = detectRigExecutionPolicyViolation({
      policy: defaultExecutionPolicy,
      provider: " OPENAI ",
      model: " GPT-4O-MINI ",
    });

    expect(violation).toBeNull();
  });

  it("detects locked settings mutation attempts", () => {
    const violation = detectRigMutationPolicyViolation({
      policy: defaultAgentPolicy,
      totalActions: 0,
      totalNodesCreated: 0,
      totalEdgesCreated: 0,
      touchesSettings: true,
    });

    expect(violation).toEqual({
      kind: "settings",
      actual: null,
      limit: null,
      message: "Settings mutation is locked by policy.",
    });
  });

  it("detects edge creation budget overruns", () => {
    const violation = detectRigMutationPolicyViolation({
      policy: {
        ...defaultAgentPolicy,
        maxEdgesCreatedPerRun: 1,
      },
      totalActions: 2,
      totalNodesCreated: 1,
      totalEdgesCreated: 2,
    });

    expect(violation).toEqual({
      kind: "edges",
      actual: 2,
      limit: 1,
      message: "Edge creation count 2 exceeds the max edge budget 1.",
    });
  });

  it("classifies low-risk single-add actions as always-confirm", () => {
    const decision = resolveRigActionApprovalPolicy({
      actionClass: "single-add",
      policy: defaultAgentPolicy,
      totalActions: 1,
      totalNodesCreated: 1,
      totalEdgesCreated: 0,
    });

    expect(decision).toMatchObject({
      actionClass: "single-add",
      risk: "low",
      approvalMode: "always-confirm",
      requiresConfirmation: true,
      thresholdTriggered: false,
      blockedReason: null,
    });
    expect(decision.summary).toContain("APPROVAL::SINGLE ADD");
    expect(decision.summary).toContain("ALWAYS CONFIRM");
  });

  it("classifies large batch mutation actions as threshold-confirm", () => {
    const decision = resolveRigActionApprovalPolicy({
      actionClass: "batch-mutation",
      policy: defaultAgentPolicy,
      highestRisk: "medium",
      totalActions: 8,
      totalNodesCreated: 4,
      totalEdgesCreated: 4,
    });

    expect(decision).toMatchObject({
      actionClass: "batch-mutation",
      risk: "medium",
      approvalMode: "confirm-on-threshold",
      requiresConfirmation: true,
      thresholdTriggered: true,
      blockedReason: null,
    });
    expect(decision.summary).toContain("THRESHOLD CONFIRM");
  });

  it("blocks settings mutation approval while the settings mutation lock is enabled", () => {
    const decision = resolveRigActionApprovalPolicy({
      actionClass: "settings-mutation",
      policy: defaultAgentPolicy,
      totalActions: 1,
      totalNodesCreated: 0,
      totalEdgesCreated: 0,
      touchesSettings: true,
    });

    expect(decision).toMatchObject({
      actionClass: "settings-mutation",
      risk: "high",
      approvalMode: "blocked",
      requiresConfirmation: false,
      thresholdTriggered: true,
      blockedReason: "Settings mutation is locked by policy.",
    });
    expect(decision.summary).toContain("BLOCKED");
  });
});
