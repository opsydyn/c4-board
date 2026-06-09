import { useMachine } from "@xstate/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { OpyAgentLifecycleNonTerminalStage } from "../../core/effects/opy-agent.lifecycle";
import {
  getOpyAgentLifecycleRemainingRetries,
  getOpyAgentLifecycleRetryBudget,
  getOpyAgentLifecycleStageGuardrail,
} from "../../core/effects/opy-agent.orchestration";
import { emitOpyAgentFlowTelemetry, type OpyAgentTelemetryContext } from "../../core/effects/opy-agent.telemetry";
import {
  createOpyAgentMachine,
  type OpyAgentLifecycleFailurePhase,
  type OpyAgentLifecycleRequest,
  type OpyAgentLifecycleStage,
} from "../machines/opy-agent.machine";

const NON_BUSY_STAGES: ReadonlySet<OpyAgentLifecycleStage> = new Set([
  "idle",
  "completed",
  "failed",
]);

export interface UseOpyAgentMachineResult {
  readonly activeRequest: OpyAgentLifecycleRequest | null;
  readonly activeStageDeadlineAt: number | null;
  readonly activeStageEnteredAt: number | null;
  readonly activeStageEntryBudget: number | null;
  readonly activeStageEntryCount: number | null;
  readonly activeStageTimeoutMs: number | null;
  readonly canRetry: boolean;
  readonly isBusy: boolean;
  readonly lastCompletedAt: number | null;
  readonly lastError: string | null;
  readonly lastFailurePhase: OpyAgentLifecycleFailurePhase | null;
  readonly lastFailureStage: OpyAgentLifecycleNonTerminalStage | null;
  readonly lastRequest: OpyAgentLifecycleRequest | null;
  readonly lastTerminalStatus: "completed" | "cancelled" | "failed" | null;
  readonly pendingConfirmationRequest: OpyAgentLifecycleRequest | null;
  readonly remainingRetryAttempts: number;
  readonly retryAttemptBudget: number;
  readonly retryCount: number;
  readonly resumableRequest: OpyAgentLifecycleRequest | null;
  readonly resumableStage: OpyAgentLifecycleNonTerminalStage | null;
  readonly resumableTaskId: string | null;
  readonly resumableUpdatedAt: number | null;
  readonly stage: OpyAgentLifecycleStage;
  readonly cancelActiveRequest: () => void;
  readonly clearResumableRequest: () => void;
  readonly completeActiveRequest: () => void;
  readonly failActiveRequest: (
    message: string,
    stage?: OpyAgentLifecycleNonTerminalStage,
    phase?: OpyAgentLifecycleFailurePhase | null,
  ) => void;
  readonly hydrateResumableRequest: (input: {
    request: OpyAgentLifecycleRequest;
    stage: OpyAgentLifecycleNonTerminalStage;
    taskId: string;
    updatedAt: number;
  }) => void;
  readonly markContextReady: () => void;
  readonly markPersistReady: () => void;
  readonly markResultReady: () => void;
  readonly markVerifyReady: () => void;
  readonly resetLifecycle: () => void;
  readonly resumeResumableRequest: () => void;
  readonly retryLastRequest: () => void;
  readonly startActionRequest: (request: OpyAgentLifecycleRequest) => void;
  readonly startReadRequest: (request: OpyAgentLifecycleRequest) => void;
  readonly confirmActiveRequest: () => void;
}

interface UseOpyAgentMachineOptions {
  readonly getTelemetryContext?: (
    request: OpyAgentLifecycleRequest | null,
  ) => Omit<OpyAgentTelemetryContext, "requiresConfirmation">;
}

