---
title: "ADR-010: HTTP Response Integrity — Never Discard a Response on Body Decode Failure"
---

# ADR-010: HTTP Response Integrity — Never Discard a Response on Body Decode Failure

**Status**: Accepted
**Date**: 2026-07-24
**Deciders**: Alan P Currie
**Technical Story**: A `TRACE` request to `https://httpbin.org/anything?search=red+bmw` surfaced as
`Error: {"message":"Failed to perform HTTP request","cause":{},"request":{...},"_tag":"HttpClientError"}`
— an error that names neither what failed nor why, and which would look identical if the body had
merely failed to decode.

## Context

### Problem Statement

Postee is positioned as a Postman alternative. An API client's core promise is that it reports what
the server actually said. Today a failure to decode the response body destroys the entire response —
status line, headers, and timing included — even though all of it was already received. A client that
throws away a `500` with a useful `Set-Cookie` and `Retry-After` because the body was not valid UTF-8
is failing at its primary job.

Three defects compound:

1. **Body decode failure collapses the whole response.** In [`http-client.ts`](/src/core/effects/postee/http-client.ts),
   `send()` awaits the body *inside* the success continuation:

   ```ts
   TauriFetch(request.url, init)
     .then(async (response) => {
       const bodyText = await response.text();   // rejects here…
       const rawSize = new TextEncoder().encode(bodyText).byteLength;
       // …payload assembled from status/headers/timing
     })
     .catch((cause: unknown) => { /* …and every field above is discarded */ });
   ```

   A rejection from `response.text()` is indistinguishable, at this point, from a connection reset.

2. **Transport and decode failures produce the same error.** Both land in the same `.catch` and are
   reported as `HttpClientError { message: "Failed to perform HTTP request" }`. These are
   categorically different events: one means *no response exists*, the other means *a response exists
   and one field of it is unreadable*. Only the first is genuinely fatal.

3. **The cause is unreadable.** `HttpClientErrorType.cause` is `unknown` and carries a raw `Error`.
   `JSON.stringify(new Error("boom"))` is `{}`, which is exactly what the observed error shows. The
   information needed to diagnose the failure is captured and then rendered invisible. This is the
   same defect recently corrected in `DatabaseError`, where a bare `"Execute failed"` hid the actual
   SQLite constraint.

Two further weaknesses in the same type are worth correcting in one pass rather than two:

4. **Duplicate headers are silently lost.** `responseHeadersToRecord` folds headers into a
   `Record<string, string>`, so repeated headers collapse to the last value. `Set-Cookie` is the
   common case, and it is precisely the header an API client must not mangle.

5. **The body is decoded lossily at the boundary.** `PreparedResponse.bodyText` is a `string`, so
   binary payloads (images, protobuf, compressed content) are mangled into replacement characters
   before any consumer can decide what to do. `rawSize` is then derived by *re-encoding* that
   already-lossy string, so the reported size is wrong for exactly the responses that were damaged.

### Current State

```ts
export interface PreparedResponse {
  readonly status: StatusCode;
  readonly statusText: string;
  readonly headers: Record<string, string>;  // duplicates collapse
  readonly bodyText: string;                 // lossy; no failure representation
  readonly duration: TimeDuration;
  readonly rawSize: Bytes;                   // derived from the lossy string
}
```

Consumers of `bodyText` outside the client and its tests:

| File | Use |
| ---- | --- |
| [`PosteeResponsePanel.tsx`](/src/ui/components/postee/PosteeResponsePanel.tsx) | renders body, and a baseline body for diffing |
| [`PosteeWorkspace.original.tsx`](/src/ui/components/postee/PosteeWorkspace.original.tsx) | same, legacy component |
| [`postee.machine.ts`](/src/ui/machines/postee.machine.ts) | writes `response_body` / `response_headers` into history |
| [`graphql-schema.ts`](/src/core/effects/postee/graphql-schema.ts) | `JSON.parse` of the introspection response |

### Goals

- A response that reached the status line is **always** delivered to the caller.
- Transport failure and body-decode failure are **distinguishable by type**, not by string matching.
- Every error carries a **rendered, human-readable** message, not only an opaque `cause`.
- Binary responses survive intact; the UI decides how to present them.
- Repeated headers are preserved.

### Constraints

- `exactOptionalPropertyTypes: true` is set, so `partialBytes?: Uint8Array` is awkward to construct
  and to narrow; `Option` is the project's stated idiom.
- CLAUDE.md mandates `Data.taggedEnum` over hand-rolled `_tag` string unions, `Option` over
  nullable/boolean returns, and Red-Green-Blue TDD for all implementation.
