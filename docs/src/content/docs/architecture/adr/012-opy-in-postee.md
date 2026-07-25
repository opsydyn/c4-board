---
title: "ADR-012: OPY in Postee — Agent-Assisted Request Authoring"
---

# ADR-012: OPY in Postee — Agent-Assisted Request Authoring

**Status**: Accepted
**Date**: 2026-07-25
**Deciders**: Alan P Currie
**Technical Story**: OPY exists as a Rig-backed agent over the C4 board (ADR-008). Postee is the other
half of the product and has no agent surface, despite being the place where the tedious work lives:
authoring GraphQL operations against a schema, reading an unfamiliar response, working out why a
request returns 422.

## Context

### Problem Statement

Postee's most tedious tasks are exactly the ones an agent grounded in real context is good at — and
Postee already holds that context: cached GraphQL introspection snapshots, request history with
responses, collections, environments. None of it is reachable by OPY today.

The naive integration is also the dangerous one. **Postee holds credentials; the board does not.**
The board's worst-case disclosure is a service name. Postee's is a bearer token in an `Authorization`
header, an API key in an environment variable, or customer data in a response body. Any design that
treats Postee context like board context will leak secrets to a model provider on the first run.

### Current State

OPY, as built rather than as described:

| Layer | Reality |
| ----- | ------- |
| Agent runtime | Rust, `rig-core 0.40`, OpenAI provider — [`rig_runtime.rs`](/src-tauri/src/rig_runtime.rs) |
| Tools | Three typed read tools: `BoardSummary`, `NodeLookup`, `EdgeLookup`, each `JsonSchema`, executed in Rust |
| Tool envelope | `RigReadToolRequest { tool, input: Value, board_summary }` → `RigReadToolResponse { tool, result: Value }` |
| Orchestration | ADR-008 stages: PLAN → CONTEXT → PROPOSE → REVIEW → APPLY → VERIFY → PERSIST |
| Persistence | `opy_agent_runs`, `opy_agent_tasks`, `opy_agent_tool_calls`, `opy_agent_artifacts`, `opy_agent_checkpoints`, `opy_diagram_proposals`, `opy_chat_sessions`, `opy_chat_messages` |
| Redaction | [`agent-context.ts`](/src/core/effects/agent-context.ts), `redactionMode` of `off \| standard \| strict`, defaulting to `strict` |
| Secrets | Keychain first, app-settings fallback, env — `RigAgentSecretSource` |
| CopilotKit | **Chrome only.** One import: `CopilotChatInput` from `@copilotkit/react-core/v2`. No `CopilotRuntime`, no backend endpoint |

That last row is the one most likely to be misread. CopilotKit is not the agent framework in this
codebase; it is a text input. The loop is Rig, in Rust.

### Goals

- Ground an agent in Postee's real context: schemas, history, collections.
- Produce **proposals a human accepts**, never direct mutation.
- Make credential disclosure structurally difficult rather than merely discouraged.
- Reuse OPY's runtime, stages, and persistence rather than growing a second agent stack.

### Constraints

- ADR-008: model output never mutates state; tools are typed; runs are replayable.
- ADR-011: Postee's shell is fixed-height, so a new surface must overlay rather than take pane width.
- `rig-core` warns that future updates **will** contain breaking changes; the Rust boundary should stay
  thin enough to absorb that.

## Decision

**OPY gains a Postee surface: typed read tools over Postee's own data, and proposals that land as
scratch drafts. The redaction boundary is extended before any tool ships, not after.**

### Redaction is the first task, not a hardening pass

`redactionMode` exists but was written for diagram metadata. Postee's rules are stricter and are
properties of the tool layer, not of a prompt:

| Data | Rule |
| ---- | ---- |
| Environment variable **values** | Never leave the process. Tools expose **keys only** |
| Header values | Redacted by default; per-request opt-in to include |
| Request/response bodies | Excluded unless the user consents **per run** — this is a data-egress decision and must be made knowingly |
| URLs | Query strings stripped under `strict`; they routinely carry tokens |

