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

This sends real traffic at whatever you point it at, as fast as you configure, for the full duration.

**A run cannot be cancelled.** There is no stop control and no cancellation command in the backend — once started, it runs for the configured duration. Choose the duration before you start rather than planning to abort. Start short.

Point it at something you own.

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

Reported per run:

- Requests sent, succeeded, failed
- Requests per second
- Latency: p50, p95, p99, plus average, min and max
- Bytes received
- Error count, with recent errors listed

The charts cover requests per second, p95 latency over time, throughput against latency as a scatter, success versus failure per tick, and latency distribution bands.

### Sirens

Starting a run arms an audible siren for as long as it runs, and the **Blast Door Status** indicator tracks the run state. The siren is a real oscillator, so it respects the global audio settings — it will not sound if master audio is off. Turn it off with **SIREN::ON/OFF** in the panel, or change the default in Settings.

It exists so you notice a run is still going. Given a run cannot be cancelled, that is more useful than it sounds.

## Related

- [ADR-010: HTTP response integrity](../architecture/adr/010-http-response-integrity.md)
- [ADR-011: Postee single-pane workspace](../architecture/adr/011-postee-single-pane-workspace.md)
- [ADR-012: OPY in Postee](../architecture/adr/012-opy-in-postee.md) — the redaction boundary
- [Postee product roadmap](../overview/postee-product-roadmap.md)
