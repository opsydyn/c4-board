---
title: "ADR-011: Postee Single-Pane Workspace Layout"
---

# ADR-011: Postee Single-Pane Workspace Layout

**Status**: Accepted
**Date**: 2026-07-25
**Deciders**: Alan P Currie
**Technical Story**: The load chamber renders below the request builder, so reaching it means scrolling
the page. Postee is meant to read as a single pane of glass — like Postman — where every surface is
reachable without the window moving.

## Context

### Problem Statement

The workspace scrolls vertically as a page. The request builder, the response panel, and the load
chamber are stacked in one column, so the taller the request gets the further the load chamber sinks.
A tool whose job is to show a request and its response side by side instead shows them one after the
other, and the viewport becomes a window onto a document rather than a fixed instrument panel.

Three decisions compound to produce this:

1. **The root never commits to the viewport.** `workspace` is `minHeight: "100vh"`. `min-height`
   permits the grid to grow past the viewport, so the page itself scrolls — no amount of inner
   `overflow` discipline can prevent that.

2. **Everything shares one scrolling column.** `mainColumn` is a `flex-direction: column` with
   `overflowY: auto`, and the response area is rendered *inside* it as a sibling below the builder via
   `responseInline`. The stacking is structural, not stylistic.

3. **A side-by-side layout already exists and is not used.** `responseColumn` is styled for
   `gridColumn: "3 / 4"`, and a `max-width: 1360px` query re-stacks it to `gridColumn: "1 / -1"`. The
   third column was built and then bypassed: the JSX renders `responseInline` instead. The codebase
   currently carries both designs, and the wrong one is wired up.

### Current State

```ts
export const workspace = style({
  display: "grid",
  gridTemplateRows: "1fr",
  gridTemplateColumns: "minmax(260px, 320px) 1fr",  // two tracks; no response column
  minHeight: "100vh",                               // grows past the viewport
});

export const mainColumn = style({
  flexDirection: "column",
  overflowY: "auto",                                // one scroller holding everything
});

export const responseInline = style({
  marginTop: theme.spacing["4"],                    // …rendered below the builder
  borderTop: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
});
```

Fixed sizes that will punch through a height-constrained pane even after the shell is fixed:

| Rule | Value | File |
| ---- | ----- | ---- |
| `panel` | `minHeight: 200px` | PosteeWorkspace.css.ts:388 |
| `responseTabContent` | `minHeight: 200px` | PosteeWorkspace.css.ts:749 |
| `responseEmptyState` / `responseLoadingState` / `responseErrorState` | `minHeight: 300px` | PosteeWorkspace.css.ts |
| `chartWrapper` | `height: 180px` | PosteeWorkspace.css.ts:989 |
| Response headers viewer | `height="150px"` | ResponseViewer.tsx |

And history currently competes for the same space as the response: it is a third tab
(`activeTab === "History"`) inside the response panel rather than a surface that overlays.

### Goals

- The window never scrolls. Only designated content areas do.
- Request and response are visible **at the same time**, side by side, at a ratio the user controls.
- History is reachable without displacing either.
- No new layout dependency: `react-rnd` is already a direct dependency.

### Constraints

- Vanilla Extract with the theme contract; no inline layout values that bypass tokens.
- CLAUDE.md forbids boolean flags in machine context for what are really states, and prescribes a
  `uiMachine` with parallel states (see ADR-002).
- jsdom cannot verify layout, so guarantees must be expressed as state, not pixels.
- Monaco requires a sized parent and `automaticLayout`; it collapses or overflows otherwise.

## Decision

**The workspace is a fixed-height instrument panel: a three-track grid that fills the viewport exactly
and never scrolls as a page. Request and response are peers. History overlays rather than competes.**

```
┌─────────┬──────────────────────┬──────────────────────┐
│         │  REQUEST             │  RESPONSE            │
│ Sidebar │  method + URL        │  status bar          │
│ (collap-│  ├────────────────┤  │  ├────────────────┤  │
│  sible) │  │ Body│Hdrs│Env  │  │  │ Exec │ Load    │  │
│         │  │   (scrolls)    │  │  │   (scrolls)    │  │
└─────────┴──────────────────────┴──────────────────────┘
   auto            1fr        ⇄         1fr
                       (draggable, persisted)

History ── drawer, overlays from the right; never consumes layout
```

### Implementation Details

1. **Shell.** `workspace` becomes `height: 100dvh; overflow: hidden`, with
   `gridTemplateColumns: ${leftTrack} minmax(0, 1fr) minmax(0, 1fr)`. `100dvh` rather than `100vh`
   because the Tauri webview reports a dynamic viewport.
2. **`min-height: 0` discipline.** Every flex/grid child in the chain from root to scroller gets
   `minWidth: 0` / `minHeight: 0`. Without it a flex child refuses to shrink below its content and the
   overflow escapes upward — this is the single most common cause of a "fixed" layout still scrolling.
3. **Response as a peer.** Delete `responseInline`; render the response panel into the third track
   using the existing `responseColumn`. A draggable divider (`react-rnd`) persists its ratio.
4. **History drawer.** Extract a generic drawer shell from the `OpyDrawer` / `LayoutPreviewDrawer`
   pattern — both are currently domain-specific (`OpyDrawer` takes `diagramName`, `nodeCount`,
   `edgeCount`) — and move the history table and entry inspector into it.
5. **Density.** Replace the fixed floors above with `flex: 1; minHeight: 0`; Monaco to `height: 100%`
   with `automaticLayout`. Collapse the "OPSYDYN LOAD CHAMBER (EXPERIMENTAL)" preamble into a compact
   header.
