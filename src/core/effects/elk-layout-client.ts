import { Data } from "effect";
import type { ElkNode } from "elkjs/lib/elk-api";
import ELK from "elkjs/lib/elk-api.js";
import ElkWorker from "elkjs/lib/elk-worker.min.js?worker";

export class ElkLayoutAbortedError extends Data.TaggedError("ElkLayoutAbortedError")<{
  message: string;
}> {}

export class ElkLayoutTimeoutError extends Data.TaggedError("ElkLayoutTimeoutError")<{
  message: string;
  timeoutMs: number;
}> {}

export class ElkLayoutWorkerError extends Data.TaggedError("ElkLayoutWorkerError")<{
  message: string;
}> {}

type ElkLayoutError =
  | ElkLayoutAbortedError
  | ElkLayoutTimeoutError
  | ElkLayoutWorkerError;

export interface ElkLayoutEngineLike {
  layout(graph: ElkNode): Promise<ElkNode>;
  terminateWorker(): void;
}

export interface ElkLayoutClientOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  elkFactory?: () => ElkLayoutEngineLike;
}

export function createElkLayoutEngine(): ElkLayoutEngineLike {
  const worker = new ElkWorker();
  return new ELK({
    algorithms: ["layered"],
    workerFactory: () => worker,
  });
}

export function runElkWorkerLayout(
  graph: ElkNode,
  options: ElkLayoutClientOptions = {},
): Promise<ElkNode> {
  const timeoutMs = options.timeoutMs ?? 10_000;

  if (options.signal?.aborted) {
    return Promise.reject(new ElkLayoutAbortedError({ message: "ELK layout was cancelled." }));
  }

  return new Promise((resolve, reject) => {
    const elk = (options.elkFactory ?? createElkLayoutEngine)();
    let settled = false;

    const cleanup = () => {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", onAbort);
      elk.terminateWorker();
    };
    const fail = (error: ElkLayoutError) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const onAbort = () => fail(new ElkLayoutAbortedError({ message: "ELK layout was cancelled." }));
    const timeout = setTimeout(() =>
      fail(
        new ElkLayoutTimeoutError({
          message: `ELK layout exceeded ${timeoutMs}ms.`,
          timeoutMs,
        }),
      ), timeoutMs);

    options.signal?.addEventListener("abort", onAbort, { once: true });
    void Promise.resolve()
      .then(() => elk.layout(graph))
      .then((result) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      })
      .catch((error: unknown) => {
        fail(
          new ElkLayoutWorkerError({
            message: error instanceof Error ? error.message : String(error),
          }),
        );
      });
  });
}
