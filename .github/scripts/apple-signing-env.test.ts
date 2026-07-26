import { describe, expect, it } from "vitest";

import { appleSigningEnvLines } from "./apple-signing-env";

/**
 * ADR-013 Phase 0. Which notarisation credentials the bundler picks is decided by
 * what is *present* in the environment, not by what has a value:
 *
 *   match (var_os("APPLE_ID"), var_os("APPLE_PASSWORD"), var_os("APPLE_TEAM_ID"))
 *
 * `var_os` returns `Some("")` for a variable exported as an empty string, so
 * exporting an unset secret as `APPLE_ID=` selects the Apple ID branch with blank
 * credentials — and notarisation fails after a full four-platform build.
 *
 * The API key path is only reached when the Apple ID triple is genuinely absent.
 */

const API_KEY_SECRETS = {
  APPLE_CERTIFICATE: "YmFzZTY0",
  APPLE_CERTIFICATE_PASSWORD: "hunter2",
  APPLE_SIGNING_IDENTITY: "Developer ID Application: Someone (TEAMID)",
  APPLE_TEAM_ID: "TEAMID",
  APPLE_API_KEY: "SDSW238PV3",
  APPLE_API_ISSUER: "issuer-uuid",
} as const;

const nameOf = (line: string) => line.slice(0, line.indexOf("="));
const namesIn = (lines: ReadonlyArray<string>) => lines.map(nameOf);
const valueOf = (lines: ReadonlyArray<string>, name: string) => {
  const line = lines.find((candidate) => nameOf(candidate) === name);
  return line === undefined ? undefined : line.slice(name.length + 1);
};

describe("appleSigningEnvLines", () => {
  it("omits a secret that is absent rather than exporting it empty", () => {
    const lines = appleSigningEnvLines(API_KEY_SECRETS);

    expect(namesIn(lines)).not.toContain("APPLE_ID");
    expect(namesIn(lines)).not.toContain("APPLE_PASSWORD");
  });

  it("omits a secret that is present but blank", () => {
    const lines = appleSigningEnvLines({ ...API_KEY_SECRETS, APPLE_ID: "", APPLE_PASSWORD: "   " });

    expect(namesIn(lines)).not.toContain("APPLE_ID");
    expect(namesIn(lines)).not.toContain("APPLE_PASSWORD");
  });

  it("withholds notarisation credentials so the bundler signs but does not notarise", () => {
    // tauri-bundler notarises inside `tauri build` whenever it can authenticate,
    // giving no progress output and no way to retry without rebuilding. Denied
    // credentials, notarize_auth() returns MissingCredentials, which the bundler
    // logs as "skipping app notarization" and continues — leaving notarisation to
    // a step that can report on itself. Only MissingTeamId would fail the build.
    const lines = appleSigningEnvLines({
      ...API_KEY_SECRETS,
      APPLE_ID: "someone@example.test",
      APPLE_PASSWORD: "app-specific",
    });

    for (const name of ["APPLE_API_KEY", "APPLE_API_ISSUER", "APPLE_ID", "APPLE_PASSWORD"]) {
      expect(namesIn(lines), `${name} would trigger notarisation during the build`)
        .not.toContain(name);
    }
  });

  it("still exports the team id, whose absence is the one error that fails the build", () => {
    expect(valueOf(appleSigningEnvLines(API_KEY_SECRETS), "APPLE_TEAM_ID")).toBe("TEAMID");
  });

  it("strips the line wrapping macOS base64 adds to the certificate", () => {
    const lines = appleSigningEnvLines({
      ...API_KEY_SECRETS,
      APPLE_CERTIFICATE: "TUlJS3h3SUJB\nekNDQ29NR0NT\ncUdTSWIz\n",
    });

    expect(valueOf(lines, "APPLE_CERTIFICATE")).toBe("TUlJS3h3SUJBekNDQ29NR0NTcUdTSWIz");
  });

  it("never emits a value containing a newline, which would corrupt GITHUB_ENV", () => {
    const lines = appleSigningEnvLines({
      ...API_KEY_SECRETS,
      APPLE_CERTIFICATE: "wrapped\nacross\nlines",
      APPLE_SIGNING_IDENTITY: "trailing\n",
    });

    for (const line of lines) {
      expect(line).not.toContain("\n");
    }
  });

  it("keeps the spaces inside a signing identity, which are part of its name", () => {
    const lines = appleSigningEnvLines(API_KEY_SECRETS);

    // Only the certificate is base64. Collapsing whitespace everywhere would
    // rewrite this to "DeveloperIDApplication:Someone(TEAMID)" and match nothing
    // in the keychain.
    expect(valueOf(lines, "APPLE_SIGNING_IDENTITY")).toBe(
      "Developer ID Application: Someone (TEAMID)",
    );
  });

  it("trims a value the clipboard picked up a newline on", () => {
    const lines = appleSigningEnvLines({ ...API_KEY_SECRETS, APPLE_TEAM_ID: " TEAMID\n" });

    expect(valueOf(lines, "APPLE_TEAM_ID")).toBe("TEAMID");
  });

  it("refuses a non-certificate value with an interior newline instead of corrupting GITHUB_ENV", () => {
    expect(() => appleSigningEnvLines({ ...API_KEY_SECRETS, APPLE_SIGNING_IDENTITY: "a\nb" }))
      .toThrow(/APPLE_SIGNING_IDENTITY/);
  });

  it("keeps the private key out of the environment — it belongs in a file", () => {
    const lines = appleSigningEnvLines({ ...API_KEY_SECRETS, APPLE_API_KEY_P8: "-----BEGIN..." });

    expect(namesIn(lines)).not.toContain("APPLE_API_KEY_P8");
  });

  it("exports the certificate and identity the signing step needs", () => {
    const lines = appleSigningEnvLines(API_KEY_SECRETS);

    expect(namesIn(lines)).toEqual(
      expect.arrayContaining([
        "APPLE_CERTIFICATE",
        "APPLE_CERTIFICATE_PASSWORD",
        "APPLE_SIGNING_IDENTITY",
        "APPLE_TEAM_ID",
      ]),
    );
  });

  it("emits nothing when no secrets are configured at all", () => {
    expect(appleSigningEnvLines({})).toEqual([]);
  });
});
