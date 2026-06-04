import type { OpyAgentRun } from "./opy-chat.persistence";

export type OpyAgentRunTelemetryEvent =
  | "opy_run_completed"
  | "opy_run_failed"
  | "opy_run_cancelled";

export type OpyAgentFlowTelemetryEvent =
  | "opy_flow_started"
  | "opy_flow_transitioned"
  | "opy_flow_completed"
  | "opy_flow_cancelled"
  | "opy_flow_failed"
  | "opy_flow_reset";

export interface OpyAgentFlowTelemetryRequest {
  readonly id: string;
  readonly kind: string;
  readonly label: string;
  readonly mode: string;
}

export interface OpyAgentRunTelemetryPayload {
  readonly runId: string;
  readonly sessionId: string;
  readonly agent: string;
  readonly intent: string;
  readonly stage: string;
  readonly status: string;
  readonly startedAt: number;
  readonly completedAt: number | null;
  readonly durationMs: number | null;
  readonly errorSummary: string | null;
}

export interface OpyAgentFlowTelemetryPayload {
  readonly requestId: string | null;
  readonly requestKind: string | null;
  readonly requestLabel: string | null;
  readonly requestMode: string | null;
  readonly failurePhase: string | null;
  readonly fromStage: string | null;
  readonly toStage: string;
  readonly terminalStatus: "completed" | "cancelled" | "failed" | null;
  readonly failureStage: string | null;
  readonly errorSummary: string | null;
  readonly completedAt: number | null;
  readonly timestamp: number;
}

const OPY_AGENT_RUN_TELEMETRY_EVENT_NAME = "opsydyn:opy_run:metric";
const OPY_AGENT_FLOW_TELEMETRY_EVENT_NAME = "opsydyn:opy_flow:metric";

const toTelemetryEvent = (run: OpyAgentRun): OpyAgentRunTelemetryEvent | null => {
  switch (run.status) {
    case "completed":
      return "opy_run_completed";
    case "failed":
      return "opy_run_failed";
    case "cancelled":
      return "opy_run_cancelled";
    default:
      return null;
  }
};

export const emitOpyAgentRunTelemetry = (run: OpyAgentRun): void => {
  const event = toTelemetryEvent(run);
  if (!event) {
    return;
  }

  const detail = {
    event,
    runId: run.id,
    sessionId: run.sessionId,
    agent: run.agent,
    intent: run.intent,
    stage: run.stage,
    status: run.status,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    durationMs: run.completedAt === null ? null : Math.max(0, run.completedAt - run.startedAt),
    errorSummary: run.errorSummary,
  } satisfies OpyAgentRunTelemetryPayload & { readonly event: OpyAgentRunTelemetryEvent };

  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(
      new CustomEvent(OPY_AGENT_RUN_TELEMETRY_EVENT_NAME, {
        detail,
      }),
    );
  }
};

export const getOpyAgentRunTelemetryEventName = (): string => OPY_AGENT_RUN_TELEMETRY_EVENT_NAME;

const toFlowTelemetryEvent = (
  fromStage: string | null,
  toStage: string,
  terminalStatus: OpyAgentFlowTelemetryPayload["terminalStatus"],
): OpyAgentFlowTelemetryEvent | null => {
  if (toStage === "idle") {
    return "opy_flow_reset";
  }

  if (toStage === "completed") {
    return terminalStatus === "cancelled" ? "opy_flow_cancelled" : "opy_flow_completed";
  }

  if (toStage === "failed") {
    return "opy_flow_failed";
  }

  if (fromStage === null || fromStage === "idle" || fromStage === "completed" || fromStage === "failed") {
    return "opy_flow_started";
  }

  return "opy_flow_transitioned";
};

export const emitOpyAgentFlowTelemetry = (payload: {
  readonly activeRequest: OpyAgentFlowTelemetryRequest | null;
  readonly errorSummary: string | null;
  readonly failurePhase: string | null;
  readonly failureStage: string | null;
  readonly fromStage: string | null;
  readonly lastCompletedAt: number | null;
  readonly lastRequest: OpyAgentFlowTelemetryRequest | null;
  readonly terminalStatus: OpyAgentFlowTelemetryPayload["terminalStatus"];
  readonly toStage: string;
}): void => {
  const event = toFlowTelemetryEvent(payload.fromStage, payload.toStage, payload.terminalStatus);
  if (!event) {
    return;
  }

  const request = payload.activeRequest ?? payload.lastRequest;
  const detail = {
    event,
    requestId: request?.id ?? null,
    requestKind: request?.kind ?? null,
    requestLabel: request?.label ?? null,
    requestMode: request?.mode ?? null,
    failurePhase: payload.failurePhase,
    fromStage: payload.fromStage,
    toStage: payload.toStage,
    terminalStatus: payload.terminalStatus,
    failureStage: payload.failureStage,
    errorSummary: payload.errorSummary,
    completedAt: payload.lastCompletedAt,
    timestamp: Date.now(),
  } satisfies OpyAgentFlowTelemetryPayload & { readonly event: OpyAgentFlowTelemetryEvent };

  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(
      new CustomEvent(OPY_AGENT_FLOW_TELEMETRY_EVENT_NAME, {
        detail,
      }),
    );
  }
};

export const getOpyAgentFlowTelemetryEventName = (): string => OPY_AGENT_FLOW_TELEMETRY_EVENT_NAME;
