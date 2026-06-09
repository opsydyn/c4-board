/**
 * ConfigProvider Tests
 *
 * Tests for Effect Config-based environment variable management
 */

import { ConfigError, Effect } from "effect";
import { describe, expect, it } from "vitest";
import {
  extractVariableNames,
  hasVariables,
  makeConfigProvider,
  PosteeConfigProviderLive,
  resolveTemplateSync,
} from "./config-provider";
import type { EnvironmentVariable } from "./schema";

// =============================================================================
// Test Data
// =============================================================================

const mockVariables: EnvironmentVariable[] = [
  {
    id: 1,
    environment_id: "env-1",
    key: "baseUrl",
    value: "https://api.dev.example.com",
    is_secret: 0,
    is_enabled: 1,
    sort_order: 0,
    created_at: Date.now(),
    updated_at: Date.now(),
  },
  {
    id: 2,
    environment_id: "env-1",
    key: "apiKey",
    value: "sk_dev_123456",
    is_secret: 1,
    is_enabled: 1,
    sort_order: 1,
    created_at: Date.now(),
    updated_at: Date.now(),
  },
  {
    id: 3,
    environment_id: "env-1",
    key: "disabledVar",
    value: "should-not-appear",
    is_secret: 0,
    is_enabled: 0, // Disabled
    sort_order: 2,
    created_at: Date.now(),
    updated_at: Date.now(),
  },
];

// =============================================================================
// Pure Function Tests (No Effect)
// =============================================================================

describe("extractVariableNames", () => {
  it("should extract single variable", () => {
    const result = extractVariableNames("{{baseUrl}}");
    expect(result).toEqual(["baseUrl"]);
  });

  it("should extract multiple variables", () => {
    const result = extractVariableNames("{{baseUrl}}/api/{{version}}");
    expect(result).toEqual(["baseUrl", "version"]);
  });

  it("should trim whitespace", () => {
    const result = extractVariableNames("{{ baseUrl }}");
    expect(result).toEqual(["baseUrl"]);
  });

  it("should handle no variables", () => {
    const result = extractVariableNames("https://api.example.com");
    expect(result).toEqual([]);
  });
});

describe("hasVariables", () => {
  it("should detect variables", () => {
    expect(hasVariables("{{baseUrl}}")).toBe(true);
    expect(hasVariables("text {{var}} text")).toBe(true);
  });

  it("should return false for plain text", () => {
    expect(hasVariables("https://api.example.com")).toBe(false);
    expect(hasVariables("no vars here")).toBe(false);
  });
});

describe("resolveTemplateSync", () => {
  it("should resolve single variable", () => {
    const result = resolveTemplateSync("{{baseUrl}}", {
      baseUrl: "https://api.example.com",
    });
    expect(result).toBe("https://api.example.com");
  });

  it("should resolve multiple variables", () => {
    const result = resolveTemplateSync("{{baseUrl}}/api/{{version}}", {
      baseUrl: "https://api.example.com",
      version: "v1",
    });
    expect(result).toBe("https://api.example.com/api/v1");
  });

  it("should handle whitespace in variables", () => {
    const result = resolveTemplateSync("{{ baseUrl }}", {
      baseUrl: "https://api.example.com",
    });
    expect(result).toBe("https://api.example.com");
  });

  it("should leave unresolved variables unchanged", () => {
    const result = resolveTemplateSync("{{baseUrl}}/{{unknown}}", {
      baseUrl: "https://api.example.com",
    });
    expect(result).toBe("https://api.example.com/{{unknown}}");
  });
});

// =============================================================================
// Effect-based Tests
// =============================================================================

describe("ConfigProvider", () => {
  const layer = PosteeConfigProviderLive(mockVariables);
  const provider = makeConfigProvider(mockVariables);

  // Helper to run with config layer
  const runWithConfig = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect.pipe(Effect.provide(layer)));

  describe("getString", () => {
    it("should get enabled variable", async () => {
      const result = await runWithConfig(provider.getString("baseUrl"));
      expect(result).toBe("https://api.dev.example.com");
    });

    it("should fail for missing variable", async () => {
      const result = await runWithConfig(
        provider.getString("nonexistent").pipe(
          Effect.flip, // Convert error to success for testing
        ),
      );
      expect(ConfigError.isConfigError(result)).toBe(true);
    });

    it("should fail for disabled variable", async () => {
      const result = await runWithConfig(
        provider.getString("disabledVar").pipe(
          Effect.flip,
        ),
      );
      expect(ConfigError.isConfigError(result)).toBe(true);
    });
  });

  describe("getSecret", () => {
    it("should get secret variable as Redacted", async () => {
      const result = await runWithConfig(provider.getSecret("apiKey"));
      // Redacted values are opaque - we can't directly test the value
      expect(result).toBeDefined();
    });
  });

  describe("getUrl", () => {
    it("should parse valid URL", async () => {
      const result = await runWithConfig(provider.getUrl("baseUrl"));
      expect(result).toBeInstanceOf(URL);
      expect(result.toString()).toBe("https://api.dev.example.com/");
    });

    it("should fail for invalid URL", async () => {
      const invalidVariable = {
        ...mockVariables[0],
        key: "invalidUrl",
        value: "not-a-url",
      } as EnvironmentVariable;
      const invalidLayer = PosteeConfigProviderLive([invalidVariable]);
      const invalidProvider = makeConfigProvider([invalidVariable]);

      const result = await Effect.runPromise(
        invalidProvider.getUrl("invalidUrl").pipe(
          Effect.flip,
          Effect.provide(invalidLayer),
        ),
      );
      expect(ConfigError.isConfigError(result)).toBe(true);
    });
  });

  describe("resolveTemplate", () => {
    it("should resolve template with variables", async () => {
      const result = await runWithConfig(
        provider.resolveTemplate("{{baseUrl}}/api/users"),
      );
      expect(result).toBe("https://api.dev.example.com/api/users");
    });

    it("should resolve multiple variables", async () => {
      const result = await runWithConfig(
        provider.resolveTemplate("{{baseUrl}}/auth/{{apiKey}}"),
      );
      expect(result).toBe("https://api.dev.example.com/auth/sk_dev_123456");
    });

    it("should handle plain text", async () => {
      const result = await runWithConfig(
        provider.resolveTemplate("https://api.example.com"),
      );
      expect(result).toBe("https://api.example.com");
    });

    it("should fail for missing variable", async () => {
      const result = await runWithConfig(
        provider.resolveTemplate("{{nonexistent}}").pipe(
          Effect.flip,
        ),
      );
      expect(ConfigError.isConfigError(result)).toBe(true);
    });
  });

  describe("validateAll", () => {
    it("should validate all enabled variables", async () => {
      const result = await runWithConfig(
        provider.validateAll(["baseUrl", "apiKey"]),
      );
      expect(result).toEqual({
        baseUrl: true,
        apiKey: true,
      });
    });

    it("should mark missing variables as invalid", async () => {
      const result = await runWithConfig(
        provider.validateAll(["baseUrl", "nonexistent"]),
      );
      expect(result.baseUrl).toBe(true);
      expect(result.nonexistent).toBe(false);
    });
  });
});
