# Client-Server Semantic Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic Dagre Client-Server preset with schema-validated semantic inference and deterministic four-tier custom geometry.

**Architecture:** Extend the shared architecture-role classifier with a deterministic Client-Server evidence cascade, then consume those assignments in a dedicated synchronous strategy. Register the strategy through the existing preview/correction/Apply path and reconcile the Starlight roadmap after behavior is verified.

**Tech Stack:** TypeScript 6, Effect 3 Schema, React Flow 12, Vitest 4, Astro 7, custom synchronous layout strategy

## Global Constraints

- The primary path is `client -> service/API -> domain -> persistence` in left-to-right columns.
- Missing tiers remain empty; never invent roles to fill a column.
- Valid explicit Client-Server roles are authoritative.
- Evidence precedence is explicit role, grounded type, token-aware label, topology, then fallback.
- Treat `externalSystem` as a generic fallback after client-identifying label evidence.
- External dependencies use a lower support lane aligned beneath a deterministic service/domain caller.
- Unclassified nodes use a separate review lane beneath support.
- Preserve child-relative coordinates and diagnose hierarchy-crossing edges.
- Preserve the existing semantic correction, preview, Apply, persistence, cancellation, undo, and audit boundaries.
- Do not add OPY/Rig tools, new persistence columns, ELK routing, or native screenshots in this plan.
- Keep output deterministic across node and edge input order and free of input mutation.

---

### Task 1: Client-Server Role Classification

**Files:**
- Modify: `src/core/effects/architecture-role-classification.ts`
- Modify: `test/core/effects/architecture-role-classification.test.ts`

**Interfaces:**
- Consumes: `ArchitectureRoleClassificationSchema`, `buildTopology`, `buildClassification`, `explicitRole`, `nodeLabel`, and `nodeType`
- Produces: `inferClientServerRoles(nodes: ReadonlyArray<Node>, edges: ReadonlyArray<Edge>): ArchitectureRoleClassification`
- Produces: stable assignments using only `client`, `service`, `domain`, `persistence`, `external-dependency`, and `unclassified`

- [ ] **Step 1: Add representative and boundary tests**

Import `inferClientServerRoles` in `test/core/effects/architecture-role-classification.test.ts` and add a fixture with:

```ts
const clientServerFixture = (): { nodes: Node[]; edges: Edge[] } => ({
  nodes: [
    { id: "web-client", type: "person", position: { x: 0, y: 0 }, data: { label: "Web Client" } },
    { id: "api-server", type: "container", position: { x: 0, y: 0 }, data: { label: "Customer API" } },
    { id: "customer-domain", type: "aggregate", position: { x: 0, y: 0 }, data: { label: "Customer Domain" } },
    { id: "customer-repository", type: "repository", position: { x: 0, y: 0 }, data: { label: "Customer Repository" } },
    { id: "identity-provider", type: "externalSystem", position: { x: 0, y: 0 }, data: { label: "Identity Provider" } },
    { id: "worker", type: "component", position: { x: 0, y: 0 }, data: { label: "Worker" } },
  ],
  edges: [
    { id: "client-api", source: "web-client", target: "api-server", label: "request" },
    { id: "api-domain", source: "api-server", target: "customer-domain", label: "command" },
    { id: "domain-repository", source: "customer-domain", target: "customer-repository", label: "customer data" },
    { id: "api-identity", source: "api-server", target: "identity-provider", label: "token request" },
  ],
});
```

Add tests asserting:

