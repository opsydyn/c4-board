import { useMachine } from "@xstate/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { emitOpyAgentFlowTelemetry } from "../../core/effects/opy-agent.telemetry";
import {
  createOpyAgentMachine,
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
  readonly canRetry: boolean;
  readonly isBusy: boolean;
  readonly lastCompletedAt: number | null;
  readonly lastError: string | null;
  readonly lastFailureStage: Exclude<OpyAgentLifecycleStage, "idle" | "completed" | "failed"> | null;
  readonly lastRequest: OpyAgentLifecycleRequest | null;
  readonly lastTerminalStatus: "completed" | "cancelled" | "failed" | null;
  readonly stage: OpyAgentLifecycleStage;
  readonly cancelActiveRequest: () => void;
  readonly completeActiveRequest: () => void;
  readonly failActiveRequest: (message: string, stage?: Exclude<OpyAgentLifecycleStage, "idle" | "completed" | "failed">) => void;
  readonly markContextReady: () => void;
  readonly markPersistReady: () => void;
  readonly markResultReady: () => void;
  readonly markVerifyReady: () => void;
  readonly resetLifecycle: () => void;
  readonly retryLastRequest: () => void;
  readonly startActionRequest: (request: OpyAgentLifecycleRequest) => void;
  readonly startReadRequest: (request: OpyAgentLifecycleRequest) => void;
  readonly confirmActiveRequest: () => void;
}

export const useOpyAgentMachine = (): UseOpyAgentMachineResult => {
  const machine = useMemo(() => createOpyAgentMachine(), []);
  const [snapshot, send] = useMachine(machine);
  const sendRef = useRef(send);
  sendRef.current = send;

  const stage = snapshot.value as OpyAgentLifecycleStage;
  const activeRequest = snapshot.context.activeRequest;
  const isBusy = !NON_BUSY_STAGES.has(stage);
  const canRetry = snapshot.context.lastRequest !== null && (stage === "completed" || stage === "failed");
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
      emitOpyAgentFlowTelemetry({
        activeRequest: snapshot.context.activeRequest,
        errorSummary: snapshot.context.lastError,
        failureStage: snapshot.context.lastFailureStage,
        fromStage: previousState.stage,
        lastCompletedAt: snapshot.context.lastCompletedAt,
        lastRequest: snapshot.context.lastRequest,
        terminalStatus: snapshot.context.lastTerminalStatus,
        toStage: stage,
      });
    }

    telemetryStateRef.current = nextState;
  }, [
    snapshot.context.activeRequest,
    snapshot.context.lastCompletedAt,
    snapshot.context.lastError,
    snapshot.context.lastFailureStage,
    snapshot.context.lastRequest,
    snapshot.context.lastTerminalStatus,
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
      failureStage: Exclude<OpyAgentLifecycleStage, "idle" | "completed" | "failed"> = (
        snapshot.value as Exclude<OpyAgentLifecycleStage, "idle" | "completed" | "failed">
      ),
    ) => {
      sendRef.current({
        type: "FAIL",
        message,
        stage: failureStage,
      });
    },
    [snapshot.value],
  );

  const retryLastRequest = useCallback(() => {
    sendRef.current({ type: "RETRY" });
  }, []);

  const resetLifecycle = useCallback(() => {
    sendRef.current({ type: "RESET" });
  }, []);

  return {
    activeRequest,
    canRetry,
    isBusy,
    lastCompletedAt: snapshot.context.lastCompletedAt,
    lastError: snapshot.context.lastError,
    lastFailureStage: snapshot.context.lastFailureStage,
    lastRequest: snapshot.context.lastRequest,
    lastTerminalStatus: snapshot.context.lastTerminalStatus,
    stage,
    cancelActiveRequest,
    completeActiveRequest,
    failActiveRequest,
    markContextReady,
    markPersistReady,
    markResultReady,
    markVerifyReady,
    resetLifecycle,
    retryLastRequest,
    startActionRequest,
    startReadRequest,
    confirmActiveRequest,
  };
};
