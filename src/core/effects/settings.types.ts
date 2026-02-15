import { pipe, Schema } from "effect";

export const TransitionIntensitySchema = Schema.Literal("low", "normal", "high");
export type TransitionIntensity = Schema.Schema.Type<typeof TransitionIntensitySchema>;

export const RedactionModeSchema = Schema.Literal("off", "standard", "strict");
export type RedactionMode = Schema.Schema.Type<typeof RedactionModeSchema>;

const MasterVolumeSchema = pipe(
  Schema.Number,
  Schema.filter((value) => value >= 0 && value <= 1, {
    message: () => "masterVolume must be between 0 and 1",
  }),
);

const AutosaveIntervalMsSchema = pipe(
  Schema.Number,
  Schema.filter(
    (value) => Number.isInteger(value) && value >= 250 && value <= 60_000,
    {
      message: () => "autosaveIntervalMs must be an integer between 250 and 60000",
    },
  ),
);

const HistoryRetentionDaysSchema = pipe(
  Schema.Number,
  Schema.filter(
    (value) => Number.isInteger(value) && value >= 1 && value <= 3_650,
    {
      message: () => "historyRetentionDays must be an integer between 1 and 3650",
    },
  ),
);

const BigBallOfMudAlertThresholdSchema = pipe(
  Schema.Number,
  Schema.filter(
    (value) => Number.isFinite(value) && value >= 5 && value <= 9.5,
    {
      message: () => "bigBallOfMudAlertThreshold must be between 5.0 and 9.5",
    },
  ),
);

const OpenAiApiKeySchema = pipe(
  Schema.String,
  Schema.filter(
    (value) => value.length <= 4_096,
    {
      message: () => "openAiApiKey must be 4096 characters or fewer",
    },
  ),
);

export const AppSettingsSchema = Schema.Struct({
  animationsEnabled: Schema.Boolean,
  transitionIntensity: TransitionIntensitySchema,
  masterAudioEnabled: Schema.Boolean,
  saveVolEnabled: Schema.Boolean,
  sirenEnabledDefault: Schema.Boolean,
  azurePanelVisible: Schema.Boolean,
  ownershipLensVisible: Schema.Boolean,
  couplingExplainabilityVisible: Schema.Boolean,
  masterVolume: MasterVolumeSchema,
  autosaveEnabled: Schema.Boolean,
  autosaveIntervalMs: AutosaveIntervalMsSchema,
  saveOnNavigate: Schema.Boolean,
  bigBallOfMudAlertThreshold: BigBallOfMudAlertThresholdSchema,
  telemetryEnabled: Schema.Boolean,
  redactionMode: RedactionModeSchema,
  historyRetentionDays: HistoryRetentionDaysSchema,
  openAiApiKey: OpenAiApiKeySchema,
});

export type AppSettings = Schema.Schema.Type<typeof AppSettingsSchema>;
export type AppSettingKey = keyof AppSettings;
export type AppSettingsPatch = Partial<AppSettings>;

export const DEFAULT_APP_SETTINGS: AppSettings = {
  animationsEnabled: true,
  transitionIntensity: "normal",
  masterAudioEnabled: true,
  saveVolEnabled: true,
  sirenEnabledDefault: true,
  azurePanelVisible: false,
  ownershipLensVisible: false,
  couplingExplainabilityVisible: false,
  masterVolume: 0.8,
  autosaveEnabled: true,
  autosaveIntervalMs: 1_500,
  saveOnNavigate: true,
  bigBallOfMudAlertThreshold: 8.0,
  telemetryEnabled: false,
  redactionMode: "strict",
  historyRetentionDays: 30,
  openAiApiKey: "",
};

export const APP_SETTING_KEYS = Object.freeze(
  Object.keys(DEFAULT_APP_SETTINGS) as AppSettingKey[],
) as ReadonlyArray<AppSettingKey>;

const APP_SETTING_KEY_SET = new Set<string>(APP_SETTING_KEYS);

export const isAppSettingKey = (value: string): value is AppSettingKey => APP_SETTING_KEY_SET.has(value);
