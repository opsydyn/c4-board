---
title: "ADR-009: Adopt Varlock for Environment Governance"
---

# ADR-009: Adopt Varlock for Environment Governance

- **Status**: Accepted
- **Date**: 2026-07-23
- **Deciders**: Alan
**Technical Story**: Add schema-driven environment validation and value-aware leak scanning without moving application secrets out of the existing keychain-first runtime boundary.

## Context

C4 Board has application-owned environment variables across its Astro/React frontend, build tooling, Tauri backend, and test fixtures. Their names, value constraints, sensitivity, and intended scope are currently discoverable only by reading source.

OPY already resolves OpenAI credentials in this order:

1. OS keychain
2. application settings database fallback
3. `OPSYDYN_OPENAI_API_KEY` or `OPENAI_API_KEY`

Release signing credentials are supplied by GitHub Secrets. Feature flags and Azure pagination controls are non-sensitive runtime configuration. The repository ignores `.env` and `.env.production`, but does not comprehensively ignore local `.env.*` variants.

This creates four problems:

1. Environment configuration has no machine-validated contract.
2. Local secret files can be added under names not covered by `.gitignore`.
3. Coding agents and local tools can inherit real provider credentials without an explicit governance layer.
4. There is no value-aware check for a locally resolved secret appearing in tracked files or build output.

Varlock provides a committed `.env.schema`, typed validation, sensitive-value redaction, local encryption, scanning, and optional credential proxying. Its scanning is value-aware: it can only detect sensitive values that resolve in the invocation. It is not a replacement for a generic secret-pattern scanner or an application credential vault.

## Decision

Adopt Varlock `1.13.0` as a pinned development and CI dependency with a deliberately bounded role.

### Varlock owns

1. The committed contract for application-owned environment variables.
2. Local and CI validation of that contract.
3. Value-aware scanning of tracked, staged, or explicit build-output paths.
4. Optional local command injection in future, separately approved slices.
5. A future, separately evaluated credential proxy and sandbox for coding agents.

### Varlock does not own

1. OPY runtime credential persistence.
2. User-entered Postee secret persistence.
3. GitHub release signing secret storage.
4. Client-side provider configuration.
5. Generic secret-pattern or entropy scanning.

The OS keychain remains OPY's preferred credential source. Provider keys remain Rust-side and must never be exposed through Astro public variables or frontend bundles.

### Initial operating model

1. Commit `.env.schema` with no secret values.
2. Mark `OPSYDYN_OPENAI_API_KEY` and `OPENAI_API_KEY` as optional and sensitive.
3. Keep non-sensitive application variables optional so existing defaults remain authoritative.
4. Add package scripts for validation, repository scanning, and staged scanning.
5. Disable Varlock telemetry in `.varlock/config.json`.
6. Keep Bun's native `.env` loading enabled. Do not wrap `dev`, `build`, or Tauri commands globally with `varlock run`.
7. Validate the schema in CI and release jobs, build with a non-secret sensitive sentinel, and scan `dist` for that sentinel.
8. Expand `.gitignore` to ignore `.env` and `.env.*`, while explicitly retaining `.env.schema`.
9. Apply the same checks to automatic and manual release asset builds. Manually rebuilt tags from before ADR-009 skip Varlock-only steps because they do not contain the schema or dependency.

## Implementation Plan

### Affected paths

- `.env.schema`
- `.varlock/config.json`
- `.gitignore`
- `package.json`
- `bun.lock`
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `README.md`
- `test/config/varlock-policy.test.ts`

### Required patterns

- Invoke the project-pinned CLI through Bun package scripts.
- Parse workflow YAML in policy tests rather than checking command substrings.
- Keep telemetry disabled at project level.
- Keep all schema values optional unless the application cannot operate without them.
- Give public feature flags and sensitive provider keys separate schema sections.
- Document that `varlock scan` needs a resolved sensitive value to detect that value.
- Do not add `@varlock/astro-integration` in this phase.
- Do not add real or encrypted credentials to version control.

