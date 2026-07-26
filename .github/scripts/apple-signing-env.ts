/**
 * Builds the `GITHUB_ENV` lines that hand Apple signing secrets to tauri-action.
 *
 * ADR-013 Phase 0. Two properties this has to get right, both of which fail late —
 * after a full four-platform build — rather than at the step that gets them wrong:
 *
 * 1. **Absent means absent.** tauri-bundler chooses its notarisation credentials
 *    with `var_os`, which cannot tell an unset variable from one exported empty.
 *    Writing `APPLE_ID=` for a secret nobody configured selects the Apple ID branch
 *    with blank credentials instead of falling through to the API key.
 *
 * 2. **One line per value.** `GITHUB_ENV` is parsed line by line, so a value with a
 *    newline in it corrupts everything after it. `base64` wraps its output at 76
 *    columns on macOS unless asked not to, which makes a wrapped certificate the
 *    likely case rather than the exotic one.
 */

/** Written to a file, never the environment — it is a PEM key and needs its newlines. */
const FILE_ONLY = "APPLE_API_KEY_P8";

/**
 * Signing only. The notarisation credentials are deliberately absent.
 *
 * tauri-bundler notarises inside `tauri build` the moment it can authenticate,
 * which buys 40+ minutes of total silence and no way to retry without rebuilding.
 * With no credentials, `notarize_auth()` returns `MissingCredentials`, which the
 * bundler logs as "skipping app notarization" and carries on — so a step that can
 * report progress and be retried does the notarising instead.
 *
 * APPLE_TEAM_ID stays: `MissingTeamId` is the single variant the bundler treats as
 * fatal rather than skippable.
 */
const EXPORTED = [
  "APPLE_CERTIFICATE",
  "APPLE_CERTIFICATE_PASSWORD",
  "APPLE_SIGNING_IDENTITY",
  "APPLE_TEAM_ID",
] as const;

export type AppleSigningSecrets = Readonly<Partial<Record<string, string>>>;

/**
 * The only base64 value, and the only one whose interior whitespace is noise.
 * Everything else is a name or an identifier where a space is meaningful —
 * "Developer ID Application: Someone (TEAMID)" must survive intact.
 */
const BASE64_VALUED = "APPLE_CERTIFICATE";

export const appleSigningEnvLines = (secrets: AppleSigningSecrets): ReadonlyArray<string> =>
  EXPORTED.flatMap((name) => {
    if (name === FILE_ONLY) return [];

    const raw = secrets[name];
    // A blank secret is one nobody configured. Exporting it would be a lie the
    // bundler believes.
    if (raw === undefined || raw.trim().length === 0) return [];

    const value = name === BASE64_VALUED ? raw.replace(/\s+/g, "") : raw.trim();

    if (value.includes("\n")) {
      // Writing this would silently corrupt every line after it, so stop here
      // rather than midway through a signed build.
      throw new Error(`${name} contains a newline and cannot be written to GITHUB_ENV`);
    }

    return [`${name}=${value}`];
  });

/**
 * Entry point: reads the secrets from this process's environment and appends the
 * safe lines to the file named by `GITHUB_ENV`.
 *
 * Values are never echoed. A failure names the offending variable and nothing else.
 */
if (import.meta.main) {
  const { appendFileSync } = await import("node:fs");

  const target = process.env.GITHUB_ENV;
  if (target === undefined || target.length === 0) {
    console.error("GITHUB_ENV is not set; refusing to guess where to write.");
    process.exit(1);
  }

  const lines = appleSigningEnvLines(process.env);
  if (lines.length > 0) {
    appendFileSync(target, `${lines.join("\n")}\n`, "utf8");
  }

  console.log(
    `Exported ${lines.length} Apple signing variable(s): ${
      lines.map((line) => line.slice(0, line.indexOf("="))).join(", ") || "none"
    }`,
  );
}
