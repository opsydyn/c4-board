# Postee HTTP QUERY Method Design

**Date:** 2026-07-23
**Status:** Approved
**Standard:** [RFC 10008: The HTTP QUERY Method](https://www.rfc-editor.org/info/rfc10008/)

## Goal

Add RFC-aware HTTP `QUERY` requests to Postee. A user can select `QUERY`,
author request content, save and reload the request, execute it, inspect it in
history, and reuse it in load testing without Postee coercing the method or
dropping its content.

Postee must prevent an invalid QUERY request from being sent when its content
has no effective media type.

## RFC Semantics

RFC 10008 defines `QUERY` as a safe and idempotent HTTP method for asking a
target resource to process enclosed query content. It occupies the space
between URI-encoded GET queries and state-changing POST requests.

For this slice:

- `QUERY` supports request content.
- `QUERY` is classified as safe and idempotent.
- Query semantics depend on both the request content and its media type.
- QUERY content must have an effective `Content-Type`.
- Browser execution may require CORS preflight because `QUERY` is not a
  CORS-safelisted method.

Safe and idempotent classification is metadata for policy and future retry
work. This slice does not introduce automatic retries or caching.

## Scope

This slice includes:

- the canonical Effect HTTP method schemas and guards;
- request form validation;
- the Postee request-builder method selector;
- the load-test method selector;
- persistence, hydration, search, history, and replay compatibility;
- request preparation and HTTP execution with QUERY content;
- effective content-type inference and validation;
- an inline, actionable editor error that blocks Send; and
- a dedicated RFC 10008 item in the Postee product roadmap.

This slice does not include:

- arbitrary user-defined HTTP methods;
- `Accept-Query` discovery or structured-field parsing;
- QUERY-specific caching;
- automatic retries;
- equivalent-resource management using `Location` or `Content-Location`;
- redirect-policy changes; or
- a new body-mode picker.

## Canonical Method Policy

Introduce one core policy boundary for method semantics rather than adding
QUERY-specific conditions independently in the UI and HTTP client.

The policy exposes:

- whether a method is safe;
- whether it is idempotent;
- whether request content is permitted;
- whether request content is expected; and
- whether content requires an effective media type before execution.

The initial policy records the existing methods and adds `QUERY`. Existing
runtime behaviour remains unchanged except where a method's current body rule
is represented by the policy. `GET` and `HEAD` continue to omit request
content. `QUERY` follows the content-capable path used by POST-like requests,
while retaining its safe and idempotent classification.

The two existing HTTP method schemas must agree. `QUERY` is added to both
instead of allowing the UI type and persistence schema to drift further.
Request form validation uses the same canonical method set or a direct schema
check rather than maintaining another hand-written list.

## Effective Content Type

The effective media type is resolved in this order:

1. An enabled, non-blank `Content-Type` request header, matched
   case-insensitively.
2. JSON body mode, which supplies `application/json; charset=utf-8`.
3. Form body mode, which supplies
   `application/x-www-form-urlencoded`.

Raw body mode has no safe generic inference. A raw QUERY request therefore
requires an explicit enabled `Content-Type` header.

A QUERY request with no content or without an effective content type is
invalid. Postee shows an actionable error and blocks Send. The core request
preparation path applies the same rule so keyboard shortcuts, machine
execution, replay, and load testing cannot bypass the editor.

Explicit user headers take precedence over generated defaults. Header
normalisation must not duplicate `Content-Type` with different casing.

## Editor Behaviour

`QUERY` appears beside the existing methods in the request-builder selector.
Selecting it keeps the Body and Headers workflow visible.

The editor derives QUERY validity from the active draft:

- JSON and form drafts receive their generated content type.
- Raw drafts remain editable but require an enabled `Content-Type` header.
- Missing content or media type produces a concise inline error with
  `role="alert"`.
- Save remains available so an incomplete draft can be persisted.
- Send and its keyboard shortcut remain unavailable until the draft is valid.

The error belongs to request semantics, not URL validation or persistence
state, and must not displace existing save, running, or global-save feedback.

## Data Flow

1. The user selects `QUERY` and edits the draft.
2. Existing transactional draft persistence stores the method, headers, and
   body unchanged.
3. The editor evaluates the shared method policy and effective content type.
4. On execution, the machine loads the committed draft.
5. Request preparation resolves templates, validates QUERY content semantics,
   and creates the prepared request.
6. Fetch receives method `QUERY`, the prepared content, and exactly one
   effective `Content-Type`.
7. Existing response and history paths retain `QUERY` as the recorded method.
8. Load-test execution uses the same preparation policy.

Postee continues to execute committed state rather than unsaved visible state.

## Error Handling

The user-facing validation messages are stable and actionable:

- `QUERY requires request content.`
- `QUERY requires a Content-Type for its request content.`

Preparation failures use the existing typed HTTP client error channel and do
not expose request content or secret header values in logs or diagnostics.

CORS preflight failures remain transport failures. Postee may explain that
QUERY requires server and intermediary support, but it must not silently retry
the operation as POST or GET.

## Roadmap Update

Add an RFC 10008 subsection to Workstream 2, Complete REST Authoring:

- support QUERY authoring, persistence, execution, history, replay, and load
  testing;
- enforce content and media-type semantics;
- classify QUERY as safe and idempotent;
- surface CORS and intermediary compatibility failures honestly; and
- retain future items for `Accept-Query`, redirect handling, caching, and safe
  retry policy.

The first two items can be marked complete when this slice lands. Discovery,
redirect, caching, and retry work remain unchecked.

## Testing

Use test-driven development at each boundary:

- Effect schema tests accept `QUERY` and continue rejecting unknown methods.
- Form-validation tests normalise and accept `QUERY`.
- Method-policy tests prove safe, idempotent, content-capable, and
  media-type-required classification.
- Effective-content-type tests cover explicit headers, header casing, disabled
  headers, JSON defaults, form defaults, and raw content.
- HTTP-client tests prove QUERY reaches fetch with its body and one correct
  `Content-Type`.
- HTTP-client tests reject missing content and missing raw media type before
  transport.
- Component tests prove QUERY is selectable, valid JSON can be sent, raw
  content without a media type blocks Send, and adding the header restores
  Send.
- Machine tests prove a persisted QUERY draft executes without method or body
  coercion.
- Load-test tests prove QUERY remains available and forwards content.

Run full lint, Vitest, Astro check/build, Knip, Rust tests, and diff hygiene
before merge.

## Acceptance Criteria

1. `QUERY` is accepted by every canonical method schema and selector.
2. A saved QUERY request round-trips method, content, and headers unchanged.
3. JSON and form QUERY requests receive an effective generated content type
   unless the user supplies one explicitly.
4. Raw QUERY content without an enabled `Content-Type` cannot be sent.
5. Core execution independently rejects invalid QUERY content semantics.
6. A valid QUERY reaches the transport with method, body, and content type
   intact.
7. History, replay, search, and load testing preserve the QUERY method.
8. Postee never falls back from QUERY to POST or GET.
9. Existing HTTP methods retain their current behaviour.
10. The Postee roadmap records both the delivered slice and the remaining RFC
    10008 follow-up work.