```ts
it("classifies the representative Client-Server path with grounded evidence", () => {
  const fixture = clientServerFixture();
  const result = inferClientServerRoles(fixture.nodes, fixture.edges);

  expect(Object.fromEntries(result.assignments.map(({ nodeId, role }) => [nodeId, role]))).toEqual({
    "api-server": "service",
    "customer-domain": "domain",
    "customer-repository": "persistence",
    "identity-provider": "external-dependency",
    "web-client": "client",
    worker: "unclassified",
  });
  expect(result.assignments.filter(({ role }) => role !== "unclassified")
    .every(({ confidence, evidence }) => confidence >= 0.65 && evidence.length > 0)).toBe(true);
  expect(() => Schema.decodeUnknownSync(ArchitectureRoleClassificationSchema)(result)).not.toThrow();
});

it("keeps valid explicit roles authoritative and falls through after a mismatch", () => {
  const fixture = clientServerFixture();
  fixture.nodes.find(({ id }) => id === "worker")!.data.layoutRole = "domain";
  fixture.nodes.find(({ id }) => id === "web-client")!.data.layoutRole = "publisher";
  const result = inferClientServerRoles(fixture.nodes, fixture.edges);

  expect(result.assignments.find(({ nodeId }) => nodeId === "worker"))
    .toMatchObject({ role: "domain", confidence: 1, source: "explicit" });
  expect(result.assignments.find(({ nodeId }) => nodeId === "web-client")?.role).toBe("client");
  expect(result.diagnostics).toContainEqual(expect.objectContaining({
    code: "semantic-role-pattern-mismatch",
    nodeIds: ["web-client"],
  }));
});

it("does not invent a domain role when the tier is absent", () => {
  const fixture = clientServerFixture();
  fixture.nodes = fixture.nodes.filter(({ id }) => id !== "customer-domain");
  fixture.edges = [
    { id: "client-api", source: "web-client", target: "api-server", label: "request" },
    { id: "api-repository", source: "api-server", target: "customer-repository", label: "customer data" },
  ];
  const result = inferClientServerRoles(fixture.nodes, fixture.edges);

  expect(result.assignments.some(({ role }) => role === "domain")).toBe(false);
});

it("classifies an external browser as a client before the external fallback", () => {
  const result = inferClientServerRoles([{
    id: "partner-browser",
    type: "externalSystem",
    position: { x: 0, y: 0 },
    data: { label: "Partner Browser Client" },
  }], []);
  expect(result.assignments[0]).toMatchObject({ role: "client", source: "label" });
});

it("is invariant to Client-Server node and edge input order", () => {
  const fixture = clientServerFixture();
  const forward = inferClientServerRoles(fixture.nodes, fixture.edges);
  const reversed = inferClientServerRoles([...fixture.nodes].reverse(), [...fixture.edges].reverse());
  expect(reversed).toEqual(forward);
});
```

- [ ] **Step 2: Run classification tests and verify RED**

Run:

```bash
bun run test:run test/core/effects/architecture-role-classification.test.ts
```

Expected: FAIL because `inferClientServerRoles` is not exported.

- [ ] **Step 3: Implement the Client-Server evidence cascade**

In `architecture-role-classification.ts`:

```ts
const CLIENT_SERVER_ROLES = ROLES_BY_PATTERN["client-server"];

const CLIENT_LABEL = /\b(?:browser|web[-_\s]?client|mobile[-_\s]?client|desktop[-_\s]?client|frontend|front[-_\s]?end|ui)\b/;
const SERVICE_LABEL = /\b(?:api|server|gateway|controller|endpoint|backend|back[-_\s]?end|application[-_\s]?service)\b/;
const DOMAIN_LABEL = /\b(?:domain|business[-_\s]?rules?|policy|core[-_\s]?business)\b/;
const PERSISTENCE_LABEL = /\b(?:database|db|datastore|storage|repository|cache|persistence)\b/;
```

Implement `inferClientServerRole` with these exact precedence rules:

```ts
const inferClientServerRole = (
  node: Node,
  topology: Map<string, NodeTopology>,
  roleHints: ReadonlyMap<string, ArchitectureSemanticRole>,
  edges: ReadonlyArray<Edge>,
): InferredRole => {
  const explicit = explicitRole(node);
  if (explicit && CLIENT_SERVER_ROLES.has(explicit)) {
    return { role: explicit, confidence: 1, source: "explicit", evidence: [`Explicit role '${explicit}'.`] };
  }
  const mismatch = explicit && !CLIENT_SERVER_ROLES.has(explicit) ? explicit : undefined;
  const label = nodeLabel(node);
  const type = nodeType(node);
  const withMismatch = (result: Omit<InferredRole, "patternMismatch">): InferredRole => ({
    ...result,
    ...(mismatch && { patternMismatch: mismatch }),
  });

  if (type === "person") return withMismatch({ role: "client", confidence: 0.9, source: "node-type", evidence: ["Person initiates a client interaction."] });
  if (["applicationService", "command", "query"].includes(type)) return withMismatch({ role: "service", confidence: 0.85, source: "node-type", evidence: [`DDD ${type} belongs to the application-service boundary.`] });
  if (["aggregate", "domainService", "entity", "valueObject"].includes(type)) return withMismatch({ role: "domain", confidence: 0.9, source: "node-type", evidence: [`DDD ${type} represents domain logic.`] });
  if (type === "repository") return withMismatch({ role: "persistence", confidence: 0.9, source: "node-type", evidence: ["DDD repository represents persistence access."] });
  if (CLIENT_LABEL.test(label)) return withMismatch({ role: "client", confidence: 0.85, source: "label", evidence: ["Client-facing label."] });
  if (PERSISTENCE_LABEL.test(label)) return withMismatch({ role: "persistence", confidence: 0.85, source: "label", evidence: ["Persistence label."] });
  if (DOMAIN_LABEL.test(label)) return withMismatch({ role: "domain", confidence: 0.85, source: "label", evidence: ["Domain or business-logic label."] });
  if (SERVICE_LABEL.test(label)) return withMismatch({ role: "service", confidence: 0.85, source: "label", evidence: ["Service or API label."] });
  if (type === "externalSystem") return withMismatch({ role: "external-dependency", confidence: 0.8, source: "node-type", evidence: ["External system is outside the primary server tiers."] });

  const relation = topology.get(node.id);
  const inboundRoles = [...(relation?.inbound ?? [])].map((id) => roleHints.get(id));
  const outboundRoles = [...(relation?.outbound ?? [])].map((id) => roleHints.get(id));
  const hasInbound = (roles: ArchitectureSemanticRole[], pattern: RegExp) => edges.some((edge) =>
    edge.target === node.id
    && roles.includes(roleHints.get(edge.source) ?? "unclassified")
    && typeof edge.label === "string"
    && pattern.test(edge.label.toLowerCase())
  );
  const hasOutbound = (roles: ArchitectureSemanticRole[], pattern: RegExp) => edges.some((edge) =>
    edge.source === node.id
    && roles.includes(roleHints.get(edge.target) ?? "unclassified")
    && typeof edge.label === "string"
    && pattern.test(edge.label.toLowerCase())
  );
  const REQUEST = /\b(?:request|http|https|call|calls|uses|command|query)\b/;
  const DATA = /\b(?:data|read|reads|write|writes|store|stores|load|loads|query|queries)\b/;
  if (outboundRoles.includes("service") && hasOutbound(["service"], REQUEST)) return withMismatch({ role: "client", confidence: 0.7, source: "topology", evidence: ["Grounded outbound request reaches an identified service."] });
  if (inboundRoles.includes("client") && hasInbound(["client"], REQUEST)) return withMismatch({ role: "service", confidence: 0.7, source: "topology", evidence: ["Receives a grounded request from an identified client."] });
  if (inboundRoles.includes("service") && outboundRoles.includes("persistence") && hasInbound(["service"], REQUEST) && hasOutbound(["persistence"], DATA)) return withMismatch({ role: "domain", confidence: 0.65, source: "topology", evidence: ["Bridges a grounded service request and persistence data dependency."] });
  if (inboundRoles.some((role) => role === "service" || role === "domain") && hasInbound(["service", "domain"], DATA)) return withMismatch({ role: "persistence", confidence: 0.65, source: "topology", evidence: ["Receives a grounded data dependency from the server path."] });
  return withMismatch({ role: "unclassified", confidence: 0.25, source: "fallback", evidence: ["No grounded Client-Server role evidence was found."] });
};
```

