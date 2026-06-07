import { Data, Effect, ParseResult, pipe, Schema } from "effect";
import { DatabaseError, DatabaseService } from "./database.base";
import type { AppSettingKey, AppSettings, AppSettingsPatch } from "./settings.types";
import { APP_SETTING_KEYS, AppSettingsSchema, DEFAULT_APP_SETTINGS, isAppSettingKey } from "./settings.types";

interface AppSettingRow {
  key: string;
  value: string;
  updated_at: number;
}

const LEGACY_APP_SETTING_KEY_ALIASES: Readonly<Record<string, AppSettingKey>> = {
  saveChimeEnabled: "saveVolEnabled",
};

const OPY_WIDGET_WIDTH_MIN = 360;
const OPY_WIDGET_WIDTH_MAX = 4_096;
const OPY_WIDGET_HEIGHT_MIN = 420;
const OPY_WIDGET_HEIGHT_MAX = 4_096;
const OPY_WIDGET_COORDINATE_MIN = 0;
const OPY_WIDGET_COORDINATE_MAX = 16_384;

const OPY_WIDGET_PRESENCE_ALIASES = {
  launcher: "orb",
  surface: "field",
} as const satisfies Partial<Record<string, AppSettings["opyWidgetPresence"]>>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const normalizeEnumValue = <TValue extends string>(
  value: unknown,
  allowed: ReadonlyArray<TValue>,
  fallback: TValue,
  aliases?: Partial<Record<string, TValue>>,
): TValue => {
  if (typeof value !== "string") {
    return fallback;
  }

  if ((allowed as ReadonlyArray<string>).includes(value)) {
    return value as TValue;
  }

  return aliases?.[value] ?? fallback;
};

const normalizeBooleanValue = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

const normalizeNumberValue = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return clampNumber(value, min, max);
};

const normalizeOpyWidgetLayout = (
  value: unknown,
  fallback: AppSettings["opyWidgetLayout"],
): AppSettings["opyWidgetLayout"] => {
  const record = isRecord(value) ? value : {};

  return {
    placement: normalizeEnumValue(record.placement, ["centered", "custom"], fallback.placement),
    mode: normalizeEnumValue(record.mode, ["field", "mission"], fallback.mode),
    snapTarget: normalizeEnumValue(
      record.snapTarget,
      ["free", "center", "left-rail", "right-rail", "bottom-dock"],
      fallback.snapTarget,
    ),
    x: normalizeNumberValue(
      record.x,
      fallback.x,
      OPY_WIDGET_COORDINATE_MIN,
      OPY_WIDGET_COORDINATE_MAX,
    ),
    y: normalizeNumberValue(
      record.y,
      fallback.y,
      OPY_WIDGET_COORDINATE_MIN,
      OPY_WIDGET_COORDINATE_MAX,
    ),
    width: normalizeNumberValue(
      record.width,
      fallback.width,
      OPY_WIDGET_WIDTH_MIN,
      OPY_WIDGET_WIDTH_MAX,
    ),
    height: normalizeNumberValue(
      record.height,
      fallback.height,
      OPY_WIDGET_HEIGHT_MIN,
      OPY_WIDGET_HEIGHT_MAX,
    ),
  };
};

const normalizeOpyWidgetModeLayouts = (
  value: unknown,
  fallback: AppSettings["opyWidgetModeLayouts"],
): AppSettings["opyWidgetModeLayouts"] => {
  const record = isRecord(value) ? value : {};

  return {
    field: normalizeOpyWidgetLayout(record.field, fallback.field),
    mission: normalizeOpyWidgetLayout(record.mission, fallback.mission),
  };
};

