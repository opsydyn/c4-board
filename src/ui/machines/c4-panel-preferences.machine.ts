import { assign, emit, type ErrorActorEvent, fromPromise, setup } from "xstate";

export interface C4PanelPreferences {
  azurePanelVisible: boolean;
  ownershipLensVisible: boolean;
  couplingExplainabilityVisible: boolean;
  opyCopilotVisible: boolean;
}

export type C4PanelPreferenceKey = keyof C4PanelPreferences;
export type C4PanelPreferencePatch = Partial<C4PanelPreferences>;

export interface C4PanelPreferencesMachineInput {
  persistPatch: (patch: C4PanelPreferencePatch) => Promise<void>;
}

interface PersistPatchActorInput {
  patch: C4PanelPreferencePatch;
  persistPatch: C4PanelPreferencesMachineInput["persistPatch"];
}

export interface C4PanelPreferencesMachineContext extends C4PanelPreferences {
  activePatch: C4PanelPreferencePatch | null;
  queuedPatch: C4PanelPreferencePatch | null;
  hydrated: boolean;
  errorMessage: string | null;
}

export type C4PanelPreferencesMachineEvent =
  | { type: "HYDRATE"; values: C4PanelPreferences }
  | { type: "TOGGLE_AZURE_PANEL" }
  | { type: "TOGGLE_OWNERSHIP_LENS" }
  | { type: "TOGGLE_COUPLING_EXPLAINABILITY" }
  | { type: "TOGGLE_OPY_COPILOT" };

type PersistPatchErrorEvent = ErrorActorEvent<unknown, "persistPatch">;

type C4PanelPreferencesRuntimeEvent =
  | C4PanelPreferencesMachineEvent
  | PersistPatchErrorEvent;

export type C4PanelPreferencesEmittedEvent =
  | { type: "panelPreferenceChanged"; key: C4PanelPreferenceKey; value: boolean }
  | { type: "panelPreferencePersistFailed"; patch: C4PanelPreferencePatch; message: string };

const toErrorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);

const hasError = (event: unknown): event is { error: unknown } =>
  typeof event === "object" && event !== null && "error" in event;

const mergePatch = (
  currentPatch: C4PanelPreferencePatch | null,
  incomingPatch: C4PanelPreferencePatch,
): C4PanelPreferencePatch => ({
  ...(currentPatch ?? {}),
  ...incomingPatch,
});

const panelPreferencesMachineSetup = setup({
  types: {
    context: {} as C4PanelPreferencesMachineContext,
    events: {} as C4PanelPreferencesRuntimeEvent,
    emitted: {} as C4PanelPreferencesEmittedEvent,
  },
  actors: {
    persistPatch: fromPromise<void, PersistPatchActorInput>(
      async ({ input }) => {
        await input.persistPatch(input.patch);
      },
    ),
  },
  guards: {
    hasQueuedPatch: ({ context }) => context.queuedPatch !== null && Object.keys(context.queuedPatch).length > 0,
  },
  actions: {
    hydrateFromSettings: assign(({ event }) => {
      if (event.type !== "HYDRATE") {
        return {};
      }

      return {
        azurePanelVisible: event.values.azurePanelVisible,
        ownershipLensVisible: event.values.ownershipLensVisible,
        couplingExplainabilityVisible: event.values.couplingExplainabilityVisible,
        opyCopilotVisible: event.values.opyCopilotVisible,
        hydrated: true,
        errorMessage: null,
      };
    }),
    toggleAzureAsActivePatch: assign(({ context }) => {
      const next = !context.azurePanelVisible;
      return {
        azurePanelVisible: next,
        activePatch: mergePatch(context.activePatch, {
          azurePanelVisible: next,
        }),
        errorMessage: null,
      };
    }),
    toggleAzureAsQueuedPatch: assign(({ context }) => {
      const next = !context.azurePanelVisible;
      return {
        azurePanelVisible: next,
        queuedPatch: mergePatch(context.queuedPatch, {
          azurePanelVisible: next,
        }),
        errorMessage: null,
      };
    }),
    toggleOwnershipAsActivePatch: assign(({ context }) => {
      const next = !context.ownershipLensVisible;
      return {
        ownershipLensVisible: next,
        activePatch: mergePatch(context.activePatch, {
          ownershipLensVisible: next,
        }),
        errorMessage: null,
      };
    }),
    toggleOwnershipAsQueuedPatch: assign(({ context }) => {
      const next = !context.ownershipLensVisible;
      return {
        ownershipLensVisible: next,
        queuedPatch: mergePatch(context.queuedPatch, {
          ownershipLensVisible: next,
        }),
        errorMessage: null,
      };
    }),
    toggleCouplingAsActivePatch: assign(({ context }) => {
      const next = !context.couplingExplainabilityVisible;
      return {
        couplingExplainabilityVisible: next,
        activePatch: mergePatch(context.activePatch, {
          couplingExplainabilityVisible: next,
        }),
        errorMessage: null,
      };
    }),
    toggleCouplingAsQueuedPatch: assign(({ context }) => {
      const next = !context.couplingExplainabilityVisible;
      return {
        couplingExplainabilityVisible: next,
        queuedPatch: mergePatch(context.queuedPatch, {
          couplingExplainabilityVisible: next,
        }),
        errorMessage: null,
      };
    }),
    toggleOpyAsActivePatch: assign(({ context }) => {
      const next = !context.opyCopilotVisible;
      return {
        opyCopilotVisible: next,
        activePatch: mergePatch(context.activePatch, {
          opyCopilotVisible: next,
        }),
        errorMessage: null,
      };
    }),
    toggleOpyAsQueuedPatch: assign(({ context }) => {
      const next = !context.opyCopilotVisible;
      return {
        opyCopilotVisible: next,
        queuedPatch: mergePatch(context.queuedPatch, {
          opyCopilotVisible: next,
        }),
        errorMessage: null,
      };
    }),
    emitAzureToggle: emit(({ context }) => ({
      type: "panelPreferenceChanged",
      key: "azurePanelVisible",
      value: context.azurePanelVisible,
    })),
    emitOwnershipToggle: emit(({ context }) => ({
      type: "panelPreferenceChanged",
      key: "ownershipLensVisible",
      value: context.ownershipLensVisible,
    })),
    emitCouplingToggle: emit(({ context }) => ({
      type: "panelPreferenceChanged",
      key: "couplingExplainabilityVisible",
      value: context.couplingExplainabilityVisible,
    })),
    emitOpyToggle: emit(({ context }) => ({
      type: "panelPreferenceChanged",
      key: "opyCopilotVisible",
      value: context.opyCopilotVisible,
    })),
    promoteQueuedPatch: assign(({ context }) => ({
      activePatch: context.queuedPatch,
      queuedPatch: null,
      errorMessage: null,
    })),
    clearActivePatch: assign(() => ({
      activePatch: null,
      errorMessage: null,
    })),
    clearActivePatchWithError: assign(({ event }) => ({
      activePatch: null,
      errorMessage: hasError(event)
        ? toErrorMessage(event.error)
        : "Panel preference persistence failed",
    })),
    promoteQueuedPatchWithError: assign(({ context, event }) => ({
      activePatch: context.queuedPatch,
      queuedPatch: null,
      errorMessage: hasError(event)
        ? toErrorMessage(event.error)
        : "Panel preference persistence failed",
    })),
    emitPersistFailure: emit(({ context, event }) => ({
      type: "panelPreferencePersistFailed",
      patch: context.activePatch ?? {},
      message: hasError(event)
        ? toErrorMessage(event.error)
        : "Panel preference persistence failed",
    })),
  },
});

