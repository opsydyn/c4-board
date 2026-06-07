import { Effect } from "effect";
import type { RigAgentContextBundle, RigAgentCitation } from "./agent-context";
import type { RigC4DiagramProposal } from "./ai-agent.runtime";
import type { SaveDiagramInput } from "./canvas-persistence";
import { DatabaseService, NotFoundError } from "./database.base";
import { deriveOpyAgentTaskLineageKey } from "./opy-agent.task-lineage";
import type {
  OpyAgentLifecycleConfirmation,
  OpyAgentLifecycleMode,
  OpyAgentLifecycleNonTerminalStage,
  OpyAgentLifecycleReplay,
  OpyAgentLifecycleRequest,
} from "./opy-agent.lifecycle";
import type {
  OpyAgentArtifact,
  OpyAgentArtifactKind,
  OpyAgentToolCall,
  OpyAgentToolCallName,
  OpyAgentToolCallStatus,
} from "./opy-agent.trace";

export type OpyChatRole = "assistant" | "user" | "system";
export type OpyChatDomain = "c4" | "ddd";

export interface OpyChatSession {
  readonly id: string;
  readonly title: string;
  readonly domain: OpyChatDomain;
  readonly diagramId: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly lastMessageAt: number | null;
}

export interface OpyChatMessage {
  readonly id: string;
  readonly sessionId: string;
  readonly role: OpyChatRole;
  readonly content: string;
  readonly createdAt: number;
}

export type OpyAgentRunAgent = "opy-net";
export type OpyAgentRunIntent = "chat" | "plan-c4-diagram" | "review-c4-board";
export type OpyAgentRunStage = "invoke" | "persist" | "complete";
export type OpyAgentRunStatus = "running" | "completed" | "failed" | "cancelled";

export interface OpyAgentRun {
  readonly id: string;
  readonly sessionId: string;
  readonly agent: OpyAgentRunAgent;
  readonly intent: OpyAgentRunIntent;
  readonly stage: OpyAgentRunStage;
  readonly status: OpyAgentRunStatus;
  readonly startedAt: number;
  readonly completedAt: number | null;
  readonly errorSummary: string | null;
}

export interface OpyAgentTask {
  readonly id: string;
  readonly sessionId: string;
  readonly request: OpyAgentLifecycleRequest;
  readonly lineageKey?: string | null;
  readonly parentTaskId?: string | null;
  readonly stage: OpyAgentTaskStage;
  readonly status: OpyAgentTaskStatus;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly completedAt: number | null;
  readonly errorSummary: string | null;
}

export type OpyAgentTaskStatus = "running" | "interrupted" | "completed" | "failed" | "cancelled";
export type OpyAgentTaskStage = OpyAgentLifecycleNonTerminalStage | "completed" | "failed";

export type OpyPlanDecisionStatus = "pending" | "approved" | "rejected";

export interface OpyPersistedDiagramProposal {
  readonly sessionId: string;
  readonly commandDescription: string;
  readonly proposal: RigC4DiagramProposal;
  readonly context: RigAgentContextBundle;
  readonly decisionStatus: OpyPlanDecisionStatus;
  readonly decidedAt: number;
}

export type OpyAgentCheckpointType = "pre-apply";

export interface OpyAgentCheckpointSnapshot extends SaveDiagramInput {
  readonly savedAt: number | null;
}

export interface OpyAgentCheckpoint {
  readonly id: string;
  readonly sessionId: string;
  readonly diagramId: string;
  readonly proposalRespondedAtMs: number;
  readonly checkpointType: OpyAgentCheckpointType;
  readonly snapshot: OpyAgentCheckpointSnapshot;
  readonly createdAt: number;
}

export interface ListOpyChatSessionsInput {
  readonly domain: OpyChatDomain;
  readonly diagramId: string | null;
}

export interface CreateOpyChatSessionInput {
  readonly id: string;
  readonly title: string;
  readonly domain: OpyChatDomain;
  readonly diagramId: string | null;
  readonly createdAt?: number;
  readonly initialMessage?: {
    readonly id: string;
    readonly role: OpyChatRole;
    readonly content: string;
    readonly createdAt?: number;
  };
}

export interface RenameOpyChatSessionInput {
  readonly sessionId: string;
  readonly title: string;
}

export interface RenameOpyChatSessionResult {
  readonly sessionId: string;
  readonly title: string;
  readonly updatedAt: number;
}

export interface FinalizeInterruptedOpyAgentRunsInput {
  readonly sessionId: string;
  readonly completedAt?: number;
  readonly errorSummary?: string;
}

export interface InterruptOpyAgentTasksInput {
  readonly sessionId: string;
  readonly errorSummary?: string;
  readonly updatedAt?: number;
}

export interface InterruptOpyAgentToolCallsInput {
  readonly sessionId: string;
  readonly errorSummary?: string;
  readonly updatedAt?: number;
}

export interface RestoreInterruptedOpyAgentSessionStateInput {
  readonly sessionId: string;
  readonly runErrorSummary?: string;
  readonly taskErrorSummary?: string;
  readonly toolCallErrorSummary?: string;
  readonly completedAt?: number;
  readonly updatedAt?: number;
}

export interface OpyInterruptedAgentSessionState {
  readonly finalizedRuns: ReadonlyArray<OpyAgentRun>;
  readonly interruptedTasks: ReadonlyArray<OpyAgentTask>;
  readonly interruptedToolCalls: ReadonlyArray<OpyAgentToolCall>;
  readonly runs: ReadonlyArray<OpyAgentRun>;
  readonly tasks: ReadonlyArray<OpyAgentTask>;
}

