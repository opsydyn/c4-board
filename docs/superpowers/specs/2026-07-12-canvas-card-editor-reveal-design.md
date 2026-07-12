# Canvas Card Editor Reveal Design

**Date:** 2026-07-12
**Status:** Approved

## Goal

Make node editing discoverable by opening the right properties panel when a user selects a node card on the canvas.

## Interaction

A single click on an editable canvas node card will:

1. select the node through the existing `SELECT_NODE` canvas-machine event; and
2. reveal the right details panel when the workspace can display it.

The existing `PropertiesPanel` already enters node-editing mode when `selectedNode` is present. This slice does not add a second edit state, modal, or form lifecycle.

Double-click keeps its existing behavior: the node remains selected and the canvas recenters on it at the current zoom and animation settings. Opening the editor is a consequence of the card-selection click path, not a replacement for the double-click camera interaction.

## Scope Boundaries

Only direct canvas-card selection reveals the editor. The following selection paths keep their current behavior:

- search results;
- Balanced Mud Chart module selection;
- OPY or other programmatic selection; and
- machine events dispatched outside the canvas-card click handler.

The panel reveal is suppressed when:

- compact responsive layout is active at widths of `1200px` or less; or
- layout preview is active or still resolving.

These guards prevent an invisible panel state from reopening unexpectedly after a resize and preserve the layout preview's read-only review surface.

## Implementation Boundary

Keep the behavior in `C4CanvasContainer`, where node selection and right-panel visibility already meet. Extend the memoized canvas `onNodeClick` handler to select the node and conditionally call `setDetailsOpen(true)`.

Extract a small pure reveal-policy function that accepts compact-layout and layout-preview state. This keeps responsive/read-only rules explicit and gives the interaction focused unit coverage without introducing a new state machine event or a global selection effect.

Do not change `C4Canvas` double-click handling, `PropertiesPanel` form behavior, or canvas-machine selection semantics.

## Testing

Add focused policy tests covering:

1. normal desktop canvas selection reveals details;
2. compact layout suppresses the reveal;
3. an active layout preview suppresses the reveal; and
4. a resolving layout preview suppresses the reveal.

Run the focused component-policy test, the existing canvas-machine selection tests, the full Vitest suite, lint guards for `C4CanvasContainer`, and the frontend build.

## Acceptance Criteria

1. Clicking a canvas node card selects it and opens the right properties editor on desktop.
2. Search, chart, OPY, and programmatic selections do not gain automatic panel reveal behavior.
3. Compact and layout-preview modes do not reveal the panel.
4. Double-click still recenters and zooms exactly as before.
5. Existing node editing, selection, responsive, and layout-preview behavior remains green.
