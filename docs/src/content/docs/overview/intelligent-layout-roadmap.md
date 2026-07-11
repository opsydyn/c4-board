---
title: "Roadmap: Intelligent Architecture Layouts"
description: "Concrete roadmap for architecture-aware layout strategies using Dagre, ELK, OPY/Rig classification, and governed custom layouts."
---

# Roadmap: Intelligent Architecture Layouts

**Last Updated**: 2026-07-11

**Owner**: Product + Platform Engineering

**Scope Horizon**: 2026-Q3 to 2027-Q1
**Strategic Theme**: Architecture-aware layouts that express system meaning instead of merely arranging graph nodes.

## 1) Product Thesis

Layout should become part of c4-board's architecture intelligence, not a cosmetic post-processing step.

Today, layout preset names describe architectural patterns, but every preset is implemented through the same Dagre hierarchical solver with different direction and spacing values. As a result, System Context, Hub-Spoke, Hexagonal, Event-Driven, and Microservices layouts remain visually and structurally similar.

The target product loop is:

```text
board semantics -> pattern classification -> layout strategy -> quality evaluation
                -> user correction -> saved layout knowledge -> better future proposals
```

The product advantage is the combination of:

1. **Architecture semantics**: C4 and DDD roles, parent boundaries, relationship direction, ownership, and technology metadata influence placement.
2. **Purpose-built geometry**: hierarchical, radial, layered, lane-based, clustered, and constrained layouts are distinct strategies.
3. **Agentic classification**: OPY uses Rig to classify ambiguous architecture roles and recommend suitable layout strategies with evidence and confidence.
4. **Governed customization**: users and OPY can create, preview, validate, save, version, and reuse custom layout specifications without executing arbitrary generated code.
5. **Measurable quality**: overlap, crossings, semantic violations, stability, aspect ratio, and readability are evaluated before a layout is accepted.

## 2) Current Baseline

The shipped implementation now provides an architecture-grade deterministic foundation:

- A strategy registry routes hierarchical presets to Dagre, product radial patterns to custom geometry, and advanced compound layout to ELK Layered.
- Whole-board and selected-subgraph Dagre workflows remain available.
- Hub-Spoke and System Context have dedicated multi-ring geometry, center inference, overrides, role sectors, and diagnostics.
- ELK runs in a cancellable Vite-managed worker and returns compound bounds, orthogonal routes, fixed-side ports, stable multi-port assignments, and congestion evidence.
- Every layout enters a non-destructive preview with quality comparison, recommendations, exact Apply semantics, and last-valid fallback.
- Accepted layouts have diagram-owned audit history, retention, confirmed deletion, and schema-validated review-artifact export.
- Layout mutations still flow through the existing undo, checkpoint, persistence, and OPY proposal boundaries.

Known limitations:

- Several legacy menu presets still differ only by Dagre spacing and direction.
- Hexagonal now has shared semantic-role classification, review and correction UX, and dedicated geometry; Event-Driven has deterministic role inference but still needs lane geometry, while Client-Server still needs pattern-specific inference and geometry.
- Dagre ranking, alignment, cycle-breaking, main-path, and semantic-layer controls remain basic.
- ELK Radial has not justified replacing the product-specific radial strategies.
- Native visual baselines cover dense ELK Event-Driven and Client-Server fixtures plus inferred and corrected Hexagonal previews; radial and full preset coverage remain open.
- Browser-worker startup and enforced large-board interaction budgets remain incomplete.
- OPY can apply known layouts, but cannot yet classify architecture patterns, correct semantic roles, or author reusable `LayoutSpec` definitions.

## 3) Target Architecture

### 3.1 Layout Pipeline

```text
React Flow board
  -> graph normalization
  -> deterministic feature extraction
  -> OPY/Rig semantic classification when needed
  -> strategy selection and constraint compilation
  -> Dagre, ELK, or custom geometry
  -> collision, containment, and edge-routing passes
  -> quality scoring and diagnostics
  -> preview, approval, and persistence
```

Each stage must have a typed input and output so classification, geometry, quality, and persistence can be tested independently.

### 3.2 Strategy Contract

Introduce a layout strategy boundary rather than expanding the current options object indefinitely:

```ts
interface LayoutStrategy {
  readonly id: string;
  readonly engine: "dagre" | "elk" | "custom";
  readonly supportedPatterns: ReadonlyArray<ArchitecturePattern>;
  analyse(graph: ArchitectureGraph): LayoutAnalysis;
  layout(
    graph: ArchitectureGraph,
    constraints: LayoutConstraints,
  ): Promise<LayoutResult>;
}
```

`LayoutResult` should include:

- Node positions and dimensions.
- Compound-node bounds.
- Edge routes and port assignments where supported.
- Applied strategy and engine versions.
- Quality metrics and warnings.
- Classification evidence and confidence.
- A deterministic input hash and random seed, where applicable.

### 3.3 Engine Responsibilities

| Engine | Primary responsibility |
| --- | --- |
| Dagre | Directed hierarchies, pipelines, dependency trees, and simple layered flows |
| ELK Layered | Compound graphs, explicit ports, orthogonal routing, constraints, and architecture layers |
| ELK Radial | System Context and tree-like radial arrangements |
| ELK Stress/Force | Microservice meshes and relationship-driven exploration |
| Custom deterministic geometry | Hub-Spoke, Hexagonal/Ports and Adapters, fixed lanes, and product-specific layout grammar |

Dagre remains a supported engine. ELK expands the layout vocabulary rather than replacing Dagre indiscriminately.

### 3.4 Execution Boundary

ELK layout should run behind an asynchronous adapter, preferably in a Web Worker, because larger compound layouts can block the canvas. The adapter must support cancellation, time budgets, deterministic seeds, and fallback to the last valid layout.

Layout computation must never mutate the board directly. It produces a preview result that enters the existing proposal, checkpoint, and undo boundaries.

## 4) Architecture Classification with OPY and Rig

### 4.1 Deterministic Features First

Before invoking a model, extract inexpensive graph features:

- Node and edge counts.
- In-degree, out-degree, and centrality candidates.
- Sources, sinks, cycles, connected components, and longest directed paths.
- Parent-child depth and compound boundaries.
- C4 and DDD node types.
- Edge direction, label, technology, and relationship metadata.
- Ownership and Azure provenance where available.
- Existing positions, pinned nodes, and selection scope.

These features should resolve obvious cases without model cost. For example, a single high-centrality node with many degree-one neighbours is a strong Hub-Spoke candidate.

### 4.2 Rig Classification Contract

Rig should expose a structured classification call with schema-validated output:

```ts
interface LayoutClassification {
  pattern:
    | "hierarchy"
    | "data-flow"
    | "layered"
    | "system-context"
    | "hub-spoke"
    | "hexagonal"
    | "event-driven"
    | "client-server"
    | "microservices"
    | "dependency-tree"
    | "mixed"
    | "unknown";
  confidence: number;
  roles: ReadonlyArray<{
    nodeId: string;
    role: string;
    confidence: number;
    evidence: ReadonlyArray<string>;
  }>;
  recommendedStrategy: string;
  alternatives: ReadonlyArray<string>;
  ambiguities: ReadonlyArray<string>;
}
```

Rig may classify semantics, but it must not emit pixel coordinates. The deterministic layout layer owns geometry.

### 4.3 Classification Policy

1. Use deterministic classification when confidence exceeds the configured threshold.
2. Invoke OPY/Rig only when semantic roles or pattern selection remain ambiguous.
3. Ground prompts in board IDs and normalized metadata, not screenshots alone.
4. Validate all model output against Effect Schema and known node IDs.
5. Treat invented nodes, roles, or edges as invalid output.
6. Show the operator classification confidence, evidence, and alternatives before a materially different layout is applied.
7. Persist accepted corrections as board-scoped layout knowledge.

### 4.4 OPY User Experience

OPY should support prompts such as:

- "Lay this out as ports and adapters."
- "Make the payment service the hub and keep observability outside the main ring."
- "Separate publishers, brokers, processors, and subscribers."
- "Preserve the current left-to-right flow but reduce crossings."

OPY responds with:

1. Detected pattern and assumptions.
2. Assigned semantic roles with ambiguous assignments highlighted.
3. Recommended strategy plus one or two alternatives.
4. A layout preview and quality comparison against the current board.
5. An explicit apply, revise, or save-as-custom-layout action.

## 5) First-Class Layout Strategies

### Hierarchical Family

Improve Command, Data Flow, Pipeline, Dependency Tree, and Layered presets with Dagre and ELK Layered options:

- Ranker and cycle-breaking selection.
- Edge weight and minimum-rank separation.
- Main-path detection and prioritization.
- Semantic layer constraints.
- Stable ordering based on the previous layout.
- Orthogonal ports and routes where ELK is used.

### System Context

- Identify or ask for the system of interest.
- Place it centrally.
- Group people, external systems, and internal systems into readable sectors.
- Use concentric rings only when relationship distance justifies them.
- Keep labels upright and prevent radial node overlap.

### Hub-Spoke

- Infer or explicitly select the hub.
- Place satellites on one or more rings based on node dimensions.
- Group satellites by role, ownership, or edge direction.
- Reserve angular sectors for inbound and outbound relationships.
- Support secondary local hubs without collapsing into a generic force layout.

### Hexagonal / Ports and Adapters

- Place domain and application core elements centrally.
- Place ports on the core boundary.
- Place inbound adapters in one sector and outbound adapters in another.
- Place infrastructure dependencies outside the adapter ring.
- Validate dependency direction and flag architecture violations separately from geometry.

### Event-Driven

- Create lanes for publishers, brokers/buses, processors, and subscribers.
- Use edge metadata to distinguish commands, events, and subscriptions.
- Support multiple buses and bounded-context groupings.
- Minimize backtracking and crossings between lanes.

### Client-Server

- Use explicit client, service/API, domain, and persistence columns.
- Group repeated clients and data stores.
- Keep request and response paths legible without duplicating nodes.

### Microservices

- Group services by bounded context, ownership, or deployment boundary.
- Pin gateways and ingress near graph boundaries.
- Use ELK Stress/Force for exploratory mesh views.
- Provide a deterministic layered alternative for review and export.
- Never present a force layout as the only stable saved representation.

## 6) Custom Layouts Created with OPY

### 6.1 Goal

OPY should eventually let a user describe a reusable architecture layout in natural language, preview it on the current board, refine it through conversation, and save it for future boards.

Examples:

- "Put customer-facing systems across the top, platform services in the middle, and data stores at the bottom. Group each product team together."
- "Use a hub-spoke layout, but pin identity and observability to a shared platform sector."
- "Save this arrangement as our standard event platform view."

### 6.2 Layout Specification, Not Generated Code

OPY must create a declarative, versioned `LayoutSpec`. It must not generate or execute JavaScript, Rust, ELK expressions, or arbitrary selectors.

```ts
interface LayoutSpec {
  id: string;
  version: number;
  name: string;
  description?: string;
  scope: "diagram" | "workspace" | "organization";
  baseStrategy: string;
  selectors: ReadonlyArray<LayoutSelector>;
  groups: ReadonlyArray<LayoutGroup>;
  constraints: ReadonlyArray<LayoutConstraint>;
  ordering: ReadonlyArray<LayoutOrderingRule>;
  routing: LayoutRoutingPolicy;
  fallbackStrategy: string;
  provenance: LayoutProvenance;
}
```

The first grammar should support a deliberately small set of safe operations:

- Select by C4/DDD type, ownership, tags, technology, Azure type, explicit node ID, or graph-derived role.
- Group into lanes, layers, rings, sectors, clusters, or containers.
- Constrain before/after, above/below, left/right, inside/outside, same-rank, near, and pinned.
- Define ordering keys and spacing tokens.
- Choose supported edge-routing and port policies.
- Define a known fallback strategy when constraints are unsatisfiable.

### 6.3 Authoring Workflow

1. User describes the desired layout.
2. OPY classifies the board and drafts a `LayoutSpec` through a Rig tool.
3. Effect Schema validates the specification.
4. The constraint compiler checks selectors, contradictions, cycles, and unsupported combinations.
5. The layout runs in preview mode against a cloned board state.
6. Quality metrics compare current, generated, and fallback layouts.
7. OPY explains unresolved nodes and violated soft constraints.
8. User revises, applies once, or saves the specification.
9. Saving creates a versioned artifact with provenance and compatibility metadata.

### 6.4 Persistence and Lifecycle

Persist custom layouts independently from diagram coordinates:

- Stable ID, name, description, and scope.
- Immutable versions with created/updated timestamps.
- Author type: user, OPY-assisted, imported, or built-in.
- Original natural-language intent and approved generated specification.
- Required engine and specification schema versions.
- Example board hash and last successful evaluation.
- Quality baseline and known warnings.
- Usage count, last used time, and deprecation status.

Coordinates remain diagram state. A saved custom layout remains a reusable rule set that can be re-applied as the architecture changes.

### 6.5 Governance and Safety

- OPY-created layouts always begin as drafts.
- Saving and organization-wide publication require explicit confirmation.
- Applying a layout creates an undo checkpoint.
- Unknown selectors and missing nodes produce diagnostics, not silent omission.
- Hard constraint conflicts block apply; soft conflicts produce warnings.
- Specifications have complexity, node-count, and execution-time limits.
- Imported layouts are schema validated and never contain executable code.
- Organization layouts support ownership, review status, deprecation, and audit history.

### 6.6 Future Layout Memory

Accepted role corrections and custom layout choices can form layout memory:

- "Payments API is an inbound adapter on this board."
- "Platform-owned services belong in the shared-services lane."
- "Use Standard Event Platform v3 for diagrams tagged `eventing`."

This memory should remain OPY-owned durable product data. Rig may consume relevant records as model context, but Rig conversation memory must not become the source of truth for saved layouts or approvals.

## 7) Layout Quality and Evaluation

Every strategy needs representative fixtures and measurable outcomes.

Core metrics:

- Node overlap count and overlap area.
- Edge crossing count.
- Total and maximum edge length.
- Number of backward or semantically reversed edges.
- Compound containment violations.
- Port and lane violations.
- Ring or sector assignment violations.
- Canvas aspect ratio and occupied area.
- Displacement from the previous layout.
- Pinned-node displacement.
- Hard and soft constraint satisfaction.
- Computation duration and timeout rate.

Test layers:

1. Unit tests for feature extraction, classification validation, constraint compilation, and metrics.
2. Golden graph fixtures for every built-in strategy.
3. Property tests for overlap and containment invariants.
4. Visual regression screenshots at desktop and compact canvas sizes.
5. Performance fixtures for 25, 100, 250, and 500-node boards.
6. Rig eval fixtures for pattern and role classification.
7. Replay tests proving saved `LayoutSpec` versions remain deterministic or migrate explicitly.

## 8) Sequenced Delivery Plan

### Phase 0: Baseline and Contracts

**Goal**: make layout quality visible before changing output.

- [ ] Add representative C4 and DDD graph fixtures for every current preset.
- [x] Add overlap, crossing, edge-length, aspect-ratio, and displacement metrics.
- [x] Capture representative Dagre output as explicit baseline fixtures.
- [x] Define `ArchitectureGraph`, `LayoutStrategy`, `LayoutResult`, and diagnostic contracts.
- [x] Add stable node ordering and deterministic tie-breaking for shipped strategies.
- [ ] Add deterministic seeds when stochastic engines are introduced.
- [x] Define and implement preview cancellation behavior.
- [ ] Define and enforce browser-worker performance budgets.

Exit criteria:

1. Every current preset has a repeatable fixture and quality report.
2. Existing Dagre behavior can be preserved through the new strategy contract.
3. Layout regressions are visible in tests before UI review.

### Phase 1: Strategy Runtime and Dagre Improvements

**Goal**: separate strategy identity from engine parameters without destabilizing the canvas.

- [x] Introduce the strategy registry and Dagre adapter.
- [x] Preserve whole-board and selected-subgraph workflows.
- [ ] Add Dagre ranker, alignment, acyclicer, edge weight, and minimum-rank options.
- [ ] Add main-path and semantic-layer preprocessing.
- [x] Add a preview result instead of directly replacing positions.
- [x] Preserve undo, checkpoint, and OPY proposal behavior.

Exit criteria:

1. Hierarchical presets are measurably distinct and remain deterministic.
2. Existing layout commands continue to work through the strategy registry.
3. A failed layout leaves the board unchanged.

### Phase 2: True Hub-Spoke and System Context

**Goal**: ship the first unmistakably different architecture-aware layouts.

- [x] Implement deterministic hub detection with manual override.
- [x] Implement multi-ring radial geometry and collision resolution.
- [x] Add stable role sectors for people, internal elements, external systems, and other nodes; ownership refinement remains future work.
- [x] Implement System Context system-of-interest selection.
- [x] Add radial preview diagnostics; automated visual regression coverage remains open.
- [ ] Replace misleading menu descriptions with strategy-specific status.

Exit criteria:

1. Hub-Spoke produces a central hub and readable satellite rings.
2. System Context produces a system-of-interest view with grouped externals.
3. Neither strategy falls back to top-to-bottom Dagre without explaining why.

### Phase 3: ELK Foundation

**Goal**: support compound, port-aware, constrained, and asynchronous layout.

- [x] Add `elkjs` as a direct dependency.
- [x] Implement the ELK worker adapter with timeout and cancellation.
- [x] Map React Flow hierarchy, dimensions, ports, and edges into ELK JSON.
- [x] Return compound bounds and edge routes through `LayoutResult`.
- [x] Add the ELK Layered strategy adapter.
- [ ] Add ELK Radial only if evidence shows an advantage over product radial geometry.
- [x] Record bundle isolation and initial 25-500 node engine benchmarks.
- [ ] Enforce browser-worker startup and execution budgets on realistic fixtures.
- [x] Add fallback behavior for worker or engine failure.

Exit criteria:

1. Compound nodes and hierarchy-crossing edges participate in layout.
2. ELK computation does not block canvas interaction.
3. Engine failures are cancellable, diagnosable, and non-destructive.

### Phase 4: Hexagonal, Event-Driven, and Client-Server

**Goal**: make architecture pattern semantics visible in geometry.

- [x] Implement the shared Phase 4 role schema and initial ports-and-adapters inference.
- [x] Add Hexagonal core, port, adapter, and infrastructure placement.
- [x] Add Event-Driven publisher, bus, processor, and subscriber inference.
- [ ] Add deterministic Event-Driven publisher, bus, processor, and subscriber lane geometry.
- [ ] Add Client-Server client, service, domain, and persistence columns.
- [x] Add role correction controls in the layout preview.
- [ ] Add semantic violation diagnostics independent from layout quality.

Exit criteria:

1. Each strategy has visually distinct, semantically meaningful output.
2. Users can correct ambiguous role assignments before apply.
3. Unsupported or contradictory boards receive useful diagnostics.

### Phase 5: OPY/Rig Classification

**Goal**: recommend and configure layouts from architecture intent.

- [ ] Implement deterministic graph feature extraction and pattern scoring.
- [ ] Add the schema-validated Rig layout classifier.
- [ ] Add OPY read tools for graph features and current layout diagnostics.
- [ ] Add proposal tools for pattern, role assignment, and strategy selection.
- [ ] Show evidence, confidence, ambiguities, and alternatives in the OPY drawer.
- [ ] Build classification eval fixtures and confidence thresholds.
- [ ] Persist accepted role corrections as OPY layout knowledge.

Exit criteria:

1. Obvious patterns are selected without a model call.
2. Rig classification never directly generates coordinates or mutates the board.
3. Classification output is grounded in valid board IDs and schema validated.
4. Low-confidence classification requires review before preview/apply.

### Phase 6: Microservices and Mixed Architectures

**Goal**: handle dense real-world systems without pretending they fit one pattern.

- [ ] Add bounded-context and ownership clustering.
- [ ] Add ELK Stress/Force exploration with deterministic seeds.
- [ ] Add stable layered export for the same graph.
- [ ] Support nested strategies inside compound boundaries.
- [ ] Add mixed-pattern classification and per-region strategy selection.
- [ ] Add large-board progressive preview and cancellation.

Exit criteria:

1. Dense service graphs remain explorable and exportable.
2. Mixed boards can use different strategies in explicit bounded regions.
3. Re-layout preserves pinned nodes and minimizes unnecessary movement.

### Phase 7: OPY Custom Layout Studio

**Goal**: let users create reusable layout knowledge through conversation.

- [ ] Define `LayoutSpec` v1 and its Effect Schema.
- [ ] Implement safe selectors, groups, constraints, ordering, routing, and fallbacks.
- [ ] Build the constraint compiler and conflict diagnostics.
- [ ] Add Rig tools to draft and revise `LayoutSpec` artifacts.
- [ ] Add current/generated/fallback comparison previews.
- [ ] Persist diagram- and workspace-scoped custom layouts.
- [ ] Add version history, duplicate, rename, deprecate, export, and import.
- [ ] Add explicit publication flow for organization-scoped layouts.
- [ ] Add usage telemetry and quality baselines without storing board secrets.

Exit criteria:

1. A user can describe, preview, refine, save, and reapply a custom layout.
2. No custom layout contains executable code.
3. Saved specifications are versioned, auditable, portable, and migration-aware.
4. OPY can explain every generated rule and unresolved node.

## 9) Milestone Priorities

| Priority | Milestone | Status | Product impact | Dependency |
| --- | --- | --- | --- | --- |
| P0 | Metrics, fixtures, and strategy contract | Foundation shipped; full preset coverage open | Makes future layout work safe and measurable | None |
| P0 | True Hub-Spoke and System Context | Shipped | Immediate visible differentiation | Strategy contract |
| P0 | ELK worker and compound graph support | Shipped; browser budgets open | Unlocks architecture-grade constraints and routing | Strategy contract |
| P1 | Hexagonal and Event-Driven | Next | Strong semantic differentiation | Shared semantic role schema |
| P1 | OPY/Rig classifier | Queued | Natural-language strategy and role selection | Stable role and strategy schemas |
| P1 | Client-Server and improved hierarchical family | Queued | Completes common architecture patterns | Shared semantic role schema |
| P2 | Microservices and mixed strategies | Future | Handles dense enterprise boards | ELK and classification |
| P2 | OPY Custom Layout Studio | Future | Turns user intent into reusable product knowledge | Constraint grammar and persistence |

## 10) Product and UX Principles

1. Layout is always previewable and reversible.
2. A preset name must correspond to genuinely distinct geometry and semantics.
3. OPY explains classification; deterministic engines compute coordinates.
4. Existing user placement is evidence, not disposable input.
5. Pinned nodes and explicit user corrections take precedence over inferred preferences.
6. Hard constraints fail visibly; soft constraints degrade with diagnostics.
7. The system should recommend alternatives when one strategy is unsuitable.
8. Saved layouts are reusable rules, not frozen coordinate snapshots.
9. Advanced controls belong in a focused layout drawer, while one-click presets remain fast.
10. Quality comparisons should be understandable without exposing algorithm internals by default.

## 11) Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| ELK increases bundle or startup cost | Lazy-load the worker, benchmark early, and keep Dagre for simple cases |
| Force layouts move unpredictably | Use deterministic seeds and provide a stable layered export alternative |
| Rig invents architectural roles | Validate node IDs, restrict role vocabulary, show evidence, and require review at low confidence |
| Custom constraints become a programming language | Keep `LayoutSpec` declarative, bounded, schema validated, and intentionally small |
| Re-layout destroys the user's mental map | Measure displacement, preserve stable order, and honor pinned nodes |
| Pattern labels overpromise again | Tie every built-in preset to strategy fixtures and acceptance criteria |
| Large boards block interaction | Run async, support cancellation, enforce budgets, and provide progressive preview |
| Saved layouts become incompatible | Version engines and schemas; migrate explicitly and retain the last valid result |

## 12) Success Measures

Product measures:

- Layout apply versus undo/revert rate.
- Percentage of OPY recommendations accepted without role correction.
- Custom layouts created, reused, and shared.
- Time from imported/generated graph to accepted readable layout.
- Percentage of boards using a semantic strategy instead of generic Dagre.

Quality measures:

- Zero node overlaps for supported fixture sizes.
- Fewer crossings than the current baseline on hierarchical fixtures.
- Zero hard constraint violations on applied layouts.
- Stable repeated output for unchanged inputs.
- Bounded displacement when incrementally adding nodes.
- Classification accuracy and calibration across the Rig eval set.
- Layout completion within the agreed interaction budget for 95% of supported boards.

## 13) Current Regroup

The foundation through Phase 3 is substantially shipped: strategy boundaries, quality metrics, radial strategies, asynchronous ELK Layered, routed preview, recommendations, audit history, and portable review evidence are in production code.

The next product workstream is **Phase 4 semantic architecture layouts**, sequenced as follows:

1. Define one schema-validated semantic role contract shared by Hexagonal, Event-Driven, and Client-Server.
2. Add deterministic role inference with evidence, confidence, ambiguity, and contradiction diagnostics.
3. Implement Hexagonal core, port, adapter, and infrastructure geometry as the first consumer.
4. Add role correction controls to the non-destructive preview and persist accepted corrections.
5. Reuse the same contract for Event-Driven lanes and Client-Server columns.
6. Expose stable role evidence to OPY/Rig only after deterministic inference and correction UX are evaluated.

