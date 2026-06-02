# OPY Handbook

This handbook describes the current OPY surface in `c4-board`: what it can do today, how it is bounded, and how the runtime is structured.

## What OPY Is

OPY is the board-native architecture copilot for `c4-board`.

Today it combines:

- a floating operator widget on top of the canvas
- a grounded chat/review/proposal surface
- a typed mutation planning path
- a controlled apply boundary with checkpoints and restore

The current implementation is strongest in **C4 mode**. Read-only chat is broader, but the review, proposal, apply, and rollback flows are explicitly centered on the C4 board.

## Surface Model

OPY is no longer tied to the fixed sidebar. It runs as a floating widget with persisted presence and layout memory.

### Presence States

- `launcher`: entry point when OPY is hidden
- `orb`: minimized recovery/control state
- `surface`: active widget frame

### Widget Modes

- `field`: standard OPY working surface
- `mission`: larger analysis surface for deeper review

### Widget Behavior

- draggable within the canvas region
- resizable
- snap-aware
- remembers layout per mode
- restores last active mode after minimize/reopen

### Snap Targets

- `center`
- `left-rail`
- `right-rail`
- `bottom-dock`
- `free`

## Orb Controls

The floating widget exposes orb/menu controls around the frame.

### Focus

- switch between compact/field/mission behavior
- restore mode-specific layout memory

### Context

- change snap position
- bias OPY toward current board context

### Route

- jump across OPY working surfaces and related actions

### System

- minimize to orb
- reset position/mode
- restore operational surface

## Session Model

OPY is session-based and durable.

Each OPY session persists:

- session title
- transcript messages
- grounded response state
- run envelopes
- diagram proposal artifacts
- checkpoint artifacts

### Session Features

- create new sessions
- rename sessions
- resume prior sessions
- restore the latest transcript and artifact context

## Action Modes

OPY is policy-gated by action mode.

### `disabled`

- mutation routes offline
- chat/review are effectively blocked from board-changing flows

### `read-only`

- inspect only
- no board mutation
- use chat and `/review`

### `propose`

- OPY can produce mutation plans
- apply remains blocked

### `apply-with-confirmation`

- operator can approve and apply safe plans
- rollback/restore is enabled

## Commands

OPY currently supports three primary operator command patterns.

### `/add <type> <label>`

Direct board add action for:

- `person`
- `system`
- `external`
- `container`
- `component`

### `/diagram <description>`

Request a C4 change proposal from natural language.

Also accepts:

- `/plan <description>`

### `/review [focus]`

Request a read-only architecture review of the active C4 board, optionally scoped to a focus area.

## Read Intelligence

OPY’s answers are grounded in typed read tools rather than free-form prompt stuffing alone.

### Current Read Tools

- `board_summary`
- `node_lookup`
- `edge_lookup`

### Grounding Features

- context assembly from current board state
- confidence labels
- citations/provenance bundles
- run diagnostics surfaced in the panel

### Read UX Features

- latest diagnostics card
- confidence reason
- source list
- run metadata
- stage-aware failure summaries

## Run Envelope and Telemetry

Each OPY run is wrapped in a durable run envelope.

### Run Fields

- `runId`
- `intent`
- `stage`
- `status`
- `startedAt`
- `completedAt`
- `errorSummary`

### Current Run Intents

- `chat`
- `plan-c4-diagram`
- `review-c4-board`

### Current Stages

- `invoke`
- `persist`
- `complete`

### Current Statuses

- `running`
- `completed`
- `failed`
- `cancelled`

## Error Taxonomy

OPY normalizes failures into typed categories.

### Error Classes

- `AgentConfigError`
- `AgentRuntimeError`
- `AgentPolicyError`

These are used to distinguish:

- missing configuration or secret problems
- runtime/provider failures
- policy/mode boundary violations

## Proposal and Mutation Planning

OPY does not mutate the board directly from model text.

Instead it creates typed mutation plans and renders them for operator review.

### Mutation Tool Contracts

- `create_nodes`
- `update_nodes`
- `create_edges`
- `apply_layout`

### Plan Features

