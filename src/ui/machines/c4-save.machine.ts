import { pipe, Schema } from "effect";
import { assign, type DoneActorEvent, type ErrorActorEvent, fromPromise, setup } from "xstate";

export type C4SaveMode = "manual" | "auto";

export interface C4SaveRequest {
  id: number;
  mode: C4SaveMode;
}

export interface C4SaveSuccess {
  requestId: number;
  mode: C4SaveMode;
  saved: boolean;
  savedAt: number | null;
}

export interface C4SaveFailure {
  requestId: number;
  message: string;
  cause?: unknown;
}

export interface C4SaveMachineInput {
  persistRequest: (request: C4SaveRequest) => Promise<C4SaveSuccess>;
}

interface C4SaveActorInput {
  request: C4SaveRequest;
  persistRequest: C4SaveMachineInput["persistRequest"];
}

export interface C4SaveMachineContext {
  inFlightRequest: C4SaveRequest | null;
  pendingRequests: C4SaveRequest[];
  lastCompletedRequestId: number;
  lastCompletedOk: boolean;
  lastSavedAt: number | null;
  errorMessage: string | null;
}

export type C4SaveMachineEvent =
  | { type: "REQUEST_SAVE"; request: C4SaveRequest }
  | { type: "SYNC_LAST_SAVED_AT"; savedAt: number | null }
  | { type: "CLEAR_PENDING_REQUESTS" };

type PersistSaveDoneEvent = DoneActorEvent<C4SaveSuccess, "persistSave">;
type PersistSaveErrorEvent = ErrorActorEvent<unknown, "persistSave">;

type C4SaveRuntimeEvent =
  | C4SaveMachineEvent
  | PersistSaveDoneEvent
  | PersistSaveErrorEvent;

const C4SaveSuccessSchema = Schema.Struct({
  requestId: Schema.Number,
  mode: Schema.Literal("manual", "auto"),
  saved: Schema.Boolean,
  savedAt: Schema.NullOr(Schema.Number),
});

const C4SaveFailureSchema = Schema.Union(
  Schema.Struct({
    requestId: Schema.Number,
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }),
  Schema.String,
);

const toErrorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);

const hasOutput = <T>(event: unknown): event is { output: T } =>
  typeof event === "object" && event !== null && "output" in event;

const hasError = (event: unknown): event is { error: unknown } =>
  typeof event === "object" && event !== null && "error" in event;

const decodeSuccess = (value: unknown): C4SaveSuccess =>
  pipe(
    Schema.decodeUnknownSync(C4SaveSuccessSchema)(value),
    (decoded) => ({
      requestId: decoded.requestId,
      mode: decoded.mode,
      saved: decoded.saved,
      savedAt: decoded.savedAt,
    }),
  );

const normalizeFailure = (
  error: unknown,
  fallbackRequestId: number,
): C4SaveFailure => {
  let decoded: Schema.Schema.Type<typeof C4SaveFailureSchema>;
  try {
    decoded = Schema.decodeUnknownSync(C4SaveFailureSchema)(error);
  } catch {
    decoded = toErrorMessage(error);
  }

  if (typeof decoded === "string") {
    return {
      requestId: fallbackRequestId,
      message: decoded,
      cause: error,
    };
  }

  return {
    requestId: decoded.requestId,
    message: decoded.message,
    cause: decoded.cause,
  };
};

const selectNextQueuedRequest = (
  pendingRequests: ReadonlyArray<C4SaveRequest>,
): { next: C4SaveRequest | null; rest: C4SaveRequest[] } => {
  if (pendingRequests.length === 0) {
    return {
      next: null,
      rest: [],
    };
  }

  const manualIndex = pendingRequests.findIndex(
    (request) => request.mode === "manual",
  );
  if (manualIndex >= 0) {
    return {
      next: pendingRequests[manualIndex] ?? null,
      rest: pendingRequests.filter((_, index) => index !== manualIndex),
    };
  }

  const [first, ...rest] = pendingRequests;
  return {
    next: first ?? null,
    rest,
  };
};

