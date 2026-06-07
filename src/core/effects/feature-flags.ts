import { Config, ConfigError, ConfigProvider, Effect, Either, pipe } from "effect";

type FeatureFlagSource = "env" | "default";
export type RigAgentV1RolloutMode = "disabled" | "canary" | "enabled";
export type RigAgentV1RolloutPreference = "inherit" | "canary";
export type RigAgentV1RolloutSource = FeatureFlagSource | "settings";

export interface SettingsV1FlagState {
  readonly enabled: boolean;
  readonly source: FeatureFlagSource;
  readonly envKey: string | null;
  readonly rawValue: string | null;
}

interface ResolveSettingsV1FlagInput {
  readonly importMetaEnv?: Record<string, unknown> | undefined;
  readonly processEnv?: Record<string, string | undefined> | undefined;
  readonly fallback?: boolean;
}

export interface RigAgentV1FlagState {
  readonly mode: RigAgentV1RolloutMode;
  readonly source: FeatureFlagSource;
  readonly envKey: string | null;
  readonly rawValue: string | null;
}

export interface EffectiveRigAgentV1RolloutState {
  readonly mode: RigAgentV1RolloutMode | "disabled";
  readonly baseMode: RigAgentV1RolloutMode;
  readonly preference: RigAgentV1RolloutPreference;
  readonly source: RigAgentV1RolloutSource;
  readonly envKey: string | null;
  readonly rawValue: string | null;
  readonly isEnabled: boolean;
  readonly isCanary: boolean;
}

const SETTINGS_V1_ENV_KEYS = [
  "PUBLIC_SETTINGS_V1",
  "VITE_SETTINGS_V1",
  "SETTINGS_V1",
] as const;

const RIG_AGENT_V1_ENV_KEYS = [
  "PUBLIC_RIG_AGENT_V1",
  "VITE_RIG_AGENT_V1",
  "RIG_AGENT_V1",
] as const;

const TRUTHY_FLAG_VALUES = new Set([
  "1",
  "true",
  "on",
  "yes",
  "enabled",
]);
const FALSY_FLAG_VALUES = new Set([
  "0",
  "false",
  "off",
  "no",
  "disabled",
]);

type ParsedFlagValue = {
  readonly enabled: boolean;
  readonly rawValue: string;
};

type ParsedRolloutValue = {
  readonly mode: RigAgentV1RolloutMode;
  readonly rawValue: string;
};

const parseBooleanFlag = (rawValue: string): boolean | null => {
  const normalized = rawValue.trim().toLowerCase();

  if (TRUTHY_FLAG_VALUES.has(normalized)) {
    return true;
  }
  if (FALSY_FLAG_VALUES.has(normalized)) {
    return false;
  }

  return null;
};

const parseRigAgentRolloutFlag = (rawValue: string): RigAgentV1RolloutMode | null => {
  const normalized = rawValue.trim().toLowerCase();
  const booleanValue = parseBooleanFlag(rawValue);

  if (booleanValue !== null) {
    return booleanValue ? "enabled" : "disabled";
  }

  if (
    normalized === "canary"
    || normalized === "pilot"
    || normalized === "preview"
  ) {
    return "canary";
  }

  return null;
};

const decodeBooleanFlagConfig = (
  key: string,
): Config.Config<ParsedFlagValue> =>
  pipe(
    Config.string(key),
    Config.mapOrFail((rawValue) => {
      const parsed = parseBooleanFlag(rawValue);
      if (parsed === null) {
        return Either.left(
          ConfigError.InvalidData(
            [key],
            `Expected boolean-like value for "${key}", got "${rawValue}"`,
          ),
        );
      }

      return Either.right({
        enabled: parsed,
        rawValue,
      });
    }),
  );

const decodeRigAgentRolloutConfig = (
  key: string,
): Config.Config<ParsedRolloutValue> =>
  pipe(
    Config.string(key),
    Config.mapOrFail((rawValue) => {
      const parsed = parseRigAgentRolloutFlag(rawValue);
      if (parsed === null) {
        return Either.left(
          ConfigError.InvalidData(
            [key],
            `Expected rollout value for "${key}", got "${rawValue}"`,
          ),
        );
      }

      return Either.right({
        mode: parsed,
        rawValue,
      });
    }),
  );

const readImportMetaEnv = (): Record<string, unknown> | undefined => {
  const candidate = (
    import.meta as ImportMeta & {
      env?: Record<string, unknown> | undefined;
    }
  ).env;

  if (!candidate || typeof candidate !== "object") {
    return undefined;
  }

  return candidate;
};

const readProcessEnv = (): Record<string, string | undefined> | undefined => {
  if (typeof process === "undefined") {
    return undefined;
  }
  if (!process || typeof process !== "object") {
    return undefined;
  }
  if (!("env" in process)) {
    return undefined;
  }

  const { env } = process;
  if (!env || typeof env !== "object") {
    return undefined;
  }

  return env;
};

