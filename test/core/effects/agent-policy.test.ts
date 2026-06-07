import {
  detectRigMutationPolicyViolation,
  summarizeRigMutationPolicySettings,
} from "@/core/effects/agent-policy";
import { DEFAULT_APP_SETTINGS } from "@/core/effects/settings.types";
import { describe, expect, it } from "vitest";

const defaultAgentPolicy = DEFAULT_APP_SETTINGS.agentPolicy;

describe("agent-policy", () => {
  it("summarizes mutation policy settings for operator surfaces", () => {
    expect(summarizeRigMutationPolicySettings(defaultAgentPolicy)).toBe(
      "LIMITS::A48 · N12 · E24 · SETTINGS::LOCKED",
    );
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
});
