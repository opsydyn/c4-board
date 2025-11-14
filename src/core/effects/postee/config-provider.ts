/**
 * ConfigProvider - Effect Config-based environment variable service
 *
 * Uses Effect's Config module properly for type-safe, validated environment variables.
 *
 * Features:
 * - Uses Config.string(), Config.secret() for type-safe variable access
 * - Custom ConfigProvider.Provider for runtime variable resolution
 * - Template resolution ({{varName}} → actual value)
 * - Built-in validation and error handling
 *
 * Architecture:
 * - Effect Config: Type-safe configuration management
 * - ConfigProvider: Runtime provider for variable lookup
 * - Service Pattern: Tag-based dependency injection
 *
 * @see https://effect.website/docs/configuration/
 */

import {
	Effect,
	Context,
	Config,
	ConfigProvider as EffectConfigProvider,
	ConfigError,
	Redacted,
	Layer,
} from "effect";
import type { EnvironmentVariable } from "./schema";

// =============================================================================
// Service Definition
// =============================================================================

/**
 * PosteeConfigProvider service interface
 * Wraps Effect Config with Postee-specific functionality
 */
export interface PosteeConfigProviderService {
	/**
	 * Get string variable using Effect Config
	 */
	readonly getString: (
		key: string,
	) => Effect.Effect<string, ConfigError.ConfigError>;

	/**
	 * Get secret variable (value is redacted in logs)
	 */
	readonly getSecret: (
		key: string,
	) => Effect.Effect<Redacted.Redacted, ConfigError.ConfigError>;

	/**
	 * Get URL variable with validation
	 */
	readonly getUrl: (key: string) => Effect.Effect<URL, ConfigError.ConfigError>;

	/**
	 * Resolve template string with variables
	 * Replaces {{varName}} with actual values
	 *
	 * @example
	 * resolveTemplate("{{baseUrl}}/api/users")
	 * // => "https://api.dev.example.com/api/users"
	 */
	readonly resolveTemplate: (
		template: string,
	) => Effect.Effect<string, ConfigError.ConfigError>;

	/**
	 * Validate all variables in current environment
	 * Returns map of variable key → validation status
	 */
	readonly validateAll: (
		keys: string[],
	) => Effect.Effect<Record<string, boolean>, never>;
}

/**
 * Service Tag for dependency injection
 */
export class PosteeConfigProvider extends Context.Tag(
	"PosteeConfigProvider",
)<PosteeConfigProvider, PosteeConfigProviderService>() {}

// =============================================================================
// Implementation using Effect Config
// =============================================================================

/**
 * Implementation of PosteeConfigProviderService using Effect Config
 */
class PosteeConfigProviderImpl implements PosteeConfigProviderService {
	getString(key: string): Effect.Effect<string, ConfigError.ConfigError> {
		// Use Effect's Config.string to get a string config value
		return Config.string(key);
	}

	getSecret(
		key: string,
	): Effect.Effect<Redacted.Redacted, ConfigError.ConfigError> {
		// Use Effect's Config.secret for sensitive values
		return Config.redacted(key);
	}

	getUrl(key: string): Effect.Effect<URL, ConfigError.ConfigError> {
		// Get string and validate it's a URL
		return Config.string(key).pipe(
			Effect.flatMap((value) => {
				try {
					return Effect.succeed(new URL(value));
				} catch {
					return Effect.fail(
						ConfigError.InvalidData(
							[key],
							`"${key}" is not a valid URL: ${value}`,
						),
					);
				}
			}),
		);
	}

	resolveTemplate(
		template: string,
	): Effect.Effect<string, ConfigError.ConfigError> {
		// Find all {{varName}} patterns
		const matches = Array.from(template.matchAll(/\{\{([^}]+)\}\}/g));

		if (matches.length === 0) {
			return Effect.succeed(template);
		}

		return Effect.gen(this, function* () {
			let result = template;

			for (const match of matches) {
				const fullMatch = match[0]; // "{{varName}}"
				const varName = match[1]?.trim(); // "varName"

				if (!varName) continue;

				// Get variable value using Config
				const value = yield* Config.string(varName);

				// Replace in result
				result = result.replace(fullMatch, value);
			}

			return result;
		});
	}

	validateAll(
		keys: string[],
	): Effect.Effect<Record<string, boolean>, never> {
		return Effect.gen(this, function* () {
			const results: Record<string, boolean> = {};

			for (const key of keys) {
				// Try to get the value
				const result = yield* Config.string(key).pipe(
					Effect.map(() => true),
					Effect.catchAll(() => Effect.succeed(false)),
				);

				results[key] = result;
			}

			return results;
		});
	}
}

// =============================================================================
// Effect ConfigProvider Creation
// =============================================================================

/**
 * Create an Effect ConfigProvider from environment variables
 * This is the key part - we create a ConfigProvider.Provider that Effect Config uses
 */
export const makeEffectConfigProvider = (
	variables: EnvironmentVariable[],
): EffectConfigProvider.ConfigProvider => {
	// Build a map of enabled variables
	const variableMap = new Map(
		variables
			.filter((v) => v.is_enabled === 1)
			.map((v) => [v.key, v.value ?? ""]),
	);

	// Create a ConfigProvider.Provider using Effect's fromMap
	return EffectConfigProvider.fromMap(variableMap);
};

/**
 * Create a Layer that provides both Effect's ConfigProvider and our PosteeConfigProvider
 */
export const PosteeConfigProviderLive = (
	variables: EnvironmentVariable[],
): Layer.Layer<PosteeConfigProvider> => {
	return Layer.sync(PosteeConfigProvider, () => {
		return new PosteeConfigProviderImpl();
	}).pipe(
		// Set the ConfigProvider in the Effect runtime
		Layer.provide(
			Layer.setConfigProvider(makeEffectConfigProvider(variables)),
		),
	);
};

/**
 * Simple factory for testing without layers
 * Must be used with Effect.provide(Layer.setConfigProvider(...))
 *
 * Note: variables parameter is intentionally unused - the implementation
 * uses Effect Config which gets values from the Layer's ConfigProvider
 */
export const makeConfigProvider = (
	_variables?: EnvironmentVariable[],
): PosteeConfigProviderService => {
	console.log('_variables:', _variables);
	return new PosteeConfigProviderImpl();
};

// =============================================================================
// Template Resolution Helpers (Pure Functions)
// =============================================================================

/**
 * Pure function to extract variable names from template
 * No Effect wrapper needed - pure computation
 */
export const extractVariableNames = (template: string): string[] => {
	const matches = template.matchAll(/\{\{([^}]+)\}\}/g);
	return Array.from(matches)
		.map((match) => match[1]?.trim())
		.filter((name): name is string => name !== undefined);
};

/**
 * Pure function to check if string contains template variables
 */
export const hasVariables = (text: string): boolean => {
	return /\{\{[^}]+\}\}/.test(text);
};

/**
 * Resolve template with provided variable map (pure function)
 * Useful for testing without Effect context
 */
export const resolveTemplateSync = (
	template: string,
	variables: Record<string, string>,
): string => {
	let result = template;

	for (const [key, value] of Object.entries(variables)) {
		const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
		result = result.replace(pattern, value);
	}

	return result;
};
