# Starlight Docs Subproject Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Astro Starlight documentation app under `docs/` and migrate markdown into a canonical Starlight content tree.

**Architecture:** Keep the existing root Astro/Tauri app unchanged as the product runtime. Add a nested docs-only Astro app at `docs/` using `@astrojs/starlight`, with rendered content in `docs/src/content/docs`. Root scripts delegate to docs scripts with `bun --cwd docs`.

**Tech Stack:** Bun, Astro 6, `@astrojs/starlight`, Markdown content collections, existing TypeScript toolchain.

---

### Task 1: Scaffold The Docs App

**Files:**
- Create: `docs/package.json`
- Create: `docs/astro.config.mjs`
- Create: `docs/src/content.config.ts`
- Create: `docs/tsconfig.json`
- Create: `docs/src/content/docs/index.md`
- Modify: `package.json`

- [ ] **Step 1: Add docs package metadata**

Create `docs/package.json` with docs-local commands and dependencies:

```json
{
  "name": "c4-board-docs",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "check": "astro check",
    "preview": "astro preview"
  },
  "dependencies": {
    "@astrojs/check": "0.9.9",
    "@astrojs/starlight": "0.40.0",
    "astro": "6.4.5",
    "typescript": "6.0.3"
  }
}
```

- [ ] **Step 2: Add Starlight config**

Create `docs/astro.config.mjs`:

```js
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  integrations: [
    starlight({
      title: "c4-board Docs",
      sidebar: [
        { slug: "index" },
        {
          label: "Overview",
          items: [{ autogenerate: { directory: "overview" } }],
        },
        {
          label: "Guides",
          items: [{ autogenerate: { directory: "guides" } }],
        },
        {
          label: "OPY",
          items: [{ autogenerate: { directory: "opy" } }],
        },
        {
          label: "Architecture",
          items: [{ autogenerate: { directory: "architecture" } }],
        },
        {
          label: "Postmortems",
          items: [{ autogenerate: { directory: "postmortems" } }],
        },
        {
          label: "Archive",
          items: [{ autogenerate: { directory: "archive" } }],
        },
      ],
    }),
  ],
});
```

- [ ] **Step 3: Add content collection config**

Create `docs/src/content.config.ts`:

```ts
import { defineCollection } from "astro:content";
import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema(),
  }),
};
```

- [ ] **Step 4: Add docs-local TypeScript config**

Create `docs/tsconfig.json`:

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [
    ".astro/types.d.ts",
    "src/**/*"
  ],
  "exclude": [
    "dist",
    "node_modules"
  ]
}
```

- [ ] **Step 5: Add docs landing page**

Create `docs/src/content/docs/index.md`:

```md
---
title: c4-board Documentation
description: Canonical documentation for the c4-board desktop architecture workspace.
---

# c4-board Documentation

This site is the canonical documentation home for c4-board.

