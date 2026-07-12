import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const VIEWPORTS = {
  desktop: { width: 1600, height: 900 },
  narrow: { width: 960, height: 720 },
} as const;
const SCENARIOS = [
  "event-driven",
  "event-driven-bridges",
  "client-server",
  "hexagonal-inferred",
  "hexagonal-corrected",
] as const;

type Viewport = keyof typeof VIEWPORTS;
type Scenario = typeof SCENARIOS[number];

const args = process.argv.slice(2);
const valueAfter = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const viewport = valueAfter("--viewport") as Viewport | undefined;
const scenario = valueAfter("--scenario") as Scenario | undefined;
const updateBaseline = args.includes("--update-baseline");
const skipResize = args.includes("--skip-resize");

if (!viewport || !(viewport in VIEWPORTS) || !scenario || !SCENARIOS.includes(scenario)) {
  console.error(
    "Usage: bun run visual:tauri:capture -- --scenario <event-driven|event-driven-bridges|client-server|hexagonal-inferred|hexagonal-corrected> "
      + "--viewport <desktop|narrow> [--skip-resize] [--update-baseline] [--output <path>]",
  );
  process.exit(1);
}

if (process.platform !== "darwin") {
  console.error("Native Tauri layout capture currently supports macOS only.");
  process.exit(1);
}

const run = (command: string, commandArgs: string[]) => {
  const result = spawnSync(command, commandArgs, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `${command} exited with status ${result.status}.`);
  }
  return result.stdout.trim();
};

const viewportSize = VIEWPORTS[viewport];
const resizeScript = `
import ApplicationServices
import CoreGraphics
import Foundation

let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID)
  as? [[String: Any]] ?? []
guard let owner = windows.first(where: {
  $0[kCGWindowOwnerName as String] as? String == "c4-board"
}), let pid = owner[kCGWindowOwnerPID as String] as? Int else {
  fatalError("c4-board process not found")
}
let app = AXUIElementCreateApplication(pid_t(pid))
var value: CFTypeRef?
guard AXUIElementCopyAttributeValue(app, kAXWindowsAttribute as CFString, &value) == .success,
      let axWindows = value as? [AXUIElement],
      let window = axWindows.first else {
  fatalError("c4-board AX window not found")
}
var position = CGPoint(x: 40, y: 40)
var size = CGSize(width: ${viewportSize.width}, height: ${viewportSize.height})
guard let positionValue = AXValueCreate(.cgPoint, &position),
      let sizeValue = AXValueCreate(.cgSize, &size),
      AXUIElementSetAttributeValue(window, kAXPositionAttribute as CFString, positionValue) == .success,
      AXUIElementSetAttributeValue(window, kAXSizeAttribute as CFString, sizeValue) == .success else {
  fatalError("c4-board window resize failed")
}
`;

try {
  if (!skipResize) run("swift", ["-e", resizeScript]);
  await Bun.sleep(3_000);

  const windowLookup = `
import CoreGraphics
import Foundation

let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID)
  as? [[String: Any]] ?? []
for window in windows {
  guard window[kCGWindowOwnerName as String] as? String == "c4-board",
        let number = window[kCGWindowNumber as String] as? Int,
        let bounds = window[kCGWindowBounds as String] as? [String: Any],
        let width = bounds["Width"] as? Int,
        let height = bounds["Height"] as? Int else { continue }
  print("\\(number),\\(width),\\(height)")
  break
}
`;
  const windowInfo = run("swift", ["-e", windowLookup]);
  const [windowId, actualWidth, actualHeight] = windowInfo.split(",").map(Number);
  if (!windowId || actualWidth !== viewportSize.width || actualHeight !== viewportSize.height) {
    throw new Error(
      `Expected ${viewportSize.width}x${viewportSize.height} ${viewport} window, `
        + `received ${actualWidth}x${actualHeight}.`,
    );
  }

  const defaultRoot = updateBaseline
    ? "tests/__snapshots__/visual/tauri-layout"
    : ".artifacts/tauri-layout";
  const output = resolve(valueAfter("--output") ?? `${defaultRoot}/${scenario}-${viewport}.png`);
  mkdirSync(dirname(output), { recursive: true });
  run("screencapture", ["-x", "-o", "-l", String(windowId), output]);
  console.log(`Captured ${scenario} at ${actualWidth}x${actualHeight}: ${output}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error("Ensure `bun tauri dev` is running and Codex/Terminal has Accessibility and Screen Recording access.");
  process.exit(1);
}
