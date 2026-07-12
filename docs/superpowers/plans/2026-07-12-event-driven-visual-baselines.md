# Event-Driven Native Visual Baselines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old ELK Event-Driven native baselines with the custom single-bus semantic layout and add reviewed multi-bus bridge baselines.

**Architecture:** Extend the non-persistent visual fixture harness with deterministic single-bus and bridge-stress graphs that both open the production `eventDriven` preset. Review disposable Tauri captures at exact desktop/narrow dimensions before promoting four tracked PNGs and recording Slice 39.

**Tech Stack:** TypeScript, React Flow, Vitest, Bun, Tauri 2, macOS CoreGraphics/screencapture, Astro/Starlight

## Global Constraints

- Keep `event-driven` as the representative fixture name but change its preset from `elkLayered` to `eventDriven`.
- Add `event-driven-bridges` with three buses, adjacent and non-adjacent bridge processors, multiple bridge groups sharing a source, a local processor, subscribers, support nodes, and an unclassified review node.
- Use explicit semantic roles where needed for deterministic geometry; do not change production classification or layout behavior.
- Fixtures remain clone-isolated, non-persistent, and automatically open their intended preset.
- Replace `event-driven-desktop.png` and `event-driven-narrow.png`; add `event-driven-bridges-desktop.png` and `event-driven-bridges-narrow.png`.
- Capture desktop at exactly `1600x900` and narrow at exactly `960x720`.
- Inspect disposable images before baseline promotion; do not promote blank, clipped, overlapping, stale-preset, or incorrectly sized captures.
- Do not modify layout geometry, classification, preview UI, persistence, migrations, Client-Server behavior, or OPY/Rig behavior.

---

### Task 1: Deterministic Event-Driven Visual Fixtures

**Files:**
- Modify: `src/core/effects/layout-visual-fixtures.ts`
- Modify: `test/core/effects/layout-visual-fixtures.test.ts`
- Modify: `.github/scripts/capture-tauri-layout.ts`
- Modify: `tests/visual/tauri-layout/README.md`

**Interfaces:**
- Consumes: `LayoutPresetName`, existing `getLayoutVisualFixture`, fixture auto-open behavior, and native capture scenario validation.
- Produces: recognized `event-driven-bridges` fixture/scenario and deterministic `eventDriven` fixture payloads.

- [ ] **Step 1: Add failing fixture-contract tests**

In `test/core/effects/layout-visual-fixtures.test.ts`, include `event-driven-bridges` in clone and recognition tests, then add:

```ts
it("selects custom Event-Driven layouts and preserves bridge roles", () => {
  const representative = getLayoutVisualFixture("event-driven");
  const bridges = getLayoutVisualFixture("event-driven-bridges");
  const roles = Object.fromEntries(bridges.nodes.map(node => [node.id, node.data.layoutRole]));

  expect(representative.preset).toBe("eventDriven");
  expect(bridges.preset).toBe("eventDriven");
  expect(Object.values(roles).filter(role => role === "event-bus")).toHaveLength(3);
  expect(roles).toMatchObject({
    "a-to-b": "processor",
    "a-to-c": "processor",
    "b-to-c": "processor",
    "a-local": "processor",
    telemetry: "infrastructure",
    "external-monitor": "external-dependency",
    "review-node": "unclassified",
  });

  const edges = new Set(bridges.edges.map(({ source, target }) => `${source}->${target}`));
  expect(edges).toEqual(expect.setContaining([
    "a-bus->a-to-b",
    "a-to-b->b-bus",
    "a-bus->a-to-c",
    "a-to-c->c-bus",
    "b-bus->b-to-c",
    "b-to-c->c-bus",
  ]));
});
```

