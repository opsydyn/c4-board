# OPY Handbook

This handbook describes the current OPY surface in `c4-board`: what it can do today, how it is bounded, and how the runtime is structured.

## Phase Status

The current OPY/Rig agentic phase is concluded for the C4 board loop. OPY now has grounded read/review/proposal flows, typed planner artifacts, policy-backed confirmation, controlled apply, checkpoint rollback, resumable task state, audit/eval surfaces, anomaly boundaries, confidence scoring, and deterministic fixture coverage.

Remaining work is tracked as platform expansion or release governance rather than core OPY loop completion: broader tool coverage, transcript/session management polish, provider usage budgets once provider token/cost data is persisted, and release gates that consume the existing audit/eval signals.

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

- live board-window resize uses trailing bounds synchronization and leaves React Flow viewport ownership intact, avoiding repeated OPY renders and destructive auto-fit work

## Operational Memory

- Postmortem: [`2026-06-05 OPY native board interaction regression`](../postmortems/2026-06-05-opy-native-board-interaction-regression.md)
- Hydration and recovery effects must depend on stable refs or stable lifecycle methods, not whole hook-returned lifecycle objects or mutable session/task maps.
- Resumable task auto-activation must be idempotent per task id.
- Board window resize must not force `fitViewToGraph`; OPY/container geometry work should trail resize activity instead of firing every frame.
- Continuity spotlight ranking and boundary drilldown rules now live behind pure test coverage rather than only panel-local rendering paths.

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
- opens a slash-command palette inside the composer when the operator types `/`
- lets the operator preview command scaffolds with arrow keys and accept them with `Tab` or click
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
- persist the OPY task envelope before tool-call trace rows so lifecycle telemetry, artifact writes, and resume state stay foreign-key safe even when no preflight artifacts exist
- OPY task envelopes now carry replay/audit lifecycle metadata plus snapshot references for active-board context, proposal pre-apply checkpoints, or rollback checkpoints
- app relaunch and session hydration now restore stale run/task/tool-call state through one persistence transaction before the surface rehydrates
- hydrate each board/session identity once even while task maps and lifecycle state are being restored
- guard automatic resumable-task activation so one interrupted task cannot fan out duplicate lineage loads
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

## Approval Policy Classes

Executable OPY actions now carry a typed approval policy decision in the action descriptor. The existing `apply-with-confirmation` boundary still applies; the class tells the operator what kind of approval they are giving.

### Current Classes

- `single-add`: low-risk direct node creation, always confirmed.
- `layout`: low-risk layout-only action class reserved for layout automation.
- `batch-mutation`: proposal apply path, confirmed on threshold and inherits the mutation plan's highest risk.
- `rollback`: high-risk checkpoint restore path, always treated as threshold-triggered confirmation.
- `settings-mutation`: high-risk settings path, blocked while the Settings mutation lock is enabled.

### Operator Surface

- confirmation cards include `APPROVAL::...`, `RISK::...`, action counts, node counts, edge counts, and threshold status
- low-risk direct `/add` actions are visibly distinct from proposal batches
- rollback approvals are always high-risk and threshold-triggered
- size overrides only bypass configured action/node/edge count limits; they do not bypass the approval class, action mode, anomaly checks, planner provenance, or final confirmation

## Commands

OPY currently supports three primary operator command patterns.

### Slash Command Palette

- typing `/` in the composer opens the available command list in place
- palette entries currently cover `/diagram`, `/review`, and typed `/add` scaffolds for every supported C4 node kind
- selecting an entry inserts the command template directly into the composer so the operator can fill the remaining argument inline
- parser rules, aliases, palette entries, and control-field command hints now resolve from one typed OPY command registry instead of parallel panel-local definitions
- the palette now surfaces live action-mode availability and inline missing-argument guidance before submit
- active slash commands now expose a structured argument rail so `/add`, `/diagram`, and `/review` can be edited through typed fields while staying synced to the raw prompt string

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

Planner recovery behavior:

