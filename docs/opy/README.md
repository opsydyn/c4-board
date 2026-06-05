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
- keeps the transcript and composer pinned in a dedicated bottom conversation strip
- scrolls diagnostics, plan cards, and session controls independently above the composer
- collapses upper control and diagnostics sections by default so conversation stays primary
- remembers upper viewport section open/closed state across widget remounts
- marks fresh proposal, review, and checkpoint output on closed summaries until opened
- renders tactical one-line section summaries for control, diagnostics, proposals, reviews, and checkpoints
- uses a compact blue presence-line header with an enlarged animated OPY lens instead of a large hero title
- compresses header telemetry into a denser two-column tactical status cluster
- prioritizes `MODE`, `STATE`, and `SNAP` in the header while demoting `NODES`, `EDGES`, and `SIZE` into a responsive secondary board-status row
- promotes live `review`, `proposal`, `checkpoint`, and policy urgency into the widget chrome so the header pills, orb state, and collapsed section summaries all signal severity before expansion
- allows those chrome severity pills to open and focus the matching OPY section directly
- shows a short hover/focus preview for each chrome signal before you open the full section
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
- dev and installed runtimes share the same persistent app storage root

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

## Orchestration Lifecycle

OPY now has an explicit UI-side orchestration machine for active flows.

### Lifecycle Stages

- `contextualizing`
- `planning`
- `proposing`
- `awaiting_confirmation`
- `applying`
- `verifying`
- `completed`
- `failed`

### Current Lifecycle Behavior

- read flows (`chat`, `review`, `proposal`) move through context, planning, proposal persistence, and verification explicitly
- confirmed board mutations (`/add`, proposal apply, checkpoint rollback) move through confirmation, apply, and verify explicitly
- mutation-side action descriptors and blockers are now resolved through a shared `opy-action.runtime.ts` boundary before the panel executes them
- confirmation for board mutations now happens inside OPY itself rather than through blocking browser dialogs
- the confirmation card is now derived from the active machine request metadata rather than separate panel-local state
- the OPY header/control field now surfaces `FLOW::...` stage state while a lifecycle is active
- OPY now emits lifecycle telemetry for stage start/transition/completion/cancellation/failure, not only persisted run completion
- read-side failures now preserve `invoke` vs `persist` provenance, and action-side failures preserve `apply`, `verify`, and `persist` boundaries instead of collapsing to one generic runtime failure
- the control field now retains the last terminal flow outcome (`complete`, `cancelled`, `failed`) even after the active stage returns to idle
- lifecycle retry now replays from machine-owned request metadata instead of a captured panel closure
- lifecycle reset now clears pending confirmation context structurally through the machine
- confirmed action execution is now re-resolved from the active machine request replay metadata instead of a panel-local execution ref
- switching or creating sessions resets the active OPY lifecycle boundary so stale flow state does not bleed across sessions
- the runtime error strip can retry the last OPY flow after a terminal failure
- active OPY lifecycle requests are now persisted as resumable agent tasks, interrupted on session hydration/switch/create, and surfaced back to the operator as `RESUME TASK` / `DISMISS TASK` controls

## Resumable Task Lifecycle

`RIG-402` is now active in the product.

### Current Task Persistence

- OPY persists active lifecycle requests in `opy_agent_tasks`
- OPY persists per-task execution trail rows in `opy_agent_tool_calls`
- OPY persists durable context/result/action artifacts in `opy_agent_artifacts`
- persisted task fields include `request`, `stage`, `status`, timestamps, and error summary
- non-terminal stages are tracked as `running`
- interrupted work is marked as `interrupted` instead of disappearing on remount
- trace persistence is best-effort and does not block operator flows if the local trail write fails

### Current Resume Behavior

