# Client-Server Native Visual Baselines Design

**Date:** 2026-07-13
**Status:** Approved for planning

## Objective

Protect the custom Client-Server semantic layout with reviewed native Tauri baselines. Add paired inferred and corrected fixtures that make role correction visibly move one node while leaving the rest of the graph, support affinity, and layout strategy unchanged.

## Fixture Contract

Replace the legacy `client-server` ELK fixture with two deterministic fixtures:

- `client-server-inferred`;
- `client-server-corrected`.

Both fixtures use `preset: "clientServer"` and share the same nodes and edges. The graph contains representative client, service/API, domain, persistence, and external-dependency nodes so all primary columns and the lower support lane remain visible.

The shared graph also contains one deliberately ambiguous generic component. In the inferred fixture it remains unclassified and appears in the review lane. In the corrected fixture the same node carries one valid Client-Server `data.layoutRole` correction and moves into its assigned primary column. No other fixture data changes between the two states.

The correction demonstrates the existing production role-correction contract; it does not introduce fixture-only layout behavior or bypass the Client-Server strategy.

## Harness Integration

Extend `LayoutVisualFixtureName`, fixture recognition, and native capture scenario validation with both names. Remove the legacy `client-server` fixture name once all capture references and tests use the inferred/corrected pair.

Both fixtures must:

- remain clone-isolated;
- carry no persisted diagram ID;
- open the Client-Server preset automatically;
- retain identical node and edge IDs across inferred and corrected states; and
- avoid modifying persisted user diagrams.

The capture harness continues to reject unknown scenario names and validate native viewport dimensions before writing output.

## Captures

Capture and promote exactly four native Tauri images:

- `client-server-inferred-desktop.png` at `1600x900`;
- `client-server-inferred-narrow.png` at `960x720`;
- `client-server-corrected-desktop.png` at `1600x900`;
- `client-server-corrected-narrow.png` at `960x720`.

Capture disposable files first. Promote them into `tests/__snapshots__/visual/tauri-layout` only after all four pass visual inspection and exact-dimension validation.

## Visual Acceptance

The inferred images must show:

- distinct left-to-right client, service/API, domain, and persistence columns;
- the ambiguous component in the separate review lane;
- an external dependency in the lower support lane, exactly horizontally centred beneath its deterministic caller;
- Client-Server custom-engine identity, semantic evidence, and diagnostics in the preview drawer.

The corrected images must use the same graph and show:

- only the corrected component moving from the review lane into its assigned primary column;
- corrected-role evidence replacing the prior ambiguity for that node;
- unchanged primary ordering and external support affinity; and
- no new overlap, clipping, or incoherent whitespace.

At both viewport sizes, the canvas, preview drawer, role evidence, diagnostics, and Apply/Cancel controls must remain legible and non-overlapping. Exact support centring is evaluated from actual node centres, not left-edge grid alignment.

## Testing and Verification

Focused fixture tests must prove:

- both fixture names are recognized and clone-isolated;
- both select `clientServer`;
- both contain identical node and edge IDs;
- only the intended node's `layoutRole` differs;
- the inferred node is unclassified and the corrected node receives the explicit role;
- deterministic layout moves only that node between semantic lanes while preserving external support centring; and
- unknown fixture names remain rejected.

After capture promotion, run the full frontend test suite, lint, guard lint, frontend build, Knip, Rust tests, Clippy with warnings denied, Starlight checks/build, and image-dimension validation. Visually inspect all four promoted images.

## Roadmap Reconciliation

Record Slice 41 as complete only after the four native images are captured, dimension-validated, and visually approved. The next slice is Client-Server inference-confidence and correction-frequency evaluation before role evidence is exposed to OPY/Rig.

## Non-Goals

- Client-Server classifier or geometry changes;
- a dense-support stress fixture;
- new role-correction UI;
- OPY/Rig role-evidence tools;
- automated pixel-diff infrastructure;
- persistence or migration changes; and
- changes to Hexagonal, Event-Driven, ELK, radial, or Dagre layouts.
