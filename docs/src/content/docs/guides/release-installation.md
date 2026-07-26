---
title: "Release installation"
---

# Release installation

## macOS

### Pick the right download

| File | Machine |
| ---- | ------- |
| `c4-board_<version>_darwin_aarch64.dmg` | Apple Silicon (M1 and later) |
| `c4-board_<version>_darwin_x64.dmg` | Intel |

`aarch64` is ARM64, which is every Apple Silicon Mac. If you are unsure, run `uname -m`: `arm64` means take the `aarch64` build.

### Current state: testing builds are unsigned

Apple's notary service has not been processing this team's submissions. Because the release job withdraws any macOS bundle it cannot notarize, macOS was shipping nothing at all — so signing is currently switched off for testing rounds (`APPLE_SIGNING_ENABLED=false`) and the `.dmg` is published unsigned.

That is a deliberate, temporary trade: an unsigned build you have to clear by hand beats no macOS build. Gatekeeper will refuse to open it until you do.

A release can therefore be in one of three states:

| `spctl` says | Meaning | Workaround needed |
| ------------ | ------- | ----------------- |
| `source=Notarized Developer ID` | Fully notarized | No |
| `source=Developer ID` | Signed, ticket missing | Yes |
| `rejected` / unsigned | Signing was switched off | Yes |

Check which you have:

```sh
spctl -a -vvv /Applications/c4-board.app
```

A notarized build reports:

```
/Applications/c4-board.app: accepted
source=Notarized Developer ID
```

Anything else — `source=Developer ID` without "Notarized", or a flat `rejected` — means you need the steps below. (`-t install` is for disk images and installers; for an application bundle the default assessment type is the right one.)

### Clearing quarantine

macOS attaches the quarantine flag to the **downloaded `.dmg`**, so that is where you are blocked first — before you can copy anything into `/Applications`.

```sh
xattr -d com.apple.quarantine ~/Downloads/c4-board_<version>_darwin_aarch64.dmg
open ~/Downloads/c4-board_<version>_darwin_aarch64.dmg
```

Drag the app into `/Applications`, then clear it there too:

```sh
xattr -cr /Applications/c4-board.app
open /Applications/c4-board.app
```

`-d com.apple.quarantine` removes only the quarantine attribute. `-cr` clears *all* extended attributes recursively — a bigger hammer, useful when the flag has been applied to nested files inside the bundle.

If your `xattr` does not accept `-r`:

```sh
find /Applications/c4-board.app -exec /usr/bin/xattr -d com.apple.quarantine {} \; 2>/dev/null
```

### What this actually does

Clearing quarantine tells macOS to skip its check for that specific file. It does not make an untrusted build safe, so only do it for artifacts you downloaded from this project's own releases page and whose signature you verified with `spctl` above.

This is a stopgap, not the fix. It should stop being necessary once notarization is reliable — at which point this section should be deleted rather than left to rot.

Note that macOS assets can disappear from a release: if notarization times out, the release job withdraws them rather than leaving unnotarized bundles published. A release with Linux and Windows assets but no `.dmg` is that case, not a mistake.

Maintainers: signing and notarization setup is documented in the repository file `.github/apple-signing.md`.

## Windows

Download the `.msi` or `.exe` from the GitHub release and launch it normally. If SmartScreen warns on an unsigned test build, use the standard Windows "More info" then "Run anyway" flow only for builds you trust.

## Linux

Linux releases are published as:

- `.AppImage`
- `.deb`
- `.rpm`

Pick the package format that matches your environment.
