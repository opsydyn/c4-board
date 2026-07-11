# Event-Driven Lane Geometry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace generic Dagre placement for Event-Driven diagrams with deterministic bus-centred horizontal bands and explicit cross-bus processor bridges.

**Architecture:** Add a synchronous custom `event-driven` layout strategy that consumes `inferEventDrivenRoles`, derives direct bus affinity, builds measured band/support/review anchors, and returns the exact semantic assignments that drove placement. Register the strategy and route the existing `eventDriven` preset through it without changing persistence, role inference, or edge routing.

**Tech Stack:** TypeScript, React Flow, Effect-backed semantic classification, Vitest, Bun, Astro/Starlight

## Global Constraints

- Use horizontal role order `Publishers -> Event Bus -> Processors -> Subscribers`.
- Stack bus bands vertically in lexicographic bus-ID order.
- A processor with exactly one source bus and one distinct destination bus is an explicit bridge centred between those band boundaries.
- A processor with multiple source or destination buses remains in its deterministic primary source band and emits an ambiguity warning.
- Select primary bus by highest direct edge count, then lexicographically by bus ID.
- Infrastructure and external dependencies occupy a support lane below all bands.
- Unclassified and role-classified nodes without usable bus affinity occupy a review lane.
- Preserve child-relative positions and exclude hierarchy-crossing edges through shared hierarchy diagnostics.
- Use measured dimensions, configured spacing, positive-canvas normalization, and optional grid snapping; final layouts must have zero node overlaps.
- Return the exact `ArchitectureRoleAssignment[]` used for geometry through `LayoutResult.semanticRoles`.
- A no-bus graph remains in the custom strategy and emits diagnostics; never silently fall back to Dagre.
- Do not add custom edge routing, synthetic nodes/edges, visual baselines, persistence changes, inference changes, dependencies, Client-Server geometry, or OPY/Rig behavior.

---

### Task 1: Event-Driven Geometry Strategy

**Files:**
- Create: `src/core/effects/event-driven-layout-strategy.ts`
- Create: `test/core/effects/event-driven-layout-strategy.test.ts`

**Interfaces:**
- Consumes: `inferEventDrivenRoles(nodes, edges): ArchitectureRoleClassification`, `buildHierarchyDiagnostics`, `evaluateLayoutQuality`, `getNodeDimensions`, and the existing `LayoutInput`/`LayoutResult`/`SynchronousLayoutStrategy` contracts.
- Produces: `eventDrivenLayoutStrategy: SynchronousLayoutStrategy`, `analyseEventDriven(input: LayoutInput): LayoutAnalysis`, and `layoutEventDriven(input: LayoutInput): LayoutResult`.

- [ ] **Step 1: Add the failing single-band geometry test**

Create `test/core/effects/event-driven-layout-strategy.test.ts` with helpers for measured centres and a graph whose explicit roles isolate geometry from classifier heuristics:

```ts
import { eventDrivenLayoutStrategy } from "@/core/effects/event-driven-layout-strategy";
import { getNodeDimensions } from "@/core/effects/layout-node-size";
import type { Edge, Node, XYPosition } from "@xyflow/react";
import { describe, expect, it } from "vitest";

const node = (id: string, layoutRole: string): Node => ({
  id,
  type: "component",
  position: { x: 0, y: 0 },
  style: { width: 160, height: 100 },
  data: { label: id, layoutRole },
});

const edge = (source: string, target: string, label: string): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
  label,
});

const center = (value: Node): XYPosition => {
  const dimensions = getNodeDimensions(value);
  return {
    x: value.position.x + dimensions.width / 2,
    y: value.position.y + dimensions.height / 2,
  };
};

const singleBusGraph = () => ({
  nodes: [
    node("orders", "publisher"),
    node("orders-bus", "event-bus"),
    node("fraud", "processor"),
    node("audit", "subscriber"),
    node("telemetry", "infrastructure"),
    node("unknown", "unclassified"),
  ],
  edges: [
    edge("orders", "orders-bus", "order event"),
    edge("orders-bus", "fraud", "order event"),
    edge("fraud", "audit", "audit event"),
  ],
});

describe("Event-Driven layout strategy", () => {
  it("places one event flow in semantic columns and support lanes", () => {
    const graph = singleBusGraph();
    const result = eventDrivenLayoutStrategy.layout(graph);
    const byId = new Map(result.nodes.map(value => [value.id, center(value)]));

    expect(result).toMatchObject({ strategyId: "event-driven", engine: "custom" });
    expect(byId.get("orders")!.x).toBeLessThan(byId.get("orders-bus")!.x);
    expect(byId.get("orders-bus")!.x).toBeLessThan(byId.get("fraud")!.x);
    expect(byId.get("fraud")!.x).toBeLessThan(byId.get("audit")!.x);
    expect(byId.get("telemetry")!.y).toBeGreaterThan(byId.get("orders-bus")!.y);
    expect(byId.get("unknown")!.y).toBeGreaterThan(byId.get("telemetry")!.y);
    expect(result.semanticRoles?.map(({ nodeId, role }) => ({ nodeId, role }))).toEqual([
      { nodeId: "audit", role: "subscriber" },
      { nodeId: "fraud", role: "processor" },
      { nodeId: "orders", role: "publisher" },
      { nodeId: "orders-bus", role: "event-bus" },
      { nodeId: "telemetry", role: "infrastructure" },
      { nodeId: "unknown", role: "unclassified" },
    ]);
    expect(result.quality.nodeOverlapCount).toBe(0);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
bunx vitest run test/core/effects/event-driven-layout-strategy.test.ts
```

Expected: FAIL because `event-driven-layout-strategy.ts` does not exist.

- [ ] **Step 3: Implement the minimum measured single-band strategy**

Create `src/core/effects/event-driven-layout-strategy.ts` with:

```ts
const EVENT_DRIVEN_STRATEGY_ID = "event-driven";
const MARGIN = 40;

const DEFAULT_EVENT_DRIVEN_OPTIONS: LayoutOptions = {
  direction: "LR",
  nodeSpacing: 120,
  rankSpacing: 200,
  edgeSpacing: 20,
  snapToGrid: true,
  gridSize: 20,
  strategyId: EVENT_DRIVEN_STRATEGY_ID,
};

export const eventDrivenLayoutStrategy: SynchronousLayoutStrategy = {
  id: EVENT_DRIVEN_STRATEGY_ID,
  engine: "custom",
  analyse: analyseEventDriven,
  layout: layoutEventDriven,
};
```

Implement `layoutEventDriven` using these internal units:

```ts
interface BusAffinity {
  sourceBusIds: string[];
  destinationBusIds: string[];
  primarySourceBusId: string | null;
  primaryDestinationBusId: string | null;
}

interface PlacementPlan {
  bands: string[];
  affinityByNodeId: Map<string, BusAffinity>;
  supportNodeIds: string[];
  reviewNodeIds: string[];
  bridgeNodeIds: string[];
}
```

Build a role map from classification assignments. Filter direct edges whose endpoints are top-level. For each node, count incoming edges from classified buses and outgoing edges to classified buses. Rank each candidate bus by descending count and ascending bus ID. Use source affinity for processors/subscribers, destination affinity for publishers/processors.

Sort top-level nodes, child nodes, included edges, and excluded edges by ID before classification, placement, and hierarchy diagnostic construction so reversed inputs produce byte-for-byte equal diagnostics as well as equal positions.

For one bus, compute four column centres from maximum measured width:

```ts
const columnStep = maxWidth + options.nodeSpacing + options.rankSpacing;
const columnX = {
  publisher: 0,
  "event-bus": columnStep,
  processor: columnStep * 2,
  subscriber: columnStep * 3,
};
```

Compute band height as `maxHeight + options.nodeSpacing * 2`; stack role peers around the band centre using each peer's measured height plus `nodeSpacing`. Put support at `lastBandY + bandHeight + rankSpacing`, review below support by `maxHeight + nodeSpacing + rankSpacing`. Normalize all top-level positions by minimum x/y plus `MARGIN`, snap when configured, append unchanged child nodes, and call `evaluateLayoutQuality`.

