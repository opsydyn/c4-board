import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const VIEWPORTS = {
  desktop: { width: 1600, height: 900 },
  narrow: { width: 960, height: 720 },
} as const;
const SCENARIOS = [
  "event-driven",
  "event-driven-bridges",
  "event-driven-bridges-detail",
  "client-server",
  "hexagonal-inferred",
  "hexagonal-corrected",
] as const;

type Viewport = keyof typeof VIEWPORTS;
type Scenario = typeof SCENARIOS[number];

export interface CaptureWindow {
  pid: number;
  windowId: number;
  width: number;
  height: number;
}

export function parseWindowCandidates(output: string): CaptureWindow[] {
  return output.split("\n").filter(Boolean).map((line) => {
    const [pid, windowId, width, height] = line.split(",").map(Number);
    if (!pid || !windowId || !width || !height) {
      throw new Error(`Invalid c4-board window data: ${line}`);
    }
    return { pid, windowId, width, height };
  });
}

export function chooseCaptureWindow(
  windows: CaptureWindow[],
  requestedPid?: number,
): CaptureWindow {
  const processIds = [...new Set(windows.map(({ pid }) => pid))];
  if (requestedPid === undefined && processIds.length > 1) {
    throw new Error(`Multiple c4-board processes found (${processIds.join(", ")}); pass --pid`);
  }
  const pid = requestedPid ?? processIds[0];
  const matches = windows.filter(candidate => candidate.pid === pid);
  if (matches.length === 0) {
    throw new Error(pid ? `No c4-board window found for PID ${pid}.` : "No c4-board window found.");
  }
  if (matches.length > 1) {
    throw new Error(`Multiple c4-board windows found for PID ${pid}; close extra windows before capture.`);
  }
  return matches[0]!;
}

export function readPngDimensions(path: string): { width: number; height: number } {
  const header = readFileSync(path).subarray(0, 24);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (header.length < 24 || !header.subarray(0, 8).equals(signature) || header.toString("ascii", 12, 16) !== "IHDR") {
    throw new Error(`Captured file is not a valid PNG: ${path}`);
  }
  return {
    width: header.readUInt32BE(16),
    height: header.readUInt32BE(20),
  };
}

const run = (command: string, commandArgs: string[]) => {
  const result = spawnSync(command, commandArgs, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `${command} exited with status ${result.status}.`);
  }
  return result.stdout.trim();
};

const windowLookupScript = `
import CoreGraphics
import Foundation

let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID)
  as? [[String: Any]] ?? []
for window in windows {
  guard window[kCGWindowOwnerName as String] as? String == "c4-board",
        let pid = window[kCGWindowOwnerPID as String] as? Int,
        let number = window[kCGWindowNumber as String] as? Int,
        let layer = window[kCGWindowLayer as String] as? Int,
        layer == 0,
        let bounds = window[kCGWindowBounds as String] as? [String: Any],
        let width = bounds["Width"] as? Int,
        let height = bounds["Height"] as? Int else { continue }
  print("\\(pid),\\(number),\\(width),\\(height)")
}
`;

function scenarioPid(windows: CaptureWindow[], scenario: Scenario): number | undefined {
  const processIds = [...new Set(windows.map(({ pid }) => pid))];
  if (processIds.length <= 1) return processIds[0];
  const marker = `C4_VISUAL_FIXTURE=${scenario}`;
  const matches = processIds.filter((pid) => run("ps", ["eww", "-p", String(pid), "-o", "command="]).includes(marker));
  return matches.length === 1 ? matches[0] : undefined;
}

function prepareWindowScript(
  window: CaptureWindow,
  width: number,
  height: number,
  shouldResize: boolean,
): string {
  const resize = shouldResize
    ? `
var position = CGPoint(x: 40, y: 40)
var size = CGSize(width: ${width}, height: ${height})
guard let positionValue = AXValueCreate(.cgPoint, &position),
      let sizeValue = AXValueCreate(.cgSize, &size),
      AXUIElementSetAttributeValue(window, kAXPositionAttribute as CFString, positionValue) == .success,
      AXUIElementSetAttributeValue(window, kAXSizeAttribute as CFString, sizeValue) == .success else {
  fatalError("c4-board window resize failed")
}
`
    : "";
  return `
import ApplicationServices
import Foundation

let app = AXUIElementCreateApplication(pid_t(${window.pid}))
var value: CFTypeRef?
guard AXUIElementCopyAttributeValue(app, kAXWindowsAttribute as CFString, &value) == .success,
      let windows = value as? [AXUIElement],
      windows.count == 1,
      let window = windows.first else {
  fatalError("c4-board AX windows not found")
}
guard AXUIElementSetAttributeValue(app, kAXFrontmostAttribute as CFString, kCFBooleanTrue) == .success else {
  fatalError("c4-board process activation failed")
}
${resize}
`;
}