Open foundation debt remains visible but does not block the Phase 4 role-contract slice:

- Remaining C4 and DDD preset fixtures and radial visual baselines.
- Browser-worker startup and realistic performance budgets.
- Advanced Dagre controls and semantic preprocessing.
- Strategy-specific menu status.
- Native baseline refresh when macOS capture is available.

The next implementation slice should stop export-history polish and begin the shared semantic role schema plus deterministic Hexagonal inference fixtures.

### Slice 1 Delivery Record

**Completed**: 2026-07-10

Delivered:

- [x] Added hierarchy, pipeline, system-context, hub-spoke, hexagonal, and event-driven graph fixtures.
- [x] Added overlap count/area, straight-line crossing, edge-length, bounds, aspect-ratio, occupied-area, and displacement metrics.
- [x] Captured deterministic Dagre position and quality snapshots for the six initial fixtures.
- [x] Introduced typed `LayoutStrategy`, `LayoutInput`, `LayoutResult`, diagnostics, engine, analysis, and quality contracts.
- [x] Extracted the current Dagre implementation into a compatibility strategy and preserved the public `autoLayout` API.
- [x] Added diagnostics for preserved child positions and hierarchy-crossing edges excluded by Dagre.
- [x] Verified canvas-machine and OPY layout mutation compatibility through the full test suite.

Deferred to the next slices:

- [ ] Add fixtures for the remaining C4 and DDD presets.
- [ ] Add browser-rendered visual regression screenshots.
- [ ] Define and enforce performance budgets for larger boards.
- [x] Add the synchronous strategy registry and consume `LayoutResult` diagnostics in the preview UX.
- [ ] Add configurable Dagre ranking, alignment, cycle-breaking, and edge priorities.
- [x] Implement the first distinct Hub-Spoke strategy.

### Slice 2 Delivery Record

**Completed**: 2026-07-11

Delivered:

- [x] Added a synchronous strategy registry with explicit Dagre fallback diagnostics.
- [x] Routed the built-in Hub-Spoke preset to a custom strategy instead of Dagre spacing options.
- [x] Added deterministic hub inference using unique-neighbour degree, edge-count ranking, and stable ID tie-breaking.
- [x] Added explicit hub override and invalid-override recovery diagnostics.
- [x] Ordered satellites by inbound, bidirectional, outbound, and disconnected relationship sectors.
- [x] Added dimension-aware ring capacity, multi-ring packing, grid snapping, and collision-free spacing.
- [x] Added diagnostics for weak hubs, disconnected satellites, secondary relationships, preserved children, and excluded hierarchy edges.
- [x] Verified the new radial result has zero overlaps and shorter total hub-edge length than the pinned Dagre fixture.
- [x] Verified 18 satellites distribute across multiple rings without overlap.

Next slice:

- [ ] Add a true System Context radial strategy using the shared radial geometry.
- [ ] Add system-of-interest inference and explicit override.
- [ ] Group people, external systems, and internal systems into stable sectors.
- [ ] Surface strategy diagnostics and quality comparison in a preview UX.
- [ ] Add browser-rendered visual regression coverage for Hub-Spoke and System Context.

### Slice 3 Delivery Record

**Completed**: 2026-07-11

Delivered:

- [x] Added a dedicated System Context strategy selected by the built-in preset.
- [x] Added explicit system-of-interest override and invalid-override recovery.
- [x] Added deterministic inference that prefers software systems, then internal elements, then connected fallbacks.
- [x] Added stable role sectors for people, internal elements, external systems, and uncategorized elements.
- [x] Added effective C4 type resolution through `data.c4Type` before renderer node type.
- [x] Added diagnostics for ambiguous selection, unusual explicit selections, missing software systems, disconnected elements, secondary relationships, multiple rings, and hierarchy exclusions.
- [x] Extracted shared connectivity ranking and hierarchy diagnostics used by Hub-Spoke and System Context.
- [x] Verified large System Context diagrams use multiple collision-free rings.
- [x] Preserved the Hub-Spoke regression suite while sharing radial and graph-analysis primitives.

Next slice:

- [x] Surface strategy name, selected center, diagnostics, and quality deltas before apply.
- [x] Add current-versus-proposed layout preview in a conventional drawer workflow.
- [x] Allow explicit hub or system-of-interest correction from preview.
- [ ] Add browser-rendered visual regression coverage for both radial strategies.
- [ ] Add ownership-aware sector refinement after the role correction UX is stable.

### Slice 4 Delivery Record

**Completed**: 2026-07-11

Delivered:

- [x] Added a pure non-destructive preview model for graph and selected-subgraph layouts.
- [x] Added current-versus-proposed overlap, crossing, edge-length, occupied-area, and displacement deltas.
- [x] Added a dedicated bottom layout drawer with strategy, engine, scope, warning count, controls, metrics, diagnostics, Apply, and Cancel.
- [x] Rendered proposed positions read-only while keeping the canvas machine, autosave state, and undo boundary unchanged until Apply.
- [x] Added explicit hub and system-of-interest correction with duplicate-label disambiguation.
- [x] Added empty-selection fallback in preview while preserving the legacy selected-layout no-op API.
- [x] Made the layout drawer temporarily take priority over OPY and Data Bar without changing their persisted open state.
- [x] Added Escape cancellation and stale-preview invalidation when the active diagram changes.
- [x] Added focused model and component tests for preview state, scope, center controls, quality data, Apply, and Cancel.
- [x] Verified desktop at 1280x720 and narrow layout at 760x800 with no horizontal overflow.
- [x] Consolidated narrow layout into one vertical scroll surface and verified center correction, Apply, Cancel, and Escape in the running app.

Next slice:

- [ ] Add automated screenshot regression fixtures for Hub-Spoke, System Context, and the preview drawer.
- [ ] Add ownership-aware sector refinement and correction controls.
- [x] Begin the ELK foundation with a direct dependency and asynchronous worker adapter spike.

### Slice 5 Delivery Record

**Completed**: 2026-07-11

Delivered:

- [x] Added `elkjs` 0.11 as a direct production dependency.
- [x] Added an isolated module worker adapter with per-request termination, cancellation, a configurable timeout, and typed Effect errors.
- [x] Added deterministic ELK Layered graph mapping for hierarchy, measured node dimensions, direction, spacing, hierarchy-crossing edges, and orthogonal routing.
- [x] Added result mapping for nested positions, compound node bounds, and routed edge sections without changing the live canvas preset path.
- [x] Registered ELK through the asynchronous strategy registry while keeping every existing synchronous preset unchanged.
- [x] Corrected quality scoring so intentional ancestor-child containment is not reported as node overlap.
- [x] Added real-engine determinism and compound-layout tests plus worker success, cancellation, timeout, and failure contract tests.
- [x] Verified the production build emits ELK as a separate lazy worker asset (about 1.4 MB) rather than adding it to the main canvas chunk.
- [x] Recorded an initial synthetic Node benchmark: 25 nodes 41.5 ms, 100 nodes 25.5 ms, 250 nodes 49.8 ms, and 500 nodes 68.0 ms.

Next slice:

- [x] Connect ELK Layered to the non-destructive layout preview as an explicit advanced strategy.
- [x] Render returned orthogonal edge routes in preview and preserve them on Apply.
- [ ] Add explicit port mapping and port-assignment policies.
- [ ] Add realistic dense-edge and compound fixtures, then measure browser-worker startup and execution budgets.
- [x] Add last-valid-preview fallback behavior for worker and engine failure.
- [ ] Add ELK Radial only after comparing it against the existing product-specific radial geometry.

### Slice 6 Delivery Record

**Completed**: 2026-07-11

Delivered:

- [x] Added ELK Layered as an explicit advanced graph-layout choice while keeping it out of selection-only menus until compound selection coordinates are defined.
- [x] Added asynchronous preview orchestration with visible computing and failure states.
- [x] Cancelled in-flight ELK work when the user cancels, presses Escape, changes diagram, or starts another preview.
- [x] Kept the canvas read-only throughout computation and preview so engine work cannot mutate the board.
- [x] Added an exact-preview apply event that commits the reviewed nodes and edges through the existing machine boundary instead of recomputing synchronously.
- [x] Added a routed React Flow edge renderer for ELK orthogonal sections and bend points.
- [x] Persisted accepted route metadata with edges and cleared stale routes when a later layout does not return routes.
- [x] Added tests for asynchronous preview mapping, routed SVG paths, and exact machine commits with the prior layout retained.

Next slice:

- [x] Add a last-valid-preview fallback and a retry action for worker or engine failure.
- [ ] Add explicit ELK port mapping and stable port policies for C4 relationships.
- [ ] Define selected-compound graph extraction and route-coordinate translation before exposing ELK in selection menus.
- [ ] Add browser automation coverage for the real worker, route rendering, Apply, Cancel, and failure states.
- [ ] Add dense-edge and nested compound fixtures with browser-worker performance budgets.

### Slice 7 Delivery Record

**Completed**: 2026-07-11

Delivered:

- [x] Added a diagram- and source-scoped last-valid preview cache for asynchronous engine recovery.
- [x] Restored the last valid preview when ELK fails without mutating the board.
- [x] Prevented a cached preview from being reused after graph or diagram changes.
- [x] Added explicit fallback messaging that identifies the failed engine attempt and retained strategy.
- [x] Added Retry and Cancel actions both with and without an available fallback.
- [x] Added monotonic request identity checks so cancelled or superseded work cannot replace a newer preview even if its executor resolves late.
- [x] Preserved Apply for the visibly retained fallback result through the exact-preview commit boundary.
- [x] Added focused tests for fallback messaging, retry behavior, no-fallback errors, cancellation, and stale request rejection.

Next slice:

- [x] Add explicit ELK ports at deterministic C4 node sides.
- [x] Add stable source/target port assignment policies for supported layout directions; relationship-semantic refinement remains open.
- [x] Return port assignments with route metadata and preserve them on Apply.
- [x] Add compound and hierarchy-crossing port fixtures before exposing additional ELK strategies.

### Slice 8 Delivery Record

**Completed**: 2026-07-11

Delivered:

- [x] Added fixed ELK ports that match the handles exposed by every current C4 and DDD node renderer.
- [x] Assigned bottom-to-top ports for top-to-bottom layouts and right-to-left ports for left-to-right layouts.
- [x] Added fixed-side ELK constraints and connected hierarchy-crossing edges directly through port IDs.
- [x] Returned typed source and target handle assignments with layout results and committed them through preview Apply.
- [x] Added an explicit diagnostic when reverse directions cannot use fixed ports with the current renderer handles.
- [x] Added a versioned persisted-edge JSON envelope for relationship metadata, route geometry, and handle assignments.
- [x] Preserved backward compatibility with existing flat edge metadata without requiring a database migration.
- [x] Verified deterministic compound routing through the real ELK engine and round-trip route/handle persistence.

Next slice:

- [x] Add top/right target handles and bottom/left source handles through a shared node-handle component.
- [x] Enable fixed ports for bottom-to-top and right-to-left ELK layouts.
- [ ] Add relationship-semantic port policies for commands, events, requests, and data dependencies.
- [ ] Measure port congestion and distribute high-degree relationships across multiple ordered ports per side.
- [ ] Surface port policy and congestion diagnostics in the layout preview.

### Slice 9 Delivery Record

**Completed**: 2026-07-11

Delivered:

- [x] Replaced duplicated handle declarations across all 19 C4 and DDD node renderers with one shared `NodeHandles` component.
- [x] Preserved the existing visible and interactive target-top, target-left, source-right, and source-bottom handles.
- [x] Added invisible non-interactive layout anchors for target-right, target-bottom, source-top, and source-left.
- [x] Expanded typed layout handle assignments to all four node sides.
- [x] Added north-to-south fixed ports for bottom-to-top layouts.
- [x] Added west-to-east fixed ports for right-to-left layouts.
- [x] Removed the reverse-direction fallback diagnostic now that every direction has a renderer-compatible port policy.
- [x] Verified compound hierarchy-crossing routes through the real ELK engine for bottom-to-top and right-to-left layouts.
- [x] Added renderer contract coverage proving all eight source/target anchors exist while only the original four remain connectable.

Next slice:

- [x] Introduce a deterministic multi-port allocator for high-degree nodes.
- [x] Order same-side ports stably by adjacent node identity and semantic relationship class.
- [x] Add congestion metrics and diagnostics before changing rendered edge density.
- [x] Evaluate commands, events, synchronous requests, and data dependencies as ordering classes; separate visual groups remain open.
- [x] Preserve stable port identity when one edge or node is added incrementally.

### Slice 10 Delivery Record

**Completed**: 2026-07-11

Delivered:

- [x] Replaced one-port-per-side ELK mapping with one deterministic ELK port per relationship endpoint.
- [x] Kept React Flow on the shared side handles while using ELK-only ports for exact routed geometry, avoiding extra handle DOM on large boards.
- [x] Classified relationships as command, event, request, or data using node types, communication metadata, and grounded label hints.
- [x] Ordered same-side ports by semantic class, adjacent node identity, and edge identity.
- [x] Made port IDs derive from stable edge identity rather than mutable ordinal position.
- [x] Added typed per-node-side congestion metrics using node dimensions and a readable 24px port-spacing estimate.
- [x] Added preview warnings when edge density exceeds estimated side capacity.
- [x] Verified allocation is unchanged by input edge order and existing port IDs survive incremental edge insertion.
- [x] Added a 12-edge hub fixture covering semantic ordering, multi-port allocation, stable identity, and congestion diagnostics.

Next slice:

- [x] Overlay ELK routes and assigned handles during preview rather than only after Apply.
- [x] Add port congestion counts to the drawer quality surface, not only diagnostics.
- [ ] Compare semantic ordering against crossing count on event-driven and client-server fixtures.
- [ ] Decide whether separate visible semantic port groups improve readability enough to justify new node affordances.
- [ ] Add browser screenshots for dense routed previews at desktop and narrow HUD sizes.

### Slice 11 Delivery Record

**Completed**: 2026-07-11

Delivered:

- [x] Added one pure result-to-edge projection used by both preview rendering and accepted Apply commits.
- [x] Overlaid ELK route sections and assigned React Flow handles while the preview remains non-destructive.
- [x] Preserved ownership-lens edge filtering while switching its source to projected preview edges.
- [x] Cleared stale route and handle metadata when previewing a strategy that does not return routed edges.
- [x] Added a typed port summary with assigned edge count, congested side count, and deterministic busiest-side selection.
- [x] Added port density data directly below the quality comparison table with ready and caution states.
- [x] Added focused coverage proving preview projection includes routes and handles before Apply.
- [x] Added drawer coverage for assigned edges, congested sides, and busiest-side capacity.

Verification constraint:

- [ ] Browser-only visual QA remains blocked by Tauri window and SQLite initialization; verify dense routed screenshots in `bun tauri dev` before closing visual regression coverage.

Runtime correction:

- [x] Replaced the nested `elk.bundled.js` worker path with one Vite-managed ELK module worker.
- [x] Preserved typed cancellation, timeout, and worker-failure handling at the client boundary.
- [x] Verified the production worker asset contains the ELK runtime without constructing a nested worker, matching Tauri WKWebView constraints.

Next slice:

- [x] Add representative Event-Driven and Client-Server semantic routing fixtures.
- [x] Compare semantic port ordering with neutral stable ordering using crossings, route length, and congestion.
- [x] Keep semantic ordering only where fixture evidence demonstrates a readability gain.
- [ ] Add a Tauri-native screenshot workflow for dense routed previews.

### Slice 12 Delivery Record

**Completed**: 2026-07-11

Delivered:

- [x] Added Event-Driven and Client-Server fixtures with command, event, request, and data relationship evidence.
- [x] Added orthogonal route crossing, routed length, and congested-side comparison for real ELK results.
- [x] Compared semantic-class ordering with neutral adjacent-node ordering on both fixtures.
- [x] Recorded zero crossings and equal congestion for both policies on both fixtures.
- [x] Recorded equal routed length within 0.001px: 772.667px for Event-Driven and 1,825.133px for Client-Server.
- [x] Kept semantic classification on assignments for diagnostics while making neutral stable ordering the production default.
- [x] Deferred visible semantic port groups because the current evidence does not justify additional node affordances.

Next slice:

- [x] Add a Tauri-native screenshot workflow for dense routed previews.
- [ ] Capture desktop and narrow-HUD baselines for Event-Driven and Client-Server ELK previews.
- [ ] Add route-aware quality metrics to the preview drawer if they remain stable across broader fixtures.

### Slice 13 Delivery Record

**Completed**: 2026-07-11

Delivered:

- [x] Added a macOS-native capture command for the running Tauri WKWebView rather than substituting a browser render.
- [x] Added deterministic desktop (1600x900) and narrow HUD (960x720) window profiles.
- [x] Located the Tauri window through CoreGraphics and captured only its pixels with `screencapture`.
- [x] Validated actual native dimensions before writing each image.
- [x] Separated disposable `.artifacts` output from explicitly promoted tracked baselines.
- [x] Documented Accessibility, Screen Recording, fixture preparation, capture, and baseline-promotion steps.

