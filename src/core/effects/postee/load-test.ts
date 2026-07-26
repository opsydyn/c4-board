import { invoke } from "@tauri-apps/api/core";
import { type EventCallback, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Data, Effect } from "effect";
import type { GraphqlDraftIssue } from "./graphql";
import { evaluateRequestSemantics, getEffectiveRequestPayload, type RequestSemanticsIssue } from "./http-method-policy";
import { type PosteeRequestDraft, preparePosteeDraftBody, preparePosteeDraftHeaders } from "./request-draft";
import type { HttpMethod } from "./types";

const hasTauriInjection = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  const anyWindow = window as unknown as Record<string, unknown>;
  const userAgentLooksLikeTauri = typeof navigator !== "undefined"
    && /tauri/i.test(navigator.userAgent ?? "");

  return (
    typeof anyWindow.__TAURI_INTERNALS__ !== "undefined"
    || typeof anyWindow.__TAURI_IPC__ === "function"
    || typeof anyWindow.__TAURI__ !== "undefined"
    || userAgentLooksLikeTauri
  );
};

let tauriDetectionPromise: Promise<boolean> | null = null;

export const ensureTauriRuntime = async (): Promise<boolean> => {
  if (typeof window === "undefined") {
    return false;
  }

  if (hasTauriInjection()) {
    return true;
  }

  if (!tauriDetectionPromise) {
    tauriDetectionPromise = new Promise<boolean>((resolve) => {
      if (hasTauriInjection()) {
        resolve(true);
        return;
      }

      const deadlineMs = 5000;
      const pollIntervalMs = 100;
      let elapsed = 0;

      const resolveAndCleanup = (value: boolean) => {
        window.removeEventListener("tauri://ready", readyHandler);
        window.clearInterval(pollHandle);
        resolve(value);
      };

      const readyHandler = () => resolveAndCleanup(true);

      const pollHandle = window.setInterval(() => {
        if (hasTauriInjection()) {
          resolveAndCleanup(true);
          return;
        }

        elapsed += pollIntervalMs;
        if (elapsed >= deadlineMs) {
          resolveAndCleanup(hasTauriInjection());
        }
      }, pollIntervalMs);

      window.addEventListener("tauri://ready", readyHandler, {
        once: true,
      });
    });
  }

  return tauriDetectionPromise.catch(() => false);
};

export const isTauriRuntime = (): boolean => hasTauriInjection();

const requireTauriRuntime = async (): Promise<void> => {
  const ready = await ensureTauriRuntime();
  if (!ready) {
    throw new Error("Load testing requires the desktop runtime.");
  }
};

export interface LoadTestConfigInput {
  url: string;
  method: string;
  headers?: Array<{ key: string; value: string }>;
  body?: string | null;
  durationSecs?: number;
  concurrency?: number;
  rpsLimit?: number | null;
  timeoutMs?: number;
  /** Statuses that count as a pass. Omitted or empty means 2xx. ADR-019 slice 4. */
  successStatuses?: number[] | null;
  /** Redirects to follow; 0 stops following them. Omitted keeps the default of 10. */
  maxRedirects?: number | null;
}

export type LoadTestRequestPayload =
  | {
    readonly _tag: "Valid";
    readonly method: string;
    readonly headers: ReadonlyArray<{ readonly key: string; readonly value: string }>;
    readonly body: string | null;
  }
  | {
    readonly _tag: "Invalid";
    readonly message: RequestSemanticsIssue | GraphqlDraftIssue;
  };

export const buildLoadTestRequestPayload = (
  method: HttpMethod,
  draft: PosteeRequestDraft,
): LoadTestRequestPayload => {
  if (draft.body.mode === "graphql" && method !== "POST") {
    return { _tag: "Invalid", message: "GraphQL requests require POST." };
  }
  const preparedBody = Effect.runSync(
    preparePosteeDraftBody(draft).pipe(
      Effect.match({
        onFailure: (message) => ({ _tag: "Invalid" as const, message }),
        onSuccess: (body) => ({ _tag: "Valid" as const, body }),
      }),
    ),
  );
  if (preparedBody._tag === "Invalid") {
    return preparedBody;
  }
  const headers = preparePosteeDraftHeaders(draft)
    .map(({ key, value }) => ({ key, value }));
  const issue = evaluateRequestSemantics(method, headers, preparedBody.body);
  const payload = getEffectiveRequestPayload(method, headers, preparedBody.body);

  return issue
    ? { _tag: "Invalid", message: issue }
    : {
      _tag: "Valid",
      method,
      headers: payload.headers,
      body: payload.body,
    };
};

export interface LoadTestProgress {
  elapsed_ms: number;
  requests_sent: number;
  requests_success: number;
  requests_failed: number;
  rps: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  avg_latency_ms: number;
  min_latency_ms: number;
  max_latency_ms: number;
  bytes_received: number;
  error_count: number;
  recent_errors: string[];