Build `roleHints` from explicit/type/label evidence before topology fallback so inference does not depend on iteration order. Then export:

```ts
export function inferClientServerRoles(
  nodes: ReadonlyArray<Node>,
  edges: ReadonlyArray<Edge>,
): ArchitectureRoleClassification {
  const sortedNodes = [...nodes].sort((left, right) => left.id.localeCompare(right.id));
  const topology = buildTopology(sortedNodes, edges);
  const roleHints = buildClientServerRoleHints(sortedNodes);
  const inferred = sortedNodes.map((node) => ({
    node,
    result: inferClientServerRole(node, topology, roleHints, edges),
  }));
  return buildClassification("client-server", inferred, "Client-Server");
}
```

`buildClientServerRoleHints` must apply the same explicit/type/label rules but return no topology-derived role, ensuring a stable second pass.

- [ ] **Step 4: Run classification tests and verify GREEN**

Run:

```bash
bun run test:run test/core/effects/architecture-role-classification.test.ts
```

Expected: all classification tests pass, including existing Hexagonal and Event-Driven coverage.

- [ ] **Step 5: Commit classifier**

```bash
git add src/core/effects/architecture-role-classification.ts test/core/effects/architecture-role-classification.test.ts
git commit -m "feat: classify client-server architecture roles"
```

---

### Task 2: Deterministic Client-Server Geometry

**Files:**
- Create: `src/core/effects/client-server-layout-strategy.ts`
- Create: `test/core/effects/client-server-layout-strategy.test.ts`

**Interfaces:**
- Consumes: `inferClientServerRoles`, `buildHierarchyDiagnostics`, `evaluateLayoutQuality`, `getNodeDimensions`, `LayoutOptions`, and `SynchronousLayoutStrategy`
- Produces: `clientServerLayoutStrategy`, `analyseClientServer`, and `layoutClientServer`
- Produces diagnostics prefixed with `client-server-`

- [ ] **Step 1: Add failing geometry tests**

Create `test/core/effects/client-server-layout-strategy.test.ts` with helpers equivalent to the shipped semantic strategy tests and these cases:

```ts
it("places the four semantic tiers in left-to-right columns", () => {
  const graph = clientServerGraph();
  const result = clientServerLayoutStrategy.layout(graph);
  const byId = new Map(result.nodes.map((node) => [node.id, center(node)]));
  expect(byId.get("web-client")!.x).toBeLessThan(byId.get("api-server")!.x);
  expect(byId.get("api-server")!.x).toBeLessThan(byId.get("customer-domain")!.x);
  expect(byId.get("customer-domain")!.x).toBeLessThan(byId.get("customer-repository")!.x);
  expect(result.quality.nodeOverlapCount).toBe(0);
});

it("aligns external dependencies below their deterministic caller tier", () => {
  const graph = clientServerGraph();
  const result = clientServerLayoutStrategy.layout(graph);
  const byId = new Map(result.nodes.map((node) => [node.id, center(node)]));
  expect(byId.get("identity-provider")!.x).toBe(byId.get("api-server")!.x);
  expect(byId.get("identity-provider")!.y).toBeGreaterThan(byId.get("api-server")!.y);
  expect(byId.get("unknown")!.y).toBeGreaterThan(byId.get("identity-provider")!.y);
});

it("leaves a missing domain tier empty and reports it", () => {
  const graph = clientServerGraphWithoutDomain();
  const result = clientServerLayoutStrategy.layout(graph);
  expect(result.semanticRoles?.some(({ role }) => role === "domain")).toBe(false);
  expect(result.diagnostics).toContainEqual(expect.objectContaining({
    code: "client-server-domain-missing",
    severity: "warning",
  }));
});

it("diagnoses multiple and orphan external affinities deterministically", () => {
  const result = clientServerLayoutStrategy.layout(multiCallerAndOrphanGraph());
  expect(result.diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
    "client-server-external-affinity-ambiguous",
    "client-server-external-orphan",
  ]));
});

it("preserves children, recovers invalid dimensions, and remains deterministic", () => {
  const graph = clientServerGraphWithChildAndInvalidDimensions();
  const forward = clientServerLayoutStrategy.layout(graph);
  const reversed = clientServerLayoutStrategy.layout({
    nodes: [...graph.nodes].reverse(),
    edges: [...graph.edges].reverse(),
    options: graph.options,
  });
  expect(forward.nodes.find(({ id }) => id === "domain-child")?.position).toEqual({ x: 20, y: 30 });
  expect(forward.diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
    "client-server-child-positions-preserved",
    "client-server-hierarchy-edges-excluded",
    "client-server-invalid-geometry-input",
  ]));
  expect(positionRecord(reversed.nodes)).toEqual(positionRecord(forward.nodes));
  expect(forward.quality.nodeOverlapCount).toBe(0);
});
```

