import { Config, ConfigError, ConfigProvider, Effect, Either, pipe } from "effect";

type FeatureFlagSource = "env" | "default";

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

const SETTINGS_V1_ENV_KEYS = [
  "PUBLIC_SETTINGS_V1",
  "VITE_SETTINGS_V1",
  "SETTINGS_V1",
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

const createEnvProvider = (
  env: Record<string, unknown>,
): ConfigProvider.ConfigProvider => {
  const map = new Map<string, string>();

  for (const key of SETTINGS_V1_ENV_KEYS) {
    const rawValue = env[key];
    if (rawValue === undefined || rawValue === null) {
      continue;
    }

    map.set(key, String(rawValue));
  }

  return ConfigProvider.fromMap(map);
};

const readFlagFromProvider = (
  provider: ConfigProvider.ConfigProvider,
  key: (typeof SETTINGS_V1_ENV_KEYS)[number],
): ParsedFlagValue | null => {
  const result = Effect.runSync(
    Effect.either(provider.load(decodeBooleanFlagConfig(key))),
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

    const provider = createEnvProvider(env);
    for (const key of SETTINGS_V1_ENV_KEYS) {
      const decoded = readFlagFromProvider(provider, key);
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

const SETTINGS_V1_FLAG = resolveSettingsV1Flag({
  importMetaEnv: readImportMetaEnv(),
  processEnv: readProcessEnv(),
  fallback: true,
});

export const getSettingsV1Flag = (): SettingsV1FlagState => SETTINGS_V1_FLAG;

export const isSettingsV1Enabled = (): boolean => SETTINGS_V1_FLAG.enabled;