Return classification diagnostics, hierarchy diagnostics, an `event-driven-role-summary`, and `semanticRoles: classification.assignments`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
bunx vitest run test/core/effects/event-driven-layout-strategy.test.ts
```

Expected: 1 test PASS with zero overlaps.

- [ ] **Step 5: Add failing multi-band bridge and ambiguity tests**

Add a two-bus graph with explicit roles and direct bus relationships:

```ts
it("stacks bus bands and bridges a one-source one-destination processor", () => {
  const nodes = [
    node("orders", "publisher"),
    node("orders-bus", "event-bus"),
    node("fraud", "processor"),
    node("risk-bus", "event-bus"),
    node("review", "subscriber"),
  ];
  const edges = [
    edge("orders", "orders-bus", "order event"),
    edge("orders-bus", "fraud", "order event"),
    edge("fraud", "risk-bus", "risk event"),
    edge("risk-bus", "review", "risk event"),
  ];
  const result = eventDrivenLayoutStrategy.layout({ nodes, edges });
  const byId = new Map(result.nodes.map(value => [value.id, center(value)]));

  expect(byId.get("orders-bus")!.y).toBeLessThan(byId.get("risk-bus")!.y);
  expect(byId.get("fraud")!.y).toBeGreaterThan(byId.get("orders-bus")!.y);
  expect(byId.get("fraud")!.y).toBeLessThan(byId.get("risk-bus")!.y);
  expect(result.diagnostics.map(({ code }) => code)).toContain("event-driven-multiple-bands");
  expect(result.quality.nodeOverlapCount).toBe(0);
});

it("keeps an ambiguous processor in its primary source band", () => {
  const graph = singleBusGraph();
  graph.nodes.push(node("secondary-bus", "event-bus"));
  graph.edges.push(
    edge("secondary-bus", "fraud", "secondary event"),
    edge("fraud", "secondary-bus", "continued event"),
  );
  const result = eventDrivenLayoutStrategy.layout(graph);

  expect(result.diagnostics.find(({ code }) => code === "event-driven-ambiguous-processor"))
    .toMatchObject({ severity: "warning", nodeIds: ["fraud"] });
  expect(result.quality.nodeOverlapCount).toBe(0);
});
```

- [ ] **Step 6: Run focused tests and verify RED**

Run the focused test command. Expected: bridge y-position or ambiguity diagnostic assertions FAIL because multi-band planning is incomplete.

- [ ] **Step 7: Implement multi-band affinity, bridge placement, and diagnostics**

Implement these exact rules:

- `bands`: all event-bus node IDs sorted lexicographically.
- `primarySourceBusId` and `primaryDestinationBusId`: highest direct edge count, then lexical ID.
- Bridge eligibility: processor has exactly one source bus, exactly one destination bus, and the IDs differ.
- Bridge centre y: midpoint between the source and destination band centres. Reserve a vertical bridge corridor by setting band step to at least `maxBandContentHeight + maxProcessorHeight + options.nodeSpacing * 2`.
- Ambiguous processor: more than one source or destination bus; place in primary source band and emit `event-driven-ambiguous-processor` with sorted node IDs.
- Emit `event-driven-multiple-bands` when `bands.length > 1`.
- Emit `event-driven-orphan-role` for flow roles with no usable bus affinity and place them in review.
- Emit `event-driven-no-bus` when `bands.length === 0`; place all flow roles in review without falling back.

- [ ] **Step 8: Add failing determinism, hierarchy, overlap, and analysis tests**

Add tests that:

```ts
const positions = (nodes: Node[]) => Object.fromEntries(
  [...nodes].sort((a, b) => a.id.localeCompare(b.id)).map(value => [value.id, value.position]),
);