The test file must define complete fixture builders using explicit `layoutRole` values for geometry-focused cases, `center` via `getNodeDimensions`, and stable `positionRecord` sorting.

- [ ] **Step 2: Run the geometry suite and verify RED**

Run:

```bash
bun run test:run test/core/effects/client-server-layout-strategy.test.ts
```

Expected: FAIL because `client-server-layout-strategy.ts` does not exist.

- [ ] **Step 3: Implement the custom strategy**

Create `src/core/effects/client-server-layout-strategy.ts` with:

```ts
export const clientServerLayoutStrategy: SynchronousLayoutStrategy = {
  id: "client-server",
  engine: "custom",
  analyse: analyseClientServer,
  layout: layoutClientServer,
};
```

Use default options:

```ts
const DEFAULT_CLIENT_SERVER_OPTIONS: LayoutOptions = {
  direction: "LR",
  nodeSpacing: 120,
  rankSpacing: 180,
  edgeSpacing: 20,
  snapToGrid: true,
  gridSize: 20,
  strategyId: "client-server",
};
```

Implement these focused helpers:

```ts
type PrimaryRole = "client" | "service" | "domain" | "persistence";

interface ExternalAffinity {
  readonly nodeId: string;
  readonly callerIds: string[];
  readonly primaryCallerId: string | null;
  readonly anchorRole: "service" | "domain";
}

const PRIMARY_ROLES: PrimaryRole[] = ["client", "service", "domain", "persistence"];
```

- `sanitizeGeometry(input)` mirrors Event-Driven recovery for finite positive dimensions, non-negative spacing, and positive grid size.
- `topLevelEdges(nodes, edges)` sorts and retains only top-level endpoints.
- `columnStep(nodes, options)` reserves maximum width plus `nodeSpacing + rankSpacing`, rounded up to the active grid.
- `stackColumn(nodes, x, startY, options)` sorts by ID and reserves each node's actual height plus `nodeSpacing`, rounding cell boundaries up to the grid.
- `buildExternalAffinities(assignments, edges)` chooses service callers before domain callers, then stable ID; orphan externals use the service anchor.
- `positionClientServer(...)` places primary columns, support stacks grouped by anchor role, and an unclassified review lane beneath the support extent.
- `normalizePositions(...)` adds a 40px margin and preserves grid alignment.
- `roleSummary`, `missingTierDiagnostics`, and affinity diagnostics return stable diagnostic order.
- `buildResult(...)` returns unchanged edges, semantic assignments, `engine: "custom"`, and `evaluateLayoutQuality`.

`layoutClientServer` must:

1. sanitize geometry;
2. split sorted top-level and child nodes;
3. build hierarchy diagnostics;
4. return unchanged input with `client-server-no-top-level-nodes` when empty;
5. call `inferClientServerRoles` on top-level nodes and edges;
6. append shared semantic diagnostics, role summary, missing-tier, affinity, orphan, unclassified, and recovery diagnostics in stable order;
7. position only top-level nodes;
8. append unchanged children; and
9. return semantic roles and quality metrics.

- [ ] **Step 4: Run geometry tests and verify GREEN**

Run:

```bash
bun run test:run test/core/effects/client-server-layout-strategy.test.ts test/core/effects/architecture-role-classification.test.ts
```

Expected: both suites pass with zero overlaps and deterministic output.

- [ ] **Step 5: Commit geometry**

```bash
git add src/core/effects/client-server-layout-strategy.ts test/core/effects/client-server-layout-strategy.test.ts
git commit -m "feat: add client-server semantic geometry"
```

---

### Task 3: Preset, Registry, and Preview Integration

**Files:**
- Modify: `src/core/effects/layout-strategy-registry.ts`
- Modify: `src/core/effects/layout.ts`
- Modify: `test/core/effects/client-server-layout-strategy.test.ts`
- Modify: `test/core/effects/layout-preview.test.ts`

**Interfaces:**
- Consumes: `clientServerLayoutStrategy`
- Produces: `getPreset("clientServer").strategyId === "client-server"`
- Produces: correction-compatible Client-Server semantic previews

- [ ] **Step 1: Add failing routing and correction tests**

Add to the Client-Server strategy suite:

```ts
it("routes the Client-Server preset without Dagre fallback", () => {
  const graph = clientServerGraph();
  const options = getPreset("clientServer");
  const result = calculateLayout(graph.nodes, graph.edges, options);
  const baseline = dagreLayoutStrategy.layout({ ...graph, options });
  expect(options.strategyId).toBe("client-server");
  expect(result).toMatchObject({ strategyId: "client-server", engine: "custom" });
  expect(result.nodes.map(({ position }) => position)).not.toEqual(baseline.nodes.map(({ position }) => position));
  expect(result.diagnostics.map(({ code }) => code)).not.toContain("layout-strategy-fallback");
});
```

Add to `layout-preview.test.ts`:

```ts
it("recomputes a corrected Client-Server role without mutating the source graph", () => {
  const graph = fixture("client-server");
  const source = graph.nodes.find(({ id }) => id === "command-handler")!;
  const preview = createLayoutPreview({ ...graph, preset: "clientServer", scope: "graph" });
  const corrected = correctLayoutPreviewRole(preview, source.id, "domain");

  expect(source.data.layoutRole).toBeUndefined();
  expect(corrected.result.nodes.find(({ id }) => id === source.id)?.data.layoutRole).toBe("domain");
  expect(corrected.result.semanticRoles?.find(({ nodeId }) => nodeId === source.id))
    .toMatchObject({ role: "domain", confidence: 1, source: "explicit" });
});
```

- [ ] **Step 2: Run integration tests and verify RED**

Run:

```bash
bun run test:run test/core/effects/client-server-layout-strategy.test.ts test/core/effects/layout-preview.test.ts
```

Expected: FAIL because the preset still has no strategy ID and the registry does not expose `client-server`.

- [ ] **Step 3: Register and route the strategy**

In `layout-strategy-registry.ts`:

```ts
import { clientServerLayoutStrategy } from "./client-server-layout-strategy";
```

Add `[clientServerLayoutStrategy.id, clientServerLayoutStrategy]` to `synchronousStrategies`.

In `layout.ts`, change the preset to:

```ts
clientServer: {
  strategyId: "client-server",
  direction: "LR" as const,
  rankSpacing: 180,
  nodeSpacing: 120,
},
```

- [ ] **Step 4: Run integration and shared semantic regression tests**

Run:

```bash
bun run test:run \
  test/core/effects/client-server-layout-strategy.test.ts \
  test/core/effects/layout-preview.test.ts \
  test/core/effects/layout-strategy.test.ts \
  test/core/effects/hexagonal-layout-strategy.test.ts \
  test/core/effects/event-driven-layout-strategy.test.ts
```

Expected: all suites pass. Update only obsolete Client-Server Dagre snapshots if the baseline suite directly snapshots the preset through Dagre; do not rewrite unrelated snapshots.

- [ ] **Step 5: Commit integration**

```bash
git add src/core/effects/layout-strategy-registry.ts src/core/effects/layout.ts test/core/effects/client-server-layout-strategy.test.ts test/core/effects/layout-preview.test.ts
git commit -m "feat: route client-server semantic layout"
```

---

### Task 4: Roadmap Reconciliation

**Files:**
- Modify: `docs/src/content/docs/overview/intelligent-layout-roadmap.md`

**Interfaces:**
- Consumes: verified Tasks 1-3 behavior and test evidence
- Produces: Slice 40 delivery record and the native Client-Server baseline next slice

- [ ] **Step 1: Update current status and Phase 4 markers**

In the roadmap:

- mark Client-Server columns complete in Phase 4;
- change the P1 milestone status to show Client-Server semantic geometry shipped and native baselines open;
- update Current Regroup to state Hexagonal, Event-Driven, and Client-Server semantic strategies are shipped; and
- retain OPY/Rig exposure until inference/correction evaluation is complete.

- [ ] **Step 2: Add Slice 40 delivery record**

Append:

```md
### Slice 40 Delivery Record

**Completed**: 2026-07-12

Delivered:

- [x] Added schema-validated deterministic Client-Server role inference with explicit, type, label, topology, and fallback evidence.
- [x] Preserved missing tiers without invented role assignments and surfaced semantic mismatch and ambiguity diagnostics.
- [x] Added custom client, service/API, domain, and persistence columns with caller-affined external support and a separate review lane.
- [x] Preserved child coordinates, hierarchy diagnostics, grid-safe spacing, zero-overlap fixtures, and input-order determinism.
- [x] Routed the Client-Server preset through the custom strategy and reused the existing correction, preview, Apply, persistence, and audit boundaries.

Next slice:

- [ ] Add inferred and corrected Client-Server native desktop and narrow visual fixtures.
- [ ] Capture and visually review custom Client-Server desktop and narrow baselines.
- [ ] Evaluate Client-Server inference confidence and correction frequency before exposing role evidence to OPY/Rig.
```

- [ ] **Step 3: Verify the docs app**

Run:

```bash
bun run docs:check
bun run docs:build
```

Expected: Starlight checks and build exit `0`.

- [ ] **Step 4: Commit roadmap**

```bash
git add docs/src/content/docs/overview/intelligent-layout-roadmap.md
git commit -m "docs: record client-server semantic layout"
```

---

### Task 5: Full Release Gates

**Files:**
- Verify only; modify only defects attributable to Tasks 1-4.

**Interfaces:**
- Consumes: all classifier, geometry, integration, and roadmap changes
- Produces: release-candidate evidence

- [ ] **Step 1: Run frontend tests**

```bash
bun run test:run
```

Expected: all Vitest suites pass.

- [ ] **Step 2: Run lint and guard rules**

```bash
bun run lint
bun run lint:guards
```

Expected: both commands exit `0`.

- [ ] **Step 3: Run frontend and docs builds**

```bash
bun run build
bun run docs:check
bun run docs:build
```

Expected: all commands exit `0` with zero diagnostics from changed files.

- [ ] **Step 4: Run unused-code analysis**

```bash
bun run knip
```

Expected: no findings.

- [ ] **Step 5: Verify worktree hygiene**

```bash
git diff --check
git status --short
```

Expected: no unstaged tracked changes after the four task commits. If a gate exposes an attributable defect, fix it test-first, rerun the focused and failed gates, and commit a narrowly scoped correction.
