import { assign, setup } from "xstate";
import type {
  OpyAgentLifecycleFailurePhase,
  OpyAgentLifecycleNonTerminalStage,
  OpyAgentLifecycleRequest,
  OpyAgentLifecycleStatus,
} from "../../core/effects/opy-agent.lifecycle";
import {
  createOpyAgentLifecycleBudgetMessage,
  createOpyAgentLifecycleTimeoutMessage,
  getOpyAgentLifecycleFailurePhaseForStage,
  getOpyAgentLifecycleStageGuardrail,
  isOpyAgentLifecycleRetryAllowed,
} from "../../core/effects/opy-agent.orchestration";

export type {
  OpyAgentLifecycleConfirmation,
  OpyAgentLifecycleFailurePhase,
  OpyAgentLifecycleMode,
  OpyAgentLifecycleNonTerminalStage,
  OpyAgentLifecycleReplay,
  OpyAgentLifecycleRequest,
  OpyAgentLifecycleStage,
  OpyAgentLifecycleStatus,
} from "../../core/effects/opy-agent.lifecycle";

export interface OpyAgentMachineContext {
  readonly activeRequest: OpyAgentLifecycleRequest | null;
  readonly activeStageEnteredAt: number | null;
  readonly lastRequest: OpyAgentLifecycleRequest | null;
  readonly lastError: string | null;
  readonly lastFailurePhase: OpyAgentLifecycleFailurePhase | null;
  readonly lastFailureStage: OpyAgentLifecycleNonTerminalStage | null;
  readonly lastCompletedAt: number | null;
  readonly lastTerminalStatus: OpyAgentLifecycleStatus;
  readonly retryCount: number;
  readonly resumableRequest: OpyAgentLifecycleRequest | null;
  readonly resumableStage: OpyAgentLifecycleNonTerminalStage | null;
  readonly resumableTaskId: string | null;
  readonly resumableUpdatedAt: number | null;
  readonly stageEntryCounts: Readonly<Partial<Record<OpyAgentLifecycleNonTerminalStage, number>>>;
}

export type OpyAgentMachineEvent =
  | { type: "START_READ"; request: OpyAgentLifecycleRequest }
  | { type: "START_ACTION"; request: OpyAgentLifecycleRequest }
  | { type: "CONTEXT_READY" }
  | { type: "RESULT_READY" }
  | { type: "PERSIST_READY" }
  | { type: "CONFIRM" }
  | { type: "VERIFY_READY" }
  | { type: "COMPLETE" }
  | {
    type: "HYDRATE_RESUMABLE";
    request: OpyAgentLifecycleRequest;
    stage: OpyAgentLifecycleNonTerminalStage;
    taskId: string;
    updatedAt: number;
  }
  | {
    type: "FAIL";
    message: string;
    phase?: OpyAgentLifecycleFailurePhase | null;
    stage: OpyAgentLifecycleNonTerminalStage;
  }
  | { type: "CANCEL" }
  | { type: "RESUME" }
  | { type: "DISMISS_RESUMABLE" }
  | { type: "RETRY" }
  | { type: "RESET" };

const toErrorMessage = (value: string): string => value.trim().replace(/\s+/g, " ");

const initialContext: OpyAgentMachineContext = {
  activeRequest: null,
  activeStageEnteredAt: null,
  lastRequest: null,
  lastError: null,
  lastFailurePhase: null,
  lastFailureStage: null,
  lastCompletedAt: null,
  lastTerminalStatus: null,
  retryCount: 0,
  resumableRequest: null,
  resumableStage: null,
  resumableTaskId: null,
  resumableUpdatedAt: null,
  stageEntryCounts: {},
};

