# Azure Sync Property Hardening Design

**Date:** 2026-07-12
**Status:** Approved

## Goal

Add one high-impact property-based test at the Effect/TypeScript boundary and one at the Rust boundary. Both tests protect the Azure sync invariant that repeating unchanged work produces no additional state change.

## Scope

This slice covers:

- Azure mapped-graph reconciliation in `src/core/effects/azure-sync.apply.ts`.
- Azure scope normalization in `src-tauri/src/azure_sync.rs`.
- FastCheck through Effect's `effect/FastCheck` export.
- `proptest` as a Rust development dependency.

This slice does not add broad property-test infrastructure, benchmark property runs, exercise Azure CLI processes, or change production behavior unless a generated counterexample exposes a defect.

## TypeScript Property

Create `src/core/effects/azure-sync.apply.property.test.ts`.

The test generates bounded, internally valid Azure sync cases containing:

- unique mapped Azure nodes;
- mapped edges whose endpoints exist in the mapped node set;
- optional pre-existing and stale Azure nodes and edges;
- manual nodes and edges that reconciliation must preserve; and
- a fixed synchronization timestamp.

For each case, the test applies the mapped snapshot once, feeds that result into the same merge operation again, and asserts exact equality between the first and second canonical graph outputs. A fixed `syncedAt` prevents expected timestamp updates from obscuring graph drift.

Generators remain small enough for routine Vitest execution and use FastCheck's normal shrinking and replay metadata. IDs and relationships are generated through constrained builders so failures exercise reconciliation rather than invalid fixture construction.

## Rust Property

Add `proptest` under `[dev-dependencies]` in `src-tauri/Cargo.toml` and place the property test beside the private `normalize_scope` function in `src-tauri/src/azure_sync.rs`.

The property generates `AzureSyncScopeDto` values with noisy but bounded combinations of:

- subscription tokens separated by commas, semicolons, and ASCII whitespace;
- mixed casing and surrounding whitespace;
- optional resource-group lists;
- optional tag maps with whitespace around keys and values; and
- optional blank or populated custom queries.

It normalizes each generated scope twice and asserts field-by-field equality between the first and second results. Field comparison avoids adding equality traits to production DTOs solely for tests.

## Failure Semantics

A counterexample is a product defect when repeated reconciliation or normalization changes the output. FastCheck and proptest must retain their standard shrunk counterexample and seed information in test output so the case can be promoted to a deterministic regression test before any production fix.

Generator failures are test defects. Generated graph edges must reference generated nodes, IDs must be unique where the production contract requires uniqueness, and numeric positions must be finite.

## Verification

Run the focused properties first, then the existing project gates affected by the dependency and test additions:

```bash
bun run test:run src/core/effects/azure-sync.apply.property.test.ts
cargo test --manifest-path src-tauri/Cargo.toml azure_sync
bun run test:run
cargo fmt --manifest-path src-tauri/Cargo.toml --all --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --locked
bun run knip
```

## Acceptance Criteria

1. The TypeScript property uses FastCheck from Effect and proves reconciliation idempotence for generated valid graph cases.
2. The Rust property uses proptest and proves scope-normalization idempotence for generated noisy scopes.
3. Both properties run in ordinary local and CI test commands with bounded execution time.
4. Failing properties report shrinkable, replayable counterexamples.
5. Existing frontend and Rust test, lint, formatting, Clippy, and unused-dependency gates remain green.