- OPY should infer defensible relationships when the architecture language implies flow, dependency, storage, publish/subscribe, or backing-service relationships
- OPY should record inferred or directionally uncertain relationships in `warnings`; it should ask/regenerate only when no safe relationship can be inferred
- proposal node and edge keys are normalized to stable kebab-case before validation so casing or punctuation drift from the model does not break edge resolution
- invalid or dangling proposal edges are dropped during sanitization instead of aborting the whole proposal
- OPY records a warning when an edge references a node key that is not present in the final proposal payload, and now surfaces those warnings in the proposal-ready transcript

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
- local retrieval grounding across board evidence, saved-diagram metadata, session messages, tasks, proposals, artifacts, checkpoints, governance state, operator settings, Azure sync run summaries, and complexity-field explainability snapshots
- retrieval filters for domain, scope, diagram scope, and recency before prompt assembly
- confidence labels
- deterministic grounding score built from typed board citations, scoped node/edge citations, retrieval hits, proposal/review output evidence, and ambiguity penalties
- explicit operator-visible citation bundles, including retrieval-backed settings, Azure sync, and explainability hits
- proposal and review cards show `GROUNDING::score/100`, citation coverage, retrieval coverage, and ambiguity counts so low-evidence output is visible before apply or follow-up work
- run diagnostics surfaced in the panel

### Privacy-Aware Retrieval

- retrieval prompt assembly respects the global `redactionMode`
- `off` keeps raw local evidence available to the model
- `standard` masks identifiers and sensitive metadata while keeping useful summaries
- `strict` redacts freeform transcript content and sensitive ownership/governance metadata before invocation
- retrieval loading fails open, so OPY can still answer from base board context if local history lookup fails

### Read UX Features

- latest diagnostics card
- confidence reason
- source list
- run metadata
- stage-aware failure summaries

## Anomaly Boundary

OPY now runs a local anomaly preflight before executable chat, review, proposal, and `/add` flows.

### Current Detection Coverage

- instruction override and hidden-prompt extraction attempts
- secret or credential exfiltration requests
- policy/confirmation bypass language
- broad destructive mutation phrasing on proposal/action requests
- suspicious tool-trace summaries that reference secrets, confirmation bypass, or broad destructive scope
- mutation-plan scans for unsafe language and oversized/high-risk apply batches before board mutation

### Current Behavior

- critical findings fail closed before model invocation or board-action resolution
- caution findings continue, but OPY records an `anomaly_assessment` artifact and surfaces `ANOMALY::...` chrome warnings
- anomaly results are persisted into the same OPY task artifact history used for resumes and audit inspection
- proposal apply now re-screens planner mutation plans for unsafe language and oversized/high-risk batches before `resolve_action` can stage a board mutation
- normal first-pass diagram batches are caution-level review signals, not hard blocks; OPY only fails closed for explicit unsafe language or extreme mutation batches
- extreme size blocks expose an explicit `OVERRIDE SIZE BLOCK` escape hatch for intentional large diagrams; the override covers action/node/edge count limits only and still requires final apply confirmation
- size override does not bypass action mode, ambiguity checks, missing planner artifacts, settings mutation locks, secret-exfiltration signals, or confirmation/policy-bypass language
- successful confirmed board actions clear the live anomaly chrome while leaving persisted anomaly artifacts available for audit
- Settings audit now aggregates persisted anomaly history, blocked counts, cancellations, failures, decisions, and average terminal-task duration across sessions

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
- planner and verifier trace rows now persist under the expanded OPY trace schema used by session resume, artifact history, and audit reporting
- mutation-side action descriptors and blockers are now resolved through a shared `opy-action.runtime.ts` boundary before the panel executes them
- confirmation for board mutations now happens inside OPY itself rather than through blocking browser dialogs
- the confirmation card is now derived from the active machine request metadata rather than separate panel-local state
- the OPY header/control field now surfaces `FLOW::...` stage state while a lifecycle is active
- OPY now emits lifecycle telemetry for stage start/transition/completion/cancellation/failure, not only persisted run completion
- OPY now persists deterministic `stage_transition` task artifacts for roadmap milestones: `planned`, `proposed`, `confirmed`, `applied`, `verified`, and `rolled_back`
- telemetry payloads now carry provider/model, configured max-token ceiling, action mode, rollout mode/source, anomaly severity/score, and confirmation requirement metadata for downstream scoring
- read-side failures now preserve `invoke` vs `persist` provenance, and action-side failures preserve `apply`, `verify`, and `persist` boundaries instead of collapsing to one generic runtime failure
- the control field now retains the last terminal flow outcome (`complete`, `cancelled`, `failed`) even after the active stage returns to idle
- lifecycle retry now replays from machine-owned request metadata instead of a captured panel closure
- non-terminal lifecycle stages now run under explicit entry budgets and hard timeouts so OPY fails closed when a chain loops or stalls
- the control field now surfaces active deadline, stage-entry budget, retry budget, and cancel/retry semantics as first-class operator state
- lifecycle reset now clears pending confirmation context structurally through the machine
- confirmed action execution is now re-resolved from the active machine request replay metadata instead of a panel-local execution ref
- switching or creating sessions resets the active OPY lifecycle boundary so stale flow state does not bleed across sessions
- the runtime error strip can retry the last OPY flow after a terminal failure
- late async completions from cancelled, timed-out, failed, or superseded flows are now dropped instead of mutating the active OPY state after the machine has moved on

