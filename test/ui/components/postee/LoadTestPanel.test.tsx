import type { PosteeRequestDraft } from "@/core/effects/postee";
import type { LoadTestProgress } from "@/core/effects/postee/load-test";
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

/**
 * ADR-019 slice 5. Thresholds and export in the panel.
 *
 * The verdict only appears once a run has produced numbers and someone actually
 * declared something — an empty budget field asserts nothing, and showing a
 * green "passed" for a claim nobody made would be a lie of omission.
 */
describe("thresholds and export", () => {
  const finishedSample = {
    elapsed_ms: 1000,
    requests_sent: 100,
    requests_success: 100,
    requests_failed: 0,
    rps: 100,
    p50_latency_ms: 10,
    p95_latency_ms: 500,
    p99_latency_ms: 700,
    avg_latency_ms: 20,
    min_latency_ms: 5,
    max_latency_ms: 800,
    bytes_received: 10,
    error_count: 0,
    recent_errors: [],
    interval_ms: 100,
    interval_requests_sent: 10,
    interval_requests_success: 10,
    interval_requests_failed: 0,
    interval_rps: 100,
    interval_p50_latency_ms: 10,
    interval_p95_latency_ms: 500,
    interval_p99_latency_ms: 700,
    responses_received: 100,
    transport_failures: 0,
    transport_timeouts: 0,
    transport_connect_failures: 0,
    status_counts: {},
    status_classes: [],
  } as unknown as LoadTestProgress;

  it("says nothing about thresholds when none were declared", () => {
    useLoadTestMock.mockReturnValue(
      makeIdleLoadTestState({ status: "complete", latest: finishedSample, samples: [finishedSample] }),
    );

    render(<LoadTestPanel requestDraft={queryJsonDraft} masterAudioEnabled={false} />);

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("fails the run when the measured p95 is over the declared budget", async () => {
    useLoadTestMock.mockReturnValue(
      makeIdleLoadTestState({ status: "complete", latest: finishedSample, samples: [finishedSample] }),
    );
    const user = userEvent.setup();

    render(<LoadTestPanel requestDraft={queryJsonDraft} masterAudioEnabled={false} />);
    await user.type(screen.getByLabelText(/p95 budget/i), "200");

    expect(screen.getByRole("status")).toHaveTextContent(/FAILED/);
  });

  it("cannot export before there is anything to export", () => {
    useLoadTestMock.mockReturnValue(makeIdleLoadTestState({ status: "idle", samples: [] }));

    render(<LoadTestPanel requestDraft={queryJsonDraft} masterAudioEnabled={false} />);

    expect(screen.getByRole("button", { name: /export csv/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /export json/i })).toBeDisabled();
  });

  it("offers export once samples exist", () => {
    useLoadTestMock.mockReturnValue(
      makeIdleLoadTestState({ status: "complete", latest: finishedSample, samples: [finishedSample] }),
    );

    render(<LoadTestPanel requestDraft={queryJsonDraft} masterAudioEnabled={false} />);

    expect(screen.getByRole("button", { name: /export csv/i })).toBeEnabled();
  });
});
