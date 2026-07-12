Task 2 implementation report

- Commits: 64cacd3, 797fe77
- Captures visually inspected at exact 1600x900 and 960x720 dimensions.
- Tests: bun run test:run (78 files, 608 tests passed); bun run lint; bun run build (0 diagnostics); cargo check; bun run docs:build; git diff --check.
- Concerns: none.

## Review fix wave

- Commits: `368cfcb`, `d417e1f`, `7944a9f`, `3b05d83`.
- Restored explicit graph-transition refits and added focused regression coverage.
- Kept fixture-only sidebars collapsed so native previews use the available canvas while fitting the complete graph.
- Made process/window selection fail on ambiguity, added `--pid`, correlated post-resize checks to the selected CoreGraphics window, and validated captured PNG headers and dimensions.
- Reframed and visually inspected all four Event-Driven baselines at original resolution.
- Verification: `bun run test:run` (80 files, 614 tests), `bun run lint`, `bun run build` (zero diagnostics), `cargo check --manifest-path src-tauri/Cargo.toml`, `bun run docs:build`, and `git diff --check` all passed.
- Environment note: macOS can expose a Tauri window as an AX application surrogate; `--skip-resize` supports already-correct windows while preserving process/window and PNG validation.
- Follow-up commit `28d5452` recaptured both bridge baselines with complete-graph fitting; the three bus bands and telemetry, external-monitor, and review support lane are all visible in desktop and narrow frames.

## Complementary detail follow-up

- Commit: `46006f1` (`test: add event-driven bridge detail fixture`).
- No PNGs were captured or changed.
- TDD RED: `bunx vitest run test/core/effects/layout-visual-fixtures.test.ts src/ui/components/C4Canvas.fit.test.ts` failed as expected with 2 files and 5 tests failing because the detail fixture and fit-node resolver did not exist.
- Focused verification: `bunx vitest run test/core/effects/layout-visual-fixtures.test.ts src/ui/components/C4Canvas.fit.test.ts src/ui/components/C4CanvasContainer.graph-fit.test.ts .github/scripts/capture-tauri-layout.test.ts` passed with 4 files and 18 tests passing.
- Lint: `bun run lint` exited 0 (`$ eslint`).
- Diff checks: `git diff --check` and `git diff --cached --check` exited 0 before commit.
- Native detail baselines: commits `1b4fcdf` and `1e2493a`; desktop `1600x900` and narrow `960x720` captures were inspected at original resolution and show readable bridge sub-tracks, processor clearance, and all three right-side subscribers.
- Final verification: `bun run test:run` passed 81 files and 618 tests; lint, frontend build with zero diagnostics, Rust check, docs build, and `git diff --check` all passed.

## Final review remediation

- TDD RED: `bunx vitest run src/ui/components/C4Canvas.fit.test.ts` failed as expected with 2 tests failing because `resolveCanvasViewportChrome` did not exist.
- Added an explicit fixture-derived `visualHarness` state and C4Canvas prop. Only visual fixtures hide the minimap and set `minZoom` to `0.1`; editable boards and ordinary read-only layout previews retain the React Flow defaults and minimap.
- Preserved explicit `viewportFitNodeIds` handling for detail fixture framing.
- Focused verification: `bunx vitest run src/ui/components/C4Canvas.fit.test.ts src/ui/components/C4CanvasContainer.graph-fit.test.ts test/core/effects/layout-visual-fixtures.test.ts .github/scripts/capture-tauri-layout.test.ts` passed with 4 files and 20 tests.
- Full verification: `bun run test:run` passed 81 files and 620 tests; `bun run lint` passed; `bun run build` completed with 0 Astro diagnostics; `cargo check --manifest-path src-tauri/Cargo.toml` passed; and `bun run docs:build` completed with 59 pages.
- Pre-commit diff check: `git diff --check` passed.
- Whole-range diff check: `git diff --check ef26512..HEAD` passed.
