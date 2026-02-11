import { type Effect, Either, pipe, Schema } from "effect";
import { assign, type DoneActorEvent, type ErrorActorEvent, fromPromise, setup } from "xstate";
import { getSettings, patchSettings, resetSettings } from "../../core/effects/database";
import type { DatabaseService } from "../../core/effects/database";
import type { SettingsV1FlagState } from "../../core/effects/feature-flags";
import { emitSettingsTelemetry } from "../../core/effects/settings.telemetry";
import type { AppSettings, AppSettingsPatch } from "../../core/effects/settings.types";
import { AppSettingsSchema, DEFAULT_APP_SETTINGS } from "../../core/effects/settings.types";

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const toIntegerDuration = (durationMs: number): number =>
  Number.isFinite(durationMs) ? Math.max(0, Math.round(durationMs)) : 0;

interface SettingsDrafts {
  autosaveIntervalDraft: string;
  historyRetentionDraft: string;
  masterVolumeDraft: number;
  mudAlertThresholdDraft: string;
}

const toDrafts = (settings: AppSettings): SettingsDrafts => ({
  autosaveIntervalDraft: String(settings.autosaveIntervalMs),
  historyRetentionDraft: String(settings.historyRetentionDays),
  masterVolumeDraft: Math.round(settings.masterVolume * 100),
  mudAlertThresholdDraft: settings.bigBallOfMudAlertThreshold.toFixed(1),
});

type RunEffectFn = <A, E>(
  effect: Effect.Effect<A, E, DatabaseService>,
) => Promise<A>;

export interface SettingsMachineInput {
  runEffect: RunEffectFn;
  settingsV1Flag: SettingsV1FlagState;
}

type SettingsWriteOperation =
  | { type: "patch"; patch: AppSettingsPatch }
  | { type: "reset" };

interface LoadSettingsResult {
  settings: AppSettings;
  durationMs: number;
}

interface PersistSettingsResult {
  settings: AppSettings;
  durationMs: number;
  operation: "patch" | "reset";
}

const SettingsActorErrorSchema = Schema.Union(
  Schema.Struct({
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
    _tag: Schema.optional(Schema.String),
  }),
  Schema.String,
);

type SettingsActorError = Schema.Schema.Type<typeof SettingsActorErrorSchema>;

interface NormalizedActorError {
  message: string;
  cause?: unknown;
}

const decodeLoadResult = (value: unknown): LoadSettingsResult =>
  pipe(
    Schema.decodeUnknownSync(
      Schema.Struct({
        settings: AppSettingsSchema,
        durationMs: Schema.Number,
      }),
    )(value),
    (decoded) => ({
      settings: decoded.settings,
      durationMs: toIntegerDuration(decoded.durationMs),
    }),
  );

const decodePersistResult = (value: unknown): PersistSettingsResult =>
  pipe(
    Schema.decodeUnknownSync(
      Schema.Struct({
        settings: AppSettingsSchema,
        durationMs: Schema.Number,
        operation: Schema.Literal("patch", "reset"),
      }),
    )(value),
    (decoded) => ({
      settings: decoded.settings,
      durationMs: toIntegerDuration(decoded.durationMs),
      operation: decoded.operation,
    }),
  );

const normalizeActorError = (error: unknown): NormalizedActorError => {
  const decoded = pipe(
    Schema.decodeUnknownEither(SettingsActorErrorSchema)(error),
    Either.getOrElse<SettingsActorError, SettingsActorError>(() =>
      error instanceof Error ? error.message : String(error)
    ),
  );

  if (typeof decoded === "string") {
    return {
      message: decoded,
      cause: error,
    };
  }

  return {
    message: decoded.message,
    cause: decoded.cause,
  };
};

export interface SettingsMachineContext {
  settings: AppSettings;
  settingsV1Flag: SettingsV1FlagState;
  pendingOperations: SettingsWriteOperation[];
  activeOperation: SettingsWriteOperation | null;
  pendingWrites: number;
  lastSavedAt: number | null;
  errorMessage: string | null;
  dataControlNotice: string | null;
  autosaveIntervalDraft: string;
  historyRetentionDraft: string;
  masterVolumeDraft: number;
  mudAlertThresholdDraft: string;
}

export type SettingsMachineEvent =
  | { type: "LOAD" }
  | { type: "PATCH"; patch: AppSettingsPatch }
  | { type: "RESET" }
  | { type: "SET_NOTICE"; value: string | null }
  | { type: "SET_AUTOSAVE_DRAFT"; value: string }
  | { type: "SET_HISTORY_DRAFT"; value: string }
  | { type: "SET_MASTER_VOLUME_DRAFT"; value: number }
  | { type: "SET_MUD_THRESHOLD_DRAFT"; value: string };

