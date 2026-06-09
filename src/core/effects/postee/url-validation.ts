/**
 * URL Validation Effects - Functional Core
 *
 * Pure validation logic for HTTP request URLs.
 * Returns validation state with helpful error messages.
 */

import { Effect } from "effect";

/**
 * Validation result discriminated union
 */
export type UrlValidationResult =
  | { _tag: "Valid"; url: string }
  | { _tag: "Invalid"; error: string; suggestion?: string }
  | { _tag: "Empty" };

/**
 * Validate a URL for HTTP requests
 * Pure function - no side effects
 */
export function validateUrl(input: string): UrlValidationResult {
  const trimmed = input.trim();

  // Empty state
  if (trimmed === "") {
    return { _tag: "Empty" };
  }

  // Check for variable syntax {{variable}} - consider valid
  if (/\{\{[^}]+\}\}/.test(trimmed)) {
    return { _tag: "Valid", url: trimmed };
  }

  // Must have a protocol or be a relative path
  const hasProtocol = /^https?:\/\//i.test(trimmed);
  const isRelativePath = /^\//.test(trimmed);

  // If no protocol and not relative, suggest adding one
  if (!hasProtocol && !isRelativePath) {
    // Common mistake: forgot protocol
    if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(trimmed)) {
      return {
        _tag: "Invalid",
        error: "Missing protocol",
        suggestion: `https://${trimmed}`,
      };
    }

    return {
      _tag: "Invalid",
      error: "Invalid URL format",
      suggestion: "Start with http://, https://, or /",
    };
  }

  // Try parsing as URL
  try {
    if (hasProtocol) {
      const url = new URL(trimmed);

      // Check for localhost without protocol
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return {
          _tag: "Invalid",
          error: "Invalid protocol",
          suggestion: "Use http:// or https://",
        };
      }

      // Check for common mistakes
      if (url.hostname === "") {
        return {
          _tag: "Invalid",
          error: "Missing hostname",
          suggestion: "Example: https://api.example.com",
        };
      }

      return { _tag: "Valid", url: trimmed };
    }

    // Relative path - assume valid
    if (isRelativePath) {
      return { _tag: "Valid", url: trimmed };
    }

    return {
      _tag: "Invalid",
      error: "Invalid URL format",
    };
  } catch {
    // URL constructor threw - invalid format
    return {
      _tag: "Invalid",
      error: "Malformed URL",
      suggestion: "Check for typos or invalid characters",
    };
  }
}

/**
 * Effect version of validateUrl for Effect-TS integration
 */
export const validateUrlEffect = (
  input: string,
): Effect.Effect<UrlValidationResult, never, never> => Effect.sync(() => validateUrl(input));