const opyAgentMachineSetup = setup({
  types: {
    context: {} as OpyAgentMachineContext,
    events: {} as OpyAgentMachineEvent,
  },
  guards: {
    requestNeedsConfirmation: ({ context }) => context.activeRequest?.requiresConfirmation === true,
    lastRequestNeedsConfirmation: ({ context }) => context.lastRequest?.requiresConfirmation === true,
    lastRequestWasRead: ({ context }) => context.lastRequest?.mode === "read",
    hasRetryableRequest: ({ context }) => context.lastRequest !== null,
    hasResumableRequest: ({ context }) => context.resumableRequest !== null,
    resumableRequestNeedsConfirmation: ({ context }) =>
      context.resumableRequest?.requiresConfirmation === true
      && context.resumableStage === "awaiting_confirmation",
    resumableRequestWasRead: ({ context }) => context.resumableRequest?.mode === "read",
    stageEntryBudgetExceeded: (
      { context },
      params: { readonly stage: OpyAgentLifecycleNonTerminalStage },
    ) => {
      const maxEntries = getOpyAgentLifecycleStageGuardrail(params.stage).maxEntries;
      return (context.stageEntryCounts[params.stage] ?? 0) > maxEntries;
    },
  },
  actions: {
    startRequest: assign(({ event }) => {
      if (event.type !== "START_READ" && event.type !== "START_ACTION") {
        return {};
      }

      return {
        activeRequest: event.request,
        activeStageEnteredAt: null,
        lastRequest: event.request,
        lastError: null,
        lastFailurePhase: null,
        lastFailureStage: null,
        lastCompletedAt: null,
        lastTerminalStatus: null,
        retryCount: 0,
        resumableRequest: null,
        resumableStage: null,
        resumableTaskId: null,
        resumableUpdatedAt: null,
        stageEntryCounts: {},
      };
    }),
    clearFailure: assign(() => ({
      lastError: null,
      lastFailurePhase: null,
      lastFailureStage: null,
      lastTerminalStatus: null,
    })),
    restartLastRequest: assign(({ context }) => ({
      activeRequest: context.lastRequest,
      activeStageEnteredAt: null,
      lastError: null,
      lastFailurePhase: null,
      lastFailureStage: null,
      lastCompletedAt: null,
      lastTerminalStatus: null,
      retryCount: context.retryCount + 1,
    })),
    hydrateResumable: assign(({ event }) => {
      if (event.type !== "HYDRATE_RESUMABLE") {
        return {};
      }

      return {
        resumableRequest: event.request,
        resumableStage: event.stage,
        resumableTaskId: event.taskId,
        resumableUpdatedAt: event.updatedAt,
      };
    }),
    clearResumable: assign(() => ({
      resumableRequest: null,
      resumableStage: null,
      resumableTaskId: null,
      resumableUpdatedAt: null,
    })),
    startResumable: assign(({ context }) => ({
      activeRequest: context.resumableRequest,
      activeStageEnteredAt: null,
      lastRequest: context.resumableRequest,
      lastError: null,
      lastFailurePhase: null,
      lastFailureStage: null,
      lastCompletedAt: null,
      lastTerminalStatus: null,
      retryCount: 0,
      resumableRequest: null,
      resumableStage: null,
      resumableTaskId: null,
      resumableUpdatedAt: null,
      stageEntryCounts: {},
    })),
    recordStageEntry: assign((
      { context },
      params: { readonly stage: OpyAgentLifecycleNonTerminalStage },
    ) => ({
      activeStageEnteredAt: Date.now(),
      stageEntryCounts: {
        ...context.stageEntryCounts,
        [params.stage]: (context.stageEntryCounts[params.stage] ?? 0) + 1,
      },
    })),
    recordCompletion: assign(({ context }) => ({
      activeRequest: null,
      activeStageEnteredAt: null,
      lastRequest: context.activeRequest ?? context.lastRequest,
      lastError: null,
      lastFailurePhase: null,
      lastFailureStage: null,
      lastCompletedAt: Date.now(),
      lastTerminalStatus: "completed" as const,
    })),
    recordCancellation: assign(({ context }) => ({
      activeRequest: null,
      activeStageEnteredAt: null,
      lastRequest: context.activeRequest ?? context.lastRequest,
      lastError: null,
      lastFailurePhase: null,
      lastFailureStage: null,
      lastCompletedAt: Date.now(),
      lastTerminalStatus: "cancelled" as const,
    })),
    recordFailure: assign(({ context, event }) => {
      if (event.type !== "FAIL") {
        return {};
      }

      return {
        activeRequest: null,
        activeStageEnteredAt: null,
        lastRequest: context.activeRequest ?? context.lastRequest,
        lastError: toErrorMessage(event.message),
        lastFailurePhase: event.phase ?? null,
        lastFailureStage: event.stage,
        lastCompletedAt: Date.now(),
        lastTerminalStatus: "failed" as const,
      };
    }),
    recordGuardrailFailure: assign((
      { context },
      params: {
        readonly kind: "budget" | "timeout";
        readonly stage: OpyAgentLifecycleNonTerminalStage;
      },
    ) => {
      const requestLabel = context.activeRequest?.label ?? context.lastRequest?.label ?? "OPY";
      return {
        activeRequest: null,
        activeStageEnteredAt: null,
        lastRequest: context.activeRequest ?? context.lastRequest,
        lastError: params.kind === "timeout"
          ? createOpyAgentLifecycleTimeoutMessage({
            requestLabel,
            stage: params.stage,
          })
          : createOpyAgentLifecycleBudgetMessage({
            requestLabel,
            stage: params.stage,
          }),
        lastFailurePhase: getOpyAgentLifecycleFailurePhaseForStage(params.stage),
        lastFailureStage: params.stage,
        lastCompletedAt: Date.now(),
        lastTerminalStatus: "failed" as const,
      };
    }),
    clearLifecycle: assign(() => initialContext),
  },
});