const normalizeOpyViewportSections = (
  value: unknown,
  fallback: AppSettings["opyViewportSections"],
): AppSettings["opyViewportSections"] => {
  const record = isRecord(value) ? value : {};

  return {
    control: normalizeBooleanValue(record.control, fallback.control),
    diagnostics: normalizeBooleanValue(record.diagnostics, fallback.diagnostics),
    checkpoints: normalizeBooleanValue(record.checkpoints, fallback.checkpoints),
    review: normalizeBooleanValue(record.review, fallback.review),
    proposal: normalizeBooleanValue(record.proposal, fallback.proposal),
  };
};

const normalizeOpyTaskHistoryFiltersBySession = (
  value: unknown,
): AppSettings["opyTaskHistoryFiltersBySession"] => {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([sessionId, rawFilter]) => {
      const record = isRecord(rawFilter) ? rawFilter : {};
      const normalizedChain = typeof record.chain === "string" && record.chain.trim().length > 0
        ? record.chain.trim()
        : "all";

      return [
        sessionId,
        {
          chain: normalizedChain,
          boundary: normalizeEnumValue(
            record.boundary,
            ["all", "reused-current-session", "reused-inherited-session", "reran", "pending"],
            "all",
          ),
          chainScope: normalizeEnumValue(
            record.chainScope,
            ["all", "active", "interrupted", "cross-session", "low-efficiency"],
            "all",
          ),
        },
      ];
    }),
  );
};

export const normalizeAppSettingsCandidate = (
  input: Partial<Record<AppSettingKey, unknown>>,
  fallback: AppSettings,
): Partial<Record<AppSettingKey, unknown>> => ({
  ...input,
  opyWidgetPresence: normalizeEnumValue(
    input.opyWidgetPresence,
    ["orb", "field", "mission"],
    fallback.opyWidgetPresence,
    OPY_WIDGET_PRESENCE_ALIASES,
  ),
  opyWidgetLayout: normalizeOpyWidgetLayout(input.opyWidgetLayout, fallback.opyWidgetLayout),
  opyWidgetModeLayouts: normalizeOpyWidgetModeLayouts(
    input.opyWidgetModeLayouts,
    fallback.opyWidgetModeLayouts,
  ),
  opyViewportSections: normalizeOpyViewportSections(
    input.opyViewportSections,
    fallback.opyViewportSections,
  ),
  opyTaskHistoryFiltersBySession: normalizeOpyTaskHistoryFiltersBySession(
    input.opyTaskHistoryFiltersBySession,
  ),
});

const SELECT_APP_SETTINGS_SQL = `
	SELECT key, value, updated_at
	FROM app_settings
`;

const UPSERT_APP_SETTING_SQL = `
	INSERT INTO app_settings (key, value, updated_at)
	VALUES (?, ?, ?)
	ON CONFLICT(key) DO UPDATE SET
		value = excluded.value,
		updated_at = excluded.updated_at
`;

export class SettingsValidationError extends Data.TaggedError(
  "SettingsValidationError",
)<{
  readonly message: string;
  readonly cause?: ParseResult.ParseError | SyntaxError;
}> {}

const decodeSettings = (
  input: unknown,
): Effect.Effect<AppSettings, SettingsValidationError> =>
  pipe(
    Schema.decodeUnknown(AppSettingsSchema)(input),
    Effect.mapError(
      (cause) =>
        new SettingsValidationError({
          message: `App settings schema validation failed: ${cause.message}`,
          cause,
        }),
    ),
  );

const parseStoredSetting = (
  key: AppSettingKey,
  rawValue: string,
): Effect.Effect<unknown, SettingsValidationError> =>
  Effect.try({
    try: () => JSON.parse(rawValue),
    catch: (cause) => {
      if (cause instanceof SyntaxError) {
        return new SettingsValidationError({
          message: `Stored setting "${key}" is not valid JSON`,
          cause,
        });
      }

      return new SettingsValidationError({
        message: `Stored setting "${key}" is not valid JSON`,
      });
    },
  });

const toAppSettingKey = (rawKey: string): AppSettingKey | null => {
  if (isAppSettingKey(rawKey)) {
    return rawKey;
  }

  return LEGACY_APP_SETTING_KEY_ALIASES[rawKey] ?? null;
};

