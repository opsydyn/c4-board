import { invoke } from "@tauri-apps/api/core";
import { type EventCallback, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Data, Effect } from "effect";

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
  method?: string;
  headers?: Array<{ key: string; value: string }>;
  body?: string | null;
  durationSecs?: number;
  concurrency?: number;
  rpsLimit?: number | null;
  timeoutMs?: number;
}

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
  method: input.method ?? "GET",
  headers: input.headers?.map(({ key, value }) => [key, value] as [string, string])
    ?? [],
  body: input.body ?? null,
  duration_secs: input.durationSecs ?? 10,
  concurrency: input.concurrency ?? 10,
  rps_limit: input.rpsLimit ?? null,
  timeout_ms: input.timeoutMs ?? 30_000,
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
