import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const BUILD_SECRET_SENTINEL = "c4-board-build-secret-sentinel-v1";

const readRootFile = (path: string): string => readFileSync(resolve(process.cwd(), path), "utf8");

const schemaKeys = (): ReadonlyArray<string> =>
  Array.from(
    readRootFile(".env.schema").matchAll(/^([A-Z][A-Z0-9_]*)=/gm),
    (match) => match[1],
  ).filter((key): key is string => key !== undefined);

const sourceFiles = (root: string): ReadonlyArray<string> => {
  const absoluteRoot = resolve(process.cwd(), root);
  const files: Array<string> = [];

  for (const entry of readdirSync(absoluteRoot, { withFileTypes: true })) {
    const path = join(absoluteRoot, entry.name);
    if (entry.isDirectory()) {
      files.push(...sourceFiles(path));
    } else if (/\.(?:rs|ts|tsx)$/.test(entry.name)) {
      files.push(path);
    }
  }

  return files;
};

const isolatedApplicationEnv = (
  overrides: Readonly<Record<string, string>>,
): NodeJS.ProcessEnv => {
  const env = { ...process.env };
  for (const key of schemaKeys()) {
    delete env[key];
  }

  return { ...env, ...overrides };
};

interface WorkflowStep {
  readonly if?: string;
  readonly name?: string;
  readonly run?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly uses?: string;
  readonly with?: Readonly<Record<string, string>>;
}

interface WorkflowJob {
  readonly if?: string;
  readonly needs?: string | ReadonlyArray<string>;
  readonly steps?: ReadonlyArray<WorkflowStep>;
}

interface Workflow {
  readonly jobs?: Readonly<Record<string, WorkflowJob>>;
}

const workflowJob = (path: string, name: string): WorkflowJob => {
  const workflow = parse(readRootFile(path)) as Workflow;
  const job = workflow.jobs?.[name];
  expect(job, `missing ${name} from ${path}`).toBeDefined();
  return job ?? {};
};

const expectOrderedSteps = (
  job: WorkflowJob,
  expectedNames: ReadonlyArray<string>,
): void => {
  const actualNames = job.steps?.map((step) => step.name ?? "") ?? [];
  let previousIndex = -1;

  for (const name of expectedNames) {
    const index = actualNames.indexOf(name);
    expect(index, `missing workflow step "${name}"`).toBeGreaterThan(previousIndex);
    previousIndex = index;
  }
};

const expectSentinelBuildAndScan = (job: WorkflowJob): void => {
  const build = job.steps?.find((step) => step.name === "Build frontend with secret sentinel");
  const scan = job.steps?.find((step) => step.name === "Scan frontend build for secret sentinel");

  expect(build?.run).toBe("bun run build");
  expect(build?.env?.OPSYDYN_OPENAI_API_KEY).toBe(BUILD_SECRET_SENTINEL);
  expect(scan?.run).toBe("bun run env:scan:build");
  expect(scan?.env?.OPSYDYN_OPENAI_API_KEY).toBe(BUILD_SECRET_SENTINEL);
};

const schemaEntry = (
  schema: string,
  key: string,
): { readonly comments: string; readonly value: string } => {
  const lines = schema.split(/\r?\n/);
  const entryIndex = lines.findIndex((line) => line.startsWith(`${key}=`));

  expect(entryIndex, `missing ${key} from .env.schema`).toBeGreaterThanOrEqual(0);

  const comments: Array<string> = [];
  for (let index = entryIndex - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!line?.startsWith("#")) {
      break;
    }
    comments.unshift(line);
  }

  return {
    comments: comments.join("\n"),
    value: lines[entryIndex]?.slice(key.length + 1) ?? "",
  };
};

