---
title: "Release installation"
---

# Release installation

## macOS

Signed and notarized macOS builds should open normally after you drag the app into `/Applications`.

If you are testing an unsigned build and macOS shows "developer cannot be verified", use one of these local-only workarounds:

1. Copy `c4-board.app` into `/Applications`.
2. Either Control-click the app and choose `Open`, or remove the quarantine attribute:

```sh
/usr/bin/xattr -r -d com.apple.quarantine /Applications/c4-board.app
open /Applications/c4-board.app
```

If your local `xattr` does not accept `-r`, use this fallback:

```sh
find /Applications/c4-board.app -exec /usr/bin/xattr -d com.apple.quarantine {} \; 2>/dev/null
open /Applications/c4-board.app
```

This bypass only affects your local machine. It is not the release fix. Public macOS releases should be signed with a Developer ID certificate and notarized by Apple.

Maintainers: signing and notarization setup is documented in the repository file `.github/apple-signing.md`.

## Windows

Download the `.msi` or `.exe` from the GitHub release and launch it normally. If SmartScreen warns on an unsigned test build, use the standard Windows "More info" then "Run anyway" flow only for builds you trust.

## Linux

Linux releases are published as:

- `.AppImage`
- `.deb`
- `.rpm`

Pick the package format that matches your environment.
