# Azure Sync Property Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one replayable property-based idempotence test for Azure graph reconciliation in TypeScript and one for Azure scope normalization in Rust.

**Architecture:** Exercise the existing pure boundaries without introducing shared property-test infrastructure. The TypeScript property imports FastCheck through Effect and repeatedly applies one generated mapped graph with a fixed timestamp; the Rust property uses proptest beside the private normalization function and normalizes generated noisy scopes twice.

**Tech Stack:** Effect 3 `effect/FastCheck`, Vitest 4, Rust 2021, proptest 1, Cargo

## Global Constraints

- Create exactly one TypeScript property suite named `azure-sync.apply.property.test.ts`.
- Use FastCheck through Effect's `effect/FastCheck` export; do not add a direct `fast-check` dependency.
- Add `proptest` only under Rust `[dev-dependencies]`.
- Use bounded generators and default shrink/replay reporting suitable for ordinary CI.
- Use a fixed `syncedAt` for reconciliation so timestamps do not mask graph drift.
- Do not change production behavior unless a generated counterexample proves a defect.
- Promote any discovered counterexample to a deterministic regression test before fixing production code.

---

### Task 1: TypeScript Azure Reconciliation Property

**Files:**
- Create: `src/core/effects/azure-sync.apply.property.test.ts`

**Interfaces:**
- Consumes: `mergeAzureMappedGraphIntoCanvas(input: { nodes; edges; mapped; syncedAt? }): { nodes; edges }` from `src/core/effects/azure-sync.apply.ts`
- Consumes: `AzureMappedGraph` and `AzureMappedNode` from `src/core/effects/azure-sync.mapper.ts`
- Produces: a Vitest property proving that a second unchanged reconciliation is exactly equal to the first

- [ ] **Step 1: Add the generated graph fixture and an intentionally inverted property**

Create `src/core/effects/azure-sync.apply.property.test.ts` with this complete initial content:

```ts
import type { Edge, Node } from "@xyflow/react";
import * as FastCheck from "effect/FastCheck";
import { describe, expect, it } from "vitest";
import { mergeAzureMappedGraphIntoCanvas } from "./azure-sync.apply";
import type { AzureMappedGraph, AzureMappedNode } from "./azure-sync.mapper";

const SYNCED_AT = 1_700_000_000_000;

const syncCaseArbitrary = FastCheck.tuple(
  FastCheck.uniqueArray(
    FastCheck.stringMatching(/^[a-z][a-z0-9]{0,8}$/),
    { minLength: 1, maxLength: 6 },
  ),
  FastCheck.boolean(),
  FastCheck.boolean(),
).map(([slugs, includeExisting, includeStale]) => {
  const nodes: AzureMappedNode[] = slugs.map((slug, index) => ({
    id: `azure:/subscriptions/sub/resourcegroups/rg/providers/microsoft.web/sites/${slug}`,
    type: index % 2 === 0 ? "component" : "system",
    label: slug,
    technology: index % 2 === 0 ? "microsoft.web/sites" : "microsoft.storage/storageaccounts",
    description: `${slug} @ westeurope`,
    sourceResourceId: `/subscriptions/sub/resourcegroups/rg/providers/microsoft.web/sites/${slug}`,
    sourceResourceType: index % 2 === 0
      ? "microsoft.web/sites"
      : "microsoft.storage/storageaccounts",
  }));
  const edges = nodes.slice(1).map((node, index) => ({
    id: `azure-edge:${slugs[index]}-${slugs[index + 1]}`,
    source: nodes[index]!.id,
    target: node.id,
    label: "depends_on",
    relationshipType: "depends_on",
    confidence: "high",
    provenanceSource: "arm_depends_on" as const,
    provenanceDetail: "dependsOn",
  }));
  return { mapped: { nodes, edges }, includeExisting, includeStale };
});

const existingCanvas = (
  mapped: AzureMappedGraph,
  includeExisting: boolean,
  includeStale: boolean,
): { nodes: Node[]; edges: Edge[] } => {
  const manual: Node = {
    id: "manual-system",
    type: "system",
    position: { x: 0, y: 0 },
    data: { label: "Manual", description: "", technology: "", c4Type: "system" },
  };
  const stale: Node = {
    id: "azure:/subscriptions/sub/resourcegroups/rg/providers/microsoft.web/sites/stale",
    type: "component",
    position: { x: 320, y: 200 },
    data: {
      label: "Stale",
      description: "stale",
      technology: "microsoft.web/sites",
      c4Type: "component",
      sourceProvider: "azure",
    },
  };
  const existingMapped = (includeExisting ? mapped.nodes : [])
    .filter((_, index) => index % 2 === 0)
    .map((node, index): Node => ({
      id: node.id,
      type: node.type,
      position: { x: 640 + index * 240, y: 160 },
      data: {
        label: `old-${node.label}`,
        description: "old",
        technology: "old",
        c4Type: node.type,
        sourceProvider: "azure",
      },
    }));

  return {
    nodes: [manual, ...(includeStale ? [stale] : []), ...existingMapped],
    edges: [
      { id: "manual-edge", source: manual.id, target: manual.id, label: "manual" },
      ...(includeStale ? [{
        id: "azure-edge:stale",
        source: stale.id,
        target: mapped.nodes[0]!.id,
        label: "depends_on",
      }] : []),
    ],
  };
};

describe("Azure sync reconciliation properties", () => {
  it("is idempotent for an unchanged mapped graph", () => {
    FastCheck.assert(
      FastCheck.property(syncCaseArbitrary, ({ mapped, includeExisting, includeStale }) => {
        const initial = existingCanvas(mapped, includeExisting, includeStale);
        const first = mergeAzureMappedGraphIntoCanvas({ ...initial, mapped, syncedAt: SYNCED_AT });
        const second = mergeAzureMappedGraphIntoCanvas({ ...first, mapped, syncedAt: SYNCED_AT });

        expect(second).not.toEqual(first);
      }),
      { numRuns: 100 },
    );
  });
});
```

