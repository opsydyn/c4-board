import { describe, expect, it } from "vitest";

import { classifyStatus, formatElapsed, notarizeSummary, parseInfoStatus, parseSubmitId } from "./notarize-macos";

/**
 * ADR-013 Phase 0. Notarisation used to run inside `tauri build`, which printed
 * one line — "Notarizing …" — and then nothing at all for 40 to 55 minutes before
 * the job either failed or was killed by its own timeout. Neither run left behind
 * a submission id, so afterwards there was no way to ask Apple what had happened.
 *
 * The point of these rules is that every outcome is diagnosable from the log
 * alone: the id is printed before the wait begins, progress is visible while it
 * runs, and a verdict of anything but Accepted is followed by Apple's own reasons.
 */

describe("parseSubmitId", () => {
  it("reads the id out of a submission response", () => {
    expect(parseSubmitId("{\"id\":\"700c46fc-42c9-4e60-9a32-69b97922b07d\",\"status\":\"In Progress\"}"))
      .toBe("700c46fc-42c9-4e60-9a32-69b97922b07d");
  });

  it("fails loudly on output that is not JSON", () => {
    // notarytool writes plain-text errors to stdout on some failures; silently
    // treating that as "no id" would lose the only handle on the submission.
    expect(() => parseSubmitId("Error: unable to authenticate")).toThrow(/could not parse/i);
  });

  it("fails when the response carries no id", () => {
    expect(() => parseSubmitId("{\"status\":\"Rejected\"}")).toThrow(/no submission id/i);
  });
});

describe("parseInfoStatus", () => {
  it("reads the status of a submission", () => {
    expect(parseInfoStatus("{\"id\":\"x\",\"status\":\"Accepted\"}")).toBe("Accepted");
  });

  it("treats unreadable output as unknown rather than throwing mid-poll", () => {
    // A single failed poll must not discard a submission that is still running:
    // the 40-minute wait died on one transient network error.
    expect(parseInfoStatus("<html>502</html>")).toBe("Unknown");
  });
});

describe("classifyStatus", () => {
  it("keeps waiting while Apple is still working", () => {
    expect(classifyStatus("In Progress")).toBe("waiting");
  });

  it("keeps waiting through an unreadable poll", () => {
    expect(classifyStatus("Unknown")).toBe("waiting");
  });

  it("accepts only an explicit Accepted", () => {
    expect(classifyStatus("Accepted")).toBe("accepted");
  });

  it("treats every rejection as a verdict, not a retry", () => {
    for (const status of ["Invalid", "Rejected"]) {
      expect(classifyStatus(status)).toBe("rejected");
    }
  });
});

describe("formatElapsed", () => {
  it("reads as minutes and seconds", () => {
    expect(formatElapsed(0)).toBe("0m00s");
    expect(formatElapsed(59_000)).toBe("0m59s");
    expect(formatElapsed(2_401_000)).toBe("40m01s");
  });
});

describe("notarizeSummary", () => {
  it("names the submission so a timeout is still diagnosable afterwards", () => {
    const summary = notarizeSummary({
      artifact: "c4-board_0.0.8_darwin_aarch64.dmg",
      id: "700c46fc-42c9-4e60-9a32-69b97922b07d",
      status: "Accepted",
      elapsedMs: 254_000,
    });

    expect(summary).toContain("700c46fc-42c9-4e60-9a32-69b97922b07d");
    expect(summary).toContain("c4-board_0.0.8_darwin_aarch64.dmg");
    expect(summary).toContain("4m14s");
  });

  it("says what to run when the verdict is not Accepted", () => {
    const summary = notarizeSummary({
      artifact: "x.dmg",
      id: "abc",
      status: "Invalid",
      elapsedMs: 1_000,
    });

    expect(summary).toMatch(/notarytool log abc/);
  });
});