const stableSerializeSettingValue = (value: unknown): string | null => {
  if (value === null || typeof value !== "object") {
    return null;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
};

const areSettingValuesEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) {
    return true;
  }

  const leftSerialized = stableSerializeSettingValue(left);
  const rightSerialized = stableSerializeSettingValue(right);

  if (leftSerialized === null || rightSerialized === null) {
    return false;
  }

  return leftSerialized === rightSerialized;
};

const hydrateSettings = (
  rows: ReadonlyArray<AppSettingRow>,
): Effect.Effect<AppSettings, SettingsValidationError> =>
  Effect.gen(function*() {
    const overrides: Partial<Record<AppSettingKey, unknown>> = {};
    const hasCanonicalSaveVolEnabled = rows.some(
      (row) => row.key === "saveVolEnabled",
    );

    for (const row of rows) {
      if (hasCanonicalSaveVolEnabled && row.key === "saveChimeEnabled") {
        continue;
      }

      const key = toAppSettingKey(row.key);
      if (key === null) {
        continue;
      }
      const parsedValue = yield* parseStoredSetting(key, row.value);
      overrides[key] = parsedValue;
    }

    return yield* decodeSettings(normalizeAppSettingsCandidate({
      ...DEFAULT_APP_SETTINGS,
      ...overrides,
    }, DEFAULT_APP_SETTINGS));
  });

const serializeSettingValue = (
  value: AppSettings[AppSettingKey],
): string => JSON.stringify(value);

const toSettingEntries = (
  settings: AppSettings,
): ReadonlyArray<readonly [AppSettingKey, AppSettings[AppSettingKey]]> =>
  APP_SETTING_KEYS.map((key) => [key, settings[key]] as const);

const upsertSettingEntries = (
  entries: ReadonlyArray<
    readonly [AppSettingKey, AppSettings[AppSettingKey]]
  >,
  updatedAt: number,
): Effect.Effect<void, DatabaseError, DatabaseService> =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;

    yield* service.transaction(
      Effect.gen(function*() {
        for (const [key, value] of entries) {
          yield* service.execute(UPSERT_APP_SETTING_SQL, [
            key,
            serializeSettingValue(value),
            updatedAt,
          ]);
        }
      }),
    );
  });

export const getSettings = (): Effect.Effect<
  AppSettings,
  DatabaseError | SettingsValidationError,
  DatabaseService
> =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    const rows = yield* service.query<AppSettingRow>(SELECT_APP_SETTINGS_SQL);
    return yield* hydrateSettings(rows);
  });

export const patchSettings = (
  patch: AppSettingsPatch,
): Effect.Effect<AppSettings, DatabaseError | SettingsValidationError, DatabaseService> =>
  Effect.gen(function*() {
    const currentSettings = yield* getSettings();
    const mergedCandidate = normalizeAppSettingsCandidate({
      ...currentSettings,
      ...patch,
    }, currentSettings);
    const nextSettings = yield* decodeSettings(mergedCandidate);
    const changedKeys = APP_SETTING_KEYS.filter(
      (key) => !areSettingValuesEqual(currentSettings[key], nextSettings[key]),
    );

    if (changedKeys.length === 0) {
      return currentSettings;
    }

    const updateTimestamp = Date.now();
    yield* upsertSettingEntries(
      changedKeys.map(
        (key) => [key, nextSettings[key]] as const,
      ),
      updateTimestamp,
    );
    return nextSettings;
  });

export const resetSettings = (): Effect.Effect<
  AppSettings,
  DatabaseError | SettingsValidationError,
  DatabaseService
> =>
  Effect.gen(function*() {
    const updateTimestamp = Date.now();
    yield* upsertSettingEntries(
      toSettingEntries(DEFAULT_APP_SETTINGS),
      updateTimestamp,
    );
    return yield* decodeSettings(DEFAULT_APP_SETTINGS);
  });