Use it for product context, operating guides, architecture records, OPY/Rig agent notes, release notes, and incident postmortems.
```

- [ ] **Step 6: Add root docs scripts**

Modify root `package.json` scripts with:

```json
"docs:dev": "bun run --cwd docs dev",
"docs:build": "bun run --cwd docs build",
"docs:check": "bun run --cwd docs check",
"docs:preview": "bun run --cwd docs preview"
```

- [ ] **Step 7: Install docs dependencies**

Run:

```sh
bun install --cwd docs
```

Expected: `docs/bun.lock` is created or updated, and docs dependencies install without errors.

### Task 2: Move Markdown Into Starlight Content

**Files:**
- Move: root markdown notes into `docs/src/content/docs/archive/`
- Move: existing `docs/*.md` into topic directories under `docs/src/content/docs/`
- Move: `docs/adr/*.md` into `docs/src/content/docs/architecture/adr/`
- Move: `docs/postmortems/*.md` into `docs/src/content/docs/postmortems/`
- Move: `docs/opy/README.md` into `docs/src/content/docs/opy/index.md`

- [ ] **Step 1: Create content directories**

Run:

```sh
mkdir -p docs/src/content/docs/{overview,guides,opy,architecture/adr,postmortems,archive}
```

- [ ] **Step 2: Move docs already under `docs/`**

Use `git mv` to preserve history:

```sh
git mv docs/product-roadmap-team-topology-azure-sync.md docs/src/content/docs/overview/product-roadmap-team-topology-azure-sync.md
git mv docs/CONTEXT_MENU_IMPLEMENTATION.md docs/src/content/docs/guides/context-menu-implementation.md
git mv docs/CONTEXT_MENU_STATUS.md docs/src/content/docs/guides/context-menu-status.md
git mv docs/azure-credentials-reference.md docs/src/content/docs/guides/azure-credentials-reference.md
git mv docs/azure-graph-sample-data.md docs/src/content/docs/guides/azure-graph-sample-data.md
git mv docs/release-installation.md docs/src/content/docs/guides/release-installation.md
git mv docs/playbooks/team-topology-review-playbook.md docs/src/content/docs/guides/team-topology-review-playbook.md
git mv docs/rig-agent-hello-world.md docs/src/content/docs/opy/rig-agent-hello-world.md
git mv docs/rig-agent-task-breakdown.md docs/src/content/docs/opy/rig-agent-task-breakdown.md
git mv docs/opy/README.md docs/src/content/docs/opy/index.md
git mv docs/architecture/balanced-coupling-model.md docs/src/content/docs/architecture/balanced-coupling-model.md
git mv docs/postmortems/*.md docs/src/content/docs/postmortems/
git mv docs/adr/*.md docs/src/content/docs/architecture/adr/
```

- [ ] **Step 3: Move root markdown sprawl to archive**

Use `git mv` for root status/planning notes that are not fixed convention files:

```sh
git mv BRANDED_TYPES_FIXES.md docs/src/content/docs/archive/branded-types-fixes.md
git mv C4_LAYOUT_STRATEGIES.md docs/src/content/docs/archive/c4-layout-strategies.md
git mv DAGRE_LAYOUT_PLAN.md docs/src/content/docs/archive/dagre-layout-plan.md
git mv DATABASE_SETUP.md docs/src/content/docs/guides/database-setup.md
git mv DATETIME_MIGRATION_COMPLETE.md docs/src/content/docs/archive/datetime-migration-complete.md
git mv DESIGN_SYSTEM.md docs/src/content/docs/overview/design-system.md
git mv EDGE_LABEL_PERSISTENCE_ANALYSIS.md docs/src/content/docs/archive/edge-label-persistence-analysis.md
git mv EDITABLE_EDGE_LABELS_PLAN.md docs/src/content/docs/archive/editable-edge-labels-plan.md
git mv EFFECT_ENHANCEMENTS_ASSESSMENT.md docs/src/content/docs/archive/effect-enhancements-assessment.md
git mv FEATURE_ROADMAP.md docs/src/content/docs/overview/feature-roadmap.md
git mv GET_REQUEST_BODY_FIX.md docs/src/content/docs/archive/get-request-body-fix.md
git mv HTTP_CLIENT_DIAGNOSIS.md docs/src/content/docs/archive/http-client-diagnosis.md
git mv HTTP_FIX_APPLIED.md docs/src/content/docs/archive/http-fix-applied.md
git mv HTTP_FIX_FINAL.md docs/src/content/docs/archive/http-fix-final.md
git mv MULTI_BOARD_PLAN.md docs/src/content/docs/archive/multi-board-plan.md
git mv MVP_PLAN.md docs/src/content/docs/overview/mvp-plan.md
git mv OPSYDYN_VISUAL_LANGUAGE.md docs/src/content/docs/overview/opsydyn-visual-language.md
git mv PHASE1_COMPLETE.md docs/src/content/docs/archive/phase1-complete.md
git mv POSTEE_PHASE3_PLAN.md docs/src/content/docs/archive/postee-phase3-plan.md
git mv POSTEE_REFACTOR_DONE.md docs/src/content/docs/archive/postee-refactor-done.md
git mv POSTEE_REFACTOR_PLAN.md docs/src/content/docs/archive/postee-refactor-plan.md
git mv POSTEE_XSTATE_FIXES.md docs/src/content/docs/archive/postee-xstate-fixes.md
git mv SUBFLOWS_COMPLETE.md docs/src/content/docs/archive/subflows-complete.md
git mv TACTICAL_UI_COMPLETE.md docs/src/content/docs/archive/tactical-ui-complete.md
git mv TACTICAL_UI_PLAN.md docs/src/content/docs/archive/tactical-ui-plan.md
git mv THEME_CHANGES.md docs/src/content/docs/archive/theme-changes.md
git mv THEMING_PLAN.md docs/src/content/docs/archive/theming-plan.md
git mv TYPECLASS_ASSESSMENT.md docs/src/content/docs/archive/typeclass-assessment.md
git mv URL_SCOPE_FIX.md docs/src/content/docs/archive/url-scope-fix.md
git mv plan.md docs/src/content/docs/archive/legacy-plan.md
```

Leave `README.md`, `AGENTS.md`, `CLAUDE.md`, `WARP.md`, `.github/apple-signing.md`, and `tests/README.md` in their conventional locations.

### Task 3: Normalize Frontmatter And Links

**Files:**
- Modify: `docs/src/content/docs/**/*.md`
- Modify: `README.md`

- [ ] **Step 1: Add frontmatter to migrated pages**

For every markdown file under `docs/src/content/docs` that does not start with `---`, add:

```md
---
title: Human Readable Title
---
```

Derive the title from the first `# Heading` when present, otherwise from the filename.

- [ ] **Step 2: Normalize README documentation links**

Update root `README.md` documentation links to point at the new source files under `docs/src/content/docs` or explain that the docs app is run from `docs/`.

- [ ] **Step 3: Remove stale relative links**

Search migrated content for old paths:

```sh
rg -n "docs/|\\.\\./|README\\.md|rig-agent|release-installation|product-roadmap" docs/src/content/docs README.md
```

Fix links that refer to moved markdown files.

- [ ] **Step 4: Check for secret-shaped strings**

Run:

```sh
rg -n "sk-proj-|sk-[A-Za-z0-9_-]{20,}" docs README.md
```

Expected: no matches.

### Task 4: Verify Docs And Root App

**Files:**
- Read: generated output under `docs/dist`
- Read: generated output under root `dist`

- [ ] **Step 1: Run docs type/content check**

Run:

```sh
bun run docs:check
```

Expected: command exits 0.

- [ ] **Step 2: Run docs build**

Run:

```sh
bun run docs:build
```

Expected: command exits 0 and writes `docs/dist`.

- [ ] **Step 3: Run root app build**

Run:

```sh
bun run build
```

Expected: command exits 0 and writes root `dist`.

- [ ] **Step 4: Search generated docs output for key markers**

Run:

```sh
rg -n "sk-proj-|sk-[A-Za-z0-9_-]{20,}" docs/dist dist
```

Expected: no matches.

### Task 5: Commit The Migration

**Files:**
- All docs migration files and package metadata.

- [ ] **Step 1: Review status**

Run:

```sh
git status --short
```

Expected: only docs migration files, package metadata, lockfiles, and README/package script updates are changed.

- [ ] **Step 2: Commit**

Run:

```sh
git add README.md package.json docs
git commit -m "docs: add starlight documentation site"
```