type LoadSettingsDoneEvent = DoneActorEvent<LoadSettingsResult, "loadSettings">;
type LoadSettingsErrorEvent = ErrorActorEvent<unknown, "loadSettings">;
type PersistOperationDoneEvent = DoneActorEvent<
  PersistSettingsResult,
  "persistOperation"
>;
type PersistOperationErrorEvent = ErrorActorEvent<unknown, "persistOperation">;

type SettingsRuntimeEvent =
  | SettingsMachineEvent
  | LoadSettingsDoneEvent
  | LoadSettingsErrorEvent
  | PersistOperationDoneEvent
  | PersistOperationErrorEvent;

const settingsMachineSetup = setup({
  types: {
    context: {} as SettingsMachineContext,
    events: {} as SettingsRuntimeEvent,
  },
  actors: {
    loadSettings: fromPromise<
      LoadSettingsResult,
      {
        runEffect: RunEffectFn;
      }
    >(async ({ input }) => {
      const startedAt = Date.now();
      const settings = await input.runEffect(getSettings());
      return {
        settings,
        durationMs: toIntegerDuration(Date.now() - startedAt),
      };
    }),
    persistOperation: fromPromise<
      PersistSettingsResult,
      {
        runEffect: RunEffectFn;
        operation: SettingsWriteOperation;
      }
    >(async ({ input }) => {
      const startedAt = Date.now();
      const settings = input.operation.type === "patch"
        ? await input.runEffect(patchSettings(input.operation.patch))
        : await input.runEffect(resetSettings());

      return {
        settings,
        durationMs: toIntegerDuration(Date.now() - startedAt),
        operation: input.operation.type,
      };
    }),
  },
  guards: {
    settingsV1Disabled: ({ context }) => !context.settingsV1Flag.enabled,
    hasQueuedOperations: ({ context }) => context.pendingOperations.length > 0,
    patchHasChanges: ({ context, event }) =>
      event.type === "PATCH"
      && Object.entries(event.patch).some(([key, value]) => {
        const typedKey = key as keyof AppSettings;
        return !Object.is(context.settings[typedKey], value);
      }),
    settingsDifferFromDefaults: ({ context }) =>
      Object.entries(DEFAULT_APP_SETTINGS).some(([key, value]) => {
        const typedKey = key as keyof AppSettings;
        return !Object.is(context.settings[typedKey], value);
      }),
  },
  actions: {
    startPatchSave: assign(({ context, event }) => {
      if (event.type !== "PATCH") {
        return {};
      }

      const nextSettings: AppSettings = {
        ...context.settings,
        ...event.patch,
      };

      return {
        settings: nextSettings,
        activeOperation: { type: "patch", patch: event.patch } as const,
        pendingWrites: context.pendingWrites + 1,
        errorMessage: null,
        dataControlNotice: null,
        ...toDrafts(nextSettings),
      };
    }),
    startResetSave: assign(({ context }) => ({
      settings: DEFAULT_APP_SETTINGS,
      activeOperation: { type: "reset" } as const,
      pendingWrites: context.pendingWrites + 1,
      errorMessage: null,
      dataControlNotice: null,
      ...toDrafts(DEFAULT_APP_SETTINGS),
    })),
    queuePatch: assign(({ context, event }) => {
      if (event.type !== "PATCH") {
        return {};
      }

      const optimisticSettings: AppSettings = {
        ...context.settings,
        ...event.patch,
      };

      return {
        settings: optimisticSettings,
        pendingOperations: [
          ...context.pendingOperations,
          { type: "patch", patch: event.patch } as const,
        ],
        pendingWrites: context.pendingWrites + 1,
        errorMessage: null,
        dataControlNotice: null,
        ...toDrafts(optimisticSettings),
      };
    }),
    queueReset: assign(({ context }) => ({
      settings: DEFAULT_APP_SETTINGS,
      pendingOperations: [...context.pendingOperations, { type: "reset" } as const],
      pendingWrites: context.pendingWrites + 1,
      errorMessage: null,
      dataControlNotice: null,
      ...toDrafts(DEFAULT_APP_SETTINGS),
    })),
    applyLoadSuccess: assign(({ event }) => {
      if (event.type !== "xstate.done.actor.loadSettings") {
        return {};
      }

      const loaded = decodeLoadResult(event.output);
      return {
        settings: loaded.settings,
        errorMessage: null,
        ...toDrafts(loaded.settings),
      };
    }),
    applyLoadFailure: assign(({ event }) => {
      if (event.type !== "xstate.error.actor.loadSettings") {
        return {};
      }

      return {
        errorMessage: normalizeActorError(event.error).message,
      };
    }),
    applyWriteSuccess: assign(({ context, event }) => {
      if (event.type !== "xstate.done.actor.persistOperation") {
        return {};
      }

      const committed = decodePersistResult(event.output);
      return {
        settings: committed.settings,
        activeOperation: null,
        pendingWrites: Math.max(0, context.pendingWrites - 1),
        lastSavedAt: Date.now(),
        errorMessage: null,
        ...toDrafts(committed.settings),
      };
    }),
    applyWriteSuccessAndPrepareNext: assign(({ context, event }) => {
      if (event.type !== "xstate.done.actor.persistOperation") {
        return {};
      }

      const committed = decodePersistResult(event.output);
      const [nextOperation, ...remainingOperations] = context.pendingOperations;

      return {
        settings: committed.settings,
        activeOperation: nextOperation ?? null,
        pendingOperations: remainingOperations,
        pendingWrites: Math.max(0, context.pendingWrites - 1),
        lastSavedAt: Date.now(),
        errorMessage: null,
        ...toDrafts(committed.settings),
      };
    }),
    applyWriteFailure: assign(({ context, event }) => {
      if (event.type !== "xstate.error.actor.persistOperation") {
        return {};
      }

      return {
        activeOperation: null,
        pendingWrites: Math.max(0, context.pendingWrites - 1),
        errorMessage: normalizeActorError(event.error).message,
      };
    }),
    applyRecoverySuccess: assign(({ event }) => {
      if (event.type !== "xstate.done.actor.loadSettings") {
        return {};
      }

      const loaded = decodeLoadResult(event.output);
      return {
        settings: loaded.settings,
        ...toDrafts(loaded.settings),
      };
    }),
    applyRecoverySuccessAndPrepareNext: assign(({ context, event }) => {
      if (event.type !== "xstate.done.actor.loadSettings") {
        return {};
      }

      const loaded = decodeLoadResult(event.output);
      const [nextOperation, ...remainingOperations] = context.pendingOperations;
      return {
        settings: loaded.settings,
        activeOperation: nextOperation ?? null,
        pendingOperations: remainingOperations,
        ...toDrafts(loaded.settings),
      };
    }),
    setNotice: assign(({ event }) =>
      event.type === "SET_NOTICE"
        ? { dataControlNotice: event.value }
        : {}
    ),
    setAutosaveDraft: assign(({ event }) =>
      event.type === "SET_AUTOSAVE_DRAFT"
        ? { autosaveIntervalDraft: event.value }
        : {}
    ),
    setHistoryDraft: assign(({ event }) =>
      event.type === "SET_HISTORY_DRAFT"
        ? { historyRetentionDraft: event.value }
        : {}
    ),
    setMasterVolumeDraft: assign(({ event }) =>
      event.type === "SET_MASTER_VOLUME_DRAFT"
        ? { masterVolumeDraft: clamp(Math.round(event.value), 0, 100) }
        : {}
    ),
    setMudThresholdDraft: assign(({ event }) =>
      event.type === "SET_MUD_THRESHOLD_DRAFT"
        ? { mudAlertThresholdDraft: event.value }
        : {}
    ),
    emitLoadSuccessTelemetry: ({ event }) => {
      if (event.type !== "xstate.done.actor.loadSettings") {
        return;
      }

      const loaded = decodeLoadResult(event.output);
      emitSettingsTelemetry(
        "settings_load_success",
        {
          operation: "load",
          durationMs: loaded.durationMs,
        },
        loaded.settings,
      );
    },
    emitLoadFailureTelemetry: ({ context, event }) => {
      if (event.type !== "xstate.error.actor.loadSettings") {
        return;
      }

      const failure = normalizeActorError(event.error);
      emitSettingsTelemetry(
        "settings_load_failure",
        {
          operation: "load",
          durationMs: 0,
          error: failure.message,
        },
        context.settings,
      );
    },
    emitWriteSuccessTelemetry: ({ context, event }) => {
      if (event.type !== "xstate.done.actor.persistOperation") {
        return;
      }

      const committed = decodePersistResult(event.output);
      emitSettingsTelemetry(
        "settings_write_success",
        {
          operation: committed.operation,
          durationMs: committed.durationMs,
          queueDepth: context.pendingWrites,
        },
        committed.settings,
      );
    },
    emitWriteFailureTelemetry: ({ context, event }) => {
      if (event.type !== "xstate.error.actor.persistOperation") {
        return;
      }

      const failure = normalizeActorError(event.error);
      const operationType = context.activeOperation?.type ?? "patch";
      emitSettingsTelemetry(
        "settings_write_failure",
        {
          operation: operationType,
          durationMs: 0,
          error: failure.message,
          queueDepth: context.pendingWrites,
        },
        context.settings,
      );
    },
  },
});