- typed mutation validation
- action counts
- risk summary
- impacted entities
- blocker/issue list
- approve/reject decision state

### Diff Features

- grounded node diff
- grounded edge diff
- ambiguity detection
- no-op detection

## Controlled Apply

Board changes flow through the existing save boundary rather than bypassing board persistence rules.

### Apply Boundary

- operator confirms apply
- OPY creates a pre-apply checkpoint
- in-memory board is updated
- save runs through `C4CanvasContainer` manual save path
- failed save restores the pre-apply snapshot

### Apply Safety

- apply only in `apply-with-confirmation`
- apply blocked when plan is unresolved or ambiguous
- save failure keeps board recoverable

## Checkpoints and Restore

Every confirmed OPY apply creates a pre-apply checkpoint artifact.

### Checkpoint Data

- checkpoint id
- session id
- diagram id
- proposal timestamp
- snapshot of board nodes/edges/metadata
- creation time

### Restore Features

- restore latest checkpoint
- restore any checkpoint from history
- proposal provenance shown when available
- restore runs through the same save boundary
- failed restore rehydrates the pre-restore board

### Current Restore UX

- latest checkpoint summary
- historical restore targets
- node/edge counts per checkpoint
- linked proposal summary and command source when matched

## Widget Persistence

OPY widget state is persisted in settings.

### Persisted Layout Concepts

- visibility/presence
- current mode
- snap target
- size and position
- per-mode layout memory

## Configuration

OPY depends on an OpenAI-compatible model configuration.

### Key Handling

- secure key resolution boundary
- UI shows configured/not configured diagnostics
- runtime keeps raw secrets out of transcript and telemetry surfaces

### User-Facing State

- key checking
- key configured
- key missing
- key error

## Current Scope and Limits

Current practical scope:

- strongest support is C4
- review/proposal/apply/rollback are C4-first
- read tooling is intentionally narrow and deterministic
- mutation application is still bounded to the typed proposal pipeline

Not implemented yet:

- checkpoint diff preview before restore
- broader write tool families beyond current typed set
- full multi-stage orchestration machine from later Rig phases
- resumable long-running tasks/artifacts from the later roadmap phases

## Operator Flow

The current happy path is:

1. Open OPY from the floating launcher or orb.
2. Ask a question, run `/review`, or request `/diagram`.
3. Inspect diagnostics, citations, and confidence.
4. For proposals, inspect the typed plan and blockers.
5. Approve the plan.
6. Apply in `apply-with-confirmation`.
7. Use checkpoint history to restore if needed.

## Key Files

Primary OPY surface files:

- [src/ui/components/OpyFloatingWidget.tsx](../../src/ui/components/OpyFloatingWidget.tsx)
- [src/ui/components/OpyCopilotPanel.tsx](../../src/ui/components/OpyCopilotPanel.tsx)
- [src/ui/components/styles.css.ts](../../src/ui/components/styles.css.ts)

Runtime and persistence:

- [src/core/effects/ai-agent.runtime.ts](../../src/core/effects/ai-agent.runtime.ts)
- [src/core/effects/opy-board-context.ts](../../src/core/effects/opy-board-context.ts)
- [src/core/effects/opy-chat.persistence.ts](../../src/core/effects/opy-chat.persistence.ts)
- [src/core/effects/agent-context.ts](../../src/core/effects/agent-context.ts)
- [src/core/effects/agent-plan-diff.ts](../../src/core/effects/agent-plan-diff.ts)
- [src/core/effects/agent-apply.runtime.ts](../../src/core/effects/agent-apply.runtime.ts)
- [src/core/effects/agent-rollback.runtime.ts](../../src/core/effects/agent-rollback.runtime.ts)

Planning references:

- [docs/adr/008-rig-agent-platform-orchestration.md](../adr/008-rig-agent-platform-orchestration.md)
- [docs/rig-agent-task-breakdown.md](../rig-agent-task-breakdown.md)

## Status Snapshot

As of this handbook, OPY has completed the practical foundation/read/proposal/apply/restore slices required to function as a controlled architecture copilot inside the board surface.
