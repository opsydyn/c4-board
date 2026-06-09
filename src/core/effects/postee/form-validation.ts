import { Data, Effect, Option, pipe, Schema } from "effect";

/**
 * Validated request form data
 */
export interface ValidatedRequestForm {
  readonly name: string;
  readonly url: string;
  readonly method: string;
}

/**
 * Input form data (raw, untrimmed)
 */
export interface RequestFormData {
  readonly name: string;
  readonly url: string;
  readonly method: string;
}

/**
 * Valid HTTP methods for REST API requests
 */
const VALID_HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const;

/**
 * Pure function: Attempts to parse a string into a URL
 * Avoids boolean blindness by returning Option<URL>
 *
 * Uses Option.liftThrowable to convert URL constructor (which throws)
 * into a function that returns Option (None on error, Some on success)
 *
 * @param urlString - String to parse
 * @returns Option.Some(URL) if valid, Option.None() if invalid
 *
 * @example
 * ```typescript
 * const valid = parseURL("https://api.com"); // Some(URL)
 * const invalid = parseURL("not-a-url");     // None
 * ```
 */
const parseURL = Option.liftThrowable((urlString: string) => new URL(urlString.trim()));

/**
 * Schema for validating request form data
 * - name: non-empty trimmed string
 * - url: valid URL format (using Option instead of boolean)
 * - method: one of the valid HTTP methods
 */
const RequestFormSchema = Schema.Struct({
  name: pipe(
    Schema.String,
    Schema.filter((s) => s.trim().length > 0, {
      message: () => "Request name cannot be empty",
    }),
  ),
  url: pipe(
    Schema.String,
    Schema.filter((s) => s.trim().length > 0, {
      message: () => "URL cannot be empty",
    }),
    Schema.filter((s) => Option.isSome(parseURL(s)), {
      message: () => "URL must be a valid URL format",
    }),
  ),
  method: pipe(
    Schema.String,
    Schema.filter(
      (s) =>
        VALID_HTTP_METHODS.includes(
          s.trim().toUpperCase() as (typeof VALID_HTTP_METHODS)[number],
        ),
      {
        message: () => `HTTP method must be one of: ${VALID_HTTP_METHODS.join(", ")}`,
      },
    ),
  ),
});

/**
 * Form validation error
 */
export class FormValidationError extends Data.TaggedError(
  "FormValidationError",
)<{
  readonly field: string;
  readonly message: string;
}> {}

/**
 * Effect service: Validates and normalizes request form data
 *
 * Uses idiomatic Effect-TS patterns:
 * - Schema validation for all fields
 * - Automatic whitespace trimming
 * - Type-safe error handling
 *
 * @param formData - Raw form input
 * @returns Effect containing validated and trimmed form data
 *
 * @example
 * ```typescript
 * const formData = { name: "  Get User  ", url: "https://api.com", method: "GET" };
 * const validated = await Effect.runPromise(validateRequestForm(formData));
 * // Returns: { name: "Get User", url: "https://api.com", method: "GET" }
 * ```
 */
export const validateRequestForm = (
  formData: RequestFormData,
): Effect.Effect<ValidatedRequestForm, FormValidationError> =>
  pipe(
    Schema.decodeUnknown(RequestFormSchema)(formData),
    Effect.mapError((parseError) => {
      // ParseError has a message getter that formats the entire error
      return new FormValidationError({
        field: "form",
        message: parseError.message,
      });
    }),
    Effect.map((validated) => ({
      name: validated.name.trim(),
      url: validated.url.trim(),
      method: validated.method.trim().toUpperCase(),
    })),
  );