async function main(args: string[]): Promise<void> {
  const valueAfter = (name: string) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const viewport = valueAfter("--viewport") as Viewport | undefined;
  const scenario = valueAfter("--scenario") as Scenario | undefined;
  const requestedPidValue = valueAfter("--pid");
  const requestedPid = requestedPidValue === undefined ? undefined : Number(requestedPidValue);
  const updateBaseline = args.includes("--update-baseline");
  const skipResize = args.includes("--skip-resize");

  if (
    !viewport
    || !(viewport in VIEWPORTS)
    || !scenario
    || !SCENARIOS.includes(scenario)
    || (requestedPidValue !== undefined && (!Number.isInteger(requestedPid) || requestedPid! <= 0))
  ) {
    throw new Error(
      "Usage: bun run visual:tauri:capture -- --scenario "
        + "<event-driven|event-driven-bridges|event-driven-bridges-detail|client-server|hexagonal-inferred|hexagonal-corrected> "
        + "--viewport <desktop|narrow> [--pid <c4-board-pid>] [--skip-resize] "
        + "[--update-baseline] [--output <path>]",
    );
  }
  if (process.platform !== "darwin") {
    throw new Error("Native Tauri layout capture currently supports macOS only.");
  }

  const viewportSize = VIEWPORTS[viewport];
  const initialWindows = parseWindowCandidates(run("swift", ["-e", windowLookupScript]));
  const selectedPid = requestedPid ?? scenarioPid(initialWindows, scenario);
  const selectedWindow = chooseCaptureWindow(initialWindows, selectedPid);

  if (!skipResize) {
    run("swift", [
      "-e",
      prepareWindowScript(selectedWindow, viewportSize.width, viewportSize.height, true),
    ]);
  }
  await Bun.sleep(3_000);

  const resizedWindow = parseWindowCandidates(run("swift", ["-e", windowLookupScript]))
    .find(({ pid, windowId }) => pid === selectedWindow.pid && windowId === selectedWindow.windowId);
  if (!resizedWindow) {
    throw new Error(`Selected c4-board window ${selectedWindow.windowId} for PID ${selectedWindow.pid} disappeared.`);
  }
  if (resizedWindow.width !== viewportSize.width || resizedWindow.height !== viewportSize.height) {
    throw new Error(
      `Expected ${viewportSize.width}x${viewportSize.height} ${viewport} window, `
        + `received ${resizedWindow.width}x${resizedWindow.height}.`,
    );
  }

  const defaultRoot = updateBaseline
    ? "tests/__snapshots__/visual/tauri-layout"
    : ".artifacts/tauri-layout";
  const output = resolve(valueAfter("--output") ?? `${defaultRoot}/${scenario}-${viewport}.png`);
  mkdirSync(dirname(output), { recursive: true });
  run("screencapture", ["-x", "-o", "-l", String(selectedWindow.windowId), output]);

  const captured = readPngDimensions(output);
  if (captured.width !== viewportSize.width || captured.height !== viewportSize.height) {
    throw new Error(
      `Expected ${viewportSize.width}x${viewportSize.height} ${viewport} PNG, `
        + `received ${captured.width}x${captured.height}.`,
    );
  }
  console.log(
    `Captured ${scenario} from PID ${selectedWindow.pid}, window ${selectedWindow.windowId} `
      + `at ${captured.width}x${captured.height}: ${output}`,
  );
}

if (import.meta.main) {
  try {
    await main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(
      "Ensure `bun tauri dev` is running and Codex/Terminal has Accessibility and Screen Recording access.",
    );
    process.exit(1);
  }
}
