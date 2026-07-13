# Client-Server Native Visual Baselines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy Client-Server ELK fixture and images with paired inferred/corrected fixtures and four reviewed native Tauri baselines for the custom semantic strategy.

**Architecture:** Build one clone-isolated shared Client-Server graph and derive inferred/corrected fixture states by changing only one explicit semantic role. Extend the existing native macOS capture harness, inspect disposable captures at original resolution, promote only exact-dimension approved PNGs, then reconcile Slice 41 and run the complete release gates.

**Tech Stack:** TypeScript, Effect-based layout contracts, React Flow, Vitest, Bun, Tauri 2, macOS CoreGraphics/Accessibility/screencapture, Astro/Starlight

## Global Constraints

- Fixture names are exactly `client-server-inferred` and `client-server-corrected`; remove the legacy `client-server` fixture/scenario after all references migrate.
- Both fixtures use `preset: "clientServer"`, identical node IDs, identical edge IDs, and identical graph structure.
- Only the deliberately ambiguous `decision-module` node's `data.layoutRole` differs: absent in inferred and `domain` in corrected.
- The inferred fixture must retain representative client, service, domain, persistence, external-support, and unclassified review placement.
- The corrected fixture must move only `decision-module` from the review lane into the domain column.
- External support must remain exactly horizontally centred beneath its deterministic service caller using actual node centres; its left edge may be off-grid.
- Fixtures remain clone-isolated, non-persistent, and automatically open the production Client-Server strategy.
- Capture desktop at exactly `1600x900` and narrow at exactly `960x720`.
- Inspect disposable native images at original resolution before baseline promotion; never promote blank, clipped, overlapping, stale-strategy, or incorrectly sized captures.
- Do not modify Client-Server classification, geometry, correction UI, persistence, migrations, OPY/Rig behavior, or any non-Client-Server layout strategy.

---

### Task 1: Paired Client-Server Fixture Contract

**Files:**
- Modify: `src/core/effects/layout-visual-fixtures.ts`
- Modify: `test/core/effects/layout-visual-fixtures.test.ts`
- Modify: `.github/scripts/capture-tauri-layout.ts`
- Modify: `tests/visual/tauri-layout/README.md`

**Interfaces:**
- Consumes: `LayoutVisualFixtureName`, `getLayoutVisualFixture`, `isLayoutVisualFixtureName`, `calculateLayout`, `getPreset`, and the existing `C4_VISUAL_FIXTURE` bootstrap path.
- Produces: recognized `client-server-inferred` and `client-server-corrected` scenarios that open `clientServer` and differ only by `decision-module.data.layoutRole`.

- [ ] **Step 1: Write failing fixture-name and clone-contract tests**

Replace the legacy `client-server` entries in the fixture clone and recognition tables with:

```ts
"client-server-inferred",
"client-server-corrected",
```

Add this test to `test/core/effects/layout-visual-fixtures.test.ts`:

```ts
it("keeps inferred and corrected Client-Server fixtures structurally identical", () => {
  const inferred = getLayoutVisualFixture("client-server-inferred");
  const corrected = getLayoutVisualFixture("client-server-corrected");
  const nodeIds = (fixture: typeof inferred) => fixture.nodes.map(({ id }) => id).sort();
  const edgeIds = (fixture: typeof inferred) => fixture.edges.map(({ id }) => id).sort();
  const inferredDecision = inferred.nodes.find(({ id }) => id === "decision-module");
  const correctedDecision = corrected.nodes.find(({ id }) => id === "decision-module");

  expect(inferred.preset).toBe("clientServer");
  expect(corrected.preset).toBe("clientServer");
  expect(nodeIds(corrected)).toEqual(nodeIds(inferred));
  expect(edgeIds(corrected)).toEqual(edgeIds(inferred));
  expect(inferredDecision?.data.layoutRole).toBeUndefined();
  expect(correctedDecision?.data.layoutRole).toBe("domain");

  const normalized = (fixture: typeof inferred) => fixture.nodes.map((fixtureNode) => {
    if (fixtureNode.id !== "decision-module") return fixtureNode;
    const { layoutRole: _layoutRole, ...data } = fixtureNode.data;
    return { ...fixtureNode, data };
  });
  expect(normalized(corrected)).toEqual(normalized(inferred));
});
```

- [ ] **Step 2: Write failing semantic movement and support-centre tests**

Import `calculateLayout` and `getPreset` from `@/core/effects/layout`, then add:

