/**
 * Stale-result dropping (Gate 2).
 *
 * When an async stage finishes, the flow that started it may already be gone —
 * cancelled, timed out, failed, or superseded by a newer request, possibly in a
 * different session. Letting that result land mutates a surface that has moved
 * on: an answer to a question nobody asked appears under a board it was never
 * about.
 *
 * The decision was previously inline in a 4,500-line component and untested.
 */

import { resolveOpyLifecycleStaleness } from "@/core/effects/opy-agent.staleness";
import { describe, expect, it } from "vitest";

const state = (overrides?: Partial<Parameters<typeof resolveOpyLifecycleStaleness>[0]["lifecycle"]>) => ({
  activeRequestId: "request-1",
  lastRequestId: null,
  terminalStatus: null,
  errorSummary: null,
  ...overrides,
});

describe("resolveOpyLifecycleStaleness", () => {
  it("lets a result land when its request is still the active one", () => {
    const outcome = resolveOpyLifecycleStaleness({
      lifecycle: state(),
      requestId: "request-1",
    });

    expect(outcome).toBeNull();
  });

  it("drops a result whose flow was superseded by a newer request", () => {
    const outcome = resolveOpyLifecycleStaleness({
      lifecycle: state({ activeRequestId: "request-2" }),
      requestId: "request-1",
    });

    expect(outcome?.terminalStatus).toBe("cancelled");
    expect(outcome?.message).toContain("SUPERSEDED");
  });

  it("drops a result when no flow is active at all", () => {
    const outcome = resolveOpyLifecycleStaleness({
      lifecycle: state({ activeRequestId: null }),
      requestId: "request-1",
    });

    expect(outcome?.terminalStatus).toBe("cancelled");
  });

  it("reports the recorded failure when the flow already failed, rather than calling it cancelled", () => {
    const outcome = resolveOpyLifecycleStaleness({
      lifecycle: state({
        activeRequestId: null,
        lastRequestId: "request-1",
        terminalStatus: "failed",
        errorSummary: "PLANNER OFFLINE.",
      }),
      requestId: "request-1",
    });

    expect(outcome?.terminalStatus).toBe("failed");
    expect(outcome?.message).toBe("PLANNER OFFLINE.");
  });

  it("still explains a failed flow that recorded no error summary", () => {
    const outcome = resolveOpyLifecycleStaleness({
      lifecycle: state({
        activeRequestId: null,
        lastRequestId: "request-1",
        terminalStatus: "failed",
        errorSummary: null,
      }),
      requestId: "request-1",
    });

    expect(outcome?.terminalStatus).toBe("failed");
    expect(outcome?.message.length).toBeGreaterThan(0);
  });

  it("does not attribute an older request's failure to a different request", () => {
    const outcome = resolveOpyLifecycleStaleness({
      lifecycle: state({
        activeRequestId: null,
        lastRequestId: "request-9",
        terminalStatus: "failed",
        errorSummary: "PLANNER OFFLINE.",
      }),
      requestId: "request-1",
    });

    expect(outcome?.terminalStatus).toBe("cancelled");
    expect(outcome?.message).not.toBe("PLANNER OFFLINE.");
  });

  it("drops a result from a flow that completed, since nothing is waiting for it", () => {
    const outcome = resolveOpyLifecycleStaleness({
      lifecycle: state({
        activeRequestId: null,
        lastRequestId: "request-1",
        terminalStatus: "completed",
      }),
      requestId: "request-1",
    });

    expect(outcome?.terminalStatus).toBe("cancelled");
  });

  it("isolates sessions: a result cannot land because some flow is active elsewhere", () => {
    // The board switched sessions, which started a new flow. The in-flight read
    // from the previous session must not paint its answer onto the new board.
    const outcome = resolveOpyLifecycleStaleness({
      lifecycle: state({ activeRequestId: "session-2-request" }),
      requestId: "session-1-request",
    });

    expect(outcome).not.toBeNull();
    expect(outcome?.terminalStatus).toBe("cancelled");
  });
});