export const resolveRigAgentV1DefaultFallback = (
  importMetaEnv?: Record<string, unknown> | undefined,
): boolean => {
  if (!importMetaEnv) {
    return false;
  }

  const rawDev = importMetaEnv.DEV;
  if (typeof rawDev === "boolean") {
    return rawDev;
  }
  if (typeof rawDev === "string") {
    const parsed = parseBooleanFlag(rawDev);
    if (parsed !== null) {
      return parsed;
    }
  }

  const rawMode = importMetaEnv.MODE;
  if (typeof rawMode === "string") {
    const normalized = rawMode.trim().toLowerCase();
    if (normalized === "development" || normalized === "dev") {
      return true;
    }
  }

  return false;
};

const createEnvProvider = (
  keys: readonly string[],
  env: Record<string, unknown>,
): ConfigProvider.ConfigProvider => {
  const map = new Map<string, string>();

  for (const key of keys) {
    const rawValue = env[key];
    if (rawValue === undefined || rawValue === null) {
      continue;
    }

    map.set(key, String(rawValue));
  }

  return ConfigProvider.fromMap(map);
};

const readConfigFromProvider = <A>(
  provider: ConfigProvider.ConfigProvider,
  config: Config.Config<A>,
): A | null => {
  const result = Effect.runSync(
    Effect.either(provider.load(config)),
  );

  if (Either.isLeft(result)) {
    return null;
  }

  return result.right;
};

export const resolveSettingsV1Flag = (
  input: ResolveSettingsV1FlagInput = {},
): SettingsV1FlagState => {
  const fallback = input.fallback ?? true;
  const envCandidates = [input.importMetaEnv, input.processEnv];

  for (const env of envCandidates) {
    if (!env) {
      continue;
    }

    const provider = createEnvProvider(SETTINGS_V1_ENV_KEYS, env);
    for (const key of SETTINGS_V1_ENV_KEYS) {
      const decoded = readConfigFromProvider(provider, decodeBooleanFlagConfig(key));
      if (!decoded) {
        continue;
      }

      return {
        enabled: decoded.enabled,
        source: "env",
        envKey: key,
        rawValue: decoded.rawValue,
      };
    }
  }

  return {
    enabled: fallback,
    source: "default",
    envKey: null,
    rawValue: null,
  };
};

export const resolveRigAgentV1Flag = (
  input: ResolveSettingsV1FlagInput = {},
): RigAgentV1FlagState => {
  const fallback: RigAgentV1RolloutMode = input.fallback ? "enabled" : "disabled";
  const envCandidates = [input.importMetaEnv, input.processEnv];

  for (const env of envCandidates) {
    if (!env) {
      continue;
    }

    const provider = createEnvProvider(RIG_AGENT_V1_ENV_KEYS, env);
    for (const key of RIG_AGENT_V1_ENV_KEYS) {
      const decoded = readConfigFromProvider(provider, decodeRigAgentRolloutConfig(key));
      if (!decoded) {
        continue;
      }

      return {
        mode: decoded.mode,
        source: "env",
        envKey: key,
        rawValue: decoded.rawValue,
      };
    }
  }

  return {
    mode: fallback,
    source: "default",
    envKey: null,
    rawValue: null,
  };
};

export const resolveEffectiveRigAgentV1Rollout = (
  flag: RigAgentV1FlagState,
  preference: RigAgentV1RolloutPreference,
): EffectiveRigAgentV1RolloutState => {
  if (flag.mode === "disabled") {
    return {
      mode: "disabled",
      baseMode: flag.mode,
      preference,
      source: flag.source,
      envKey: flag.envKey,
      rawValue: flag.rawValue,
      isEnabled: false,
      isCanary: false,
    };
  }

  if (flag.mode === "enabled") {
    return {
      mode: "enabled",
      baseMode: flag.mode,
      preference,
      source: flag.source,
      envKey: flag.envKey,
      rawValue: flag.rawValue,
      isEnabled: true,
      isCanary: false,
    };
  }

  if (preference === "canary") {
    return {
      mode: "canary",
      baseMode: flag.mode,
      preference,
      source: "settings",
      envKey: flag.envKey,
      rawValue: flag.rawValue,
      isEnabled: true,
      isCanary: true,
    };
  }

  return {
    mode: "disabled",
    baseMode: flag.mode,
    preference,
    source: "default",
    envKey: flag.envKey,
    rawValue: flag.rawValue,
    isEnabled: false,
    isCanary: false,
  };
};

const SETTINGS_V1_FLAG = resolveSettingsV1Flag({
  importMetaEnv: readImportMetaEnv(),
  processEnv: readProcessEnv(),
  fallback: true,
});

const RIG_AGENT_V1_FLAG = resolveRigAgentV1Flag({
  importMetaEnv: readImportMetaEnv(),
  processEnv: readProcessEnv(),
  fallback: resolveRigAgentV1DefaultFallback(readImportMetaEnv()),
});

export const getSettingsV1Flag = (): SettingsV1FlagState => SETTINGS_V1_FLAG;

export const isSettingsV1Enabled = (): boolean => SETTINGS_V1_FLAG.enabled;

export const getRigAgentV1Flag = (): RigAgentV1FlagState => RIG_AGENT_V1_FLAG;
