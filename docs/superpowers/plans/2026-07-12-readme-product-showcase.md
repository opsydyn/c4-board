# README Product Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an immediately visible two-image product showcase to the repository README.

**Architecture:** Reference the existing reviewed native Tauri baseline PNGs directly from Markdown. Keep the implementation confined to README content so no application or asset pipeline changes are introduced.

**Tech Stack:** GitHub-flavored Markdown, tracked PNG visual baselines

## Global Constraints

- Modify only `README.md` for implementation.
- Reference existing PNGs; do not copy or generate assets.
- Use product-oriented alt text and captions.
- Include exactly two desktop screenshots.

---

### Task 1: Add Product Showcase

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: `tests/__snapshots__/visual/tauri-layout/event-driven-desktop.png`, `tests/__snapshots__/visual/tauri-layout/event-driven-bridges-detail-desktop.png`
- Produces: GitHub-rendered `Product Showcase` README section

- [ ] **Step 1: Verify source images**

Run:

```bash
test -f tests/__snapshots__/visual/tauri-layout/event-driven-desktop.png
test -f tests/__snapshots__/visual/tauri-layout/event-driven-bridges-detail-desktop.png
```

Expected: both commands exit `0`.

- [ ] **Step 2: Add the showcase section**

Insert after the introductory paragraphs and before `## Current Status`:

```markdown
## Product Showcase

![The c4-board Event-Driven workspace showing semantic architecture lanes and the layout preview drawer](tests/__snapshots__/visual/tauri-layout/event-driven-desktop.png)

_Review architecture changes in the native workspace with semantic roles, diagnostics, and non-destructive layout previews._

![A detailed multi-bus Event-Driven layout showing deterministic bridge routing](tests/__snapshots__/visual/tauri-layout/event-driven-bridges-detail-desktop.png)

_Model complex event topologies with deterministic bus bands, explicit processor bridges, and readable subscriber paths._
```

- [ ] **Step 3: Verify Markdown hygiene**

Run:

```bash
git diff --check
```

Expected: exit `0` with no output.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: showcase native layout experience"
```
