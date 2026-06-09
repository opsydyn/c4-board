#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const RELEVANT_PREFIXES = ["src/", "public/"] as const;

const RELEVANT_FILES = new Set([
  "astro.config.mts",
  "bun.lock",
  "bunfig.toml",
  "package.json",
  "tsconfig.json",
]);

type ReleaseSurfacePayload = {
  managedBy: "github-actions/release-plz";
  purpose: string;
  base: string;
  head: string;
  paths: string[];
};

function runGit(args: string[]): ReturnType<typeof spawnSync> {
  return spawnSync("git", args, {
    encoding: "utf8",
  });
}

function usage(): never {
  console.error(
    "usage: prepare-release-plz-surface.ts <base-ref> <head-ref> <output-path>",
  );
  process.exit(1);
}

function emptyTreeRef(): string {
  const result = runGit(["hash-object", "-t", "tree", "/dev/null"]);
  if (result.status !== 0) {
    console.error(result.stderr.trim());
    process.exit(result.status ?? 1);
  }

  return result.stdout.trim();
}

function hasGitObject(ref: string): boolean {
  if (ref.trim().length === 0) {
    return false;
  }

  const result = runGit(["cat-file", "-e", `${ref}^{object}`]);
  return result.status === 0;
}

function resolveExistingBaseRef(baseRef: string, headRef: string): string {
  if (baseRef === "0000000000000000000000000000000000000000") {
    return emptyTreeRef();
  }

  if (hasGitObject(baseRef)) {
    return baseRef;
  }

  const parentResult = runGit(["rev-parse", "--verify", `${headRef}^`]);
  if (parentResult.status === 0) {
    const fallback = parentResult.stdout.trim();
    console.warn(
      `Base ref ${baseRef} is unavailable; falling back to ${fallback}.`,
    );
    return fallback;
  }

  const fallback = emptyTreeRef();
  console.warn(
    `Base ref ${baseRef} is unavailable and ${headRef} has no parent; falling back to empty tree ${fallback}.`,
  );
  return fallback;
}

function listChangedPaths(baseRef: string, headRef: string): string[] {
  const result = runGit(["diff", "--name-only", baseRef, headRef]);

  if (result.status !== 0) {
    console.error(result.stderr.trim());
    process.exit(result.status ?? 1);
  }

  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function isRelevant(path: string): boolean {
  return (
    RELEVANT_PREFIXES.some((prefix) => path.startsWith(prefix))
    || RELEVANT_FILES.has(path)
  );
}

function loadExistingPayload(
  path: string,
): ReleaseSurfacePayload | null {
  if (!existsSync(path)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(path, "utf8")) as ReleaseSurfacePayload;
  } catch {
    return null;
  }
}

const [, , baseRef, headRef, outputPath] = process.argv;

if (!baseRef || !headRef || !outputPath) {
  usage();
}

if (!hasGitObject(headRef)) {
  console.error(`Head ref ${headRef} is unavailable.`);
  process.exit(1);
}

const resolvedBaseRef = resolveExistingBaseRef(baseRef, headRef);

const relevantPaths = listChangedPaths(resolvedBaseRef, headRef)
  .filter(isRelevant)
  .sort((left, right) => left.localeCompare(right));

if (relevantPaths.length === 0) {
  console.log("No frontend/app-shell release surface changes detected.");
  process.exit(0);
}

const payload: ReleaseSurfacePayload = {
  managedBy: "github-actions/release-plz",
  purpose: "Marks app changes outside src-tauri so release-plz can open a release PR for the desktop app.",
  base: resolvedBaseRef,
  head: headRef,
  paths: relevantPaths,
};

if (JSON.stringify(loadExistingPayload(outputPath)) === JSON.stringify(payload)) {
  console.log(`${outputPath} is already up to date.`);
  process.exit(0);
}

writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(
  `Updated ${outputPath} with ${relevantPaths.length} release-surface path(s).`,
);