- [ ] **Step 2: Run the property and verify RED**

Run:

```bash
bun run test:run src/core/effects/azure-sync.apply.property.test.ts
```

Expected: FAIL at `expect(second).not.toEqual(first)` with FastCheck seed/path and a shrunk mapped-graph counterexample. If the failure instead comes from fixture construction or a runtime exception, correct the generator and rerun until the inverted idempotence assertion is the failure.

- [ ] **Step 3: Restore the approved idempotence assertion**

Replace:

```ts
expect(second).not.toEqual(first);
```

with:

```ts
expect(second).toEqual(first);
```

- [ ] **Step 4: Run the property and verify GREEN**

Run:

```bash
bun run test:run src/core/effects/azure-sync.apply.property.test.ts
```

Expected: PASS for one test after 100 generated cases. If FastCheck finds a product counterexample, add its minimal shrunk case to `src/core/effects/azure-sync.apply.test.ts`, observe that regression test fail, then make the smallest production fix before rerunning this property.

- [ ] **Step 5: Commit the TypeScript property**

```bash
git add src/core/effects/azure-sync.apply.property.test.ts src/core/effects/azure-sync.apply.test.ts src/core/effects/azure-sync.apply.ts
git commit -m "test: harden azure reconciliation properties"
```

Only stage the two existing files in that command if a real counterexample required a deterministic regression and production fix.

---

### Task 2: Rust Azure Scope Normalization Property

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Modify: `src-tauri/src/azure_sync.rs`

**Interfaces:**
- Consumes: private `normalize_scope(scope: AzureSyncScopeDto) -> AzureSyncScopeDto`
- Produces: an in-module proptest proving that normalization reaches a fixed point after one application

- [ ] **Step 1: Add proptest as a development dependency**

Append to `src-tauri/Cargo.toml`:

```toml
[dev-dependencies]
proptest = "1"
```

Run:

```bash
cargo fetch --manifest-path src-tauri/Cargo.toml
```

Expected: exit `0`; `src-tauri/Cargo.lock` records `proptest` and its transitive test-only dependencies.

- [ ] **Step 2: Add an intentionally inverted normalization property**

Append this module to `src-tauri/src/azure_sync.rs`:

```rust
#[cfg(test)]
mod property_tests {
    use super::{normalize_scope, AzureSyncScopeDto};
    use proptest::collection::{btree_map, vec};
    use proptest::prelude::*;

    fn scope_strategy() -> impl Strategy<Value = AzureSyncScopeDto> {
        let token = "[A-Fa-f0-9,; \\t\\n]{0,80}";
        let text = "[A-Za-z0-9 _-]{0,40}";

        (
            vec(token, 0..8),
            prop::option::of(vec(text, 0..8)),
            prop::option::of(btree_map(text, text, 0..8)),
            prop::option::of(text),
        )
            .prop_map(|(subscription_ids, resource_groups, tag_filters, query)| {
                AzureSyncScopeDto {
                    subscription_ids,
                    resource_groups,
                    tag_filters,
                    query,
                }
            })
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(128))]

        #[test]
        fn normalize_scope_is_idempotent(scope in scope_strategy()) {
            let once = normalize_scope(scope);
            let twice = normalize_scope(AzureSyncScopeDto {
                subscription_ids: once.subscription_ids.clone(),
                resource_groups: once.resource_groups.clone(),
                tag_filters: once.tag_filters.clone(),
                query: once.query.clone(),
            });

            prop_assert_ne!(&twice.subscription_ids, &once.subscription_ids);
            prop_assert_eq!(&twice.resource_groups, &once.resource_groups);
            prop_assert_eq!(&twice.tag_filters, &once.tag_filters);
            prop_assert_eq!(&twice.query, &once.query);
        }
    }
}
```

- [ ] **Step 3: Run the property and verify RED**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml normalize_scope_is_idempotent -- --nocapture
```

Expected: FAIL at `prop_assert_ne!` with a minimal failing input and proptest persistence/replay information. If compilation or strategy construction fails, correct the test module and rerun until the inverted assertion is the failure.

- [ ] **Step 4: Restore the approved fixed-point assertion**

Replace:

```rust
prop_assert_ne!(&twice.subscription_ids, &once.subscription_ids);
```

with:

```rust
prop_assert_eq!(&twice.subscription_ids, &once.subscription_ids);
```

- [ ] **Step 5: Run the property and verify GREEN**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml normalize_scope_is_idempotent -- --nocapture
```

Expected: PASS after 128 generated cases. If proptest finds a product counterexample, add its minimal scope as a normal `#[test]`, observe that regression fail, and make the smallest normalization fix before rerunning the property.

- [ ] **Step 6: Format and commit the Rust property**

Run:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml --all
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/azure_sync.rs
git commit -m "test: harden azure scope normalization"
```

Expected: one conventional commit containing the test-only dependency, lockfile update, and property module.

---

### Task 3: Cross-Runtime Release Gates

**Files:**
- Verify only; do not modify files unless a gate exposes a defect attributable to Tasks 1 or 2.

**Interfaces:**
- Consumes: both property suites and the repository's existing CI commands
- Produces: evidence that property hardening integrates with ordinary frontend and Rust gates

- [ ] **Step 1: Run the full frontend test suite**

Run:

```bash
bun run test:run
```

Expected: all Vitest suites pass, including `azure-sync.apply.property.test.ts`.

- [ ] **Step 2: Verify Rust formatting**

Run:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml --all --check
```

Expected: exit `0` with no formatting diff.

- [ ] **Step 3: Run Clippy with CI warning policy**

Run:

```bash
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

Expected: exit `0` with no warnings, including in the proptest module.

- [ ] **Step 4: Run locked Rust tests**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml --locked
```

Expected: all unit and property tests pass using the committed lockfile.

- [ ] **Step 5: Run unused-code and dependency analysis**

Run:

```bash
bun run knip
```

Expected: exit `0`; the new TypeScript property is discovered and no direct FastCheck dependency is required.

- [ ] **Step 6: Check the final worktree and commit any verification-only correction**

Run:

```bash
git diff --check
git status --short
```

Expected: no unstaged implementation changes after the two task commits. If a release-gate correction was required, stage only that correction and commit it with a focused `fix:`, `test:`, or `chore:` conventional subject before repeating the failed gate.