The GraphQL introspection path already redacts header values into history
(`headers.map(h => ({ ...h, value: "[redacted]" }))`), which is the precedent to generalise.

### Read tools

Mirroring the existing three, same envelope, executed in Rust:

- `collection_summary` — collections, request names, methods, URL shapes
- `request_lookup` — one request: method, URL, headers *(values redacted)*, body mode
- `history_lookup` — recent executions: status, duration, size, error; **no bodies by default**
- `response_lookup` — one history entry's body, **gated on per-run consent**
- `graphql_schema_lookup` — the cached introspection snapshot for an endpoint
- `environment_summary` — environment names and variable **keys**, never values

`graphql_schema_lookup` is the highest-value tool and carries no secrets: the schema is already
cached per endpoint and context fingerprint, so operations can be grounded in a real schema rather
than guessed.

### Proposals land as scratch drafts

ADR-008 forbids mutation from model output. Postee already has the ideal landing zone: **the scratch
draft**. A proposed request becomes a scratch tab — visible, editable, discardable, and promoted into
a collection only by explicit user action.

This is the point of the design. Human-in-the-loop is not a new mechanism to build; it is the
mechanism the scratch-first workspace already provides.

### Persistence

~~Shared run machinery gains a `surface` discriminator (`board | postee`) on `opy_agent_runs`,
`opy_agent_tool_calls`, and `opy_agent_artifacts`.~~ **Superseded — see the 2026-07-25 update below.**
Postee gets its own run and proposal tables; the board tables are untouched.

`opy_diagram_proposals` holds C4 node and edge payloads. A Postee proposal holds a method, URL,
headers, body mode, and GraphQL document. These have nothing in common beyond the word "proposal", and
forcing them into one table would produce a row where most columns are always null.

### Surface

A drawer, built on the `Drawer` primitive from ADR-011 Phase 3 — the same surface as history. It
overlays, so it cannot disturb the split panes or reintroduce page scroll.

### CopilotKit stays chrome

Its primitives — shared state, `useAgent`, generative UI, its human-in-the-loop pause — assume the
CopilotKit runtime, which this project does not run. Adopting them properly would mean AG-UI and a
second orchestration layer beside a Rust Rig loop.

Rig itself now ships a serializable `AgentRun` state machine, which covers much of what CopilotKit's
runtime would provide, in the process that already owns the agent loop. So CopilotKit remains what it
is today: a chat input.

## Consequences

### Positive

- Grounded GraphQL authoring against a real cached schema.
- Response explanation and failure diagnosis with history as evidence.
- Reuses the Rig runtime, stage pipeline, and run persistence — one agent stack, not two.
- Reuses the scratch draft as the approval boundary, so nothing is applied without a human.
- Extending redaction benefits the board surface too.

### Negative

- Redaction is now security-critical rather than cosmetic; a mistake discloses credentials to a third
  party. It needs adversarial tests, not example-based ones.
- A `surface` discriminator touches tables the board agent already writes.
- Response-body consent adds a step users will find annoying, and will be tempting to default on.
- More Rust tool surface to keep aligned with `rig-core`'s breaking changes.

### Neutral

- CopilotKit's role is unchanged.
- No new frontend dependency.

## Alternatives Considered

### Alternative 1: One proposal table shared with the board

**Why Rejected**: A C4 proposal is nodes and edges; a Postee proposal is a request. A shared table
would be mostly-null columns and a discriminator doing the real work, with no query ever wanting both.

### Alternative 2: Adopt CopilotKit's runtime and AG-UI

Its HITL, shared state, and generative UI are genuinely good, and interoperable by protocol.

**Why Rejected**: It would place a second orchestration layer beside the Rig loop that already exists
in Rust, and move agent state into the frontend where the credentials boundary is weakest. Worth
revisiting only if the Rust runtime is being replaced anyway.

### Alternative 3: Let the agent mutate saved requests directly, with undo

**Why Rejected**: Contradicts ADR-008's central rule, and undo is a poor substitute for consent when
the action can fire a request at a production endpoint.

### Alternative 4: Send whole responses as context by default

Simplest, and best answers.

