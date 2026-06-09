import type { OpyAgentLifecycleFailurePhase, OpyAgentLifecycleNonTerminalStage } from "./opy-agent.lifecycle";

export interface OpyAgentLifecycleStageGuardrail {
  readonly maxEntries: number;
  readonly timeoutMs: number | null;
}

export const OPY_AGENT_MAX_RETRY_ATTEMPTS = 2;

const OPY_AGENT_STAGE_GUARDRAILS: Record<OpyAgentLifecycleNonTerminalStage, OpyAgentLifecycleStageGuardrail> = {
  contextualizing: {
    maxEntries: 2,
    timeoutMs: 10_000,
  },
  planning: {
    maxEntries: 2,
    timeoutMs: 45_000,
  },
  proposing: {
    maxEntries: 2,
    timeoutMs: 10_000,
  },
  awaiting_confirmation: {
    maxEntries: 3,
    timeoutMs: null,
  },
  applying: {
    maxEntries: 2,
    timeoutMs: 60_000,
  },
  verifying: {
    maxEntries: 2,
    timeoutMs: 20_000,
  },
};

export const getOpyAgentLifecycleStageGuardrail = (
  stage: OpyAgentLifecycleNonTerminalStage,
): OpyAgentLifecycleStageGuardrail => OPY_AGENT_STAGE_GUARDRAILS[stage];

export const getOpyAgentLifecycleRetryBudget = (): number => OPY_AGENT_MAX_RETRY_ATTEMPTS;

export const getOpyAgentLifecycleRemainingRetries = (retryCount: number): number =>
  Math.max(0, OPY_AGENT_MAX_RETRY_ATTEMPTS - retryCount);

export const isOpyAgentLifecycleRetryAllowed = (retryCount: number): boolean =>
  getOpyAgentLifecycleRemainingRetries(retryCount) > 0;

export const getOpyAgentLifecycleFailurePhaseForStage = (
  stage: OpyAgentLifecycleNonTerminalStage,
): OpyAgentLifecycleFailurePhase => {
  switch (stage) {
    case "contextualizing":
    case "planning":
    case "proposing":
      return "invoke";
    case "awaiting_confirmation":
    case "applying":
      return "apply";
    case "verifying":
      return "verify";
  }
};

export const createOpyAgentLifecycleTimeoutMessage = (input: {
  readonly requestLabel: string;
  readonly stage: OpyAgentLifecycleNonTerminalStage;
}): string => {
  const guardrail = getOpyAgentLifecycleStageGuardrail(input.stage);
  const timeoutMs = guardrail.timeoutMs;
  const timeoutLabel = timeoutMs === null
    ? "MANUAL"
    : timeoutMs % 1000 === 0
    ? `${Math.round(timeoutMs / 1000)}S`
    : `${(timeoutMs / 1000).toFixed(1)}S`;
  return `FLOW TIMEOUT::${input.requestLabel} · ${input.stage.toUpperCase()} exceeded ${timeoutLabel}.`;
};

export const createOpyAgentLifecycleBudgetMessage = (input: {
  readonly requestLabel: string;
  readonly stage: OpyAgentLifecycleNonTerminalStage;
}): string => {
  const guardrail = getOpyAgentLifecycleStageGuardrail(input.stage);
  return `FLOW BUDGET::${input.requestLabel} · ${input.stage.toUpperCase()} exceeded ${guardrail.maxEntries} stage entr${
    guardrail.maxEntries === 1 ? "y" : "ies"
  }.`;
};
