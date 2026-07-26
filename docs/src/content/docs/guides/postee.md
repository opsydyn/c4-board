---
title: "Postee"
---

# Postee

Postee is the HTTP workspace inside c4-board: build a request, send it, read the response, keep the ones worth keeping. It runs against your machine's network from the desktop app, so it can reach localhost services and anything else your machine can.

Open it from the board's sidebar (**USE POSTEE**) or navigate to the Postee workspace directly.

## Sending a request

The request builder takes a method, a URL, headers, and a body. Send it and the response panel shows status, timing, headers and body, with a Monaco editor for JSON.

### Scratch requests

You do not have to create a collection first. A new tab is a **scratch request** — durable, so it survives a restart, but not yet filed anywhere. Scratch tabs can be closed and reopened.

When a scratch request turns out to be worth keeping, promote it into a collection. The promotion is atomic: it either lands in the collection or stays a scratch, never both and never neither.

### Collections

Collections group saved requests. A request in a collection is the thing you come back to; scratch tabs are for the ones you are still figuring out.

### Environments

Environments hold variables that requests reference, so the same request can point at local, staging and production without editing it. Switching environment switches every request that uses those variables.

### History

Every execution is recorded — method, URL, status, timing — and is searchable. History is what the request status indicators on the board read from.

## What Postee deliberately does not show you

Postee handles credentials, so several things are withheld by default rather than displayed. This is [ADR-012](../architecture/adr/012-opy-in-postee.md) and it is structural, not a preference:

- **Environment variable values never leave the process.** Names are visible; values are not.
- **Header values are withheld by default.** Saved requests show header *names* only.
- **Response bodies require per-run consent** before an agent can read them.
- **Query strings are stripped from URLs**, including inside error messages.

If a value you expect to see is missing, this is usually why.

## Load testing

The **Load Chamber** drives sustained traffic at an endpoint and reports what happened. It is marked experimental and it is desktop-only — the panel will tell you so if you open it outside the app.

### Before you start

This sends real traffic at whatever you point it at, as fast as you configure. Point it at something you own.

**Abort Run** stops a run in flight. Workers finish the request already in the air and the run reports the statistics it gathered, so aborting costs you the remaining duration, not the measurement.

### Settings

| Field | Default | Notes |
| ----- | ------- | ----- |
| HTTP method | `GET` | |
| Target URL | — | Required |
| Duration (sec) | `10` | Must be at least 1. This is how long you are committed for. |
| Concurrency | `10` | Number of concurrent workers. Must be at least 1. |
| RPS limit | unlimited | Optional ceiling on requests per second. If set, must be greater than 0. |
| Timeout (ms) | `30000` | Per-request connection timeout. |

Headers and a body can be sent with the request, the same as a normal Postee call.

### Reading the results

Progress is emitted every 100ms while the run is in flight, so the charts move in real time and the final numbers arrive when it completes.

Latency percentiles come from an HDR histogram rather than from averaging samples, so **p50, p95 and p99 are accurate at the tail** — which is the part worth looking at. An average latency that looks fine while p99 is terrible is the normal shape of a struggling service.

#### Interval versus cumulative

Two views of the same run, and they answer different questions ([ADR-019](../architecture/adr/019-load-test-control-and-accuracy.md)):

- **Charts plot the interval view** — requests and percentiles for the 100ms window since the last update. This is what "right now" means, so a spike looks like a spike and a recovery looks like a recovery.
- **The summary figures are cumulative** — percentiles across every sample in the run. This is the right thing for a final report.

Interval percentiles over a 100ms window come from few samples at low request rates and will look noisy. That noise is real; it is what a running average was concealing.

#### Responses versus transport failures

A 503 is a **response** — the service chose to send it. A refused connection or a timeout is not a response at all. These are counted separately, because under load they mean opposite things: one says the service is shedding traffic deliberately, the other says you never reached it.

**Latency is recorded for every response whatever its status.** Previously only successes entered the histogram, and since the slow requests under load are exactly the ones that return 503, the percentiles were dropping their worst samples and reading optimistically. If you compare a run now against one recorded before this change, expect the percentiles to look **worse** — that is the measurement being corrected, not the service regressing.

Transport failures are timed separately rather than mixed into response latency. A 30-second timeout is time-to-give-up, bounded by your timeout setting; folding it in would drag p99 towards that setting until it stopped describing the service at all.

Reported per run:

- Requests sent, succeeded, failed
- Responses received, and transport failures split by timeout and connect
- Requests per second
- Latency: p50, p95, p99, plus average, min and max
- Bytes received
- Error count, with recent errors listed

The charts cover requests per second, p95 latency over time, throughput against latency as a scatter, success versus failure per tick, and latency distribution bands.

### Sirens

The siren is **off by default** and has to be armed deliberately, with **SIREN::ON/OFF** in the panel or by changing the default in Settings. It is a real oscillator that sounds for as long as a run lasts, and it also respects the global audio settings — it will not sound if master audio is off.

The toggle stays usable while a run is in flight, so silencing the noise never requires aborting the measurement.

The **Blast Door Status** indicator tracks run state and is silent.

### Known limitation: coordinated omission

Workers are a closed loop — send, wait for the response, send again — so when the target slows down the generator issues **fewer** requests. Slow periods are therefore under-represented in the histogram, and the reported percentiles are optimistic under degradation.

What you are measuring is service time, not response time under the intended load. Treat these numbers as a comparison between runs rather than a worst-case guarantee. Correcting it is deliberately deferred: it changes what the numbers mean, and would make every previous run incomparable without saying so.

## Related

- [ADR-010: HTTP response integrity](../architecture/adr/010-http-response-integrity.md)
- [ADR-011: Postee single-pane workspace](../architecture/adr/011-postee-single-pane-workspace.md)
- [ADR-012: OPY in Postee](../architecture/adr/012-opy-in-postee.md) — the redaction boundary
- [Postee product roadmap](../overview/postee-product-roadmap.md)