**Why Rejected**: Response bodies are the most likely place for customer data and tokens. Default-on
egress of a body the user has not looked at is not a trade this product should make silently.

## Migration Plan

1. **Phase 1 — Redaction boundary.** Extend `agent-context.ts` with Postee rules and adversarial tests
   (a token in a URL, a bearer header, a secret in a body). No tools yet. Independently valuable.
2. **Phase 2 — Read tools.** `graphql_schema_lookup`, `collection_summary`, `request_lookup` in Rust,
   behind the existing envelope. Read-only, no proposals.
3. **Phase 3 — Proposals as scratch drafts.** `postee_agent_proposals`, plus the `surface`
   discriminator. GraphQL operation authoring as the first capability.
4. **Phase 4 — Diagnosis.** `history_lookup`, and `response_lookup` behind per-run consent.
5. **Phase 5 — Surface.** OPY drawer in Postee on the ADR-011 `Drawer` primitive.

## Testing Strategy

**MANDATORY**: Red-Green-Blue per CLAUDE.md.

### Test Planning

1. An environment variable value never appears in assembled context, in any redaction mode.
2. A bearer token in a header is redacted by default and included only on explicit opt-in.
3. A token in a URL query string is stripped under `strict`.
4. A response body is absent from context without per-run consent.
5. `environment_summary` returns keys and never values.
6. A proposal produces a scratch draft and never writes to `postee_requests`.
7. A proposal with an invalid method or URL is rejected before it reaches a draft.
8. Runs, tool calls, and artifacts are written with `surface = "postee"`.
9. `graphql_schema_lookup` returns the cached snapshot and never triggers a live introspection request.

Cases 1–5 are the ones that matter. They should be written as adversarial tests — secrets planted in
every field, asserting absence in the output — rather than examples asserting that the happy path
looks right.

## Success Metrics

| Metric | Before | After | Status |
| ------ | ------ | ----- | ------ |
| Postee context reachable by OPY | None | Typed read tools | **Shipped** |
| Credentials in assembled context | Unprotected by design | Structurally excluded | **Shipped** |
| Agent-authored requests | None | Scratch drafts, human-approved | **Shipped** |
| Agent stacks in the codebase | 1 | 1 | **Shipped** |

## References