- session hydration now interrupts stale running tasks from the previous mount
- OPY builds a resumable queue of interrupted tasks for the active session
- OPY auto-selects an active resume slot from that queue when the operator is idle
- OPY now remembers the last selected resume slot per session, so switching away and back preserves the operator's active interrupted chain when possible
- OPY hydrates the selected interrupted task's persisted tool-call and artifact trail before surfacing resume controls
- OPY now persists task lineage metadata (`lineage_key`, `parent_task_id`) so related retries or follow-on runs can be restored as a chain instead of isolated rows
- grounded chat, review, and proposal artifacts can repopulate in-memory OPY state during resume hydration
- action resume can fall back to a persisted `action_descriptor` artifact when the live replay target is missing
- read-path resume now skips completed `assemble_context`, `invoke_agent`, and `persist_assistant_message` boundaries when the matching persisted artifacts are present
- action-path resume now skips completed `execute_board_action`, `refresh_checkpoints`, and `persist_assistant_message` boundaries when the matching persisted trail is present
- if the interrupted task stage is resumable, OPY exposes both a control-field interrupted-task queue and a resume card for the active slot
- operators can switch the active resume slot to a different interrupted task without losing the persisted trail
- interrupted queue cards and task history cards now show chain diagnostics before expansion, including segment count, inherited segments, completed reusable boundaries, and captured artifact count
- when the selected task belongs to a known lineage, OPY aggregates ancestor tool calls and artifacts so resume can continue from the last completed boundary across the chain
- OPY now treats compatible sessions on the same board/domain as one continuity surface when lineage replay matches, so resumable chain provenance can span more than the currently selected session
- interrupted queue cards, resume cards, and task history rows now surface cross-session provenance with session count, cross-session segment count, and session-scope labels when the active chain inherits work from another session
- OPY now exposes an explicit resume-boundary plan for interrupted chains, showing which steps will be reused (`CONTEXT`, `RESULT`, `ACTION`, `APPLY`) and which remain fresh
- session-local boundaries such as assistant-message persistence and checkpoint refresh are no longer treated as reusable across sessions, even when the broader continuity chain is inherited
- resumed tasks now persist a `resume_boundary_outcome` artifact so OPY can record what actually happened at execution time, not just the pre-run reuse plan
- resume outcome tracking distinguishes reused current-session work, reused inherited-session work, and boundaries that were rerun in the active task
- OPY now rolls those persisted outcomes up across the full lineage chain, so operators can see continuity efficiency for the whole resumable trail instead of only one task
- operators can either resume the exact persisted request or dismiss it explicitly
- when the active resumable task is dismissed or resolved, OPY auto-advances to the next interrupted task in the queue
- starting a new OPY lifecycle supersedes any older resumable task for that session
- current persisted tool calls include context assembly, agent invoke, assistant-message persistence, action resolution, board mutation execution, and post-apply checkpoint refresh
- current persisted artifacts include grounded context bundles, chat/proposal/review results, action descriptors, action results, resume boundary outcomes, mutation plans, and checkpoint restore previews

### Current Task History Surface

- the control field now shows a per-session `TASK HISTORY` strip
- each task row exposes request label, task status, current stage, timestamp, and short task id
- expanding a task lazy-loads its persisted tool-call timeline and artifact bundle
- interrupted tasks are marked distinctly from failed and completed tasks
- artifacts are rendered inline so operators can inspect grounded context, mutation plans, and restore previews after failure or resume
- task history now shows both `RESUME PLAN` and `RESUME OUTCOME`, so operators can compare expected boundary reuse against what was actually rerun
- interrupted-task cards, resume cards, and task-history rows now also show chain-level outcome rollups (`LOCAL`, `INHERITED`, `RERAN`, `PENDING`) aggregated across the full lineage trail
- task history now supports operator-facing filtering by continuity chain and boundary state, so larger lineage trails can be narrowed to one chain or one reuse/rerun condition without losing the persisted diagnostics
- task-history filters are now remembered per session, so switching away and back restores the operator’s last chain/boundary view for that session instead of resetting to `ALL`
- task-history rows now expose quick actions to open the full row detail, jump to the matching resumable chain when one exists, or reveal the most relevant OPY section for that task kind
- when the current session is already surfacing the matching review, proposal, plan, or checkpoint artifact, those task-history quick actions now scroll directly to that exact card instead of only opening the parent section
- those exact-artifact deep links now also set an active OPY focus target, so the matched live card stays highlighted and the widget chrome surfaces a `FOCUS::...` signal until another navigation path replaces it or the operator changes context
- operators can now explicitly clear that OPY focus target either from the `FOCUS::...` chrome preview or from the focused live card itself, without needing to navigate to a different artifact first

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
- restore diff preview against current board state before confirm
- proposal provenance shown when available
- restore runs through the same save boundary
- failed restore rehydrates the pre-restore board

### Current Restore UX

- latest checkpoint summary
- historical restore targets
- node/edge counts per checkpoint
- restore/revert/remove counts before confirm
- impacted node/edge list for each restore target
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
- keychain writes are read-back verified before the UI reports success
- keychain read failures surface as runtime diagnostics instead of collapsing to “missing key”
- dev/runtime keychain failures fall back to settings DB with an explicit warning
- macOS debug builds intentionally use the settings DB fallback instead of keychain
- the settings panel reports `SETTINGS DB (FALLBACK)` when dev keychain access is unavailable
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
7. Inspect the restore diff preview if you need to recover.
8. Use checkpoint history to restore deliberately through the save boundary.

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
- [src/core/effects/opy-action.runtime.ts](../../src/core/effects/opy-action.runtime.ts)
- [src/core/effects/agent-apply.runtime.ts](../../src/core/effects/agent-apply.runtime.ts)
- [src/core/effects/agent-rollback.runtime.ts](../../src/core/effects/agent-rollback.runtime.ts)

Planning references:

- [docs/adr/008-rig-agent-platform-orchestration.md](../adr/008-rig-agent-platform-orchestration.md)
- [docs/rig-agent-task-breakdown.md](../rig-agent-task-breakdown.md)

## Status Snapshot

As of this handbook, OPY has completed the practical foundation/read/proposal/apply/restore slices required to function as a controlled architecture copilot inside the board surface, including targeted checkpoint restore with previewable board deltas.
