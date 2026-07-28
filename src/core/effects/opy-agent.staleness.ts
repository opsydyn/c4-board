/**
 * Decides whether an async lifecycle result is still wanted (Gate 2).
 *
 * Every OPY stage that awaits something — a provider call, a persistence write,
 * a board mutation — can return after the flow that started it is gone. It may
 * have been cancelled, timed out, failed, or superseded by a newer request in
 * another session entirely. A late result that lands anyway writes an answer
 * onto a surface that has moved on.
 *
 * Session isolation falls out of the same check rather than needing its own:
 * switching sessions replaces the active request, so anything in flight from
 * the previous one no longer matches and is dropped. Comparing session ids as
 * well would be redundant, and would wrongly admit a superseded result that
 * happened to belong to the same session.
 */

export type OpyLifecycleStaleTerminalStatus = "cancelled" | "failed";

export interface OpyLifecycleStalenessState {
  readonly activeRequestId: string | null;
  readonly lastRequestId: string | null;
  readonly terminalStatus: string | null;
  readonly errorSummary: string | null;
}

export interface OpyLifecycleStaleOutcome {
  readonly message: string;
  readonly terminalStatus: OpyLifecycleStaleTerminalStatus;
}

const FAILED_WITHOUT_SUMMARY = "FLOW FAILED BEFORE THE CURRENT STAGE COULD COMPLETE.";
const SUPERSEDED = "FLOW CANCELLED OR SUPERSEDED BEFORE THE CURRENT STAGE COULD COMPLETE.";

/**
 * Returns `null` when the result is still wanted, or why it should be dropped.
 *
 * A recorded failure is only attributed to the request that actually failed —
 * otherwise an unrelated late result would inherit someone else's error message
 * and send the operator after the wrong problem.
 */
export const resolveOpyLifecycleStaleness = (input: {
  readonly lifecycle: OpyLifecycleStalenessState;
  readonly requestId: string;
}): OpyLifecycleStaleOutcome | null => {
  const { lifecycle, requestId } = input;

  if (lifecycle.activeRequestId === requestId) {
    return null;
  }

  if (lifecycle.lastRequestId === requestId && lifecycle.terminalStatus === "failed") {
    return {
      message: lifecycle.errorSummary ?? FAILED_WITHOUT_SUMMARY,
      terminalStatus: "failed",
    };
  }

  return {
    message: SUPERSEDED,
    terminalStatus: "cancelled",
  };
};
