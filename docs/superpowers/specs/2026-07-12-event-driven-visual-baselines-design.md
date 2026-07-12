# Event-Driven Native Visual Baselines Design

**Date:** 2026-07-12
**Status:** Approved for planning

## Objective

Protect the custom Event-Driven semantic layout with reviewed native Tauri
baselines. Replace the existing Event-Driven ELK images with the custom single-bus
layout and add a dedicated multi-bus bridge scenario that exercises the strategy's
distinctive geometry.

## Fixture Contract

### Representative Event-Driven

Keep the existing `event-driven` fixture name, but change its intended preset from
`elkLayered` to `eventDriven`. The fixture contains multiple publishers, one event
bus, a continuing processor, terminal subscribers, and infrastructure. Explicit
semantic roles may be used where they make the visual state deterministic without
bypassing the production layout strategy.

This scenario replaces the tracked files:

- `event-driven-desktop.png`
- `event-driven-narrow.png`

### Event-Driven Bridges

Add `event-driven-bridges` as a second deterministic fixture using
`preset: "eventDriven"`. Its three bus bands must visibly exercise:

- adjacent bridge processors;
- one non-adjacent bridge;
- multiple bridge groups sharing one source bus;
- one bus-local processor;
- terminal subscribers;
- infrastructure or external-dependency support nodes;
- at least one unclassified review-lane node.

Explicit `data.layoutRole` assignments are appropriate for this stress fixture
because its purpose is to protect geometry after classification has already been
covered independently.

This scenario adds:

- `event-driven-bridges-desktop.png`
- `event-driven-bridges-narrow.png`

## Harness Integration

Extend `LayoutVisualFixtureName`, fixture recognition, and native capture scenario
validation with `event-driven-bridges`. Both fixtures remain clone-isolated,
carry no diagram ID, open their intended preset automatically, and cannot modify
persisted user diagrams.

The harness must continue to reject unknown fixture/scenario names and validate
the requested native viewport dimensions before writing output.

## Visual Acceptance

Capture disposable images first and inspect all four before baseline promotion.

The representative images must show:

- left-to-right publisher, bus, processor, and subscriber ordering;
- the support lane below the event-flow band;
- Event-Driven semantic-role evidence and custom-engine identity in the preview.

The bridge images must show:

- three vertically separated bus-centred bands;
- bridge processors on distinct processor sub-tracks;
- local processors separated from bridges;
- subscriber clearance to the right of all bridge tracks;
- support and review lanes below the bus bands;
- no clipped drawer controls, incoherent overlap, or blank canvas regions caused
  by failed rendering.

Inspect desktop at `1600x900` and narrow at `960x720`. Promote only images captured
at the exact requested dimensions.

## Testing and Verification

Focused fixture tests must prove:

- both Event-Driven fixtures select `eventDriven`;
- `event-driven-bridges` is recognized and cloned;
- bridge fixture roles survive cloning;
- the bridge fixture contains three event buses, adjacent and non-adjacent
  processor-to-bus relationships, support nodes, and a review node.

After visual inspection and promotion, run the full frontend tests, lint, frontend
build, Rust check, and Starlight docs build. Record Slice 39 in the intelligent
layout roadmap and make Client-Server semantic inference and deterministic
columns the next implementation slice.

## Non-Goals

- changes to Event-Driven classification or geometry;
- automated pixel-diff infrastructure;
- Client-Server implementation;
- layout preview UI changes;
- persistence or migration changes;
- OPY/Rig classification or custom layout authoring.