const LIST_SESSIONS_SQL = `
  SELECT
    id,
    title,
    domain,
    diagram_id AS diagramId,
    created_at AS createdAt,
    updated_at AS updatedAt,
    last_message_at AS lastMessageAt
  FROM opy_chat_sessions
  WHERE domain = ?
    AND (
      (? IS NULL AND diagram_id IS NULL)
      OR diagram_id = ?
    )
  ORDER BY updated_at DESC
`;

const LIST_ALL_SESSIONS_SQL = `
  SELECT
    id,
    title,
    domain,
    diagram_id AS diagramId,
    created_at AS createdAt,
    updated_at AS updatedAt,
    last_message_at AS lastMessageAt
  FROM opy_chat_sessions
  ORDER BY updated_at DESC
`;

const CREATE_SESSION_SQL = `
  INSERT INTO opy_chat_sessions (
    id,
    title,
    domain,
    diagram_id,
    created_at,
    updated_at,
    last_message_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?)
`;

const INSERT_MESSAGE_SQL = `
  INSERT INTO opy_chat_messages (
    id,
    session_id,
    role,
    content,
    created_at
  )
  VALUES (?, ?, ?, ?, ?)
`;

const UPDATE_SESSION_ACTIVITY_SQL = `
  UPDATE opy_chat_sessions
  SET
    updated_at = ?,
    last_message_at = ?
  WHERE id = ?
`;

const RENAME_SESSION_SQL = `
  UPDATE opy_chat_sessions
  SET
    title = ?,
    updated_at = ?
  WHERE id = ?
`;

const LIST_MESSAGES_SQL = `
  SELECT
    id,
    session_id AS sessionId,
    role,
    content,
    created_at AS createdAt
  FROM opy_chat_messages
  WHERE session_id = ?
  ORDER BY created_at ASC
`;

const LIST_RUNS_SQL = `
  SELECT
    id,
    session_id AS sessionId,
    agent,
    intent,
    stage,
    status,
    started_at AS startedAt,
    completed_at AS completedAt,
    error_summary AS errorSummary
  FROM opy_agent_runs
  WHERE session_id = ?
  ORDER BY started_at DESC
`;

const LIST_AGENT_TASKS_SQL = `
  SELECT
    id,
    session_id AS sessionId,
    request_json AS requestJson,
    lineage_key AS lineageKey,
    parent_task_id AS parentTaskId,
    stage,
    status,
    created_at AS createdAt,
    updated_at AS updatedAt,
    completed_at AS completedAt,
    error_summary AS errorSummary
  FROM opy_agent_tasks
  WHERE session_id = ?
  ORDER BY updated_at DESC, created_at DESC
`;

const LIST_ALL_AGENT_TASKS_SQL = `
  SELECT
    id,
    session_id AS sessionId,
    request_json AS requestJson,
    lineage_key AS lineageKey,
    parent_task_id AS parentTaskId,
    stage,
    status,
    created_at AS createdAt,
    updated_at AS updatedAt,
    completed_at AS completedAt,
    error_summary AS errorSummary
  FROM opy_agent_tasks
  ORDER BY updated_at DESC, created_at DESC
`;

const LIST_AGENT_TOOL_CALLS_SQL = `
  SELECT
    id,
    task_id AS taskId,
    session_id AS sessionId,
    name,
    status,
    started_at AS startedAt,
    updated_at AS updatedAt,
    completed_at AS completedAt,
    input_summary AS inputSummary,
    output_summary AS outputSummary,
    error_summary AS errorSummary
  FROM opy_agent_tool_calls
  WHERE task_id = ?
  ORDER BY started_at ASC, updated_at ASC
`;

const LIST_AGENT_ARTIFACTS_SQL = `
  SELECT
    id,
    task_id AS taskId,
    session_id AS sessionId,
    tool_call_id AS toolCallId,
    kind,
    summary,
    payload_json AS payloadJson,
    created_at AS createdAt
  FROM opy_agent_artifacts
  WHERE task_id = ?
  ORDER BY created_at ASC
`;

const LIST_DIAGRAM_PROPOSALS_SQL = `
  SELECT
    session_id AS sessionId,
    command_description AS commandDescription,
    proposal_json AS proposalJson,
    context_json AS contextJson,
    decision_status AS decisionStatus,
    decided_at AS decidedAt
  FROM opy_diagram_proposals
  WHERE session_id = ?
  ORDER BY decided_at DESC, proposal_responded_at DESC
`;

const LIST_ALL_DIAGRAM_PROPOSALS_SQL = `
  SELECT
    session_id AS sessionId,
    command_description AS commandDescription,
    proposal_json AS proposalJson,
    context_json AS contextJson,
    decision_status AS decisionStatus,
    decided_at AS decidedAt
  FROM opy_diagram_proposals
  ORDER BY decided_at DESC, proposal_responded_at DESC
`;

const LIST_AGENT_CHECKPOINTS_SQL = `
  SELECT
    id,
    session_id AS sessionId,
    diagram_id AS diagramId,
    proposal_responded_at AS proposalRespondedAtMs,
    checkpoint_type AS checkpointType,
    snapshot_json AS snapshotJson,
    created_at AS createdAt
  FROM opy_agent_checkpoints
  WHERE session_id = ?
  ORDER BY created_at DESC
`;

const GET_AGENT_CHECKPOINT_SQL = `
  SELECT
    id,
    session_id AS sessionId,
    diagram_id AS diagramId,
    proposal_responded_at AS proposalRespondedAtMs,
    checkpoint_type AS checkpointType,
    snapshot_json AS snapshotJson,
    created_at AS createdAt
  FROM opy_agent_checkpoints
  WHERE id = ?
  LIMIT 1
`;

