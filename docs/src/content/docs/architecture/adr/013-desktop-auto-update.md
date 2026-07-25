---
title: "ADR-013: Desktop Auto-Update via Signed GitHub Releases"
---

# ADR-013: Desktop Auto-Update via Signed GitHub Releases

**Status**: Proposed
**Date**: 2026-07-25
**Deciders**: Alan P Currie
**Technical Story**: Installing a new version means downloading a `.dmg` and reinstalling by hand.
Releases already build for four platforms and upload nine assets; what is missing is the signed
updater metadata and an in-app path to use it.

## Context

### Problem Statement

`c4-board` ships as a desktop app and has no update path. Every release requires each user to notice
it happened, find the release page, download the right artifact for their platform, and reinstall over
the top. Release cadence is already several versions a day; expecting manual reinstallation at that
rate means most installs will be stale, which makes bug reports hard to interpret and fixes slow to
reach anyone.

### Current State — the gap is narrower than it looks

Most of the delivery pipeline already exists. `release.yml` builds a four-platform matrix and uploads
to the release release-plz created:

| Present | Detail |
| ------- | ------ |
| Build matrix | `ubuntu-22.04`, `macos-15-intel`, `macos-14`, `windows-latest` |
| Publishing | `tauri-action@v0` uploading to `releaseId`, `tauriScript: bun tauri` |
| Assets on v0.0.7 | `.dmg` ×2, `.app.tar.gz` ×2, `.AppImage`, `.deb`, `.rpm`, `.exe`, `.msi` |
| Apple signing scaffolding | present but gated: `APPLE_SIGNING_ENABLED: "false"` |

What is missing is specifically the updater path:

| Missing | Detail |
| ------- | ------ |
| `bundle.createUpdaterArtifacts` | absent from `tauri.conf.json` |
| Signature files | **0 `.sig` assets** on v0.0.7 |
| `latest.json` | **absent** — the endpoint an updater reads |
| `plugins.updater` | config has only `sql` and `fs` |
| Plugins | neither `tauri-plugin-updater` nor `tauri-plugin-process` is registered |
| `includeUpdaterJson` | explicitly `false` in the tauri-action step |
| Frontend | no update state, service, or UI |

The `.app.tar.gz` files already present are the macOS updater archive format, but without `.sig`
files and `latest.json` they are inert.

### Five findings that shape the design

1. **The release is published before its assets exist.** `release_always = true` with no draft, so
   release-plz creates and publishes the GitHub Release, and `build-release-assets` uploads to it
   afterwards — a window of roughly 25 minutes during which
   `releases/latest/download/latest.json` resolves to a published release that has no updater
   metadata. An updater checking in that window gets a 404.

2. **macOS updates are not viable while the app is unsigned.** `APPLE_SIGNING_ENABLED` is `false`.
   The updater replaces the `.app` bundle in place; an unsigned or ad-hoc-signed replacement is
   subject to Gatekeeper and quarantine on next launch. Shipping updates to unsigned macOS builds
   risks leaving users with an app that will not open — worse than no update path at all.

3. **Linux updates only work for AppImage.** Tauri's updater cannot update a `.deb` or `.rpm`
   install; those are managed by the system package manager. Two of the three Linux artifacts are
   therefore not updatable, and the UI must not imply otherwise.

4. **The version numbers disagree.** `src-tauri/Cargo.toml` is `0.0.7`; `package.json` is `0.0.1` and
   has never been bumped. Tauri takes its version from Cargo, so releases are correct today, but a
   feature that displays "current version" must read from a single agreed source.

5. **There is no `capabilities/` directory.** Permissions are declared inline under
   `app.security.capabilities` in `tauri.conf.json`. New updater and process permissions go there,
   not in the file layout the Tauri docs assume.

### Goals

- An installed build discovers, downloads, and installs a newer stable release.
- The user chooses when to restart. Nothing restarts the app silently.
- An updater failure never degrades the running application.
- Reuse the existing release pipeline rather than adding a second one.

### Constraints