- [ADR-008](./008-rig-agent-platform-orchestration.md) — the Rig-first architecture this extends
- [ADR-003](./003-mcp-integration-architecture.md) — MCP integration, adjacent tool surface
- [ADR-011](./011-postee-single-pane-workspace.md) — the `Drawer` primitive and fixed shell
- [`ai_agent.rs`](/src-tauri/src/ai_agent.rs) — tool envelope, secret resolution, plan commands
- [`agent-context.ts`](/src/core/effects/agent-context.ts) — the redaction boundary to extend
- [Rig](https://github.com/0xplaygrounds/rig) — `rig-core` contracts, `rig-agent` orchestration, serializable `AgentRun`
- [CopilotKit](https://github.com/CopilotKit/CopilotKit) — AG-UI, CoAgents, generative UI

## Follow-Up ADRs

- ADR-NNN: Agent-authored assertions and load-test profiles, once request proposals are trusted.
- ADR-NNN: Local or self-hosted model support, which would change the egress calculus for bodies.

---

## Notes

The redaction rules are deliberately expressed as tool-layer behaviour rather than prompt instructions.
A prompt asking a model not to repeat a secret is not a control; a tool that never returns the secret
is. Anything relying on the model's cooperation should be treated as unimplemented.

### Updates

- 2026-07-25: Initial draft.
- 2026-07-25: **Accepted.** Phase 1 (the redaction boundary) is the next step; no tool
  ships before it. `ai_agent.rs` is to be read in full before Phase 2 so the tool
  contracts match what exists rather than what this ADR assumed.
- 2026-07-25: **Phase 1 implemented.** `postee/agent-redaction.ts` assembles agent
  context with the rules applied at the boundary. No tool exists yet, which is the
  intended order — the tools will have nowhere to leak from.

  Two decisions taken while building it:

  1. **Environment values have no policy flag.** Header values and bodies are
     opt-in, but variable values are never emitted in any mode. A flag would
     eventually be set, and an environment value has no legitimate reason to reach
     a model provider — the keys carry the useful information, since an agent can
     reason about `{{API_TOKEN}}` without knowing what it stands for.
  2. **A URL that will not parse is truncated at `?` rather than passed through.**
     Failing to parse must not mean failing open, and a malformed URL is exactly
     where a hand-pasted token tends to be.

  The tests are adversarial rather than example-based: a distinct secret is planted
  in every field that could carry one, and the assertion is that none appears
  anywhere in the serialised context. Validated by planting three real leaks —
  emitting environment values, passing the URL through, and failing open on an
  unparseable URL — and confirming each is caught and named.
- 2026-07-25: **Phase 2a implemented**, and a full read of `ai_agent.rs` corrected
  three assumptions this ADR made from sampling it:

  1. **There is no error taxonomy.** Every command returns `Result<_, String>`.
     The ADR listed this as unverified; it is now confirmed absent, so Postee tools
     follow the same stringly-typed convention rather than introducing a second one.
  2. **Proposals are extracted, not parsed.** `extract_openai::<T>()` drives a
     `JsonSchema` type directly, so a Postee request proposal is a schema type, not
     text to be parsed — which removes a whole class of parsing work from Phase 3.
  3. **The house pattern is sanitize-then-validate.** `sanitize_c4_diagram_plan`
     normalizes and drops recoverable problems into `warnings`; `validate_*` rejects
     what cannot be repaired. Postee proposals should follow exactly this shape.

  Also confirmed: tools take no `State<AppDb>` and are pure over frontend-supplied
  context, which is what makes the redaction boundary unbypassable. A tool that
  queried the database in Rust would reintroduce every secret Phase 1 removes.

  Phase 2a ships `activeRequest`, `environmentKeys`, and `lastResponseSummary` over
  the request-scoped context Phase 1 produces. The tools named in the original plan
  — `collection_summary`, `graphql_schema_lookup` — need workspace-scoped context
  that does not exist yet; extending the boundary to cover it is Phase 2b.

  One security note worth recording: on macOS **debug** builds the keychain is
  disabled by design (`keychain_supported_in_runtime`), so the OpenAI key resolves
  from the `app_settings` table instead. That is a development-only fallback, but it
  means the key sits in SQLite during development.
- 2026-07-25: **Phase 2b implemented.** Workspace scope: collections and the cached
  GraphQL schema, plus the `collectionSummary` and `graphqlSchemaLookup` tools the
  original plan named.

  Collections turned out to be a leak surface the Phase 1 boundary did not cover:
  every saved request carries its own URL and headers, so redacting only the active
  request would have emitted credentials for every other one. Saved request headers
  are therefore name-only **regardless of `includeHeaderValues`** — opting into the
  request you are looking at must not opt into the rest of the workspace.

  Introspection is summarised rather than forwarded. A cached payload is enormous
  and mostly machine plumbing; root field names and type names are the part that
  helps author an operation. `summariseGraphqlSchema` returns `null` rather than a
  partial summary when it cannot understand the payload, so a caller never presents
  guesswork as schema, and `graphqlSchemaLookup` states plainly when no schema is
  cached — which is what stops a model inventing field names.

  The saved-request input type takes headers in the shape callers actually hold,
  values included. A boundary that requires pre-cleaned input is not a boundary; it
  should receive the real thing and emit only what is safe.
- 2026-07-25: **Phase 3 implemented.** `rig_agent_propose_postee_request` extracts a
  request proposal against a `JsonSchema` type, and `proposalToScratchDraft` turns
  it into a scratch draft. Nothing writes to the database on either side of the
  boundary — accepting a proposal is the operator opening a tab.

  The sanitize/validate split from the C4 planner carries over cleanly, and the
  distinction turns out to be meaningful here: a GraphQL proposal that arrives as
  `GET` is *repairable*, so it is coerced to `POST` with a warning saying so, while
  a GraphQL proposal with no document is *not*, and is rejected. Same for a body on
  a `GET` — dropped with a warning rather than refused.

  The preamble tells the model what it was not given: environment variables are
  referenced as `{{KEY}}` placeholders, a credential is never to be invented, and
  the prompt context ends with an explicit list of what the boundary withheld.
  Instructing the model is not a control — the boundary is — but a model that knows
  a value was withheld asks for it rather than hallucinating one.

  One integration detail worth recording: a proposal draft must not look pristine,
  or the sprawl reclaimer added earlier would delete it on the next launch. There is
  a test asserting exactly that.
- 2026-07-25: **Phase 4 implemented.** `historyLookup` and `responseLookup`, plus a
  leak surface the earlier phases did not have.

  **Error messages embed URLs.** The HTTP client writes
  `"Failed to perform HTTP request: error sending request for url (https://host/v1?access_token=…)"`,
  and that string is stored in history verbatim. A boundary that redacted request
  URLs but not error text would have handed the credential straight back. URLs
  inside messages are now redacted in place, keeping the diagnosis and dropping the
  query string.

  `responseLookup` distinguishes **withheld** from **empty**. Returning `null` for
  both would let the agent report "the response was empty" when it simply was not
  allowed to look — so an absent body carries a reason, and the agent can ask for
  consent rather than assume.

  A note on process: one edit in this phase silently did nothing because the anchor
  text omitted a `Default` in a derive, and it was only caught by the compiler. Every
  scripted edit in this codebase should assert its replacement count.
- 2026-07-25: **Phase 5 implemented — this ADR is fully realised.** `PosteeAgentDrawer`
  puts the agent behind the same overlay surface as history, and `agentDrawer` joins
  the parallel regions in `posteeUiMachine`, so asking the agent something costs
  neither the request nor the response on screen.

  Egress consent lives next to the submit control rather than in settings. A choice
  about sending response bodies to a third party should be made where it is made,
  and defaults off every time the drawer opens.

  The interaction is proposal-then-accept throughout: the drawer shows the summary,
  the rationale, and every warning the sanitizer recorded, and only "Open as draft"
  turns it into a scratch tab. Nothing in the UI path writes to the database.

  The compiler caught the one real gap — the drawer was wired with no control to
  open it, surfacing as an unused `handleOpenAgent`. The workspace harness now
  asserts the drawer is reachable from the toolbar, which is the check that would
  have caught it without the compiler's help.
- 2026-07-25: **Persistence implemented, and this ADR's plan for it was wrong.**

  The proposal was a `surface` discriminator on `opy_agent_runs`,
  `opy_agent_tool_calls`, and `opy_agent_artifacts`. Reading their schemas shows why
  that cannot work: the latter two require `task_id -> opy_agent_tasks` and
  `session_id -> opy_chat_sessions`, both `NOT NULL`, and their `name`/`kind` CHECK
  constraints enumerate board-specific values. A Postee run has no chat session and
  no board task, so sharing those tables would mean fabricating both to satisfy
  foreign keys — a worse lie than a second table, and a set of enum values that
  would need rebuilding the tables to extend.

  Migration `033` therefore adds `postee_agent_runs` and `postee_agent_proposals`,
  leaving the board tables alone. It is the same argument already accepted for
  proposals, extended to runs: these tables have nothing in common beyond the word.

  `withheld_json` is the load-bearing column. Without it a replay cannot distinguish
  "the model saw a response body and ignored it" from "the model was never shown
  one", which is exactly the question an audit of an agent with a redaction boundary
  needs to answer. Token usage and the body-consent flag are recorded for the same
  reason: a run has a cost and an egress decision, and both belong in the record.

  A proposal row is written **before** the operator decides, so a proposal that is
  never taken up is still visible. Accepting it links the row to the scratch draft it
  became. Failure to write the audit row is logged and swallowed — losing the trace
  must not lose the operator their proposal.

  **Still outstanding:** `request_lookup`. `collectionSummary` returns saved requests
  with their redacted URLs and header names, which covers most of what it was for,
  but it is not a lookup by id and this ADR should not be read as having shipped it.
