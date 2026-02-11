# Postmortem: C4 Infinite Re-render Incident

- Date: 2026-02-09
- Severity: P1
- Affected surface: `C4CanvasContainer` route (`/`)
- Status: Resolved

## Summary

The C4 workspace entered a render loop and crashed with:

`Too many re-renders. React limits the number of renders to prevent an infinite loop.`

The incident was introduced during the modularization refactor where command, autosave, and navigation orchestration moved into XState-backed custom hooks. The root issue was callback identity churn feeding hook/machine construction paths, causing repeated actor lifecycle churn and repeated render-triggering side effects.

## Customer impact

- C4 board unavailable (hard crash in route render tree).
- Save/navigation workflows on C4 blocked while crash persisted.
- Operator debugging was difficult before adding a dedicated boundary and diagnostics.

## Detection

- Runtime crash observed in-browser.
- Boundary diagnostics reported the component stack at `C4CanvasContainer`.

## Timeline (concise)

1. Refactor introduced orchestration hooks and moved command wiring into machine-based hooks.
2. Users reported persistent re-render loop on C4 route.
3. Error boundary was added to surface stack/diagnostics and keep UI controllable.
4. Callback/machine identity churn points were stabilized.
5. Regression tests for command/autosave/navigation/save machine flows passed.

## Root cause

Primary root cause:

- Unstable callback references were passed into orchestration hooks that internally construct machine definitions and event plumbing.
- This caused machine/input churn and repeated side-effect registration/dispatch paths under active state changes.

Technical hotspots:

- `useC4CommandsMachine`: callback and handler object identity churn.
- `useC4AutosaveMachine`: autosave request callback identity churn.
- `useC4NavigationMachine`: flush/save/navigate callbacks passed as non-stable inputs.
- `C4CanvasContainer`: save-machine event dispatch dependencies were tied to changing hook outputs.

## Contributing factors

- No lint rule explicitly guarding inline callbacks in orchestration hook options.
- No route-level error boundary before the incident, reducing diagnosis speed.
- Complex refactor touched multiple coordination layers in one phase.

## Fix applied

1. Stabilized orchestration callback paths with ref-backed wrappers:
   - `src/ui/hooks/useC4CommandsMachine.ts`
   - `src/ui/hooks/useC4AutosaveMachine.ts`
   - `src/ui/hooks/useC4NavigationMachine.ts`
2. Stabilized save-machine dispatch path in container:
   - `src/ui/components/C4CanvasContainer.tsx`
3. Added C4 route error boundary and wrapper:
   - `src/ui/components/AppErrorBoundary.tsx`
   - `src/ui/components/C4CanvasApp.tsx`
   - `src/pages/index.astro`

## Verification

The following targeted suites passed after fixes:

- `test/ui/machines/c4-save.machine.test.ts`
- `test/ui/machines/c4-autosave.machine.test.ts`
- `test/ui/machines/c4-navigation.machine.test.ts`
- `test/ui/machines/c4-commands.machine.test.ts`
- `test/core/effects/database.runtime.phase5.test.ts`

## Preventive actions

1. Linting:
   - Add restricted-syntax rules banning:
     - inline callback properties passed to orchestration hooks (`useC4*Machine`)
     - inline options objects passed to orchestration hooks (requires `useMemo` for options)
   - Add focused safety script (`npm run lint:guards`) that checks orchestration files without waiting for full repo formatting convergence.
2. Testing:
   - Add component-level smoke test that mounts C4 route and asserts no render-loop behavior after initial settle.
3. Process:
   - Require “stable callback contract” checklist item for any new orchestration hook/machine refactor.

## Ownership

- UI orchestration owner: C4 workspace maintainers
- Follow-up tracking: lint rule enforcement + smoke test coverage
