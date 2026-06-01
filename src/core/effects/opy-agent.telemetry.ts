import type { OpyAgentRun } from "./opy-chat.persistence";

export type OpyAgentRunTelemetryEvent =
  | "opy_run_completed"
  | "opy_run_failed"
  | "opy_run_cancelled";

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

const OPY_AGENT_RUN_TELEMETRY_EVENT_NAME = "opsydyn:opy_run:metric";

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
