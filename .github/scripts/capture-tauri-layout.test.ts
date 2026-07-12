import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { chooseCaptureWindow, parseWindowCandidates, readPngDimensions } from "./capture-tauri-layout";

describe("native Tauri layout capture", () => {
  const windows = parseWindowCandidates([
    "501,9001,1600,900",
    "502,9002,960,720",
    "501,9003,800,600",
  ].join("\n"));

  it("keeps resize and capture on the explicitly selected process and frontmost window", () => {
    expect(chooseCaptureWindow(windows, 502)).toEqual({
      pid: 502,
      windowId: 9002,
      width: 960,
      height: 720,
    });
  });

  it("rejects ambiguous windows within the selected process", () => {
    expect(() => chooseCaptureWindow(windows, 501)).toThrow(
      "Multiple c4-board windows found for PID 501; close extra windows before capture.",
    );
  });

  it("selects the only window for an unambiguous process", () => {
    expect(chooseCaptureWindow([windows[0]!])).toEqual({
      pid: 501,
      windowId: 9001,
      width: 1600,
      height: 900,
    });
  });

  it("rejects an ambiguous process selection", () => {
    expect(() => chooseCaptureWindow(windows)).toThrow(
      "Multiple c4-board processes found (501, 502); pass --pid",
    );
  });

  it("reads the dimensions from the captured PNG rather than trusting the source window", () => {
    const directory = mkdtempSync(join(tmpdir(), "c4-board-capture-"));
    const path = join(directory, "capture.png");
    const header = Buffer.alloc(24);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(header, 0);
    header.write("IHDR", 12, "ascii");
    header.writeUInt32BE(960, 16);
    header.writeUInt32BE(720, 20);
    writeFileSync(path, header);

    expect(readPngDimensions(path)).toEqual({ width: 960, height: 720 });
  });
});
