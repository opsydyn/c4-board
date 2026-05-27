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

function usage(): never {
	console.error(
		"usage: prepare-release-plz-surface.ts <base-ref> <head-ref> <output-path>",
	);
	process.exit(1);
}

function listChangedPaths(baseRef: string, headRef: string): string[] {
	const result = spawnSync("git", ["diff", "--name-only", baseRef, headRef], {
		encoding: "utf8",
	});

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
		RELEVANT_PREFIXES.some((prefix) => path.startsWith(prefix)) ||
		RELEVANT_FILES.has(path)
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

const relevantPaths = listChangedPaths(baseRef, headRef)
	.filter(isRelevant)
	.sort((left, right) => left.localeCompare(right));

if (relevantPaths.length === 0) {
	console.log("No frontend/app-shell release surface changes detected.");
	process.exit(0);
}

const payload: ReleaseSurfacePayload = {
	managedBy: "github-actions/release-plz",
	purpose:
		"Marks app changes outside src-tauri so release-plz can open a release PR for the desktop app.",
	base: baseRef,
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
