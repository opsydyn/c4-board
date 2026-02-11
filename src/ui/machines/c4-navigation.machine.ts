import { assign, type DoneActorEvent, type ErrorActorEvent, fromPromise, setup } from "xstate";

export interface C4NavigationMachineInput {
  flushPendingInlineEdits: () => Promise<void>;
  requestManualSave: () => Promise<boolean>;
  navigateTo: (href: string) => void;
  beforeNavigate?: (didSave: boolean) => void;
}

interface NavigateActorInput {
  href: string;
  saveOnNavigate: boolean;
  flushPendingInlineEdits: C4NavigationMachineInput["flushPendingInlineEdits"];
  requestManualSave: C4NavigationMachineInput["requestManualSave"];
  navigateTo: C4NavigationMachineInput["navigateTo"];
  beforeNavigate?: C4NavigationMachineInput["beforeNavigate"];
}

interface NavigateResult {
  href: string;
  didSave: boolean;
}

export interface C4NavigationMachineContext {
  targetHref: string | null;
  saveOnNavigate: boolean;
  lastSaveCompleted: boolean;
  errorMessage: string | null;
}

export type C4NavigationMachineEvent =
  | { type: "NAVIGATE"; href: string; saveOnNavigate: boolean }
  | { type: "CANCEL_NAVIGATION" };

type PerformNavigationDoneEvent = DoneActorEvent<NavigateResult, "performNavigation">;
type PerformNavigationErrorEvent = ErrorActorEvent<unknown, "performNavigation">;

type C4NavigationRuntimeEvent =
  | C4NavigationMachineEvent
  | PerformNavigationDoneEvent
  | PerformNavigationErrorEvent;

const toErrorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);

const hasOutput = <T>(event: unknown): event is { output: T } =>
  typeof event === "object" && event !== null && "output" in event;

const hasError = (event: unknown): event is { error: unknown } =>
  typeof event === "object" && event !== null && "error" in event;

const navigationMachineSetup = setup({
  types: {
    context: {} as C4NavigationMachineContext,
    events: {} as C4NavigationRuntimeEvent,
  },
  actors: {
    performNavigation: fromPromise<NavigateResult, NavigateActorInput>(
      async ({ input }) => {
        if (input.saveOnNavigate) {
          await input.flushPendingInlineEdits();
          const didSave = await input.requestManualSave();
          if (!didSave) {
            console.warn("⚠️ Save did not complete before navigation; continuing");
          }
          input.beforeNavigate?.(didSave);
          input.navigateTo(input.href);
          return { href: input.href, didSave };
        }

        input.beforeNavigate?.(false);
        input.navigateTo(input.href);
        return { href: input.href, didSave: false };
      },
    ),
  },
  actions: {
    startNavigation: assign(({ event }) => {
      if (event.type !== "NAVIGATE") {
        return {};
      }

      return {
        targetHref: event.href,
        saveOnNavigate: event.saveOnNavigate,
        lastSaveCompleted: false,
        errorMessage: null,
      };
    }),
    applyNavigationSuccess: assign(({ event }) => {
      if (!hasOutput<NavigateResult>(event)) {
        return {};
      }

      return {
        targetHref: event.output.href,
        lastSaveCompleted: event.output.didSave,
        errorMessage: null,
      };
    }),
    applyNavigationFailure: assign(({ event }) => {
      if (!hasError(event)) {
        return {};
      }

      return {
        targetHref: null,
        lastSaveCompleted: false,
        errorMessage: toErrorMessage(event.error),
      };
    }),
    clearNavigationState: assign(() => ({
      targetHref: null,
      lastSaveCompleted: false,
      errorMessage: null,
    })),
  },
});

const idleState = navigationMachineSetup.createStateConfig({
  on: {
    NAVIGATE: {
      target: "navigating",
      actions: "startNavigation",
    },
    CANCEL_NAVIGATION: {
      actions: "clearNavigationState",
    },
  },
});

const createNavigatingState = (input: C4NavigationMachineInput) =>
  navigationMachineSetup.createStateConfig({
    on: {
      CANCEL_NAVIGATION: {
        target: "idle",
        actions: "clearNavigationState",
      },
    },
    invoke: {
      src: "performNavigation",
      input: ({ context }) => {
        if (!context.targetHref) {
          throw new Error("No navigation target set");
        }

        return {
          href: context.targetHref,
          saveOnNavigate: context.saveOnNavigate,
          flushPendingInlineEdits: input.flushPendingInlineEdits,
          requestManualSave: input.requestManualSave,
          navigateTo: input.navigateTo,
          beforeNavigate: input.beforeNavigate,
        };
      },
      onDone: {
        actions: "applyNavigationSuccess",
      },
      onError: {
        target: "idle",
        actions: "applyNavigationFailure",
      },
    },
  });

export const createC4NavigationMachine = (input: C4NavigationMachineInput) =>
  navigationMachineSetup.createMachine({
    id: "c4NavigationMachine",
    initial: "idle",
    context: {
      targetHref: null,
      saveOnNavigate: true,
      lastSaveCompleted: false,
      errorMessage: null,
    },
    states: {
      idle: idleState,
      navigating: createNavigatingState(input),
    },
  });