const createBootingState = (input: SettingsMachineInput) =>
  settingsMachineSetup.createStateConfig({
    always: {
      guard: "settingsV1Disabled",
      target: "disabled",
    },
    invoke: {
      src: "loadSettings",
      input: {
        runEffect: input.runEffect,
      },
      onDone: {
        target: "synced",
        actions: ["applyLoadSuccess", "emitLoadSuccessTelemetry"],
      },
      onError: {
        target: "error",
        actions: ["applyLoadFailure", "emitLoadFailureTelemetry"],
      },
    },
  });

const disabledState = settingsMachineSetup.createStateConfig({});

const syncedState = settingsMachineSetup.createStateConfig({
  on: {
    PATCH: [
      {
        guard: "patchHasChanges",
        target: "saving",
        actions: "startPatchSave",
      },
    ],
    RESET: [
      {
        guard: "settingsDifferFromDefaults",
        target: "saving",
        actions: "startResetSave",
      },
    ],
  },
});

const createSavingState = (input: SettingsMachineInput) =>
  settingsMachineSetup.createStateConfig({
    on: {
      PATCH: [
        {
          guard: "patchHasChanges",
          actions: ["queuePatch"],
        },
      ],
      RESET: [
        {
          guard: "settingsDifferFromDefaults",
          actions: ["queueReset"],
        },
      ],
    },
    invoke: {
      src: "persistOperation",
      input: ({ context }) => {
        if (!context.activeOperation) {
          throw new Error("No active settings write operation");
        }

        return {
          runEffect: input.runEffect,
          operation: context.activeOperation,
        };
      },
      onDone: [
        {
          guard: "hasQueuedOperations",
          target: "saving",
          reenter: true,
          actions: [
            "applyWriteSuccessAndPrepareNext",
            "emitWriteSuccessTelemetry",
          ],
        },
        {
          target: "synced",
          actions: ["applyWriteSuccess", "emitWriteSuccessTelemetry"],
        },
      ],
      onError: {
        target: "recovering",
        actions: ["emitWriteFailureTelemetry", "applyWriteFailure"],
      },
    },
  });

