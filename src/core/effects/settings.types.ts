import { pipe, Schema } from "effect";

export const TransitionIntensitySchema = Schema.Literal("low", "normal", "high");
export type TransitionIntensity = Schema.Schema.Type<typeof TransitionIntensitySchema>;

export const RedactionModeSchema = Schema.Literal("off", "standard", "strict");
export type RedactionMode = Schema.Schema.Type<typeof RedactionModeSchema>;

export const AiProviderSchema = Schema.Literal("openai", "anthropic", "openrouter");
export type AiProvider = Schema.Schema.Type<typeof AiProviderSchema>;

export const AiActionModeSchema = Schema.Literal(
  "disabled",
  "read-only",
  "propose",
  "apply-with-confirmation",
);
export type AiActionMode = Schema.Schema.Type<typeof AiActionModeSchema>;

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

const AiModelSchema = pipe(
  Schema.String,
  Schema.filter(
    (value) => value.length > 0 && value.length <= 128,
    {
      message: () => "aiSettings.model must be between 1 and 128 characters",
    },
  ),
);

const AiTemperatureSchema = pipe(
  Schema.Number,
  Schema.filter(
    (value) => Number.isFinite(value) && value >= 0 && value <= 2,
    {
      message: () => "aiSettings.temperature must be between 0 and 2",
    },
  ),
);

const AiMaxTokensSchema = pipe(
  Schema.Number,
  Schema.filter(
    (value) => Number.isInteger(value) && value >= 64 && value <= 32_768,
    {
      message: () => "aiSettings.maxTokens must be an integer between 64 and 32768",
    },
  ),
);

export const AiSettingsSchema = Schema.Struct({
  provider: AiProviderSchema,
  model: AiModelSchema,
  temperature: AiTemperatureSchema,
  maxTokens: AiMaxTokensSchema,
  actionMode: AiActionModeSchema,
});

export type AiSettings = Schema.Schema.Type<typeof AiSettingsSchema>;

const OpyWidgetPlacementSchema = Schema.Literal("centered", "custom");
export type OpyWidgetPlacement = Schema.Schema.Type<typeof OpyWidgetPlacementSchema>;

const OpyWidgetWidthSchema = pipe(
  Schema.Number,
  Schema.filter(
    (value) => Number.isFinite(value) && value >= 360 && value <= 960,
    {
      message: () => "opyWidgetLayout.width must be between 360 and 960",
    },
  ),
);

const OpyWidgetHeightSchema = pipe(
  Schema.Number,
  Schema.filter(
    (value) => Number.isFinite(value) && value >= 420 && value <= 960,
    {
      message: () => "opyWidgetLayout.height must be between 420 and 960",
    },
  ),
);

const OpyWidgetCoordinateSchema = pipe(
  Schema.Number,
  Schema.filter(
    (value) => Number.isFinite(value) && value >= 0 && value <= 16_384,
    {
      message: () => "opyWidgetLayout coordinates must be between 0 and 16384",
    },
  ),
);

export const OpyWidgetLayoutSchema = Schema.Struct({
  placement: OpyWidgetPlacementSchema,
  x: OpyWidgetCoordinateSchema,
  y: OpyWidgetCoordinateSchema,
  width: OpyWidgetWidthSchema,
  height: OpyWidgetHeightSchema,
});

export type OpyWidgetLayout = Schema.Schema.Type<typeof OpyWidgetLayoutSchema>;

export const AppSettingsSchema = Schema.Struct({
  animationsEnabled: Schema.Boolean,
  transitionIntensity: TransitionIntensitySchema,
  masterAudioEnabled: Schema.Boolean,
  saveVolEnabled: Schema.Boolean,
  sirenEnabledDefault: Schema.Boolean,
  azurePanelVisible: Schema.Boolean,
  ownershipLensVisible: Schema.Boolean,
  couplingExplainabilityVisible: Schema.Boolean,
  opyCopilotVisible: Schema.Boolean,
  opyWidgetLayout: OpyWidgetLayoutSchema,
  masterVolume: MasterVolumeSchema,
  autosaveEnabled: Schema.Boolean,
  autosaveIntervalMs: AutosaveIntervalMsSchema,
  saveOnNavigate: Schema.Boolean,
  bigBallOfMudAlertThreshold: BigBallOfMudAlertThresholdSchema,
  telemetryEnabled: Schema.Boolean,
  redactionMode: RedactionModeSchema,
  historyRetentionDays: HistoryRetentionDaysSchema,
  openAiApiKey: OpenAiApiKeySchema,
  aiSettings: AiSettingsSchema,
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
  opyCopilotVisible: false,
  opyWidgetLayout: {
    placement: "centered",
    x: 0,
    y: 0,
    width: 560,
    height: 720,
  },
  masterVolume: 0.8,
  autosaveEnabled: true,
  autosaveIntervalMs: 1_500,
  saveOnNavigate: true,
  bigBallOfMudAlertThreshold: 8.0,
  telemetryEnabled: false,
  redactionMode: "strict",
  historyRetentionDays: 30,
  openAiApiKey: "",
  aiSettings: {
    provider: "openai",
    model: "gpt-4o-mini",
    temperature: 0.2,
    maxTokens: 1_024,
    actionMode: "read-only",
  },
};

export const APP_SETTING_KEYS = Object.freeze(
  Object.keys(DEFAULT_APP_SETTINGS) as AppSettingKey[],
) as ReadonlyArray<AppSettingKey>;

const APP_SETTING_KEY_SET = new Set<string>(APP_SETTING_KEYS);

export const isAppSettingKey = (value: string): value is AppSettingKey => APP_SETTING_KEY_SET.has(value);
