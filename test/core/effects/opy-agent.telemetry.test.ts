import { describe, expect, test } from "vitest";
import {
  emitOpyAgentFlowTelemetry,
  emitOpyAgentRunTelemetry,
  getOpyAgentFlowTelemetryEventName,
  getOpyAgentRunTelemetryEventName,
} from "../../../src/core/effects/opy-agent.telemetry";

describe("opy-agent.telemetry", () => {
  test("emits terminal run telemetry for completed runs", () => {
    let detail: Record<string, unknown> | null = null;
    const handleEvent = (event: Event) => {
      detail = (event as CustomEvent<Record<string, unknown>>).detail;
    };

    window.addEventListener(getOpyAgentRunTelemetryEventName(), handleEvent, { once: true });

    emitOpyAgentRunTelemetry({
      id: "run-1",
      sessionId: "session-1",
      agent: "opy-net",
      intent: "chat",
      stage: "complete",
      status: "completed",
      startedAt: 100,
      completedAt: 250,
      errorSummary: null,
    });

    expect(detail).toMatchObject({
      event: "opy_run_completed",
      runId: "run-1",
      status: "completed",
      durationMs: 150,
    });
  });

  test("emits flow start telemetry when a lifecycle leaves idle", () => {
    let detail: Record<string, unknown> | null = null;
    const handleEvent = (event: Event) => {
      detail = (event as CustomEvent<Record<string, unknown>>).detail;
    };

    window.addEventListener(getOpyAgentFlowTelemetryEventName(), handleEvent, { once: true });

    emitOpyAgentFlowTelemetry({
      activeRequest: {
        id: "request-1",
        kind: "review",
        label: "REVIEW",
        mode: "read",
      },
      errorSummary: null,
      failureStage: null,
      fromStage: "idle",
      lastCompletedAt: null,
      lastRequest: null,
      terminalStatus: null,
      toStage: "contextualizing",
    });

    expect(detail).toMatchObject({
      event: "opy_flow_started",
      requestId: "request-1",
      requestKind: "review",
      requestMode: "read",
      fromStage: "idle",
      toStage: "contextualizing",
    });
  });

  test("emits flow cancellation telemetry when a confirmation flow is cancelled", () => {
    let detail: Record<string, unknown> | null = null;
    const handleEvent = (event: Event) => {
      detail = (event as CustomEvent<Record<string, unknown>>).detail;
    };

    window.addEventListener(getOpyAgentFlowTelemetryEventName(), handleEvent, { once: true });

    emitOpyAgentFlowTelemetry({
      activeRequest: null,
      errorSummary: null,
      failureStage: null,
      fromStage: "awaiting_confirmation",
      lastCompletedAt: 500,
      lastRequest: {
        id: "request-2",
        kind: "apply-proposal",
        label: "APPLY",
        mode: "action",
      },
      terminalStatus: "cancelled",
      toStage: "completed",
    });

    expect(detail).toMatchObject({
      event: "opy_flow_cancelled",
      requestId: "request-2",
      terminalStatus: "cancelled",
      completedAt: 500,
      toStage: "completed",
    });
  });
});