## Settings Compatibility

- OPY widget layout hydration normalizes legacy presence aliases such as `launcher` and `surface` into the current `orb` and `field` model
- oversized persisted OPY widget dimensions are clamped back into schema-safe bounds before settings validation runs
- OPY-specific viewport sections, task-history filters, and per-mode layouts are normalized before decode so legacy or partially-written dev state does not fail closed during boot
- active OPY lifecycle requests are now persisted as resumable agent tasks, interrupted on session hydration/switch/create, and surfaced back to the operator as `RESUME TASK` / `DISMISS TASK` controls

## Resumable Task Lifecycle

`RIG-402` is now active in the product.

### Current Task Persistence

- OPY persists active lifecycle requests in `opy_agent_tasks`
- OPY persists per-task execution trail rows in `opy_agent_tool_calls`
- OPY persists durable context/result/action artifacts in `opy_agent_artifacts`
- persisted task fields include `request`, `stage`, `status`, timestamps, and error summary
- persisted task metadata includes request kind/mode, replay kind, confirmation requirement, terminal state, lineage, timestamps, and error summary
- persisted task snapshot references link to the active board context, proposal pre-apply checkpoint lookup, or rollback checkpoint id when available
- Settings agent audit builds deterministic replay-readiness plans from persisted requests, snapshot refs, artifacts, and tool traces
- non-terminal stages are tracked as `running`
- interrupted work is marked as `interrupted` instead of disappearing on remount
- trace persistence is best-effort and does not block operator flows if the local trail write fails

### Current Resume Behavior

- session hydration now interrupts stale running tasks from the previous mount
- app restart and session hydration now finalize stale runs, interrupt stale task/tool-call rows, and fetch the restored run/task state through one transactional recovery boundary
- OPY builds a resumable queue of interrupted tasks for the active session
- OPY auto-selects an active resume slot from that queue when the operator is idle
- OPY now remembers the last selected resume slot per session, so switching away and back preserves the operator's active interrupted chain when possible
- OPY hydrates the selected interrupted task's persisted tool-call and artifact trail before surfacing resume controls
- OPY now persists task lineage metadata (`lineage_key`, `parent_task_id`) so related retries or follow-on runs can be restored as a chain instead of isolated rows
- grounded chat, review, and proposal artifacts can repopulate in-memory OPY state during resume hydration
- action resume can fall back to a persisted `action_descriptor` artifact when the live replay target is missing
- read-path resume now skips completed `assemble_context`, `invoke_agent`, and `persist_assistant_message` boundaries when the matching persisted artifacts are present
- action-path resume now skips completed `execute_board_action`, `refresh_checkpoints`, and `persist_assistant_message` boundaries when the matching persisted trail is present
- confirmed action tasks interrupted during `applying` or `verifying` now resume directly into the apply boundary instead of returning to the confirmation gate
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
- current persisted artifacts include grounded context bundles, chat/proposal/review results, action descriptors, action results, resume boundary outcomes, mutation plans, stage transitions, and checkpoint restore previews
- restart recovery is covered by a persistence-level test that proves interrupted runs become failed, interrupted tasks/tool calls remain resumable, and persisted artifacts survive relaunch hydration

### Current Task History Surface

