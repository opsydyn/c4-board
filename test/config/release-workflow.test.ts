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

const releasePlzConfig = readFileSync(join(process.cwd(), "src-tauri/release-plz.toml"), "utf8");

const jobsRaw = parse(
  readFileSync(join(process.cwd(), ".github/workflows/release.yml"), "utf8"),
).jobs as Readonly<Record<string, Record<string, unknown>>>;

/**
 * Every `run:` in a job, so a lookup can be asserted without knowing which step.
 * Comment lines are dropped: they are not executed, and a comment explaining why
 * an endpoint is avoided should not read as a use of it.
 */
const runsOf = (job: string) =>
  ((jobsRaw[job]?.["steps"] ?? []) as ReadonlyArray<WorkflowStep>)
    .map((step) => step.run ?? "")
    .join("\n")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n");

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

  it("notarises in a step of its own, after the build", () => {
    // Inside `tauri build` this produced one line and then 40-55 minutes of
    // silence, with no submission id to query afterwards.
    const build = assetSteps.findIndex((step) => step.uses?.includes("tauri-action") === true);
    const notarise = assetSteps.findIndex((step) => (step.run ?? "").includes("notarize-macos.run.ts"));

    expect(notarise, "no notarisation step").toBeGreaterThan(-1);
    expect(notarise).toBeGreaterThan(build);
  });

  it("gives the notarisation step the credentials the build is denied", () => {
    const step = assetSteps.find((candidate) => (candidate.run ?? "").includes("notarize-macos"));
    const env = (step?.["env"] ?? {}) as Readonly<Record<string, unknown>>;

    for (const name of ["APPLE_API_KEY", "APPLE_API_ISSUER"]) {
      expect(Object.keys(env), `notarisation cannot authenticate without ${name}`).toContain(name);
    }
  });

  it("replaces the uploaded bundles with the stapled ones", () => {
    // tauri-action uploads before notarisation runs, so those assets carry no
    // ticket. The release is a draft until publish-release, so nobody sees them.
    const replace = assetSteps.find((step) => (step.run ?? "").includes("--clobber"));

    expect(replace, "stapled bundles are never re-uploaded").toBeDefined();
    expect(replace?.run).toContain(".dmg");
  });

  it("does not fail the job when notarisation fails", () => {
    // Apple is not processing this team's submissions (ADR-013). A hard failure
    // would block Linux and Windows releases too, for a fault on Apple's side.
    const step = assetSteps.find((candidate) => (candidate.run ?? "").includes("notarize-macos"));

    expect(step?.["continue-on-error"]).toBe(true);
  });

  it("only re-uploads stapled bundles when notarisation actually succeeded", () => {
    const replace = assetSteps.find((step) => (step.run ?? "").includes("--clobber"));

    expect(String(replace?.["if"])).toContain("steps.notarize.outcome == 'success'");
  });

  it("withdraws macOS assets that were never notarised", () => {
    // tauri-action uploads before notarisation runs, so an unnotarised .dmg is
    // already on the release. Gatekeeper refuses it, which is worse than absent.
    const withdraw = assetSteps.find((step) => (step.run ?? "").includes("delete-asset"));

    expect(withdraw, "unnotarised macOS assets are never withdrawn").toBeDefined();
    expect(String(withdraw?.["if"])).toContain("steps.notarize.outcome != 'success'");
  });

  it("withdraws only its own architecture's assets", () => {
    // Both macOS jobs run concurrently against one release; a broad delete would
    // race and remove the other architecture's bundles.
    const withdraw = assetSteps.find((step) => (step.run ?? "").includes("delete-asset"));

    expect(withdraw?.run).toContain("MACOS_ASSET_TOKEN");
  });

  it("still exports Apple signing secrets through the tested script", () => {
    const step = assetSteps.find((candidate) => candidate.name?.includes("Export Apple signing"));

    expect(step?.run).toContain("apple-signing-env.ts");
  });
});

/**
 * ADR-013 Phase 2. `releases/latest/download/latest.json` is the updater's
 * endpoint, so a release must not be published before its assets exist.
 *
 * v0.0.8 demonstrated both halves of the problem in one go: published with zero
 * assets for roughly fifteen minutes, and then permanently missing both macOS
 * bundles because those jobs failed. An updater checking in either window gets a
 * 404 or a partial release.
 *
 * The release is therefore created as a draft and published only once every
 * platform has uploaded. A draft is invisible to `releases/latest`, which is the
 * property that makes the window disappear rather than shrink.
 */
describe("release publication ordering", () => {
  it("creates the release as a draft", () => {
    expect(releasePlzConfig).toMatch(/^git_release_draft\s*=\s*true$/m);
  });

  it("looks the release up in a way that can see a draft", () => {
    // GET /releases/tags/{tag} returns "a published release with the specified
    // tag" — it cannot find a draft, so both lookups have to list and filter.
    for (const job of ["release-plz-release", "resolve-existing-release"]) {
      expect(runsOf(job), `${job} cannot resolve a draft release`)
        .not.toMatch(/releases\/tags\//);
      // The listing form, filtered on the tag it was asked for.
      expect(runsOf(job), `${job} does not filter releases by tag`)
        .toMatch(/select\(\.tag_name ==/);
    }
  });

  it("publishes only after every platform has uploaded", () => {
    const publish = jobsRaw["publish-release"];
    expect(publish, "no publish-release job").toBeDefined();

    expect(publish?.["needs"]).toContain("build-release-assets");
    // With fail-fast disabled, the matrix result is success only when every leg
    // is. v0.0.8 would have stayed a draft rather than shipping without macOS.
    expect(String(publish?.["if"])).toContain("needs.build-release-assets.result == 'success'");
  });

  it("clears the draft flag rather than creating a second release", () => {
    const runs = runsOf("publish-release");

    expect(runs).toMatch(/--method PATCH/);
    expect(runs).toMatch(/draft=false/);
  });
});