const c4SaveMachineSetup = setup({
  types: {
    context: {} as C4SaveMachineContext,
    events: {} as C4SaveRuntimeEvent,
  },
  actors: {
    persistSave: fromPromise<C4SaveSuccess, C4SaveActorInput>(
      async ({ input }) => input.persistRequest(input.request),
    ),
  },
  guards: {
    hasPendingRequests: ({ context }) => context.pendingRequests.length > 0,
  },
  actions: {
    startSaveFromRequest: assign(({ event }) => {
      if (event.type !== "REQUEST_SAVE") {
        return {};
      }

      return {
        inFlightRequest: event.request,
        errorMessage: null,
      };
    }),
    queueSaveRequest: assign(({ context, event }) => {
      if (event.type !== "REQUEST_SAVE") {
        return {};
      }

      return {
        pendingRequests: [...context.pendingRequests, event.request],
      };
    }),
    applySaveSuccess: assign(({ event }) => {
      if (!hasOutput<unknown>(event)) {
        return {};
      }

      const success = decodeSuccess(event.output);
      return {
        lastCompletedRequestId: success.requestId,
        lastCompletedOk: true,
        lastSavedAt: success.savedAt ?? null,
        errorMessage: null,
      };
    }),
    applySaveFailure: assign(({ context, event }) => {
      if (!hasError(event)) {
        return {};
      }

      const requestId = context.inFlightRequest?.id ?? 0;
      const failure = normalizeFailure(event.error, requestId);
      return {
        lastCompletedRequestId: failure.requestId,
        lastCompletedOk: false,
        errorMessage: failure.message,
      };
    }),
    prepareNextRequest: assign(({ context }) => {
      const { next, rest } = selectNextQueuedRequest(context.pendingRequests);
      return {
        inFlightRequest: next,
        pendingRequests: rest,
      };
    }),
    clearInFlightRequest: assign(() => ({
      inFlightRequest: null,
    })),
    syncLastSavedAt: assign(({ event }) => {
      if (event.type !== "SYNC_LAST_SAVED_AT") {
        return {};
      }

      return {
        lastSavedAt: event.savedAt,
      };
    }),
    clearPendingRequests: assign(() => ({
      pendingRequests: [],
    })),
  },
});

const idleState = c4SaveMachineSetup.createStateConfig({
  on: {
    REQUEST_SAVE: {
      target: "saving",
      actions: "startSaveFromRequest",
    },
  },
});

const createSavingState = (input: C4SaveMachineInput) =>
  c4SaveMachineSetup.createStateConfig({
    on: {
      REQUEST_SAVE: {
        actions: "queueSaveRequest",
      },
    },
    invoke: {
      src: "persistSave",
      input: ({ context }) => {
        if (!context.inFlightRequest) {
          throw new Error("No in-flight save request");
        }

        return {
          request: context.inFlightRequest,
          persistRequest: input.persistRequest,
        };
      },
      onDone: [
        {
          guard: "hasPendingRequests",
          target: "saving",
          reenter: true,
          actions: ["applySaveSuccess", "prepareNextRequest"],
        },
        {
          target: "idle",
          actions: ["applySaveSuccess", "clearInFlightRequest"],
        },
      ],
      onError: [
        {
          guard: "hasPendingRequests",
          target: "saving",
          reenter: true,
          actions: ["applySaveFailure", "prepareNextRequest"],
        },
        {
          target: "idle",
          actions: ["applySaveFailure", "clearInFlightRequest"],
        },
      ],
    },
  });

export const createC4SaveMachine = (input: C4SaveMachineInput) =>
  c4SaveMachineSetup.createMachine({
    id: "c4SaveMachine",
    initial: "idle",
    context: {
      inFlightRequest: null,
      pendingRequests: [],
      lastCompletedRequestId: 0,
      lastCompletedOk: true,
      lastSavedAt: null,
      errorMessage: null,
    },
    on: {
      SYNC_LAST_SAVED_AT: {
        actions: "syncLastSavedAt",
      },
      CLEAR_PENDING_REQUESTS: {
        actions: "clearPendingRequests",
      },
    },
    states: {
      idle: idleState,
      saving: createSavingState(input),
    },
  });
