---
title: "ADR-012: OPY in Postee — Agent-Assisted Request Authoring"
---

# ADR-012: OPY in Postee — Agent-Assisted Request Authoring

**Status**: Proposed
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

Shared run machinery gains a `surface` discriminator (`board | postee`) on `opy_agent_runs`,
`opy_agent_tool_calls`, and `opy_agent_artifacts`. Proposals get their own table.

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
| Postee context reachable by OPY | None | Typed read tools | Proposed |
| Credentials in assembled context | Unprotected by design | Structurally excluded | Proposed |
| Agent-authored requests | None | Scratch drafts, human-approved | Proposed |
| Agent stacks in the codebase | 1 | 1 | Proposed |

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