- the control field now shows a per-session `TASK HISTORY` strip
- each task row exposes request label, task status, current stage, timestamp, and short task id
- expanding a task lazy-loads its persisted tool-call timeline and artifact bundle
- interrupted tasks are marked distinctly from failed and completed tasks
- artifacts are rendered inline so operators can inspect grounded context, mutation plans, and restore previews after failure or resume
- task history now shows both `RESUME PLAN` and `RESUME OUTCOME`, so operators can compare expected boundary reuse against what was actually rerun
- interrupted-task cards, resume cards, and task-history rows now also show chain-level outcome rollups (`LOCAL`, `INHERITED`, `RERAN`, `PENDING`) aggregated across the full lineage trail
- task history now starts with a deduplicated continuity summary for the current filter scope, showing active/interrupted chain count, cross-session reach, and reuse efficiency without double-counting older chain segments
- task history now also includes a `CHAIN HISTORY` strip with one actionable row per continuity chain, including `FOCUS TASKS`, `OPEN CHAIN`, and `RESUME LATEST` controls when an interrupted resumable segment exists
- task history now supports operator-facing filtering by continuity chain and boundary state, so larger lineage trails can be narrowed to one chain or one reuse/rerun condition without losing the persisted diagnostics
- chain history now also supports scope filtering (`ALL CHAINS`, `ACTIVE`, `INTERRUPTED`, `CROSS-SESSION`, `LOW EFFICIENCY`) so operators can isolate the most important continuity trails without expanding every row
- chain history is now ordered by operator attention, and OPY surfaces a `CONTINUITY SPOTLIGHT` card that pulls the most urgent chain to the top with explicit reasons like `RESUME READY`, `CROSS-SESSION`, or low reuse efficiency
- that continuity spotlight now also renders a boundary-by-boundary drilldown (`CONTEXT`, `RESULT`, `ACTION`, `APPLY`, `MESSAGE`, `CHECKPOINTS`) with explicit `LOCAL`, `INHERITED`, `RERAN`, or `PENDING` state, plus a `HEALTH DRIVERS` line that isolates the reran/pending boundaries causing the chain to look unhealthy
- task-history filters are now remembered per session, so switching away and back restores the operator’s last chain/boundary view for that session instead of resetting to `ALL`
- that per-session memory now includes the chain-history scope filter, so OPY restores the exact continuity lens the operator last used for a session
- task-history rows now expose quick actions to open the full row detail, jump to the matching resumable chain when one exists, or reveal the most relevant OPY section for that task kind
- when the current session is already surfacing the matching review, proposal, plan, or checkpoint artifact, those task-history quick actions now scroll directly to that exact card instead of only opening the parent section
- those exact-artifact deep links now also set an active OPY focus target, so the matched live card stays highlighted and the widget chrome surfaces a `FOCUS::...` signal until another navigation path replaces it or the operator changes context
- operators can now explicitly clear that OPY focus target either from the `FOCUS::...` chrome preview or from the focused live card itself, without needing to navigate to a different artifact first

### Current Eval Dashboard

- Settings agent audit now reports p50/p95 terminal task latency from persisted task envelopes
- Settings agent audit now reports p95 tool-call latency and tool-call success rate from persisted tool traces
- Settings agent audit now reports replay readiness counts: replayable, partial, and blocked
- replay readiness is deterministic and based on the stored request replay kind, required artifacts, snapshot linkage, and terminal task status
- offline Rig fixture evals now cover read-only QA grounding, safe mutation approval metadata, read-only mutation blocking, policy-budget rejection, low-confidence proposal coverage, failed-provider replay blocking, and Azure-heavy rollback preview/approval
- provider token usage and cost are not yet included because the runtime does not persist provider-reported usage data

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
- newly-created proposal nodes are grouped with the essential `dataFlow` layout before save so applied proposals land as a coherent cluster
- proposal edge creation now uses collision-resistant edge IDs so multi-edge applies cannot generate duplicate React keys or SQLite `edges.id` conflicts
- save runs through `C4CanvasContainer` manual save path before the visible board is hydrated with the proposal snapshot
- failed save leaves the visible board unchanged and keeps the pre-apply checkpoint available for audit/recovery

### Apply Safety

- apply only in `apply-with-confirmation`
- proposal CTA advances through the safe sequence: `APPROVE PLAN` while pending or rejected, `APPLY PROPOSAL` after approval, then inline `CONFIRM ACTION` or `CANCEL ACTION` while the lifecycle waits for operator confirmation
- large proposal batches may require `OVERRIDE SIZE BLOCK` before `APPLY PROPOSAL`; this writes an audit line and does not apply anything until the final confirmation is accepted
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
5. Approve the plan with `APPROVE PLAN`.
6. Request the approved apply with `APPLY PROPOSAL` in `apply-with-confirmation`.
7. Confirm or cancel the pending board mutation from the proposal card.
8. Inspect the restore diff preview if you need to recover.
9. Use checkpoint history to restore deliberately through the save boundary.

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