expect(positions(reversed.nodes)).toEqual(positions(forward.nodes));
expect(reversed.diagnostics).toEqual(forward.diagnostics);
```

Also add a child node at `{ x: 25, y: 35 }`, a hierarchy-crossing edge, mixed node dimensions, and assertions for unchanged child position, `event-driven-hierarchy-edges-excluded`, positive top-level coordinates, grid multiples, and zero overlaps. Add an `analyse` assertion that a confident graph with a bus scores higher than the same graph without a bus.

- [ ] **Step 9: Run focused tests, fix only demonstrated failures, and refactor**

Run:

```bash
bunx vitest run test/core/effects/event-driven-layout-strategy.test.ts
```

Expected: all strategy tests PASS. Refactor only duplicated stable sorting, peer stacking, affinity selection, normalization, and result construction inside the new strategy file. Keep every helper private.

- [ ] **Step 10: Commit Task 1**

Run `git diff --check`, then commit:

```bash
git add src/core/effects/event-driven-layout-strategy.ts test/core/effects/event-driven-layout-strategy.test.ts
git commit -m "feat: add event-driven lane geometry"
```

---

### Task 2: Preset Routing, Registry Integration, and Roadmap

**Files:**
- Modify: `src/core/effects/layout-strategy-registry.ts`
- Modify: `src/core/effects/layout.ts`
- Modify: `test/core/effects/event-driven-layout-strategy.test.ts`
- Modify: `docs/src/content/docs/overview/intelligent-layout-roadmap.md`

**Interfaces:**
- Consumes: `eventDrivenLayoutStrategy` from Task 1 and `resolveSynchronousLayoutStrategy`.
- Produces: `getPreset("eventDriven").strategyId === "event-driven"` and `calculateLayout(..., getPreset("eventDriven"))` returning the custom strategy result.

- [ ] **Step 1: Add the failing preset-routing test**

Extend the strategy test:

```ts
import { dagreLayoutStrategy } from "@/core/effects/dagre-layout-strategy";
import { calculateLayout, getPreset } from "@/core/effects/layout";

it("routes the Event-Driven preset to custom semantic geometry", () => {
  const graph = singleBusGraph();
  const options = getPreset("eventDriven");
  const result = calculateLayout(graph.nodes, graph.edges, options);
  const baseline = dagreLayoutStrategy.layout({ ...graph, options });

  expect(options.strategyId).toBe("event-driven");
  expect(result).toMatchObject({ strategyId: "event-driven", engine: "custom" });
  expect(result.nodes.map(({ position }) => position)).not.toEqual(
    baseline.nodes.map(({ position }) => position),
  );
  expect(result.diagnostics.map(({ code }) => code)).not.toContain("layout-strategy-fallback");
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run the focused strategy test. Expected: FAIL because the preset has no custom strategy ID and the registry does not contain `event-driven`.

- [ ] **Step 3: Register and route the strategy**

In `src/core/effects/layout-strategy-registry.ts`, import `eventDrivenLayoutStrategy` and add:

```ts
[eventDrivenLayoutStrategy.id, eventDrivenLayoutStrategy],
```

to `synchronousStrategies`.

In `src/core/effects/layout.ts`, change only the Event-Driven preset:

```ts
eventDriven: {
  strategyId: "event-driven",
  direction: "LR" as const,
  rankSpacing: 200,
  nodeSpacing: 120,
},
```

- [ ] **Step 4: Run focused and full verification**

Run each separately:

```bash
bunx vitest run test/core/effects/event-driven-layout-strategy.test.ts
bun run test:run
bun run lint
bun run build
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: focused tests PASS; all Vitest files PASS; ESLint exits `0`; Astro check reports `0 errors`, `0 warnings`, and `0 hints`; Astro build completes; Cargo check exits `0`.

- [ ] **Step 5: Record Slice 38 in the roadmap**

In `docs/src/content/docs/overview/intelligent-layout-roadmap.md`:

- Mark Event-Driven publisher/bus/processor/subscriber lanes complete in Phase 4 and Slice 37's next-slice list.
- Add `### Slice 38 Delivery Record` dated `2026-07-11`.
- Record the custom strategy, bus-centred bands, explicit bridges, deterministic primary affinity, support/review lanes, diagnostics, semantic assignment propagation, hierarchy preservation, zero-overlap and determinism tests, and preset routing.
- Set the next slice to native Event-Driven desktop/narrow visual baselines, followed by Client-Server semantic inference and columns.

Run `bun run build` from `docs/` and expect Starlight and Pagefind completion.

- [ ] **Step 6: Review and commit Task 2**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Confirm only the four Task 2 files changed, then commit:

```bash
git add src/core/effects/layout-strategy-registry.ts src/core/effects/layout.ts test/core/effects/event-driven-layout-strategy.test.ts docs/src/content/docs/overview/intelligent-layout-roadmap.md
git commit -m "feat: route event-driven semantic layout"
```
