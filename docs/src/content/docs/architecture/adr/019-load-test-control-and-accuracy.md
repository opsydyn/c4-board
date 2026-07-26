---
title: "ADR-019: Load test control and measurement accuracy"
---

# ADR-019: Load test control and measurement accuracy

**Status**: Accepted
**Date**: 2026-07-26

## Context

The Load Chamber sends real traffic at real endpoints. Documenting it surfaced three problems: one of control, one of consent, and one of measurement.

### You cannot stop it

`start_load_test` is the only registered command. There is no `AbortHandle` and no cancellation token in the engine, so once a run starts it continues for its full configured duration. A mistyped duration, a wrong URL, or a target that turns out to be production is unstoppable short of killing the app.

For a tool whose entire purpose is to hammer something, an abort control is not a feature.

### The alarm is opt-out

`sirenEnabledDefault` defaults to `true`, so a first-time user pressing the obvious button gets an oscillator in their ears. Something that makes noise on the user's machine should be opted into, not out of.

### The charts cannot show what they appear to show

Every field in `LoadTestStats::snapshot()` is cumulative since the run began:

```rust
rps: inner.requests_sent as f64 / elapsed.as_secs_f64(),
p50: inner.latencies.value_at_quantile(0.50),   // whole-run histogram
```

Plotted as a time series, cumulative values are close to meaningless:

- **Requests per second** converges on a flat run-average and can never show a dip, because it is total-sent divided by total-elapsed.
- **p95 latency** is computed over every sample since t=0, so it climbs when things degrade and then *stays* climbed. A service that recovers looks identical to one that never did.
- A spike ten seconds into a sixty-second run is diluted by fifty seconds of good samples.

The percentiles are accurate — the HDR histogram is the right instrument — but they answer "what has p95 been across the whole run so far", while the chart's shape implies "what is p95 right now". That gap is the accuracy problem.

### Two further measurement defects, for the record

**Coordinated omission.** Workers are a closed loop: send, await the response, immediately send again. When the server slows down the generator issues *fewer* requests, so slow periods are under-represented in the histogram and measured latency is optimistic. With an RPS limit set, `until_ready()` is awaited before each send, but a worker already blocked on a slow response cannot honour the schedule — the intended send time is lost. What is measured is service time, not response time under the intended load.

**The result model conflates three different facts.** `send_request` returns `Result<u64, String>`, so a completed HTTP response and a failure to reach the host land in the same bucket. Examining it turned up three defects, in increasing order of how badly they mislead:

1. **Every non-2xx is an opaque string.** An endpoint under load returning 429 or 503 is the most interesting signal there is, and it arrives as `format!("HTTP {status}")` with no distribution to look at. A rate-limited endpoint reads as total failure.

2. **`recent_errors` is not recent.** Collection stops at 100 (`if inner.errors.len() < 100`) and the field reports `.rev().take(10)` of that frozen vector. After the first hundred failures you see errors #91–100 for the rest of the run — a run that degrades at minute five shows evidence from second two.

3. **Failed requests' latency is discarded.** `record_failure(error: String)` takes no latency, so the HDR histogram contains only successes. Under load the slow requests are precisely the ones that time out or return 503, so the histogram systematically drops its worst samples. **The reported percentiles are optimistic by construction**, independently of coordinated omission.

**Redirects are counted as success.** `!status.is_success() && !status.is_redirection()` treats 3xx as a pass. reqwest already follows up to ten redirects by default, so a 3xx reaching that check means the redirect limit was *exhausted* — a redirect loop reported as healthy.

## Decision

### 1. Cancellation

Add a cancellation channel to the engine, checked by every worker alongside the duration test, and a `stop_load_test` command that triggers it. A cancelled run reports the stats it gathered rather than discarding them — a partial measurement is still a measurement, and discarding it on abort would teach users not to abort.

The panel gets an abort control that is enabled exactly while a run is in flight.

### 2. Alarms opt-in

`sirenEnabledDefault` becomes `false`. The siren remains available, with a standalone control in the panel that silences it immediately and independently of the run — stopping the noise must never require stopping the test, and must not depend on the global audio toggle.

### 3. Interval metrics

`LoadTestProgress` gains a windowed view alongside the cumulative one: requests and latency percentiles for **the interval since the previous snapshot**, not since the run began. Charts plot the interval series; summary panels keep the cumulative figures, which are the right thing for a final report.