- The functional core must stay free of I/O; decoding policy belongs in the core, the fetch call at
  the shell boundary.
- History persists `response_body` into a JSON column (`CHECK(json_valid(...) OR ... IS NULL)`), so a
  byte-oriented body needs an explicit storage policy. See **References**.

## Decision

**The error channel means "no response exists." Anything with a status line is a success value whose
body may itself have failed.**

### Proposed Solution

Body becomes a tagged enum rather than a bare string, and the response keeps every field it already
had:

```ts
export const ResponseBody = Data.taggedEnum<{
  Decoded: { readonly bytes: Uint8Array };
  DecodeFailure: {
    readonly partial: Option.Option<Uint8Array>;
    readonly message: string;   // rendered — `cause` alone serializes to {}
    readonly cause: unknown;
  };
}>();
export type ResponseBody = Data.TaggedEnum.Type<typeof ResponseBody>;

export interface PreparedResponse {
  readonly status: StatusCode;
  readonly statusText: string;
  readonly headers: ReadonlyArray<readonly [string, string]>;  // duplicates preserved
  readonly body: ResponseBody;
  readonly duration: TimeDuration;
  readonly rawSize: Bytes;
}
```

Deliberate departures from the shape originally sketched in discussion:

- **`duration` and `rawSize` are retained.** The sketch omitted both; history and the load-test
  metrics read them. `rawSize` is now `bytes.byteLength` — measured, not re-derived from a lossy
  string.
- **`partial: Option<Uint8Array>` rather than `partialBytes?: Uint8Array`**, per
  `exactOptionalPropertyTypes` and the project's Option idiom.
- **`message` accompanies `cause`.** Without it this ADR would reproduce the `"cause":{}` defect it
  exists to remove.
- **`Data.taggedEnum` rather than a hand-written `_tag` union**, giving exhaustive `$match`.

The client's error union narrows to genuine transport-level failures:

```ts
// unchanged in shape, but now only raised when NO response was received
HttpClientError | HttpClientTimeoutError | HttpClientAbortedError
```

with `HttpClientErrorType.message` always populated from the rendered cause.

### Implementation Details

1. **`http-client.ts`** — read the body as `ArrayBuffer` in its own `try`/rescue step *after* the
   response object exists. Assemble status/headers/timing first; attach `ResponseBody.Decoded` or
   `ResponseBody.DecodeFailure` second. `.catch` then only ever sees transport failures.
2. **`http-client.ts`** — replace `responseHeadersToRecord` with a tuple-preserving
   `responseHeadersToEntries`.
3. **New core helper** (pure, testable): `decodeBodyText(body: ResponseBody, contentType): Option<string>`
   so UI and GraphQL share one decoding policy instead of each calling `JSON.parse` on a raw string.
4. **`graphql-schema.ts`** — introspection parses from decoded text, and reports a typed
   `GraphqlSchemaError` when the body did not decode, instead of `JSON.parse` throwing on mojibake.
5. **`postee.machine.ts`** — history records the decode failure explicitly rather than storing a
   damaged string; `response_headers` serialises the tuple array.
6. **`PosteeResponsePanel.tsx`** — renders a "body could not be decoded" state showing status,
   headers, size, and the failure message, with the partial bytes offered as a hex/text preview.

## Consequences

### Positive

- A `500` with an undecodable body still shows its status, headers, and timing — the Postman-baseline
  behaviour this ADR exists to guarantee.
- Transport failure vs. decode failure becomes a compile-time distinction; `$match` makes missing
  handling a type error rather than a silent fallthrough.
- `Set-Cookie` and other repeated headers survive.
- Binary responses are no longer corrupted in transit through the client.
- `rawSize` becomes accurate for all content types.
- Errors become diagnosable without a debugger attached.

### Negative

- Breaking change to `PreparedResponse` across 5 non-test files and their tests.
- Every consumer must now decide what to do when a body did not decode — that is the point, but it is
  real work and cannot be deferred with a default.
- Consumers holding `Uint8Array` must decode explicitly; a shared helper mitigates this but the
  ergonomics are worse than a plain `string`.
- History gains a storage policy question for binary bodies (currently a JSON text column).

### Neutral

- `PreparedResponse` keeps its name; only its `headers` and `body` fields change shape.
- Timeout and abort errors are unaffected.
- No migration is required for existing `postee_history` rows.

## Alternatives Considered

### Alternative 1: Move `response.text()` out of the `.then` and change nothing else

The minimal fix. It stops the response being discarded, which is the headline defect.

**Why Rejected**: It leaves the other four defects in place — transport and decode failures stay
indistinguishable, `cause` still renders as `{}`, duplicate headers are still lost, and binary bodies
are still mangled. Every one of those requires touching the same type and the same call sites, so
doing them separately means paying the migration cost repeatedly. Rejected as the *end state*, but
adopted as **Phase 1** below, because it delivers the most important behaviour immediately.

