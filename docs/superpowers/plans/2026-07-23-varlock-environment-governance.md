# Varlock Environment Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add schema-driven environment validation and value-aware secret scanning without replacing C4 Board's keychain-first runtime secret storage.

**Architecture:** Varlock is a pinned development dependency and repository security gate. A committed `.env.schema` describes application-owned variables while `.varlock/config.json` disables telemetry; OPY credentials remain optional, sensitive Rust-side fallbacks and no command is globally wrapped with `varlock run`.

**Tech Stack:** Bun 1.3, Varlock 1.13, Vitest 4, GitHub Actions, Starlight ADRs

## Global Constraints

- Keep the OS keychain as the first-priority OPY credential source.
- Never inject provider credentials into Astro client code or browser bundles.
- Do not disable Bun's native `.env` loading in this slice.
- Do not treat `varlock scan` as a generic entropy or credential-pattern scanner; it detects resolved sensitive values.
- Do not migrate Postee's persisted secret values in this slice.
- Disable Varlock telemetry at repository level.

---

### Task 1: Record the environment security boundary

**Files:**
- Create: `docs/src/content/docs/architecture/adr/009-varlock-environment-governance.md`
- Modify: `docs/src/content/docs/architecture/adr/index.md`

**Interfaces:**
- Consumes: existing OPY keychain resolution and GitHub Secrets release configuration
- Produces: ADR-009, the governing boundary for Varlock adoption

- [x] **Step 1: Write ADR-009**

Record the context, accepted bounded adoption, rejected alternatives, exact affected files, deferred work, and measurable verification criteria.

- [x] **Step 2: Update the ADR index**

Add ADR-009 as `Accepted` with date `2026-07-23`.

- [x] **Step 3: Validate the documentation**

Run: `bun run docs:check`

Expected: Starlight diagnostics complete without errors.

### Task 2: Add a tested environment contract

**Files:**
- Create: `test/config/varlock-policy.test.ts`
- Create: `.env.schema`
- Create: `.varlock/config.json`
- Modify: `.gitignore`
- Modify: `package.json`
- Modify: `bun.lock`

**Interfaces:**
- Consumes: application-owned environment keys found in TypeScript, Rust, and build scripts
- Produces: `env:check`, `env:scan`, and `env:scan:staged` package scripts

- [x] **Step 1: Write the failing policy test**

Assert that the schema exists, derives all application-owned variables from source, marks provider credentials sensitive without literal defaults, disables telemetry, broadly ignores local `.env` variants while retaining `.env.schema`, and exposes the Varlock scripts.

- [x] **Step 2: Verify RED**

Run: `bun run test:run test/config/varlock-policy.test.ts`

Expected: FAIL because `.env.schema` and the Varlock configuration do not exist.

- [x] **Step 3: Add the minimal contract**

Pin `varlock@1.13.0` as a development dependency and `yaml@2.9.0` for structural workflow tests. Add schema entries for feature flags, OPY provider fallbacks, Azure pagination tuning, the visual fixture selector, and frontend build heap tuning. Add telemetry configuration, scripts, and broad `.env` ignore rules.

- [x] **Step 4: Verify GREEN and the real parser**

Run:

```bash
bun run test:run test/config/varlock-policy.test.ts
bun run env:check
bun run env:scan
```

Expected: the policy test passes, Varlock resolves the optional schema without validation errors, and no configured sensitive value is found in tracked files.

### Task 3: Gate CI and document operator usage

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/release.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: `env:check` and `env:scan` from Task 2
- Produces: CI schema validation and clear local scanning/runtime boundaries

- [x] **Step 1: Add CI validation**

Run `bun run env:check` after the frozen dependency install. Build the frontend with a non-secret value assigned to the sensitive OPY key, then run `bun run env:scan:build` against `dist`. Apply the same sequence to ordinary CI, the independent release gate, and release asset builds; legacy manually rebuilt tags without `.env.schema` skip the Varlock-only steps.

- [x] **Step 2: Document local usage**

Document `.env.local`, `bun run env:check`, `bun run env:scan`, `bun run env:scan:build`, and `bun run env:scan:staged`. State that scanning only detects sensitive values Varlock can resolve, CI uses a synthetic build sentinel, and OPY's settings/keychain path remains preferred.

- [x] **Step 3: Run repository verification**

Run:

```bash
bun run test:run
bun run lint
bun run knip
bun run build
bun run docs:check
```

Expected: all commands exit zero.
