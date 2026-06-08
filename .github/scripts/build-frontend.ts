import { spawn } from "node:child_process";

const DEFAULT_HEAP_MB = "4096";

const heapMb = process.env.C4_BOARD_BUILD_HEAP_MB?.trim() || DEFAULT_HEAP_MB;
const heapOption = `--max-old-space-size=${heapMb}`;
const existingNodeOptions = process.env.NODE_OPTIONS?.trim() ?? "";
const nodeOptions = existingNodeOptions.includes("--max-old-space-size")
  ? existingNodeOptions
  : [existingNodeOptions, heapOption].filter(Boolean).join(" ");

const env = {
  ...process.env,
  NODE_OPTIONS: nodeOptions,
};

const run = async (label: string, command: string[]) => {
  console.log(`[build] ${label}`);
  console.log(`[build] NODE_OPTIONS=${nodeOptions}`);

  const [executable, ...args] = command;
  if (!executable) {
    throw new Error(`No executable configured for ${label}`);
  }

  const exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn(executable, args, {
      env,
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        console.error(`[build] ${label} terminated by signal ${signal}`);
        resolve(1);
        return;
      }

      resolve(code ?? 1);
    });
  });

  if (exitCode !== 0) {
    console.error(`[build] ${label} failed with exit code ${exitCode}`);
    process.exit(exitCode);
  }
};

await run("Astro check", ["bun", "run", "astro", "check"]);
await run("Astro build", ["bun", "run", "astro", "build"]);
export {};
