/**
 * Entry point for notarisation. Separate from notarize-macos.ts because that file
 * is unit-tested, and Vite statically resolves `import("bun")` even on a branch it
 * will never execute — so the Bun-only shell cannot share a module with the pure
 * core. Which is the split this codebase asks for anyway.
 *
 * Usage: bun .github/scripts/notarize-macos.run.ts
 */

import { $ } from "bun";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { classifyStatus, formatElapsed, notarizeSummary, parseInfoStatus, parseSubmitId } from "./notarize-macos";

const { $ } = await import("bun");
const { readdir } = await import("node:fs/promises");
const { join } = await import("node:path");

const need = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    console.error(`::error::${name} is required to notarise`);
    process.exit(1);
  }
  return value;
};

const keyPath = need("APPLE_API_KEY_PATH");
const keyId = need("APPLE_API_KEY");
const issuer = need("APPLE_API_ISSUER");
const bundleDir = process.env["MACOS_BUNDLE_DIR"] ?? "target/release/bundle";
// Apple's median is minutes; a first-ever submission for a team can take far
// longer. Bounded so this fails with our diagnosis rather than the job's timeout.
const waitLimitMs = Number(process.env["NOTARIZE_TIMEOUT_MINUTES"] ?? "45") * 60_000;
const pollMs = 30_000;

const auth = ["--key", keyPath, "--key-id", keyId, "--issuer", issuer] as const;

const dmgDir = join(bundleDir, "dmg");
const artifacts = await readdir(dmgDir)
  .then((names) => names.filter((name) => name.endsWith(".dmg")).map((name) => join(dmgDir, name)))
  .catch(() => [] as string[]);

if (artifacts.length === 0) {
  console.error(`::error::No .dmg found under ${dmgDir}; nothing to notarise`);
  process.exit(1);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let failed = false;

for (const artifact of artifacts) {
  const name = artifact.split("/").pop() ?? artifact;
  console.log(`::group::Notarising ${name}`);
  const startedAt = performance.now();

  // Submitted without --wait so the id is in the log before the waiting starts.
  // The previous runs died holding an id nobody ever saw.
  const submit = await $`xcrun notarytool submit ${artifact} ${auth} --output-format json`
    .quiet().nothrow();
  const submitOut = submit.stdout.toString().trim();

  let id: string;
  try {
    id = parseSubmitId(submitOut);
  } catch (cause) {
    console.error(`::error::${name}: ${cause instanceof Error ? cause.message : String(cause)}`);
    console.log("::endgroup::");
    failed = true;
    continue;
  }
  console.log(`  submission ${id} — poll with: xcrun notarytool info ${id}`);

  let status = "In Progress";
  while (classifyStatus(status) === "waiting") {
    const elapsed = performance.now() - startedAt;
    if (elapsed > waitLimitMs) {
      status = "TimedOut";
      break;
    }
    await sleep(pollMs);
    const info = await $`xcrun notarytool info ${id} ${auth} --output-format json`
      .quiet().nothrow();
    status = parseInfoStatus(info.stdout.toString());
    console.log(`  [${formatElapsed(performance.now() - startedAt)}] ${status}`);
  }

  const elapsedMs = performance.now() - startedAt;
  console.log(notarizeSummary({ artifact: name, id, status, elapsedMs }));

  if (classifyStatus(status) !== "accepted") {
    // Apple's developer log is the only thing that separates a rejected binary
    // from a team not yet approved for notarisation (error 7000).
    console.log(`  fetching Apple's developer log for ${id}`);
    await $`xcrun notarytool log ${id} ${auth}`.nothrow();
    console.error(`::error::${name} was not notarised (${status}); submission ${id}`);
    console.log("::endgroup::");
    failed = true;
    continue;
  }

  await $`xcrun stapler staple ${artifact}`.nothrow();
  const validated = await $`xcrun stapler validate ${artifact}`.nothrow();
  if (validated.exitCode !== 0) {
    console.error(`::error::${name} notarised but the ticket would not staple`);
    failed = true;
  } else {
    console.log(`  stapled and validated ${name}`);
  }
  console.log("::endgroup::");
}

process.exit(failed ? 1 : 0);