- CLAUDE.md forbids boolean flags for what are states; this is a state machine (ADR-011 Phase 5).
- Functional core / imperative shell: Tauri plugin calls belong at the boundary, not in components.
- Settings persist through `app_settings` and `settings.types.ts`; no new table for two fields.
- Releases are driven by release-plz on push to `main`, **not** by pushing `v*` tags. Any workflow
  advice assuming a tag trigger has to be re-expressed against that.

## Decision

**Adopt Tauri's official updater against signed GitHub Release artifacts, wire it into the release
pipeline that already exists, and gate installation behind an explicit user action.**

No custom update server, no forced updates, no silent restart.

### Update state is a machine, not flags

The states are mutually exclusive and the transitions are the whole feature, so this is an XState
machine beside `posteeUiMachine`, with a `Data.taggedEnum` for the error channel:

```
idle → checking → { upToDate | available | error }
available → downloading → { downloaded | error }
downloaded → { restartBlocked | installing }
restartBlocked → downloaded
installing → (relaunch) | error
```

Duplicate checks and duplicate downloads are prevented by the machine's own states rather than by
guard booleans.

### "Unsaved work" means running work

The generic advice is to block restart on unsaved edits. That is the wrong question here: Postee
persists scratch drafts on every keystroke and the board autosaves. What genuinely must not be
interrupted is **work in flight** — a running load test, an in-flight request, an agent run. Restart
readiness is therefore a predicate over active operations, not over dirty buffers.

### Release ordering must change

The updater endpoint is `releases/latest/download/latest.json`. For that to be true rather than
usually-true, the release must not be published until its assets exist. release-plz gains
`git_release_draft = true`, and `build-release-assets` publishes the release once every platform job
has uploaded. This also matches the existing intent of the `resolve-existing-release` job.

### Platform honesty

The UI reports what the running install can actually do:

| Platform | Updatable | Condition |
| -------- | --------- | --------- |
| Windows (NSIS/MSI) | Yes | SmartScreen warnings without Authenticode |
| Linux AppImage | Yes | — |
| Linux deb/rpm | **No** | system package manager owns the install |
| macOS | **Not until signed** | Developer ID + notarisation required first |

Where updates are unavailable, the settings panel links to the release page instead of offering a
button that cannot work.

## Consequences

### Positive

- Users get fixes without noticing a release and reinstalling by hand.
- The existing four-platform pipeline is reused; the change is metadata and a flag.
- Signature verification is enforced by Tauri; a tampered artifact is refused.
- Draft-then-publish removes a real window where `latest` points at an assetless release.

### Negative

- A signing key becomes release infrastructure. Losing it means installed clients stop trusting
  updates and every user must reinstall by hand.
- macOS gains a hard dependency on Apple Developer ID signing before it can use any of this.
- Draft-then-publish makes the release job's failure modes more visible: a platform that fails to
  build now blocks publication rather than yielding a partial release.
- Another surface that can fail at startup, on a network path, in front of a user.

### Neutral

- No new state library; the machine sits beside the existing ones.
- `latest.json` is public metadata; the public key is not a secret.

## Alternatives Considered

### Alternative 1: Keep manual downloads

**Why Rejected**: At several releases a day, it guarantees a stale installed base and makes every bug
report ambiguous about which version produced it.

### Alternative 2: A custom update server

Full control over channels, staged rollout, and telemetry.

**Why Rejected**: A service to run, secure, and pay for, replacing something GitHub already hosts for
free. Revisit only if staged rollout becomes a requirement.

### Alternative 3: Silent background install on quit

Least friction, and what several editors do.

**Why Rejected**: The app holds a running load test and an in-flight request model; a silent swap
risks interrupting work the user has not finished. It also removes the moment where a user can decline
a bad release, which matters most on the release that broke something.

### Alternative 4: Point the updater at each tagged release rather than `latest`

**Why Rejected**: Requires the client to know what version to ask for, which is the thing it is asking.

## Migration Plan

1. **Phase 1 — Signed artifacts.** Generate the updater keypair, add CI secrets, set
   `createUpdaterArtifacts`, flip `includeUpdaterJson` to `true`. Verify a release produces `.sig`
   files and `latest.json`. No app changes; nothing consumes it yet.
