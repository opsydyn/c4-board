# Testing Conventions

This directory hosts shared testing infrastructure for the project. The goals are:

- Keep fixtures and helpers in one place so suites stay focused on behaviour under test.
- Provide guidance for adding new suites without repeating boilerplate.
- Highlight the additional tooling we expect to use (but have not yet installed).

## Directory Layout

```
tests/
  README.md            // this document
  fixtures/            // reusable test data (nodes, edges, models, etc.)
    index.ts
    graph.ts
  utils/               // helpers for rendering, mocking, etc.
    index.ts
```

### Fixtures

- Export plain objects or factory functions that can be shared across Vitest suites.
- Prefer strongly typed fixtures (use types from `src/` so refactors stay type-safe).
- Keep scenario-specific fixtures close to the suite if they have no reuse value.

### Utils

- Collect shared testing helpers (e.g., custom render wrappers, MSW handlers) here.
- Avoid importing `tests/utils` inside production code — helpers are only for test files.

## Recommended Packages

Install the following dev dependencies once we begin implementing the suites:

```
bun add -D @testing-library/react @testing-library/user-event @testing-library/jest-dom
bun add -D @testing-library/react-hooks-dom @testing-library/react-hooks
bun add -D @faker-js/faker @mswjs/interceptors msw
```

Notes:

- `@testing-library/react` + `user-event` provide DOM-focused component testing.
- `@testing-library/jest-dom` adds readable matchers (e.g., `toBeInTheDocument`).
- `msw` lets us mock persistence / Tauri APIs without brittle manual stubs.
- `@faker-js/faker` and optional fixture factories help generate varied inputs.

Update `vitest.config.ts` once the packages are installed (add `setupFiles` for jest-dom, configure jsdom environment, etc.).

## Writing Tests

- Co-locate suite files alongside source (`*.test.ts[x]`) or in a `__tests__` folder.
- Import reusable data from `tests/fixtures`. If a fixture is only used in one suite, keep it local to that suite.
- Use `tests/utils` for rendering helpers so every component test benefits from the same providers (React Flow context, Theme wrappers, etc.).
- Keep assertions behavioural — prefer visible state over snapshots unless absolutely necessary (e.g., verifying complex SVG output).
- For state machines, follow Stately's recommended pattern of driving the interpreter directly with Vitest (see Stately's testing docs). Build reusable helpers in `tests/utils/machine.ts` (to be added) to compile events, assert context changes, and walk critical paths.
- Consider Vitest's browser runner for any future visual regression coverage (see the Vitest browser/visual regression guide). We can layer per-component baseline screenshots once the core behavioural tests are in place.

## Coverage Expectations

- Core effect modules (pure functions): high branch coverage (>80%).
- XState machine: ensure every transition/guard is exercised.
- UI: target critical paths (toolbar, canvas interactions, overlays). Use MSW for persistence boundaries.
- Optional: If we adopt Vitest's browser runtime for visual regression, store baselines under `tests/__snapshots__/visual` and document the workflow here so CI can update artefacts safely.

Document new helpers/fixtures in this README or inline JSDoc so the intent stays clear.
