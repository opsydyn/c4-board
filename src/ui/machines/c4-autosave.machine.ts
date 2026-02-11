import { assign, type DoneActorEvent, type ErrorActorEvent, fromPromise, setup } from "xstate";

export interface C4AutosaveMachineInput {
  requestAutoSave: () => Promise<boolean>;
}

interface RequestAutosaveActorInput {
  requestAutoSave: C4AutosaveMachineInput["requestAutoSave"];
}

export interface C4AutosaveMachineContext {
  enabled: boolean;
  diagramId: string | null;
  debounceMs: number;
  dirtyWhileSaving: boolean;
  lastErrorMessage: string | null;
}

export type C4AutosaveMachineEvent =
  | {
    type: "CONFIGURE";
    enabled: boolean;
    diagramId: string | null;
    debounceMs: number;
  }
  | { type: "MARK_DIRTY" }
  | { type: "CANCEL_PENDING" };

type RequestAutosaveDoneEvent = DoneActorEvent<boolean, "requestAutosave">;
type RequestAutosaveErrorEvent = ErrorActorEvent<unknown, "requestAutosave">;

type C4AutosaveRuntimeEvent =
  | C4AutosaveMachineEvent
  | RequestAutosaveDoneEvent
  | RequestAutosaveErrorEvent;

const toErrorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);

const hasError = (event: unknown): event is { error: unknown } =>
  typeof event === "object" && event !== null && "error" in event;

const autosaveMachineSetup = setup({
  types: {
    context: {} as C4AutosaveMachineContext,
    events: {} as C4AutosaveRuntimeEvent,
  },
  actors: {
    requestAutosave: fromPromise<boolean, RequestAutosaveActorInput>(
      async ({ input }) => input.requestAutoSave(),
    ),
  },
  delays: {
    debounceDelay: ({ context }) => Math.max(0, Math.round(context.debounceMs)),
  },
  guards: {
    contextCanAutosave: ({ context }) => context.enabled && context.diagramId !== null,
    configEnablesAutosave: ({ event }) => event.type === "CONFIGURE" && event.enabled && event.diagramId !== null,
    configDisablesAutosave: ({ event }) => event.type === "CONFIGURE" && (!event.enabled || event.diagramId === null),
    shouldDebounceAfterSave: ({ context }) =>
      context.dirtyWhileSaving
      && context.enabled
      && context.diagramId !== null,
  },
  actions: {
    applyConfig: assign(({ event }) => {
      if (event.type !== "CONFIGURE") {
        return {};
      }

      return {
        enabled: event.enabled,
        diagramId: event.diagramId,
        debounceMs: event.debounceMs,
      };
    }),
    markDirtyWhileSaving: assign(() => ({
      dirtyWhileSaving: true,
    })),
    clearDirtyWhileSaving: assign(() => ({
      dirtyWhileSaving: false,
    })),
    clearError: assign(() => ({
      lastErrorMessage: null,
    })),
    recordError: assign(({ event }) => {
      if (!hasError(event)) {
        return {};
      }

      return {
        lastErrorMessage: toErrorMessage(event.error),
      };
    }),
  },
});

const inactiveState = autosaveMachineSetup.createStateConfig({
  on: {
    CONFIGURE: [
      {
        guard: "configEnablesAutosave",
        target: "idle",
        actions: "applyConfig",
      },
      {
        actions: "applyConfig",
      },
    ],
  },
});

const idleState = autosaveMachineSetup.createStateConfig({
  on: {
    MARK_DIRTY: {
      guard: "contextCanAutosave",
      target: "debouncing",
    },
    CANCEL_PENDING: {
      actions: "clearDirtyWhileSaving",
    },
    CONFIGURE: [
      {
        guard: "configDisablesAutosave",
        target: "inactive",
        actions: "applyConfig",
      },
      {
        actions: "applyConfig",
      },
    ],
  },
});

const debouncingState = autosaveMachineSetup.createStateConfig({
  on: {
    MARK_DIRTY: {
      guard: "contextCanAutosave",
      target: "debouncing",
      reenter: true,
    },
    CANCEL_PENDING: {
      target: "idle",
    },
    CONFIGURE: [
      {
        guard: "configDisablesAutosave",
        target: "inactive",
        actions: "applyConfig",
      },
      {
        target: "debouncing",
        reenter: true,
        actions: "applyConfig",
      },
    ],
  },
  after: {
    debounceDelay: {
      guard: "contextCanAutosave",
      target: "saving",
    },
  },
});

const createSavingState = (input: C4AutosaveMachineInput) =>
  autosaveMachineSetup.createStateConfig({
    on: {
      MARK_DIRTY: {
        actions: "markDirtyWhileSaving",
      },
      CONFIGURE: {
        actions: "applyConfig",
      },
    },
    invoke: {
      src: "requestAutosave",
      input: {
        requestAutoSave: input.requestAutoSave,
      },
      onDone: [
        {
          guard: "shouldDebounceAfterSave",
          target: "debouncing",
          actions: ["clearDirtyWhileSaving", "clearError"],
        },
        {
          guard: "contextCanAutosave",
          target: "idle",
          actions: ["clearDirtyWhileSaving", "clearError"],
        },
        {
          target: "inactive",
          actions: ["clearDirtyWhileSaving", "clearError"],
        },
      ],
      onError: [
        {
          guard: "shouldDebounceAfterSave",
          target: "debouncing",
          actions: ["clearDirtyWhileSaving", "recordError"],
        },
        {
          guard: "contextCanAutosave",
          target: "idle",
          actions: ["clearDirtyWhileSaving", "recordError"],
        },
        {
          target: "inactive",
          actions: ["clearDirtyWhileSaving", "recordError"],
        },
      ],
    },
  });

export const createC4AutosaveMachine = (input: C4AutosaveMachineInput) =>
  autosaveMachineSetup.createMachine({
    id: "c4AutosaveMachine",
    initial: "inactive",
    context: {
      enabled: false,
      diagramId: null,
      debounceMs: 1_500,
      dirtyWhileSaving: false,
      lastErrorMessage: null,
    },
    states: {
      inactive: inactiveState,
      idle: idleState,
      debouncing: debouncingState,
      saving: createSavingState(input),
    },
  });