```ts
it("moves only the corrected node while preserving exact external support centring", () => {
  const inferredFixture = getLayoutVisualFixture("client-server-inferred");
  const correctedFixture = getLayoutVisualFixture("client-server-corrected");
  const inferred = calculateLayout(
    inferredFixture.nodes,
    inferredFixture.edges,
    getPreset(inferredFixture.preset),
  );
  const corrected = calculateLayout(
    correctedFixture.nodes,
    correctedFixture.edges,
    getPreset(correctedFixture.preset),
  );
  const position = (result: typeof inferred, id: string) =>
    result.nodes.find(node => node.id === id)!.position;
  const centreX = (result: typeof inferred, id: string) => {
    const layoutNode = result.nodes.find(node => node.id === id)!;
    return layoutNode.position.x + Number(layoutNode.style?.width ?? 160) / 2;
  };

  expect(inferred.semanticRoles?.find(({ nodeId }) => nodeId === "decision-module")?.role)
    .toBe("unclassified");
  expect(corrected.semanticRoles?.find(({ nodeId }) => nodeId === "decision-module")?.role)
    .toBe("domain");
  expect(position(corrected, "decision-module")).not.toEqual(position(inferred, "decision-module"));
  expect(centreX(inferred, "identity-provider")).toBe(centreX(inferred, "api-server"));
  expect(centreX(corrected, "identity-provider")).toBe(centreX(corrected, "api-server"));

  for (const id of ["web-client", "mobile-client", "api-server", "customer-domain", "customer-repository", "identity-provider"]) {
    expect(position(corrected, id)).toEqual(position(inferred, id));
  }
});
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```bash
bun run test:run test/core/effects/layout-visual-fixtures.test.ts
```

Expected: FAIL because the paired fixture names are not recognized and the legacy fixture still selects `elkLayered`.

- [ ] **Step 4: Implement the shared graph and paired fixtures**

In `src/core/effects/layout-visual-fixtures.ts`, add both new names to `LayoutVisualFixtureName` and `isLayoutVisualFixtureName`, remove `"client-server"`, and define this shared graph:

```ts
const CLIENT_SERVER_GRAPH: Pick<LayoutVisualFixture, "nodes" | "edges"> = {
  nodes: [
    node("web-client", "person"),
    node("mobile-client", "person"),
    node("api-server", "container", { label: "Customer API Server" }),
    node("customer-domain", "aggregate", { label: "Customer Aggregate" }),
    node("customer-repository", "repository", { label: "Customer Repository" }),
    node("identity-provider", "externalSystem", { label: "Identity Provider" }),
    node("decision-module", "component", { label: "Decision Module" }),
  ],
  edges: [
    edge("web-client", "api-server", "request"),
    edge("mobile-client", "api-server", "request"),
    edge("api-server", "customer-domain", "calls"),
    edge("customer-domain", "customer-repository", "customer data"),
    edge("api-server", "identity-provider", "token request"),
    edge("api-server", "decision-module", "evaluate"),
    edge("decision-module", "customer-domain", "decision"),
  ],
};
```

Create `client-server-inferred` with `...CLIENT_SERVER_GRAPH`. Create `client-server-corrected` from the same graph but map the `decision-module` node to a clone with `data.layoutRole: "domain"`; clone every other node and data object so fixture constants do not share mutable node objects. Both use `preset: "clientServer"` and distinct titles.

- [ ] **Step 5: Migrate capture scenarios and documentation**

In `.github/scripts/capture-tauri-layout.ts`, replace `"client-server"` in `SCENARIOS` and the usage string with the two new names.

In `tests/visual/tauri-layout/README.md`, document these start commands:

```bash
C4_VISUAL_FIXTURE=client-server-inferred bun tauri dev
C4_VISUAL_FIXTURE=client-server-corrected bun tauri dev
```

Document four matching capture commands, explain that the corrected fixture changes only `decision-module`, and remove instructions to capture the legacy `client-server` scenario.

- [ ] **Step 6: Verify Task 1 and commit**

Run separately:

```bash
bun run test:run test/core/effects/layout-visual-fixtures.test.ts test/core/effects/client-server-layout-strategy.test.ts
bun run lint
bun run build
git diff --check
```

Expected: focused tests pass, ESLint exits `0`, Astro reports zero diagnostics and builds, and the diff has no whitespace errors.

Commit:

```bash
git add src/core/effects/layout-visual-fixtures.ts test/core/effects/layout-visual-fixtures.test.ts .github/scripts/capture-tauri-layout.ts tests/visual/tauri-layout/README.md
git commit -m "test: add client-server visual fixtures"
```

---

### Task 2: Native Capture and Baseline Promotion

**Files:**
- Delete: `tests/__snapshots__/visual/tauri-layout/client-server-desktop.png`
- Delete: `tests/__snapshots__/visual/tauri-layout/client-server-narrow.png`
- Create: `tests/__snapshots__/visual/tauri-layout/client-server-inferred-desktop.png`
- Create: `tests/__snapshots__/visual/tauri-layout/client-server-inferred-narrow.png`
- Create: `tests/__snapshots__/visual/tauri-layout/client-server-corrected-desktop.png`
- Create: `tests/__snapshots__/visual/tauri-layout/client-server-corrected-narrow.png`

**Interfaces:**
- Consumes: Task 1 fixture/scenario names, `C4_VISUAL_FIXTURE`, and `bun run visual:tauri:capture`.
- Produces: four exact-dimension, visually approved native PNG baselines for inferred and corrected Client-Server states.

- [ ] **Step 1: Capture inferred disposable images**

Keep the shared Astro server if already running, but stop stale fixture-specific Tauri processes. Start:

```bash
C4_VISUAL_FIXTURE=client-server-inferred bun tauri dev
```

After the custom preview is visible, run sequentially:

```bash
bun run visual:tauri:capture -- --scenario client-server-inferred --viewport desktop
bun run visual:tauri:capture -- --scenario client-server-inferred --viewport narrow
```

Expected outputs:

```text
.artifacts/tauri-layout/client-server-inferred-desktop.png
.artifacts/tauri-layout/client-server-inferred-narrow.png
```

- [ ] **Step 2: Inspect inferred images at original resolution**

Use the image inspection tool on both files with original detail. Confirm all four primary columns, `decision-module` in the review lane, `identity-provider` exactly centred under `api-server`, semantic evidence/diagnostics, custom engine identity, readable controls, and no overlap or clipping. Recapture after diagnosing any failure; do not promote a failed image.

- [ ] **Step 3: Capture and inspect corrected disposable images**

Stop the inferred fixture process, then start:

```bash
C4_VISUAL_FIXTURE=client-server-corrected bun tauri dev
```

Capture sequentially:

```bash
bun run visual:tauri:capture -- --scenario client-server-corrected --viewport desktop
bun run visual:tauri:capture -- --scenario client-server-corrected --viewport narrow
```

Inspect both at original resolution. Confirm `decision-module` moved into the domain column, corrected evidence replaced ambiguity, all other placements remain stable, exact support centring remains visible, and controls/content are not clipped.

- [ ] **Step 4: Promote the reviewed images and remove legacy baselines**

While each matching fixture process is active, rerun its two commands with `--update-baseline`, or copy the already inspected disposable files byte-for-byte to the tracked baseline paths. Remove the two legacy `client-server-*.png` images.

Validate all new images:

```bash
sips -g pixelWidth -g pixelHeight tests/__snapshots__/visual/tauri-layout/client-server-inferred-*.png tests/__snapshots__/visual/tauri-layout/client-server-corrected-*.png
```

Expected: desktop images are `1600x900`; narrow images are `960x720`.

- [ ] **Step 5: Commit the approved baselines**

Inspect `git status --short` and ensure this task changes only the six old/new PNG paths. Commit:

```bash
git add tests/__snapshots__/visual/tauri-layout/client-server-desktop.png tests/__snapshots__/visual/tauri-layout/client-server-narrow.png tests/__snapshots__/visual/tauri-layout/client-server-inferred-desktop.png tests/__snapshots__/visual/tauri-layout/client-server-inferred-narrow.png tests/__snapshots__/visual/tauri-layout/client-server-corrected-desktop.png tests/__snapshots__/visual/tauri-layout/client-server-corrected-narrow.png
git commit -m "test: add native client-server visual baselines"
```

---

### Task 3: Slice 41 Roadmap and Release Gates

**Files:**
- Modify: `docs/src/content/docs/overview/intelligent-layout-roadmap.md`

**Interfaces:**
- Consumes: Task 1 fixture contracts and Task 2 reviewed native images.
- Produces: reconciled Client-Server baseline status, Slice 41 delivery record, and full verification evidence.

- [ ] **Step 1: Reconcile roadmap status**

Update the current regroup, P1 milestone, and Client-Server baseline checklist to state that inferred/corrected native baselines are shipped. Append:

```markdown
### Slice 41 Delivery Record