const idleState = panelPreferencesMachineSetup.createStateConfig({
  on: {
    HYDRATE: {
      actions: "hydrateFromSettings",
    },
    TOGGLE_AZURE_PANEL: {
      target: "persisting",
      actions: ["toggleAzureAsActivePatch", "emitAzureToggle"],
    },
    TOGGLE_OWNERSHIP_LENS: {
      target: "persisting",
      actions: ["toggleOwnershipAsActivePatch", "emitOwnershipToggle"],
    },
    TOGGLE_COUPLING_EXPLAINABILITY: {
      target: "persisting",
      actions: ["toggleCouplingAsActivePatch", "emitCouplingToggle"],
    },
    TOGGLE_OPY_COPILOT: {
      target: "persisting",
      actions: ["toggleOpyAsActivePatch", "emitOpyToggle"],
    },
  },
});

const createPersistingState = (input: C4PanelPreferencesMachineInput) =>
  panelPreferencesMachineSetup.createStateConfig({
    on: {
      HYDRATE: {
        actions: [],
      },
      TOGGLE_AZURE_PANEL: {
        actions: ["toggleAzureAsQueuedPatch", "emitAzureToggle"],
      },
      TOGGLE_OWNERSHIP_LENS: {
        actions: ["toggleOwnershipAsQueuedPatch", "emitOwnershipToggle"],
      },
      TOGGLE_COUPLING_EXPLAINABILITY: {
        actions: ["toggleCouplingAsQueuedPatch", "emitCouplingToggle"],
      },
      TOGGLE_OPY_COPILOT: {
        actions: ["toggleOpyAsQueuedPatch", "emitOpyToggle"],
      },
    },
    invoke: {
      src: "persistPatch",
      input: ({ context }) => {
        if (!context.activePatch || Object.keys(context.activePatch).length === 0) {
          throw new Error("No panel preference patch to persist");
        }

        return {
          patch: context.activePatch,
          persistPatch: input.persistPatch,
        };
      },
      onDone: [
        {
          guard: "hasQueuedPatch",
          target: "persisting",
          reenter: true,
          actions: "promoteQueuedPatch",
        },
        {
          target: "idle",
          actions: "clearActivePatch",
        },
      ],
      onError: [
        {
          guard: "hasQueuedPatch",
          target: "persisting",
          reenter: true,
          actions: ["emitPersistFailure", "promoteQueuedPatchWithError"],
        },
        {
          target: "idle",
          actions: ["emitPersistFailure", "clearActivePatchWithError"],
        },
      ],
    },
  });

export const createC4PanelPreferencesMachine = (input: C4PanelPreferencesMachineInput) =>
  panelPreferencesMachineSetup.createMachine({
    id: "c4PanelPreferencesMachine",
    initial: "idle",
    context: {
      azurePanelVisible: false,
      ownershipLensVisible: false,
      couplingExplainabilityVisible: false,
      opyCopilotVisible: false,
      activePatch: null,
      queuedPatch: null,
      hydrated: false,
      errorMessage: null,
    },
    states: {
      idle: idleState,
      persisting: createPersistingState(input),
    },
  });
