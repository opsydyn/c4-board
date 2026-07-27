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
  readonly if?: string;
  readonly env?: Readonly<Record<string, unknown>>;
  readonly "continue-on-error"?: boolean;
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
    const env = step?.env ?? {};

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

    expect(String(replace?.if)).toContain("steps.notarize.outcome == 'success'");
  });

  it("withdraws macOS assets that were never notarised", () => {
    // tauri-action uploads before notarisation runs, so an unnotarised .dmg is
    // already on the release. Gatekeeper refuses it, which is worse than absent.
    const withdraw = assetSteps.find((step) => (step.run ?? "").includes("Withdrawing"));

    expect(withdraw, "unnotarised macOS assets are never withdrawn").toBeDefined();
    expect(String(withdraw?.if)).toContain("steps.notarize.outcome != 'success'");
  });

  it("withdraws only its own architecture's assets", () => {
    // Both macOS jobs run concurrently against one release; a broad delete would
    // race and remove the other architecture's bundles.
    const withdraw = assetSteps.find((step) => (step.run ?? "").includes("Withdrawing"));

    expect(withdraw?.run).toContain("MACOS_ASSET_TOKEN");
  });

  it("still exports Apple signing secrets through the tested script", () => {
    const step = assetSteps.find((candidate) => candidate.name?.includes("Export Apple signing"));

    expect(step?.run).toContain("apple-signing-env.ts");
  });
});

/**
 * The Apple signing switch.
 *
 * Apple has not processed a notarisation for this team in over a day, and the
 * withdraw step exists precisely so nothing unnotarised reaches a release — which
 * means macOS ships nothing at all while the outage lasts. For a testing round
 * that trade is wrong: an unsigned `.dmg` plus a documented `xattr` workaround is
 * worth more than no macOS build.
 *
 * So signing becomes switchable rather than assumed. The properties below are
 * what make "off" safe: every Apple step gated on the same flag, and crucially
 * the *withdraw* step gated too — without that, turning signing off would build
 * a dmg, fail to notarise it, and then delete it.
 */
