# Apple signing and notarization

macOS release assets must be signed with a Developer ID Application certificate and notarized by Apple. Unsigned builds will install from the DMG but Gatekeeper will block them with "developer cannot be verified".

## Required GitHub secrets

Set these repository secrets before running the release workflow:

- `APPLE_CERTIFICATE`: base64 encoded `.p12` Developer ID Application certificate.
- `APPLE_CERTIFICATE_PASSWORD`: password used when exporting the `.p12`.
- `APPLE_SIGNING_IDENTITY`: full signing identity, for example `Developer ID Application: OPSYDYN LTD (TEAMID)`.
- `APPLE_TEAM_ID`: Apple Developer Team ID.

Use one notarization credential set:

- App Store Connect API key: `APPLE_API_KEY`, `APPLE_API_ISSUER`, `APPLE_API_KEY_P8`.
- Apple ID fallback: `APPLE_ID`, `APPLE_PASSWORD` where `APPLE_PASSWORD` is an app-specific password.

## Export certificate

Export the Developer ID Application certificate from Keychain Access as a `.p12`, then encode it:

```sh
openssl base64 -A -in DeveloperIDApplication.p12 -out DeveloperIDApplication.p12.base64
```

Use the contents of `DeveloperIDApplication.p12.base64` as `APPLE_CERTIFICATE`.

## Local Gatekeeper bypass for test builds only

For a one-off local test of an unsigned download, copy the app to `/Applications`, then either Control-click the app and choose Open, or clear the quarantine attribute:

```sh
xattr -dr com.apple.quarantine /Applications/c4-board.app
```

Do not treat this as a release fix. Public release DMGs should be signed and notarized.
