/**
 * Notarises and staples macOS bundles, outside `tauri build`.
 *
 * ADR-013 Phase 0. The bundler notarises inline whenever it can authenticate,
 * which produced a single "Notarizing …" line and then 40 to 55 minutes of
 * silence, ending in a job timeout on one runner and a network error on the
 * other. Neither left a submission id behind, so afterwards there was no way to
 * ask Apple whether it had ever finished, or why it had not.
 *
 * The credentials are therefore withheld from the build (see apple-signing-env.ts)
 * and the work happens here, where three things are true:
 *
 *  - the submission id is printed *before* the wait starts, so even a killed job
 *    leaves something to query;
 *  - progress is polled and logged, so a slow submission looks different from a
 *    hung one;
 *  - any verdict other than Accepted is followed by Apple's own developer log,
 *    which is what distinguishes a rejected binary from an account that has not
 *    been approved for notarisation (error 7000).
 *
 * Retrying no longer means rebuilding: the artifacts are already on disk.
 */

export type Verdict = "waiting" | "accepted" | "rejected";

/** Reads the id from `notarytool submit --output-format json`. */
export const parseSubmitId = (stdout: string): string => {
  let parsed: { id?: unknown };
  try {
    parsed = JSON.parse(stdout) as { id?: unknown };
  } catch {
    // notarytool writes plain-text errors to stdout in some failure modes, and
    // swallowing that would throw away the only handle on the submission.
    throw new Error(`could not parse notarytool output as JSON: ${stdout.slice(0, 400)}`);
  }

  if (typeof parsed.id !== "string" || parsed.id.length === 0) {
    throw new Error(`notarytool returned no submission id: ${stdout.slice(0, 400)}`);
  }
  return parsed.id;
};

/**
 * Reads the status from `notarytool info`. Unreadable output is "Unknown" rather
 * than an error: one bad poll must not discard a submission still in flight.
 */
export const parseInfoStatus = (stdout: string): string => {
  try {
    const parsed = JSON.parse(stdout) as { status?: unknown };
    return typeof parsed.status === "string" ? parsed.status : "Unknown";
  } catch {
    return "Unknown";
  }
};

export const classifyStatus = (status: string): Verdict => {
  if (status === "Accepted") return "accepted";
  // Anything Apple names as a refusal is final; retrying cannot change it.
  if (status === "Invalid" || status === "Rejected") return "rejected";
  return "waiting";
};

export const formatElapsed = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}m${String(total % 60).padStart(2, "0")}s`;
};

export interface NotarizeOutcome {
  readonly artifact: string;
  readonly id: string;
  readonly status: string;
  readonly elapsedMs: number;
}

export const notarizeSummary = ({ artifact, id, status, elapsedMs }: NotarizeOutcome): string => {
  const head = `${artifact}: ${status} after ${formatElapsed(elapsedMs)} (submission ${id})`;
  return classifyStatus(status) === "accepted"
    ? head
    : `${head}\n  Apple's reasons: xcrun notarytool log ${id} --key-id … --issuer …`;
};
