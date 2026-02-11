import { assign, fromCallback, setup } from "xstate";

export type C4Command =
  | "save"
  | "new-board"
  | "add-person"
  | "add-system"
  | "add-external"
  | "add-container"
  | "add-component"
  | "auto-layout"
  | "auto-layout-selected";

type RegisterBindings = (
  onCommand: (command: C4Command) => void,
) => void | (() => void);

type RegisterAsyncBindings = (
  onCommand: (command: C4Command) => void,
) => void | (() => void) | Promise<void | (() => void)>;

export interface C4CommandsMachineInput {
  runCommand: (command: C4Command) => void | Promise<void>;
  registerKeyboardBindings?: RegisterBindings;
  registerMenuBindings?: RegisterAsyncBindings;
  getQueryAction?: () => string | null;
  clearQueryAction?: () => void;
}

interface KeyboardBindingsActorInput {
  registerKeyboardBindings?: RegisterBindings;
}

interface MenuBindingsActorInput {
  registerMenuBindings?: RegisterAsyncBindings;
}

interface QueryActionActorInput {
  getQueryAction?: () => string | null;
  clearQueryAction?: () => void;
}

export interface C4CommandsMachineContext {
  lastCommand: C4Command | null;
  errorMessage: string | null;
}

type C4CommandsMachineEvent =
  | { type: "EXECUTE"; command: C4Command }
  | { type: "REGISTRATION_ERROR"; source: "keyboard" | "menu"; error: unknown }
  | { type: "UNKNOWN_QUERY_ACTION"; action: string };

const queryActionToCommand: Record<string, C4Command | undefined> = {
  "new-board": "new-board",
  save: "save",
  "add-person": "add-person",
  "add-system": "add-system",
  "add-external": "add-external",
};

const toErrorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);

const commandsMachineSetup = setup({
  types: {
    context: {} as C4CommandsMachineContext,
    events: {} as C4CommandsMachineEvent,
  },
  actors: {
    keyboardBindings: fromCallback<C4CommandsMachineEvent, KeyboardBindingsActorInput>(
      ({ sendBack, input }) => {
        if (!input.registerKeyboardBindings) {
          return;
        }

        let dispose: void | (() => void);
        try {
          dispose = input.registerKeyboardBindings((command) => {
            sendBack({ type: "EXECUTE", command });
          });
        } catch (error) {
          sendBack({
            type: "REGISTRATION_ERROR",
            source: "keyboard",
            error,
          });
        }

        return () => {
          dispose?.();
        };
      },
    ),
    menuBindings: fromCallback<C4CommandsMachineEvent, MenuBindingsActorInput>(
      ({ sendBack, input }) => {
        if (!input.registerMenuBindings) {
          return;
        }

        let isMounted = true;
        let dispose: void | (() => void);

        void Promise.resolve(
          input.registerMenuBindings((command) => {
            sendBack({ type: "EXECUTE", command });
          }),
        )
          .then((cleanup) => {
            if (!isMounted) {
              cleanup?.();
              return;
            }
            dispose = cleanup;
          })
          .catch((error) => {
            sendBack({
              type: "REGISTRATION_ERROR",
              source: "menu",
              error,
            });
          });

        return () => {
          isMounted = false;
          dispose?.();
        };
      },
    ),
    queryAction: fromCallback<C4CommandsMachineEvent, QueryActionActorInput>(
      ({ sendBack, input }) => {
        const action = input.getQueryAction?.();
        if (!action) {
          return;
        }

        const mapped = queryActionToCommand[action];
        if (mapped) {
          sendBack({
            type: "EXECUTE",
            command: mapped,
          });
        } else {
          sendBack({
            type: "UNKNOWN_QUERY_ACTION",
            action,
          });
        }

        input.clearQueryAction?.();
      },
    ),
  },
  actions: {
    recordCommand: assign(({ event }) =>
      event.type === "EXECUTE"
        ? {
          lastCommand: event.command,
          errorMessage: null,
        }
        : {}
    ),
    recordRegistrationError: assign(({ event }) =>
      event.type === "REGISTRATION_ERROR"
        ? {
          errorMessage: `${event.source} bindings failed: ${toErrorMessage(event.error)}`,
        }
        : {}
    ),
    recordUnknownQueryAction: assign(({ event }) =>
      event.type === "UNKNOWN_QUERY_ACTION"
        ? {
          errorMessage: `unknown query action: ${event.action}`,
        }
        : {}
    ),
    runCommand: ({ event }, params: { runCommand: C4CommandsMachineInput["runCommand"] }) => {
      if (event.type !== "EXECUTE") {
        return;
      }

      try {
        void Promise.resolve(params.runCommand(event.command)).catch((error) => {
          console.error("⚠️ Command execution failed", error);
        });
      } catch (error) {
        console.error("⚠️ Command execution failed", error);
      }
    },
  },
});

const createRunningState = (input: C4CommandsMachineInput) =>
  commandsMachineSetup.createStateConfig({
    invoke: [
      {
        id: "keyboardBindings",
        src: "keyboardBindings" as const,
        input: () => ({
          ...(input.registerKeyboardBindings
            ? { registerKeyboardBindings: input.registerKeyboardBindings }
            : {}),
        }),
      },
      {
        id: "menuBindings",
        src: "menuBindings" as const,
        input: () => ({
          ...(input.registerMenuBindings
            ? { registerMenuBindings: input.registerMenuBindings }
            : {}),
        }),
      },
      {
        id: "queryAction",
        src: "queryAction" as const,
        input: () => ({
          ...(input.getQueryAction ? { getQueryAction: input.getQueryAction } : {}),
          ...(input.clearQueryAction
            ? { clearQueryAction: input.clearQueryAction }
            : {}),
        }),
      },
    ],
    on: {
      EXECUTE: {
        actions: [
          {
            type: "runCommand",
            params: {
              runCommand: input.runCommand,
            },
          },
          "recordCommand",
        ],
      },
      REGISTRATION_ERROR: {
        actions: "recordRegistrationError",
      },
      UNKNOWN_QUERY_ACTION: {
        actions: "recordUnknownQueryAction",
      },
    },
  });

export const createC4CommandsMachine = (input: C4CommandsMachineInput) =>
  commandsMachineSetup.createMachine({
    id: "c4CommandsMachine",
    initial: "running",
    context: {
      lastCommand: null,
      errorMessage: null,
    },
    states: {
      running: createRunningState(input),
    },
  });