export const useOpyAgentMachine = (
  input?: UseOpyAgentMachineOptions,
): UseOpyAgentMachineResult => {
  const machine = useMemo(() => createOpyAgentMachine(), []);
  const [snapshot, send] = useMachine(machine);
  const sendRef = useRef(send);
  sendRef.current = send;
  const getTelemetryContext = input?.getTelemetryContext;

  const stage = snapshot.value as OpyAgentLifecycleStage;
  const activeRequest = snapshot.context.activeRequest;
  const pendingConfirmationRequest = stage === "awaiting_confirmation"
    ? activeRequest?.confirmation
      ? activeRequest
      : null
    : null;
  const resumableRequest = snapshot.context.resumableRequest;
  const isBusy = !NON_BUSY_STAGES.has(stage);
  const activeStageGuardrail = stage !== "idle" && stage !== "completed" && stage !== "failed"
    ? getOpyAgentLifecycleStageGuardrail(stage)
    : null;
  const activeStageEnteredAt = snapshot.context.activeStageEnteredAt;
  const activeStageTimeoutMs = activeStageGuardrail?.timeoutMs ?? null;
  const activeStageDeadlineAt = activeStageEnteredAt !== null && activeStageTimeoutMs !== null
    ? activeStageEnteredAt + activeStageTimeoutMs
    : null;
  const activeStageEntryCount = activeStageGuardrail
    ? (snapshot.context.stageEntryCounts[stage as OpyAgentLifecycleNonTerminalStage] ?? 0)
    : null;
  const activeStageEntryBudget = activeStageGuardrail?.maxEntries ?? null;
  const retryAttemptBudget = getOpyAgentLifecycleRetryBudget();
  const remainingRetryAttempts = getOpyAgentLifecycleRemainingRetries(snapshot.context.retryCount);
  const canRetry = snapshot.context.lastRequest !== null
    && (stage === "completed" || stage === "failed")
    && remainingRetryAttempts > 0;
  const telemetryStateRef = useRef({
    errorSummary: snapshot.context.lastError,
    lastCompletedAt: snapshot.context.lastCompletedAt,
    lastRequestId: snapshot.context.lastRequest?.id ?? null,
    requestId: snapshot.context.activeRequest?.id ?? null,
    stage,
    terminalStatus: snapshot.context.lastTerminalStatus,
  });

  useEffect(() => {
    const previousState = telemetryStateRef.current;
    const nextState = {
      errorSummary: snapshot.context.lastError,
      lastCompletedAt: snapshot.context.lastCompletedAt,
      lastRequestId: snapshot.context.lastRequest?.id ?? null,
      requestId: snapshot.context.activeRequest?.id ?? null,
      stage,
      terminalStatus: snapshot.context.lastTerminalStatus,
    };

    const stageChanged = previousState.stage !== nextState.stage;
    const requestChanged = previousState.requestId !== nextState.requestId
      || previousState.lastRequestId !== nextState.lastRequestId;
    const terminalChanged = previousState.lastCompletedAt !== nextState.lastCompletedAt
      || previousState.terminalStatus !== nextState.terminalStatus
      || previousState.errorSummary !== nextState.errorSummary;

    if (stageChanged || requestChanged || terminalChanged) {
      const request = snapshot.context.activeRequest ?? snapshot.context.lastRequest;
      const telemetryContext = getTelemetryContext?.(request ?? null);
      emitOpyAgentFlowTelemetry({
        activeRequest: snapshot.context.activeRequest,
        errorSummary: snapshot.context.lastError,
        failurePhase: snapshot.context.lastFailurePhase,
        failureStage: snapshot.context.lastFailureStage,
        fromStage: previousState.stage,
        lastCompletedAt: snapshot.context.lastCompletedAt,
        lastRequest: snapshot.context.lastRequest,
        ...(telemetryContext ? { telemetryContext } : {}),
        terminalStatus: snapshot.context.lastTerminalStatus,
        toStage: stage,
      });
    }

    telemetryStateRef.current = nextState;
  }, [
    snapshot.context.activeRequest,
    snapshot.context.lastCompletedAt,
    snapshot.context.lastError,
    snapshot.context.lastFailurePhase,
    snapshot.context.lastFailureStage,
    snapshot.context.lastRequest,
    snapshot.context.lastTerminalStatus,
    getTelemetryContext,
    stage,
  ]);

  const startReadRequest = useCallback((request: OpyAgentLifecycleRequest) => {
    sendRef.current({ type: "START_READ", request });
  }, []);

  const startActionRequest = useCallback((request: OpyAgentLifecycleRequest) => {
    sendRef.current({ type: "START_ACTION", request });
  }, []);

  const markContextReady = useCallback(() => {
    sendRef.current({ type: "CONTEXT_READY" });
  }, []);

  const markResultReady = useCallback(() => {
    sendRef.current({ type: "RESULT_READY" });
  }, []);

  const markPersistReady = useCallback(() => {
    sendRef.current({ type: "PERSIST_READY" });
  }, []);

  const confirmActiveRequest = useCallback(() => {
    sendRef.current({ type: "CONFIRM" });
  }, []);

  const markVerifyReady = useCallback(() => {
    sendRef.current({ type: "VERIFY_READY" });
  }, []);

  const completeActiveRequest = useCallback(() => {
    sendRef.current({ type: "COMPLETE" });
  }, []);

  const cancelActiveRequest = useCallback(() => {
    sendRef.current({ type: "CANCEL" });
  }, []);

  const failActiveRequest = useCallback(
    (
      message: string,
      failureStage: OpyAgentLifecycleNonTerminalStage = (
        snapshot.value as OpyAgentLifecycleNonTerminalStage
      ),
      failurePhase: OpyAgentLifecycleFailurePhase | null = null,
    ) => {
      sendRef.current({
        type: "FAIL",
        message,
        phase: failurePhase,
        stage: failureStage,
      });
    },
    [snapshot.value],
  );

  const hydrateResumableRequest = useCallback((input: {
    request: OpyAgentLifecycleRequest;
    stage: OpyAgentLifecycleNonTerminalStage;
    taskId: string;
    updatedAt: number;
  }) => {
    sendRef.current({
      type: "HYDRATE_RESUMABLE",
      request: input.request,
      stage: input.stage,
      taskId: input.taskId,
      updatedAt: input.updatedAt,
    });
  }, []);

  const resumeResumableRequest = useCallback(() => {
    sendRef.current({ type: "RESUME" });
  }, []);

  const clearResumableRequest = useCallback(() => {
    sendRef.current({ type: "DISMISS_RESUMABLE" });
  }, []);

  const retryLastRequest = useCallback(() => {
    sendRef.current({ type: "RETRY" });
  }, []);

  const resetLifecycle = useCallback(() => {
    sendRef.current({ type: "RESET" });
  }, []);

  return {
    activeRequest,
    activeStageDeadlineAt,
    activeStageEnteredAt,
    activeStageEntryBudget,
    activeStageEntryCount,
    activeStageTimeoutMs,
    canRetry,
    isBusy,
    lastCompletedAt: snapshot.context.lastCompletedAt,
    lastError: snapshot.context.lastError,
    lastFailurePhase: snapshot.context.lastFailurePhase,
    lastFailureStage: snapshot.context.lastFailureStage,
    lastRequest: snapshot.context.lastRequest,
    lastTerminalStatus: snapshot.context.lastTerminalStatus,
    pendingConfirmationRequest,
    remainingRetryAttempts,
    retryAttemptBudget,
    retryCount: snapshot.context.retryCount,
    resumableRequest,
    resumableStage: snapshot.context.resumableStage,
    resumableTaskId: snapshot.context.resumableTaskId,
    resumableUpdatedAt: snapshot.context.resumableUpdatedAt,
    stage,
    cancelActiveRequest,
    clearResumableRequest,
    completeActiveRequest,
    failActiveRequest,
    hydrateResumableRequest,
    markContextReady,
    markPersistReady,
    markResultReady,
    markVerifyReady,
    resetLifecycle,
    resumeResumableRequest,
    retryLastRequest,
    startActionRequest,
    startReadRequest,
    confirmActiveRequest,
  };
};