const createGuardedLifecycleState = (
  stage: OpyAgentLifecycleNonTerminalStage,
  input: {
    readonly on: any;
  },
): any => {
  const timeoutMs = getOpyAgentLifecycleStageGuardrail(stage).timeoutMs;
  return {
    entry: {
      type: "recordStageEntry",
      params: {
        stage,
      },
    },
    always: {
      target: "failed",
      guard: {
        type: "stageEntryBudgetExceeded",
        params: {
          stage,
        },
      },
      actions: {
        type: "recordGuardrailFailure",
        params: {
          kind: "budget",
          stage,
        },
      },
    },
    ...(timeoutMs === null
      ? {}
      : {
        after: {
          [timeoutMs]: {
            target: "failed",
            actions: {
              type: "recordGuardrailFailure",
              params: {
                kind: "timeout" as const,
                stage,
              },
            },
          },
        },
      }),
    on: input.on,
  };
};

export const createOpyAgentMachine = () =>
  opyAgentMachineSetup.createMachine({
    id: "opy-agent",
    initial: "idle",
    context: initialContext,
    states: {
      idle: {
        on: {
          START_READ: {
            target: "contextualizing",
            actions: "startRequest",
          },
          START_ACTION: [
            {
              target: "awaiting_confirmation",
              actions: "startRequest",
              guard: ({ event }) => event.type === "START_ACTION" && event.request.requiresConfirmation,
            },
            {
              target: "applying",
              actions: "startRequest",
            },
          ],
          RESET: {
            actions: "clearLifecycle",
          },
          HYDRATE_RESUMABLE: {
            actions: "hydrateResumable",
          },
          DISMISS_RESUMABLE: {
            actions: "clearResumable",
          },
          RESUME: [
            {
              target: "contextualizing",
              actions: "startResumable",
              guard: "resumableRequestWasRead",
            },
            {
              target: "awaiting_confirmation",
              actions: "startResumable",
              guard: "resumableRequestNeedsConfirmation",
            },
            {
              target: "applying",
              actions: "startResumable",
              guard: "hasResumableRequest",
            },
          ],
        },
      },
      contextualizing: {
        ...createGuardedLifecycleState("contextualizing", {
          on: {
            CONTEXT_READY: {
              target: "planning",
            },
            CANCEL: {
              target: "completed",
              actions: "recordCancellation",
            },
            FAIL: {
              target: "failed",
              actions: "recordFailure",
            },
            RESET: {
              target: "idle",
              actions: "clearLifecycle",
            },
          },
        }),
      },
      planning: {
        ...createGuardedLifecycleState("planning", {
          on: {
            RESULT_READY: {
              target: "proposing",
            },
            CANCEL: {
              target: "completed",
              actions: "recordCancellation",
            },
            FAIL: {
              target: "failed",
              actions: "recordFailure",
            },
            RESET: {
              target: "idle",
              actions: "clearLifecycle",
            },
          },
        }),
      },
      proposing: {
        ...createGuardedLifecycleState("proposing", {
          on: {
            PERSIST_READY: {
              target: "verifying",
            },
            CANCEL: {
              target: "completed",
              actions: "recordCancellation",
            },
            FAIL: {
              target: "failed",
              actions: "recordFailure",
            },
            RESET: {
              target: "idle",
              actions: "clearLifecycle",
            },
          },
        }),
      },
      awaiting_confirmation: {
        ...createGuardedLifecycleState("awaiting_confirmation", {
          on: {
            CONFIRM: {
              target: "applying",
              actions: "clearFailure",
            },
            CANCEL: {
              target: "completed",
              actions: "recordCancellation",
            },
            FAIL: {
              target: "failed",
              actions: "recordFailure",
            },
            RESET: {
              target: "idle",
              actions: "clearLifecycle",
            },
          },
        }),
      },
      applying: {
        ...createGuardedLifecycleState("applying", {
          on: {
            VERIFY_READY: {
              target: "verifying",
            },
            FAIL: {
              target: "failed",
              actions: "recordFailure",
            },
            RESET: {
              target: "idle",
              actions: "clearLifecycle",
            },
          },
        }),
      },
      verifying: {
        ...createGuardedLifecycleState("verifying", {
          on: {
            COMPLETE: {
              target: "completed",
              actions: "recordCompletion",
            },
            FAIL: {
              target: "failed",
              actions: "recordFailure",
            },
            RESET: {
              target: "idle",
              actions: "clearLifecycle",
            },
          },
        }),
      },
      completed: {
        on: {
          START_READ: {
            target: "contextualizing",
            actions: "startRequest",
          },
          START_ACTION: [
            {
              target: "awaiting_confirmation",
              actions: "startRequest",
              guard: ({ event }) => event.type === "START_ACTION" && event.request.requiresConfirmation,
            },
            {
              target: "applying",
              actions: "startRequest",
            },
          ],
          RETRY: [
            {
              target: "contextualizing",
              actions: "restartLastRequest",
              guard: ({ context }) =>
                context.lastRequest?.mode === "read" && isOpyAgentLifecycleRetryAllowed(context.retryCount),
            },
            {
              target: "awaiting_confirmation",
              actions: "restartLastRequest",
              guard: ({ context }) =>
                context.lastRequest?.requiresConfirmation === true
                && isOpyAgentLifecycleRetryAllowed(context.retryCount),
            },
            {
              target: "applying",
              actions: "restartLastRequest",
              guard: ({ context }) =>
                context.lastRequest !== null && isOpyAgentLifecycleRetryAllowed(context.retryCount),
            },
          ],
          RESET: {
            target: "idle",
            actions: "clearLifecycle",
          },
          HYDRATE_RESUMABLE: {
            actions: "hydrateResumable",
          },
          DISMISS_RESUMABLE: {
            actions: "clearResumable",
          },
          RESUME: [
            {
              target: "contextualizing",
              actions: "startResumable",
              guard: "resumableRequestWasRead",
            },
            {
              target: "awaiting_confirmation",
              actions: "startResumable",
              guard: "resumableRequestNeedsConfirmation",
            },
            {
              target: "applying",
              actions: "startResumable",
              guard: "hasResumableRequest",
            },
          ],
        },
      },
      failed: {
        on: {
          START_READ: {
            target: "contextualizing",
            actions: "startRequest",
          },
          START_ACTION: [
            {
              target: "awaiting_confirmation",
              actions: "startRequest",
              guard: ({ event }) => event.type === "START_ACTION" && event.request.requiresConfirmation,
            },
            {
              target: "applying",
              actions: "startRequest",
            },
          ],
          RETRY: [
            {
              target: "contextualizing",
              actions: "restartLastRequest",
              guard: ({ context }) =>
                context.lastRequest?.mode === "read" && isOpyAgentLifecycleRetryAllowed(context.retryCount),
            },
            {
              target: "awaiting_confirmation",
              actions: "restartLastRequest",
              guard: ({ context }) =>
                context.lastRequest?.requiresConfirmation === true
                && isOpyAgentLifecycleRetryAllowed(context.retryCount),
            },
            {
              target: "applying",
              actions: "restartLastRequest",
              guard: ({ context }) =>
                context.lastRequest !== null && isOpyAgentLifecycleRetryAllowed(context.retryCount),
            },
          ],
          RESET: {
            target: "idle",
            actions: "clearLifecycle",
          },
          HYDRATE_RESUMABLE: {
            actions: "hydrateResumable",
          },
          DISMISS_RESUMABLE: {
            actions: "clearResumable",
          },
          RESUME: [
            {
              target: "contextualizing",
              actions: "startResumable",
              guard: "resumableRequestWasRead",
            },
            {
              target: "awaiting_confirmation",
              actions: "startResumable",
              guard: "resumableRequestNeedsConfirmation",
            },
            {
              target: "applying",
              actions: "startResumable",
              guard: "hasResumableRequest",
            },
          ],
        },
      },
    },
  });