If the installed Vitest version does not support `expect.setContaining`, use six direct `expect(edges.has(...)).toBe(true)` assertions instead.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
bunx vitest run test/core/effects/layout-visual-fixtures.test.ts
```

Expected: FAIL because `event-driven-bridges` is not a valid fixture and `event-driven` still selects `elkLayered`.

- [ ] **Step 3: Implement representative and bridge fixtures**

In `src/core/effects/layout-visual-fixtures.ts`:

- Add `"event-driven-bridges"` to `LayoutVisualFixtureName` and `isLayoutVisualFixtureName`.
- Change `FIXTURES["event-driven"].preset` to `"eventDriven"`.
- Give the representative fixture explicit roles for two publishers, one bus, one local processor, two subscribers, and one infrastructure node. Use edges that connect publishers to the bus, bus to processor/subscribers, and processor to a terminal subscriber.
- Add `event-driven-bridges` with these stable IDs and roles:

```ts
nodes: [
  node("orders-publisher", "container", { layoutRole: "publisher" }),
  node("a-bus", "system", { layoutRole: "event-bus" }),
  node("b-bus", "system", { layoutRole: "event-bus" }),
  node("c-bus", "system", { layoutRole: "event-bus" }),
  node("a-local", "component", { layoutRole: "processor" }),
  node("a-to-b", "component", { layoutRole: "processor" }),
  node("a-to-c", "component", { layoutRole: "processor" }),
  node("b-to-c", "component", { layoutRole: "processor" }),
  node("a-subscriber", "component", { layoutRole: "subscriber" }),
  node("b-subscriber", "component", { layoutRole: "subscriber" }),
  node("c-subscriber", "component", { layoutRole: "subscriber" }),
  node("telemetry", "component", { layoutRole: "infrastructure" }),
  node("external-monitor", "externalSystem", { layoutRole: "external-dependency" }),
  node("review-node", "component", { layoutRole: "unclassified" }),
]
```

Use direct edges for publisher-to-A, A-local-to-A-subscriber, A-to-B, A-to-C, B-to-C, and each bus-to-subscriber relationship. Every processor must have an incoming bus edge; bridge processors must have an outgoing edge to their destination bus.

- [ ] **Step 4: Extend capture scenario validation and documentation**

Add `event-driven-bridges` to `SCENARIOS` and the usage message in `.github/scripts/capture-tauri-layout.ts`.

Update `tests/visual/tauri-layout/README.md` to list both Event-Driven scenarios, explain that `event-driven` replaces the former ELK baseline, and show the bridge fixture launch/capture commands.

- [ ] **Step 5: Run focused tests, lint, and build**

Run separately:

```bash
bunx vitest run test/core/effects/layout-visual-fixtures.test.ts
bun run lint
bun run build
```

Expected: fixture tests PASS; ESLint exits `0`; Astro check reports zero diagnostics and the frontend build completes.

- [ ] **Step 6: Commit Task 1**

Run `git diff --check`, inspect the four-file diff, then commit:

```bash
git add src/core/effects/layout-visual-fixtures.ts test/core/effects/layout-visual-fixtures.test.ts .github/scripts/capture-tauri-layout.ts tests/visual/tauri-layout/README.md
git commit -m "test: add event-driven bridge visual fixture"
```

---

### Task 2: Native Capture, Baseline Promotion, and Roadmap

**Files:**
- Replace: `tests/__snapshots__/visual/tauri-layout/event-driven-desktop.png`
- Replace: `tests/__snapshots__/visual/tauri-layout/event-driven-narrow.png`
- Create: `tests/__snapshots__/visual/tauri-layout/event-driven-bridges-desktop.png`
- Create: `tests/__snapshots__/visual/tauri-layout/event-driven-bridges-narrow.png`
- Modify: `docs/src/content/docs/overview/intelligent-layout-roadmap.md`

**Interfaces:**
- Consumes: Task 1 fixture names, `C4_VISUAL_FIXTURE`, and `bun run visual:tauri:capture`.
- Produces: four reviewed native PNG baselines and Slice 39 delivery evidence.

- [ ] **Step 1: Capture the representative fixture at both viewports**

Stop any fixture-specific Tauri process without stopping the shared Astro dev server. Start:

```bash
C4_VISUAL_FIXTURE=event-driven bun tauri dev
```

After the custom preview drawer is visible, run sequentially:

```bash
bun run visual:tauri:capture -- --scenario event-driven --viewport desktop
bun run visual:tauri:capture -- --scenario event-driven --viewport narrow
```

Expected: exact `1600x900` and `960x720` disposable captures under `.artifacts/tauri-layout/`.

- [ ] **Step 2: Inspect representative disposable captures**

Inspect both PNGs at original resolution. Confirm custom engine/strategy identity, semantic role evidence, left-to-right flow columns, support lane, visible canvas content, coherent drawer controls, and no overlap/clipping. If either fails, diagnose and recapture before promotion.

- [ ] **Step 3: Capture and inspect the bridge fixture**

Stop the representative Tauri process and start:

```bash
C4_VISUAL_FIXTURE=event-driven-bridges bun tauri dev
```

Capture sequentially:

```bash
bun run visual:tauri:capture -- --scenario event-driven-bridges --viewport desktop
bun run visual:tauri:capture -- --scenario event-driven-bridges --viewport narrow
```

Inspect both at original resolution. Confirm three bands, distinct bridge sub-tracks, local processor clearance, subscribers to the right, support/review lanes, custom strategy identity, and no blank/failed rendering.

- [ ] **Step 4: Promote the four reviewed captures**

After inspection, rerun each capture with `--update-baseline` while its matching fixture process is active, or copy the exact reviewed disposable PNG to its tracked baseline path. Verify dimensions and file names:

```bash
sips -g pixelWidth -g pixelHeight tests/__snapshots__/visual/tauri-layout/event-driven-*.png
```

Expected: desktop files `1600x900`; narrow files `960x720`.

- [ ] **Step 5: Record Slice 39 and run complete gates**

In `docs/src/content/docs/overview/intelligent-layout-roadmap.md`:

- Mark native custom Event-Driven desktop/narrow baselines complete.
- Add `### Slice 39 Delivery Record` dated `2026-07-12`.
- Record representative and bridge fixtures, four exact-dimension captures, visual inspection, replacement of stale ELK images, and bridge-geometry protection.
- Set the next slice to Client-Server semantic inference and deterministic client, service/API, domain, and persistence columns.

Run separately:

```bash
bun run test:run
bun run lint
bun run build
cargo check --manifest-path src-tauri/Cargo.toml
bun run docs:build
git diff --check
```

Expected: all tests and builds pass with zero frontend diagnostics.

- [ ] **Step 6: Commit Task 2 and restore normal development app**

Stop the fixture Tauri process, restart normal `bun tauri dev`, and leave it running. Confirm only the four PNGs and roadmap are changed, then commit:

```bash
git add tests/__snapshots__/visual/tauri-layout/event-driven-desktop.png tests/__snapshots__/visual/tauri-layout/event-driven-narrow.png tests/__snapshots__/visual/tauri-layout/event-driven-bridges-desktop.png tests/__snapshots__/visual/tauri-layout/event-driven-bridges-narrow.png docs/src/content/docs/overview/intelligent-layout-roadmap.md
git commit -m "test: add native event-driven visual baselines"
```