**Completed**: 2026-07-13

Delivered:

- [x] Replaced the legacy Client-Server ELK fixture with clone-isolated inferred and corrected custom-strategy fixtures.
- [x] Kept both fixtures structurally identical while correcting only the ambiguous decision module into the domain role.
- [x] Captured and visually reviewed inferred and corrected Client-Server desktop and narrow native baselines at exactly `1600x900` and `960x720`.
- [x] Protected four-tier ordering, review-to-domain correction movement, exact caller-centred external support, semantic evidence, and narrow drawer usability.
- [x] Removed the stale legacy Client-Server images and documented the paired native capture workflow.

Next slice:

- [ ] Evaluate Client-Server inference confidence and correction frequency.
- [ ] Define the evidence threshold required before exposing Client-Server role evidence to OPY/Rig.
```

- [ ] **Step 2: Run complete release gates**

Run separately and record exact outcomes:

```bash
bun run test:run
bun run lint
bun run lint:guards
bun run build
bun run knip
bun run docs:check
bun run docs:build
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
git diff --check
git status --short
```

Expected: every command exits `0`; Vitest reports zero failed files/tests; Astro and Starlight report zero diagnostics; Knip reports no unused code/dependencies; Rust tests pass; Clippy emits no warnings.

- [ ] **Step 3: Commit roadmap reconciliation**

Confirm the only remaining tracked change is the roadmap, then commit:

```bash
git add docs/src/content/docs/overview/intelligent-layout-roadmap.md
git commit -m "docs: record client-server visual baselines"
```

- [ ] **Step 4: Restore normal development state**

Stop the fixture-specific Tauri process. If a normal desktop development process was running before capture, restart `bun tauri dev` without `C4_VISUAL_FIXTURE`; otherwise leave no capture process running. Report the final branch, commit range, gate evidence, and four promoted baseline paths.
