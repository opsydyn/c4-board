# Repository Guidelines

## Project Structure & Module Organization

This is a Bun-powered Astro 6, React 19, and Tauri 2 app. Routes live in `src/pages`, layouts in `src/layouts`, reusable React components in `src/components`, and richer UI in `src/ui`. Domain logic, Effect runtimes, schemas, persistence, agent flows, and Postee logic live under `src/core`. Styling uses vanilla-extract in `src/styles` and `*.css.ts` files. Tauri/Rust code, migrations, icons, and desktop config live in `src-tauri`. Tests are split between `test/**`, colocated `*.test.ts[x]` files in `src/**`, and shared infrastructure in `tests/**`.

## Build, Test, and Development Commands

- `bun run dev` or `make dev`: start the Astro web dev server.
- `bun tauri dev`: run the desktop app in Tauri dev mode.
- `bun run dev:reset`: clear stale Vite/Astro caches.
- `bun run build` or `make build`: build the frontend.
- `bun tauri build`: build desktop bundles.
- `bun run lint` / `bun run lint:fix`: run or fix ESLint.
- `bun run test:run`: run Vitest once. Use `bun run test` for watch mode.
- `bun run test:coverage`: run coverage with V8.
- `bun run knip`: check for unused files and dependencies.

## Coding Style & Naming Conventions

Use TypeScript for app code and Rust for Tauri backend code. Follow the Effect ESLint dprint style: two-space indentation, double quotes, and semicolons. React components use `PascalCase`, hooks use `useCamelCase`, tests use `*.test.ts[x]`, and vanilla-extract files use `*.css.ts`. Prefer aliases such as `@/core`, `@/ui`, and `@schema`. Keep C4 orchestration hook options stable with `useMemo`/`useCallback`; guard lint rules reject inline objects and callbacks there.

## Testing Guidelines

Vitest runs in `jsdom` with setup from `tests/setup/test-setup.ts` and vanilla-extract mocks from `tests/mocks`. Keep focused tests near source, or under `test/**` for broader runtime and UI suites. Reuse fixtures from `tests/fixtures` and helpers from `tests/utils`; never import `tests/**` from production code. Core Effect modules should keep strong coverage, especially persistence, policy, agent, and state-machine paths.

## Commit & Pull Request Guidelines

Recent history uses conventional prefixes such as `feat:`, `fix:`, `ci:`, `docs:`, and `chore:`; keep subjects concise and imperative. PRs should describe the change, note tests run, link issues or ADRs, and include screenshots or recordings for UI changes. For architecture decisions, update `docs/adr`.

## Security & Configuration Tips

Do not commit raw API keys, SQLite working databases, signing credentials, or build artifacts. OPY/OpenAI credentials should flow through the settings/keychain path in `README.md`; logs and diagnostics must report presence/source only, never secret values.
