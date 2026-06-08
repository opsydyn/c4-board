import type {
  OpyAgentLifecycleFailurePhase,
  OpyAgentLifecycleNonTerminalStage,
  OpyAgentLifecycleRequest,
  OpyAgentLifecycleStage,
  OpyAgentLifecycleStatus,
} from "./opy-agent.lifecycle";

export type OpyStageTransitionMilestone =
  | "planned"
  | "proposed"
  | "confirmed"
  | "applied"
  | "verified"
  | "rolled_back"
  | "failed"
  | "cancelled";

export interface OpyStageTransitionPayload {
  readonly version: 1;
  readonly requestId: string;
  readonly requestKind: OpyAgentLifecycleRequest["kind"];
  readonly requestLabel: string;
  readonly requestMode: OpyAgentLifecycleRequest["mode"];
  readonly requiresConfirmation: boolean;
  readonly fromStage: OpyAgentLifecycleStage | null;
  readonly toStage: OpyAgentLifecycleStage;
  readonly milestone: OpyStageTransitionMilestone;
  readonly status: OpyAgentLifecycleStatus | "running";
  readonly failureStage: OpyAgentLifecycleNonTerminalStage | null;
  readonly failurePhase: OpyAgentLifecycleFailurePhase | null;
  readonly errorSummary: string | null;
  readonly attempt: number;
  readonly occurredAt: number;
  readonly transitionKey: string;
}

export const deriveOpyStageTransitionMilestone = (input: {
  readonly requestKind: OpyAgentLifecycleRequest["kind"];
  readonly toStage: OpyAgentLifecycleStage;
  readonly status: OpyAgentLifecycleStatus | "running";
}): OpyStageTransitionMilestone => {
  if (input.status === "cancelled") {
    return "cancelled";
  }

  if (input.toStage === "failed" || input.status === "failed") {
    return "failed";
  }

  if (input.toStage === "completed" && input.requestKind === "rollback") {
    return "rolled_back";
  }

  if (input.toStage === "completed") {
    return "verified";
  }

  if (input.toStage === "verifying") {
    return "applied";
  }

  if (input.toStage === "applying") {
    return "confirmed";
  }

  if (input.toStage === "proposing" || input.toStage === "awaiting_confirmation") {
    return "proposed";
  }

  return "planned";
};

export const createOpyStageTransitionPayload = (input: {
  readonly request: OpyAgentLifecycleRequest;
  readonly fromStage: OpyAgentLifecycleStage | null;
  readonly toStage: OpyAgentLifecycleStage;
  readonly status: OpyAgentLifecycleStatus | "running";
  readonly failureStage: OpyAgentLifecycleNonTerminalStage | null;
  readonly failurePhase: OpyAgentLifecycleFailurePhase | null;
  readonly errorSummary: string | null;
  readonly attempt: number;
  readonly occurredAt: number;
}): OpyStageTransitionPayload => {
  const milestone = deriveOpyStageTransitionMilestone({
    requestKind: input.request.kind,
    toStage: input.toStage,
    status: input.status,
  });
  const fromStage = input.fromStage ?? "none";
  const transitionKey = [
    input.request.id,
    `attempt-${Math.max(1, input.attempt)}`,
    `${fromStage}->${input.toStage}`,
    input.status,
    input.failureStage ?? "none",
    input.failurePhase ?? "none",
    milestone,
  ].join(":");

  return {
    version: 1,
    requestId: input.request.id,
    requestKind: input.request.kind,
    requestLabel: input.request.label,
    requestMode: input.request.mode,
    requiresConfirmation: input.request.requiresConfirmation,
    fromStage: input.fromStage,
    toStage: input.toStage,
    milestone,
    status: input.status,
    failureStage: input.failureStage,
    failurePhase: input.failurePhase,
    errorSummary: input.errorSummary,
    attempt: Math.max(1, input.attempt),
    occurredAt: input.occurredAt,
    transitionKey,
  };
};

export const formatOpyStageTransitionSummary = (
  payload: OpyStageTransitionPayload,
): string => {
  const fromStage = payload.fromStage?.toUpperCase() ?? "NONE";
  return [
    "FLOW",
    payload.requestLabel.toUpperCase(),
    payload.milestone.toUpperCase().replace("_", "-"),
    `${fromStage}->${payload.toStage.toUpperCase()}`,
  ].join(" :: ");
};
