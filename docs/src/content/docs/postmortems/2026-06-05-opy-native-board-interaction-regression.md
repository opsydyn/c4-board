---
title: "Postmortem: OPY Native Board Interaction Regression"
---

# Postmortem: OPY Native Board Interaction Regression

- Date: 2026-06-05
- Severity: P1
- Affected surface: native `c4-board` C4 workspace with OPY enabled
- Status: Resolved

## Summary

The native board became effectively non-interactive while the Tauri window itself continued to resize. Operators saw a stale board frame, delayed or absent input response, and elevated WebView CPU usage.

The primary failure was not React Flow itself. The root issue was an OPY session-hydration loop that continuously retriggered asynchronous state restoration inside `OpyCopilotPanel`, amplified by duplicate resumable-task activation and unnecessary resize-time viewport work.

## Customer impact

- Native C4 board appeared frozen or severely delayed.
- OPY-enabled sessions consumed high CPU at idle.
- Board resize changed the outer window but not the effective working surface.
- Operator confidence dropped because the failure looked like canvas/input corruption rather than a render loop.

## Detection

- Native app reproduced the issue consistently in dev mode.
- Activity Monitor showed WebKit WebContent CPU climbing to roughly `70%` to `117%` at idle.
- Disabling OPY dropped CPU back to near-idle, isolating the fault to the OPY surface rather than the base board canvas.

## Timeline (concise)

1. OPY session durability and resumable-task behavior expanded.
2. Native board began presenting as frozen while the host window still resized.
3. CPU profiling showed sustained WebView load even when the board was idle.
4. OPY was isolated from the board and CPU normalized, narrowing the fault to OPY hydration and lifecycle plumbing.
5. Session hydration and resumable-task activation were stabilized.
6. Resize-time widget measurement and viewport refit behavior were reduced.
7. Native idle CPU returned to near-idle and board interaction recovered.

## Root cause

Primary root cause:

- The OPY session hydration effect depended on unstable identities.
- `useOpyAgentMachine()` exposed a fresh object shape across renders.
- `hydrateMessagesForSession` also changed identity as task/session preference state changed.
- The hydration effect depended on those changing references while also mutating the same session/task state they were derived from.
- That created a self-sustaining async rehydration loop.

Secondary root cause:

- Automatic resumable-task restoration could activate the same interrupted task repeatedly before lineage hydration had fully settled.
- That fanned out duplicate database reads, lifecycle transitions, and render work.

Amplifying factor:

- OPY bounds measurement reacted too eagerly during container resize.
- `C4CanvasContainer` also refit the graph on generic window resize, adding destructive viewport churn to an already unstable render path.

## Contributing factors

- `OpyCopilotPanel` currently owns several concerns at once: session hydration, task lineage recovery, lifecycle replay, chat persistence, and UI orchestration.
- There was no explicit guardrail documenting that long-running hydration effects must not depend on whole lifecycle objects or mutable session maps.
- The native failure mode looked like pointer/input breakage, which delayed focus on render/effect churn.

## Fix applied

1. Stabilized OPY session hydration:
   - moved interrupt/hydration calls behind ref-backed current callbacks
   - reduced effect dependencies to stable lifecycle methods instead of the full lifecycle object
2. Made resumable-task activation idempotent per task id:
   - one interrupted task can only auto-activate once until state changes
3. Reduced resize churn:
   - OPY bounds synchronization now trails resize activity instead of firing every frame
   - board window resize no longer forces `fitViewToGraph`
4. Captured the guardrails in the OPY handbook so future surface work does not reintroduce the pattern

## Verification

The following checks passed after the fix:

- targeted OPY lifecycle and persistence tests: `24 passed`
- `bun run astro check`: `0 errors`
- native idle WebView CPU returned to roughly `0.6%` to `1.2%`

## Permanent guardrails

1. Long-running session hydration effects must depend only on stable callbacks or refs, never on whole lifecycle objects returned from hooks.
2. Auto-resume flows must be idempotent per resumable task id.
3. Generic board window resize must not trigger automatic viewport refits.
4. Widget/container resize handling must batch or trail geometry work instead of coupling it to every intermediate resize event.

## Ownership

- OPY surface owner: OPY/C4 workspace maintainers
- Follow-up tracking: keep handbook guardrails current as OPY session/lifecycle work evolves