### Alternative 2: Keep `bodyText: string`, add an optional `bodyDecodeError?: string`

Smallest diff that represents the failure.

**Why Rejected**: An optional field is ignorable — consumers keep reading `bodyText` and silently get
`""` on failure, which is precisely the "lies about what the server said" behaviour being removed. It
also fits poorly with `exactOptionalPropertyTypes`, and cannot carry partial bytes.

### Alternative 3: `body: Either<DecodeFailure, string>`

Idiomatic Effect, forces handling.

**Why Rejected**: Closer, but fixes the decode to text at the boundary, so binary payloads remain
lossy and `rawSize` remains wrong. `Data.taggedEnum` additionally carries partial bytes and matches
the codebase convention for domain unions.

### Alternative 4: Always give the caller raw bytes and no decode state

Simplest type: `body: Uint8Array`, never fails.

**Why Rejected**: Decode failure is real information — "the server sent 4 KB that is not valid text
in the declared charset" is worth reporting, not silently rendering as replacement characters. It
also gives no place to record *why* decoding failed.

## Migration Plan

1. **Phase 1 — stop the loss (independently shippable).** Move body reading out of the success
   continuation so a decode failure can no longer discard the response, and populate
   `HttpClientError.message` from the rendered cause. Existing `bodyText` shape unchanged; no
   consumer changes. Delivers the headline fix and makes the observed `TRACE` error legible.
2. **Phase 2 — introduce the types.** Add `ResponseBody`, the tuple headers, and `decodeBodyText`,
   with tests. `PreparedResponse` gains the new fields.
3. **Phase 3 — migrate consumers.** GraphQL introspection, history persistence, response panel, then
   the legacy workspace component.
4. **Phase 4 — remove the compatibility shim** and mark this ADR Accepted.

## Testing Strategy

**MANDATORY**: Red-Green-Blue for each case, per CLAUDE.md.

### Test Planning

1. A response whose body fails to decode still yields `status`, `statusText`, `headers`, and `duration`.
2. That response's body is `ResponseBody.DecodeFailure` carrying a non-empty `message`.
3. Partial bytes, when the platform provides them, are preserved in `partial`.
4. A transport failure (no response) still fails the effect with `HttpClientError`.
5. `HttpClientError.message` is non-empty and names the underlying cause — never `{}`.
6. A successful response yields `ResponseBody.Decoded` with byte-exact content.
7. `rawSize` equals `bytes.byteLength` for a binary payload (regression: previously re-encoded text).
8. Repeated `Set-Cookie` headers survive as separate entries.
9. Timeout and abort continue to raise their existing dedicated errors.
10. GraphQL introspection reports a typed error on an undecodable body rather than throwing.
11. History records a decode failure without violating the `json_valid` CHECK constraint.

### Red-Green-Blue Workflow

#### 🔴 RED

```typescript
// test/core/effects/postee/http-client.response-integrity.test.ts
it("keeps the response when the body cannot be decoded", async () => {
  const client = makeClientWithUndecodableBody({ status: 500, headers: [["retry-after", "30"]] });

  const response = await Effect.runPromise(client.send(request));

  expect(response.status).toBe(500);                    // response survives
  expect(response.headers).toContainEqual(["retry-after", "30"]);
  expect(response.body._tag).toBe("DecodeFailure");
  expect(response.body.message).not.toBe("");           // diagnosable
});
```

Run: `bun test` → RED.

#### 🟢 GREEN

Read the body in its own step after the response exists; map success to `Decoded`, rescue to
`DecodeFailure`.

#### 🔵 BLUE

Extract `decodeBodyText` as a pure function in the functional core; share it between the response
panel and GraphQL introspection so decoding policy lives in exactly one place.

### Test Coverage Goals

- Functional core (`http-client`, `decodeBodyText`): 100% of branches, both body tags.
- Machine integration: history written for both a decoded and an undecodable body.
- Component: response panel renders the decode-failure state.

## Success Metrics

| Metric | Before | After | Status |
| ------ | ------ | ----- | ------ |
| Response preserved on body decode failure | No | Yes | **Phase 1 shipped** |
| Error message names the cause | No (`{}`) | Yes | **Phase 1 shipped** |
| Transport vs decode distinguishable by type | No | Yes | **Phase 2 shipped** |
| Repeated `Set-Cookie` preserved | No | Yes | **Phase 2 shipped** |
| `rawSize` accurate for binary | No | Yes | **Phase 2 shipped** |
| Decode failure visible in the UI | No | Yes | **Phase 3 shipped** |