Both are kept because both are correct answers to different questions. The bug is not that cumulative statistics exist, it is that they were being drawn on a time axis.

### 4. Replace the result type, in slices

The fix is the type. `Result<u64, String>` has two buckets where three independent facts are needed: whether the transport completed, what status came back, and whether that status counts as a pass *for this test*.

```rust
enum RequestOutcome {
    Responded { status: u16, latency: Duration, bytes: u64 },
    Transport { kind: TransportErrorKind, latency: Duration, detail: String },
}

enum TransportErrorKind { Timeout, Connect, Body, Other }
```

A 503 is a **response**, not an error. Once that is true the rest follows.

Delivered as five slices, each verifiable alone:

1. **The outcome type, and latency for every completed response.** Fixes the optimism. Response latency covers all statuses; transport failures are timed into a *separate* distribution, because a 30-second timeout is time-to-give-up — bounded by configuration — not a service latency, and mixing them makes p99 converge on the timeout setting. This is the same split k6 draws between `http_req_duration` and `http_req_failed`.
2. **Status distribution**, by exact code, plus latency percentiles per status class. "p99 of 200s is 40ms, p99 of 503s is 30s" says the service is shedding load cleanly; one merged p99 says nothing.
3. **Errors as counters plus a ring buffer.** Unbounded counts per kind, and the last N messages as evidence — never a frozen prefix.
4. **Success and redirect policy as configuration.** Stop hardcoding `is_success() || is_redirection()`; stop following ten redirects silently.
5. **Thresholds and export.** Declare `p95 < 200ms` or `error_rate < 1%` and have the run report pass/fail, and emit the interval series as CSV/JSON. Without thresholds it cannot gate a pipeline, which is the main reason teams run load tests; without export a number cannot be compared with last week's.

Slices 1–3 are the correctness fix. Slices 4–5 are what makes it usable in CI.

All five slices are implemented. Thresholds and export are evaluated in the
functional core from the final snapshot rather than in Rust: the snapshot already
crosses the IPC boundary with everything the judgement needs, so putting it there
would have grown the contract for nothing and made a pure decision hard to test.

### 5. Coordinated omission (deferred, deliberately)

Not addressed in this ADR. Correcting it means recording latency against a request's *intended* send time when a rate limit is configured, which changes what the numbers mean — a fix that silently makes every historical figure incomparable deserves its own decision and its own explanation in the UI. It is called out in the guide as a known limitation so nobody reads these percentiles as a worst-case guarantee.

## Consequences

### Positive

- A run can be stopped, which makes the tool safe enough to experiment with.
- Charts show instantaneous behaviour, so a spike looks like a spike and a recovery looks like a recovery.
- Status distribution makes the tool usable for the thing it is for: watching an API degrade under load.
- Nothing makes noise until asked.

### Negative

- `LoadTestProgress` grows, and the payload is emitted every 100ms. The interval histogram is reset per tick rather than accumulated, so the cost is bounded, but the event is larger.
- Interval percentiles over a 100ms window are computed from few samples at low request rates, and will look noisy. That noise is real — it is what the previous averaging concealed — but the guide should say so.
- Recording status codes means the engine must distinguish transport failure from HTTP failure. Existing error strings change shape, and anything asserting on them changes with it.
- **Slice 1 changes the numbers on every run, and they get worse.** Percentiles that previously excluded every failure will include them, so a run measured before and after is not comparable. That is the defect being fixed rather than a regression, but it has to be said in the UI and the guide — a silent accuracy improvement looks exactly like a performance regression in the service under test.

### Neutral

- Cumulative statistics are unchanged, so final-report numbers stay comparable with previous runs.

## Alternatives considered

**Smooth the existing cumulative series client-side.** Rejected: no amount of client-side work recovers information the backend never sent. Cumulative p95 does not contain instantaneous p95.

**Replace cumulative with interval everywhere.** Rejected: the final summary genuinely wants whole-run percentiles, and an HDR histogram over the full run is the accurate way to get them.

**Make abort kill the process.** Rejected: it would discard the stats and leave connections dangling. Cooperative cancellation costs one channel check per worker iteration.

**Keep the siren opt-out because it is a safety feature.** Rejected: an audible alarm is not a substitute for an abort button. Now that one exists, the alarm can be what it always should have been — optional.

## References

- [Postee guide](../guides/postee.md)
- [ADR-011: Postee single-pane workspace](011-postee-single-pane-workspace.md)
- Gil Tene on coordinated omission, for the deferred item
