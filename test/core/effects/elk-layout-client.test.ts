import { describe, expect, it, vi } from "vitest";

import { type ElkLayoutEngineLike, runElkWorkerLayout } from "@/core/effects/elk-layout-client";
import type { ElkNode } from "elkjs/lib/elk-api";

class FakeElkEngine implements ElkLayoutEngineLike {
  readonly terminateWorker = vi.fn();

  constructor(private readonly respond?: (graph: ElkNode) => Promise<ElkNode>) {}

  layout(graph: ElkNode): Promise<ElkNode> {
    return this.respond?.(graph) ?? new Promise(() => {});
  }
}

describe("ELK layout worker client", () => {
  it("returns the matching worker result and terminates the worker", async () => {
    const elk = new FakeElkEngine(async (graph) => ({ ...graph, width: 400 }));

    await expect(runElkWorkerLayout({ id: "root" }, { elkFactory: () => elk }))
      .resolves.toMatchObject({ id: "root", width: 400 });
    expect(elk.terminateWorker).toHaveBeenCalledOnce();
  });

  it("does not create a worker when already cancelled", async () => {
    const controller = new AbortController();
    const elkFactory = vi.fn(() => new FakeElkEngine());
    controller.abort();

    await expect(runElkWorkerLayout(
      { id: "root" },
      { signal: controller.signal, elkFactory },
    )).rejects.toMatchObject({ _tag: "ElkLayoutAbortedError" });
    expect(elkFactory).not.toHaveBeenCalled();
  });

  it("terminates an unresponsive worker after the timeout", async () => {
    const elk = new FakeElkEngine();

    await expect(runElkWorkerLayout(
      { id: "root" },
      { timeoutMs: 5, elkFactory: () => elk },
    )).rejects.toMatchObject({ _tag: "ElkLayoutTimeoutError", timeoutMs: 5 });
    expect(elk.terminateWorker).toHaveBeenCalledOnce();
  });

  it("surfaces a serialized worker failure", async () => {
    const elk = new FakeElkEngine(() => Promise.reject(new Error("layout failed")));

    await expect(runElkWorkerLayout(
      { id: "root" },
      { elkFactory: () => elk },
    )).rejects.toMatchObject({ _tag: "ElkLayoutWorkerError", message: "layout failed" });
    expect(elk.terminateWorker).toHaveBeenCalledOnce();
  });
});
