import { pipe, Schema } from "effect";
import {
  type RigExecutionPolicySettings,
  RigExecutionPolicySettingsSchema,
  type RigMutationPolicySettings,
  RigMutationPolicySettingsSchema,
} from "./agent-policy";

export const TransitionIntensitySchema = Schema.Literal("low", "normal", "high");
export type TransitionIntensity = Schema.Schema.Type<typeof TransitionIntensitySchema>;

/**
 * Azure sync apply guardrails (ADR-020).
 *
 * `archiveMissing` defaults to off: a sync that stops seeing a resource leaves
 * it on the board. A truncated page and a deleted estate are indistinguishable
 * from the diff's point of view, and only one of those is recoverable.
 */
export const AzureSyncPolicySettingsSchema = Schema.Struct({
  archiveMissing: Schema.Boolean,
  maxApplyOperations: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
});

export type AzureSyncPolicySettings = Schema.Schema.Type<typeof AzureSyncPolicySettingsSchema>;

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

export const RigAgentV1RolloutPreferenceSchema = Schema.Literal("inherit", "canary");
export type RigAgentV1RolloutPreference = Schema.Schema.Type<typeof RigAgentV1RolloutPreferenceSchema>;

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

export const OpyWidgetModeSchema = Schema.Literal("field", "mission");
export type OpyWidgetMode = Schema.Schema.Type<typeof OpyWidgetModeSchema>;

export const OpyWidgetPresenceSchema = Schema.Literal("orb", "field", "mission");
export type OpyWidgetPresence = Schema.Schema.Type<typeof OpyWidgetPresenceSchema>;

export const OpySurfaceModeSchema = Schema.Literal("drawer", "floating");
export type OpySurfaceMode = Schema.Schema.Type<typeof OpySurfaceModeSchema>;

export const OpyViewportSectionKeySchema = Schema.Literal(
  "control",
  "diagnostics",
  "checkpoints",
  "review",
  "proposal",
);
export type OpyViewportSectionKey = Schema.Schema.Type<typeof OpyViewportSectionKeySchema>;

export const OpyViewportSectionsSchema = Schema.Struct({
  control: Schema.Boolean,
  diagnostics: Schema.Boolean,
  checkpoints: Schema.Boolean,
  review: Schema.Boolean,
  proposal: Schema.Boolean,
});

export type OpyViewportSections = Schema.Schema.Type<typeof OpyViewportSectionsSchema>;

export const OpyTaskHistoryBoundaryFilterSchema = Schema.Literal(
  "all",
  "reused-current-session",
  "reused-inherited-session",
  "reran",
  "pending",
);
export type OpyTaskHistoryBoundaryFilter = Schema.Schema.Type<typeof OpyTaskHistoryBoundaryFilterSchema>;

export const OpyTaskHistoryChainScopeFilterSchema = Schema.Literal(
  "all",
  "active",
  "interrupted",
  "cross-session",
  "low-efficiency",
);
export type OpyTaskHistoryChainScopeFilter = Schema.Schema.Type<typeof OpyTaskHistoryChainScopeFilterSchema>;

const OpyTaskHistoryChainFilterSchema = pipe(
  Schema.String,
  Schema.filter(
    (value) => value.length > 0 && value.length <= 512,
    {
      message: () => "opyTaskHistory chain filter must be between 1 and 512 characters",
    },
  ),
);

export const OpyTaskHistoryFilterStateSchema = Schema.Struct({
  chain: OpyTaskHistoryChainFilterSchema,
  boundary: OpyTaskHistoryBoundaryFilterSchema,
  chainScope: Schema.optionalWith(OpyTaskHistoryChainScopeFilterSchema, {
    default: () => "all" as const,
  }),
});

export type OpyTaskHistoryFilterState = Schema.Schema.Type<typeof OpyTaskHistoryFilterStateSchema>;

export const OpyTaskHistoryFiltersBySessionSchema = Schema.Record({
  key: Schema.String,
  value: OpyTaskHistoryFilterStateSchema,
});

export type OpyTaskHistoryFiltersBySession = Schema.Schema.Type<typeof OpyTaskHistoryFiltersBySessionSchema>;

export const OpyWidgetSnapTargetSchema = Schema.Literal(
  "free",
  "center",
  "left-rail",
  "right-rail",
  "bottom-dock",
);
export type OpyWidgetSnapTarget = Schema.Schema.Type<typeof OpyWidgetSnapTargetSchema>;

const OpyWidgetWidthSchema = pipe(
  Schema.Number,
  Schema.filter(
    (value) => Number.isFinite(value) && value >= 360 && value <= 4_096,
    {
      message: () => "opyWidgetLayout.width must be between 360 and 4096",
    },
  ),
);

