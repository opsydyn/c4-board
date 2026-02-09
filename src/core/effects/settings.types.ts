import { Schema, pipe } from "effect";

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
		(value) =>
			Number.isInteger(value) && value >= 250 && value <= 60_000,
		{
			message: () =>
				"autosaveIntervalMs must be an integer between 250 and 60000",
		},
	),
);

const HistoryRetentionDaysSchema = pipe(
	Schema.Number,
	Schema.filter(
		(value) =>
			Number.isInteger(value) && value >= 1 && value <= 3_650,
		{
			message: () =>
				"historyRetentionDays must be an integer between 1 and 3650",
		},
	),
);

export const AppSettingsSchema = Schema.Struct({
	animationsEnabled: Schema.Boolean,
	transitionIntensity: TransitionIntensitySchema,
	masterAudioEnabled: Schema.Boolean,
	saveChimeEnabled: Schema.Boolean,
	sirenEnabledDefault: Schema.Boolean,
	masterVolume: MasterVolumeSchema,
	autosaveEnabled: Schema.Boolean,
	autosaveIntervalMs: AutosaveIntervalMsSchema,
	saveOnNavigate: Schema.Boolean,
	telemetryEnabled: Schema.Boolean,
	redactionMode: RedactionModeSchema,
	historyRetentionDays: HistoryRetentionDaysSchema,
});

export type AppSettings = Schema.Schema.Type<typeof AppSettingsSchema>;
export type AppSettingKey = keyof AppSettings;
export type AppSettingsPatch = Partial<AppSettings>;

export const DEFAULT_APP_SETTINGS: AppSettings = {
	animationsEnabled: true,
	transitionIntensity: "normal",
	masterAudioEnabled: true,
	saveChimeEnabled: true,
	sirenEnabledDefault: true,
	masterVolume: 0.8,
	autosaveEnabled: true,
	autosaveIntervalMs: 1_500,
	saveOnNavigate: true,
	telemetryEnabled: false,
	redactionMode: "strict",
	historyRetentionDays: 30,
};

export const APP_SETTING_KEYS = Object.freeze(
	Object.keys(DEFAULT_APP_SETTINGS) as AppSettingKey[],
) as ReadonlyArray<AppSettingKey>;

const APP_SETTING_KEY_SET = new Set<string>(APP_SETTING_KEYS);

export const isAppSettingKey = (value: string): value is AppSettingKey =>
	APP_SETTING_KEY_SET.has(value);
