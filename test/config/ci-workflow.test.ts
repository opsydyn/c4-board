import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

/**
 * What CI actually enforces.
 *
 * Rust has three gates — `cargo fmt --all --check`, `cargo clippy --all-targets
 * -- -D warnings`, and `cargo test --locked`. The frontend had tests, a build and
 * two environment checks, but nothing ran eslint, so lint was advisory in a
 * codebase that treats it as a rule. It drifted to 114 problems before anyone
 * looked.
 *
 * Clearing that backlog is worth nothing on its own: the same drift starts again
 * the next day. The gate is the fix, and now is the cheapest moment to add it,
 * with the count at zero.
 */

interface WorkflowJob {
  readonly steps?: ReadonlyArray<{ readonly name?: string; readonly run?: string }>;
}

const workflow = parse(
  readFileSync(join(process.cwd(), ".github/workflows/ci.yml"), "utf8"),
) as { readonly jobs: Readonly<Record<string, WorkflowJob>> };

/** Every `run:` across every job, so a command can be found without its step. */
const allRuns = Object.values(workflow.jobs)
  .flatMap((job) => job.steps ?? [])
  .map((step) => step.run ?? "")
  .join("\n");

const packageScripts = (
  JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
    readonly scripts: Readonly<Record<string, string>>;
  }
).scripts;

describe("CI enforces the frontend lint", () => {
  /**
   * Asserted as a chain rather than by grepping for "eslint" in the workflow:
   * CI invokes a package script, so the workflow never mentions the linter by
   * name. Checking only the workflow would pass for a `lint` script that had been
   * emptied, and checking only the script would pass for a gate CI never runs.
   */
  it("runs the lint script", () => {
    expect(allRuns).toMatch(/bun run lint\b/);
  });

  it("and that script actually runs eslint", () => {
    expect(packageScripts["lint"]).toMatch(/eslint/);
  });

  it("does not let it pass by fixing the problems in place", () => {
    // `--fix` in CI would rewrite the checkout and exit clean, reporting a pass
    // for code that never had one. A `lint:fix` script may exist; CI must not
    // reach for it.
    expect(packageScripts["lint"]).not.toMatch(/--fix/);
    expect(allRuns).not.toMatch(/bun run lint:fix/);
  });
});

describe("CI still enforces the Rust gates", () => {
  /** These were passing already; pinned so a workflow edit cannot quietly drop one. */
  it.each([
    ["formatting", /cargo fmt --all --check/],
    ["lints as errors", /cargo clippy --all-targets -- -D warnings/],
    ["tests against the committed lockfile", /cargo test --locked/],
  ])("checks %s", (_label, pattern) => {
    expect(allRuns).toMatch(pattern);
  });
});

describe("CI still enforces the frontend gates", () => {
  it.each([
    ["the test suite", /bun run test:run/],
    ["the production build", /bun run build/],
    ["unused exports", /bun run knip/],
    ["the environment schema", /bun run env:check/],
    ["that no secret reaches the build output", /bun run env:scan:build/],
  ])("checks %s", (_label, pattern) => {
    expect(allRuns).toMatch(pattern);
  });
});
