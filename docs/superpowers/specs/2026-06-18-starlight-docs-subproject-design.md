# Starlight Docs Subproject Design

## Purpose

Create a standalone Astro Starlight documentation app inside `docs/` so project documentation has one canonical source of truth, separate from the Tauri desktop runtime.

## Goals

- Give documentation its own config, dependency metadata, and build command under `docs/`.
- Move markdown content into Starlight's content collection at `docs/src/content/docs`.
- Keep the desktop app's existing Astro config focused on product routes and Tauri bundling.
- Reduce root-level markdown sprawl while preserving required repository entrypoints.
- Keep sensitive key material out of docs and generated docs output.

## Non-Goals

- Do not merge Starlight into the main Astro app.
- Do not change product routes such as `/`, `/settings`, `/postee`, or `/saved-diagrams`.
- Do not rewrite ADR content or postmortems beyond frontmatter/link normalization required by Starlight.
- Do not migrate tool-required files that are conventionally expected at fixed paths, such as `AGENTS.md`, `CLAUDE.md`, and `.github/apple-signing.md`.

## Architecture

The repository will contain two Astro applications:

1. The existing root Astro/Tauri app using `astro.config.mts`.
2. A docs-only Starlight app rooted at `docs/` with its own `docs/astro.config.mjs`.

The docs app will use `@astrojs/starlight` and keep all rendered documentation under `docs/src/content/docs`. The root app will not import docs content, and the docs app will not import app runtime code.

## Content Structure

Starlight content will be grouped by reader intent:

- `overview/`: product overview, roadmap, design system, visual language.
- `guides/`: setup, database, release, Azure credentials, operational guides.
- `opy/`: OPY handbook and Rig agent material.
- `architecture/`: architecture notes and ADRs.
- `postmortems/`: incident writeups.
- `archive/`: older phase/status/fix notes retained for traceability but not treated as primary navigation.

Root-level `README.md` remains as the repository entrypoint and links to the docs app. `tests/README.md` stays in place for test-suite locality, with an optional mirror page in Starlight if useful.

## Commands

The docs subproject will expose local commands from `docs/package.json`:

- `bun run dev`
- `bun run build`
- `bun run check`

The root `package.json` will expose convenience wrappers:

- `bun run docs:dev`
- `bun run docs:build`
- `bun run docs:check`

## Migration Rules

- Move markdown with `git mv` where possible to preserve file history.
- Add Starlight frontmatter to every migrated rendered page.
- Normalize relative links to their new Starlight paths.
- Keep internal archive pages discoverable but lower priority in sidebar navigation.
- Remove or replace any real-looking secret values during migration.

## Testing

Verification will include:

- `bun install` or equivalent lockfile update after adding docs dependencies.
- `bun run docs:check` to validate Astro/Starlight content.
- `bun run docs:build` to verify static docs output.
- `bun run build` for the root app to confirm the Tauri frontend still builds independently.
- A targeted search for OpenAI key markers in source and docs output.

## Risks

- Existing links may break when files move. The plan must include link checks and README updates.
- Some old markdown may lack a clear canonical destination. Those files should go to `archive/` rather than blocking the first migration.
- Adding a second Astro app means dependency and lockfile churn. Commands must make the ownership boundary obvious.

## Open Decisions

None. The approved direction is a standalone docs app inside `docs/` with its own config and build command.
