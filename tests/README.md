# Testing Conventions

The `tests/` directory centralises shared infrastructure so suites stay focused on
behaviour instead of boilerplate.

## Directory Layout

```
tests/
  README.md            // this document
  fixtures/            // reusable test data (nodes, edges, models, etc.)
    index.ts
    graph.ts
  utils/               // helpers for rendering, machine helpers, etc.
    index.ts
```

### Fixtures

- Export plain objects or factory functions that can be shared across Vitest suites.
- Prefer strongly typed fixtures (reuse types from `src/` so refactors stay safe).
- If a fixture is only used in one suite, keep it local to that suite instead of
  adding it here.

### Utils

- Collect shared testing helpers here (e.g., `renderWithProviders`, machine-test
  helpers once they are implemented).
- Never import `tests/utils` from production code—these utilities are test-only.

## Recommended Packages

Install the following dev dependencies when we begin adding suites:

```
bun add -D @testing-library/react @testing-library/user-event @testing-library/jest-dom
bun add -D @testing-library/react-hooks-dom @testing-library/react-hooks
bun add -D @faker-js/faker
```

Notes:

- `@testing-library/react` + `user-event` provide DOM-focused component testing.
- `@testing-library/jest-dom` adds readable matchers (e.g., `toBeInTheDocument`).
- `@faker-js/faker` (and any fixture factories) help generate varied inputs.

Update `vitest.config.ts` once the packages are installed (set `environment: "jsdom"`,
add `setupFiles`, etc.). Create `tests/setupTests.ts` that imports
`@testing-library/jest-dom/vitest` so the matchers are available globally.

## Writing Tests

- Co-locate suite files alongside source (`*.test.ts[x]`) or in a `__tests__`
  folder.
- Import reusable data from `tests/fixtures`. If a fixture has no reuse value,
  keep it local to the suite.
- Use helpers from `tests/utils` so every component test benefits from the same
  providers (React Flow context, Theme wrappers, etc.).
- Keep assertions behavioural—prefer visible state over snapshots unless the
  output is too complex (e.g., verifying SVG paths).
- For state machines, follow Stately's recommended approach: drive the
  interpreter directly with Vitest. We plan to add helpers in
  `tests/utils/machine.ts` to collate events, assert context changes, and cover
  crucial paths.
- Consider Vitest's browser runner for any future visual regression coverage (see
  the Vitest browser/visual regression guide). If we adopt it, store baselines under
  `tests/__snapshots__/visual` and document the workflow here so CI updates are safe.

## Coverage Expectations

- Core effect modules (pure functions): high branch coverage (>80%).
- XState machine: ensure every transition/guard is exercised.
- UI: target critical paths (toolbar, canvas interactions, overlays). Mock Tauri
  services or database contexts in tests to isolate behaviour.

Document new helpers/fixtures either here or with inline JSDoc so their intent
remains clear.
