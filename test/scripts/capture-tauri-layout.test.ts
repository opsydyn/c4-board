import { describe, expect, it } from "vitest";

import { prepareWindowScript } from "../../.github/scripts/capture-tauri-layout";

const captureWindow = {
  pid: 501,
  windowId: 9001,
  width: 800,
  height: 600,
};

describe("native Tauri capture window preparation", () => {
  it("activates the selected process without AX resize work when resize is skipped", () => {
    const script = prepareWindowScript(captureWindow, 1600, 900, false);

    expect(script).toContain("import AppKit");
    expect(script).toContain("NSRunningApplication(processIdentifier: pid_t(501))");
    expect(script).toContain("app.activate(options: [.activateIgnoringOtherApps])");
    expect(script).not.toContain("AXUIElementCreateApplication");
    expect(script).not.toContain("kAXPositionAttribute");
    expect(script).not.toContain("kAXSizeAttribute");
  });

  it("keeps AX window resizing when resize is requested", () => {
    const script = prepareWindowScript(captureWindow, 1600, 900, true);

    expect(script).toContain("AXUIElementCreateApplication(pid_t(501))");
    expect(script).toContain("kAXPositionAttribute");
    expect(script).toContain("kAXSizeAttribute");
    expect(script).toContain("CGSize(width: 1600, height: 900)");
  });
});
