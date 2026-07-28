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
      usage: null,
    }, {
      provider: "openai",
      model: "gpt-4o-mini",
      maxTokenBudget: 1024,
      actionMode: "propose",
      rolloutMode: "canary",
      rolloutBaseMode: "canary",
      rolloutSource: "settings",
      anomalySeverity: "caution",
      anomalyBlocked: false,
      anomalyScore: 2,
    });

    expect(detail).toMatchObject({
      event: "opy_run_completed",
      runId: "run-1",
      status: "completed",
      durationMs: 150,
      provider: "openai",
      model: "gpt-4o-mini",
      actionMode: "propose",
      anomalySeverity: "caution",
      anomalyBlocked: false,
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
        requiresConfirmation: false,
      },
      errorSummary: null,
      failurePhase: null,
      failureStage: null,
      fromStage: "idle",
      lastCompletedAt: null,
      lastRequest: null,
      telemetryContext: {
        provider: "openai",
        model: "gpt-4o-mini",
        maxTokenBudget: 4096,
        actionMode: "read-only",
        rolloutMode: "enabled",
        rolloutBaseMode: "enabled",
        rolloutSource: "env",
        anomalySeverity: "none",
        anomalyBlocked: false,
        anomalyScore: 0,
      },
      terminalStatus: null,
      toStage: "contextualizing",
    });

    expect(detail).toMatchObject({
      event: "opy_flow_started",
      requestId: "request-1",
      requestKind: "review",
      requestMode: "read",
      requiresConfirmation: false,
      fromStage: "idle",
      toStage: "contextualizing",
      provider: "openai",
      model: "gpt-4o-mini",
      actionMode: "read-only",
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
      failurePhase: null,
      failureStage: null,
      fromStage: "awaiting_confirmation",
      lastCompletedAt: 500,
      lastRequest: {
        id: "request-2",
        kind: "apply-proposal",
        label: "APPLY",
        mode: "action",
        requiresConfirmation: true,
      },
      terminalStatus: "cancelled",
      toStage: "completed",
    });

    expect(detail).toMatchObject({
      event: "opy_flow_cancelled",
      requestId: "request-2",
      requiresConfirmation: true,
      terminalStatus: "cancelled",
      completedAt: 500,
      toStage: "completed",
    });
  });

  test("emits failure provenance for action persist failures", () => {
    let detail: Record<string, unknown> | null = null;
    const handleEvent = (event: Event) => {
      detail = (event as CustomEvent<Record<string, unknown>>).detail;
    };

    window.addEventListener(getOpyAgentFlowTelemetryEventName(), handleEvent, { once: true });

    emitOpyAgentFlowTelemetry({
      activeRequest: null,
      errorSummary: "ACTION RESULT PERSIST FAILED: MESSAGE SAVE FAILED: database locked",
      failurePhase: "persist",
      failureStage: "verifying",
      fromStage: "verifying",
      lastCompletedAt: 700,
      lastRequest: {
        id: "request-3",
        kind: "apply-proposal",
        label: "APPLY",
        mode: "action",
        requiresConfirmation: true,
      },
      terminalStatus: "failed",
      toStage: "failed",
    });

    expect(detail).toMatchObject({
      event: "opy_flow_failed",
      requestId: "request-3",
      failurePhase: "persist",
      failureStage: "verifying",
      terminalStatus: "failed",
    });
  });

  test("emits failure provenance for read invoke failures", () => {
    let detail: Record<string, unknown> | null = null;
    const handleEvent = (event: Event) => {
      detail = (event as CustomEvent<Record<string, unknown>>).detail;
    };

    window.addEventListener(getOpyAgentFlowTelemetryEventName(), handleEvent, { once: true });

    emitOpyAgentFlowTelemetry({
      activeRequest: null,
      errorSummary: "Planner offline while contextualizing board evidence",
      failurePhase: "invoke",
      failureStage: "planning",
      fromStage: "planning",
      lastCompletedAt: 810,
      lastRequest: {
        id: "request-4",
        kind: "review",
        label: "REVIEW",
        mode: "read",
        requiresConfirmation: false,
      },
      terminalStatus: "failed",
      toStage: "failed",
    });

    expect(detail).toMatchObject({
      event: "opy_flow_failed",
      requestId: "request-4",
      failurePhase: "invoke",
      failureStage: "planning",
      terminalStatus: "failed",
    });
  });
});
