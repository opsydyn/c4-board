import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

/**
 * `build-release-assets` builds the *released tag*, not the branch the workflow
 * came from — step one is `actions/checkout` with `ref: RELEASE_TAG`. GitHub, in
 * contrast, runs the workflow *file* from the ref that triggered it.
 *
 * Those two refs are never the same. release-plz cuts its release branch at a
 * point in time and the tag lands on that commit, so anything merged afterwards
 * is on `main` and absent from the tag permanently. v0.0.8 failed exactly here:
 * main's workflow called `.github/scripts/apple-signing-env.ts`, the tag predated
 * it, and both macOS jobs died with `Module not found` after the whole build.
 *
 * So tooling this job runs has to be checked out from the workflow's own ref, and
 * a bare `.github/scripts/...` path silently resolves against the tag instead.
 */

interface WorkflowStep {
  readonly name?: string;
  readonly uses?: string;
  readonly run?: string;
  readonly with?: Readonly<Record<string, unknown>>;
}

const workflow = parse(
  readFileSync(join(process.cwd(), ".github/workflows/release.yml"), "utf8"),
) as {
  readonly jobs: Readonly<Record<string, { readonly steps: ReadonlyArray<WorkflowStep> }>>;
};

const assetSteps = workflow.jobs["build-release-assets"]?.steps ?? [];

/** Where the workflow-ref checkout lands, so tooling paths can be told apart. */
const TOOLING_PATH = ".release-tooling";

describe("release asset job", () => {
  it("builds the released tag rather than the branch", () => {
    expect(assetSteps[0]?.uses).toMatch(/actions\/checkout/);
    expect(assetSteps[0]?.with?.["ref"]).toBe("${{ env.RELEASE_TAG }}");
  });

  it("never runs a script from the tag's own tree", () => {
    for (const step of assetSteps) {
      const run = step.run ?? "";
      if (!run.includes(".github/scripts/")) continue;

      // A path not rooted in the tooling checkout resolves against the tag, which
      // only contains what existed when release-plz cut the release branch.
      expect(run, `"${step.name}" runs a script from the released tag`)
        .toContain(`${TOOLING_PATH}/.github/scripts/`);
    }
  });

  it("checks tooling out from the workflow ref before anything uses it", () => {
    const toolingIndex = assetSteps.findIndex((step) =>
      step.uses?.includes("actions/checkout") === true && step.with?.["path"] === TOOLING_PATH
    );
    expect(toolingIndex, "no tooling checkout step").toBeGreaterThan(0);

    // Pinned to the triggering ref: the fix has to apply to tags cut before it.
    expect(assetSteps[toolingIndex]?.with?.["ref"]).toBe("${{ github.sha }}");

    const firstUse = assetSteps.findIndex((step) => (step.run ?? "").includes(TOOLING_PATH));
    expect(firstUse, "nothing uses the tooling checkout").toBeGreaterThan(-1);
    expect(toolingIndex).toBeLessThan(firstUse);
  });

  it("still exports Apple signing secrets through the tested script", () => {
    const step = assetSteps.find((candidate) => candidate.name?.includes("Export Apple signing"));

    expect(step?.run).toContain("apple-signing-env.ts");
  });
});