Next slice:

- [x] Add deterministic in-app loading for the Event-Driven and Client-Server visual fixtures.
- [x] Capture and review all four Tauri baselines without depending on persisted user board state.
- [ ] Add route-aware quality metrics to the preview drawer if broader fixture evidence remains stable.

### Slice 14 Delivery Record

**Completed**: 2026-07-11

Delivered:

- [x] Added production-owned Event-Driven and Client-Server visual fixtures with clone-on-load isolation.
- [x] Added a debug-only `C4_VISUAL_FIXTURE` bridge from the native Tauri process to the canvas.
- [x] Added a dedicated machine transition that clears persistent diagram identity, save state, and layout history.
- [x] Automatically opened ELK Layered once fixture state arrived, making native startup capture-ready.
- [x] Kept normal production startup and persisted-board selection unchanged outside development mode.
- [x] Captured and visually reviewed Event-Driven desktop and narrow native baselines.
- [x] Captured and visually reviewed Client-Server desktop and narrow native baselines.
- [x] Stored all four reviewed PNGs under `tests/__snapshots__/visual/tauri-layout/`.

Next slice:

- [x] Promote routed crossing and routed edge length into the preview quality model.
- [x] Display routed metrics only for strategies that return route geometry.
- [x] Keep straight-line metrics as the cross-engine baseline and label both measures unambiguously.

### Slice 15 Delivery Record

**Completed**: 2026-07-11

Delivered:

- [x] Added one shared routed-geometry evaluator over actual route sections and bend points.
- [x] Counted proper crossings only between segments owned by different edges.
- [x] Measured routed Manhattan segment length independently from node-center estimates.
- [x] Reused the evaluator in both ELK policy evidence and preview quality modeling.
- [x] Renamed cross-engine rows to Straight crossings and Straight length.
- [x] Added Routed crossings and Routed length only when the strategy returns route geometry.
- [x] Added focused model, geometry, and drawer coverage for routed metrics and conditional visibility.

Next slice:

- [x] Add route-aware quality thresholds and diagnostics for unusually long or crossing-heavy ELK results.
- [x] Compare routed metrics against a broader set of dense compound fixtures before defining acceptance gates.
- [ ] Refresh native visual baselines once the debug Tauri window is visible to macOS capture again.

### Slice 16 Delivery Record

**Completed**: 2026-07-11

Delivered:

- [x] Added two-boundary, dense three-boundary, and crossing-pressure mesh ELK fixtures.
- [x] Recorded real-engine crossing evidence of 2/7, 4/11, and 9/12 crossings per edge respectively.
- [x] Recorded normal average routed lengths between 205px and 295px per edge across those fixtures.
- [x] Added a conservative crossing gate requiring at least five crossings and density above 0.5 per edge.
- [x] Added a spacing-aware length gate above the greater of 500px or three configured rank spacings per edge.
- [x] Added `elk-route-crossing-heavy` and `elk-route-length-high` diagnostics with explicit observed values and gates.
- [x] Verified normal compound graphs remain warning-free while pressured and synthetic boundary cases trigger independently.
- [x] Surfaced route warnings through the existing preview diagnostics panel without adding another alert surface.

Next slice:

- [x] Add deterministic route-quality recommendations to diagnostics, such as direction or spacing adjustments.
- [x] Let preview Retry apply a recommended safe adjustment without mutating the board.
- [ ] Refresh native visual baselines once the debug Tauri window is visible to macOS capture again.

### Slice 17 Delivery Record

**Completed**: 2026-07-11

Delivered:

- [x] Added typed layout recommendations to warning diagnostics.
- [x] Recommended the alternate primary axis for crossing-heavy routes.
- [x] Recommended a bounded 25% rank-spacing reduction for unusually long routes.
- [x] Added a single Try recommended action using the diagnostic's concrete label and option patch.
- [x] Reran the asynchronous preview with merged options while leaving canvas nodes and edges unchanged.
- [x] Preserved recommended options through worker failure and ordinary Retry.
- [x] Kept Apply as the only transition that commits preview geometry to the canvas machine.
- [x] Added real-engine recommendation assertions and drawer interaction coverage.

Next slice:

- [x] Evaluate the recommended alternative before presenting it and suppress recommendations that do not improve route quality.
- [x] Show before-versus-recommended routed metric deltas when an alternative is accepted for preview.
- [ ] Refresh native visual baselines once the debug Tauri window is visible to macOS capture again.

### Slice 18 Delivery Record

**Completed**: 2026-07-11

Delivered:

- [x] Evaluated each candidate recommendation with a second non-destructive ELK execution before exposing an action.
- [x] Compared actual routed crossings first and routed length second.
- [x] Accepted fewer crossings even when route length grows, because topology readability is the primary objective.
- [x] Required more than 1% routed-length improvement when crossing count is unchanged.
- [x] Suppressed alternatives that increase crossings, fail to return routes, or do not improve either measure.
- [x] Displayed before-versus-recommended crossings and routed length beside accepted actions.
- [x] Verified the real crossing-pressure mesh suppresses its axis recommendation: crossings remain 9 while length grows from 3,544px to 4,453px.
- [x] Added pure acceptance-policy, real-engine suppression, and drawer evidence coverage.

Next slice:

- [x] Cache evaluated alternatives so Try recommended promotes the validated result without running ELK a third time.
- [x] Preserve the original preview as an immediate comparison/revert target after trying a recommendation.
- [ ] Refresh native visual baselines once the debug Tauri window is visible to macOS capture again.

### Slice 19 Delivery Record

**Completed**: 2026-07-11

Delivered:

- [x] Stored the validated recommended `LayoutResult` alongside its acceptance evidence.
- [x] Promoted cached nodes, routes, ports, diagnostics, and quality summaries without a third ELK execution.
- [x] Recomputed preview deltas and routed summaries from the promoted result.
- [x] Preserved the original preview model as an immediate comparison target.
- [x] Added Compare original to restore the first preview without worker activity or board mutation.
- [x] Cleared comparison state on new preview requests, Apply, and Cancel.
- [x] Kept both original and promoted states non-destructive until explicit Apply.
- [x] Added cached-promotion and comparison-control coverage.

Next slice:

- [x] Add explicit Original and Recommended comparison labels so users always know which preview is active.
- [x] Allow toggling repeatedly between cached original and recommended previews.
- [ ] Refresh native visual baselines once the debug Tauri window is visible to macOS capture again.

### Slice 20 Delivery Record

**Completed**: 2026-07-11

Delivered:

- [x] Replaced the one-way restore action with an Original / Recommended segmented comparison control.
- [x] Added explicit pressed state so the active preview is always identifiable to sighted and assistive-technology users.
- [x] Retained both cached preview models for repeated bidirectional switching.
- [x] Swapped active nodes, routes, diagnostics, and metrics without worker execution.
- [x] Hid the initial recommendation action after comparison begins, leaving one unambiguous mode control.
- [x] Kept Apply bound to whichever comparison mode is currently active.
- [x] Cleared the full comparison pair on new preview, Apply, and Cancel boundaries.
- [x] Added repeated-toggle and active-state interaction coverage.

Next slice:

- [x] Add keyboard shortcuts for Original / Recommended comparison while the drawer has focus.
- [x] Announce comparison-mode changes through a polite live region.
- [ ] Refresh native visual baselines once the debug Tauri window is visible to macOS capture again.

### Slice 21 Delivery Record

**Completed**: 2026-07-11

Delivered:

- [x] Added drawer-scoped Alt+Left and Alt+Right controls for Original and Recommended modes.
- [x] Prevented comparison shortcuts from affecting the rest of the workspace.
- [x] Added `aria-keyshortcuts` metadata to both segmented-control buttons.
- [x] Added a polite, atomic live-region announcement for active comparison mode changes.
- [x] Kept shortcut guidance out of visible UI while preserving discoverability for assistive technology.
- [x] Preserved the segmented control as the primary pointer and keyboard-tab interaction.
- [x] Added shortcut scoping, inactive-modifier, metadata, and announcement coverage.

Next slice:

- [x] Add a compact comparison delta strip that remains visible in both modes.
- [x] Identify which metrics favor the active mode without implying that one aggregate score decides acceptance.
- [ ] Refresh native visual baselines once the debug Tauri window is visible to macOS capture again.

### Slice 22 Delivery Record

**Completed**: 2026-07-11

Delivered:

- [x] Added one stable comparison model derived from the cached Original and Recommended pair.
- [x] Compared overlaps, canvas area, routed crossings, and routed length independently.
- [x] Marked each metric as favoring Original, Recommended, or Tie using lower-is-better semantics.
- [x] Omitted routed metrics when either preview lacks route geometry.
- [x] Added a compact horizontally resilient delta strip outside the scrollable detail panels.
- [x] Kept the same evidence visible while either comparison mode is active.
- [x] Avoided aggregate scoring so mixed quality tradeoffs remain explicit.
- [x] Added model and rendered-strip coverage for original, recommended, and tied outcomes.

Next slice:

- [x] Add focus-safe Apply confirmation text that identifies whether Original or Recommended is active.
- [x] Preserve the comparison metric strip in the accepted layout audit metadata.
- [ ] Refresh native visual baselines once the debug Tauri window is visible to macOS capture again.

### Slice 23 Delivery Record

**Completed**: 2026-07-11

Delivered:

- [x] Changed the focused command label to Apply original or Apply recommended in comparison mode.
- [x] Added a versioned `LayoutApplicationAudit` contract with preset, strategy, engine, timestamp, and selected variant.
- [x] Preserved every comparison metric's original value, recommended value, and favored outcome without an aggregate score.
- [x] Created the audit only at explicit Apply, not during preview or comparison switching.
- [x] Stored the latest audit in canvas machine state for immediate runtime inspection.
- [x] Attached the same audit record to applied edge layout metadata.
- [x] Extended the existing versioned edge payload to round-trip audit metadata without a database migration.
- [x] Restored the latest persisted audit when loading a diagram with audited edges.
- [x] Added Apply labeling, audit construction, machine transition, and persistence round-trip coverage.

Next slice:

- [ ] Surface the latest layout audit in the preview or history UX without duplicating it per visible edge.
- [x] Define diagram-level audit persistence for edge-free boards and future multi-step layout history.
- [ ] Refresh native visual baselines once the debug Tauri window is visible to macOS capture again.

### Slice 24 Delivery Record

**Completed**: 2026-07-11

Delivered:

- [x] Added migration 029 with a diagram-owned append-only `layout_audits` table.
- [x] Stored version, application timestamp, and validated audit JSON under a diagram foreign key.
- [x] Added deterministic audit identity from diagram ID and Apply timestamp for idempotent saves.
- [x] Persisted the latest canvas audit directly from save input, including edge-free boards.
- [x] Loaded complete newest-first layout audit history and exposed the latest record on `CanvasDiagram`.
- [x] Restored latest diagram-owned audit into canvas machine state on board load.
- [x] Stopped attaching new audit records to every applied edge.
- [x] Retained edge-embedded audit hydration as a compatibility fallback for pre-migration saves.
- [x] Kept malformed or unsupported audit rows out of runtime state.
- [x] Added focused append, ordered-history, malformed-row, migration-build, and edge-free persistence coverage.

Next slice:

- [x] Add a dedicated layout history surface using diagram-owned audit records.
- [x] Surface the latest accepted layout audit without duplicating it per visible edge.
- [x] Support selecting an audit entry to inspect its chosen variant and metric evidence.
- [ ] Refresh native visual baselines once the debug Tauri window is visible to macOS capture again.

### Slice 25 Delivery Record

**Completed**: 2026-07-11

Delivered:

- [x] Replaced the Data Bar History placeholder with a diagram-owned layout application history surface.
- [x] Preserved newest-first audit history in canvas runtime state instead of retaining only the latest record.
- [x] Prepended newly accepted layouts immediately without waiting for a diagram reload.
- [x] Preserved audit history across Azure graph synchronization and OPY proposal application load transitions.
- [x] Added a selectable application list with explicit Original, Recommended, and Single variant labels.
- [x] Added read-only strategy, engine, timestamp, and per-metric comparison evidence for the selected application.
- [x] Added a clear edge-free and never-laid-out empty state.
- [x] Added focused component and canvas-machine coverage for selection, evidence, load ordering, and Apply updates.

Next slice:

- [x] Add a bounded history policy before long-lived diagrams accumulate unbounded records.
- [ ] Add explicit audit deletion controls with confirmation.
- [ ] Add layout history export for architecture review evidence.
- [ ] Refresh native visual baselines once the debug Tauri window is visible to macOS capture again.

### Slice 26 Delivery Record

**Completed**: 2026-07-11

Delivered:

- [x] Defined a shared retention limit of 100 accepted layout applications per diagram.
- [x] Pruned older records immediately after append inside the existing diagram save transaction.
- [x] Ordered retention by application time and audit identity for deterministic tie-breaking.
- [x] Scoped pruning to the active diagram so no other board history can be affected.
- [x] Applied the same bound to loaded and newly accepted in-memory history.
- [x] Preserved newest-first inspection while dropping only the oldest entry when the limit is exceeded.
- [x] Added focused persistence and canvas-machine coverage for the policy and operation order.

Next slice:

- [x] Add clear-all and individual audit deletion behind explicit confirmation.
- [ ] Add JSON or CSV history export for architecture review evidence.
- [ ] Refresh native visual baselines once the debug Tauri window is visible to macOS capture again.

### Slice 27 Delivery Record

**Completed**: 2026-07-11

Delivered:

- [x] Added diagram-scoped persistence operations for deleting one audit or clearing all audit history.
- [x] Required an inline second confirmation action before either destructive operation executes.
- [x] Added explicit cancellation controls that leave persistence and runtime state unchanged.
- [x] Disabled destructive controls while a request is in flight so repeated activation is inert.
- [x] Updated canvas runtime history only after SQLite reports success.
- [x] Repaired the latest-audit reference to the next newest record after individual deletion.
- [x] Cleared both history and latest-audit state after a successful clear-all operation.
- [x] Kept persistence failures visible in the history surface without presenting false success.
- [x] Added focused persistence, machine, and component coverage for scoping and confirmation behavior.

Next slice:

- [x] Export layout history as a versioned JSON review artifact.
- [ ] Add CSV only if architecture-review workflows demonstrate a tabular interoperability need.
- [ ] Refresh native visual baselines once the debug Tauri window is visible to macOS capture again.

### Slice 28 Delivery Record

**Completed**: 2026-07-11

Delivered:

- [x] Added a pure versioned `opsydyn.layout-history` review-artifact contract.
- [x] Included export time, diagram identity, retention policy, exported count, and complete audit evidence.
- [x] Excluded board nodes, edge labels, credentials, and unrelated diagram content from the artifact.
- [x] Enforced deterministic newest-first audit ordering regardless of runtime input order.
- [x] Added stable pretty-printed JSON serialization with a trailing newline.
- [x] Added filesystem-safe, diagram-derived filenames with a bounded fallback.
- [x] Added an explicit Export JSON command to the layout history surface.
- [x] Reused the existing browser Blob download boundary without expanding Tauri filesystem permissions.
- [x] Added focused contract, serialization, filename, ordering, and command coverage.

Next slice:

- [x] Validate the JSON artifact against an Effect Schema before download and future import.
- [ ] Add artifact import only when a concrete review or migration workflow requires it.
- [ ] Add CSV only if architecture-review workflows demonstrate a tabular interoperability need.
- [ ] Refresh native visual baselines once the debug Tauri window is visible to macOS capture again.

### Slice 29 Delivery Record

**Completed**: 2026-07-11

Delivered:

- [x] Added Effect Schemas for comparison metrics, layout application audits, and the outer review artifact.
- [x] Restricted schema identifiers, artifact versions, engines, variants, metric keys, and favored outcomes to known literals.
- [x] Required timestamps and counts to be non-negative integers.
- [x] Required metric values to be finite numbers.
- [x] Required the declared export count to equal the encoded audit array length.
- [x] Rejected artifacts exceeding the shared per-diagram retention limit.
- [x] Validated artifacts during construction and again immediately before JSON serialization.
- [x] Exported a reusable unknown-input decoder for any future import or review tooling.
- [x] Added rejection coverage for unsupported versions and inconsistent counts.

Next slice:

- [x] Add a review-artifact summary and integrity fingerprint for evidence exchange.
- [ ] Add artifact import only when a concrete review or migration workflow requires it.
- [ ] Refresh native visual baselines once the debug Tauri window is visible to macOS capture again.

### Slice 30 Delivery Record

**Completed**: 2026-07-11

Delivered:

- [x] Upgraded new review artifacts to contract version 2.
- [x] Added derived application counts, first and latest timestamps, selected-variant counts, and engine counts.
- [x] Validated every summary field against the encoded audit sequence rather than trusting caller input.
- [x] Added canonical recursive key ordering so integrity does not depend on JSON formatting or property insertion order.
- [x] Added a lowercase SHA-256 fingerprint over every artifact field except the fingerprint itself.
- [x] Added a reusable verifier that rejects schema-invalid or fingerprint-mismatched artifacts.
- [x] Used the platform Web Crypto implementation without adding a hashing dependency.
- [x] Made asynchronous export guarded, inert while pending, and able to surface runtime failures.
- [x] Added valid-fingerprint and modified-evidence detection coverage.

The fingerprint provides integrity evidence, not signer identity or authenticity. Signed review artifacts remain a separate governance decision.

Next slice:

- [x] Surface the artifact summary and fingerprint in the History UX before download.
- [ ] Add signed artifacts only when an organization identity and trust model is defined.
- [ ] Add artifact import only when a concrete review or migration workflow requires it.
- [ ] Refresh native visual baselines once the debug Tauri window is visible to macOS capture again.

### Slice 31 Delivery Record

**Completed**: 2026-07-11

Delivered:

- [x] Replaced one-click export with separate Prepare JSON and Download JSON commands.
- [x] Kept download unavailable until schema validation, summary derivation, and SHA-256 generation complete.
- [x] Displayed artifact version and application count before download.
- [x] Displayed first and latest application times plus variant and engine distributions.
- [x] Displayed the complete SHA-256 fingerprint with resilient wrapping for copying and review.
- [x] Kept preparation failures in the existing visible operation-error surface.
- [x] Disabled export and destructive controls while artifact preparation is active.
- [x] Invalidated prepared evidence whenever the diagram's retained audit sequence changes.
- [x] Added interaction coverage proving preparation precedes download and passes the reviewed artifact unchanged.

Next slice:

- [x] Reconcile phase status against delivered code and verification evidence.
- [x] Regroup on Phase 4 semantic layouts rather than continuing export polish.
- [ ] Keep Copy fingerprint, signed artifacts, and artifact import in the evidence-exchange backlog.

### Slice 32 Delivery Record

**Completed**: 2026-07-11

Delivered:

- [x] Added schema-validated architecture patterns for Hexagonal, Event-Driven, and Client-Server.
- [x] Added one shared semantic-role vocabulary covering all three Phase 4 patterns.
- [x] Enforced pattern-specific role validity at the assignment schema boundary.
- [x] Added confidence, inference source, and grounded evidence to every role assignment.
- [x] Reserved explicit `data.layoutRole` as the highest-priority future correction input.
- [x] Rejected cross-pattern explicit roles with visible mismatch and ambiguity diagnostics.
- [x] Added deterministic Hexagonal inference from explicit roles, C4/DDD node types, labels, edge direction, and stable topology ranking.
- [x] Classified the representative core, inbound adapters, outbound port, and outbound adapters with confidence of at least 0.7.
- [x] Added input-order invariance and ambiguous-node coverage.

Next slice:

- [x] Implement deterministic Hexagonal core, port, adapter, and infrastructure geometry from the classified roles.
- [ ] Surface role evidence, confidence, and ambiguity in the layout preview.
- [ ] Add explicit role correction controls only after the inferred geometry is visible for review.
- [ ] Refresh native visual baselines once the debug Tauri window is visible to macOS capture again.

### Slice 33 Delivery Record

**Completed**: 2026-07-11

Delivered:

- [x] Added a dedicated synchronous Hexagonal strategy and routed the existing preset through it instead of Dagre.
- [x] Positioned domain cores centrally, inbound and outbound ports on inner sectors, and adapters on outer sectors.
- [x] Positioned infrastructure in a separate lower sector and isolated unclassified nodes in a review sector.
- [x] Used measured node dimensions and role-local lane spacing to prevent overlaps.
- [x] Preserved tactical grid snapping and normalized all top-level geometry into positive canvas coordinates.
- [x] Preserved child-relative coordinates and diagnosed hierarchy-crossing edges excluded from placement.
- [x] Propagated semantic mismatch and ambiguity warnings into standard layout diagnostics.
- [x] Added role-count, missing-core, and multiple-core diagnostics.
- [x] Verified distinct geometry, expected sector ordering, zero overlaps, infrastructure placement, and input-order determinism.

Next slice:

- [x] Surface role, inference source, confidence, and evidence in the layout preview drawer.
- [x] Highlight ambiguous and contradictory nodes without mutating the board.
- [ ] Add explicit role correction controls after role evidence is reviewable.
- [ ] Add native Hexagonal desktop and narrow-HUD visual baselines.

### Slice 34 Delivery Record

**Completed**: 2026-07-11

Delivered:

- [x] Added optional typed semantic-role evidence to `LayoutResult`.
- [x] Returned the exact assignments that drove Hexagonal geometry through the preview boundary.
- [x] Added a compact Semantic Roles review surface inside Placement.
- [x] Displayed node label, assigned role, confidence percentage, inference source, and grounded evidence.
- [x] Prioritized contradictory and low-confidence nodes ahead of confident assignments.
- [x] Added warning and ready treatments without turning role rows into mutation controls.
- [x] Derived warning state from semantic diagnostics and the shared confidence threshold.
- [x] Preserved the existing Apply-only mutation boundary and read-only canvas preview.
- [x] Added drawer coverage for confident role evidence and contradictory explicit-role review.

Next slice:

- [x] Add explicit role correction controls that recompute Hexagonal geometry non-destructively.
- [x] Persist accepted role corrections only when the reviewed layout is applied.
- [ ] Add native Hexagonal desktop and narrow-HUD visual baselines after correction UX stabilizes.

### Slice 35 Delivery Record

**Completed**: 2026-07-11

Delivered:

- [x] Added pattern-valid semantic role menus to every Hexagonal role evidence row.
- [x] Added Infer automatically to remove an explicit correction and return to deterministic inference.
- [x] Recomputed role evidence, diagnostics, quality metrics, and geometry from cloned preview nodes after every correction.
- [x] Preserved earlier transient corrections across repeated preview edits.
- [x] Kept live canvas nodes and persistence unchanged until explicit Apply.
- [x] Reused the exact-preview Apply boundary so Cancel discards corrections without a second mutation path.
- [x] Added migration 030 with a constrained nullable `semantic_role` node column.
- [x] Added validated React Flow-to-database conversion, hydration, save change detection, INSERT, and UPDATE support.
- [x] Added focused correction, geometry movement, conversion round-trip, and SQL column/value alignment coverage.

Next slice:

- [x] Add native Hexagonal desktop and narrow-HUD visual baselines for inference and corrected-role states.
- [ ] Implement Event-Driven publisher, bus, processor, and subscriber inference using the shared role contract.
- [ ] Keep signed evidence and artifact import in the evidence-exchange backlog.

### Slice 36 Delivery Record

**Completed**: 2026-07-11

Delivered:

- [x] Added deterministic inferred and corrected Hexagonal fixtures to the native visual harness.
- [x] Opened each fixture's intended preview preset automatically without touching persisted diagram data.
- [x] Captured and visually reviewed inferred Hexagonal desktop and narrow-HUD baselines.
- [x] Captured and visually reviewed corrected-role Hexagonal desktop and narrow-HUD baselines.
- [x] Preserved explicit outbound-adapter and infrastructure corrections in the corrected fixture so geometry and diagnostics differ from inference.
- [x] Documented the expanded native capture workflow and scenario set.

Next slice:

- [x] Implement Event-Driven publisher, bus, processor, and subscriber inference using the shared role contract.
- [ ] Add deterministic Event-Driven publisher, bus, processor, and subscriber lane geometry.
- [ ] Keep signed evidence and artifact import in the evidence-exchange backlog.

### Slice 37 Delivery Record

**Completed**: 2026-07-11

Delivered:

- [x] Added deterministic Event-Driven publisher, bus, processor, subscriber, infrastructure, and external-dependency inference through an ordered evidence cascade.
- [x] Distinguished continuing bus consumers as processors from terminal consumers as subscribers using graph topology.
- [x] Kept valid explicit Event-Driven roles authoritative and reported contradictory cross-pattern overrides while falling through to grounded evidence.
- [x] Preserved deterministic input-order-independent assignments and diagnostics, then validated every result through the shared Effect Schema.
- [x] Added focused representative, explicit precedence, mismatch fallback, ambiguity, and input-order stability coverage.

Next slice:

- [ ] Add deterministic Event-Driven publisher, bus, processor, and subscriber lane geometry.
- [ ] Capture native Event-Driven visual baselines after lane geometry is available.
- [ ] Keep signed evidence and artifact import in the evidence-exchange backlog.
