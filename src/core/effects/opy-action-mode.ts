/**
 * What OPY tells an operator about why it will and will not act.
 *
 * Extracted from OpyCopilotPanel because it is pure, and because it had no tests
 * despite being the only thing that explains a blocked agent. When the provider
 * allow-list was set to ["anthropic"] against an openai runtime, the header read
 * `EXECUTION::BLOCKED` and the explanation sat inside a collapsed disclosure —
 * diagnosing it meant reading the settings database.
 */

import type { RigExecutionPolicySettings, RigMutationPolicySettings } from "./agent-policy";
import {
  type detectRigExecutionPolicyViolation,
  summarizeRigExecutionPolicySettings,
  summarizeRigMutationPolicySettings,
} from "./agent-policy";
import type { EffectiveRigAgentV1RolloutState } from "./feature-flags";
import type { AiActionMode } from "./settings.types";

export interface OpyActionModeSurface {
  readonly tone: "critical" | "warning" | "ready";
  readonly label: string;
  readonly detail: string;
}

export const describeActionMode = (
  actionMode: AiActionMode,
  agentPolicy: RigMutationPolicySettings,
  rigExecutionPolicy: RigExecutionPolicySettings,
  executionPolicyViolation: ReturnType<typeof detectRigExecutionPolicyViolation>,
  rigAgentRollout: EffectiveRigAgentV1RolloutState,
): OpyActionModeSurface => {
  const policySummary = summarizeRigMutationPolicySettings(agentPolicy);
  const executionSummary = summarizeRigExecutionPolicySettings(rigExecutionPolicy);

  if (executionPolicyViolation) {
    return {
      tone: "critical",
      label: executionPolicyViolation.kind === "kill-switch"
        ? "KILL SWITCH ACTIVE"
        : "EXECUTION POLICY BLOCK",
      detail: `${executionPolicyViolation.message} ${executionPolicyViolation.recommendedAction} ${executionSummary}`,
    };
  }

  if (rigAgentRollout.mode === "disabled") {
    const rolloutDetail = rigAgentRollout.baseMode === "canary"
      ? "rig_agent_v1 is staged in CANARY and this workstation is not enrolled."
      : "rig_agent_v1 is disabled by the current environment rollout.";

    return {
      tone: "critical",
      label: "ROLLOUT GATE ACTIVE",
      detail:
        `${rolloutDetail} OPY chat remains available for context, but proposal and mutation routes stay offline. ${policySummary}`,
    };
  }

  const rolloutPrefix = rigAgentRollout.mode === "canary"
    ? "Canary rollout active. "
    : "";

  switch (actionMode) {
    case "disabled":
      return {
        tone: "critical",
        label: "MUTATION ROUTES OFFLINE",
        detail:
          `${rolloutPrefix}Board writes and proposal generation are blocked. Chat and board review remain read-only. ${policySummary}`,
      };
    case "read-only":
      return {
        tone: "critical",
        label: "READ-ONLY BOUNDARY ACTIVE",
        detail:
          `${rolloutPrefix}Use chat and /review for inspection. /add, /diagram, and apply paths are blocked in this mode. ${policySummary}`,
      };
    case "propose":
      return {
        tone: "warning",
        label: "PROPOSAL BOUNDARY ACTIVE",
        detail:
          `${rolloutPrefix}OPY can prepare changes, but apply paths stay blocked until APPLY-WITH-CONFIRMATION is enabled. ${policySummary}`,
      };
    case "apply-with-confirmation":
      return {
        tone: "ready",
        label: "CONFIRMED APPLY BOUNDARY",
        detail:
          `${rolloutPrefix}Mutations still require operator confirmation before the board is changed. ${policySummary}`,
      };
  }
};

/**
 * Whether the reason belongs in front of the operator rather than behind a
 * disclosure. A policy or rollout block stops OPY working at all, so it must not
 * be something you have to expand a section to find. A read-only boundary is a
 * deliberate choice rather than a fault, so it stays where it is.
 */
export const isBlockingBoundary = (surface: OpyActionModeSurface): boolean =>
  surface.tone === "critical"
  && (surface.label === "EXECUTION POLICY BLOCK"
    || surface.label === "KILL SWITCH ACTIVE"
    || surface.label === "ROLLOUT GATE ACTIVE");
