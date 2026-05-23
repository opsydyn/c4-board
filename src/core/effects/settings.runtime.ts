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

    return yield* decodeSettings({
      ...DEFAULT_APP_SETTINGS,
      ...overrides,
    });
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
    const mergedCandidate = {
      ...currentSettings,
      ...patch,
    };
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