const OpyWidgetHeightSchema = pipe(
  Schema.Number,
  Schema.filter(
    (value) => Number.isFinite(value) && value >= 420 && value <= 4_096,
    {
      message: () => "opyWidgetLayout.height must be between 420 and 4096",
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
  mode: Schema.optionalWith(OpyWidgetModeSchema, {
    default: () => "field" as const,
  }),
  snapTarget: Schema.optionalWith(OpyWidgetSnapTargetSchema, {
    default: () => "free" as const,
  }),
  x: OpyWidgetCoordinateSchema,
  y: OpyWidgetCoordinateSchema,
  width: OpyWidgetWidthSchema,
  height: OpyWidgetHeightSchema,
});

export type OpyWidgetLayout = Schema.Schema.Type<typeof OpyWidgetLayoutSchema>;

export const OpyWidgetModeLayoutsSchema = Schema.Struct({
  field: OpyWidgetLayoutSchema,
  mission: OpyWidgetLayoutSchema,
});

export type OpyWidgetModeLayouts = Schema.Schema.Type<typeof OpyWidgetModeLayoutsSchema>;

export const AppSettingsSchema = Schema.Struct({
  animationsEnabled: Schema.Boolean,
  transitionIntensity: TransitionIntensitySchema,
  masterAudioEnabled: Schema.Boolean,
  saveVolEnabled: Schema.Boolean,
  sirenEnabledDefault: Schema.Boolean,
  // Which mode the board opens in. Persisted so leaving for Postee and coming
  // back returns you to the storm, DDD or C4 board you left.
  boardDomain: Schema.Literal("c4", "ddd", "eventStorming"),
  azurePanelVisible: Schema.Boolean,
  ownershipLensVisible: Schema.Boolean,
  couplingExplainabilityVisible: Schema.Boolean,
  opyCopilotVisible: Schema.Boolean,
  opySurfaceMode: OpySurfaceModeSchema,
  opyWidgetPresence: OpyWidgetPresenceSchema,
  opyWidgetLayout: OpyWidgetLayoutSchema,
  opyWidgetModeLayouts: OpyWidgetModeLayoutsSchema,
  opyViewportSections: OpyViewportSectionsSchema,
  opyTaskHistoryFiltersBySession: OpyTaskHistoryFiltersBySessionSchema,
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
  rigAgentRolloutPreference: RigAgentV1RolloutPreferenceSchema,
  rigExecutionPolicy: RigExecutionPolicySettingsSchema,
  agentPolicy: RigMutationPolicySettingsSchema,
  azureSyncPolicy: AzureSyncPolicySettingsSchema,
});

export type AppSettings = Schema.Schema.Type<typeof AppSettingsSchema>;
export type AppSettingKey = keyof AppSettings;
export type AppSettingsPatch = Partial<AppSettings>;

export const DEFAULT_APP_SETTINGS: AppSettings = {
  animationsEnabled: true,
  transitionIntensity: "normal",
  // Silent until asked. This gates every sound the app makes, so one default
  // covers the save cue and the load-test siren alike. ADR-019 made the alarm
  // opt-in on the grounds that anything making noise on someone's machine should
  // be opted into; the save cue was left on because it is quieter, which is not
  // the same as being asked for — a fresh profile played a tone at 80% the first
  // time anything was saved.
  masterAudioEnabled: false,
  // Sub-switches stay on: turning the master on should give you audio, not send
  // you hunting for two more toggles.
  saveVolEnabled: true,
  // The alarm is opt-in even once audio is on. It is the loudest thing here and
  // it runs for the length of a load test.
  sirenEnabledDefault: false,
  boardDomain: "c4",
  azurePanelVisible: false,
  ownershipLensVisible: false,
  couplingExplainabilityVisible: false,
  opyCopilotVisible: false,
  opySurfaceMode: "drawer",
  opyWidgetPresence: "field",
  opyWidgetLayout: {
    placement: "centered",
    mode: "field",
    snapTarget: "center",
    x: 0,
    y: 0,
    width: 560,
    height: 720,
  },
  opyWidgetModeLayouts: {
    field: {
      placement: "centered",
      mode: "field",
      snapTarget: "center",
      x: 0,
      y: 0,
      width: 560,
      height: 720,
    },
    mission: {
      placement: "centered",
      mode: "mission",
      snapTarget: "center",
      x: 0,
      y: 0,
      width: 860,
      height: 900,
    },
  },
  opyViewportSections: {
    control: false,
    diagnostics: false,
    checkpoints: false,
    review: false,
    proposal: false,
  },
  opyTaskHistoryFiltersBySession: {},
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
  rigAgentRolloutPreference: "inherit",
  rigExecutionPolicy: {
    killSwitchEnabled: false,
    allowedProviders: ["openai"],
    allowedModels: ["gpt-4o-mini", "gpt-4.1-mini"],
  } satisfies RigExecutionPolicySettings,
  agentPolicy: {
    maxActionsPerBatch: 48,
    maxNodesCreatedPerRun: 12,
    maxEdgesCreatedPerRun: 24,
    allowSettingsMutation: false,
  } satisfies RigMutationPolicySettings,
  azureSyncPolicy: {
    // Off, so the destructive path is something an operator chooses rather than
    // something a scope typo does to them.
    archiveMissing: false,
    // Sized to admit an ordinary estate sync while stopping a runaway one. An
    // operator with a larger estate raises it deliberately.
    maxApplyOperations: 250,
  } satisfies AzureSyncPolicySettings,
};

export const APP_SETTING_KEYS = Object.freeze(
  Object.keys(DEFAULT_APP_SETTINGS) as AppSettingKey[],
) as ReadonlyArray<AppSettingKey>;

const APP_SETTING_KEY_SET = new Set<string>(APP_SETTING_KEYS);

export const isAppSettingKey = (value: string): value is AppSettingKey => APP_SETTING_KEY_SET.has(value);
