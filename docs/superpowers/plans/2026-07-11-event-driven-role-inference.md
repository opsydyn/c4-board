# Event-Driven Role Inference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic, explainable Event-Driven publisher, bus, processor, subscriber, infrastructure, external-dependency, and unclassified role inference.

**Architecture:** Extend the existing shared architecture-role classifier with a second pattern-specific evidence cascade. First identify event buses from explicit roles and direct labels, then classify sorted nodes from explicit role, semantic label/type, bus adjacency, and onward topology before schema-validating the result through the existing contract.

**Tech Stack:** TypeScript, Effect Schema, React Flow `Node`/`Edge`, Vitest, Bun, Starlight Markdown

## Global Constraints

- Classification only; Event-Driven lane placement and edge routing remain out of scope.
- A valid explicit `data.layoutRole` wins with confidence `1`.
- Evidence precedence is explicit role, unambiguous event-specific label or node type, directed topology for flow-role semantics, compatible fallback labels, then `unclassified`.
- A processor consumes from an event bus and emits a subsequent event or command; a subscriber consumes from a bus without publishing onward.
- Cross-pattern explicit roles emit `semantic-role-pattern-mismatch` and fall through to Event-Driven inference.
- Assignments below confidence `0.65` emit `semantic-role-ambiguous`.
- Sort assignments and diagnostics by node ID so reversing node and edge inputs returns an identical result.
- Decode the complete result through `ArchitectureRoleClassificationSchema`.
- Do not add dependencies, persistence migrations, preview UI changes, probabilistic scoring, or OPY/Rig classification.

---

### Task 1: Event-Driven Evidence Cascade

**Files:**
- Modify: `test/core/effects/architecture-role-classification.test.ts`
- Modify: `src/core/effects/architecture-role-classification.ts`
- Modify: `docs/src/content/docs/overview/intelligent-layout-roadmap.md`

**Interfaces:**
- Consumes: `ArchitectureRoleClassification`, `ArchitectureRoleClassificationSchema`, `ArchitectureRoleDiagnosticSchema`, `buildTopology`, `nodeLabel`, `nodeType`, and `explicitRole` from the existing classifier module.
- Produces: `inferEventDrivenRoles(nodes: ReadonlyArray<Node>, edges: ReadonlyArray<Edge>): ArchitectureRoleClassification`.

- [ ] **Step 1: Add the representative Event-Driven fixture helper and failing grounded-classification test**

In `test/core/effects/architecture-role-classification.test.ts`, import `inferEventDrivenRoles` and add a local fixture whose topology distinguishes continuing processors from terminal subscribers:

```ts
const eventDrivenFixture = () => ({
  nodes: [
    { id: "orders-publisher", type: "container", position: { x: 0, y: 0 }, data: { label: "Orders Publisher" } },
    { id: "orders-bus", type: "system", position: { x: 0, y: 0 }, data: { label: "Orders Event Bus" } },
    { id: "fraud-handler", type: "component", position: { x: 0, y: 0 }, data: { label: "Fraud Handler" } },
    { id: "audit-consumer", type: "component", position: { x: 0, y: 0 }, data: { label: "Audit Consumer" } },
    { id: "notification-listener", type: "component", position: { x: 0, y: 0 }, data: { label: "Notification Listener" } },
    { id: "telemetry", type: "component", position: { x: 0, y: 0 }, data: { label: "Telemetry" } },
    { id: "payment-provider", type: "externalSystem", position: { x: 0, y: 0 }, data: { label: "Payment Provider" } },
  ],
  edges: [
    { id: "publish", source: "orders-publisher", target: "orders-bus", label: "order event" },
    { id: "process", source: "orders-bus", target: "fraud-handler", label: "order event" },
    { id: "continue", source: "fraud-handler", target: "audit-consumer", label: "audit command" },
    { id: "notify", source: "orders-bus", target: "notification-listener", label: "order event" },
  ],
});
```

Add a test asserting this complete role map, non-empty evidence, no diagnostics, and schema validity:

```ts
it("classifies representative Event-Driven roles with grounded evidence", () => {
  const fixture = eventDrivenFixture();
  const result = inferEventDrivenRoles(fixture.nodes, fixture.edges);

  expect(Object.fromEntries(result.assignments.map(({ nodeId, role }) => [nodeId, role]))).toEqual({
    "audit-consumer": "subscriber",
    "fraud-handler": "processor",
    "notification-listener": "subscriber",
    "orders-bus": "event-bus",
    "orders-publisher": "publisher",
    "payment-provider": "external-dependency",
    telemetry: "infrastructure",
  });
  expect(result.assignments.every(({ confidence, evidence }) => confidence >= 0.65 && evidence.length > 0)).toBe(true);
  expect(result.diagnostics).toEqual([]);
  expect(() => Schema.decodeUnknownSync(ArchitectureRoleClassificationSchema)(result)).not.toThrow();
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
bunx vitest run test/core/effects/architecture-role-classification.test.ts
```

Expected: FAIL because `inferEventDrivenRoles` is not exported.

- [ ] **Step 3: Implement bus discovery and the minimal Event-Driven classifier**

In `src/core/effects/architecture-role-classification.ts`:

1. Add `const EVENT_DRIVEN_ROLES = ROLES_BY_PATTERN["event-driven"];`.
2. Add a stable helper that considers a node a bus when it has a valid explicit `event-bus` role or its normalized label matches `/(event[-_\s]?bus|broker|queue|topic|stream)/`.
3. Add `inferEventDrivenRole(node, busIds, topology): InferredRole` using this exact precedence:

```ts
const explicit = explicitRole(node);
if (explicit && EVENT_DRIVEN_ROLES.has(explicit)) {
  return { role: explicit, confidence: 1, source: "explicit", evidence: [`Explicit role '${explicit}'.`] };
}

const mismatch = explicit && !EVENT_DRIVEN_ROLES.has(explicit) ? explicit : undefined;
const label = nodeLabel(node);
const type = nodeType(node);
const relation = topology.get(node.id);
const publishesToBus = [...(relation?.outbound ?? [])].some(id => busIds.has(id));
const consumesFromBus = [...(relation?.inbound ?? [])].some(id => busIds.has(id));
const hasOnwardOutput = (relation?.outbound.size ?? 0) > 0;
```

Apply rules in this order and include `...(mismatch && { patternMismatch: mismatch })` on every inferred return:

- Bus candidate: `event-bus`, confidence `0.95`, source `label`, evidence `Event bus, broker, queue, topic, or stream label.`
- Infrastructure label `/(database|db|cache|telemetry|logging|metrics|monitoring)/`: `infrastructure`, confidence `0.85`, source `label`.
- `type === "externalSystem"`: `external-dependency`, confidence `0.8`, source `node-type`.
- Publisher label `/(publisher|producer|event[-_\s]?source)/` or `publishesToBus`: `publisher`, confidence `0.85` for label evidence and `0.8` for topology-only evidence.
- Unambiguous processor label `/(processor|transformer|projector|workflow)/`: `processor`, confidence `0.8`, source `label`.
- `consumesFromBus && hasOnwardOutput`: `processor`, confidence `0.85`, source `topology`, regardless of handler/consumer naming.
- `consumesFromBus && !hasOnwardOutput`: `subscriber`, confidence `0.85`, source `topology`.
- Compatible subscriber label `/(subscriber|consumer|listener|sink)/` with no onward output: `subscriber`, confidence `0.8`, source `label`.
- Otherwise: `unclassified`, confidence `0.25`, source `fallback`, evidence `No grounded Event-Driven role evidence was found.`

Export `inferEventDrivenRoles` with the same result-building shape as `inferHexagonalRoles`, but set `pattern: "event-driven"` and use these messages:

```ts
`Explicit role '${result.patternMismatch}' is not valid for Event-Driven classification.`
`Node '${node.id}' has no confident Event-Driven role assignment.`
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
bunx vitest run test/core/effects/architecture-role-classification.test.ts
```

Expected: all existing Hexagonal tests and the representative Event-Driven test PASS.

- [ ] **Step 5: Add failing tests for explicit precedence, mismatch fallback, ambiguity, and input-order stability**

Add four focused tests:

```ts
it("keeps valid explicit Event-Driven roles authoritative", () => {
  const fixture = eventDrivenFixture();
  const node = fixture.nodes.find(({ id }) => id === "notification-listener")!;
  node.data = { ...node.data, layoutRole: "processor" };

  const assignment = inferEventDrivenRoles(fixture.nodes, fixture.edges).assignments
    .find(({ nodeId }) => nodeId === node.id)!;

  expect(assignment).toMatchObject({ role: "processor", confidence: 1, source: "explicit" });
});

it("falls through after contradictory explicit Event-Driven role evidence", () => {
  const fixture = eventDrivenFixture();
  const node = fixture.nodes.find(({ id }) => id === "orders-publisher")!;
  node.data = { ...node.data, layoutRole: "core" };

  const result = inferEventDrivenRoles(fixture.nodes, fixture.edges);
  expect(result.assignments.find(({ nodeId }) => nodeId === node.id)?.role).toBe("publisher");
  expect(result.diagnostics.map(({ code, nodeIds }) => ({ code, nodeIds }))).toContainEqual({
    code: "semantic-role-pattern-mismatch",
    nodeIds: [node.id],
  });
});

it("reports weak Event-Driven evidence as ambiguous", () => {
  const result = inferEventDrivenRoles([
    { id: "worker", type: "component", position: { x: 0, y: 0 }, data: { label: "Worker" } },
  ], []);

  expect(result.assignments[0]).toMatchObject({ role: "unclassified", confidence: 0.25, source: "fallback" });
  expect(result.diagnostics.map(({ code }) => code)).toEqual(["semantic-role-ambiguous"]);
});

it("keeps Event-Driven inference stable across input order", () => {
  const fixture = eventDrivenFixture();
  const forward = inferEventDrivenRoles(fixture.nodes, fixture.edges);
  const reversed = inferEventDrivenRoles([...fixture.nodes].reverse(), [...fixture.edges].reverse());

  expect(reversed).toEqual(forward);
});
```

- [ ] **Step 6: Run the focused test and verify RED or validate existing implementation**

Run:

```bash
bunx vitest run test/core/effects/architecture-role-classification.test.ts
```

Expected: any uncovered precedence, mismatch, ambiguity, or ordering behavior FAILS for the named reason. If all tests pass, confirm each assertion exercises the production classifier rather than a test helper, then continue without adding speculative code.

- [ ] **Step 7: Complete only the behavior required by the failing tests and refactor shared result construction**

Fix uncovered behavior in `inferEventDrivenRole` or `inferEventDrivenRoles`. If Hexagonal and Event-Driven result assembly are now duplicated, extract this private helper without changing either public signature:

```ts
const buildClassification = (
  pattern: ArchitecturePattern,
  inferred: ReadonlyArray<{ node: Node; result: InferredRole }>,
  patternName: string,
): ArchitectureRoleClassification => {
  // Build sorted assignments and diagnostics, then decode with
  // ArchitectureRoleClassificationSchema.
};
```

Keep pattern-specific inference functions independent. Do not introduce generic weighted rules or geometry concerns.

- [ ] **Step 8: Run focused tests and the complete project gates**

Run each command separately:

```bash
bunx vitest run test/core/effects/architecture-role-classification.test.ts
bun run test:run
bun run lint
bun run build
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: focused tests PASS; all Vitest files PASS; ESLint exits `0`; Astro check reports `0 errors`, `0 warnings`, and `0 hints`; Astro build completes; Cargo check exits `0`.

- [ ] **Step 9: Record Slice 37 in the intelligent-layout roadmap**

In `docs/src/content/docs/overview/intelligent-layout-roadmap.md`:

- Mark Event-Driven publisher, bus, processor, and subscriber inference complete in Phase 4 and Slice 36's next-slice list.
- Add `### Slice 37 Delivery Record` dated `2026-07-11`.
- Record the evidence cascade, semantic processor/subscriber distinction, explicit override and mismatch behavior, deterministic ordering, schema validation, and focused test coverage.
- Set the next slice to deterministic Event-Driven publisher, bus, processor, and subscriber lane geometry, followed by native visual baselines.

Run:

```bash
bun run build
```

from `docs/` and expect the Starlight build and Pagefind index to complete.

- [ ] **Step 10: Review and commit the implementation slice**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Confirm only the classifier, its tests, and the roadmap changed. Then commit:

```bash
git add src/core/effects/architecture-role-classification.ts test/core/effects/architecture-role-classification.test.ts docs/src/content/docs/overview/intelligent-layout-roadmap.md
git commit -m "feat: infer event-driven semantic roles"
```