## References

- [`http-client.ts`](/src/core/effects/postee/http-client.ts) — `send()`, `PreparedResponse`, `responseHeadersToRecord`
- [`database.postee.ts`](/src/core/effects/database.postee.ts) — `toJsonColumnValue`, the JSON-column
  policy a byte-oriented body must respect
- [ADR-001](./001-postee-workspace-refactor.md) — Functional Core, Imperative Shell for Postee
- [ADR-004](./004-sqlite-pool-architecture.md) — persistence layer this feeds
- [Fetch Standard — Body mixin](https://fetch.spec.whatwg.org/#body-mixin)
- [RFC 9110 §5.2](https://www.rfc-editor.org/rfc/rfc9110#section-5.2) — field lines may repeat

## Follow-Up ADRs

- ADR-NNN: Binary and streaming response handling — how large or non-text bodies are stored,
  previewed, and exported, once `ResponseBody` makes them representable.

---

## Notes

The `TRACE` request in the technical story was most likely a genuine transport rejection, not a decode
failure — meaning this ADR would not, by itself, have produced a response for it. It is included
because the error it produced is indistinguishable from a decode failure, which is the deeper problem
this ADR addresses: one message for two unrelated events, with the distinguishing detail discarded.

### Updates

- 2026-07-24: Initial draft.
- 2026-07-24: **Phase 1 implemented.** The body is now read by a helper that never
  rejects, so a decode failure can no longer reach the transport `.catch` and take
  the response with it; `HttpClientError` renders its cause into the message.
  `PreparedResponse` gains `bodyDecodeError: string | null` as the interim
  representation — made required rather than optional, since an ignorable field is
  the defect Alternative 2 was rejected for. Phase 2 replaces it with the tagged
  `ResponseBody`. Note the decode error is not yet surfaced in the response panel;
  that is Phase 3, so today a failed decode shows an empty body with the failure
  visible only to callers reading the field.
- 2026-07-24: **Phase 2 implemented.** `ResponseBody` and `decodeBodyText` live in
  a new pure module, `src/core/effects/postee/response-body.ts`; the client now
  reads `arrayBuffer()` and decodes afterwards, so binary payloads survive and
  `rawSize` is measured from the bytes received. `PreparedResponse` gains `body`
  and `headerEntries` **additively** — `headers`, `bodyText`, and `bodyDecodeError`
  remain as shims so no consumer had to change, and Phase 4 removes them.

  Two corrections to this ADR's original claims, from measuring rather than
  assuming:

  1. Tuple headers rescue **`Set-Cookie` specifically**. `Headers` already yields
     repeated `Set-Cookie` as separate entries per the Fetch spec, so the loss was
     entirely in our `Record` fold (`result[key] = value` keeps only the last).
     Other repeated fields are combined by `Headers` into one comma-joined value
     before we ever see them — that is spec-correct, and tuples neither fix nor
     worsen it. The earlier wording implied all repeated headers were recoverable.
  2. Decoding is **strict** (`TextDecoder` with `fatal: true`), so invalid bytes
     yield `None` rather than U+FFFD. This is what makes "not text" reportable at
     all; `response.text()` would have silently substituted replacement characters
     and the distinction would have been unobservable.
- 2026-07-24: **Phase 3 implemented.** The response panel replaces the body editor
  with an explanation when the body did not decode, so an unreadable body is no
  longer indistinguishable from an empty one; status, headers, and size stay
  visible alongside it. GraphQL introspection reports an undecodable body as such
  instead of "not valid JSON", which would send the reader hunting a syntax error
  that does not exist. History stores every header line, so a repeated
  `Set-Cookie` survives into the saved response.

  Two scope decisions worth recording:

  1. **History does not record the decode reason.** The obvious home is
     `error_message`, but `deriveRequestStatuses` treats any non-null
     `error_message` as `RequestStatus.Error`, which would relabel a successful
     `200` as failed. The body is stored as `NULL` — accurate, since no text
     arrived — and the reason is deliberately withheld until there is a field that
     does not corrupt status derivation.
  2. **The legacy `PosteeWorkspace.original.tsx` was left alone.** It is dead code,
     imported nowhere, so migrating it would add churn and imply it is live. It
     compiles against the Phase 1/2 shims and should be deleted rather than
     migrated.
- 2026-07-24: **Accepted.** Phases 1–3 are implemented and verified. Phase 4 —
  removing the `headers`, `bodyText`, and `bodyDecodeError` shims once consumers
  read `body` and `headerEntries` directly — remains outstanding and is tracked
  here rather than in a separate ADR, since it changes no decision, only finishes
  this one.