const LIST_ACTIVE_RUNS_SQL = `
  SELECT
    id,
    session_id AS sessionId,
    agent,
    intent,
    stage,
    status,
    started_at AS startedAt,
    completed_at AS completedAt,
    error_summary AS errorSummary
  FROM opy_agent_runs
  WHERE session_id = ?
    AND status = 'running'
  ORDER BY started_at DESC
`;

const LIST_RUNNING_TASKS_SQL = `
  SELECT
    id,
    session_id AS sessionId,
    request_json AS requestJson,
    lineage_key AS lineageKey,
    parent_task_id AS parentTaskId,
    stage,
    status,
    created_at AS createdAt,
    updated_at AS updatedAt,
    completed_at AS completedAt,
    error_summary AS errorSummary
  FROM opy_agent_tasks
  WHERE session_id = ?
    AND status = 'running'
  ORDER BY updated_at DESC, created_at DESC
`;

const LIST_RUNNING_TOOL_CALLS_SQL = `
  SELECT
    id,
    task_id AS taskId,
    session_id AS sessionId,
    name,
    status,
    started_at AS startedAt,
    updated_at AS updatedAt,
    completed_at AS completedAt,
    input_summary AS inputSummary,
    output_summary AS outputSummary,
    error_summary AS errorSummary
  FROM opy_agent_tool_calls
  WHERE session_id = ?
    AND status = 'running'
  ORDER BY started_at ASC, updated_at ASC
`;