describe("Varlock environment policy", () => {
  it("catalogues every application-owned environment variable", () => {
    const discoveredKeys = new Set<string>();
    const literalPattern =
      /["']((?:(?:PUBLIC|VITE|OPSYDYN|C4)_[A-Z0-9_]+|SETTINGS_V1|RIG_AGENT_V1|OPENAI_API_KEY))["']/g;
    const propertyPattern = /\b(?:process|import\.meta)\.env\.([A-Z][A-Z0-9_]*)\b/g;
    const platformKeys = new Set(["BASE_URL", "DEV", "NODE_ENV", "NODE_OPTIONS"]);

    for (const root of ["src", "src-tauri/src", ".github/scripts"]) {
      for (const file of sourceFiles(root)) {
        const source = readFileSync(file, "utf8");
        for (const match of source.matchAll(literalPattern)) {
          const key = match[1];
          if (key) {
            discoveredKeys.add(key);
          }
        }
        for (const match of source.matchAll(propertyPattern)) {
          const key = match[1];
          if (key && !platformKeys.has(key)) {
            discoveredKeys.add(key);
          }
        }
      }
    }

    expect(schemaKeys().toSorted()).toEqual(Array.from(discoveredKeys).toSorted());
  });

  it("marks provider fallbacks sensitive without committing values", () => {
    const schema = readRootFile(".env.schema");

    for (const key of ["OPSYDYN_OPENAI_API_KEY", "OPENAI_API_KEY"]) {
      const entry = schemaEntry(schema, key);
      expect(entry.comments).toContain("@sensitive");
      expect(entry.value).toBe("");
    }
  });

  it("disables telemetry and keeps local environment files out of git", () => {
    const config = JSON.parse(readRootFile(".varlock/config.json")) as {
      readonly telemetryDisabled?: boolean;
    };
    const gitignore = readRootFile(".gitignore");

    expect(config.telemetryDisabled).toBe(true);
    expect(gitignore).toMatch(/^\.env$/m);
    expect(gitignore).toMatch(/^\.env\.\*$/m);
    expect(gitignore).toMatch(/^!\.env\.schema$/m);
  });

  it("exposes pinned validation and scanning commands", () => {
    const packageJson = JSON.parse(readRootFile("package.json")) as {
      readonly scripts?: Record<string, string>;
      readonly devDependencies?: Record<string, string>;
    };

    expect(packageJson.devDependencies?.varlock).toBe("1.13.0");
    expect(packageJson.devDependencies?.yaml).toBe("2.9.0");
    expect(packageJson.scripts?.["env:check"]).toBe("varlock load --agent");
    expect(packageJson.scripts?.["env:scan"]).toBe("varlock scan");
    expect(packageJson.scripts?.["env:scan:build"]).toBe("varlock scan dist");
    expect(packageJson.scripts?.["env:scan:staged"]).toBe("varlock scan --staged");
  });

  it("gates CI builds with schema validation and a synthetic secret", () => {
    const job = workflowJob(".github/workflows/ci.yml", "frontend");

    expectOrderedSteps(job, [
      "Install frontend dependencies",
      "Validate environment schema",
      "Build frontend with secret sentinel",
      "Scan frontend build for secret sentinel",
    ]);
    expectSentinelBuildAndScan(job);
  });

  it("gates both automatic and manual release asset builds", () => {
    const releaseGate = workflowJob(".github/workflows/release.yml", "release-gate");
    const assetBuild = workflowJob(".github/workflows/release.yml", "build-release-assets");

    for (const job of [releaseGate, assetBuild]) {
      expectOrderedSteps(job, [
        "Install frontend dependencies",
        "Validate environment schema",
        "Build frontend with secret sentinel",
        "Scan frontend build for secret sentinel",
      ]);
      expectSentinelBuildAndScan(job);
    }

    expect(assetBuild.needs).toEqual([
      "release-plz-release",
      "resolve-existing-release",
    ]);
    const checkout = assetBuild.steps?.find((step) => step.name === "Checkout released tag");
    expect(checkout?.with?.ref).toBe("${{ env.RELEASE_TAG }}");
    for (
      const stepName of [
        "Validate environment schema",
        "Build frontend with secret sentinel",
        "Scan frontend build for secret sentinel",
      ]
    ) {
      const step = assetBuild.steps?.find((candidate) => candidate.name === stepName);
      expect(step?.if).toBe("${{ hashFiles('.env.schema') != '' }}");
    }
  });

  it("accepts the feature flag vocabulary supported by the runtime", () => {
    const result = spawnSync("bun", ["run", "env:check"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: isolatedApplicationEnv({
        PUBLIC_SETTINGS_V1: "  EnAbLeD  ",
        VITE_SETTINGS_V1: "off",
        SETTINGS_V1: "1",
        PUBLIC_RIG_AGENT_V1: "canary",
        VITE_RIG_AGENT_V1: "pilot",
        RIG_AGENT_V1: " preview ",
      }),
    });

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  });

  it("rejects unsupported feature flag values", () => {
    const result = spawnSync("bun", ["run", "env:check"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: isolatedApplicationEnv({
        PUBLIC_SETTINGS_V1: "sometimes",
      }),
    });

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain("PUBLIC_SETTINGS_V1");
  });

  it("fails and redacts when a resolved secret appears in a file", () => {
    const directory = mkdtempSync(join(tmpdir(), "c4-varlock-policy-"));
    const canary = "c4-board-policy-secret-canary-v1";

    try {
      const leakPath = join(directory, "leak.txt");
      writeFileSync(leakPath, `${canary}\n`);
      const result = spawnSync("bun", ["run", "env:scan", "--", leakPath], {
        cwd: process.cwd(),
        encoding: "utf8",
        env: isolatedApplicationEnv({
          OPSYDYN_OPENAI_API_KEY: canary,
        }),
      });
      const output = `${result.stdout}${result.stderr}`;

      expect(result.status, output).toBe(1);
      expect(output).toContain("OPSYDYN_OPENAI_API_KEY");
      expect(output).not.toContain(canary);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
