---
title: "Postmortem: release-plz \"nothing to release\" — v0.0.2 release blocked"
---

# Postmortem: release-plz "nothing to release" — v0.0.2 release blocked

- Date: 2026-06-08
- Severity: P2
- Affected surface: Release pipeline (`release-plz release` job, CI)
- Status: Resolved

## Summary

After merging the v0.0.2 release PR (#6), the `release-plz release` CI job ran and returned `{"releases":[]}` in under one second. No `v0.0.2` git tag was created, no GitHub release was published, and the `build-release-assets` job (DMG bundling) was skipped. The release was silently a no-op for every push to `main`.

## Customer impact

- No desktop builds (.dmg / .AppImage) were produced for v0.0.2.
- Releases page stalled at v0.0.1 (which itself had no binary assets).
- Pipeline appeared green — the release job succeeded with exit code 0 — masking the problem.

## Detection

Manual inspection of the GitHub Releases page and Actions run history after noticing no assets had appeared following the merge of the release PR.

## Timeline

| Time (UTC) | Event |
|---|---|
| 2026-05-28 | v0.0.1 GitHub release created (no binary assets) |
| 2026-06-08 20:05 | PR #6 merged — `src-tauri/Cargo.toml` bumped to `0.0.2` |
| 2026-06-08 20:11 | `release-plz release` job ran, returned `{"releases":[]}` in ~0.8 s |
| 2026-06-08 20:11 | `build-release-assets` skipped (releases_created=false) |
| 2026-06-08 21:05 | Root cause identified via release-plz source code analysis |
| 2026-06-08 21:07 | Fix pushed (`b568a62`) — `publish = false` removed from `src-tauri/Cargo.toml` |
| 2026-06-08 21:07 | New push triggered release workflow; release-plz created GitHub release `336239698` (tag `v0.0.2`) |
| 2026-06-08 21:14 | `build-release-assets` macOS jobs failed — Apple signing secrets not yet configured |
| 2026-06-08 21:XX | Fix pushed (`daa185b`) — `APPLE_SIGNING_ENABLED: false` added to skip signing validation |
| 2026-06-08 21:XX | Manual `workflow_dispatch` triggered for `v0.0.2` to rebuild assets — run [27167910719](https://github.com/opsydyn/c4-board/actions/runs/27167910719) |

## Root cause

### release-plz `release` vs `release-pr` use different package discovery paths

The `release-plz release` command calls `project.publishable_packages()`, which
filters the Cargo workspace through `is_publishable()`. That function reads the
**Cargo.toml `publish` field** directly from cargo_metadata:

```rust
// crates/release_plz_core/src/next_ver.rs
fn is_publishable(&self) -> bool {
    // publish = false  →  false
    // publish = []     →  false
    // absent / true    →  true
}
```

`src-tauri/Cargo.toml` had `publish = false`. This caused `publishable_packages()` to return an empty list, and the `release` command logged `INFO nothing to release` and exited immediately — **before it ever read the `git_only = true` or `publish = false` settings in `release-plz.toml`**.

The `release-pr` command works correctly because it uses `collect_git_only_packages()` in `next_ver.rs`, which inspects the release-plz config directly and does **not** filter on `is_publishable()`. This asymmetry between the two commands is effectively a bug in release-plz.

### Why the pipeline appeared healthy

- Both the `release-plz-pr` and `release-plz-release` jobs exited with code 0.
- The `release-plz-release` job summary correctly printed "No GitHub release was created from this ref, so desktop bundling is skipped intentionally." — a message intended for the case where there are genuinely no changes, which disguised the real failure.
- The `build-release-assets` job was gated on `releases_created == 'true'`; skipping it is the expected no-op path, so no alert fired.

## Fix

Removed `publish = false` from `src-tauri/Cargo.toml` (commit `b568a62`).

```diff
-publish = false
 include = [
```

The `release-plz.toml` already carries the authoritative publishing policy:

```toml
[workspace]
git_only    = true   # create git tag + GitHub release only; never push to crates.io
publish     = false  # belt-and-braces: do not invoke cargo publish
```

With `publish = false` absent from `Cargo.toml`, `is_publishable()` returns `true`, so the package enters `publishable_packages()`. The `release` command then reaches the `is_publish_enabled()` check (which reads `release-plz.toml`), sees `git_only = true`, and routes to `release_package_git_only()` — creating the git tag and GitHub release without touching crates.io.

## Re-running asset builds against an existing release

When a release tag and GitHub release already exist but the `build-release-assets` jobs either failed or were skipped, use `workflow_dispatch` to rebuild without creating a new release:

```bash
gh workflow run release.yml \
  --repo opsydyn/c4-board \
  -f release_tag=v0.0.2   # substitute the tag you want to (re)build
```

This routes through the `resolve-existing-release` job, which looks up the GitHub release ID from the tag and feeds it into `build-release-assets`. The workflow executes from the **current `main`** (not the tagged commit), so any workflow fixes are picked up automatically. The source code built is still checked out from `ref: ${{ env.RELEASE_TAG }}`, so the app binary is correct.

Use this any time:

- A macOS/Linux/Windows build matrix leg fails mid-run and you need to retry only that platform (re-run from failure works too, but `workflow_dispatch` is a clean slate).
- A post-release workflow change (e.g. enabling signing) means you want to re-upload assets for a tag that was already published.

> **Do not** bump the version or create a new release PR just to trigger a build retry. That produces a new semver tag for an unchanged codebase.

## Detection gap

The failure was invisible because:

1. The job exited 0.
2. The "no release" summary message is identical for both "nothing changed" and "package filtered out".
3. There is no alerting on a zero-release run immediately after a version-bump commit.

## Prevention

### Immediate

- Add a dry-run gate to the release pipeline. The existing `release-dry-run.yml` workflow was already present; run it automatically on every release PR merge (or as a required check on release branches) so a zero-release result on a version-bump commit is visible before the real release run.

### Structural

- **Never set `publish = false` in `Cargo.toml` for packages that use `git_only = true` in release-plz.** The release-plz.toml is the single source of truth for publishing policy; duplicate the constraint in Cargo.toml only when the crate could plausibly be published to a registry.
- Add this rule to `CLAUDE.md` under the release pipeline section.
- Upstream: file a bug against release-plz — `release` should respect `git_only` packages regardless of the Cargo.toml `publish` field, consistent with how `release-pr` already works.

## Lessons

- A CI step that always exits 0 and never produces output is indistinguishable from a step that is silently broken. Prefer explicit assertions (`releases_created must be true when version was bumped`) over silent skips.
- `publish = false` in Cargo.toml and `publish = false` in release-plz.toml look equivalent but control entirely different code paths. Cargo.toml gates `is_publishable()` (package discovery); release-plz.toml gates `is_publish_enabled()` (what to do once discovered).
