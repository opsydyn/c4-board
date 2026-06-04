import { assign, setup } from "xstate";

export type OpyAgentLifecycleStage =
  | "idle"
  | "planning"
  | "contextualizing"
  | "proposing"
  | "awaiting_confirmation"
  | "applying"
  | "verifying"
  | "completed"
  | "failed";

export type OpyAgentLifecycleMode = "read" | "action";
export type OpyAgentLifecycleStatus = "completed" | "cancelled" | "failed" | null;

export interface OpyAgentLifecycleConfirmation {
  readonly cancelMessage: string;
  readonly confirmationLines: ReadonlyArray<string>;
  readonly failurePrefix: string;
  readonly sessionId: string;
}

export type OpyAgentLifecycleReplay =
  | {
    readonly kind: "chat";
    readonly prompt: string;
    readonly sessionId: string;
  }
  | {
    readonly description: string;
    readonly kind: "proposal";
    readonly sessionId: string;
  }
  | {
    readonly focus: string | null;
    readonly kind: "review";
    readonly sessionId: string;
  }
  | {
    readonly kind: "add-node";
    readonly label: string;
    readonly nodeType: "person" | "system" | "externalSystem" | "container" | "component";
    readonly sessionId: string;
  }
  | {
    readonly kind: "apply-proposal";
    readonly proposalRespondedAtMs: number;
    readonly sessionId: string;
  }
  | {
    readonly checkpointId: string;
    readonly kind: "rollback";
    readonly sessionId: string;
  };

export interface OpyAgentLifecycleRequest {
  readonly confirmation: OpyAgentLifecycleConfirmation | null;
  readonly id: string;
  readonly mode: OpyAgentLifecycleMode;
  readonly kind: "chat" | "review" | "proposal" | "add-node" | "apply-proposal" | "rollback";
  readonly label: string;
  readonly requiresConfirmation: boolean;
  readonly replay: OpyAgentLifecycleReplay;
}

export interface OpyAgentMachineContext {
  readonly activeRequest: OpyAgentLifecycleRequest | null;
  readonly lastRequest: OpyAgentLifecycleRequest | null;
  readonly lastError: string | null;
  readonly lastFailureStage: Exclude<OpyAgentLifecycleStage, "idle" | "completed" | "failed"> | null;
  readonly lastCompletedAt: number | null;
  readonly lastTerminalStatus: OpyAgentLifecycleStatus;
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
    type: "FAIL";
    message: string;
    stage: Exclude<OpyAgentLifecycleStage, "idle" | "completed" | "failed">;
  }
  | { type: "CANCEL" }
  | { type: "RETRY" }
  | { type: "RESET" };

const toErrorMessage = (value: string): string => value.trim().replace(/\s+/g, " ");

const initialContext: OpyAgentMachineContext = {
  activeRequest: null,
  lastRequest: null,
  lastError: null,
  lastFailureStage: null,
  lastCompletedAt: null,
  lastTerminalStatus: null,
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
        lastFailureStage: null,
        lastCompletedAt: null,
        lastTerminalStatus: null,
      };
    }),
    clearFailure: assign(() => ({
      lastError: null,
      lastFailureStage: null,
      lastTerminalStatus: null,
    })),
    recordCompletion: assign(({ context }) => ({
      activeRequest: null,
      lastRequest: context.activeRequest ?? context.lastRequest,
      lastError: null,
      lastFailureStage: null,
      lastCompletedAt: Date.now(),
      lastTerminalStatus: "completed" as const,
    })),
    recordCancellation: assign(({ context }) => ({
      activeRequest: null,
      lastRequest: context.activeRequest ?? context.lastRequest,
      lastError: null,
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
        },
      },
    },
  });