  /**
   * The window since the previous snapshot rather than the whole run. ADR-019.
   *
   * Charts plot these; the cumulative fields above are for the final summary. A
   * running average cannot show a dip and a whole-run p95 cannot show a recovery,
   * so drawing the cumulative series on a time axis implied a meaning it did not
   * have.
   */
  interval_ms: number;
  interval_requests_sent: number;
  interval_requests_success: number;
  interval_requests_failed: number;
  interval_rps: number;
  interval_p50_latency_ms: number;
  interval_p95_latency_ms: number;
  interval_p99_latency_ms: number;

  /**
   * Outcome model. ADR-019 slice 1.
   *
   * A 503 is a response the service chose to send; a refused connection is not a
   * response at all. Both used to be counted only as "failed".
   */
  responses_received: number;
  transport_failures: number;
  transport_timeouts: number;
  transport_connect_failures: number;

  /** Responses by exact status code, keyed by code. ADR-019 slice 2. */
  status_counts: Record<string, number>;

  /**
   * Latency per status class, omitting classes nothing landed in. A merged p99
   * across every status describes neither the successes nor the errors.
   */
  status_classes: Array<{
    class: string;
    count: number;
    p50_latency_ms: number;
    p95_latency_ms: number;
    p99_latency_ms: number;
  }>;
}

export type LoadTestEventCallback = EventCallback<LoadTestProgress>;
export type LoadTestErrorCallback = EventCallback<string>;

export class LoadTestRuntimeError extends Data.TaggedError("LoadTestRuntimeError")<{
  readonly message: string;
  readonly cause: unknown;
}> {}

const toLoadTestRuntimeError = (cause: unknown, fallbackMessage: string): LoadTestRuntimeError =>
  new LoadTestRuntimeError({
    message: cause instanceof Error ? cause.message : fallbackMessage,
    cause,
  });

const toBackendConfig = (input: LoadTestConfigInput) => ({
  url: input.url,
  method: input.method,
  headers: input.headers?.map(({ key, value }) => [key, value] as [string, string])
    ?? [],
  body: input.body ?? null,
  duration_secs: input.durationSecs ?? 10,
  concurrency: input.concurrency ?? 10,
  rps_limit: input.rpsLimit ?? null,
  timeout_ms: input.timeoutMs ?? 30_000,
  success_statuses: input.successStatuses ?? null,
  max_redirects: input.maxRedirects ?? null,
});

export const startLoadTest = (
  config: LoadTestConfigInput,
): Effect.Effect<void, LoadTestRuntimeError> =>
  Effect.tryPromise({
    try: async () => {
      await requireTauriRuntime();

      await invoke("start_load_test", {
        config: toBackendConfig(config),
      });
    },
    catch: (cause) => toLoadTestRuntimeError(cause, "Failed to start load test"),
  });

/**
 * Ask the backend to stop the run in flight. ADR-019.
 *
 * Idempotent, and stopping nothing succeeds: a run can finish between the button
 * rendering and the click, and surfacing that as an error would show a failure
 * for having worked. Workers finish the request already in flight and the stats
 * gathered so far are reported — a partial measurement is still a measurement.
 */
export const stopLoadTest = (): Effect.Effect<void, LoadTestRuntimeError> =>
  Effect.tryPromise({
    try: async () => {
      await requireTauriRuntime();

      await invoke("stop_load_test");
    },
    catch: (cause) => toLoadTestRuntimeError(cause, "Failed to stop load test"),
  });

export const listenLoadTestProgress = (
  callback: LoadTestEventCallback,
): Effect.Effect<UnlistenFn, LoadTestRuntimeError> =>
  Effect.tryPromise({
    try: async () => {
      await requireTauriRuntime();

      return await listen("load-test-progress", callback);
    },
    catch: (cause) => toLoadTestRuntimeError(cause, "Failed to subscribe to load test progress"),
  });

export const listenLoadTestComplete = (
  callback: LoadTestEventCallback,
): Effect.Effect<UnlistenFn, LoadTestRuntimeError> =>
  Effect.tryPromise({
    try: async () => {
      await requireTauriRuntime();

      return await listen("load-test-complete", callback);
    },
    catch: (cause) => toLoadTestRuntimeError(cause, "Failed to subscribe to load test completion"),
  });

export const listenLoadTestError = (
  callback: LoadTestErrorCallback,
): Effect.Effect<UnlistenFn, LoadTestRuntimeError> =>
  Effect.tryPromise({
    try: async () => {
      await requireTauriRuntime();

      return await listen("load-test-error", callback);
    },
    catch: (cause) => toLoadTestRuntimeError(cause, "Failed to subscribe to load test errors"),
  });
