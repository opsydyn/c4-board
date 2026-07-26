import type { PosteeRequestDraft } from "@/core/effects/postee";
import { LoadTestPanel } from "@/ui/components/postee/LoadTestPanel";
import type { LoadTestState } from "@/ui/components/postee/useLoadTest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const { useLoadTestMock } = vi.hoisted(() => ({
  useLoadTestMock: vi.fn(),
}));

vi.mock("@/ui/components/postee/useLoadTest", () => ({
  useLoadTest: useLoadTestMock,
}));

vi.mock("tone", () => ({
  start: vi.fn(),
  LFO: class {},
  Oscillator: class {},
}));

const makeIdleLoadTestState = (
  overrides: Partial<LoadTestState> = {},
): LoadTestState => ({
  status: "idle",
  error: null,
  latest: null,
  samples: [],
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  isSupported: true,
  isDetecting: false,
  reset: vi.fn(),
  ...overrides,
});

const queryJsonDraft: PosteeRequestDraft = {
  request: {
    id: "query-1",
    collection_id: "collection-1",
    name: "Query JSON",
    method: "QUERY",
    url: "https://example.com/feed",
    description: null,
    favorite: 0,
    sort_order: 0,
    created_at: 1,
    updated_at: 1,
  },
  headers: [],
  body: {
    request_id: "query-1",
    mode: "json",
    raw: "{\"q\":\"opsy\"}",
    form_values: null,
  },
  graphql: null,
};

const rawQueryDraft: PosteeRequestDraft = {
  ...queryJsonDraft,
  body: {
    ...queryJsonDraft.body,
    mode: "raw",
    raw: "select * from systems",
  },
};

describe("LoadTestPanel", () => {
  it("forwards QUERY method, headers, and body to the load-test runner", async () => {
    const user = userEvent.setup();
    const start = vi.fn().mockResolvedValue(undefined);
    useLoadTestMock.mockReturnValue(makeIdleLoadTestState({ start }));

    render(
      <LoadTestPanel
        requestDraft={queryJsonDraft}
        masterAudioEnabled={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /initiate load test/i }));

    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "QUERY",
        headers: [{
          key: "content-type",
          value: "application/json; charset=utf-8",
        }],
        body: "{\"q\":\"opsy\"}",
      }),
    );
  });

  it("blocks an invalid QUERY before invoking the load-test runner", () => {
    const start = vi.fn().mockResolvedValue(undefined);
    useLoadTestMock.mockReturnValue(makeIdleLoadTestState({ start }));

    render(
      <LoadTestPanel
        requestDraft={rawQueryDraft}
        masterAudioEnabled={false}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "QUERY requires a Content-Type for its request content.",
    );
    expect(screen.getByRole("button", { name: /initiate load test/i })).toBeDisabled();
    expect(start).not.toHaveBeenCalled();
  });
});

/**
 * ADR-019. The abort control.
 *
 * A load test sends real traffic and previously could not be stopped — the only
 * command was `start_load_test` and workers checked nothing but elapsed time.
 * These pin the two properties that make the button trustworthy: it is available
 * exactly when a run is in flight, and pressing it asks the backend to stop.
 */
describe("aborting a run", () => {
  const abortButton = () => screen.getByRole("button", { name: /abort run/i });

  it("stops the run when pressed", async () => {
    const stop = vi.fn().mockResolvedValue(undefined);
    useLoadTestMock.mockReturnValue(makeIdleLoadTestState({ status: "running", stop }));
    const user = userEvent.setup();

    render(<LoadTestPanel requestDraft={queryJsonDraft} masterAudioEnabled={false} />);
    await user.click(abortButton());

    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("is disabled when nothing is running", () => {
    useLoadTestMock.mockReturnValue(makeIdleLoadTestState({ status: "idle" }));

    render(<LoadTestPanel requestDraft={queryJsonDraft} masterAudioEnabled={false} />);

    expect(abortButton()).toBeDisabled();
  });

  it("is enabled while a run is in flight", () => {
    useLoadTestMock.mockReturnValue(makeIdleLoadTestState({ status: "running" }));

    render(<LoadTestPanel requestDraft={queryJsonDraft} masterAudioEnabled={false} />);

    expect(abortButton()).toBeEnabled();
  });
});