const INSERT_RUN_SQL = `
  INSERT INTO opy_agent_runs (
    id,
    session_id,
    agent,
    intent,
    stage,
    status,
    started_at,
    completed_at,
    error_summary
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const UPSERT_TASK_SQL = `
  INSERT INTO opy_agent_tasks (
    id,
    session_id,
    request_json,
    lineage_key,
    parent_task_id,
    stage,
    status,
    created_at,
    updated_at,
    completed_at,
    error_summary
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    request_json = excluded.request_json,
    lineage_key = excluded.lineage_key,
    parent_task_id = excluded.parent_task_id,
    stage = excluded.stage,
    status = excluded.status,
    updated_at = excluded.updated_at,
    completed_at = excluded.completed_at,
    error_summary = excluded.error_summary
`;

const UPSERT_TOOL_CALL_SQL = `
  INSERT INTO opy_agent_tool_calls (
    id,
    task_id,
    session_id,
    name,
    status,
    started_at,
    updated_at,
    completed_at,
    input_summary,
    output_summary,
    error_summary
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    status = excluded.status,
    updated_at = excluded.updated_at,
    completed_at = excluded.completed_at,
    input_summary = excluded.input_summary,
    output_summary = excluded.output_summary,
    error_summary = excluded.error_summary
`;

const INSERT_ARTIFACT_SQL = `
  INSERT INTO opy_agent_artifacts (
    id,
    task_id,
    session_id,
    tool_call_id,
    kind,
    summary,
    payload_json,
    created_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`;

const UPDATE_RUN_SQL = `
  UPDATE opy_agent_runs
  SET
    stage = ?,
    status = ?,
    completed_at = ?,
    error_summary = ?
  WHERE id = ?
    AND session_id = ?
`;

const FAIL_INTERRUPTED_RUNS_SQL = `
  UPDATE opy_agent_runs
  SET
    status = 'failed',
    completed_at = ?,
    error_summary = COALESCE(error_summary, ?)
  WHERE session_id = ?
    AND status = 'running'
`;

const INTERRUPT_RUNNING_TASKS_SQL = `
  UPDATE opy_agent_tasks
  SET
    status = 'interrupted',
    updated_at = ?,
    error_summary = COALESCE(error_summary, ?)
  WHERE session_id = ?
    AND status = 'running'
`;

const INTERRUPT_RUNNING_TOOL_CALLS_SQL = `
  UPDATE opy_agent_tool_calls
  SET
    status = 'interrupted',
    updated_at = ?,
    error_summary = COALESCE(error_summary, ?)
  WHERE session_id = ?
    AND status = 'running'
`;

const UPSERT_DIAGRAM_PROPOSAL_SQL = `
  INSERT INTO opy_diagram_proposals (
    session_id,
    proposal_responded_at,
    command_description,
    proposal_json,
    context_json,
    decision_status,
    decided_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(session_id, proposal_responded_at) DO UPDATE SET
    command_description = excluded.command_description,
    proposal_json = excluded.proposal_json,
    context_json = excluded.context_json,
    decision_status = excluded.decision_status,
    decided_at = excluded.decided_at
`;

const INSERT_AGENT_CHECKPOINT_SQL = `
  INSERT INTO opy_agent_checkpoints (
    id,
    session_id,
    diagram_id,
    proposal_responded_at,
    checkpoint_type,
    snapshot_json,
    created_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?)
`;

const isOpyChatRole = (value: unknown): value is OpyChatRole =>
  value === "assistant" || value === "user" || value === "system";

const isOpyAgentRunAgent = (value: unknown): value is OpyAgentRunAgent => value === "opy-net";

const isOpyAgentRunIntent = (value: unknown): value is OpyAgentRunIntent =>
  value === "chat" || value === "plan-c4-diagram" || value === "review-c4-board";

const isOpyAgentRunStage = (value: unknown): value is OpyAgentRunStage =>
  value === "invoke" || value === "persist" || value === "complete";

const isOpyAgentRunStatus = (value: unknown): value is OpyAgentRunStatus =>
  value === "running" || value === "completed" || value === "failed" || value === "cancelled";

const isOpyAgentTaskStatus = (value: unknown): value is OpyAgentTaskStatus =>
  value === "running"
  || value === "interrupted"
  || value === "completed"
  || value === "failed"
  || value === "cancelled";

const isOpyAgentTaskStage = (value: unknown): value is OpyAgentTaskStage =>
  value === "contextualizing"
  || value === "planning"
  || value === "proposing"
  || value === "awaiting_confirmation"
  || value === "applying"
  || value === "verifying"
  || value === "completed"
  || value === "failed";

const isOpyAgentToolCallName = (value: unknown): value is OpyAgentToolCallName =>
  value === "assemble_context"
  || value === "invoke_agent"
  || value === "invoke_analyst"
  || value === "invoke_planner"
  || value === "invoke_verifier"
  || value === "persist_assistant_message"
  || value === "resolve_action"
  || value === "execute_board_action"
  || value === "refresh_checkpoints";

const isOpyAgentToolCallStatus = (value: unknown): value is OpyAgentToolCallStatus =>
  value === "running"
  || value === "interrupted"
  || value === "completed"
  || value === "failed"
  || value === "cancelled";

const isOpyAgentArtifactKind = (value: unknown): value is OpyAgentArtifactKind =>
  value === "context_bundle"
  || value === "anomaly_assessment"
  || value === "chat_response"
  || value === "diagram_proposal"
  || value === "board_review"
  || value === "action_descriptor"
  || value === "action_result"
  || value === "resume_boundary_outcome"
  || value === "mutation_plan"
  || value === "checkpoint_restore_preview";

const isOpyPlanDecisionStatus = (value: unknown): value is OpyPlanDecisionStatus =>
  value === "pending" || value === "approved" || value === "rejected";

const isOpyAgentCheckpointType = (value: unknown): value is OpyAgentCheckpointType =>
  value === "pre-apply";

const toTimestamp = (value: unknown, fallback = Date.now()): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const toNullableTimestamp = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const toNullableText = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

type SessionRow = {
  id: string;
  title: string;
  domain: OpyChatDomain;
  diagramId: string | null;
  createdAt: number;
  updatedAt: number;
  lastMessageAt: number | null;
};

type MessageRow = {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  createdAt: number;
};

type AgentRunRow = {
  id: string;
  sessionId: string;
  agent: string;
  intent: string;
  stage: string;
  status: string;
  startedAt: number;
  completedAt: number | null;
  errorSummary: string | null;
};

type AgentTaskRow = {
  id: string;
  sessionId: string;
  requestJson: string;
  lineageKey: string | null;
  parentTaskId: string | null;
  stage: string;
  status: string;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  errorSummary: string | null;
};

type AgentToolCallRow = {
  id: string;
  taskId: string;
  sessionId: string;
  name: string;
  status: string;
  startedAt: number;
  updatedAt: number;
  completedAt: number | null;
  inputSummary: string | null;
  outputSummary: string | null;
  errorSummary: string | null;
};

type AgentArtifactRow = {
  id: string;
  taskId: string;
  sessionId: string;
  toolCallId: string | null;
  kind: string;
  summary: string;
  payloadJson: string;
  createdAt: number;
};

type DiagramProposalRow = {
  sessionId: string;
  commandDescription: string;
  proposalJson: string;
  contextJson: string;
  decisionStatus: string;
  decidedAt: number;
};

type AgentCheckpointRow = {
  id: string;
  sessionId: string;
  diagramId: string;
  proposalRespondedAtMs: number;
  checkpointType: string;
  snapshotJson: string;
  createdAt: number;
};

const parseJsonObject = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
};

const isOpyAgentLifecycleConfirmation = (value: unknown): value is OpyAgentLifecycleConfirmation => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.cancelMessage === "string"
    && Array.isArray(candidate.confirmationLines)
    && candidate.confirmationLines.every((line) => typeof line === "string")
    && typeof candidate.failurePrefix === "string"
    && typeof candidate.sessionId === "string";
};

const isOpyAgentLifecycleMode = (value: unknown): value is OpyAgentLifecycleMode =>
  value === "read" || value === "action";

const isOpyAgentLifecycleReplay = (value: unknown): value is OpyAgentLifecycleReplay => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.kind !== "string" || typeof candidate.sessionId !== "string") {
    return false;
  }

  switch (candidate.kind) {
    case "chat":
      return typeof candidate.prompt === "string";
    case "proposal":
      return typeof candidate.description === "string";
    case "review":
      return candidate.focus === null || typeof candidate.focus === "string";
    case "add-node":
      return typeof candidate.label === "string"
        && (candidate.nodeType === "person"
          || candidate.nodeType === "system"
          || candidate.nodeType === "externalSystem"
          || candidate.nodeType === "container"
          || candidate.nodeType === "component");
    case "apply-proposal":
      return typeof candidate.proposalRespondedAtMs === "number"
        && Number.isFinite(candidate.proposalRespondedAtMs);
    case "rollback":
      return typeof candidate.checkpointId === "string";
    default:
      return false;
  }
};

const isOpyAgentLifecycleRequest = (value: unknown): value is OpyAgentLifecycleRequest => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (candidate.confirmation === null || isOpyAgentLifecycleConfirmation(candidate.confirmation))
    && typeof candidate.id === "string"
    && isOpyAgentLifecycleMode(candidate.mode)
    && (
      candidate.kind === "chat"
      || candidate.kind === "review"
      || candidate.kind === "proposal"
      || candidate.kind === "add-node"
      || candidate.kind === "apply-proposal"
      || candidate.kind === "rollback"
    )
    && typeof candidate.label === "string"
    && typeof candidate.requiresConfirmation === "boolean"
    && isOpyAgentLifecycleReplay(candidate.replay);
};

const isRigAgentCitation = (value: unknown): value is RigAgentCitation => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === "string"
    && typeof candidate.tool === "string"
    && typeof candidate.label === "string"
    && typeof candidate.detail === "string"
    && (candidate.sourceId === null || typeof candidate.sourceId === "string");
};

const isRigAgentContextBundle = (value: unknown): value is RigAgentContextBundle => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.promptContext === "string"
    && Array.isArray(candidate.citations)
    && candidate.citations.every(isRigAgentCitation)
    && (candidate.confidence === "high" || candidate.confidence === "medium" || candidate.confidence === "low")
    && typeof candidate.confidenceReason === "string";
};

const isRigC4DiagramProposal = (value: unknown): value is RigC4DiagramProposal => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.summary === "string"
    && typeof candidate.rationale === "string"
    && Array.isArray(candidate.warnings)
    && candidate.warnings.every((warning) => typeof warning === "string")
    && Array.isArray(candidate.nodes)
    && candidate.nodes.every((node) => {
      if (typeof node !== "object" || node === null) {
        return false;
      }
      const nodeCandidate = node as Record<string, unknown>;
      return typeof nodeCandidate.key === "string"
        && typeof nodeCandidate.nodeType === "string"
        && typeof nodeCandidate.label === "string"
        && (nodeCandidate.description === null || typeof nodeCandidate.description === "string");
    })
    && Array.isArray(candidate.edges)
    && candidate.edges.every((edge) => {
      if (typeof edge !== "object" || edge === null) {
        return false;
      }
      const edgeCandidate = edge as Record<string, unknown>;
      return typeof edgeCandidate.sourceKey === "string"
        && typeof edgeCandidate.targetKey === "string"
        && typeof edgeCandidate.label === "string";
    })
    && typeof candidate.provider === "string"
    && typeof candidate.model === "string"
    && typeof candidate.respondedAtMs === "number"
    && Number.isFinite(candidate.respondedAtMs);
};

const isOpyAgentCheckpointSnapshot = (value: unknown): value is OpyAgentCheckpointSnapshot => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === "string"
    && typeof candidate.name === "string"
    && (candidate.description === undefined || candidate.description === null || typeof candidate.description === "string")
    && Array.isArray(candidate.nodes)
    && Array.isArray(candidate.edges)
    && (candidate.savedAt === null || (typeof candidate.savedAt === "number" && Number.isFinite(candidate.savedAt)));
};

const decodeSessionRow = (row: SessionRow): OpyChatSession => ({
  id: row.id,
  title: row.title,
  domain: row.domain,
  diagramId: row.diagramId ?? null,
  createdAt: toTimestamp(row.createdAt),
  updatedAt: toTimestamp(row.updatedAt),
  lastMessageAt: toNullableTimestamp(row.lastMessageAt),
});

const decodeMessageRow = (row: MessageRow): OpyChatMessage | null => {
  if (!isOpyChatRole(row.role)) {
    return null;
  }

  return {
    id: row.id,
    sessionId: row.sessionId,
    role: row.role,
    content: row.content,
    createdAt: toTimestamp(row.createdAt),
  };
};

const decodeAgentRunRow = (row: AgentRunRow): OpyAgentRun | null => {
  if (
    !isOpyAgentRunAgent(row.agent)
    || !isOpyAgentRunIntent(row.intent)
    || !isOpyAgentRunStage(row.stage)
    || !isOpyAgentRunStatus(row.status)
  ) {
    return null;
  }

  return {
    id: row.id,
    sessionId: row.sessionId,
    agent: row.agent,
    intent: row.intent,
    stage: row.stage,
    status: row.status,
    startedAt: toTimestamp(row.startedAt),
    completedAt: toNullableTimestamp(row.completedAt),
    errorSummary: toNullableText(row.errorSummary),
  };
};

const decodeAgentTaskRow = (row: AgentTaskRow): OpyAgentTask | null => {
  if (!isOpyAgentTaskStage(row.stage) || !isOpyAgentTaskStatus(row.status)) {
    return null;
  }

  const request = parseJsonObject(row.requestJson);
  if (!isOpyAgentLifecycleRequest(request)) {
    return null;
  }

  return {
    id: row.id,
    sessionId: row.sessionId,
    request,
    lineageKey: toNullableText(row.lineageKey) ?? deriveOpyAgentTaskLineageKey(request),
    parentTaskId: toNullableText(row.parentTaskId),
    stage: row.stage,
    status: row.status,
    createdAt: toTimestamp(row.createdAt),
    updatedAt: toTimestamp(row.updatedAt),
    completedAt: toNullableTimestamp(row.completedAt),
    errorSummary: toNullableText(row.errorSummary),
  };
};

const decodeAgentToolCallRow = (row: AgentToolCallRow): OpyAgentToolCall | null => {
  if (!isOpyAgentToolCallName(row.name) || !isOpyAgentToolCallStatus(row.status)) {
    return null;
  }

  return {
    id: row.id,
    taskId: row.taskId,
    sessionId: row.sessionId,
    name: row.name,
    status: row.status,
    startedAt: toTimestamp(row.startedAt),
    updatedAt: toTimestamp(row.updatedAt),
    completedAt: toNullableTimestamp(row.completedAt),
    inputSummary: toNullableText(row.inputSummary),
    outputSummary: toNullableText(row.outputSummary),
    errorSummary: toNullableText(row.errorSummary),
  };
};

const decodeAgentArtifactRow = (row: AgentArtifactRow): OpyAgentArtifact | null => {
  if (!isOpyAgentArtifactKind(row.kind) || typeof row.summary !== "string") {
    return null;
  }

  let payload: unknown = null;
  try {
    payload = JSON.parse(row.payloadJson);
  } catch {
    return null;
  }

  return {
    id: row.id,
    taskId: row.taskId,
    sessionId: row.sessionId,
    toolCallId: row.toolCallId ?? null,
    kind: row.kind,
    summary: row.summary,
    payload,
    createdAt: toTimestamp(row.createdAt),
  };
};

const decodeDiagramProposalRow = (row: DiagramProposalRow): OpyPersistedDiagramProposal | null => {
  if (!isOpyPlanDecisionStatus(row.decisionStatus) || typeof row.commandDescription !== "string") {
    return null;
  }

  const proposal = parseJsonObject(row.proposalJson);
  const context = parseJsonObject(row.contextJson);
  if (!isRigC4DiagramProposal(proposal) || !isRigAgentContextBundle(context)) {
    return null;
  }

  return {
    sessionId: row.sessionId,
    commandDescription: row.commandDescription,
    proposal,
    context,
    decisionStatus: row.decisionStatus,
    decidedAt: toTimestamp(row.decidedAt, proposal.respondedAtMs),
  };
};

const decodeAgentCheckpointRow = (row: AgentCheckpointRow): OpyAgentCheckpoint | null => {
  if (!isOpyAgentCheckpointType(row.checkpointType)) {
    return null;
  }

  const snapshot = parseJsonObject(row.snapshotJson);
  if (!isOpyAgentCheckpointSnapshot(snapshot)) {
    return null;
  }

  return {
    id: row.id,
    sessionId: row.sessionId,
    diagramId: row.diagramId,
    proposalRespondedAtMs: toTimestamp(row.proposalRespondedAtMs),
    checkpointType: row.checkpointType,
    snapshot,
    createdAt: toTimestamp(row.createdAt),
  };
};

const sortSessionsByRecency = (sessions: readonly OpyChatSession[]): OpyChatSession[] =>
  [...sessions].sort((left, right) => right.updatedAt - left.updatedAt);

const sortRunsByRecency = (runs: readonly OpyAgentRun[]): OpyAgentRun[] =>
  [...runs].sort((left, right) => right.startedAt - left.startedAt);

const sortTasksByRecency = (tasks: readonly OpyAgentTask[]): OpyAgentTask[] =>
  [...tasks].sort((left, right) => right.updatedAt - left.updatedAt || right.createdAt - left.createdAt);

const sortToolCallsByTimeline = (toolCalls: readonly OpyAgentToolCall[]): OpyAgentToolCall[] =>
  [...toolCalls].sort((left, right) => left.startedAt - right.startedAt || left.updatedAt - right.updatedAt);

const sortArtifactsByTimeline = (artifacts: readonly OpyAgentArtifact[]): OpyAgentArtifact[] =>
  [...artifacts].sort((left, right) => left.createdAt - right.createdAt);

export const listOpyChatSessions = (input: ListOpyChatSessionsInput) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    const rows = yield* service.query<SessionRow>(LIST_SESSIONS_SQL, [
      input.domain,
      input.diagramId,
      input.diagramId,
    ]);

    return sortSessionsByRecency(rows.map(decodeSessionRow));
  });

export const listAllOpyChatSessions = () =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    const rows = yield* service.query<SessionRow>(LIST_ALL_SESSIONS_SQL);
    return sortSessionsByRecency(rows.map(decodeSessionRow));
  });

export const createOpyChatSession = (input: CreateOpyChatSessionInput) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    const createdAt = input.createdAt ?? Date.now();
    const initialMessageAt = input.initialMessage?.createdAt ?? createdAt;

    yield* service.transaction(
      Effect.gen(function*() {
        yield* service.execute(CREATE_SESSION_SQL, [
          input.id,
          input.title,
          input.domain,
          input.diagramId,
          createdAt,
          initialMessageAt,
          input.initialMessage ? initialMessageAt : null,
        ]);

        if (input.initialMessage) {
          yield* service.execute(INSERT_MESSAGE_SQL, [
            input.initialMessage.id,
            input.id,
            input.initialMessage.role,
            input.initialMessage.content,
            initialMessageAt,
          ]);
        }
      }),
    );

    return {
      id: input.id,
      title: input.title,
      domain: input.domain,
      diagramId: input.diagramId,
      createdAt,
      updatedAt: initialMessageAt,
      lastMessageAt: input.initialMessage ? initialMessageAt : null,
    } satisfies OpyChatSession;
  });

export const listOpyChatMessages = (sessionId: string) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    const rows = yield* service.query<MessageRow>(LIST_MESSAGES_SQL, [sessionId]);
    return rows.map(decodeMessageRow).filter((row): row is OpyChatMessage => row !== null);
  });

export const listOpyAgentRuns = (sessionId: string) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    const rows = yield* service.query<AgentRunRow>(LIST_RUNS_SQL, [sessionId]);
    return sortRunsByRecency(
      rows.map(decodeAgentRunRow).filter((row): row is OpyAgentRun => row !== null),
    );
  });

export const listOpyAgentTasks = (sessionId: string) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    const rows = yield* service.query<AgentTaskRow>(LIST_AGENT_TASKS_SQL, [sessionId]);
    return sortTasksByRecency(
      rows.map(decodeAgentTaskRow).filter((row): row is OpyAgentTask => row !== null),
    );
  });

export const listAllOpyAgentTasks = () =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    const rows = yield* service.query<AgentTaskRow>(LIST_ALL_AGENT_TASKS_SQL);
    return sortTasksByRecency(
      rows.map(decodeAgentTaskRow).filter((row): row is OpyAgentTask => row !== null),
    );
  });

export const listOpyAgentToolCalls = (taskId: string) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    const rows = yield* service.query<AgentToolCallRow>(LIST_AGENT_TOOL_CALLS_SQL, [taskId]);
    return sortToolCallsByTimeline(
      rows.map(decodeAgentToolCallRow).filter((row): row is OpyAgentToolCall => row !== null),
    );
  });

export const listOpyAgentArtifacts = (taskId: string) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    const rows = yield* service.query<AgentArtifactRow>(LIST_AGENT_ARTIFACTS_SQL, [taskId]);
    return sortArtifactsByTimeline(
      rows.map(decodeAgentArtifactRow).filter((row): row is OpyAgentArtifact => row !== null),
    );
  });

export const listOpyDiagramProposals = (sessionId: string) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    const rows = yield* service.query<DiagramProposalRow>(LIST_DIAGRAM_PROPOSALS_SQL, [sessionId]);
    return rows
      .map(decodeDiagramProposalRow)
      .filter((row): row is OpyPersistedDiagramProposal => row !== null)
      .sort((left, right) => right.proposal.respondedAtMs - left.proposal.respondedAtMs);
  });

export const listAllOpyDiagramProposals = () =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    const rows = yield* service.query<DiagramProposalRow>(LIST_ALL_DIAGRAM_PROPOSALS_SQL);
    return rows
      .map(decodeDiagramProposalRow)
      .filter((row): row is OpyPersistedDiagramProposal => row !== null)
      .sort((left, right) => right.proposal.respondedAtMs - left.proposal.respondedAtMs);
  });

export const listOpyAgentCheckpoints = (sessionId: string) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    const rows = yield* service.query<AgentCheckpointRow>(LIST_AGENT_CHECKPOINTS_SQL, [sessionId]);
    return rows
      .map(decodeAgentCheckpointRow)
      .filter((row): row is OpyAgentCheckpoint => row !== null)
      .sort((left, right) => right.createdAt - left.createdAt);
  });

export const getOpyAgentCheckpoint = (checkpointId: string) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    const rows = yield* service.query<AgentCheckpointRow>(GET_AGENT_CHECKPOINT_SQL, [checkpointId]);
    const checkpoint = rows
      .map(decodeAgentCheckpointRow)
      .find((row): row is OpyAgentCheckpoint => row !== null);

    if (!checkpoint) {
      return yield* Effect.fail(new NotFoundError({
        entity: "opy_agent_checkpoint",
        id: checkpointId,
      }));
    }

    return checkpoint;
  });

export const createOpyAgentRun = (run: OpyAgentRun) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    yield* service.execute(INSERT_RUN_SQL, [
      run.id,
      run.sessionId,
      run.agent,
      run.intent,
      run.stage,
      run.status,
      run.startedAt,
      run.completedAt,
      run.errorSummary,
    ]);

    return run;
  });

export const upsertOpyAgentTask = (task: OpyAgentTask) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    yield* service.execute(UPSERT_TASK_SQL, [
      task.id,
      task.sessionId,
      JSON.stringify(task.request),
      task.lineageKey ?? deriveOpyAgentTaskLineageKey(task.request),
      task.parentTaskId,
      task.stage,
      task.status,
      task.createdAt,
      task.updatedAt,
      task.completedAt,
      task.errorSummary,
    ]);

    return task;
  });

export const upsertOpyAgentToolCall = (toolCall: OpyAgentToolCall) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    yield* service.execute(UPSERT_TOOL_CALL_SQL, [
      toolCall.id,
      toolCall.taskId,
      toolCall.sessionId,
      toolCall.name,
      toolCall.status,
      toolCall.startedAt,
      toolCall.updatedAt,
      toolCall.completedAt,
      toolCall.inputSummary,
      toolCall.outputSummary,
      toolCall.errorSummary,
    ]);

    return toolCall;
  });

export const createOpyAgentArtifact = (artifact: OpyAgentArtifact) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    yield* service.execute(INSERT_ARTIFACT_SQL, [
      artifact.id,
      artifact.taskId,
      artifact.sessionId,
      artifact.toolCallId,
      artifact.kind,
      artifact.summary,
      JSON.stringify(artifact.payload),
      artifact.createdAt,
    ]);

    return artifact;
  });

export const upsertOpyDiagramProposal = (proposal: OpyPersistedDiagramProposal) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    yield* service.execute(UPSERT_DIAGRAM_PROPOSAL_SQL, [
      proposal.sessionId,
      proposal.proposal.respondedAtMs,
      proposal.commandDescription.trim(),
      JSON.stringify(proposal.proposal),
      JSON.stringify(proposal.context),
      proposal.decisionStatus,
      proposal.decidedAt,
    ]);

    return proposal;
  });

export const createOpyAgentCheckpoint = (checkpoint: OpyAgentCheckpoint) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    yield* service.execute(INSERT_AGENT_CHECKPOINT_SQL, [
      checkpoint.id,
      checkpoint.sessionId,
      checkpoint.diagramId,
      checkpoint.proposalRespondedAtMs,
      checkpoint.checkpointType,
      JSON.stringify(checkpoint.snapshot),
      checkpoint.createdAt,
    ]);

    return checkpoint;
  });

export const updateOpyAgentRun = (run: OpyAgentRun) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    yield* service.execute(UPDATE_RUN_SQL, [
      run.stage,
      run.status,
      run.completedAt,
      run.errorSummary,
      run.id,
      run.sessionId,
    ]);

    return run;
  });

export const finalizeInterruptedOpyAgentRuns = (
  input: FinalizeInterruptedOpyAgentRunsInput,
) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    const completedAt = input.completedAt ?? Date.now();
    const errorSummary = input.errorSummary?.trim().length
      ? input.errorSummary.trim()
      : "INTERRUPTED BEFORE TERMINAL STATUS.";

    const rows = yield* service.query<AgentRunRow>(LIST_ACTIVE_RUNS_SQL, [input.sessionId]);
    const activeRuns = rows
      .map(decodeAgentRunRow)
      .filter((row): row is OpyAgentRun => row !== null);

    if (activeRuns.length === 0) {
      return [] as OpyAgentRun[];
    }

    yield* service.execute(FAIL_INTERRUPTED_RUNS_SQL, [
      completedAt,
      errorSummary,
      input.sessionId,
    ]);

    return activeRuns.map((run) => ({
      ...run,
      status: "failed" as const,
      completedAt,
      errorSummary,
    }));
  });

export const interruptOpyAgentTasks = (input: InterruptOpyAgentTasksInput) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    const updatedAt = input.updatedAt ?? Date.now();
    const errorSummary = input.errorSummary?.trim().length
      ? input.errorSummary.trim()
      : "INTERRUPTED DURING PREVIOUS SESSION.";

    const rows = yield* service.query<AgentTaskRow>(LIST_RUNNING_TASKS_SQL, [input.sessionId]);
    const activeTasks = rows
      .map(decodeAgentTaskRow)
      .filter((row): row is OpyAgentTask => row !== null);

    if (activeTasks.length === 0) {
      return [] as OpyAgentTask[];
    }

    yield* service.execute(INTERRUPT_RUNNING_TASKS_SQL, [
      updatedAt,
      errorSummary,
      input.sessionId,
    ]);

    return activeTasks.map((task) => ({
      ...task,
      status: "interrupted" as const,
      updatedAt,
      errorSummary,
    }));
  });

export const interruptOpyAgentToolCalls = (input: InterruptOpyAgentToolCallsInput) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    const updatedAt = input.updatedAt ?? Date.now();
    const errorSummary = input.errorSummary?.trim().length
      ? input.errorSummary.trim()
      : "INTERRUPTED DURING PREVIOUS SESSION.";

    const rows = yield* service.query<AgentToolCallRow>(LIST_RUNNING_TOOL_CALLS_SQL, [input.sessionId]);
    const activeToolCalls = rows
      .map(decodeAgentToolCallRow)
      .filter((row): row is OpyAgentToolCall => row !== null);

    if (activeToolCalls.length === 0) {
      return [] as OpyAgentToolCall[];
    }

    yield* service.execute(INTERRUPT_RUNNING_TOOL_CALLS_SQL, [
      updatedAt,
      errorSummary,
      input.sessionId,
    ]);

    return activeToolCalls.map((toolCall) => ({
      ...toolCall,
      status: "interrupted" as const,
      updatedAt,
      errorSummary,
    }));
  });

export const restoreInterruptedOpyAgentSessionState = (
  input: RestoreInterruptedOpyAgentSessionStateInput,
) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    const completedAt = input.completedAt ?? Date.now();
    const updatedAt = input.updatedAt ?? completedAt;

    return yield* service.transaction(
      Effect.gen(function*() {
        const finalizedRuns = yield* finalizeInterruptedOpyAgentRuns({
          sessionId: input.sessionId,
          completedAt,
          ...(input.runErrorSummary === undefined ? {} : { errorSummary: input.runErrorSummary }),
        });
        const interruptedTasks = yield* interruptOpyAgentTasks({
          sessionId: input.sessionId,
          updatedAt,
          ...(input.taskErrorSummary === undefined ? {} : { errorSummary: input.taskErrorSummary }),
        });
        const interruptedToolCalls = yield* interruptOpyAgentToolCalls({
          sessionId: input.sessionId,
          updatedAt,
          ...(input.toolCallErrorSummary === undefined ? {} : { errorSummary: input.toolCallErrorSummary }),
        });

        const runs = yield* listOpyAgentRuns(input.sessionId);
        const tasks = yield* listOpyAgentTasks(input.sessionId);

        return {
          finalizedRuns,
          interruptedTasks,
          interruptedToolCalls,
          runs,
          tasks,
        } satisfies OpyInterruptedAgentSessionState;
      }),
    );
  });

export const appendOpyChatMessage = (message: OpyChatMessage) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    yield* service.transaction(
      Effect.gen(function*() {
        yield* service.execute(INSERT_MESSAGE_SQL, [
          message.id,
          message.sessionId,
          message.role,
          message.content,
          message.createdAt,
        ]);

        yield* service.execute(UPDATE_SESSION_ACTIVITY_SQL, [
          message.createdAt,
          message.createdAt,
          message.sessionId,
        ]);
      }),
    );

    return message;
  });

export const renameOpyChatSession = (input: RenameOpyChatSessionInput) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    const updatedAt = Date.now();
    const normalizedTitle = input.title.trim();

    yield* service.execute(RENAME_SESSION_SQL, [
      normalizedTitle,
      updatedAt,
      input.sessionId,
    ]);

    return {
      sessionId: input.sessionId,
      title: normalizedTitle,
      updatedAt,
    } satisfies RenameOpyChatSessionResult;
  });
