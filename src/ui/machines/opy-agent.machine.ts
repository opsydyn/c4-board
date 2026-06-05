import { assign, setup } from "xstate";
import type {
  OpyAgentLifecycleFailurePhase,
  OpyAgentLifecycleNonTerminalStage,
  OpyAgentLifecycleRequest,
  OpyAgentLifecycleStatus,
} from "../../core/effects/opy-agent.lifecycle";

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
  readonly lastRequest: OpyAgentLifecycleRequest | null;
  readonly lastError: string | null;
  readonly lastFailurePhase: OpyAgentLifecycleFailurePhase | null;
  readonly lastFailureStage: OpyAgentLifecycleNonTerminalStage | null;
  readonly lastCompletedAt: number | null;
  readonly lastTerminalStatus: OpyAgentLifecycleStatus;
  readonly resumableRequest: OpyAgentLifecycleRequest | null;
  readonly resumableStage: OpyAgentLifecycleNonTerminalStage | null;
  readonly resumableTaskId: string | null;
  readonly resumableUpdatedAt: number | null;
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
  lastRequest: null,
  lastError: null,
  lastFailurePhase: null,
  lastFailureStage: null,
  lastCompletedAt: null,
  lastTerminalStatus: null,
  resumableRequest: null,
  resumableStage: null,
  resumableTaskId: null,
  resumableUpdatedAt: null,
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
  },
  actions: {
    startRequest: assign(({ event }) => {
      if (event.type !== "START_READ" && event.type !== "START_ACTION") {
        return {};
      }

      return {
        activeRequest: event.request,
        lastRequest: event.request,
        lastError: null,
        lastFailurePhase: null,
        lastFailureStage: null,
        lastCompletedAt: null,
        lastTerminalStatus: null,
        resumableRequest: null,
        resumableStage: null,
        resumableTaskId: null,
        resumableUpdatedAt: null,
      };
    }),
    clearFailure: assign(() => ({
      lastError: null,
      lastFailurePhase: null,
      lastFailureStage: null,
      lastTerminalStatus: null,
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
      lastRequest: context.resumableRequest,
      lastError: null,
      lastFailurePhase: null,
      lastFailureStage: null,
      lastCompletedAt: null,
      lastTerminalStatus: null,
      resumableRequest: null,
      resumableStage: null,
      resumableTaskId: null,
      resumableUpdatedAt: null,
    })),
    recordCompletion: assign(({ context }) => ({
      activeRequest: null,
      lastRequest: context.activeRequest ?? context.lastRequest,
      lastError: null,
      lastFailurePhase: null,
      lastFailureStage: null,
      lastCompletedAt: Date.now(),
      lastTerminalStatus: "completed" as const,
    })),
    recordCancellation: assign(({ context }) => ({
      activeRequest: null,
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
        lastRequest: context.activeRequest ?? context.lastRequest,
        lastError: toErrorMessage(event.message),
        lastFailurePhase: event.phase ?? null,
        lastFailureStage: event.stage,
        lastCompletedAt: Date.now(),
        lastTerminalStatus: "failed" as const,
      };
    }),
    clearLifecycle: assign(() => initialContext),
  },
});

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
        on: {
          CONTEXT_READY: {
            target: "planning",
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
      },
      planning: {
        on: {
          RESULT_READY: {
            target: "proposing",
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
      },
      proposing: {
        on: {
          PERSIST_READY: {
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
      },
      awaiting_confirmation: {
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
      },
      applying: {
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
      },
      verifying: {
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
              actions: "clearFailure",
              guard: "lastRequestWasRead",
            },
            {
              target: "awaiting_confirmation",
              actions: "clearFailure",
              guard: "lastRequestNeedsConfirmation",
            },
            {
              target: "applying",
              actions: "clearFailure",
              guard: "hasRetryableRequest",
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
              actions: "clearFailure",
              guard: "lastRequestWasRead",
            },
            {
              target: "awaiting_confirmation",
              actions: "clearFailure",
              guard: "lastRequestNeedsConfirmation",
            },
            {
              target: "applying",
              actions: "clearFailure",
              guard: "hasRetryableRequest",
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