2. **Phase 2 — Release ordering.** `git_release_draft = true`, publish after every platform job
   succeeds. Verify `releases/latest` never resolves to an assetless release.
3. **Phase 3 — Plugins and permissions.** Add `tauri-plugin-updater` and `tauri-plugin-process`,
   register them, and add the two permissions to the inline capability.
4. **Phase 4 — Domain.** The update machine, the Effect service wrapping the plugin, the error
   taxonomy, byte and percentage formatting, persistence of `lastCheckedAt` and `dismissedVersion`
   in `app_settings`. Pure and testable; no UI.
5. **Phase 5 — Surface.** Settings panel, availability banner, restart-readiness integration,
   platform capability reporting.
6. **Phase 6 — Proving it.** A test release exercised on each platform, and honest documentation of
   what was actually verified versus assumed.

Phases 1 and 2 are independently valuable: they make releases correct and verifiable before anything
depends on them.

## Testing Strategy

**MANDATORY**: Red-Green-Blue per CLAUDE.md.

The honest constraint: **the last mile cannot be unit tested.** Whether a downloaded bundle installs
and relaunches is a property of the operating system, and no amount of mocking establishes it. The
plan is therefore explicit about which parts are proven and which are demonstrated by hand.

### Test Planning

1. Every state transition, including the ones that must not exist — no download from `idle`, no
   restart from `available`.
2. A second check while one runs does not start a second check.
3. A retryable download failure returns to `available` with the current version intact.
4. Percentage is `undefined` when total size is unknown, and clamped to 0–100 otherwise.
5. Byte formatting at boundaries: 0, 1023, 1024, and non-finite input.
6. Error classification maps offline, timeout, and signature failure to distinct codes.
7. A signature failure is never retryable and never suggests bypassing verification.
8. Dismissing `0.5.0` does not suppress `0.5.1`.
9. An automatic check does not run twice inside 24 hours; a manual check always runs.
10. Restart is blocked while a load test or request is in flight.
11. Release URL construction derives from configured repository values, never from release-note text.
12. Outside the Tauri runtime the updater is inert rather than noisy.

Component tests cover every visible state including indeterminate progress and a non-retryable
signature failure. Integration tests use an injected fake service; nothing in the suite calls GitHub.

## Success Metrics

| Metric | Before | After | Status |
| ------ | ------ | ----- | ------ |
| `.sig` assets per release | 0 | one per updatable artifact | Proposed |
| `latest.json` on the release | Absent | Present | Proposed |
| `releases/latest` without assets | ~25 min per release | Never | Proposed |
| Installing a new version | Manual download and reinstall | In-app, user-confirmed | Proposed |
| Platforms with a verified update path | 0 | Windows + AppImage, macOS after signing | Proposed |

## References

- [Tauri updater plugin](https://v2.tauri.app/plugin/updater/)
- [`tauri-action`](https://github.com/tauri-apps/tauri-action)
- [`release.yml`](/.github/workflows/release.yml) — the existing matrix and `includeUpdaterJson: false`
- [`release-plz.toml`](/src-tauri/release-plz.toml) — `release_always`, no draft
- [ADR-011](./011-postee-single-pane-workspace.md) — the parallel-state pattern this machine follows
- [`settings.types.ts`](/src/core/effects/settings.types.ts) — where the two persisted fields belong

## Follow-Up ADRs

- ADR-NNN: Apple Developer ID signing and notarisation — a prerequisite for macOS updates, and worth
  deciding on its own terms rather than inside this one.
- ADR-NNN: Release channels, if a beta channel is ever wanted.

---

## Notes

The ideation this distils assumed pnpm, a greenfield tag-triggered `release.yml`, and a
`capabilities/` directory. None of those hold here: the package manager is bun, releases are driven by
release-plz on push to `main` with tags created for us, and permissions are declared inline in
`tauri.conf.json`. The advice was sound; the mapping needed doing.

The single most consequential difference from the generic plan is finding 1 — publishing before assets
exist. A greenfield project that builds on a tag never has that problem, so no generic guide mentions
it, and it would have surfaced as intermittent "no update information is currently available" errors
that are painful to reproduce.

### Updates

- 2026-07-25: Initial draft.