### Verification criteria

- [x] `.env.schema` parses successfully with Varlock 1.13.0.
- [x] Both OpenAI fallback variables are marked `@sensitive` and have no literal values.
- [x] Every application-owned environment variable read by current source or build tooling is represented.
- [x] `.env` and `.env.*` are ignored while `.env.schema` is trackable.
- [x] Repository-level telemetry is disabled.
- [x] CI runs schema validation from the frozen Bun dependency graph.
- [x] CI and release builds scan `dist` for a synthetic sensitive sentinel.
- [x] Automatic and manual release asset paths execute the Varlock checks for ADR-009-era tags.
- [x] The policy regression test passes.
- [x] Existing frontend tests, lint, Knip, build, and Starlight checks pass.

## Consequences

### Positive

- Environment configuration becomes explicit, reviewable, and machine validated.
- Sensitive fallbacks are labelled consistently and redacted by Varlock tooling.
- Developers gain a staged-file and repository scan that knows their resolved local secret values.
- Future agent credential proxy experiments have a clear boundary and prerequisite schema.

### Negative

- The repository gains another security-sensitive development dependency and lockfile surface.
- Developers must run commands through the package scripts to get deterministic Varlock behaviour.
- Local repository scanning can give false confidence if no sensitive value is available to Varlock; CI mitigates only frontend build leakage with a synthetic sentinel.
- Bun and Tauri commands launched directly do not receive Varlock's injection or redaction controls.

### Neutral

- Existing OPY key resolution and application behaviour remain unchanged.
- GitHub Secrets remain the source for release signing credentials.
- Postee secret values remain a separate at-rest storage concern.

## Alternatives Considered

### Continue with unstructured `.env` files

**Why rejected**: This preserves the current low-friction workflow but provides no shared validation contract, sensitivity metadata, or value-aware scanning.

### Replace application secret storage with Varlock

**Why rejected**: Varlock's Rust integration is process-launch configuration injection, not an embedded Tauri credential vault. Replacing OS keychain storage would weaken the runtime boundary and couple user credentials to a development tool.

### Integrate Varlock directly into Astro and disable Bun env loading now

**Why rejected**: This would broaden the first slice into runtime behaviour and could expose or suppress variables in existing development commands. It is unnecessary for schema and scanning value.

### Adopt only a generic secret scanner

**Why rejected**: Pattern and entropy scanners complement Varlock but do not provide typed environment validation, sensitivity metadata, or future credential proxying. A generic scanner can be evaluated separately.

## Deferred Work

1. Evaluate Varlock's credential proxy and sandbox with Codex using placeholder credentials and independently verified outbound destinations.
2. Decide whether all local development commands should use `varlock run`; only then consider `bunfig.toml` `env = false`.
3. Replace Postee plaintext secret values in SQLite with keychain-backed references or encrypted storage.
4. Remove or harden the OPY settings-database key fallback for production builds.
5. Evaluate a generic repository secret scanner alongside Varlock's value-aware scanning.

## Revisit Triggers

Revisit this decision if:

- Varlock becomes part of production process startup.
- Provider credentials need to be shared across developer machines.
- Bun env loading is disabled.
- Varlock's proxy becomes a mandatory agent execution boundary.
- A second environment schema or monorepo package requires independent ownership.

## References

- [Varlock schema](https://varlock.dev/guides/schema/)
- [Varlock CLI commands](https://varlock.dev/reference/cli-commands/)
- [Varlock secrets management](https://varlock.dev/guides/secrets/)
- [Varlock Rust integration](https://varlock.dev/integrations/rust/)
- [Varlock Bun integration](https://varlock.dev/integrations/bun/)
- `src-tauri/src/ai_agent.rs`
- `src/core/effects/feature-flags.ts`
- `src-tauri/src/azure_sync.rs`