6. **Narrow widths.** Replace the 1360px re-stack: below the breakpoint the response becomes a tab
   alongside the request rather than stacking beneath it, preserving the no-page-scroll invariant.
7. **Layout state moves into the machine** as parallel states (`sidebar`, `responsePane`,
   `historyDrawer`), replacing the `useState` booleans.

## Consequences

### Positive

- Request and response are visible together — the tool's core comparison stops requiring scrolling.
- The window stops moving; positions of controls become muscle memory.
- History gains room to be useful without taking room from anything else.
- Deletes the dead `responseInline` / `responseColumn` duplication.
- Layout states become expressible and testable ("drawer open collapses the response pane") rather
  than emergent from booleans.

### Negative

- Two panes at 50% each are narrower than today's full-width stack; dense panels (load test metrics at
  `repeat(3, …)`, charts) need a density pass or they will scroll internally.
- A draggable divider is new interaction surface: keyboard accessibility and a sensible reset.
- Moving UI state into the machine touches files beyond layout.
- Real verification is visual; automated tests can only pin the state, not the pixels.

### Neutral

- No new dependency.
- The sidebar keeps its own scroller.
- Tab semantics stay on React Aria.

## Alternatives Considered

### Alternative 1: Keep stacking, make the page scroll nicer

Sticky headers, scroll-into-view on run.

**Why Rejected**: Concedes the premise. The request and its response still cannot be read together,
which is the specific thing an API client exists to let you do.

### Alternative 2: Vertical split — request on top, response below, both fixed

Closer to a terminal REPL, and preserves full width for wide JSON.

**Why Rejected**: Halves the height available to the body editor, which is the surface most in need of
vertical room. Postman, Insomnia, and Bruno all default to a horizontal split for the same reason.
Worth revisiting as a user preference once the shell supports either.

### Alternative 3: History as a fourth column

**Why Rejected**: History is consulted occasionally and read in bursts; giving it permanent width taxes
the two panes that are used constantly. A drawer matches its usage and matches the existing C4 board
pattern.

### Alternative 4: Adopt a panel library (react-resizable-panels, golden-layout)

**Why Rejected**: A grid plus one divider covers the requirement. `react-rnd` is already a dependency;
a layout framework would own the shell and constrain the Vanilla Extract theming.

## Migration Plan

1. **Phase 1 — Shell.** Fixed-height root, `min-height: 0` discipline, page scroll removed. No feature
   moves; the only visible change is the scrollbar disappearing. Independently shippable.
2. **Phase 2 — Split.** Response moves into the third track; `responseInline` deleted; divider added
   with persisted ratio.
3. **Phase 3 — History drawer.** Generic drawer shell extracted; history moves in.
4. **Phase 4 — Density.** Fixed floors removed; Monaco fills; load chamber preamble compacted;
   breakpoint policy replaced.
5. **Phase 5 — Guards.** Workspace render harness; layout state moved into the machine.

## Testing Strategy

**MANDATORY**: Red-Green-Blue per CLAUDE.md.

The honest constraint: **jsdom cannot verify layout.** Computed geometry is meaningless there, so this
ADR does not pretend pixel assertions are possible. What can be pinned is everything that decides the
layout.

### Test Planning

1. Pane state transitions: response pane open/collapsed; active response tab.
2. Drawer state: history open/closed, and that opening it does not close the response pane.
3. The split ratio persists and is restored, clamped to sane bounds.
4. A workspace render harness asserting the response pane and load chamber are *present* for a scratch
   request — the coverage gap that let the load-test regression through.
5. A stylesheet guard: `workspace` must not reintroduce `minHeight: 100vh`, and no layout rule in the
   chain may set a fixed `height`/`minHeight` floor.

### Red-Green-Blue Workflow

Phases 1 and 4 are stylesheet changes verified by build, existing suite, and the guard in case 5.
Phases 2, 3, and 5 are behavioural and get conventional RED-first tests.

## Success Metrics

| Metric | Before | After | Status |
| ------ | ------ | ----- | ------ |
| Page scrolls vertically | Yes | No | Proposed |
| Request and response visible together | No | Yes | Proposed |
| History displaces the response | Yes | No | Proposed |
| Duplicate stacked/side-by-side styles | Both present | One | Proposed |
| Workspace render coverage | None | Present | Proposed |

## References

- [`PosteeWorkspace.css.ts`](/src/ui/components/postee/PosteeWorkspace.css.ts) — `workspace`,
  `mainColumn`, `responseInline`, `responseColumn`
- [`PosteeWorkspace.tsx`](/src/ui/components/postee/PosteeWorkspace.tsx) — grid tracks, response placement
- [`OpyDrawer.tsx`](/src/ui/components/OpyDrawer.tsx) — the drawer pattern to generalise
- [ADR-002](./002-postee-actor-model-refactor.md) — the `uiMachine` and parallel states this adopts
- [MDN: dynamic viewport units](https://developer.mozilla.org/en-US/docs/Web/CSS/length#dvh)

## Follow-Up ADRs

- ADR-NNN: Layout orientation as a user preference, if the vertical split rejected above is wanted
  alongside the horizontal one.

---

## Notes

The response column and its `max-width: 1360px` breakpoint already exist in the stylesheet but are
unreachable from the JSX. Phase 2 is therefore less "build a split view" than "finish connecting the
one that was already built, and delete the stacked variant that replaced it".

### Updates

- 2026-07-25: Initial draft.
- 2026-07-25: **Accepted.** Phase 1 (fixed-height shell) implemented; Phases 2-5 proceed as
  written.