const createRecoveringState = (input: SettingsMachineInput) =>
  settingsMachineSetup.createStateConfig({
    invoke: {
      src: "loadSettings",
      input: {
        runEffect: input.runEffect,
      },
      onDone: [
        {
          guard: "hasQueuedOperations",
          target: "saving",
          actions: "applyRecoverySuccessAndPrepareNext",
        },
        {
          target: "error",
          actions: "applyRecoverySuccess",
        },
      ],
      onError: {
        target: "error",
        actions: ["applyLoadFailure", "emitLoadFailureTelemetry"],
      },
    },
  });

const errorState = settingsMachineSetup.createStateConfig({
  on: {
    PATCH: [
      {
        guard: "patchHasChanges",
        target: "saving",
        actions: "startPatchSave",
      },
    ],
    RESET: [
      {
        guard: "settingsDifferFromDefaults",
        target: "saving",
        actions: "startResetSave",
      },
    ],
  },
});

export const createSettingsMachine = (input: SettingsMachineInput) =>
  settingsMachineSetup.createMachine({
    id: "settingsPanel",
    context: {
      settings: DEFAULT_APP_SETTINGS,
      settingsV1Flag: input.settingsV1Flag,
      pendingOperations: [],
      activeOperation: null,
      pendingWrites: 0,
      lastSavedAt: null,
      errorMessage: null,
      dataControlNotice: null,
      ...toDrafts(DEFAULT_APP_SETTINGS),
    },
    initial: "booting",
    on: {
      LOAD: [
        {
          guard: "settingsV1Disabled",
          target: ".disabled",
        },
        {
          target: ".booting",
        },
      ],
      SET_NOTICE: {
        actions: "setNotice",
      },
      SET_AUTOSAVE_DRAFT: {
        actions: "setAutosaveDraft",
      },
      SET_HISTORY_DRAFT: {
        actions: "setHistoryDraft",
      },
      SET_MASTER_VOLUME_DRAFT: {
        actions: "setMasterVolumeDraft",
      },
      SET_MUD_THRESHOLD_DRAFT: {
        actions: "setMudThresholdDraft",
      },
    },
    states: {
      booting: createBootingState(input),
      disabled: disabledState,
      synced: syncedState,
      saving: createSavingState(input),
      recovering: createRecoveringState(input),
      error: errorState,
    },
  });