describe("the Apple signing switch", () => {
  const appleStepNames = [
    "Validate Apple signing",
    "Export Apple signing",
    "Notarise and staple",
    "Replace macOS assets",
    "Withdraw unnotarised",
  ] as const;

  const workflowRaw = readFileSync(join(process.cwd(), ".github/workflows/release.yml"), "utf8");

  it("is a single flag, not a value repeated per step", () => {
    // One switch to flip. Five independent conditions would drift.
    for (const name of appleStepNames) {
      const step = assetSteps.find((candidate) => candidate.name?.includes(name));

      expect(step?.if, `${name} is not gated on the signing flag`)
        .toContain("APPLE_SIGNING_ENABLED");
    }
  });

  it("can be turned off without editing the workflow", () => {
    // Hardcoding `"true"` means every flip is a commit, a review and a release
    // cycle. A repository variable can be changed between runs.
    expect(workflowRaw).toMatch(/APPLE_SIGNING_ENABLED:\s*\$\{\{\s*vars\.APPLE_SIGNING_ENABLED/);
  });

  it("defaults to signing when nobody has said otherwise", () => {
    // The unset case must be the safe one: an absent variable means sign, so
    // shipping unsigned is always a deliberate act rather than a forgotten one.
    expect(workflowRaw).toMatch(/vars\.APPLE_SIGNING_ENABLED[^\n]*'true'/);
  });

  it("does not withdraw macOS assets when signing is off", () => {
    // The property that makes the whole switch work. Withdraw fires when
    // notarisation did not succeed; with signing off it never runs at all, so
    // the unsigned dmg survives to the release.
    const withdraw = assetSteps.find((candidate) => candidate.name?.includes("Withdraw unnotarised"));

    expect(withdraw?.if).toContain("APPLE_SIGNING_ENABLED == 'true'");
  });

  it("records that unsigned releases need the Gatekeeper workaround", () => {
    // A reader finding an unsigned dmg on a release should be able to tell it was
    // intended, and what users have to do about it.
    expect(workflowRaw).toMatch(/xattr|quarantine|Gatekeeper/i);
  });
});

/**
 * Release publication.
 *
 * ADR-013 Phase 2 made releases drafts until every platform had uploaded, so
 * `releases/latest` could never resolve to a release without assets. That gate
 * is reverted: Apple stopped processing this team's notarisations, macOS never
 * succeeded, and v0.0.9 through v0.0.11 all sat as drafts with nothing in them.
 * Shipping Linux and Windows beats shipping nothing.
 *
 * The window the gate closed is knowingly reopened. These tests pin the reasons
 * so restoring it later is a decision rather than an archaeology exercise.
 */
describe("release publication", () => {
  it("publishes immediately rather than drafting", () => {
    expect(releasePlzConfig).toMatch(/^git_release_draft\s*=\s*false$/m);
  });

  it("says why the draft gate was given up", () => {
    // Without the reason recorded, someone re-enables it and stalls releases
    // again, or leaves it off long after notarisation is fixed.
    expect(releasePlzConfig).toMatch(/notarisation|Apple/i);
  });

  it("looks the release up in a way that survives either mode", () => {
    for (const job of ["release-plz-release", "resolve-existing-release"]) {
      expect(runsOf(job), `${job} cannot resolve a draft release`)
        .not.toMatch(/releases\/tags\//);
      expect(runsOf(job), `${job} does not filter releases by tag`)
        .toMatch(/select\(\.tag_name ==/);
    }
  });

  it("retries the lookup, because the list endpoint lags the create", () => {
    // v0.0.11 was created at 15:32:18 and a lookup at 15:32:19 did not see it.
    expect(runsOf("release-plz-release")).toMatch(/for attempt in/);
  });

  it("withdraws assets by release id, never by tag", () => {
    // `gh release view <tag>` cannot see a draft and falls back to the latest
    // published release — this listed v0.0.8's assets during v0.0.10.
    const withdraw = assetSteps.find((step) => (step.run ?? "").includes("Withdrawing"));

    expect(withdraw?.run).toContain("releases/${RELEASE_ID}/assets");
    expect(withdraw?.run, "resolves the release by tag").not.toMatch(/release view "\$\{RELEASE_TAG\}"/);
  });
});

/**
 * The release surface marker.
 *
 * The frontend lives outside `src-tauri/`, so release-plz — which decides by
 * packaging the crate and diffing it against the last released package — sees a
 * frontend-only change as no change at all. The marker file exists to make one:
 * it is inside `src-tauri/` and listed in Cargo.toml's `include`, so changing it
 * changes the package.
 *
 * The step wrote that file and stopped. release-plz packages from a git worktree
 * built from HEAD, where an uncommitted file does not exist, so it reported
 * `c4-board: already up to date` and opened nothing — while the step logged
 * "Prepared src-tauri/release-plz-surface.json for app changes outside
 * src-tauri/" and the job went green.
 *
 * That combination ate two releases: v0.0.13 and the continuous-tone fix. Both
 * times the failure looked exactly like success. The guard below matters more
 * than the commit — a release job that decides to do nothing has to say so.
 */
describe("the release surface marker", () => {
  const markerStep = () => {
    const step = ((jobsRaw["release-plz-pr"]?.["steps"] ?? []) as ReadonlyArray<WorkflowStep>)
      .find((candidate) => candidate.name?.includes("release surface marker"));
    expect(step, "the marker step has moved or been renamed").toBeDefined();
    return step?.run ?? "";
  };

  it("commits the marker, because release-plz packages from git", () => {
    // Writing it to the working tree is invisible to a worktree checkout.
    expect(markerStep()).toMatch(/git commit/);
  });

  it("pushes it, because the commit has to be in the ref release-plz reads", () => {
    expect(markerStep()).toMatch(/git push/);
  });

  it("does not re-trigger itself", () => {
    // A push to main from a workflow that runs on pushes to main loops forever
    // without this.
    expect(markerStep()).toMatch(/\[skip ci\]/);
  });
});

describe("a releasable change cannot silently produce no release", () => {
  const steps = (jobsRaw["release-plz-pr"]?.["steps"] ?? []) as ReadonlyArray<WorkflowStep>;

  const guard = () => {
    const step = steps.find((candidate) => candidate.name?.includes("releasable"));
    expect(step, "no guard step").toBeDefined();
    return step;
  };

  it("fails the job when the surface changed but nothing was opened", () => {
    // The specific silence that cost two releases.
    expect(guard()?.run).toMatch(/exit 1/);
  });

  it("decides using both signals", () => {
    const run = guard()?.run ?? "";

    expect(run, "does not consider whether the surface changed").toMatch(/SURFACE_CHANGED/);
    expect(run, "does not consider whether a PR resulted").toMatch(/PRS/);
  });

  it("runs after release-plz rather than before it", () => {
    const releasePlz = steps.findIndex((step) => step.uses?.includes("release-plz/action") === true);
    const guardIndex = steps.findIndex((step) => step.name?.includes("releasable"));

    expect(guardIndex).toBeGreaterThan(releasePlz);
  });
});

/**
 * What the marker measures against.
 *
 * It computed the changed-path list from `github.event.before..GITHUB_SHA` — the
 * range of one push. That makes the mechanism lossy: a push that is skipped,
 * cancelled or fails leaves its changes unmarked forever, because the next push
 * only ever looks at its own range.
 *
 * That is not hypothetical. A commit carrying an app change landed with every
 * workflow suppressed, so it was never marked; the following push saw only its
 * own file and correctly concluded there was nothing releasable. The change sat
 * on main, unreleased, with the guard silent because nothing had *claimed* to be
 * releasable.
 *
 * Measuring from the last release tag instead is idempotent: it always describes
 * everything unreleased, so a missed push is picked up by the next one.
 */
describe("the marker measures from the last release, not the last push", () => {
  /**
   * Comment lines dropped, matching `runsOf` above: a comment explaining why a
   * range was abandoned must not read as a use of it. Asserting over the raw
   * text made this very test fail on its own explanation.
   */
  const markerRun = () =>
    (((jobsRaw["release-plz-pr"]?.["steps"] ?? []) as ReadonlyArray<WorkflowStep>)
      .find((step) => step.name?.includes("release surface marker"))?.run ?? "")
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("#"))
      .join("\n");

  it("bases the diff on the most recent tag", () => {
    expect(markerRun()).toMatch(/git describe --tags --abbrev=0/);
  });

  it("no longer bases it on the previous push", () => {
    // `github.event.before` is the head of the *last push*, which says nothing
    // about what has been released.
    expect(markerRun()).not.toMatch(/github\.event\.before/);
  });

  it("still works on a repository with no tags yet", () => {
    // The first release has nothing to describe against.
    expect(markerRun()).toMatch(/hash-object -t tree/);
  });
});
