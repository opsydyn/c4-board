import { CopilotChatConfigurationProvider, CopilotChatInput } from "@copilotkit/react-core/v2";
import { Effect } from "effect";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  assembleRigAgentContext,
  formatRigAgentCitationBlock,
  type RigAgentContextBundle,
} from "../../core/effects/agent-context";
import { buildRigMutationPlanDiff } from "../../core/effects/agent-plan-diff";
import { summarizeRigToolPolicy } from "../../core/effects/agent-policy";
import {
  buildOpyCheckpointRestorePreview,
  formatOpyRollbackSummary,
  type OpyCheckpointRestoreImpactStatus,
  selectLatestOpyAgentCheckpoint,
} from "../../core/effects/agent-rollback.runtime";
import type {
  RigApplyLayoutValidationSummary,
  RigCreateEdgesValidationSummary,
  RigCreateNodesValidationSummary,
  RigUpdateNodesValidationSummary,
  RigValidatedMutationAction,
} from "../../core/effects/agent-tools/mutation-tools";
import {
  formatAgentError,
  getRigSecretStatus,
  makeAgentConfigError,
  makeAgentPolicyError,
  makeAgentRuntimeError,
  planRigC4Diagram,
  reviewRigC4Board,
  type RigC4BoardEdge,
  type RigC4BoardNode,
  type RigC4BoardReview,
  type RigC4BoardSummary,
  type RigC4DiagramProposal,
  type RigHelloResponse,
  runRigHello,
  summarizeAgentError,
  withAgentErrorContext,
} from "../../core/effects/ai-agent.runtime";
import {
  createOpyAddNodeActionFlowDescriptor,
  type OpyActionFlowDescriptor,
  type OpyActionFlowIssue,
  type OpyBoardAction,
  type OpyC4NodeType,
  resolveOpyApplyProposalActionFlow,
  resolveOpyExecutableAddNodeActionFlow,
  resolveOpyRollbackActionFlow,
} from "../../core/effects/opy-action.runtime";
import {
  buildOpyAgentTaskLineage,
  deriveOpyAgentTaskContinuityKey,
  deriveOpyAgentTaskLineageKey,
  findOpyAgentTaskLineagePredecessor,
  selectLatestOpyAgentTasksByLineage,
  summarizeOpyAgentTaskLineage,
} from "../../core/effects/opy-agent.task-lineage";
import { emitOpyAgentRunTelemetry } from "../../core/effects/opy-agent.telemetry";
import type {
  OpyAgentArtifact,
  OpyAgentArtifactKind,
  OpyAgentToolCall,
  OpyAgentToolCallName,
} from "../../core/effects/opy-agent.trace";
import type { OpyBoardContextRegistry } from "../../core/effects/opy-board-context";
import {
  buildGroundedProposalDiff,
  type OpyProposalDiffStatus,
  summarizeGroundedProposalDiff,
} from "../../core/effects/opy-c4-proposals";
import {
  appendOpyChatMessage,
  createOpyAgentArtifact,
  createOpyAgentRun,
  createOpyChatSession,
  finalizeInterruptedOpyAgentRuns,
  interruptOpyAgentTasks,
  interruptOpyAgentToolCalls,
  listOpyAgentArtifacts,
  listOpyAgentCheckpoints,
  listOpyAgentRuns,
  listOpyAgentTasks,
  listOpyAgentToolCalls,
  listOpyChatMessages,
  listOpyChatSessions,
  listOpyDiagramProposals,
  type OpyAgentCheckpoint,
  type OpyAgentRun,
  type OpyAgentRunIntent,
  type OpyAgentTask,
  type OpyAgentTaskStage,
  type OpyChatMessage,
  type OpyChatRole,
  type OpyChatSession,
  type OpyPersistedDiagramProposal,
  type OpyPlanDecisionStatus,
  renameOpyChatSession,
  updateOpyAgentRun,
  upsertOpyAgentTask,
  upsertOpyAgentToolCall,
  upsertOpyDiagramProposal,
} from "../../core/effects/opy-chat.persistence";
import type {
  AiActionMode,
  OpyTaskHistoryBoundaryFilter,
  OpyTaskHistoryFilterState,
  OpyTaskHistoryFiltersBySession,
  OpyViewportSectionKey,
  OpyViewportSections,
} from "../../core/effects/settings.types";
import { useDatabase } from "../../core/effects/useDatabase";
import { useOpyAgentMachine } from "../hooks/useOpyAgentMachine";
import type {
  OpyAgentLifecycleNonTerminalStage,
  OpyAgentLifecycleRequest,
  OpyAgentLifecycleStage,
} from "../machines/opy-agent.machine";
import {
  compareOpyWidgetChromeTone,
  type OpyWidgetChromeFocusRequest,
  type OpyWidgetChromeSignal,
  type OpyWidgetChromeStatus,
  type OpyWidgetChromeTone,
  pickHigherOpyWidgetChromeTone,
} from "./opyChromeStatus";
import * as styles from "./styles.css";
import { TacticalSelect, type TacticalSelectOption } from "./TacticalSelect";

interface OpyDiagramProposalCommand {
  readonly kind: "plan-c4-diagram";
  readonly description: string;
}

interface OpyBoardReviewCommand {
  readonly kind: "review-c4-board";
  readonly focus: string | null;
}

interface OpySessionDiagramProposal {
  readonly command: OpyDiagramProposalCommand;
  readonly proposal: RigC4DiagramProposal;
  readonly context: RigAgentContextBundle;
  readonly decisionStatus: OpyPlanDecisionStatus;
  readonly decidedAtMs: number;
}

interface OpySessionBoardReview {
  readonly command: OpyBoardReviewCommand;
  readonly review: RigC4BoardReview;
  readonly context: RigAgentContextBundle;
}

interface OpyGroundedChatResponse {
  readonly response: RigHelloResponse;
  readonly context: RigAgentContextBundle;
}

interface OpyGroundedDiagramProposal {
  readonly proposal: RigC4DiagramProposal;
  readonly context: RigAgentContextBundle;
}

interface OpyGroundedBoardReview {
  readonly review: RigC4BoardReview;
  readonly context: RigAgentContextBundle;
}

interface OpyTranscriptDiagnostics {
  readonly body: string;
  readonly confidence: string | null;
  readonly citations: ReadonlyArray<string>;
}

interface OpyDiagnosticsSurface {
  readonly kind: "chat" | "diagram" | "review";
  readonly title: string;
  readonly summary: string;
  readonly detail: string;
  readonly provider: string;
  readonly model: string;
  readonly respondedAtMs: number;
  readonly context: RigAgentContextBundle;
  readonly run: OpyAgentRun | null;
}

interface OpyActionModeSurface {
  readonly tone: "critical" | "warning" | "ready";
  readonly label: string;
  readonly detail: string;
}

type OpyTaskHistoryChainFilter = "all" | string;

interface OpyTaskHistoryEntry {
  readonly task: OpyAgentTask;
  readonly resumeTrail: {
    readonly artifacts: ReadonlyArray<OpyAgentArtifact>;
    readonly toolCalls: ReadonlyArray<OpyAgentToolCall>;
  };
  readonly toolCalls: ReadonlyArray<OpyAgentToolCall>;
  readonly artifacts: ReadonlyArray<OpyAgentArtifact>;
  readonly lineageDiagnostics: ReturnType<typeof summarizeOpyAgentTaskLineage>;
  readonly resumePlan: ReadonlyArray<OpyResumeBoundaryPlanItem>;
  readonly persistedResumeOutcome: OpyPersistedResumeBoundaryOutcomePayload | null;
}

const EMPTY_VIEWPORT_SECTION_STATE: OpyViewportSections = {
  control: false,
  diagnostics: false,
  checkpoints: false,
  review: false,
  proposal: false,
};

const TASK_HISTORY_CHAIN_FILTER_ALL = "all";
const TASK_HISTORY_BOUNDARY_FILTER_ALL = "all";
const DEFAULT_TASK_HISTORY_FILTER_STATE: OpyTaskHistoryFilterState = {
  chain: TASK_HISTORY_CHAIN_FILTER_ALL,
  boundary: TASK_HISTORY_BOUNDARY_FILTER_ALL,
};

const TASK_HISTORY_BOUNDARY_OPTIONS: ReadonlyArray<TacticalSelectOption> = [
  {
    value: TASK_HISTORY_BOUNDARY_FILTER_ALL,
    label: "ALL BOUNDARIES",
  },
  {
    value: "reused-current-session",
    label: "LOCAL REUSE",
  },
  {
    value: "reused-inherited-session",
    label: "INHERITED REUSE",
  },
  {
    value: "reran",
    label: "RERAN",
  },
  {
    value: "pending",
    label: "PENDING",
  },
];

const collapseWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

const summarizeInlineText = (value: string, fallback: string): string => {
  const normalized = collapseWhitespace(value);
  return normalized.length > 0 ? normalized : fallback;
};

const createChatResponseArtifactDraft = (
  groundedChat: OpyGroundedChatResponse,
): OpyTaskArtifactDraft => ({
  kind: "chat_response",
  summary: summarizeInlineText(groundedChat.response.message, "CHAT RESPONSE READY."),
  payload: groundedChat,
});

const createDiagramProposalArtifactDraft = (
  groundedProposal: OpyGroundedDiagramProposal,
): OpyTaskArtifactDraft => ({
  kind: "diagram_proposal",
  summary: summarizeInlineText(groundedProposal.proposal.summary, "DIAGRAM PROPOSAL READY."),
  payload: groundedProposal,
});

const createBoardReviewArtifactDraft = (
  groundedReview: OpyGroundedBoardReview,
): OpyTaskArtifactDraft => ({
  kind: "board_review",
  summary: summarizeInlineText(groundedReview.review.summary, "BOARD REVIEW READY."),
  payload: groundedReview,
});

const createMutationPlanArtifactDraft = (input: {
  readonly groundedProposal: ReturnType<typeof buildGroundedProposalDiff>;
  readonly proposalSummary: ReturnType<typeof summarizeGroundedProposalDiff>;
  readonly mutationPlan: ReturnType<typeof buildRigMutationPlanDiff>;
}): OpyTaskArtifactDraft => ({
  kind: "mutation_plan",
  summary: summarizeInlineText(
    input.mutationPlan?.plan
      ? `PLAN::${input.mutationPlan.plan.totalActions} ACTION(S) · RISK::${input.mutationPlan.plan.highestRisk.toUpperCase()}`
      : "MUTATION PLAN READY.",
    "MUTATION PLAN READY.",
  ),
  payload: input,
});

const createCheckpointRestorePreviewArtifactDraft = (
  preview: ReturnType<typeof buildOpyCheckpointRestorePreview>,
): OpyTaskArtifactDraft | null => {
  if (!preview) {
    return null;
  }

  return {
    kind: "checkpoint_restore_preview",
    summary: summarizeInlineText(
      preview.hasChanges
        ? `RESTORE::${preview.impactedEntities.length} CHANGE(S)`
        : "CHECKPOINT ALREADY MATCHES CURRENT BOARD.",
      "CHECKPOINT RESTORE PREVIEW READY.",
    ),
    payload: preview,
  };
};

type OpyPersistMessageResult =
  | { readonly ok: true; readonly message: OpyChatMessage }
  | { readonly ok: false; readonly errorMessage: string; readonly message: OpyChatMessage };

type OpyExecutableActionReplayResolution =
  | {
    readonly ok: true;
    readonly value: OpyActionFlowDescriptor;
    readonly artifacts?: ReadonlyArray<OpyTaskArtifactDraft>;
  }
  | { readonly ok: false; readonly issue: OpyActionFlowIssue };

interface OpyTaskArtifactDraft {
  readonly kind: OpyAgentArtifactKind;
  readonly summary: string;
  readonly payload: unknown;
}

interface OpyPersistedActionDescriptorArtifactPayload {
  readonly descriptor: OpyActionFlowDescriptor;
  readonly replay: OpyAgentLifecycleRequest["replay"];
}

interface OpyPersistedActionResultArtifactPayload {
  readonly message: string;
}

type OpyResumeBoundaryOutcome =
  | "reused-current-session"
  | "reused-inherited-session"
  | "reran"
  | "pending";

interface OpyPersistedResumeBoundaryOutcomeItem {
  readonly name: OpyAgentToolCallName;
  readonly outcome: OpyResumeBoundaryOutcome;
}

interface OpyPersistedResumeBoundaryOutcomePayload {
  readonly boundaries: ReadonlyArray<OpyPersistedResumeBoundaryOutcomeItem>;
  readonly requestKind: OpyAgentLifecycleRequest["kind"];
  readonly updatedAt: number;
}

interface OpyCopilotPanelProps {
  readonly domain: "c4" | "ddd";
  readonly diagramId: string | null;
  readonly diagramName: string;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly boardSummary: RigC4BoardSummary | null;
  readonly boardContext: OpyBoardContextRegistry | null;
  readonly actionMode: AiActionMode;
  readonly viewportSections: OpyViewportSections;
  readonly onViewportSectionsChange: (sections: OpyViewportSections) => void;
  readonly taskHistoryFiltersBySession: OpyTaskHistoryFiltersBySession;
  readonly onTaskHistoryFiltersBySessionChange: (filtersBySession: OpyTaskHistoryFiltersBySession) => void;
  readonly onApplyBoardAction: (action: OpyBoardAction) => Promise<string>;
  readonly onOpenAiSettings: () => void;
  readonly onChromeStatusChange: (status: OpyWidgetChromeStatus) => void;
  readonly chromeSectionRequest: OpyWidgetChromeFocusRequest | null;
}

const createMessageId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `opy-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const createRunId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `opy-run-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const toErrorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isGroundedChatResponsePayload = (value: unknown): value is OpyGroundedChatResponse =>
  isRecord(value) && isRecord(value.response) && isRecord(value.context);

const isGroundedDiagramProposalPayload = (value: unknown): value is OpyGroundedDiagramProposal =>
  isRecord(value) && isRecord(value.proposal) && isRecord(value.context);

const isGroundedBoardReviewPayload = (value: unknown): value is OpyGroundedBoardReview =>
  isRecord(value) && isRecord(value.review) && isRecord(value.context);

const isPersistedActionDescriptorArtifactPayload = (
  value: unknown,
): value is OpyPersistedActionDescriptorArtifactPayload =>
  isRecord(value)
  && isRecord(value.descriptor)
  && isRecord(value.replay);

const isPersistedActionResultArtifactPayload = (
  value: unknown,
): value is OpyPersistedActionResultArtifactPayload =>
  isRecord(value) && typeof value.message === "string";

const isPersistedResumeBoundaryOutcomePayload = (
  value: unknown,
): value is OpyPersistedResumeBoundaryOutcomePayload =>
  isRecord(value)
  && Array.isArray(value.boundaries)
  && typeof value.updatedAt === "number"
  && typeof value.requestKind === "string"
  && value.boundaries.every((item) =>
    isRecord(item)
    && typeof item.name === "string"
    && typeof item.outcome === "string"
  );

const isRigAgentContextBundlePayload = (value: unknown): value is RigAgentContextBundle =>
  isRecord(value)
  && typeof value.promptContext === "string"
  && Array.isArray(value.citations)
  && typeof value.confidence === "string"
  && typeof value.confidenceReason === "string";

const selectLatestTaskArtifact = (
  artifacts: readonly OpyAgentArtifact[],
  kind: OpyAgentArtifactKind,
): OpyAgentArtifact | null =>
  [...artifacts]
    .filter((artifact) => artifact.kind === kind)
    .sort((left, right) => right.createdAt - left.createdAt)[0] ?? null;

const toArtifactDraft = (artifact: OpyAgentArtifact): OpyTaskArtifactDraft => ({
  kind: artifact.kind,
  summary: artifact.summary,
  payload: artifact.payload,
});

const mergeArtifactDrafts = (
  left: readonly OpyTaskArtifactDraft[],
  right: readonly OpyTaskArtifactDraft[],
): ReadonlyArray<OpyTaskArtifactDraft> => [
  ...left,
  ...right.filter((candidate) =>
    !left.some((artifact) =>
      artifact.kind === candidate.kind
      && artifact.summary === candidate.summary
    )
  ),
];

const selectResumableActionArtifacts = (
  artifacts: readonly OpyAgentArtifact[],
): ReadonlyArray<OpyTaskArtifactDraft> =>
  artifacts
    .filter((artifact) =>
      artifact.kind === "action_result"
      || artifact.kind === "mutation_plan"
      || artifact.kind === "checkpoint_restore_preview"
    )
    .map(toArtifactDraft);

const createActionResultArtifactDraft = (message: string): OpyTaskArtifactDraft => ({
  kind: "action_result",
  summary: message.trim().replace(/\s+/g, " ").length > 0
    ? message.trim().replace(/\s+/g, " ")
    : "BOARD ACTION COMPLETE.",
  payload: {
    message,
  } satisfies OpyPersistedActionResultArtifactPayload,
});

const selectPersistedResumeBoundaryOutcome = (
  artifacts: readonly OpyAgentArtifact[],
): OpyPersistedResumeBoundaryOutcomePayload | null => {
  const artifact = selectLatestTaskArtifact(artifacts, "resume_boundary_outcome");
  return artifact && isPersistedResumeBoundaryOutcomePayload(artifact.payload)
    ? artifact.payload
    : null;
};

const selectPersistedReadResultArtifact = (
  request: OpyAgentLifecycleRequest,
  artifacts: readonly OpyAgentArtifact[],
): OpyGroundedChatResponse | OpyGroundedDiagramProposal | OpyGroundedBoardReview | null => {
  switch (request.kind) {
    case "chat": {
      const artifact = selectLatestTaskArtifact(artifacts, "chat_response");
      return artifact && isGroundedChatResponsePayload(artifact.payload) ? artifact.payload : null;
    }
    case "proposal": {
      const artifact = selectLatestTaskArtifact(artifacts, "diagram_proposal");
      return artifact && isGroundedDiagramProposalPayload(artifact.payload) ? artifact.payload : null;
    }
    case "review": {
      const artifact = selectLatestTaskArtifact(artifacts, "board_review");
      return artifact && isGroundedBoardReviewPayload(artifact.payload) ? artifact.payload : null;
    }
    default:
      return null;
  }
};

const selectPersistedActionResultMessage = (
  artifacts: readonly OpyAgentArtifact[],
): string | null => {
  const artifact = selectLatestTaskArtifact(artifacts, "action_result");
  if (!artifact || !isPersistedActionResultArtifactPayload(artifact.payload)) {
    return null;
  }
  return artifact.payload.message;
};

const selectPersistedContextBundle = (
  artifacts: readonly OpyAgentArtifact[],
): RigAgentContextBundle | null => {
  const artifact = selectLatestTaskArtifact(artifacts, "context_bundle");
  if (!artifact || !isRigAgentContextBundlePayload(artifact.payload)) {
    return null;
  }
  return artifact.payload;
};

const formatClockTime = (timestamp: number): string =>
  new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(timestamp);

const ROLE_LABEL: Record<OpyChatRole, string> = {
  assistant: "OPY",
  user: "OPERATOR",
  system: "SYSTEM",
};

const DIFF_STATUS_LABEL: Record<OpyProposalDiffStatus, string> = {
  new: "NEW",
  existing: "MATCH",
  ambiguous: "AMBIG",
};

const PLAN_DECISION_LABEL: Record<OpyPlanDecisionStatus, string> = {
  pending: "PENDING",
  approved: "APPROVED",
  rejected: "REJECTED",
};

const RESTORE_IMPACT_LABEL: Record<OpyCheckpointRestoreImpactStatus, string> = {
  restore: "RESTORE",
  revert: "REVERT",
  remove: "REMOVE",
};

const RUN_INTENT_LABEL: Record<OpyAgentRunIntent, string> = {
  chat: "CHAT",
  "plan-c4-diagram": "DIAGRAM",
  "review-c4-board": "REVIEW",
};

const RUN_STAGE_LABEL: Record<OpyAgentRun["stage"], string> = {
  invoke: "INVOKE",
  persist: "PERSIST",
  complete: "COMPLETE",
};

const RUN_STATUS_LABEL: Record<OpyAgentRun["status"], string> = {
  running: "RUNNING",
  completed: "COMPLETE",
  failed: "FAILED",
  cancelled: "CANCELLED",
};

const TASK_STATUS_LABEL: Record<OpyAgentTask["status"], string> = {
  running: "RUNNING",
  interrupted: "INTERRUPTED",
  completed: "COMPLETE",
  failed: "FAILED",
  cancelled: "CANCELLED",
};

const TOOL_CALL_STATUS_LABEL: Record<OpyAgentToolCall["status"], string> = {
  running: "RUNNING",
  interrupted: "INTERRUPTED",
  completed: "COMPLETE",
  failed: "FAILED",
  cancelled: "CANCELLED",
};

const LIFECYCLE_STAGE_LABEL: Record<Exclude<OpyAgentLifecycleStage, "idle">, string> = {
  contextualizing: "CONTEXT",
  planning: "PLAN",
  proposing: "PROPOSE",
  awaiting_confirmation: "AWAIT_CONFIRM",
  applying: "APPLY",
  verifying: "VERIFY",
  completed: "COMPLETE",
  failed: "FAILED",
};

const formatTaskStageLabel = (stage: OpyAgentTaskStage): string =>
  stage === "completed"
    ? "COMPLETE"
    : stage === "failed"
    ? "FAILED"
    : LIFECYCLE_STAGE_LABEL[stage];

const formatLineageCompletedStep = (name: OpyAgentToolCallName): string =>
  name.replaceAll("_", " ").toUpperCase();

const formatTaskLineageSummary = (input: {
  readonly artifactCount: number;
  readonly completedStepCount: number;
  readonly segmentCount: number;
}): string =>
  `CHAIN::${input.segmentCount} · READY::${input.completedStepCount} · ARTIFACTS::${input.artifactCount}`;

const formatLineageResumeOutcomeRollup = (
  rollup: ReturnType<typeof summarizeOpyAgentTaskLineage>["resumeOutcomeRollup"],
  options?: {
    readonly compact?: boolean;
  },
): string => {
  if (rollup.taskCount === 0 || rollup.boundaryCount === 0) {
    return options?.compact ? "ROLLUP::PENDING" : "CHAIN OUTCOME::PENDING";
  }

  const parts = [
    rollup.reusedCurrentSessionCount > 0
      ? `${options?.compact ? "L" : "LOCAL"}${options?.compact ? "" : " "}${rollup.reusedCurrentSessionCount}`
      : null,
    rollup.reusedInheritedSessionCount > 0
      ? `${options?.compact ? "I" : "INHERITED"}${options?.compact ? "" : " "}${rollup.reusedInheritedSessionCount}`
      : null,
    rollup.reranCount > 0
      ? `${options?.compact ? "R" : "RERAN"}${options?.compact ? "" : " "}${rollup.reranCount}`
      : null,
    rollup.pendingCount > 0
      ? `${options?.compact ? "P" : "PENDING"}${options?.compact ? "" : " "}${rollup.pendingCount}`
      : null,
  ].filter((part): part is string => part !== null);

  if (parts.length === 0) {
    return options?.compact ? "ROLLUP::PENDING" : "CHAIN OUTCOME::PENDING";
  }

  return `${options?.compact ? "ROLLUP" : "CHAIN OUTCOME"}::${parts.join(" · ")}`;
};

const formatLineageSessionScope = (
  sessionIds: readonly string[],
  sessionLookup: Readonly<Record<string, OpyChatSession | undefined>>,
): string =>
  sessionIds
    .map((sessionId) => sessionLookup[sessionId]?.title ?? sessionId.slice(0, 8))
    .join(" · ");

const formatTaskHistoryChainFilterLabel = (task: OpyAgentTask): string => {
  switch (task.request.replay.kind) {
    case "chat":
      return `CHAT · ${summarizeInlineText(task.request.replay.prompt, "PROMPT")}`;
    case "proposal":
      return `PROPOSAL · ${summarizeInlineText(task.request.replay.description, "DESCRIPTION")}`;
    case "review":
      return `REVIEW · ${summarizeInlineText(task.request.replay.focus ?? "WHOLE BOARD", "WHOLE BOARD")}`;
    case "add-node":
      return `ADD ${task.request.replay.nodeType.toUpperCase()} · ${summarizeInlineText(task.request.replay.label, "NODE")}`;
    case "apply-proposal":
      return `APPLY PROPOSAL · ${String(task.request.replay.proposalRespondedAtMs)}`;
    case "rollback":
      return `ROLLBACK · ${task.request.replay.checkpointId.slice(0, 8)}`;
  }
};

const matchesTaskHistoryBoundaryFilter = (
  rollup: ReturnType<typeof summarizeOpyAgentTaskLineage>["resumeOutcomeRollup"],
  filter: OpyTaskHistoryBoundaryFilter,
): boolean => {
  switch (filter) {
    case "all":
      return true;
    case "reused-current-session":
      return rollup.reusedCurrentSessionCount > 0;
    case "reused-inherited-session":
      return rollup.reusedInheritedSessionCount > 0;
    case "reran":
      return rollup.reranCount > 0;
    case "pending":
      return rollup.taskCount === 0 || rollup.pendingCount > 0;
  }
};

const resolveTaskHistoryFocusSection = (task: OpyAgentTask): OpyViewportSectionKey => {
  switch (task.request.kind) {
    case "chat":
      return "diagnostics";
    case "proposal":
    case "apply-proposal":
      return "proposal";
    case "review":
      return "review";
    case "rollback":
      return "checkpoints";
    case "add-node":
      return "control";
  }
};

const formatTaskHistoryFocusLabel = (task: OpyAgentTask): string => {
  switch (task.request.kind) {
    case "chat":
      return "OPEN DIAGNOSTICS";
    case "proposal":
      return "OPEN PROPOSAL";
    case "apply-proposal":
      return "OPEN PLAN";
    case "review":
      return "OPEN REVIEW";
    case "rollback":
      return "OPEN CHECKPOINT";
    case "add-node":
      return "OPEN CONTROL";
  }
};

type OpyResumeBoundaryOrigin = "current-session" | "inherited-session" | "fresh";

interface OpyResumeBoundaryPlanItem {
  readonly name: OpyAgentToolCallName;
  readonly origin: OpyResumeBoundaryOrigin;
}

const SESSION_LOCAL_RESUME_BOUNDARIES = new Set<OpyAgentToolCallName>([
  "persist_assistant_message",
  "refresh_checkpoints",
]);

const RESUME_BOUNDARY_LABEL: Record<OpyAgentToolCallName, string> = {
  assemble_context: "CONTEXT",
  invoke_agent: "RESULT",
  persist_assistant_message: "MESSAGE",
  resolve_action: "ACTION",
  execute_board_action: "APPLY",
  refresh_checkpoints: "CHECKPOINTS",
};

const RESUME_BOUNDARY_ORIGIN_LABEL: Record<Exclude<OpyResumeBoundaryOrigin, "fresh">, string> = {
  "current-session": "LOCAL",
  "inherited-session": "INHERITED",
};

const RESUME_BOUNDARY_OUTCOME_LABEL: Record<Exclude<OpyResumeBoundaryOutcome, "pending">, string> = {
  "reused-current-session": "LOCAL",
  "reused-inherited-session": "INHERITED",
  reran: "RERAN",
};

const getResumeBoundariesForRequest = (
  request: OpyAgentLifecycleRequest,
): ReadonlyArray<OpyAgentToolCallName> => {
  switch (request.kind) {
    case "chat":
    case "proposal":
    case "review":
      return ["assemble_context", "invoke_agent", "persist_assistant_message"];
    case "add-node":
    case "apply-proposal":
    case "rollback":
      return ["resolve_action", "execute_board_action", "refresh_checkpoints", "persist_assistant_message"];
  }
};

const getResumeBoundariesForRequestKind = (
  kind: OpyAgentLifecycleRequest["kind"],
): ReadonlyArray<OpyAgentToolCallName> => {
  switch (kind) {
    case "chat":
    case "proposal":
    case "review":
      return ["assemble_context", "invoke_agent", "persist_assistant_message"];
    case "add-node":
    case "apply-proposal":
    case "rollback":
      return ["resolve_action", "execute_board_action", "refresh_checkpoints", "persist_assistant_message"];
  }
};

const selectReusableCompletedTaskToolCall = (
  targetSessionId: string,
  toolCalls: readonly OpyAgentToolCall[],
  name: OpyAgentToolCallName,
): OpyAgentToolCall | null =>
  [...toolCalls]
    .filter((toolCall) =>
      toolCall.name === name
      && toolCall.status === "completed"
      && (
        !SESSION_LOCAL_RESUME_BOUNDARIES.has(name)
        || toolCall.sessionId === targetSessionId
      )
    )
    .sort((left, right) => right.updatedAt - left.updatedAt || right.startedAt - left.startedAt)[0] ?? null;

const buildTaskResumeBoundaryPlan = (
  targetSessionId: string,
  request: OpyAgentLifecycleRequest,
  toolCalls: readonly OpyAgentToolCall[],
): ReadonlyArray<OpyResumeBoundaryPlanItem> =>
  getResumeBoundariesForRequest(request).map((name) => {
    const reusableToolCall = selectReusableCompletedTaskToolCall(targetSessionId, toolCalls, name);
    if (!reusableToolCall) {
      return {
        name,
        origin: "fresh",
      } satisfies OpyResumeBoundaryPlanItem;
    }

    return {
      name,
      origin: reusableToolCall.sessionId === targetSessionId ? "current-session" : "inherited-session",
    } satisfies OpyResumeBoundaryPlanItem;
  });

const buildTaskResumeBoundaryPlanForKind = (
  targetSessionId: string,
  kind: OpyAgentLifecycleRequest["kind"],
  toolCalls: readonly OpyAgentToolCall[],
): ReadonlyArray<OpyResumeBoundaryPlanItem> =>
  getResumeBoundariesForRequestKind(kind).map((name) => {
    const reusableToolCall = selectReusableCompletedTaskToolCall(targetSessionId, toolCalls, name);
    if (!reusableToolCall) {
      return {
        name,
        origin: "fresh",
      } satisfies OpyResumeBoundaryPlanItem;
    }

    return {
      name,
      origin: reusableToolCall.sessionId === targetSessionId ? "current-session" : "inherited-session",
    } satisfies OpyResumeBoundaryPlanItem;
  });

const summarizeTaskResumeBoundaryPlan = (
  plan: readonly OpyResumeBoundaryPlanItem[],
  limit = 3,
): string => {
  const active = plan.filter((item) => item.origin !== "fresh").slice(0, limit);
  const fresh = plan.filter((item) => item.origin === "fresh");

  if (active.length === 0) {
    return fresh.length > 0
      ? `REUSE::FRESH · NEXT::${RESUME_BOUNDARY_LABEL[fresh[0]!.name]}`
      : "REUSE::FRESH";
  }

  const reusedLabel = active
    .map((item) =>
      `${RESUME_BOUNDARY_LABEL[item.name]}[${
        RESUME_BOUNDARY_ORIGIN_LABEL[item.origin as Exclude<OpyResumeBoundaryOrigin, "fresh">]
      }]`
    )
    .join(" · ");

  if (fresh.length === 0) {
    return `REUSE::${reusedLabel}`;
  }

  return `REUSE::${reusedLabel} · NEXT::${RESUME_BOUNDARY_LABEL[fresh[0]!.name]}`;
};

const toPersistedResumeBoundaryOutcome = (
  plan: readonly OpyResumeBoundaryPlanItem[],
): ReadonlyArray<OpyPersistedResumeBoundaryOutcomeItem> =>
  plan.map((item) => ({
    name: item.name,
    outcome: item.origin === "current-session"
      ? "reused-current-session"
      : item.origin === "inherited-session"
      ? "reused-inherited-session"
      : "pending",
  }));

const markResumeBoundaryReran = (
  items: readonly OpyPersistedResumeBoundaryOutcomeItem[],
  name: OpyAgentToolCallName,
): ReadonlyArray<OpyPersistedResumeBoundaryOutcomeItem> =>
  items.map((item) => item.name === name ? { ...item, outcome: "reran" } : item);

const summarizePersistedResumeBoundaryOutcome = (
  payload: OpyPersistedResumeBoundaryOutcomePayload,
  limit = 3,
): string => {
  const active = payload.boundaries
    .filter((item) => item.outcome !== "pending")
    .slice(0, limit)
    .map((item) => {
      const outcomeLabel = item.outcome === "reran"
        ? "RERAN"
        : RESUME_BOUNDARY_OUTCOME_LABEL[item.outcome as Exclude<OpyResumeBoundaryOutcome, "pending" | "reran">];
      return `${RESUME_BOUNDARY_LABEL[item.name]}[${outcomeLabel}]`;
    })
    .join(" · ");

  const pending = payload.boundaries.filter((item) => item.outcome === "pending");

  if (active.length === 0) {
    return pending.length > 0
      ? `OUTCOME::PENDING · NEXT::${RESUME_BOUNDARY_LABEL[pending[0]!.name]}`
      : "OUTCOME::PENDING";
  }

  if (pending.length === 0) {
    return `OUTCOME::${active}`;
  }

  return `OUTCOME::${active} · NEXT::${RESUME_BOUNDARY_LABEL[pending[0]!.name]}`;
};

const createResumeBoundaryOutcomeArtifactDraft = (
  payload: OpyPersistedResumeBoundaryOutcomePayload,
): OpyTaskArtifactDraft => ({
  kind: "resume_boundary_outcome",
  summary: summarizePersistedResumeBoundaryOutcome(payload),
  payload,
});

const LIFECYCLE_TERMINAL_STATUS_LABEL: Record<
  NonNullable<ReturnType<typeof useOpyAgentMachine>["lastTerminalStatus"]>,
  string
> = {
  completed: "COMPLETE",
  cancelled: "CANCELLED",
  failed: "FAILED",
};

const formatLifecycleFailureScope = (input: {
  readonly stage: ReturnType<typeof useOpyAgentMachine>["lastFailureStage"];
  readonly phase: ReturnType<typeof useOpyAgentMachine>["lastFailurePhase"];
}): string => {
  const stageLabel = input.stage?.toUpperCase() ?? "UNKNOWN";
  if (!input.phase) {
    return stageLabel;
  }

  const phaseLabel = input.phase.toUpperCase();
  return input.phase === "verify"
    ? `${stageLabel}/${phaseLabel}`
    : `${stageLabel}::${phaseLabel}`;
};

const sortRunsByRecency = (runs: readonly OpyAgentRun[]): OpyAgentRun[] =>
  [...runs].sort((left, right) => right.startedAt - left.startedAt);

const isResumableTaskStage = (stage: OpyAgentTaskStage): stage is OpyAgentLifecycleNonTerminalStage =>
  stage !== "completed" && stage !== "failed";

const upsertSessionRun = (
  runs: readonly OpyAgentRun[],
  nextRun: OpyAgentRun,
): ReadonlyArray<OpyAgentRun> =>
  sortRunsByRecency([
    nextRun,
    ...runs.filter((run) => run.id !== nextRun.id),
  ]);

const sortTasksByRecency = (tasks: readonly OpyAgentTask[]): ReadonlyArray<OpyAgentTask> =>
  [...tasks].sort((left, right) => right.updatedAt - left.updatedAt || right.createdAt - left.createdAt);

const upsertSessionTask = (
  tasks: readonly OpyAgentTask[],
  nextTask: OpyAgentTask,
): ReadonlyArray<OpyAgentTask> =>
  sortTasksByRecency([
    nextTask,
    ...tasks.filter((task) => task.id !== nextTask.id),
  ]);

const sortToolCallsByTimeline = (toolCalls: readonly OpyAgentToolCall[]): ReadonlyArray<OpyAgentToolCall> =>
  [...toolCalls].sort((left, right) => left.startedAt - right.startedAt || left.updatedAt - right.updatedAt);

const upsertTaskToolCall = (
  toolCalls: readonly OpyAgentToolCall[],
  nextToolCall: OpyAgentToolCall,
): ReadonlyArray<OpyAgentToolCall> =>
  sortToolCallsByTimeline([
    ...toolCalls.filter((toolCall) => toolCall.id !== nextToolCall.id),
    nextToolCall,
  ]);

const sortArtifactsByTimeline = (artifacts: readonly OpyAgentArtifact[]): ReadonlyArray<OpyAgentArtifact> =>
  [...artifacts].sort((left, right) => left.createdAt - right.createdAt);

const upsertTaskArtifact = (
  artifacts: readonly OpyAgentArtifact[],
  nextArtifact: OpyAgentArtifact,
): ReadonlyArray<OpyAgentArtifact> =>
  sortArtifactsByTimeline([
    ...artifacts.filter((artifact) => artifact.id !== nextArtifact.id),
    nextArtifact,
  ]);

const buildBootstrapMessage = (hasOpenAiApiKey: boolean): { role: OpyChatRole; content: string } =>
  hasOpenAiApiKey
    ? {
      role: "assistant",
      content: "OPY Net online. Ask about architecture, ownership, or coupling on this board.",
    }
    : {
      role: "system",
      content: "OpenAI key not configured. Add it in SETTINGS to enable OPY Net responses.",
    };

const sortSessionsByRecency = (sessions: readonly OpyChatSession[]): OpyChatSession[] =>
  [...sessions].sort((left, right) => right.updatedAt - left.updatedAt);

const C4_NODE_TYPE_ALIASES: Record<string, OpyC4NodeType> = {
  person: "person",
  people: "person",
  system: "system",
  external: "externalSystem",
  "external-system": "externalSystem",
  externalsystem: "externalSystem",
  container: "container",
  component: "component",
};

type ParseOpyCommandResult =
  | { readonly type: "none" }
  | { readonly type: "invalid"; readonly reason: string }
  | { readonly type: "action"; readonly action: Extract<OpyBoardAction, { kind: "add-node" }> }
  | { readonly type: "diagram-proposal"; readonly proposal: OpyDiagramProposalCommand }
  | { readonly type: "board-review"; readonly review: OpyBoardReviewCommand };

const normalizeNodeTypeToken = (value: string): string => value.trim().toLowerCase();

const stripWrappingQuotes = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
};

const parseOpyCommand = (value: string): ParseOpyCommandResult => {
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) {
    return { type: "none" };
  }

  const normalized = trimmed.toLowerCase();
  if (normalized === "/review" || normalized.startsWith("/review ")) {
    const focus = stripWrappingQuotes(trimmed.slice("/review".length).trim());
    return {
      type: "board-review",
      review: {
        kind: "review-c4-board",
        focus: focus.length > 0 ? focus : null,
      },
    };
  }

  if (normalized.startsWith("/diagram ") || normalized.startsWith("/plan ")) {
    const payload = normalized.startsWith("/diagram ")
      ? trimmed.slice("/diagram".length).trim()
      : trimmed.slice("/plan".length).trim();

    if (payload.length === 0) {
      return {
        type: "invalid",
        reason: "MISSING DESCRIPTION. USE /diagram <architecture description>.",
      };
    }

    return {
      type: "diagram-proposal",
      proposal: {
        kind: "plan-c4-diagram",
        description: payload,
      },
    };
  }

  if (!normalized.startsWith("/add ")) {
    return {
      type: "invalid",
      reason:
        "UNKNOWN COMMAND. USE /add <person|system|external|container|component> <label>, /diagram <description>, OR /review [focus].",
    };
  }

  const payload = trimmed.slice(5).trim();
  const separator = payload.indexOf(" ");
  if (separator < 1) {
    return {
      type: "invalid",
      reason: "MISSING LABEL. USE /add <type> <label>.",
    };
  }

  const rawType = payload.slice(0, separator);
  const rawLabel = payload.slice(separator + 1);
  const nodeType = C4_NODE_TYPE_ALIASES[normalizeNodeTypeToken(rawType)];
  if (!nodeType) {
    return {
      type: "invalid",
      reason: `UNSUPPORTED TYPE '${rawType}'. USE person/system/external/container/component.`,
    };
  }

  const label = stripWrappingQuotes(rawLabel);
  if (label.length === 0) {
    return {
      type: "invalid",
      reason: "LABEL CANNOT BE EMPTY.",
    };
  }

  return {
    type: "action",
    action: {
      kind: "add-node",
      nodeType,
      label,
    },
  };
};

const detectCommandToken = (value: string): "/add" | "/diagram" | "/review" | null => {
  const trimmed = value.trimStart().toLowerCase();
  if (trimmed.startsWith("/add")) {
    return "/add";
  }
  if (trimmed.startsWith("/review")) {
    return "/review";
  }
  if (trimmed.startsWith("/diagram") || trimmed.startsWith("/plan")) {
    return "/diagram";
  }
  return null;
};

const formatReviewFocus = (focus: string | null | undefined): string =>
  focus && focus.trim().length > 0 ? focus.trim() : "WHOLE BOARD";

const formatConfidence = (confidence: RigAgentContextBundle["confidence"]): string => confidence.toUpperCase();

const formatNodeMatchSummary = (matches: ReadonlyArray<RigC4BoardNode>): string =>
  matches
    .map((match) => `${match.nodeType.toUpperCase()} ${match.label}`)
    .join(" | ");

const formatEdgeMatchSummary = (matches: ReadonlyArray<RigC4BoardEdge>): string =>
  matches
    .map((match) => `${match.sourceLabel} -> ${match.targetLabel}${match.label ? ` (${match.label})` : ""}`)
    .join(" | ");

const formatPlanDecisionHint = (status: OpyPlanDecisionStatus): string => {
  switch (status) {
    case "approved":
      return "Plan approved. Apply stays gated by action mode and confirmation.";
    case "rejected":
      return "Plan rejected. Generate a new proposal or approve this one before apply.";
    case "pending":
      return "Inspect the typed mutation plan before approving or rejecting it.";
  }
};

const formatMutationActionSummary = (action: RigValidatedMutationAction): string => {
  switch (action.tool) {
    case "create_nodes": {
      const summary = action.summary as RigCreateNodesValidationSummary;
      return `${summary.nodeCount} NODE(S) · ${summary.labels.join(" | ")}`;
    }
    case "update_nodes": {
      const summary = action.summary as RigUpdateNodesValidationSummary;
      return `${summary.nodeCount} NODE PATCH(ES) · ${summary.fieldCount} FIELD UPDATE(S)`;
    }
    case "create_edges": {
      const summary = action.summary as RigCreateEdgesValidationSummary;
      return `${summary.edgeCount} EDGE(S) · ${summary.connectionRefs.join(" | ")}`;
    }
    case "apply_layout": {
      const summary = action.summary as RigApplyLayoutValidationSummary;
      return `${summary.preset.toUpperCase()} · ${summary.target.toUpperCase()}`;
    }
  }
};

const toSessionDiagramProposal = (
  persisted: OpyPersistedDiagramProposal,
): OpySessionDiagramProposal => ({
  command: {
    kind: "plan-c4-diagram",
    description: persisted.commandDescription,
  },
  proposal: persisted.proposal,
  context: persisted.context,
  decisionStatus: persisted.decisionStatus,
  decidedAtMs: persisted.decidedAt,
});

const toPersistedDiagramProposal = (
  sessionId: string,
  proposal: OpySessionDiagramProposal,
): OpyPersistedDiagramProposal => ({
  sessionId,
  commandDescription: proposal.command.description,
  proposal: proposal.proposal,
  context: proposal.context,
  decisionStatus: proposal.decisionStatus,
  decidedAt: proposal.decidedAtMs,
});

const sortSessionDiagramProposalsByRecency = (
  proposals: ReadonlyArray<OpySessionDiagramProposal>,
): OpySessionDiagramProposal[] =>
  [...proposals].sort((left, right) => right.proposal.respondedAtMs - left.proposal.respondedAtMs);

const upsertSessionDiagramProposalHistory = (
  proposals: ReadonlyArray<OpySessionDiagramProposal>,
  nextProposal: OpySessionDiagramProposal,
): OpySessionDiagramProposal[] =>
  sortSessionDiagramProposalsByRecency([
    nextProposal,
    ...proposals.filter((proposal) => proposal.proposal.respondedAtMs !== nextProposal.proposal.respondedAtMs),
  ]);

const findProposalForCheckpoint = (
  checkpoint: OpyAgentCheckpoint,
  proposals: ReadonlyArray<OpySessionDiagramProposal>,
): OpySessionDiagramProposal | null =>
  proposals.find((proposal) => proposal.proposal.respondedAtMs === checkpoint.proposalRespondedAtMs) ?? null;

const restoreImpactBadgeClassName = (status: OpyCheckpointRestoreImpactStatus): string => {
  switch (status) {
    case "restore":
      return `${styles.opyCopilotProposalBadge} ${styles.opyCopilotRestoreBadgeRestore}`;
    case "revert":
      return `${styles.opyCopilotProposalBadge} ${styles.opyCopilotRestoreBadgeRevert}`;
    case "remove":
      return `${styles.opyCopilotProposalBadge} ${styles.opyCopilotRestoreBadgeRemove}`;
  }
};

const parseOpyTranscriptDiagnostics = (content: string): OpyTranscriptDiagnostics => {
  const bodyLines: string[] = [];
  const citations: string[] = [];
  let confidence: string | null = null;

  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("CONFIDENCE::")) {
      confidence = trimmed.slice("CONFIDENCE::".length).trim();
      return;
    }

    if (trimmed.startsWith("CITATION::")) {
      citations.push(trimmed.slice("CITATION::".length).trim());
      return;
    }

    bodyLines.push(line);
  });

  const body = bodyLines.join("\n").trim();

  return {
    body: body.length > 0 ? body : content.trim(),
    confidence,
    citations,
  };
};

const describeActionMode = (actionMode: AiActionMode): OpyActionModeSurface => {
  switch (actionMode) {
    case "disabled":
      return {
        tone: "critical",
        label: "MUTATION ROUTES OFFLINE",
        detail: "Board writes and proposal generation are blocked. Chat and board review remain read-only.",
      };
    case "read-only":
      return {
        tone: "critical",
        label: "READ-ONLY BOUNDARY ACTIVE",
        detail: "Use chat and /review for inspection. /add, /diagram, and apply paths are blocked in this mode.",
      };
    case "propose":
      return {
        tone: "warning",
        label: "PROPOSAL BOUNDARY ACTIVE",
        detail: "OPY can prepare changes, but apply paths stay blocked until APPLY-WITH-CONFIRMATION is enabled.",
      };
    case "apply-with-confirmation":
      return {
        tone: "ready",
        label: "CONFIRMED APPLY BOUNDARY",
        detail: "Mutations still require operator confirmation before the board is changed.",
      };
  }
};

const toOpyChromeTone = (tone: OpyActionModeSurface["tone"]): OpyWidgetChromeTone =>
  tone === "warning"
    ? "caution"
    : tone;

const toProposalChromeTone = (risk: "low" | "medium" | "high"): OpyWidgetChromeTone =>
  risk === "high"
    ? "critical"
    : risk === "medium"
    ? "caution"
    : "ready";

const createLifecycleRequest = (
  request: OpyAgentLifecycleRequest,
): OpyAgentLifecycleRequest => request;

export function OpyCopilotPanel({
  domain,
  diagramId,
  diagramName,
  nodeCount,
  edgeCount,
  boardSummary,
  boardContext,
  actionMode,
  viewportSections,
  onViewportSectionsChange,
  taskHistoryFiltersBySession,
  onTaskHistoryFiltersBySessionChange,
  onApplyBoardAction,
  onOpenAiSettings,
  onChromeStatusChange,
  chromeSectionRequest,
}: OpyCopilotPanelProps) {
  const { runEffect } = useDatabase();
  const pendingViewportBaselineRef = useRef(true);
  const agentTaskIndexRef = useRef<Record<string, OpyAgentTask>>({});
  const lifecycleTaskSyncRef = useRef<{
    activeRequestId: string | null;
    errorSummary: string | null;
    lastCompletedAt: number | null;
    lastRequestId: string | null;
    stage: OpyAgentLifecycleStage;
    terminalStatus: ReturnType<typeof useOpyAgentMachine>["lastTerminalStatus"];
  }>({
    activeRequestId: null,
    errorSummary: null,
    lastCompletedAt: null,
    lastRequestId: null,
    stage: "idle",
    terminalStatus: null,
  });
  const viewportAutoSignalsRef = useRef<{
    proposal: number | null;
    review: number | null;
    checkpoints: string | null;
  }>({
    proposal: null,
    review: null,
    checkpoints: null,
  });
  const [draftPrompt, setDraftPrompt] = useState("");
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [isMessageLoading, setIsMessageLoading] = useState(false);
  const [agentSecretStatus, setAgentSecretStatus] = useState<"loading" | "ready" | "error">("loading");
  const [hasOpenAiApiKey, setHasOpenAiApiKey] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ReadonlyArray<OpyChatSession>>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [sessionTitleDraft, setSessionTitleDraft] = useState("");
  const [messages, setMessages] = useState<ReadonlyArray<OpyChatMessage>>([]);
  const [runsBySessionId, setRunsBySessionId] = useState<
    Readonly<Record<string, ReadonlyArray<OpyAgentRun> | undefined>>
  >({});
  const [tasksBySessionId, setTasksBySessionId] = useState<
    Readonly<Record<string, ReadonlyArray<OpyAgentTask> | undefined>>
  >({});
  const [taskToolCallsByTaskId, setTaskToolCallsByTaskId] = useState<
    Readonly<Record<string, ReadonlyArray<OpyAgentToolCall> | undefined>>
  >({});
  const [taskArtifactsByTaskId, setTaskArtifactsByTaskId] = useState<
    Readonly<Record<string, ReadonlyArray<OpyAgentArtifact> | undefined>>
  >({});
  const [resumableTaskPreferenceBySessionId, setResumableTaskPreferenceBySessionId] = useState<
    Readonly<Record<string, string | undefined>>
  >({});
  const [taskDetailLoadingByTaskId, setTaskDetailLoadingByTaskId] = useState<
    Readonly<Record<string, boolean | undefined>>
  >({});
  const [expandedTaskIds, setExpandedTaskIds] = useState<ReadonlyArray<string>>([]);
  const [taskHistoryChainFilter, setTaskHistoryChainFilter] = useState<OpyTaskHistoryChainFilter>(
    TASK_HISTORY_CHAIN_FILTER_ALL,
  );
  const [taskHistoryBoundaryFilter, setTaskHistoryBoundaryFilter] = useState<OpyTaskHistoryBoundaryFilter>(
    TASK_HISTORY_BOUNDARY_FILTER_ALL,
  );
  const [groundedChatsBySessionId, setGroundedChatsBySessionId] = useState<
    Readonly<Record<string, OpyGroundedChatResponse | undefined>>
  >({});
  const [diagramProposalHistoryBySessionId, setDiagramProposalHistoryBySessionId] = useState<
    Readonly<Record<string, ReadonlyArray<OpySessionDiagramProposal> | undefined>>
  >({});
  const [checkpointsBySessionId, setCheckpointsBySessionId] = useState<
    Readonly<Record<string, ReadonlyArray<OpyAgentCheckpoint> | undefined>>
  >({});
  const [boardReviewsBySessionId, setBoardReviewsBySessionId] = useState<
    Readonly<Record<string, OpySessionBoardReview | undefined>>
  >({});
  const selectedSessionIdRef = useRef<string>("");
  const viewportSectionRefs = useRef<Partial<Record<OpyViewportSectionKey, HTMLElement | null>>>({});
  const taskHistoryCardRefs = useRef<Record<string, HTMLElement | null>>({});
  const checkpointCardRefs = useRef<Record<string, HTMLElement | null>>({});
  const diagnosticsCardRef = useRef<HTMLElement | null>(null);
  const reviewCardRef = useRef<HTMLElement | null>(null);
  const proposalCardRef = useRef<HTMLElement | null>(null);
  const proposalPlanCardRef = useRef<HTMLElement | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const [viewportSectionsOpen, setViewportSectionsOpen] = useState<OpyViewportSections>(
    viewportSections,
  );
  const [viewportSectionsUnseen, setViewportSectionsUnseen] = useState<OpyViewportSections>(
    EMPTY_VIEWPORT_SECTION_STATE,
  );
  const agentLifecycle = useOpyAgentMachine();
  const isRunning = agentLifecycle.isBusy;
  const pendingLifecycleRequest = agentLifecycle.pendingConfirmationRequest;
  const pendingLifecycleConfirmation = pendingLifecycleRequest?.confirmation ?? null;

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, sessions],
  );
  const sessionLookup = useMemo(
    () => Object.fromEntries(sessions.map((session) => [session.id, session] as const)),
    [sessions],
  );
  const compatibleSessionIds = useMemo(
    () => sessions.map((session) => session.id),
    [sessions],
  );

  const activeProposalHistory = useMemo(
    () => diagramProposalHistoryBySessionId[selectedSessionId] ?? [],
    [diagramProposalHistoryBySessionId, selectedSessionId],
  );
  const activeDiagramProposal = useMemo(
    () => activeProposalHistory[0] ?? null,
    [activeProposalHistory],
  );
  const activeGroundedChat = useMemo(
    () => groundedChatsBySessionId[selectedSessionId] ?? null,
    [groundedChatsBySessionId, selectedSessionId],
  );
  const activeBoardReview = useMemo(
    () => boardReviewsBySessionId[selectedSessionId] ?? null,
    [boardReviewsBySessionId, selectedSessionId],
  );
  const activeRuns = useMemo(
    () => runsBySessionId[selectedSessionId] ?? [],
    [runsBySessionId, selectedSessionId],
  );
  const activeTasks = useMemo(
    () => tasksBySessionId[selectedSessionId] ?? [],
    [tasksBySessionId, selectedSessionId],
  );
  const persistedTaskHistoryFilterState = useMemo<OpyTaskHistoryFilterState>(
    () => taskHistoryFiltersBySession[selectedSessionId] ?? DEFAULT_TASK_HISTORY_FILTER_STATE,
    [selectedSessionId, taskHistoryFiltersBySession],
  );
  const activeInterruptedTasks = useMemo(
    () =>
      selectLatestOpyAgentTasksByLineage(
        activeTasks.filter((task) => task.status === "interrupted" && isResumableTaskStage(task.stage)),
      ),
    [activeTasks],
  );
  const resumableTaskByContinuityKey = useMemo(
    () =>
      new Map(
        activeInterruptedTasks.map((task) => [deriveOpyAgentTaskContinuityKey(task.request), task] as const),
      ),
    [activeInterruptedTasks],
  );
  const latestTask = useMemo(
    () => activeTasks[0] ?? null,
    [activeTasks],
  );
  const selectedResumableTask = useMemo(
    () => activeInterruptedTasks.find((task) => task.id === agentLifecycle.resumableTaskId) ?? null,
    [activeInterruptedTasks, agentLifecycle.resumableTaskId],
  );
  const activeCheckpoints = useMemo(
    () => checkpointsBySessionId[selectedSessionId] ?? [],
    [checkpointsBySessionId, selectedSessionId],
  );
  const latestCheckpoint = useMemo(
    () => selectLatestOpyAgentCheckpoint(activeCheckpoints),
    [activeCheckpoints],
  );
  const checkpointRestorePreviewById = useMemo(
    () =>
      new Map(
        activeCheckpoints.map((checkpoint) =>
          [
            checkpoint.id,
            buildOpyCheckpointRestorePreview(checkpoint, boardSummary),
          ] as const
        ),
      ),
    [activeCheckpoints, boardSummary],
  );
  const activeRun = useMemo(
    () => activeRuns.find((run) => run.status === "running") ?? null,
    [activeRuns],
  );
  const latestRun = useMemo(
    () => activeRuns[0] ?? null,
    [activeRuns],
  );
  const latestChatRun = useMemo(
    () => activeRuns.find((run) => run.intent === "chat") ?? null,
    [activeRuns],
  );
  const latestDiagramRun = useMemo(
    () => activeRuns.find((run) => run.intent === "plan-c4-diagram") ?? null,
    [activeRuns],
  );
  const latestReviewRun = useMemo(
    () => activeRuns.find((run) => run.intent === "review-c4-board") ?? null,
    [activeRuns],
  );

  useEffect(() => {
    setViewportSectionsOpen(viewportSections);
  }, [viewportSections]);

  useEffect(() => {
    setTaskHistoryChainFilter(persistedTaskHistoryFilterState.chain);
    setTaskHistoryBoundaryFilter(persistedTaskHistoryFilterState.boundary);
  }, [persistedTaskHistoryFilterState]);

  const activeProposalSignal = activeDiagramProposal?.proposal.respondedAtMs ?? null;
  const activeReviewSignal = activeBoardReview?.review.respondedAtMs ?? null;
  const activeCheckpointSignal = latestCheckpoint
    ? `${latestCheckpoint.id}:${latestCheckpoint.createdAt}`
    : null;

  const activeGroundedProposal = useMemo(
    () =>
      activeDiagramProposal
        ? buildGroundedProposalDiff(activeDiagramProposal.proposal, boardSummary)
        : null,
    [activeDiagramProposal, boardSummary],
  );
  const activeProposalSummary = useMemo(
    () => activeGroundedProposal ? summarizeGroundedProposalDiff(activeGroundedProposal) : null,
    [activeGroundedProposal],
  );
  const activeMutationPlan = useMemo(
    () =>
      activeDiagramProposal ? buildRigMutationPlanDiff(activeDiagramProposal.proposal, activeGroundedProposal) : null,
    [activeDiagramProposal, activeGroundedProposal],
  );
  const activePlanDecision = useMemo(() => {
    if (!activeDiagramProposal) {
      return null;
    }

    return {
      proposalRespondedAtMs: activeDiagramProposal.proposal.respondedAtMs,
      status: activeDiagramProposal.decisionStatus,
      decidedAtMs: activeDiagramProposal.decidedAtMs,
    };
  }, [activeDiagramProposal]);
  const actionModeSurface = useMemo(
    () => describeActionMode(actionMode),
    [actionMode],
  );
  const latestDiagnosticsSurface = useMemo(() => {
    const surfaces: OpyDiagnosticsSurface[] = [];

    if (activeGroundedChat) {
      surfaces.push({
        kind: "chat",
        title: "CHAT",
        summary: activeGroundedChat.response.message,
        detail: "Grounded OPY response based on current board evidence.",
        provider: activeGroundedChat.response.provider,
        model: activeGroundedChat.response.model,
        respondedAtMs: activeGroundedChat.response.respondedAtMs,
        context: activeGroundedChat.context,
        run: latestChatRun,
      });
    }

    if (activeDiagramProposal) {
      surfaces.push({
        kind: "diagram",
        title: "PROPOSAL",
        summary: activeDiagramProposal.proposal.summary,
        detail: activeDiagramProposal.proposal.rationale,
        provider: activeDiagramProposal.proposal.provider,
        model: activeDiagramProposal.proposal.model,
        respondedAtMs: activeDiagramProposal.proposal.respondedAtMs,
        context: activeDiagramProposal.context,
        run: latestDiagramRun,
      });
    }

    if (activeBoardReview) {
      surfaces.push({
        kind: "review",
        title: "REVIEW",
        summary: activeBoardReview.review.summary,
        detail: `Focus: ${formatReviewFocus(activeBoardReview.command.focus)}`,
        provider: activeBoardReview.review.provider,
        model: activeBoardReview.review.model,
        respondedAtMs: activeBoardReview.review.respondedAtMs,
        context: activeBoardReview.context,
        run: latestReviewRun,
      });
    }

    return surfaces.sort((left, right) => right.respondedAtMs - left.respondedAtMs)[0] ?? null;
  }, [
    activeBoardReview,
    activeDiagramProposal,
    activeGroundedChat,
    latestChatRun,
    latestDiagramRun,
    latestReviewRun,
  ]);
  const policyChromeSignal = useMemo<OpyWidgetChromeSignal | null>(() => {
    if (actionModeSurface.tone === "ready") {
      return null;
    }

    return {
      key: "policy",
      targetSection: "control",
      label: `POLICY::${actionMode.toUpperCase()}`,
      detail: actionModeSurface.label,
      tone: toOpyChromeTone(actionModeSurface.tone),
      isFresh: false,
    };
  }, [actionMode, actionModeSurface]);
  const reviewChromeSignal = useMemo<OpyWidgetChromeSignal | null>(() => {
    if (!activeBoardReview) {
      return null;
    }

    const highRiskCount = activeBoardReview.review.risks.filter((risk) => risk.severity === "high").length;
    const mediumRiskCount = activeBoardReview.review.risks.filter((risk) => risk.severity === "medium").length;
    const totalRiskCount = activeBoardReview.review.risks.length;

    if (highRiskCount > 0) {
      return {
        key: "review",
        targetSection: "review",
        label: `REVIEW::HIGH ${highRiskCount}H${mediumRiskCount > 0 ? `/${mediumRiskCount}M` : ""}`,
        detail: activeBoardReview.review.summary,
        tone: "critical",
        isFresh: viewportSectionsUnseen.review,
      };
    }

    if (totalRiskCount > 0 || activeBoardReview.review.ambiguities.length > 0) {
      return {
        key: "review",
        targetSection: "review",
        label: `REVIEW::${totalRiskCount} RISK${totalRiskCount === 1 ? "" : "S"}`,
        detail: activeBoardReview.review.summary,
        tone: "caution",
        isFresh: viewportSectionsUnseen.review,
      };
    }

    if (activeBoardReview.review.recommendedChanges.length > 0) {
      return {
        key: "review",
        targetSection: "review",
        label: `REVIEW::NEXT ${activeBoardReview.review.recommendedChanges.length}`,
        detail: activeBoardReview.review.summary,
        tone: "caution",
        isFresh: viewportSectionsUnseen.review,
      };
    }

    return {
      key: "review",
      targetSection: "review",
      label: "REVIEW::CLEAR",
      detail: activeBoardReview.review.summary,
      tone: "ready",
      isFresh: viewportSectionsUnseen.review,
    };
  }, [activeBoardReview, viewportSectionsUnseen.review]);
  const proposalChromeSignal = useMemo<OpyWidgetChromeSignal | null>(() => {
    if (!activeDiagramProposal) {
      return null;
    }

    if (activePlanDecision?.status === "rejected") {
      return {
        key: "proposal",
        targetSection: "proposal",
        label: "PLAN::REJECTED",
        detail: activeDiagramProposal.proposal.summary,
        tone: "caution",
        isFresh: viewportSectionsUnseen.proposal,
      };
    }

    const warningCount = activeDiagramProposal.proposal.warnings.length;
    const highestRisk = activeMutationPlan?.plan.highestRisk ?? (warningCount > 0 ? "medium" : "low");
    const tone = toProposalChromeTone(highestRisk);

    if (warningCount > 0 && !activeMutationPlan) {
      return {
        key: "proposal",
        targetSection: "proposal",
        label: `PLAN::WARN ${warningCount}`,
        detail: activeDiagramProposal.proposal.summary,
        tone: "caution",
        isFresh: viewportSectionsUnseen.proposal,
      };
    }

    return {
      key: "proposal",
      targetSection: "proposal",
      label: activeMutationPlan
        ? `PLAN::${highestRisk.toUpperCase()} ${activeMutationPlan.plan.totalActions}A`
        : `PLAN::${highestRisk.toUpperCase()}`,
      detail: activeDiagramProposal.proposal.summary,
      tone,
      isFresh: viewportSectionsUnseen.proposal,
    };
  }, [
    activeDiagramProposal,
    activeMutationPlan,
    activePlanDecision?.status,
    viewportSectionsUnseen.proposal,
  ]);
  const checkpointChromeSignal = useMemo<OpyWidgetChromeSignal | null>(() => {
    if (!latestCheckpoint) {
      return null;
    }

    const preview = checkpointRestorePreviewById.get(latestCheckpoint.id) ?? null;
    const hasRemovalImpact = preview
      ? preview.counts.removeNodes + preview.counts.removeEdges > 0
      : false;

    return {
      key: "checkpoint",
      targetSection: "checkpoints",
      label: preview
        ? preview.hasChanges
          ? `RESTORE::${preview.impactedEntities.length}Δ`
          : "RESTORE::SYNC"
        : `RESTORE::${latestCheckpoint.snapshot.nodes.length}N`,
      detail: preview
        ? preview.hasChanges
          ? `${preview.impactedEntities.length} board change(s) differ from the latest checkpoint snapshot.`
          : "Current board already matches the latest checkpoint snapshot."
        : latestCheckpoint.snapshot.name,
      tone: preview
        ? preview.hasChanges
          ? hasRemovalImpact ? "critical" : "caution"
          : "ready"
        : "neutral",
      isFresh: viewportSectionsUnseen.checkpoints,
    };
  }, [checkpointRestorePreviewById, latestCheckpoint, viewportSectionsUnseen.checkpoints]);
  const chromeStatus = useMemo<OpyWidgetChromeStatus>(() => {
    const priorities: Record<OpyWidgetChromeSignal["key"], number> = {
      review: 0,
      proposal: 1,
      checkpoint: 2,
      policy: 3,
    };
    const signals = [
      reviewChromeSignal,
      proposalChromeSignal,
      checkpointChromeSignal,
      policyChromeSignal,
    ]
      .filter((signal): signal is OpyWidgetChromeSignal => signal !== null)
      .sort((left, right) => {
        const toneDelta = compareOpyWidgetChromeTone(left.tone, right.tone);
        if (toneDelta !== 0) {
          return toneDelta;
        }
        if (left.isFresh !== right.isFresh) {
          return left.isFresh ? -1 : 1;
        }
        return priorities[left.key] - priorities[right.key];
      });

    return {
      frameTone: signals.reduce<OpyWidgetChromeTone>(
        (current, signal) => pickHigherOpyWidgetChromeTone(current, signal.tone),
        "neutral",
      ),
      signals,
    };
  }, [checkpointChromeSignal, policyChromeSignal, proposalChromeSignal, reviewChromeSignal]);
  const controlSectionTone = policyChromeSignal?.tone ?? "neutral";
  const diagnosticsSectionTone = latestRun?.status === "failed"
    ? "critical"
    : latestDiagnosticsSurface?.context.confidence === "low"
    ? "caution"
    : latestDiagnosticsSurface
    ? "ready"
    : "neutral";
  const checkpointsSectionTone = checkpointChromeSignal?.tone ?? "neutral";
  const reviewSectionTone = reviewChromeSignal?.tone ?? "neutral";
  const proposalSectionTone = proposalChromeSignal?.tone ?? "neutral";

  useEffect(() => {
    onChromeStatusChange(chromeStatus);
  }, [chromeStatus, onChromeStatusChange]);

  const resolveRigAgentContext = useCallback(
    async (focus: string | null): Promise<RigAgentContextBundle> =>
      runEffect(
        assembleRigAgentContext({
          boardSummary,
          boardContext,
          focus,
        }),
      ),
    [boardContext, boardSummary, runEffect],
  );

  useEffect(() => {
    selectedSessionIdRef.current = selectedSessionId;
  }, [selectedSessionId]);

  useEffect(() => {
    pendingViewportBaselineRef.current = true;
    setViewportSectionsUnseen(EMPTY_VIEWPORT_SECTION_STATE);
    setExpandedTaskIds([]);
  }, [selectedSessionId]);

  useEffect(() => {
    let isCancelled = false;

    void Effect.runPromise(getRigSecretStatus())
      .then((status) => {
        if (isCancelled) {
          return;
        }

        setHasOpenAiApiKey(status.configured);
        setAgentSecretStatus("ready");
      })
      .catch(() => {
        if (isCancelled) {
          return;
        }

        setHasOpenAiApiKey(false);
        setAgentSecretStatus("error");
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    setSessionTitleDraft(selectedSession?.title ?? "");
  }, [selectedSessionId, selectedSession?.title]);

  const sessionOptions = useMemo(
    () =>
      sessions.map((session) => ({
        value: session.id,
        label: `${session.title} · ${formatClockTime(session.lastMessageAt ?? session.updatedAt)}`,
      })),
    [sessions],
  );

  const loadTasksForSessions = useCallback(
    async (sessionIds: readonly string[]): Promise<Readonly<Record<string, ReadonlyArray<OpyAgentTask>>>> => {
      const uniqueSessionIds = [...new Set(sessionIds)].filter((sessionId) => sessionId.length > 0);
      const missingSessionIds = uniqueSessionIds.filter((sessionId) => tasksBySessionId[sessionId] === undefined);

      if (missingSessionIds.length === 0) {
        return {};
      }

      const loadedEntries = await Promise.all(
        missingSessionIds.map(async (sessionId) => [sessionId, await runEffect(listOpyAgentTasks(sessionId))] as const),
      );
      const loadedTasksBySessionId = Object.fromEntries(loadedEntries);

      agentTaskIndexRef.current = {
        ...agentTaskIndexRef.current,
        ...Object.fromEntries(
          loadedEntries.flatMap(([, loadedTasks]) => loadedTasks.map((task) => [task.id, task] as const)),
        ),
      };
      setTasksBySessionId((current) => ({
        ...current,
        ...loadedTasksBySessionId,
      }));

      return loadedTasksBySessionId;
    },
    [runEffect, tasksBySessionId],
  );

  const compatibleTasks = useMemo(
    () => compatibleSessionIds.flatMap((sessionId) => tasksBySessionId[sessionId] ?? []),
    [compatibleSessionIds, tasksBySessionId],
  );

  const loadOpyTaskDetails = useCallback(
    async (taskId: string): Promise<{
      readonly artifacts: ReadonlyArray<OpyAgentArtifact>;
      readonly toolCalls: ReadonlyArray<OpyAgentToolCall>;
    }> => {
      const [toolCalls, artifacts] = await Promise.all([
        runEffect(listOpyAgentToolCalls(taskId)),
        runEffect(listOpyAgentArtifacts(taskId)),
      ]);

      return {
        artifacts,
        toolCalls,
      };
    },
    [runEffect],
  );

  const hydratePersistedTaskContext = useCallback(
    (task: OpyAgentTask, artifacts: readonly OpyAgentArtifact[]): void => {
      const latestChatArtifact = selectLatestTaskArtifact(artifacts, "chat_response");
      if (latestChatArtifact && isGroundedChatResponsePayload(latestChatArtifact.payload)) {
        const groundedChat = latestChatArtifact.payload;
        setGroundedChatsBySessionId((current) => ({
          ...current,
          [task.sessionId]: groundedChat,
        }));
      }

      const reviewReplay = task.request.replay;
      const latestReviewArtifact = selectLatestTaskArtifact(artifacts, "board_review");
      if (
        latestReviewArtifact
        && isGroundedBoardReviewPayload(latestReviewArtifact.payload)
        && reviewReplay.kind === "review"
      ) {
        const groundedReview = latestReviewArtifact.payload;
        setBoardReviewsBySessionId((current) => ({
          ...current,
          [task.sessionId]: {
            command: {
              kind: "review-c4-board",
              focus: reviewReplay.focus,
            },
            review: groundedReview.review,
            context: groundedReview.context,
          },
        }));
      }

      const proposalReplay = task.request.replay;
      const latestProposalArtifact = selectLatestTaskArtifact(artifacts, "diagram_proposal");
      if (
        latestProposalArtifact
        && isGroundedDiagramProposalPayload(latestProposalArtifact.payload)
        && proposalReplay.kind === "proposal"
      ) {
        const groundedProposal = latestProposalArtifact.payload;
        const restoredProposal: OpySessionDiagramProposal = {
          command: {
            kind: "plan-c4-diagram",
            description: proposalReplay.description,
          },
          proposal: groundedProposal.proposal,
          context: groundedProposal.context,
          decisionStatus: "pending",
          decidedAtMs: task.updatedAt,
        };

        setDiagramProposalHistoryBySessionId((current) => ({
          ...current,
          [task.sessionId]: upsertSessionDiagramProposalHistory(
            current[task.sessionId] ?? [],
            restoredProposal,
          ),
        }));
      }
    },
    [],
  );

  const hydratePersistedTaskLineageContext = useCallback(
    (
      tasks: readonly OpyAgentTask[],
      artifactsByTaskId: Readonly<Record<string, ReadonlyArray<OpyAgentArtifact> | undefined>>,
    ): void => {
      for (const lineageTask of tasks) {
        hydratePersistedTaskContext(lineageTask, artifactsByTaskId[lineageTask.id] ?? []);
      }
    },
    [hydratePersistedTaskContext],
  );

  const loadTaskLineageDetails = useCallback(
    async (task: OpyAgentTask): Promise<{
      readonly artifactsByTaskId: Readonly<Record<string, ReadonlyArray<OpyAgentArtifact> | undefined>>;
      readonly lineageTasks: ReadonlyArray<OpyAgentTask>;
    }> => {
      const loadedRelatedTasksBySessionId = await loadTasksForSessions([
        ...compatibleSessionIds,
        task.sessionId,
      ]);
      const continuityTasks = [...new Set([...compatibleSessionIds, task.sessionId])]
        .flatMap((sessionId) => loadedRelatedTasksBySessionId[sessionId] ?? tasksBySessionId[sessionId] ?? []);
      const lineageTasks = buildOpyAgentTaskLineage(continuityTasks, task);
      const missingLineageTasks = lineageTasks.filter((lineageTask) =>
        !taskToolCallsByTaskId[lineageTask.id] || !taskArtifactsByTaskId[lineageTask.id]
      );
      const loadedLineageDetails = missingLineageTasks.length > 0
        ? await Promise.all(
          missingLineageTasks.map(async (lineageTask) => ({
            taskId: lineageTask.id,
            details: await loadOpyTaskDetails(lineageTask.id),
          })),
        )
        : [];

      const nextArtifactsByTaskId = {
        ...taskArtifactsByTaskId,
        ...Object.fromEntries(
          loadedLineageDetails.map(({ taskId, details }) => [taskId, details.artifacts] as const),
        ),
      };

      if (loadedLineageDetails.length > 0) {
        setTaskToolCallsByTaskId((current) => ({
          ...current,
          ...Object.fromEntries(
            loadedLineageDetails.map(({ taskId, details }) => [taskId, details.toolCalls] as const),
          ),
        }));
        setTaskArtifactsByTaskId((current) => ({
          ...current,
          ...Object.fromEntries(
            loadedLineageDetails.map(({ taskId, details }) => [taskId, details.artifacts] as const),
          ),
        }));
      }

      return {
        artifactsByTaskId: nextArtifactsByTaskId,
        lineageTasks,
      };
    },
    [
      compatibleSessionIds,
      loadOpyTaskDetails,
      loadTasksForSessions,
      taskArtifactsByTaskId,
      taskToolCallsByTaskId,
      tasksBySessionId,
    ],
  );

  const activateResumableTask = useCallback(
    async (task: OpyAgentTask): Promise<void> => {
      if (!isResumableTaskStage(task.stage)) {
        return;
      }

      try {
        const { artifactsByTaskId, lineageTasks } = await loadTaskLineageDetails(task);
        hydratePersistedTaskLineageContext(lineageTasks, artifactsByTaskId);
      } catch (error) {
        setRuntimeError(`TASK RESUME CONTEXT RESTORE FAILED: ${toErrorMessage(error)}`);
      }

      setResumableTaskPreferenceBySessionId((current) => ({
        ...current,
        [task.sessionId]: task.id,
      }));
      agentLifecycle.hydrateResumableRequest({
        request: task.request,
        stage: task.stage,
        taskId: task.id,
        updatedAt: task.updatedAt,
      });
    },
    [
      agentLifecycle,
      hydratePersistedTaskLineageContext,
      loadTaskLineageDetails,
    ],
  );

  const getTaskResumeTrail = useCallback(
    (taskId: string): {
      readonly artifacts: ReadonlyArray<OpyAgentArtifact>;
      readonly toolCalls: ReadonlyArray<OpyAgentToolCall>;
    } => {
      const task = agentTaskIndexRef.current[taskId];
      if (!task) {
        return {
          artifacts: taskArtifactsByTaskId[taskId] ?? [],
          toolCalls: taskToolCallsByTaskId[taskId] ?? [],
        };
      }

      const lineageTasks = buildOpyAgentTaskLineage(compatibleTasks, task);
      return {
        artifacts: lineageTasks.flatMap((lineageTask) => taskArtifactsByTaskId[lineageTask.id] ?? []),
        toolCalls: lineageTasks.flatMap((lineageTask) => taskToolCallsByTaskId[lineageTask.id] ?? []),
      };
    },
    [compatibleTasks, taskArtifactsByTaskId, taskToolCallsByTaskId],
  );

  const getTaskLineageDiagnostics = useCallback(
    (task: OpyAgentTask) => {
      const lineageTasks = buildOpyAgentTaskLineage(compatibleTasks, task);
      const lineageArtifacts = lineageTasks.flatMap((lineageTask) => taskArtifactsByTaskId[lineageTask.id] ?? []);
      const lineageToolCalls = lineageTasks.flatMap((lineageTask) => taskToolCallsByTaskId[lineageTask.id] ?? []);

      return summarizeOpyAgentTaskLineage(compatibleTasks, task, lineageToolCalls, lineageArtifacts);
    },
    [compatibleTasks, taskArtifactsByTaskId, taskToolCallsByTaskId],
  );

  const taskHistoryEntries = useMemo<ReadonlyArray<OpyTaskHistoryEntry>>(
    () =>
      activeTasks.map((task) => {
        const resumeTrail = getTaskResumeTrail(task.id);
        const toolCalls = taskToolCallsByTaskId[task.id] ?? [];
        const artifacts = taskArtifactsByTaskId[task.id] ?? [];
        const lineageDiagnostics = getTaskLineageDiagnostics(task);
        const resumePlan = buildTaskResumeBoundaryPlan(task.sessionId, task.request, resumeTrail.toolCalls);
        const persistedResumeOutcome = selectPersistedResumeBoundaryOutcome(artifacts);

        return {
          task,
          resumeTrail,
          toolCalls,
          artifacts,
          lineageDiagnostics,
          resumePlan,
          persistedResumeOutcome,
        } satisfies OpyTaskHistoryEntry;
      }),
    [activeTasks, getTaskLineageDiagnostics, getTaskResumeTrail, taskArtifactsByTaskId, taskToolCallsByTaskId],
  );

  const taskHistoryChainOptions = useMemo<ReadonlyArray<TacticalSelectOption>>(() => {
    const seen = new Set<string>();
    const options: TacticalSelectOption[] = [
      {
        value: TASK_HISTORY_CHAIN_FILTER_ALL,
        label: "ALL CHAINS",
      },
    ];

    for (const entry of taskHistoryEntries) {
      const continuityKey = entry.lineageDiagnostics.continuityKey;
      if (seen.has(continuityKey)) {
        continue;
      }

      seen.add(continuityKey);
      options.push({
        value: continuityKey,
        label: formatTaskHistoryChainFilterLabel(entry.task),
      });
    }

    return options;
  }, [taskHistoryEntries]);

  const filteredTaskHistoryEntries = useMemo(
    () =>
      taskHistoryEntries.filter((entry) => (
        (taskHistoryChainFilter === TASK_HISTORY_CHAIN_FILTER_ALL
          || entry.lineageDiagnostics.continuityKey === taskHistoryChainFilter)
        && matchesTaskHistoryBoundaryFilter(entry.lineageDiagnostics.resumeOutcomeRollup, taskHistoryBoundaryFilter)
      )),
    [taskHistoryBoundaryFilter, taskHistoryChainFilter, taskHistoryEntries],
  );

  const commitTaskHistoryFilterState = useCallback(
    (nextState: OpyTaskHistoryFilterState) => {
      if (!selectedSessionId) {
        return;
      }

      onTaskHistoryFiltersBySessionChange({
        ...taskHistoryFiltersBySession,
        [selectedSessionId]: nextState,
      });
    },
    [onTaskHistoryFiltersBySessionChange, selectedSessionId, taskHistoryFiltersBySession],
  );

  useEffect(() => {
    if (
      taskHistoryChainFilter !== TASK_HISTORY_CHAIN_FILTER_ALL
      && !taskHistoryChainOptions.some((option) => option.value === taskHistoryChainFilter)
    ) {
      setTaskHistoryChainFilter(TASK_HISTORY_CHAIN_FILTER_ALL);
      commitTaskHistoryFilterState({
        chain: TASK_HISTORY_CHAIN_FILTER_ALL,
        boundary: taskHistoryBoundaryFilter,
      });
    }
  }, [commitTaskHistoryFilterState, taskHistoryBoundaryFilter, taskHistoryChainFilter, taskHistoryChainOptions]);

  const hydrateMessagesForSession = useCallback(
    async (sessionId: string) => {
      setIsMessageLoading(true);
      try {
        const interruptedRuns = await runEffect(
          finalizeInterruptedOpyAgentRuns({
            sessionId,
            errorSummary: "INTERRUPTED DURING PREVIOUS SESSION.",
          }),
        );
        interruptedRuns.forEach(emitOpyAgentRunTelemetry);
        await runEffect(
          interruptOpyAgentTasks({
            sessionId,
            errorSummary: "INTERRUPTED DURING PREVIOUS SESSION.",
          }),
        );
        await runEffect(
          interruptOpyAgentToolCalls({
            sessionId,
            errorSummary: "INTERRUPTED DURING PREVIOUS SESSION.",
          }),
        );
        const loadedMessages = await runEffect(listOpyChatMessages(sessionId));
        const loadedRuns = await runEffect(listOpyAgentRuns(sessionId));
        const loadedTasks = await runEffect(listOpyAgentTasks(sessionId));
        const loadedProposals = await runEffect(listOpyDiagramProposals(sessionId));
        const loadedCheckpoints = await runEffect(listOpyAgentCheckpoints(sessionId));
        agentTaskIndexRef.current = {
          ...agentTaskIndexRef.current,
          ...Object.fromEntries(loadedTasks.map((task) => [task.id, task])),
        };
        setMessages(loadedMessages);
        setRunsBySessionId((current) => ({
          ...current,
          [sessionId]: loadedRuns,
        }));
        setTasksBySessionId((current) => ({
          ...current,
          [sessionId]: loadedTasks,
        }));
        setDiagramProposalHistoryBySessionId((current) => ({
          ...current,
          [sessionId]: loadedProposals.map(toSessionDiagramProposal),
        }));
        setCheckpointsBySessionId((current) => ({
          ...current,
          [sessionId]: loadedCheckpoints,
        }));
        const resumableCandidates = selectLatestOpyAgentTasksByLineage(
          loadedTasks.filter((task) => task.status === "interrupted" && isResumableTaskStage(task.stage)),
        );
        const preferredResumableTaskId = resumableTaskPreferenceBySessionId[sessionId];
        const resumableTask = preferredResumableTaskId
          ? resumableCandidates.find((task) => task.id === preferredResumableTaskId) ?? resumableCandidates[0] ?? null
          : resumableCandidates[0] ?? null;
        if (resumableTask) {
          await activateResumableTask(resumableTask);
        } else {
          agentLifecycle.clearResumableRequest();
        }
      } catch (error) {
        setRuntimeError(`FAILED TO LOAD TRANSCRIPT: ${toErrorMessage(error)}`);
        setMessages([]);
        setRunsBySessionId((current) => ({
          ...current,
          [sessionId]: [],
        }));
        setTasksBySessionId((current) => ({
          ...current,
          [sessionId]: [],
        }));
        setDiagramProposalHistoryBySessionId((current) => ({
          ...current,
          [sessionId]: [],
        }));
        setCheckpointsBySessionId((current) => ({
          ...current,
          [sessionId]: [],
        }));
        agentLifecycle.clearResumableRequest();
      } finally {
        setIsMessageLoading(false);
      }
    },
    [activateResumableTask, agentLifecycle, resumableTaskPreferenceBySessionId, runEffect],
  );

  useEffect(() => {
    const missingRelatedSessionIds = compatibleSessionIds.filter((sessionId) =>
      sessionId !== selectedSessionId && tasksBySessionId[sessionId] === undefined
    );

    if (missingRelatedSessionIds.length === 0) {
      return;
    }

    void loadTasksForSessions(missingRelatedSessionIds).catch((error) => {
      setRuntimeError(`RELATED TASK LOAD FAILED: ${toErrorMessage(error)}`);
    });
  }, [compatibleSessionIds, loadTasksForSessions, selectedSessionId, tasksBySessionId]);

  useEffect(() => {
    if (selectedSessionId.length === 0 || activeInterruptedTasks.length === 0) {
      return;
    }

    const missingQueueTask = activeInterruptedTasks.find((task) => {
      const lineageTasks = buildOpyAgentTaskLineage(compatibleTasks, task);
      return lineageTasks.some((lineageTask) =>
        !taskToolCallsByTaskId[lineageTask.id] || !taskArtifactsByTaskId[lineageTask.id]
      );
    });

    if (!missingQueueTask) {
      return;
    }

    void loadTaskLineageDetails(missingQueueTask).catch((error) => {
      setRuntimeError(`TASK LINEAGE LOAD FAILED: ${toErrorMessage(error)}`);
    });
  }, [
    activeInterruptedTasks,
    compatibleTasks,
    loadTaskLineageDetails,
    selectedSessionId,
    taskArtifactsByTaskId,
    taskToolCallsByTaskId,
  ]);

  const refreshCheckpointsForSession = useCallback(
    async (sessionId: string) => {
      const loadedCheckpoints = await runEffect(listOpyAgentCheckpoints(sessionId));
      setCheckpointsBySessionId((current) => ({
        ...current,
        [sessionId]: loadedCheckpoints,
      }));
    },
    [runEffect],
  );

  const beginAgentRun = useCallback(
    async (
      sessionId: string,
      intent: OpyAgentRunIntent,
    ): Promise<OpyAgentRun> => {
      const run = await runEffect(
        createOpyAgentRun({
          id: createRunId(),
          sessionId,
          agent: "opy-net",
          intent,
          stage: "invoke",
          status: "running",
          startedAt: Date.now(),
          completedAt: null,
          errorSummary: null,
        }),
      );

      setRunsBySessionId((current) => ({
        ...current,
        [sessionId]: upsertSessionRun(current[sessionId] ?? [], run),
      }));

      return run;
    },
    [runEffect],
  );

  const transitionAgentRun = useCallback(
    async (
      currentRun: OpyAgentRun,
      patch: Partial<Pick<OpyAgentRun, "stage" | "status" | "completedAt" | "errorSummary">>,
    ): Promise<OpyAgentRun> => {
      const nextRun: OpyAgentRun = {
        ...currentRun,
        ...patch,
      };

      await runEffect(updateOpyAgentRun(nextRun));
      setRunsBySessionId((current) => ({
        ...current,
        [nextRun.sessionId]: upsertSessionRun(current[nextRun.sessionId] ?? [], nextRun),
      }));

      if (nextRun.status !== "running") {
        emitOpyAgentRunTelemetry(nextRun);
      }

      return nextRun;
    },
    [runEffect],
  );

  const persistOpyTask = useCallback(
    async (task: OpyAgentTask): Promise<OpyAgentTask> => {
      const existing = agentTaskIndexRef.current[task.id];
      const lineageKey = existing?.lineageKey ?? task.lineageKey ?? deriveOpyAgentTaskLineageKey(task.request);
      const predecessor = existing
        ? null
        : findOpyAgentTaskLineagePredecessor(compatibleTasks, {
          ...task,
          lineageKey,
          parentTaskId: task.parentTaskId ?? null,
        });
      const nextTask: OpyAgentTask = {
        ...task,
        lineageKey,
        parentTaskId: existing?.parentTaskId ?? task.parentTaskId ?? predecessor?.id ?? null,
      };
      const persisted = await runEffect(upsertOpyAgentTask(nextTask));
      agentTaskIndexRef.current = {
        ...agentTaskIndexRef.current,
        [persisted.id]: persisted,
      };
      setTasksBySessionId((current) => ({
        ...current,
        [persisted.sessionId]: upsertSessionTask(current[persisted.sessionId] ?? [], persisted),
      }));
      return persisted;
    },
    [compatibleTasks, runEffect],
  );

  const warnOpyTracePersistFailure = useCallback((scope: string, error: unknown) => {
    console.warn(`[opy-trace] ${scope} persistence failed`, error);
  }, []);

  const persistOpyToolCall = useCallback(
    async (toolCall: OpyAgentToolCall): Promise<OpyAgentToolCall | null> => {
      try {
        const persisted = await runEffect(upsertOpyAgentToolCall(toolCall));
        setTaskToolCallsByTaskId((current) => ({
          ...current,
          [persisted.taskId]: upsertTaskToolCall(current[persisted.taskId] ?? [], persisted),
        }));
        return persisted;
      } catch (error) {
        warnOpyTracePersistFailure(`tool call ${toolCall.name}`, error);
        return null;
      }
    },
    [runEffect, warnOpyTracePersistFailure],
  );

  const createOpyTaskArtifact = useCallback(
    async (input: {
      readonly taskId: string;
      readonly sessionId: string;
      readonly toolCallId: string | null;
      readonly draft: OpyTaskArtifactDraft;
    }): Promise<OpyAgentArtifact | null> => {
      const artifact: OpyAgentArtifact = {
        id: createMessageId(),
        taskId: input.taskId,
        sessionId: input.sessionId,
        toolCallId: input.toolCallId,
        kind: input.draft.kind,
        summary: input.draft.summary,
        payload: input.draft.payload,
        createdAt: Date.now(),
      };

      try {
        const persisted = await runEffect(createOpyAgentArtifact(artifact));
        setTaskArtifactsByTaskId((current) => ({
          ...current,
          [persisted.taskId]: upsertTaskArtifact(current[persisted.taskId] ?? [], persisted),
        }));
        return persisted;
      } catch (error) {
        warnOpyTracePersistFailure(`artifact ${artifact.kind}`, error);
        return null;
      }
    },
    [runEffect, warnOpyTracePersistFailure],
  );

  const persistResumeBoundaryOutcomeArtifact = useCallback(
    async (input: {
      readonly taskId: string;
      readonly sessionId: string;
      readonly payload: OpyPersistedResumeBoundaryOutcomePayload;
    }): Promise<void> => {
      await createOpyTaskArtifact({
        taskId: input.taskId,
        sessionId: input.sessionId,
        toolCallId: null,
        draft: createResumeBoundaryOutcomeArtifactDraft(input.payload),
      });
    },
    [createOpyTaskArtifact],
  );

  const trackOpyTaskToolCall = useCallback(
    async <T,>(
      input: {
        readonly taskId: string;
        readonly sessionId: string;
        readonly name: OpyAgentToolCallName;
        readonly inputSummary: string | null;
        readonly execute: () => Promise<T>;
        readonly outputSummary?: (value: T) => string | null;
        readonly artifacts?: (value: T, toolCallId: string) => ReadonlyArray<OpyTaskArtifactDraft>;
      },
    ): Promise<T> => {
      const startedAt = Date.now();
      const toolCallId = createMessageId();
      await persistOpyToolCall({
        id: toolCallId,
        taskId: input.taskId,
        sessionId: input.sessionId,
        name: input.name,
        status: "running",
        startedAt,
        updatedAt: startedAt,
        completedAt: null,
        inputSummary: input.inputSummary,
        outputSummary: null,
        errorSummary: null,
      });

      try {
        const result = await input.execute();
        const completedAt = Date.now();
        await persistOpyToolCall({
          id: toolCallId,
          taskId: input.taskId,
          sessionId: input.sessionId,
          name: input.name,
          status: "completed",
          startedAt,
          updatedAt: completedAt,
          completedAt,
          inputSummary: input.inputSummary,
          outputSummary: input.outputSummary?.(result) ?? null,
          errorSummary: null,
        });

        const artifacts = input.artifacts?.(result, toolCallId) ?? [];
        for (const artifact of artifacts) {
          await createOpyTaskArtifact({
            taskId: input.taskId,
            sessionId: input.sessionId,
            toolCallId,
            draft: artifact,
          });
        }

        return result;
      } catch (error) {
        const completedAt = Date.now();
        await persistOpyToolCall({
          id: toolCallId,
          taskId: input.taskId,
          sessionId: input.sessionId,
          name: input.name,
          status: "failed",
          startedAt,
          updatedAt: completedAt,
          completedAt,
          inputSummary: input.inputSummary,
          outputSummary: null,
          errorSummary: toErrorMessage(error),
        });
        throw error;
      }
    },
    [createOpyTaskArtifact, persistOpyToolCall],
  );

  const interruptActiveLifecycleTask = useCallback(
    async (errorSummary: string): Promise<void> => {
      const activeRequest = agentLifecycle.activeRequest;
      if (
        !activeRequest || agentLifecycle.stage === "idle" || agentLifecycle.stage === "completed"
        || agentLifecycle.stage === "failed"
      ) {
        return;
      }

      const existingTask = agentTaskIndexRef.current[activeRequest.id];
      const now = Date.now();
      await persistOpyTask({
        id: activeRequest.id,
        sessionId: activeRequest.replay.sessionId,
        request: activeRequest,
        stage: agentLifecycle.stage,
        status: "interrupted",
        createdAt: existingTask?.createdAt ?? now,
        updatedAt: now,
        completedAt: null,
        errorSummary,
      });
    },
    [agentLifecycle.activeRequest, agentLifecycle.stage, persistOpyTask],
  );

  const dismissResumableLifecycleTask = useCallback(
    async (errorSummary: string): Promise<void> => {
      const resumableRequest = agentLifecycle.resumableRequest;
      const resumableStage = agentLifecycle.resumableStage;
      const resumableTaskId = agentLifecycle.resumableTaskId;
      if (!resumableRequest || !resumableStage || !resumableTaskId) {
        return;
      }

      const existingTask = agentTaskIndexRef.current[resumableTaskId];
      const completedAt = Date.now();
      await persistOpyTask({
        id: resumableTaskId,
        sessionId: resumableRequest.replay.sessionId,
        request: resumableRequest,
        stage: resumableStage,
        status: "cancelled",
        createdAt: existingTask?.createdAt ?? completedAt,
        updatedAt: completedAt,
        completedAt,
        errorSummary,
      });
      agentLifecycle.clearResumableRequest();
    },
    [
      agentLifecycle.clearResumableRequest,
      agentLifecycle.resumableRequest,
      agentLifecycle.resumableStage,
      agentLifecycle.resumableTaskId,
      persistOpyTask,
    ],
  );

  const hydrateOpyTaskDetails = useCallback(
    async (taskId: string): Promise<void> => {
      setTaskDetailLoadingByTaskId((current) => ({
        ...current,
        [taskId]: true,
      }));

      try {
        const task = agentTaskIndexRef.current[taskId];
        if (task) {
          await loadTaskLineageDetails(task);
        } else {
          const { toolCalls: loadedToolCalls, artifacts: loadedArtifacts } = await loadOpyTaskDetails(taskId);

          setTaskToolCallsByTaskId((current) => ({
            ...current,
            [taskId]: loadedToolCalls,
          }));
          setTaskArtifactsByTaskId((current) => ({
            ...current,
            [taskId]: loadedArtifacts,
          }));
        }
      } catch (error) {
        setRuntimeError(`TASK DETAIL LOAD FAILED: ${toErrorMessage(error)}`);
      } finally {
        setTaskDetailLoadingByTaskId((current) => ({
          ...current,
          [taskId]: false,
        }));
      }
    },
    [loadOpyTaskDetails, loadTaskLineageDetails],
  );

  const toggleExpandedTask = useCallback((taskId: string) => {
    setExpandedTaskIds((current) => {
      const isExpanded = current.includes(taskId);
      return isExpanded
        ? current.filter((id) => id !== taskId)
        : [...current, taskId];
    });
  }, []);

  useEffect(() => {
    const previousState = lifecycleTaskSyncRef.current;
    const nextState = {
      activeRequestId: agentLifecycle.activeRequest?.id ?? null,
      errorSummary: agentLifecycle.lastError,
      lastCompletedAt: agentLifecycle.lastCompletedAt,
      lastRequestId: agentLifecycle.lastRequest?.id ?? null,
      stage: agentLifecycle.stage,
      terminalStatus: agentLifecycle.lastTerminalStatus,
    };

    const activeRequest = agentLifecycle.activeRequest;
    const isRunningStage = agentLifecycle.stage !== "idle"
      && agentLifecycle.stage !== "completed"
      && agentLifecycle.stage !== "failed";
    if (
      isRunningStage
      && activeRequest
      && (
        previousState.stage !== nextState.stage
        || previousState.activeRequestId !== nextState.activeRequestId
      )
    ) {
      const now = Date.now();
      const existingTask = agentTaskIndexRef.current[activeRequest.id];
      void persistOpyTask({
        id: activeRequest.id,
        sessionId: activeRequest.replay.sessionId,
        request: activeRequest,
        stage: agentLifecycle.stage,
        status: "running",
        createdAt: existingTask?.createdAt ?? now,
        updatedAt: now,
        completedAt: null,
        errorSummary: null,
      }).catch((error) => {
        setRuntimeError(`TASK PERSIST FAILED: ${toErrorMessage(error)}`);
      });
    }

    const lastRequest = agentLifecycle.lastRequest;
    const isTerminalStage = agentLifecycle.stage === "completed" || agentLifecycle.stage === "failed";
    if (
      isTerminalStage
      && lastRequest
      && agentLifecycle.lastTerminalStatus
      && (
        previousState.stage !== nextState.stage
        || previousState.lastRequestId !== nextState.lastRequestId
        || previousState.lastCompletedAt !== nextState.lastCompletedAt
        || previousState.terminalStatus !== nextState.terminalStatus
        || previousState.errorSummary !== nextState.errorSummary
      )
    ) {
      const completedAt = agentLifecycle.lastCompletedAt ?? Date.now();
      const existingTask = agentTaskIndexRef.current[lastRequest.id];
      void persistOpyTask({
        id: lastRequest.id,
        sessionId: lastRequest.replay.sessionId,
        request: lastRequest,
        stage: agentLifecycle.stage,
        status: agentLifecycle.lastTerminalStatus,
        createdAt: existingTask?.createdAt ?? completedAt,
        updatedAt: completedAt,
        completedAt,
        errorSummary: agentLifecycle.lastTerminalStatus === "failed"
          ? agentLifecycle.lastError
          : null,
      }).catch((error) => {
        setRuntimeError(`TASK PERSIST FAILED: ${toErrorMessage(error)}`);
      });
    }

    lifecycleTaskSyncRef.current = nextState;
  }, [
    agentLifecycle.activeRequest,
    agentLifecycle.lastCompletedAt,
    agentLifecycle.lastError,
    agentLifecycle.lastRequest,
    agentLifecycle.lastTerminalStatus,
    agentLifecycle.stage,
    persistOpyTask,
  ]);

  const persistOpyMessage = useCallback(
    async (
      sessionId: string,
      role: OpyChatRole,
      content: string,
    ): Promise<OpyPersistMessageResult | null> => {
      const normalizedContent = content.trim();
      if (normalizedContent.length === 0) {
        return null;
      }

      const message: OpyChatMessage = {
        id: createMessageId(),
        sessionId,
        role,
        content: normalizedContent,
        createdAt: Date.now(),
      };

      setMessages((current) => selectedSessionIdRef.current === sessionId ? [...current, message] : current);

      try {
        await runEffect(appendOpyChatMessage(message));
        setSessions((current) =>
          sortSessionsByRecency(
            current.map((session) =>
              session.id === sessionId
                ? {
                  ...session,
                  updatedAt: message.createdAt,
                  lastMessageAt: message.createdAt,
                }
                : session
            ),
          )
        );
        return {
          ok: true,
          message,
        };
      } catch (error) {
        const errorMessage = `MESSAGE SAVE FAILED: ${toErrorMessage(error)}`;
        setRuntimeError(errorMessage);
        return {
          ok: false,
          errorMessage,
          message,
        };
      }
    },
    [runEffect],
  );

  const appendAndPersistMessage = useCallback(
    async (
      sessionId: string,
      role: OpyChatRole,
      content: string,
    ): Promise<OpyChatMessage | null> => {
      const persisted = await persistOpyMessage(sessionId, role, content);
      if (!persisted || !persisted.ok) {
        return null;
      }

      return persisted.message;
    },
    [persistOpyMessage],
  );

  const appendAgentNotice = useCallback(
    async (
      sessionId: string,
      error: ReturnType<typeof makeAgentConfigError> | ReturnType<typeof makeAgentPolicyError>,
    ) => {
      await appendAndPersistMessage(sessionId, "system", summarizeAgentError(error));
    },
    [appendAndPersistMessage],
  );

  const executeRigRun = useCallback(
    async <T,>(
      input: {
        readonly lifecycleRequest: OpyAgentLifecycleRequest;
        readonly manageLifecycleStart?: boolean;
        readonly sessionId: string;
        readonly intent: OpyAgentRunIntent;
        readonly contextualize: () => Promise<RigAgentContextBundle>;
        readonly execute: (context: RigAgentContextBundle) => Promise<T>;
        readonly assistantMessage: (result: T) => string;
        readonly failurePrefix: string;
        readonly artifactsForResult?: (result: T) => ReadonlyArray<OpyTaskArtifactDraft>;
        readonly onAfterPersisted?: (result: T) => void | Promise<void>;
      },
    ): Promise<T | null> => {
      const taskId = input.lifecycleRequest.id;
      if (input.manageLifecycleStart !== false) {
        if (agentLifecycle.resumableTaskId && agentLifecycle.resumableTaskId !== input.lifecycleRequest.id) {
          await dismissResumableLifecycleTask("SUPERSEDED BY NEW TASK.");
        }
        agentLifecycle.startReadRequest(input.lifecycleRequest);
      }
      let run: OpyAgentRun;
      try {
        run = await beginAgentRun(input.sessionId, input.intent);
      } catch (error) {
        const envelopeError = makeAgentRuntimeError({
          message: `Run envelope persistence failed: ${toErrorMessage(error)}`,
          stage: "persist",
          recommendedAction: "Check local database runtime status and retry.",
          cause: error,
        });
        setRuntimeError(formatAgentError(envelopeError));
        await appendAndPersistMessage(
          input.sessionId,
          "system",
          summarizeAgentError(envelopeError),
        );
        agentLifecycle.failActiveRequest(formatAgentError(envelopeError), "contextualizing", "persist");
        return null;
      }

      let currentRun = run;
      let resumeBoundaryOutcome = toPersistedResumeBoundaryOutcome(
        buildTaskResumeBoundaryPlan(input.sessionId, input.lifecycleRequest, getTaskResumeTrail(taskId).toolCalls),
      );
      try {
        const resumeTrail = getTaskResumeTrail(taskId);
        const persistedContext = selectReusableCompletedTaskToolCall(
          input.sessionId,
          resumeTrail.toolCalls,
          "assemble_context",
        )
          ? selectPersistedContextBundle(resumeTrail.artifacts)
          : null;
        if (!persistedContext) {
          resumeBoundaryOutcome = markResumeBoundaryReran(resumeBoundaryOutcome, "assemble_context");
        }
        const context = persistedContext ?? await trackOpyTaskToolCall({
          taskId,
          sessionId: input.sessionId,
          name: "assemble_context",
          inputSummary: summarizeInlineText(
            `INTENT::${input.intent} · REQUEST::${input.lifecycleRequest.label}`,
            input.intent,
          ),
          execute: input.contextualize,
          outputSummary: (bundle) =>
            `CONFIDENCE::${bundle.confidence.toUpperCase()} · CITATIONS::${bundle.citations.length}`,
          artifacts: (bundle) => [{
            kind: "context_bundle",
            summary: summarizeInlineText(bundle.confidenceReason, "CONTEXT READY."),
            payload: bundle,
          }],
        });
        agentLifecycle.markContextReady();

        const persistedResult = selectReusableCompletedTaskToolCall(
          input.sessionId,
          resumeTrail.toolCalls,
          "invoke_agent",
        )
          ? selectPersistedReadResultArtifact(input.lifecycleRequest, resumeTrail.artifacts) as T | null
          : null;
        if (!persistedResult) {
          resumeBoundaryOutcome = markResumeBoundaryReran(resumeBoundaryOutcome, "invoke_agent");
        }
        const result = persistedResult ?? await trackOpyTaskToolCall({
          taskId,
          sessionId: input.sessionId,
          name: "invoke_agent",
          inputSummary: summarizeInlineText(
            `${input.lifecycleRequest.kind.toUpperCase()} · ${input.lifecycleRequest.label}`,
            input.lifecycleRequest.label,
          ),
          execute: () => input.execute(context),
          outputSummary: () => `${input.lifecycleRequest.label} RESULT READY`,
          artifacts: (value) => input.artifactsForResult?.(value) ?? [],
        });
        agentLifecycle.markResultReady();
        currentRun = await transitionAgentRun(currentRun, {
          stage: "persist",
        });

        if (selectReusableCompletedTaskToolCall(
          input.sessionId,
          resumeTrail.toolCalls,
          "persist_assistant_message",
        )) {
          await persistResumeBoundaryOutcomeArtifact({
            taskId,
            sessionId: input.sessionId,
            payload: {
              boundaries: resumeBoundaryOutcome,
              requestKind: input.lifecycleRequest.kind,
              updatedAt: Date.now(),
            },
          });
          await input.onAfterPersisted?.(result);
          agentLifecycle.markPersistReady();
          await transitionAgentRun(currentRun, {
            stage: "complete",
            status: "completed",
            completedAt: Date.now(),
            errorSummary: null,
          });
          agentLifecycle.completeActiveRequest();
          return result;
        }

        resumeBoundaryOutcome = markResumeBoundaryReran(resumeBoundaryOutcome, "persist_assistant_message");
        const persistedMessageCallId = createMessageId();
        const persistedMessageStartedAt = Date.now();
        await persistOpyToolCall({
          id: persistedMessageCallId,
          taskId,
          sessionId: input.sessionId,
          name: "persist_assistant_message",
          status: "running",
          startedAt: persistedMessageStartedAt,
          updatedAt: persistedMessageStartedAt,
          completedAt: null,
          inputSummary: "Persist assistant transcript message.",
          outputSummary: null,
          errorSummary: null,
        });
        const persistedMessage = await persistOpyMessage(input.sessionId, "assistant", input.assistantMessage(result));

        if (!persistedMessage) {
          const failedAt = Date.now();
          await persistOpyToolCall({
            id: persistedMessageCallId,
            taskId,
            sessionId: input.sessionId,
            name: "persist_assistant_message",
            status: "failed",
            startedAt: persistedMessageStartedAt,
            updatedAt: failedAt,
            completedAt: failedAt,
            inputSummary: "Persist assistant transcript message.",
            outputSummary: null,
            errorSummary: "Assistant response content was empty.",
          });
          const persistError = makeAgentRuntimeError({
            message: "Assistant response could not be persisted because the content was empty.",
            runId: currentRun.id,
            stage: "persist",
            recommendedAction: "Check local database runtime status and retry.",
          });
          currentRun = await transitionAgentRun(currentRun, {
            status: "failed",
            completedAt: Date.now(),
            errorSummary: summarizeAgentError(persistError),
          });
          await persistResumeBoundaryOutcomeArtifact({
            taskId,
            sessionId: input.sessionId,
            payload: {
              boundaries: resumeBoundaryOutcome,
              requestKind: input.lifecycleRequest.kind,
              updatedAt: Date.now(),
            },
          });
          setRuntimeError(formatAgentError(persistError));
          agentLifecycle.failActiveRequest(formatAgentError(persistError), "proposing", "persist");
          return null;
        }

        if (!persistedMessage.ok) {
          const failedAt = Date.now();
          await persistOpyToolCall({
            id: persistedMessageCallId,
            taskId,
            sessionId: input.sessionId,
            name: "persist_assistant_message",
            status: "failed",
            startedAt: persistedMessageStartedAt,
            updatedAt: failedAt,
            completedAt: failedAt,
            inputSummary: "Persist assistant transcript message.",
            outputSummary: null,
            errorSummary: persistedMessage.errorMessage,
          });
          const persistError = makeAgentRuntimeError({
            message: `Assistant response could not be persisted: ${persistedMessage.errorMessage}`,
            runId: currentRun.id,
            stage: "persist",
            recommendedAction: "Check local database runtime status and retry.",
          });
          currentRun = await transitionAgentRun(currentRun, {
            status: "failed",
            completedAt: Date.now(),
            errorSummary: summarizeAgentError(persistError),
          });
          await persistResumeBoundaryOutcomeArtifact({
            taskId,
            sessionId: input.sessionId,
            payload: {
              boundaries: resumeBoundaryOutcome,
              requestKind: input.lifecycleRequest.kind,
              updatedAt: Date.now(),
            },
          });
          setRuntimeError(formatAgentError(persistError));
          agentLifecycle.failActiveRequest(formatAgentError(persistError), "proposing", "persist");
          return null;
        }

        const persistedAt = Date.now();
        await persistOpyToolCall({
          id: persistedMessageCallId,
          taskId,
          sessionId: input.sessionId,
          name: "persist_assistant_message",
          status: "completed",
          startedAt: persistedMessageStartedAt,
          updatedAt: persistedAt,
          completedAt: persistedAt,
          inputSummary: "Persist assistant transcript message.",
          outputSummary: `MESSAGE::${persistedMessage.message.id.slice(0, 8)}`,
          errorSummary: null,
        });

        await persistResumeBoundaryOutcomeArtifact({
          taskId,
          sessionId: input.sessionId,
          payload: {
            boundaries: resumeBoundaryOutcome,
            requestKind: input.lifecycleRequest.kind,
            updatedAt: Date.now(),
          },
        });
        await input.onAfterPersisted?.(result);
        agentLifecycle.markPersistReady();
        await transitionAgentRun(currentRun, {
          stage: "complete",
          status: "completed",
          completedAt: Date.now(),
          errorSummary: null,
        });
        agentLifecycle.completeActiveRequest();
        return result;
      } catch (error) {
        const agentError = withAgentErrorContext(error, {
          runId: currentRun.id,
          stage: currentRun.stage,
        });
        const errorSummary = summarizeAgentError(agentError);
        setRuntimeError(formatAgentError(agentError));
        await appendAndPersistMessage(
          input.sessionId,
          "system",
          `${input.failurePrefix}: ${errorSummary}`,
        );
        await transitionAgentRun(currentRun, {
          status: "failed",
          completedAt: Date.now(),
          errorSummary,
        });
        await persistResumeBoundaryOutcomeArtifact({
          taskId,
          sessionId: input.sessionId,
          payload: {
            boundaries: resumeBoundaryOutcome,
            requestKind: input.lifecycleRequest.kind,
            updatedAt: Date.now(),
          },
        });
        const failureStage = agentLifecycle.stage === "planning"
          ? "planning"
          : agentLifecycle.stage === "proposing"
          ? "proposing"
          : agentLifecycle.stage === "verifying"
          ? "verifying"
          : "contextualizing";
        const failurePhase = currentRun.stage === "persist" ? "persist" : "invoke";
        agentLifecycle.failActiveRequest(
          formatAgentError(agentError),
          failureStage,
          failurePhase,
        );
        return null;
      }
    },
    [
      agentLifecycle,
      appendAndPersistMessage,
      beginAgentRun,
      dismissResumableLifecycleTask,
      getTaskResumeTrail,
      persistOpyMessage,
      persistOpyToolCall,
      persistResumeBoundaryOutcomeArtifact,
      trackOpyTaskToolCall,
      transitionAgentRun,
    ],
  );

  const executeAppliedBoardAction = useCallback(
    async (input: {
      readonly taskId: string;
      readonly sessionId: string;
      readonly requestKind: OpyAgentLifecycleRequest["kind"];
      readonly initialResumeBoundaryOutcome?: ReadonlyArray<OpyPersistedResumeBoundaryOutcomeItem>;
      readonly failurePrefix: string;
      readonly execute: () => Promise<string>;
      readonly onAfterApplied?: () => Promise<void> | void;
    }): Promise<string | null> => {
      let resumeBoundaryOutcome = input.initialResumeBoundaryOutcome
        ? [...input.initialResumeBoundaryOutcome]
        : toPersistedResumeBoundaryOutcome(
          buildTaskResumeBoundaryPlanForKind(
            input.sessionId,
            input.requestKind,
            getTaskResumeTrail(input.taskId).toolCalls,
          ),
        );
      const failBoardActionLifecycle = async (failure: {
        readonly message: string;
        readonly phase: "apply" | "verify" | "persist";
        readonly stage: Extract<OpyAgentLifecycleStage, "applying" | "verifying">;
      }): Promise<null> => {
        await persistResumeBoundaryOutcomeArtifact({
          taskId: input.taskId,
          sessionId: input.sessionId,
          payload: {
            boundaries: resumeBoundaryOutcome,
            requestKind: input.requestKind,
            updatedAt: Date.now(),
          },
        });
        setRuntimeError(failure.message);
        const persistedFailure = await persistOpyMessage(
          input.sessionId,
          "system",
          `${input.failurePrefix}: ${failure.message}`,
        );
        if (persistedFailure && !persistedFailure.ok) {
          setRuntimeError(`${failure.message} · ${persistedFailure.errorMessage}`);
        }
        agentLifecycle.failActiveRequest(failure.message, failure.stage, failure.phase);
        return null;
      };

      const resumeTrail = getTaskResumeTrail(input.taskId);
      const completedBoardAction = selectReusableCompletedTaskToolCall(
        input.sessionId,
        resumeTrail.toolCalls,
        "execute_board_action",
      );
      const persistedActionResult = selectPersistedActionResultMessage(resumeTrail.artifacts);

      let actionResult: string;
      if (completedBoardAction && !persistedActionResult) {
        return failBoardActionLifecycle({
          message: "TASK RESUME FAILED: completed board action is missing its persisted action result artifact.",
          phase: "verify",
          stage: "verifying",
        });
      }

      if (completedBoardAction && persistedActionResult) {
        actionResult = persistedActionResult;
      } else {
        resumeBoundaryOutcome = markResumeBoundaryReran(resumeBoundaryOutcome, "execute_board_action");
        try {
          actionResult = await trackOpyTaskToolCall({
            taskId: input.taskId,
            sessionId: input.sessionId,
            name: "execute_board_action",
            inputSummary: summarizeInlineText(input.failurePrefix, "BOARD ACTION"),
            execute: input.execute,
            outputSummary: (result) => summarizeInlineText(result, "BOARD ACTION COMPLETE."),
            artifacts: (result) => [createActionResultArtifactDraft(result)],
          });
        } catch (error) {
          return failBoardActionLifecycle({
            message: toErrorMessage(error),
            phase: "apply",
            stage: "applying",
          });
        }
      }

      agentLifecycle.markVerifyReady();

      if (!selectReusableCompletedTaskToolCall(input.sessionId, resumeTrail.toolCalls, "refresh_checkpoints")) {
        resumeBoundaryOutcome = markResumeBoundaryReran(resumeBoundaryOutcome, "refresh_checkpoints");
        try {
          if (input.onAfterApplied) {
            await trackOpyTaskToolCall({
              taskId: input.taskId,
              sessionId: input.sessionId,
              name: "refresh_checkpoints",
              inputSummary: "Refresh OPY checkpoint history after apply.",
              execute: async () => {
                await input.onAfterApplied?.();
                return null;
              },
              outputSummary: () => "CHECKPOINT HISTORY REFRESHED",
            });
          }
        } catch (error) {
          return failBoardActionLifecycle({
            message: toErrorMessage(error),
            phase: "verify",
            stage: "verifying",
          });
        }
      }

      if (selectReusableCompletedTaskToolCall(input.sessionId, resumeTrail.toolCalls, "persist_assistant_message")) {
        await persistResumeBoundaryOutcomeArtifact({
          taskId: input.taskId,
          sessionId: input.sessionId,
          payload: {
            boundaries: resumeBoundaryOutcome,
            requestKind: input.requestKind,
            updatedAt: Date.now(),
          },
        });
        agentLifecycle.completeActiveRequest();
        return actionResult;
      }

      resumeBoundaryOutcome = markResumeBoundaryReran(resumeBoundaryOutcome, "persist_assistant_message");
      const persistedMessageCallId = createMessageId();
      const persistedMessageStartedAt = Date.now();
      await persistOpyToolCall({
        id: persistedMessageCallId,
        taskId: input.taskId,
        sessionId: input.sessionId,
        name: "persist_assistant_message",
        status: "running",
        startedAt: persistedMessageStartedAt,
        updatedAt: persistedMessageStartedAt,
        completedAt: null,
        inputSummary: "Persist assistant transcript message.",
        outputSummary: null,
        errorSummary: null,
      });
      const persistedAssistantMessage = await persistOpyMessage(input.sessionId, "assistant", actionResult);
      if (!persistedAssistantMessage) {
        const failedAt = Date.now();
        await persistOpyToolCall({
          id: persistedMessageCallId,
          taskId: input.taskId,
          sessionId: input.sessionId,
          name: "persist_assistant_message",
          status: "failed",
          startedAt: persistedMessageStartedAt,
          updatedAt: failedAt,
          completedAt: failedAt,
          inputSummary: "Persist assistant transcript message.",
          outputSummary: null,
          errorSummary: "Assistant confirmation content was empty.",
        });
        return failBoardActionLifecycle({
          message: "ACTION RESULT PERSIST FAILED: assistant confirmation content was empty.",
          phase: "persist",
          stage: "verifying",
        });
      }
      if (!persistedAssistantMessage.ok) {
        const failedAt = Date.now();
        await persistOpyToolCall({
          id: persistedMessageCallId,
          taskId: input.taskId,
          sessionId: input.sessionId,
          name: "persist_assistant_message",
          status: "failed",
          startedAt: persistedMessageStartedAt,
          updatedAt: failedAt,
          completedAt: failedAt,
          inputSummary: "Persist assistant transcript message.",
          outputSummary: null,
          errorSummary: persistedAssistantMessage.errorMessage,
        });
        return failBoardActionLifecycle({
          message: `ACTION RESULT PERSIST FAILED: ${persistedAssistantMessage.errorMessage}`,
          phase: "persist",
          stage: "verifying",
        });
      }

      const persistedAt = Date.now();
      await persistOpyToolCall({
        id: persistedMessageCallId,
        taskId: input.taskId,
        sessionId: input.sessionId,
        name: "persist_assistant_message",
        status: "completed",
        startedAt: persistedMessageStartedAt,
        updatedAt: persistedAt,
        completedAt: persistedAt,
        inputSummary: "Persist assistant transcript message.",
        outputSummary: `MESSAGE::${persistedAssistantMessage.message.id.slice(0, 8)}`,
        errorSummary: null,
      });

      await persistResumeBoundaryOutcomeArtifact({
        taskId: input.taskId,
        sessionId: input.sessionId,
        payload: {
          boundaries: resumeBoundaryOutcome,
          requestKind: input.requestKind,
          updatedAt: Date.now(),
        },
      });
      agentLifecycle.completeActiveRequest();
      return actionResult;
    },
    [
      agentLifecycle,
      getTaskResumeTrail,
      persistOpyMessage,
      persistOpyToolCall,
      persistResumeBoundaryOutcomeArtifact,
      trackOpyTaskToolCall,
    ],
  );

  const executeBoardActionLifecycle = useCallback(
    async (input: {
      readonly lifecycleRequest: OpyAgentLifecycleRequest;
      readonly manageLifecycleStart?: boolean;
      readonly skipConfirmation?: boolean;
      readonly initialResumeBoundaryOutcome?: ReadonlyArray<OpyPersistedResumeBoundaryOutcomeItem>;
      readonly execute: () => Promise<string>;
      readonly onAfterApplied?: () => Promise<void> | void;
    }): Promise<string | null> => {
      if (input.manageLifecycleStart !== false) {
        if (agentLifecycle.resumableTaskId && agentLifecycle.resumableTaskId !== input.lifecycleRequest.id) {
          await dismissResumableLifecycleTask("SUPERSEDED BY NEW TASK.");
        }
        agentLifecycle.startActionRequest(input.lifecycleRequest);
      }

      if (input.lifecycleRequest.requiresConfirmation && input.skipConfirmation !== true) {
        return null;
      }

      if (input.lifecycleRequest.requiresConfirmation) {
        agentLifecycle.confirmActiveRequest();
      }
      return executeAppliedBoardAction({
        taskId: input.lifecycleRequest.id,
        sessionId: input.lifecycleRequest.confirmation?.sessionId ?? input.lifecycleRequest.replay.sessionId,
        requestKind: input.lifecycleRequest.kind,
        ...(input.initialResumeBoundaryOutcome
          ? { initialResumeBoundaryOutcome: input.initialResumeBoundaryOutcome }
          : {}),
        failurePrefix: input.lifecycleRequest.confirmation?.failurePrefix ?? "BOARD ACTION FAILED",
        execute: input.execute,
        ...(input.onAfterApplied
          ? { onAfterApplied: input.onAfterApplied }
          : {}),
      });
    },
    [agentLifecycle, dismissResumableLifecycleTask, executeAppliedBoardAction],
  );

  const createAndActivateSession = useCallback(async (): Promise<void> => {
    const createdAt = Date.now();
    const sessionId = createMessageId();
    const bootstrap = buildBootstrapMessage(hasOpenAiApiKey);
    const bootstrapMessageId = createMessageId();

    const createdSession = await runEffect(
      createOpyChatSession({
        id: sessionId,
        title: `SESSION ${formatClockTime(createdAt)}`,
        domain,
        diagramId,
        createdAt,
        initialMessage: {
          id: bootstrapMessageId,
          role: bootstrap.role,
          content: bootstrap.content,
          createdAt,
        },
      }),
    );

    const seededMessage: OpyChatMessage = {
      id: bootstrapMessageId,
      sessionId,
      role: bootstrap.role,
      content: bootstrap.content,
      createdAt,
    };

    setSessions((current) => sortSessionsByRecency([createdSession, ...current]));
    setSelectedSessionId(createdSession.id);
    setMessages([seededMessage]);
    setRunsBySessionId((current) => ({
      ...current,
      [createdSession.id]: [],
    }));
    setTasksBySessionId((current) => ({
      ...current,
      [createdSession.id]: [],
    }));
    setDiagramProposalHistoryBySessionId((current) => ({
      ...current,
      [createdSession.id]: [],
    }));
    setCheckpointsBySessionId((current) => ({
      ...current,
      [createdSession.id]: [],
    }));
  }, [diagramId, domain, hasOpenAiApiKey, runEffect]);

  useEffect(() => {
    let isCancelled = false;

    const hydrate = async () => {
      if (agentSecretStatus === "loading") {
        return;
      }

      await interruptActiveLifecycleTask("INTERRUPTED BY SESSION HYDRATION.");
      agentLifecycle.resetLifecycle();
      setIsSessionLoading(true);
      setRuntimeError(null);

      try {
        const loadedSessions = await runEffect(
          listOpyChatSessions({
            domain,
            diagramId,
          }),
        );

        if (isCancelled) {
          return;
        }

        if (loadedSessions.length === 0) {
          const createdAt = Date.now();
          const sessionId = createMessageId();
          const bootstrap = buildBootstrapMessage(hasOpenAiApiKey);
          const bootstrapMessageId = createMessageId();
          const createdSession = await runEffect(
            createOpyChatSession({
              id: sessionId,
              title: `SESSION ${formatClockTime(createdAt)}`,
              domain,
              diagramId,
              createdAt,
              initialMessage: {
                id: bootstrapMessageId,
                role: bootstrap.role,
                content: bootstrap.content,
                createdAt,
              },
            }),
          );
          if (isCancelled) {
            return;
          }

          setSessions([createdSession]);
          setSelectedSessionId(createdSession.id);
          setMessages([
            {
              id: bootstrapMessageId,
              sessionId,
              role: bootstrap.role,
              content: bootstrap.content,
              createdAt,
            },
          ]);
          setRunsBySessionId((current) => ({
            ...current,
            [createdSession.id]: [],
          }));
          setTasksBySessionId((current) => ({
            ...current,
            [createdSession.id]: [],
          }));
          setDiagramProposalHistoryBySessionId((current) => ({
            ...current,
            [createdSession.id]: [],
          }));
          setCheckpointsBySessionId((current) => ({
            ...current,
            [createdSession.id]: [],
          }));
          return;
        }

        const sorted = sortSessionsByRecency(loadedSessions);
        const resumeSessionId = sorted[0]?.id ?? "";
        setSessions(sorted);
        setSelectedSessionId(resumeSessionId);

        if (resumeSessionId.length > 0) {
          await hydrateMessagesForSession(resumeSessionId);
        } else {
          setMessages([]);
          setRunsBySessionId({});
          setTasksBySessionId({});
          setDiagramProposalHistoryBySessionId({});
          setCheckpointsBySessionId({});
        }
      } catch (error) {
        if (!isCancelled) {
          setRuntimeError(`SESSION LOAD FAILED: ${toErrorMessage(error)}`);
          setSessions([]);
          setSelectedSessionId("");
          setMessages([]);
          setRunsBySessionId({});
          setTasksBySessionId({});
          setDiagramProposalHistoryBySessionId({});
          setCheckpointsBySessionId({});
        }
      } finally {
        if (!isCancelled) {
          setIsSessionLoading(false);
        }
      }
    };

    void hydrate();

    return () => {
      isCancelled = true;
    };
  }, [
    agentLifecycle,
    agentSecretStatus,
    diagramId,
    domain,
    hasOpenAiApiKey,
    hydrateMessagesForSession,
    interruptActiveLifecycleTask,
    runEffect,
  ]);

  const handleCreateSession = useCallback(() => {
    if (isRunning || isSessionLoading) {
      return;
    }

    setRuntimeError(null);
    setIsSessionLoading(true);
    void interruptActiveLifecycleTask("INTERRUPTED BY SESSION CREATE.")
      .then(() => {
        agentLifecycle.resetLifecycle();
        return createAndActivateSession();
      })
      .catch((error) => {
        setRuntimeError(`SESSION CREATE FAILED: ${toErrorMessage(error)}`);
      })
      .finally(() => {
        setIsSessionLoading(false);
      });
  }, [agentLifecycle, createAndActivateSession, interruptActiveLifecycleTask, isRunning, isSessionLoading]);

  const handleSelectSession = useCallback(
    (nextSessionId: string) => {
      if (isRunning || isSessionLoading || nextSessionId === selectedSessionId) {
        return;
      }

      setRuntimeError(null);
      void interruptActiveLifecycleTask("INTERRUPTED BY SESSION SWITCH.")
        .then(() => {
          agentLifecycle.resetLifecycle();
          setSelectedSessionId(nextSessionId);
          return hydrateMessagesForSession(nextSessionId);
        })
        .catch((error) => {
          setRuntimeError(`SESSION SWITCH FAILED: ${toErrorMessage(error)}`);
        });
    },
    [
      agentLifecycle,
      hydrateMessagesForSession,
      interruptActiveLifecycleTask,
      isRunning,
      isSessionLoading,
      selectedSessionId,
    ],
  );

  const handleRenameSession = useCallback(() => {
    const sessionId = selectedSessionId;
    if (sessionId.length === 0 || isRunning || isSessionLoading) {
      return;
    }

    const normalizedTitle = sessionTitleDraft.trim();
    if (normalizedTitle.length === 0) {
      setRuntimeError("SESSION NAME CANNOT BE EMPTY.");
      return;
    }

    setRuntimeError(null);
    setIsSessionLoading(true);
    void runEffect(
      renameOpyChatSession({
        sessionId,
        title: normalizedTitle,
      }),
    )
      .then((renamed) => {
        setSessions((current) =>
          sortSessionsByRecency(
            current.map((session) =>
              session.id === renamed.sessionId
                ? {
                  ...session,
                  title: renamed.title,
                  updatedAt: renamed.updatedAt,
                }
                : session
            ),
          )
        );
        setSessionTitleDraft(renamed.title);
      })
      .catch((error) => {
        setRuntimeError(`SESSION RENAME FAILED: ${toErrorMessage(error)}`);
      })
      .finally(() => {
        setIsSessionLoading(false);
      });
  }, [isRunning, isSessionLoading, runEffect, selectedSessionId, sessionTitleDraft]);

  const handleSubmitPrompt = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      const sessionId = selectedSessionId;
      if (trimmed.length === 0 || isRunning || sessionId.length === 0) {
        return;
      }

      setDraftPrompt("");
      setRuntimeError(null);
      const persistedUserMessage = await appendAndPersistMessage(sessionId, "user", trimmed);
      if (!persistedUserMessage) {
        return;
      }

      const opyCommand = parseOpyCommand(trimmed);
      if (opyCommand.type === "invalid") {
        await appendAndPersistMessage(
          sessionId,
          "system",
          `BOARD COMMAND ERROR: ${opyCommand.reason}`,
        );
        return;
      }

      if (opyCommand.type === "action") {
        if (domain !== "c4") {
          await appendAgentNotice(
            sessionId,
            makeAgentPolicyError({
              message: "Board commands are currently available in C4 mode only.",
              recommendedAction: "Switch to the C4 board and retry.",
            }),
          );
          return;
        }

        if (actionMode === "disabled" || actionMode === "read-only") {
          await appendAgentNotice(
            sessionId,
            makeAgentPolicyError({
              message: `Action blocked by mode ${actionMode.toUpperCase()}.`,
              recommendedAction: "Switch to APPLY-WITH-CONFIRMATION to execute board actions.",
            }),
          );
          return;
        }

        if (actionMode === "propose") {
          await appendAndPersistMessage(
            sessionId,
            "assistant",
            `PROPOSAL:: ADD ${opyCommand.action.nodeType.toUpperCase()} "${opyCommand.action.label}". SWITCH MODE TO APPLY-WITH-CONFIRMATION TO EXECUTE.`,
          );
          return;
        }

        const actionFlow = createOpyAddNodeActionFlowDescriptor({
          sessionId,
          nodeType: opyCommand.action.nodeType,
          label: opyCommand.action.label,
        });
        await executeOpyActionFlow({
          descriptor: actionFlow,
          replay: {
            kind: "add-node",
            label: opyCommand.action.label,
            nodeType: opyCommand.action.nodeType,
            sessionId,
          },
        });
        return;
      }

      if (opyCommand.type === "diagram-proposal") {
        if (domain !== "c4") {
          await appendAgentNotice(
            sessionId,
            makeAgentPolicyError({
              message: "Diagram proposals are currently available in C4 mode only.",
              recommendedAction: "Switch to the C4 board and retry.",
            }),
          );
          return;
        }

        if (actionMode === "disabled" || actionMode === "read-only") {
          await appendAgentNotice(
            sessionId,
            makeAgentPolicyError({
              message: `Diagram proposal blocked by mode ${actionMode.toUpperCase()}.`,
              recommendedAction: "Switch to PROPOSE or APPLY-WITH-CONFIRMATION.",
            }),
          );
          return;
        }

        if (!hasOpenAiApiKey) {
          await appendAgentNotice(
            sessionId,
            makeAgentConfigError({
              message: "OpenAI key required for diagram proposals.",
              recommendedAction: "Navigate to Settings > AI Agent and configure your key.",
            }),
          );
          return;
        }

        await executeRigRun({
          lifecycleRequest: createLifecycleRequest({
            confirmation: null,
            id: createMessageId(),
            mode: "read",
            kind: "proposal",
            label: "PROPOSAL",
            requiresConfirmation: false,
            replay: {
              description: opyCommand.proposal.description,
              kind: "proposal",
              sessionId,
            },
          }),
          sessionId,
          intent: "plan-c4-diagram",
          contextualize: () => resolveRigAgentContext(opyCommand.proposal.description),
          execute: async (context) => {
            const proposal = await runEffect(
              planRigC4Diagram({
                description: opyCommand.proposal.description,
                diagramContext: context.promptContext,
                ...(boardSummary ? { boardSummary } : {}),
              }),
            );
            return {
              proposal,
              context,
            } satisfies OpyGroundedDiagramProposal;
          },
          assistantMessage: (groundedProposal) =>
            `PROPOSAL READY:: ${groundedProposal.proposal.summary}\nNO BOARD CHANGES WERE APPLIED.\n${
              formatRigAgentCitationBlock(groundedProposal.context)
            }`,
          failurePrefix: "DIAGRAM PROPOSAL FAILED",
          artifactsForResult: (groundedProposal) => [createDiagramProposalArtifactDraft(groundedProposal)],
          onAfterPersisted: async (groundedProposal) => {
            const persistedProposal: OpySessionDiagramProposal = {
              command: opyCommand.proposal,
              proposal: groundedProposal.proposal,
              context: groundedProposal.context,
              decisionStatus: "pending",
              decidedAtMs: Date.now(),
            };

            await runEffect(
              upsertOpyDiagramProposal(
                toPersistedDiagramProposal(sessionId, persistedProposal),
              ),
            );
            setDiagramProposalHistoryBySessionId((current) => ({
              ...current,
              [sessionId]: upsertSessionDiagramProposalHistory(
                current[sessionId] ?? [],
                persistedProposal,
              ),
            }));
          },
        });
        return;
      }

      if (opyCommand.type === "board-review") {
        if (domain !== "c4") {
          await appendAgentNotice(
            sessionId,
            makeAgentPolicyError({
              message: "Board review is currently available in C4 mode only.",
              recommendedAction: "Switch to the C4 board and retry.",
            }),
          );
          return;
        }

        if (!boardSummary || boardSummary.nodeCount === 0) {
          await appendAgentNotice(
            sessionId,
            makeAgentPolicyError({
              message: "Board review requires at least one C4 node in the current board.",
              recommendedAction: "Add or load a C4 node and retry.",
            }),
          );
          return;
        }

        if (!hasOpenAiApiKey) {
          await appendAgentNotice(
            sessionId,
            makeAgentConfigError({
              message: "OpenAI key required for board review.",
              recommendedAction: "Navigate to Settings > AI Agent and configure your key.",
            }),
          );
          return;
        }

        const reviewFocus = opyCommand.review.focus ?? boardContext?.selectedNode?.label;
        await executeRigRun({
          lifecycleRequest: createLifecycleRequest({
            confirmation: null,
            id: createMessageId(),
            mode: "read",
            kind: "review",
            label: "REVIEW",
            requiresConfirmation: false,
            replay: {
              focus: reviewFocus ?? null,
              kind: "review",
              sessionId,
            },
          }),
          sessionId,
          intent: "review-c4-board",
          contextualize: () => resolveRigAgentContext(reviewFocus ?? null),
          execute: async (context) => {
            const review = await runEffect(
              reviewRigC4Board({
                ...(reviewFocus ? { focus: reviewFocus } : {}),
                diagramContext: context.promptContext,
                boardSummary,
              }),
            );
            return {
              review,
              context,
            } satisfies OpyGroundedBoardReview;
          },
          assistantMessage: (groundedReview) =>
            `REVIEW READY:: ${groundedReview.review.summary}\nNO BOARD CHANGES WERE APPLIED.\n${
              formatRigAgentCitationBlock(groundedReview.context)
            }`,
          failurePrefix: "BOARD REVIEW FAILED",
          artifactsForResult: (groundedReview) => [createBoardReviewArtifactDraft(groundedReview)],
          onAfterPersisted: (groundedReview) => {
            setBoardReviewsBySessionId((current) => ({
              ...current,
              [sessionId]: {
                command: opyCommand.review,
                review: groundedReview.review,
                context: groundedReview.context,
              },
            }));
          },
        });
        return;
      }

      if (!hasOpenAiApiKey) {
        await appendAgentNotice(
          sessionId,
          makeAgentConfigError({
            message: "OpenAI key required for OPY Net chat.",
            recommendedAction: "Navigate to Settings > AI Agent and configure your key.",
          }),
        );
        return;
      }

      await executeRigRun({
        lifecycleRequest: createLifecycleRequest({
          confirmation: null,
          id: createMessageId(),
          mode: "read",
          kind: "chat",
          label: "CHAT",
          requiresConfirmation: false,
          replay: {
            kind: "chat",
            prompt: trimmed,
            sessionId,
          },
        }),
        sessionId,
        intent: "chat",
        contextualize: () => resolveRigAgentContext(trimmed),
        execute: async (context) => {
          const response = await runEffect(
            runRigHello({
              prompt: [
                "You are OPY Net, an architecture copilot for OPSYDYN.",
                "Respond with concise, actionable architecture guidance.",
                "Ground every recommendation in the supplied board evidence and be explicit when confidence is limited.",
                `Board evidence:\n${context.promptContext}`,
                `Operator request: ${trimmed}`,
              ].join("\n"),
            }),
          );
          return {
            response,
            context,
          } satisfies OpyGroundedChatResponse;
        },
        assistantMessage: (groundedChat) =>
          `${groundedChat.response.message}\n${formatRigAgentCitationBlock(groundedChat.context)}`,
        failurePrefix: "AGENT RUNTIME ERROR",
        artifactsForResult: (groundedChat) => [createChatResponseArtifactDraft(groundedChat)],
        onAfterPersisted: (groundedChat) => {
          setGroundedChatsBySessionId((current) => ({
            ...current,
            [sessionId]: groundedChat,
          }));
        },
      });
    },
    [
      actionMode,
      appendAndPersistMessage,
      appendAgentNotice,
      boardContext,
      boardSummary,
      domain,
      executeRigRun,
      hasOpenAiApiKey,
      isRunning,
      onApplyBoardAction,
      resolveRigAgentContext,
      runEffect,
      selectedSessionId,
    ],
  );

  const handleSetPlanDecision = useCallback(
    async (status: OpyPlanDecisionStatus) => {
      const sessionId = selectedSessionId;
      if (
        sessionId.length === 0
        || !activeDiagramProposal
        || !activeMutationPlan
        || isRunning
      ) {
        return;
      }

      if (status === "approved" && !activeMutationPlan.canApprove) {
        await appendAgentNotice(
          sessionId,
          makeAgentPolicyError({
            message: `Plan approval blocked by ${activeMutationPlan.issues.length} unresolved issue(s).`,
            recommendedAction: "Inspect the blockers or generate a new proposal.",
          }),
        );
        return;
      }

      try {
        const decidedAtMs = Date.now();
        const nextProposal: OpySessionDiagramProposal = {
          ...activeDiagramProposal,
          decisionStatus: status,
          decidedAtMs,
        };
        await runEffect(
          upsertOpyDiagramProposal(
            toPersistedDiagramProposal(sessionId, nextProposal),
          ),
        );
        setDiagramProposalHistoryBySessionId((current) => ({
          ...current,
          [sessionId]: upsertSessionDiagramProposalHistory(
            current[sessionId] ?? [],
            nextProposal,
          ),
        }));

        await appendAndPersistMessage(
          sessionId,
          "system",
          `PLAN ${PLAN_DECISION_LABEL[status]}:: ${
            status === "approved"
              ? `READY ${activeMutationPlan.plan.totalActions} ACTION(S) FOR CONFIRMED APPLY.`
              : "CURRENT PLAN HELD. NO BOARD CHANGES WILL BE APPLIED."
          }`,
        );
      } catch (error) {
        setRuntimeError(`PLAN REVIEW SAVE FAILED: ${toErrorMessage(error)}`);
      }
    },
    [
      activeDiagramProposal,
      activeMutationPlan,
      appendAgentNotice,
      appendAndPersistMessage,
      isRunning,
      runEffect,
      selectedSessionId,
      setRuntimeError,
    ],
  );

  const findPersistedProposalForReplay = useCallback(
    (sessionId: string, proposalRespondedAtMs: number): OpySessionDiagramProposal | null =>
      (diagramProposalHistoryBySessionId[sessionId] ?? []).find(
        (proposal) => proposal.proposal.respondedAtMs === proposalRespondedAtMs,
      ) ?? null,
    [diagramProposalHistoryBySessionId],
  );

  const findCheckpointForReplay = useCallback(
    (sessionId: string, checkpointId: string): OpyAgentCheckpoint | null =>
      (checkpointsBySessionId[sessionId] ?? []).find((checkpoint) => checkpoint.id === checkpointId) ?? null,
    [checkpointsBySessionId],
  );

  const reportMissingLifecycleReplayTarget = useCallback(
    async (sessionId: string, detail: string) => {
      setRuntimeError(detail);
      await appendAndPersistMessage(sessionId, "system", detail);
    },
    [appendAndPersistMessage],
  );

  const handleOpyActionFlowIssue = useCallback(
    async (sessionId: string, issue: OpyActionFlowIssue): Promise<void> => {
      switch (issue.kind) {
        case "policy":
          await appendAgentNotice(
            sessionId,
            makeAgentPolicyError({
              message: issue.message,
              recommendedAction: issue.recommendedAction,
            }),
          );
          return;
        case "missing-target":
          await reportMissingLifecycleReplayTarget(sessionId, issue.detail);
          return;
        case "no-op":
          await appendAndPersistMessage(sessionId, "assistant", issue.message);
      }
    },
    [appendAgentNotice, appendAndPersistMessage, reportMissingLifecycleReplayTarget],
  );

  const summarizeOpyActionFlowIssue = useCallback((issue: OpyActionFlowIssue): string => {
    switch (issue.kind) {
      case "policy":
        return summarizeInlineText(`${issue.message} ${issue.recommendedAction}`, issue.message);
      case "missing-target":
        return issue.detail;
      case "no-op":
        return issue.message;
    }
  }, []);

  const resolvePersistedActionDescriptorReplay = useCallback(
    (
      request: OpyAgentLifecycleRequest,
    ): {
      readonly artifacts: ReadonlyArray<OpyTaskArtifactDraft>;
      readonly ok: true;
      readonly value: OpyActionFlowDescriptor;
    } | null => {
      const resumeTrail = getTaskResumeTrail(request.id);
      const reusableResolution = selectReusableCompletedTaskToolCall(
        request.replay.sessionId,
        resumeTrail.toolCalls,
        "resolve_action",
      );
      if (!reusableResolution) {
        return null;
      }

      const artifacts = resumeTrail.artifacts;
      const persistedDescriptorArtifact = selectLatestTaskArtifact(artifacts, "action_descriptor");
      if (
        !persistedDescriptorArtifact
        || !isPersistedActionDescriptorArtifactPayload(persistedDescriptorArtifact.payload)
      ) {
        return null;
      }

      const payload = persistedDescriptorArtifact.payload;
      return {
        ok: true,
        value: payload.descriptor,
        artifacts: selectResumableActionArtifacts(artifacts),
      };
    },
    [getTaskResumeTrail],
  );

  const resolveExecutableActionReplay = useCallback(
    (
      replay: OpyAgentLifecycleRequest["replay"],
      request?: OpyAgentLifecycleRequest,
    ): OpyExecutableActionReplayResolution | null => {
      let liveResolution: OpyExecutableActionReplayResolution | null = null;

      switch (replay.kind) {
        case "add-node":
          liveResolution = resolveOpyExecutableAddNodeActionFlow({
            actionMode,
            domain,
            sessionId: replay.sessionId,
            nodeType: replay.nodeType,
            label: replay.label,
          });
          break;
        case "apply-proposal": {
          const resolution = resolveOpyApplyProposalActionFlow({
            actionMode,
            boardSummary,
            proposalRecord: findPersistedProposalForReplay(replay.sessionId, replay.proposalRespondedAtMs),
            sessionId: replay.sessionId,
          });
          liveResolution = resolution.ok
            ? {
              ok: true,
              value: resolution.value.descriptor,
              artifacts: [
                createMutationPlanArtifactDraft({
                  groundedProposal: resolution.value.groundedProposal,
                  proposalSummary: resolution.value.proposalSummary,
                  mutationPlan: resolution.value.mutationPlan,
                }),
              ],
            }
            : resolution;
          break;
        }
        case "rollback": {
          const checkpoint = findCheckpointForReplay(replay.sessionId, replay.checkpointId);
          const resolution = resolveOpyRollbackActionFlow({
            actionMode,
            checkpoint,
            sessionId: replay.sessionId,
          });
          if (!resolution.ok) {
            liveResolution = resolution;
            break;
          }

          const previewArtifact = createCheckpointRestorePreviewArtifactDraft(
            checkpoint ? buildOpyCheckpointRestorePreview(checkpoint, boardSummary) : null,
          );
          liveResolution = {
            ok: true,
            value: resolution.value,
            ...(previewArtifact ? { artifacts: [previewArtifact] } : {}),
          };
          break;
        }
        default:
          liveResolution = null;
      }

      if (request) {
        const persistedResolution = resolvePersistedActionDescriptorReplay(request);
        if (persistedResolution) {
          if (!liveResolution || !liveResolution.ok) {
            return persistedResolution;
          }

          return {
            ok: true,
            value: liveResolution.value,
            artifacts: mergeArtifactDrafts(
              liveResolution.artifacts ?? [],
              persistedResolution.artifacts ?? [],
            ),
          };
        }
      }

      return liveResolution;
    },
    [
      actionMode,
      boardSummary,
      domain,
      findCheckpointForReplay,
      findPersistedProposalForReplay,
      resolvePersistedActionDescriptorReplay,
    ],
  );

  const executeOpyActionFlow = useCallback(
    async (input: {
      readonly descriptor: OpyActionFlowDescriptor;
      readonly lifecycleRequest?: OpyAgentLifecycleRequest;
      readonly manageLifecycleStart?: boolean;
      readonly artifacts?: ReadonlyArray<OpyTaskArtifactDraft>;
      readonly replay: OpyAgentLifecycleRequest["replay"];
      readonly skipConfirmation?: boolean;
    }): Promise<string | null> => {
      const lifecycleRequest = input.lifecycleRequest ?? createLifecycleRequest({
        confirmation: {
          cancelMessage: input.descriptor.cancelMessage,
          confirmationLines: input.descriptor.confirmationMessage.split("\n"),
          failurePrefix: input.descriptor.failurePrefix,
          sessionId: input.descriptor.sessionId,
        },
        id: createMessageId(),
        mode: "action",
        kind: input.descriptor.requestKind,
        label: input.descriptor.requestLabel,
        requiresConfirmation: true,
        replay: input.replay,
      });

      const actionResumeBoundaryOutcome = markResumeBoundaryReran(
        toPersistedResumeBoundaryOutcome(
          buildTaskResumeBoundaryPlanForKind(
            input.descriptor.sessionId,
            lifecycleRequest.kind,
            getTaskResumeTrail(lifecycleRequest.id).toolCalls,
          ),
        ),
        "resolve_action",
      );

      await trackOpyTaskToolCall({
        taskId: lifecycleRequest.id,
        sessionId: input.descriptor.sessionId,
        name: "resolve_action",
        inputSummary: summarizeInlineText(
          `${input.descriptor.requestLabel} · ${input.descriptor.boardAction.kind}`,
          input.descriptor.requestLabel,
        ),
        execute: async () => input.descriptor,
        outputSummary: () => "ACTION DESCRIPTOR READY",
        artifacts: () => [
          {
            kind: "action_descriptor",
            summary: summarizeInlineText(input.descriptor.confirmationMessage, input.descriptor.requestLabel),
            payload: {
              descriptor: input.descriptor,
              replay: input.replay,
            },
          },
          ...(input.artifacts ?? []).map((artifact) => ({
            ...artifact,
          })),
        ],
      });

      return executeBoardActionLifecycle({
        lifecycleRequest,
        initialResumeBoundaryOutcome: actionResumeBoundaryOutcome,
        execute: () => onApplyBoardAction(input.descriptor.boardAction),
        ...(typeof input.manageLifecycleStart === "boolean"
          ? { manageLifecycleStart: input.manageLifecycleStart }
          : {}),
        ...(typeof input.skipConfirmation === "boolean"
          ? { skipConfirmation: input.skipConfirmation }
          : {}),
        ...(input.descriptor.refreshCheckpointsAfterApply
          ? {
            onAfterApplied: async () => {
              await refreshCheckpointsForSession(input.descriptor.sessionId);
            },
          }
          : {}),
      });
    },
    [executeBoardActionLifecycle, onApplyBoardAction, refreshCheckpointsForSession, trackOpyTaskToolCall],
  );

  const handleApplyActiveProposal = useCallback(async () => {
    const sessionId = selectedSessionId;
    if (
      sessionId.length === 0
      || !activeDiagramProposal
      || isRunning
    ) {
      return;
    }

    const resolution = resolveOpyApplyProposalActionFlow({
      actionMode,
      boardSummary,
      proposalRecord: {
        proposal: activeDiagramProposal.proposal,
        decisionStatus: activeDiagramProposal.decisionStatus,
      },
      sessionId,
    });
    if (!resolution.ok) {
      await handleOpyActionFlowIssue(sessionId, resolution.issue);
      return;
    }

    setRuntimeError(null);
    await executeOpyActionFlow({
      descriptor: resolution.value.descriptor,
      artifacts: [
        createMutationPlanArtifactDraft({
          groundedProposal: resolution.value.groundedProposal,
          proposalSummary: resolution.value.proposalSummary,
          mutationPlan: resolution.value.mutationPlan,
        }),
      ],
      replay: {
        kind: "apply-proposal",
        proposalRespondedAtMs: activeDiagramProposal.proposal.respondedAtMs,
        sessionId,
      },
    });
  }, [
    actionMode,
    activeDiagramProposal,
    boardSummary,
    executeOpyActionFlow,
    handleOpyActionFlowIssue,
    isRunning,
    selectedSessionId,
  ]);

  const handleRestoreCheckpoint = useCallback(async (checkpoint: OpyAgentCheckpoint) => {
    const sessionId = selectedSessionId;
    if (sessionId.length === 0 || isRunning) {
      return;
    }

    const resolution = resolveOpyRollbackActionFlow({
      actionMode,
      checkpoint,
      sessionId,
    });
    if (!resolution.ok) {
      await handleOpyActionFlowIssue(sessionId, resolution.issue);
      return;
    }

    setRuntimeError(null);
    const previewArtifact = createCheckpointRestorePreviewArtifactDraft(
      buildOpyCheckpointRestorePreview(checkpoint, boardSummary),
    );
    await executeOpyActionFlow({
      descriptor: resolution.value,
      ...(previewArtifact ? { artifacts: [previewArtifact] } : {}),
      replay: {
        checkpointId: checkpoint.id,
        kind: "rollback",
        sessionId,
      },
    });
  }, [
    actionMode,
    executeOpyActionFlow,
    handleOpyActionFlowIssue,
    isRunning,
    selectedSessionId,
  ]);

  const prepareLifecycleReplay = useCallback(
    async (request: OpyAgentLifecycleRequest): Promise<boolean> => {
      const replay = request.replay;
      switch (replay.kind) {
        case "chat":
          if (!hasOpenAiApiKey) {
            await appendAgentNotice(
              replay.sessionId,
              makeAgentConfigError({
                message: "OpenAI key required for OPY Net chat.",
                recommendedAction: "Navigate to Settings > AI Agent and configure your key.",
              }),
            );
            return false;
          }
          return true;
        case "proposal":
          if (domain !== "c4") {
            await appendAgentNotice(
              replay.sessionId,
              makeAgentPolicyError({
                message: "Diagram proposals are currently available in C4 mode only.",
                recommendedAction: "Switch to the C4 board and retry.",
              }),
            );
            return false;
          }
          if (!hasOpenAiApiKey) {
            await appendAgentNotice(
              replay.sessionId,
              makeAgentConfigError({
                message: "OpenAI key required for diagram proposals.",
                recommendedAction: "Navigate to Settings > AI Agent and configure your key.",
              }),
            );
            return false;
          }
          return true;
        case "review":
          if (domain !== "c4") {
            await appendAgentNotice(
              replay.sessionId,
              makeAgentPolicyError({
                message: "Board review is currently available in C4 mode only.",
                recommendedAction: "Switch to the C4 board and retry.",
              }),
            );
            return false;
          }
          if (!boardSummary || boardSummary.nodeCount === 0) {
            await appendAgentNotice(
              replay.sessionId,
              makeAgentPolicyError({
                message: "Board review requires at least one C4 node in the current board.",
                recommendedAction: "Add or load a C4 node and retry.",
              }),
            );
            return false;
          }
          if (!hasOpenAiApiKey) {
            await appendAgentNotice(
              replay.sessionId,
              makeAgentConfigError({
                message: "OpenAI key required for board review.",
                recommendedAction: "Navigate to Settings > AI Agent and configure your key.",
              }),
            );
            return false;
          }
          return true;
        case "add-node":
        case "apply-proposal":
        case "rollback": {
          const resolution = resolveExecutableActionReplay(replay, request);
          if (!resolution) {
            return false;
          }
          if (!resolution.ok) {
            await handleOpyActionFlowIssue(replay.sessionId, resolution.issue);
            return false;
          }
          return true;
        }
      }
    },
    [
      appendAgentNotice,
      hasOpenAiApiKey,
      handleOpyActionFlowIssue,
      resolveExecutableActionReplay,
    ],
  );

  const replayLifecycleRequest = useCallback(
    async (request: OpyAgentLifecycleRequest): Promise<void> => {
      const replay = request.replay;
      switch (replay.kind) {
        case "chat":
          await executeRigRun({
            lifecycleRequest: request,
            manageLifecycleStart: false,
            sessionId: replay.sessionId,
            intent: "chat",
            contextualize: () => resolveRigAgentContext(replay.prompt),
            execute: async (context) => {
              const response = await runEffect(
                runRigHello({
                  prompt: [
                    "You are OPY Net, an architecture copilot for OPSYDYN.",
                    "Respond with concise, actionable architecture guidance.",
                    "Ground every recommendation in the supplied board evidence and be explicit when confidence is limited.",
                    `Board evidence:\n${context.promptContext}`,
                    `Operator request: ${replay.prompt}`,
                  ].join("\n"),
                }),
              );
              return {
                response,
                context,
              } satisfies OpyGroundedChatResponse;
            },
            assistantMessage: (groundedChat) =>
              `${groundedChat.response.message}\n${formatRigAgentCitationBlock(groundedChat.context)}`,
            failurePrefix: "AGENT RUNTIME ERROR",
            artifactsForResult: (groundedChat) => [createChatResponseArtifactDraft(groundedChat)],
            onAfterPersisted: (groundedChat) => {
              setGroundedChatsBySessionId((current) => ({
                ...current,
                [replay.sessionId]: groundedChat,
              }));
            },
          });
          return;
        case "proposal":
          await executeRigRun({
            lifecycleRequest: request,
            manageLifecycleStart: false,
            sessionId: replay.sessionId,
            intent: "plan-c4-diagram",
            contextualize: () => resolveRigAgentContext(replay.description),
            execute: async (context) => {
              const proposal = await runEffect(
                planRigC4Diagram({
                  description: replay.description,
                  diagramContext: context.promptContext,
                  ...(boardSummary ? { boardSummary } : {}),
                }),
              );
              return {
                proposal,
                context,
              } satisfies OpyGroundedDiagramProposal;
            },
            assistantMessage: (groundedProposal) =>
              `PROPOSAL READY:: ${groundedProposal.proposal.summary}\nNO BOARD CHANGES WERE APPLIED.\n${
                formatRigAgentCitationBlock(groundedProposal.context)
              }`,
            failurePrefix: "DIAGRAM PROPOSAL FAILED",
            artifactsForResult: (groundedProposal) => [createDiagramProposalArtifactDraft(groundedProposal)],
            onAfterPersisted: async (groundedProposal) => {
              const persistedProposal: OpySessionDiagramProposal = {
                command: {
                  kind: "plan-c4-diagram",
                  description: replay.description,
                },
                proposal: groundedProposal.proposal,
                context: groundedProposal.context,
                decisionStatus: "pending",
                decidedAtMs: Date.now(),
              };

              await runEffect(
                upsertOpyDiagramProposal(
                  toPersistedDiagramProposal(replay.sessionId, persistedProposal),
                ),
              );
              setDiagramProposalHistoryBySessionId((current) => ({
                ...current,
                [replay.sessionId]: upsertSessionDiagramProposalHistory(
                  current[replay.sessionId] ?? [],
                  persistedProposal,
                ),
              }));
            },
          });
          return;
        case "review": {
          const reviewFocus = replay.focus;
          if (!boardSummary) {
            await reportMissingLifecycleReplayTarget(
              replay.sessionId,
              "RETRY TARGET MISSING::CURRENT BOARD SUMMARY.",
            );
            return;
          }
          await executeRigRun({
            lifecycleRequest: request,
            manageLifecycleStart: false,
            sessionId: replay.sessionId,
            intent: "review-c4-board",
            contextualize: () => resolveRigAgentContext(reviewFocus ?? null),
            execute: async (context) => {
              const review = await runEffect(
                reviewRigC4Board({
                  ...(reviewFocus ? { focus: reviewFocus } : {}),
                  diagramContext: context.promptContext,
                  boardSummary,
                }),
              );
              return {
                review,
                context,
              } satisfies OpyGroundedBoardReview;
            },
            assistantMessage: (groundedReview) =>
              `REVIEW READY:: ${groundedReview.review.summary}\nNO BOARD CHANGES WERE APPLIED.\n${
                formatRigAgentCitationBlock(groundedReview.context)
              }`,
            failurePrefix: "BOARD REVIEW FAILED",
            artifactsForResult: (groundedReview) => [createBoardReviewArtifactDraft(groundedReview)],
            onAfterPersisted: (groundedReview) => {
              setBoardReviewsBySessionId((current) => ({
                ...current,
                [replay.sessionId]: {
                  command: {
                    kind: "review-c4-board",
                    focus: replay.focus,
                  },
                  review: groundedReview.review,
                  context: groundedReview.context,
                },
              }));
            },
          });
          return;
        }
        case "add-node":
        case "apply-proposal":
        case "rollback": {
          const resolution = resolveExecutableActionReplay(replay, request);
          if (!resolution) {
            return;
          }
          if (!resolution.ok) {
            await handleOpyActionFlowIssue(replay.sessionId, resolution.issue);
            agentLifecycle.failActiveRequest(
              summarizeOpyActionFlowIssue(resolution.issue),
              request.requiresConfirmation ? "awaiting_confirmation" : "applying",
              "apply",
            );
            return;
          }
          if (request.requiresConfirmation) {
            return;
          }
          await executeOpyActionFlow({
            descriptor: resolution.value,
            ...(resolution.artifacts ? { artifacts: resolution.artifacts } : {}),
            lifecycleRequest: request,
            manageLifecycleStart: false,
            replay,
          });
          return;
        }
      }
    },
    [
      executeOpyActionFlow,
      executeRigRun,
      agentLifecycle,
      handleOpyActionFlowIssue,
      resolveRigAgentContext,
      resolveExecutableActionReplay,
      runEffect,
      summarizeOpyActionFlowIssue,
    ],
  );

  const handleConfirmPendingLifecycleAction = useCallback(async () => {
    const request = pendingLifecycleRequest;
    const pending = pendingLifecycleConfirmation;
    if (!request || !pending || agentLifecycle.stage !== "awaiting_confirmation") {
      return;
    }

    const resolution = resolveExecutableActionReplay(request.replay, request);
    if (!resolution) {
      return;
    }
    if (!resolution.ok) {
      await handleOpyActionFlowIssue(pending.sessionId, resolution.issue);
      agentLifecycle.failActiveRequest(
        summarizeOpyActionFlowIssue(resolution.issue),
        "awaiting_confirmation",
        "apply",
      );
      return;
    }

    setRuntimeError(null);
    await executeOpyActionFlow({
      descriptor: resolution.value,
      ...(resolution.artifacts ? { artifacts: resolution.artifacts } : {}),
      lifecycleRequest: request,
      manageLifecycleStart: false,
      replay: request.replay,
      skipConfirmation: true,
    });
  }, [
    agentLifecycle,
    executeOpyActionFlow,
    handleOpyActionFlowIssue,
    pendingLifecycleConfirmation,
    pendingLifecycleRequest,
    resolveExecutableActionReplay,
    summarizeOpyActionFlowIssue,
  ]);

  const handleCancelPendingLifecycleAction = useCallback(() => {
    const pending = pendingLifecycleConfirmation;
    if (!pending || agentLifecycle.stage !== "awaiting_confirmation") {
      return;
    }

    void appendAndPersistMessage(
      pending.sessionId,
      "system",
      pending.cancelMessage,
    );
    agentLifecycle.cancelActiveRequest();
  }, [agentLifecycle, appendAndPersistMessage, pendingLifecycleConfirmation]);
  const handleResumeInterruptedLifecycle = useCallback(() => {
    const request = agentLifecycle.resumableRequest;
    if (isRunning || !request) {
      return;
    }

    setRuntimeError(null);
    void prepareLifecycleReplay(request).then((canReplay) => {
      if (!canReplay) {
        return;
      }

      agentLifecycle.resumeResumableRequest();
      return replayLifecycleRequest(request);
    });
  }, [agentLifecycle, isRunning, prepareLifecycleReplay, replayLifecycleRequest]);

  const handleDismissInterruptedLifecycle = useCallback(() => {
    if (!agentLifecycle.resumableRequest) {
      return;
    }

    void dismissResumableLifecycleTask("INTERRUPTED TASK DISMISSED BY OPERATOR.").catch((error) => {
      setRuntimeError(`TASK DISMISS FAILED: ${toErrorMessage(error)}`);
    });
  }, [agentLifecycle.resumableRequest, dismissResumableLifecycleTask]);

  const handleSelectInterruptedLifecycleTask = useCallback((taskId: string) => {
    if (isRunning) {
      return;
    }

    const task = activeInterruptedTasks.find((candidate) => candidate.id === taskId);
    if (!task) {
      return;
    }

    setRuntimeError(null);
    void activateResumableTask(task);
  }, [activateResumableTask, activeInterruptedTasks, isRunning]);

  const handleRetryLastLifecycle = useCallback(() => {
    const lastRequest = agentLifecycle.lastRequest;
    if (isRunning || !lastRequest) {
      return;
    }

    setRuntimeError(null);
    void prepareLifecycleReplay(lastRequest).then((canReplay) => {
      if (!canReplay) {
        return;
      }

      agentLifecycle.retryLastRequest();
      return replayLifecycleRequest(lastRequest);
    });
  }, [agentLifecycle, isRunning, prepareLifecycleReplay, replayLifecycleRequest]);

  useEffect(() => {
    expandedTaskIds.forEach((taskId) => {
      if (taskToolCallsByTaskId[taskId] || taskArtifactsByTaskId[taskId] || taskDetailLoadingByTaskId[taskId]) {
        return;
      }

      void hydrateOpyTaskDetails(taskId);
    });
  }, [expandedTaskIds, hydrateOpyTaskDetails, taskArtifactsByTaskId, taskDetailLoadingByTaskId, taskToolCallsByTaskId]);

  const statusText = agentSecretStatus === "loading"
    ? "KEY::CHECKING"
    : agentSecretStatus === "error"
    ? "KEY::ERROR"
    : hasOpenAiApiKey
    ? "KEY::CONFIGURED"
    : "KEY::MISSING";
  const lifecycleText = agentLifecycle.stage !== "idle"
    ? `FLOW::${agentLifecycle.activeRequest?.label ?? "OPY"}::${LIFECYCLE_STAGE_LABEL[agentLifecycle.stage]}`
    : null;
  const resumableLifecycleText = !isRunning
      && agentLifecycle.resumableRequest
      && agentLifecycle.resumableStage
    ? `RESUME::${agentLifecycle.resumableRequest.label} · INTERRUPTED AT ${
      LIFECYCLE_STAGE_LABEL[agentLifecycle.resumableStage]
    }`
    : null;
  const composerRunning = agentLifecycle.stage === "contextualizing"
    || agentLifecycle.stage === "planning"
    || agentLifecycle.stage === "proposing";
  const copilotChatInputPlaceholder = useMemo(
    () =>
      agentSecretStatus === "loading"
        ? "Checking OPY Net secret resolver..."
        : hasOpenAiApiKey
        ? "Ask OPY Net, use /review, or use /diagram for a C4 proposal..."
        : "Configure OpenAI key in Settings to enable OPY Net",
    [agentSecretStatus, hasOpenAiApiKey],
  );
  const copilotChatLabels = useMemo(
    () => ({
      chatInputPlaceholder: copilotChatInputPlaceholder,
    }),
    [copilotChatInputPlaceholder],
  );
  const handleCopilotSubmitMessage = useCallback((value: string) => {
    void handleSubmitPrompt(value);
  }, [handleSubmitPrompt]);
  const handleCopilotStop = useCallback(() => {
    if (agentLifecycle.stage === "awaiting_confirmation") {
      handleCancelPendingLifecycleAction();
    }
  }, [agentLifecycle.stage, handleCancelPendingLifecycleAction]);
  const runText = lifecycleText
    ? lifecycleText
    : resumableLifecycleText
    ? resumableLifecycleText
    : activeRun
    ? `RUN::${RUN_INTENT_LABEL[activeRun.intent]}::${RUN_STAGE_LABEL[activeRun.stage]}`
    : latestRun
    ? `LAST::${RUN_STATUS_LABEL[latestRun.status]}::${RUN_STAGE_LABEL[latestRun.stage]}`
    : "RUN::IDLE";
  const actionModeText = `ACTION::${actionMode.toUpperCase()}`;
  const activeCommandToken = detectCommandToken(draftPrompt);
  const boardContextHints = boardContext?.scopes.slice(0, 3) ?? [];
  const currentBoardLabel = diagramName.trim().length > 0 ? diagramName.trim() : "UNTITLED BOARD";
  const commitViewportSections = useCallback(
    (
      updater: OpyViewportSections | ((current: OpyViewportSections) => OpyViewportSections),
    ) => {
      setViewportSectionsOpen((current) => {
        const nextSections = typeof updater === "function"
          ? updater(current)
          : updater;

        if (
          nextSections.control === current.control
          && nextSections.diagnostics === current.diagnostics
          && nextSections.checkpoints === current.checkpoints
          && nextSections.review === current.review
          && nextSections.proposal === current.proposal
        ) {
          return current;
        }

        onViewportSectionsChange(nextSections);
        return nextSections;
      });
    },
    [onViewportSectionsChange],
  );
  const clearViewportSectionUnseen = useCallback((key: OpyViewportSectionKey) => {
    setViewportSectionsUnseen((current) =>
      current[key]
        ? {
          ...current,
          [key]: false,
        }
        : current
    );
  }, []);
  const toggleViewportSection = useCallback((key: OpyViewportSectionKey) => {
    if (!viewportSectionsOpen[key]) {
      clearViewportSectionUnseen(key);
    }
    commitViewportSections((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }, [clearViewportSectionUnseen, commitViewportSections, viewportSectionsOpen]);
  const resolveTaskHistoryArtifactNode = useCallback((entry: OpyTaskHistoryEntry): HTMLElement | null => {
    switch (entry.task.request.kind) {
      case "chat": {
        const persistedChat = selectPersistedReadResultArtifact(entry.task.request, entry.artifacts);
        return persistedChat
          && isGroundedChatResponsePayload(persistedChat)
          && latestDiagnosticsSurface?.kind === "chat"
          && latestDiagnosticsSurface.respondedAtMs === persistedChat.response.respondedAtMs
          ? diagnosticsCardRef.current
          : null;
      }
      case "review": {
        const persistedReview = selectPersistedReadResultArtifact(entry.task.request, entry.artifacts);
        return persistedReview
          && isGroundedBoardReviewPayload(persistedReview)
          && activeBoardReview
          && activeBoardReview.review.respondedAtMs === persistedReview.review.respondedAtMs
          ? reviewCardRef.current
          : null;
      }
      case "proposal": {
        const persistedProposal = selectPersistedReadResultArtifact(entry.task.request, entry.artifacts);
        return persistedProposal
          && isGroundedDiagramProposalPayload(persistedProposal)
          && activeDiagramProposal
          && activeDiagramProposal.proposal.respondedAtMs === persistedProposal.proposal.respondedAtMs
          ? proposalCardRef.current
          : null;
      }
      case "apply-proposal": {
        const replay = entry.task.request.replay;
        return replay.kind === "apply-proposal"
          && activeDiagramProposal
          && activeDiagramProposal.proposal.respondedAtMs === replay.proposalRespondedAtMs
          ? proposalPlanCardRef.current ?? proposalCardRef.current
          : null;
      }
      case "rollback": {
        const replay = entry.task.request.replay;
        return replay.kind === "rollback"
          ? checkpointCardRefs.current[replay.checkpointId] ?? null
          : null;
      }
      case "add-node":
        return null;
    }
  }, [activeBoardReview, activeDiagramProposal, latestDiagnosticsSurface]);
  const revealViewportSection = useCallback(
    (
      targetSection: OpyViewportSectionKey,
      targetNodeResolver?: () => HTMLElement | null,
    ) => {
      if (!viewportSectionsOpen[targetSection]) {
        clearViewportSectionUnseen(targetSection);
        commitViewportSections((current) => ({
          ...current,
          [targetSection]: true,
        }));
      }

      const scrollToTarget = () => {
        const node = targetNodeResolver?.() ?? viewportSectionRefs.current[targetSection] ?? null;
        if (!node) {
          return;
        }

        node.scrollIntoView({
          block: "start",
          behavior: "smooth",
        });
      };

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(scrollToTarget);
      });
    },
    [clearViewportSectionUnseen, commitViewportSections, viewportSectionsOpen],
  );
  const handleOpenTaskHistoryDetail = useCallback((taskId: string) => {
    setExpandedTaskIds((current) => current.includes(taskId) ? current : [...current, taskId]);
    revealViewportSection("control", () => taskHistoryCardRefs.current[taskId] ?? null);
  }, [revealViewportSection]);
  const handleOpenTaskHistoryChain = useCallback((task: OpyAgentTask) => {
    const resumableTask = resumableTaskByContinuityKey.get(deriveOpyAgentTaskContinuityKey(task.request));
    if (!resumableTask || isRunning) {
      return;
    }

    handleSelectInterruptedLifecycleTask(resumableTask.id);
    revealViewportSection("control");
  }, [handleSelectInterruptedLifecycleTask, isRunning, revealViewportSection, resumableTaskByContinuityKey]);
  const handleOpenTaskHistoryFocusSection = useCallback((entry: OpyTaskHistoryEntry) => {
    const targetSection = resolveTaskHistoryFocusSection(entry.task);
    revealViewportSection(targetSection, () => resolveTaskHistoryArtifactNode(entry));
  }, [resolveTaskHistoryArtifactNode, revealViewportSection]);
  useEffect(() => {
    if (!chromeSectionRequest) {
      return;
    }

    revealViewportSection(chromeSectionRequest.section);
  }, [chromeSectionRequest, revealViewportSection]);
  const renderViewportSection = useCallback((input: {
    readonly keyId: OpyViewportSectionKey;
    readonly title: string;
    readonly meta: string;
    readonly summary: string;
    readonly tone?: OpyWidgetChromeTone;
    readonly isUnseen?: boolean;
    readonly children: ReactNode;
  }) => {
    const isOpen = viewportSectionsOpen[input.keyId];
    const showUnseen = !isOpen && input.isUnseen === true;

    return (
      <section
        ref={(node) => {
          viewportSectionRefs.current[input.keyId] = node;
        }}
        className={styles.opyCopilotViewportSection}
        data-open={isOpen ? "true" : "false"}
        data-tone={input.tone ?? "neutral"}
        data-unseen={showUnseen ? "true" : "false"}
        aria-label={input.title}
      >
        <button
          type="button"
          className={styles.opyCopilotViewportSectionSummary}
          aria-expanded={isOpen}
          onClick={() => {
            toggleViewportSection(input.keyId);
          }}
        >
          <span className={styles.opyCopilotViewportSectionSummaryMain}>
            <span className={styles.opyCopilotViewportSectionSummaryTitle}>{input.title}</span>
            <span className={styles.opyCopilotViewportSectionSummaryText}>{input.summary}</span>
          </span>
          <span className={styles.opyCopilotViewportSectionSummaryAside}>
            <span className={styles.opyCopilotViewportSectionSummaryMetaGroup}>
              {showUnseen && <span className={styles.opyCopilotViewportSectionSummaryFlag}>NEW</span>}
              <span className={styles.opyCopilotViewportSectionSummaryMeta}>
                {`${isOpen ? "COLLAPSE" : "EXPAND"} :: ${input.meta}`}
              </span>
            </span>
          </span>
        </button>
        {isOpen && (
          <div className={styles.opyCopilotViewportSectionBody}>
            {input.children}
          </div>
        )}
      </section>
    );
  }, [toggleViewportSection, viewportSectionsOpen]);
  const controlSectionMeta =
    `${sessions.length} SESSION(S) · ${boardContextHints.length} CONTEXT(S) · ${activeTasks.length} TASK(S)`;
  const diagnosticsSectionMeta = latestDiagnosticsSurface
    ? `${latestDiagnosticsSurface.kind.toUpperCase()} · ${formatClockTime(latestDiagnosticsSurface.respondedAtMs)}`
    : "UNAVAILABLE";
  const checkpointsSectionMeta = `${activeCheckpoints.length} RESTORE TARGET(S)`;
  const reviewSectionMeta = activeBoardReview
    ? `${activeBoardReview.review.risks.length} RISK(S) · ${activeBoardReview.review.recommendedChanges.length} NEXT`
    : "UNAVAILABLE";
  const proposalSectionMeta = activeDiagramProposal
    ? `${activeDiagramProposal.proposal.nodes.length} NODE(S) · ${activeDiagramProposal.proposal.edges.length} EDGE(S)`
    : "UNAVAILABLE";
  const lastLifecycleText =
    agentLifecycle.lastTerminalStatus && agentLifecycle.lastRequest && agentLifecycle.lastCompletedAt
      ? `LAST FLOW::${agentLifecycle.lastRequest.label} · ${
        LIFECYCLE_TERMINAL_STATUS_LABEL[agentLifecycle.lastTerminalStatus]
      } · ${formatClockTime(agentLifecycle.lastCompletedAt)}`
      : null;
  const controlSectionSummary = summarizeInlineText(
    agentLifecycle.stage !== "idle"
      ? `FLOW::${agentLifecycle.activeRequest?.label ?? "OPY"} · ${
        LIFECYCLE_STAGE_LABEL[agentLifecycle.stage]
      } · BOARD::${currentBoardLabel}`
      : resumableLifecycleText
        ?? lastLifecycleText
        ?? (
          latestTask
            ? `TASK::${latestTask.request.label} · ${TASK_STATUS_LABEL[latestTask.status]} · STAGE::${
              formatTaskStageLabel(latestTask.stage)
            }`
            : null
        )
        ?? `BOARD::${currentBoardLabel} · SESSION::${
          selectedSession?.title ?? "NONE"
        } · ACTION::${actionMode.toUpperCase()}`,
    "CONTROL SURFACE READY.",
  );
  const diagnosticsSectionSummary = latestDiagnosticsSurface
    ? summarizeInlineText(
      latestDiagnosticsSurface.summary,
      `${latestDiagnosticsSurface.kind.toUpperCase()} DIAGNOSTICS READY.`,
    )
    : "NO DIAGNOSTICS YET.";
  const checkpointsSectionSummary = latestCheckpoint
    ? (() => {
      const preview = checkpointRestorePreviewById.get(latestCheckpoint.id) ?? null;
      if (!preview) {
        return summarizeInlineText(
          `LATEST::${latestCheckpoint.snapshot.name} · CREATED::${formatClockTime(latestCheckpoint.createdAt)}`,
          "CHECKPOINTS READY.",
        );
      }

      return summarizeInlineText(
        preview.hasChanges
          ? `LATEST::${latestCheckpoint.snapshot.name} · Δ::${preview.impactedEntities.length} CHANGE(S) · RESTORE::${
            preview.counts.restoreNodes + preview.counts.restoreEdges
          }`
          : `LATEST::${latestCheckpoint.snapshot.name} · CURRENT BOARD ALREADY MATCHES SNAPSHOT`,
        "CHECKPOINTS READY.",
      );
    })()
    : "NO CHECKPOINTS CAPTURED.";
  const reviewSectionSummary = activeBoardReview
    ? summarizeInlineText(
      `FOCUS::${
        formatReviewFocus(activeBoardReview.command.focus)
      } · RISKS::${activeBoardReview.review.risks.length} · NEXT::${activeBoardReview.review.recommendedChanges.length}`,
      activeBoardReview.review.summary,
    )
    : "NO BOARD REVIEW YET.";
  const proposalSectionSummary = activeDiagramProposal
    ? summarizeInlineText(
      activeMutationPlan
        ? `PLAN::${activeMutationPlan.plan.totalActions} ACTION(S) · CREATE::${activeMutationPlan.plan.totalNodesCreated}N/${activeMutationPlan.plan.totalEdgesCreated}E · RISK::${activeMutationPlan.plan.highestRisk.toUpperCase()}`
        : activeDiagramProposal.proposal.summary,
      "PROPOSAL READY.",
    )
    : "NO DIAGRAM PROPOSAL YET.";

  useEffect(() => {
    if (pendingViewportBaselineRef.current) {
      if (isMessageLoading) {
        return;
      }

      viewportAutoSignalsRef.current = {
        proposal: activeProposalSignal,
        review: activeReviewSignal,
        checkpoints: activeCheckpointSignal,
      };
      setViewportSectionsUnseen(EMPTY_VIEWPORT_SECTION_STATE);
      pendingViewportBaselineRef.current = false;
      return;
    }

    let proposalChanged = false;
    let reviewChanged = false;
    let checkpointsChanged = false;

    if (
      activeProposalSignal !== null
      && viewportAutoSignalsRef.current.proposal !== activeProposalSignal
    ) {
      viewportAutoSignalsRef.current.proposal = activeProposalSignal;
      proposalChanged = true;
    }

    if (
      activeReviewSignal !== null
      && viewportAutoSignalsRef.current.review !== activeReviewSignal
    ) {
      viewportAutoSignalsRef.current.review = activeReviewSignal;
      reviewChanged = true;
    }

    if (
      activeCheckpointSignal !== null
      && viewportAutoSignalsRef.current.checkpoints !== activeCheckpointSignal
    ) {
      viewportAutoSignalsRef.current.checkpoints = activeCheckpointSignal;
      checkpointsChanged = true;
    }

    if (proposalChanged || reviewChanged || checkpointsChanged) {
      setViewportSectionsUnseen((current) => {
        const next = {
          ...current,
          proposal: proposalChanged ? !viewportSectionsOpen.proposal : current.proposal,
          review: reviewChanged ? !viewportSectionsOpen.review : current.review,
          checkpoints: checkpointsChanged ? !viewportSectionsOpen.checkpoints : current.checkpoints,
        };

        return (
            next.proposal === current.proposal
            && next.review === current.review
            && next.checkpoints === current.checkpoints
          )
          ? current
          : next;
      });
    }
  }, [
    activeCheckpointSignal,
    activeProposalSignal,
    activeReviewSignal,
    isMessageLoading,
    viewportSectionsOpen.checkpoints,
    viewportSectionsOpen.proposal,
    viewportSectionsOpen.review,
  ]);

  useEffect(() => {
    const transcriptNode = transcriptRef.current;
    if (transcriptNode) {
      transcriptNode.scrollTop = transcriptNode.scrollHeight;
    }
  }, [messages, selectedSessionId]);

  useEffect(() => {
    if (selectedSessionId.length === 0 || isRunning) {
      return;
    }

    if (activeInterruptedTasks.length === 0) {
      setResumableTaskPreferenceBySessionId((current) => {
        if (!(selectedSessionId in current)) {
          return current;
        }

        const next = { ...current };
        delete next[selectedSessionId];
        return next;
      });
      if (agentLifecycle.resumableRequest) {
        agentLifecycle.clearResumableRequest();
      }
      return;
    }

    if (selectedResumableTask) {
      return;
    }

    const preferredResumableTaskId = resumableTaskPreferenceBySessionId[selectedSessionId];
    const nextInterruptedTask = preferredResumableTaskId
      ? activeInterruptedTasks.find((task) => task.id === preferredResumableTaskId) ?? activeInterruptedTasks[0]
      : activeInterruptedTasks[0];
    if (!nextInterruptedTask) {
      return;
    }

    void activateResumableTask(nextInterruptedTask);
  }, [
    activateResumableTask,
    activeInterruptedTasks,
    agentLifecycle.clearResumableRequest,
    agentLifecycle.resumableRequest,
    isRunning,
    resumableTaskPreferenceBySessionId,
    selectedResumableTask,
    selectedSessionId,
  ]);

  return (
    <div className={styles.opyCopilotShell}>
      <div className={styles.opyCopilotViewport}>
        <div className={styles.ownershipLensStats}>
          <span>MODE::ASSIST</span>
          <span>{statusText}</span>
          <span>{runText}</span>
          <span>{actionModeText}</span>
          <span>{`SESSIONS::${sessions.length}`}</span>
          <span>{`ACTIVE::${selectedSession ? "ONLINE" : "NONE"}`}</span>
        </div>
        {runtimeError && (
          <div className={styles.opyCopilotActions}>
            <p className={styles.opyCopilotError}>{`ERROR:: ${runtimeError}`}</p>
            {agentLifecycle.canRetry && (
              <button
                type="button"
                className={styles.ownershipLensToggleButton}
                onClick={handleRetryLastLifecycle}
                disabled={isRunning}
              >
                RETRY LAST FLOW
              </button>
            )}
          </div>
        )}
        {renderViewportSection({
          keyId: "control",
          title: "CONTROL FIELD",
          meta: controlSectionMeta,
          summary: controlSectionSummary,
          tone: controlSectionTone,
          isUnseen: viewportSectionsUnseen.control,
          children: (
            <>
              <p className={styles.ownershipLensHint}>
                {"COMMAND::/add person|system|external|container|component <label>"}
              </p>
              <p className={styles.ownershipLensHint}>
                {"COMMAND::/diagram <architecture description>"}
              </p>
              <p className={styles.ownershipLensHint}>
                {"COMMAND::/review [focus area]"}
              </p>
              <p className={styles.ownershipLensHint}>
                {`BOARD::${currentBoardLabel}`}
              </p>
              {boardContextHints.map((scope) => (
                <p key={scope.id} className={styles.ownershipLensHint}>
                  {`CONTEXT::${scope.label} · ${scope.hint}`}
                </p>
              ))}
              {activeCommandToken && (
                <p className={styles.ownershipLensHint}>
                  {"TOOL TOKEN ACTIVE:: "}
                  <span className={styles.opyCopilotCommandToken}>{activeCommandToken}</span>
                </p>
              )}
              {activeRun && (
                <p className={styles.ownershipLensHint}>
                  {`ACTIVE RUN::${activeRun.id.slice(0, 8)} · ${RUN_INTENT_LABEL[activeRun.intent]} · ${
                    RUN_STAGE_LABEL[activeRun.stage]
                  } · ${formatClockTime(activeRun.startedAt)}`}
                </p>
              )}
              {agentLifecycle.stage !== "idle" && (
                <p className={styles.ownershipLensHint}>
                  {`FLOW::${agentLifecycle.activeRequest?.label ?? "OPY"} · ${
                    LIFECYCLE_STAGE_LABEL[agentLifecycle.stage]
                  }`}
                </p>
              )}
              {!isRunning && lastLifecycleText && (
                <p className={styles.ownershipLensHint}>
                  {lastLifecycleText}
                </p>
              )}
              {!activeRun && latestRun?.status === "failed" && latestRun.errorSummary && (
                <p className={styles.ownershipLensHint}>
                  {`LAST FAILURE::${RUN_STAGE_LABEL[latestRun.stage]} · ${latestRun.errorSummary}`}
                </p>
              )}
              {agentLifecycle.lastTerminalStatus === "failed" && agentLifecycle.lastError && (
                <p className={styles.ownershipLensHint}>
                  {`LAST FLOW FAILURE::${
                    formatLifecycleFailureScope({
                      stage: agentLifecycle.lastFailureStage,
                      phase: agentLifecycle.lastFailurePhase,
                    })
                  } · ${agentLifecycle.lastError}`}
                </p>
              )}
              {!isRunning && activeInterruptedTasks.length > 0 && (
                <section className={styles.opyCopilotPlanCard} aria-label="OPY interrupted task queue">
                  <div className={styles.opyCopilotProposalHeader}>
                    <span>INTERRUPTED TASKS</span>
                    <span>{`${activeInterruptedTasks.length} PENDING`}</span>
                  </div>
                  <p className={styles.opyCopilotProposalSummary}>
                    SELECT A RESUMABLE TASK. THE ACTIVE CANDIDATE WILL AUTO-ADVANCE AS TASKS ARE DISMISSED OR RESOLVED.
                  </p>
                  <div className={styles.opyCopilotTaskTimeline}>
                    {activeInterruptedTasks.map((task) => {
                      const isSelected = task.id === agentLifecycle.resumableTaskId;
                      const lineageDiagnostics = getTaskLineageDiagnostics(task);
                      const resumePlan = buildTaskResumeBoundaryPlan(
                        task.sessionId,
                        task.request,
                        getTaskResumeTrail(task.id).toolCalls,
                      );
                      const resumePlanSummary = summarizeTaskResumeBoundaryPlan(resumePlan, 2);
                      const completedStepPreview = lineageDiagnostics.completedStepNames
                        .slice(0, 2)
                        .map(formatLineageCompletedStep)
                        .join(" · ");
                      const sessionScope = formatLineageSessionScope(lineageDiagnostics.sessionIds, sessionLookup);
                      const resumeOutcomeRollup = formatLineageResumeOutcomeRollup(
                        lineageDiagnostics.resumeOutcomeRollup,
                        { compact: true },
                      );

                      return (
                        <article
                          key={task.id}
                          className={styles.opyCopilotTaskCard}
                          data-status={task.status}
                          data-selected={isSelected ? "true" : "false"}
                        >
                          <button
                            type="button"
                            className={styles.opyCopilotTaskToggle}
                            onClick={() => {
                              handleSelectInterruptedLifecycleTask(task.id);
                            }}
                          >
                            <span className={styles.opyCopilotTaskToggleMain}>
                              <span>{`${task.request.label} :: ${LIFECYCLE_STAGE_LABEL[task.stage]}`}</span>
                              <span>{isSelected ? "ACTIVE RESUME SLOT" : "SELECT FOR RESUME"}</span>
                              <span>{formatTaskLineageSummary({
                                artifactCount: lineageDiagnostics.artifactKinds.length,
                                completedStepCount: lineageDiagnostics.completedStepNames.length,
                                segmentCount: lineageDiagnostics.segmentCount,
                              })}</span>
                              {lineageDiagnostics.sessionCount > 1 && (
                                <span>{`SESSIONS::${lineageDiagnostics.sessionCount}`}</span>
                              )}
                              {lineageDiagnostics.inheritedSegmentCount > 0 && (
                                <span>{`INHERITS::${lineageDiagnostics.inheritedSegmentCount}`}</span>
                              )}
                              {lineageDiagnostics.crossSessionSegmentCount > 0 && (
                                <span>{`CROSS-SESSION::${lineageDiagnostics.crossSessionSegmentCount}`}</span>
                              )}
                              {completedStepPreview.length > 0 && (
                                <span>{`READY STEPS::${completedStepPreview}`}</span>
                              )}
                              <span>{resumeOutcomeRollup}</span>
                            </span>
                            <span className={styles.opyCopilotTaskMeta}>
                              {`${formatClockTime(task.updatedAt)} · ${task.id.slice(0, 8)}`}
                            </span>
                          </button>
                          <p className={styles.ownershipLensHint}>{resumePlanSummary}</p>
                          {lineageDiagnostics.resumeOutcomeRollup.taskCount > 0 && (
                            <p className={styles.ownershipLensHint}>
                              {formatLineageResumeOutcomeRollup(lineageDiagnostics.resumeOutcomeRollup)}
                            </p>
                          )}
                          {lineageDiagnostics.sessionCount > 1 && (
                            <p className={styles.ownershipLensHint}>{`SESSION SCOPE::${sessionScope}`}</p>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </section>
              )}
              {!isRunning && agentLifecycle.resumableRequest && agentLifecycle.resumableStage && (
                <section className={styles.opyCopilotPlanCard} aria-label="OPY resumable task">
                  <div className={styles.opyCopilotProposalHeader}>
                    <span>{`RESUME::${agentLifecycle.resumableRequest.label}`}</span>
                    <span>{`INTERRUPTED AT ${LIFECYCLE_STAGE_LABEL[agentLifecycle.resumableStage]} · ${
                      activeInterruptedTasks.length
                    } PENDING`}</span>
                  </div>
                  <p className={styles.opyCopilotProposalSummary}>
                    {`TASK ${agentLifecycle.resumableTaskId?.slice(0, 8) ?? "UNKNOWN"} · ${
                      agentLifecycle.resumableUpdatedAt
                        ? formatClockTime(agentLifecycle.resumableUpdatedAt)
                        : "UNKNOWN TIME"
                    }`}
                  </p>
                  {selectedResumableTask && (() => {
                    const lineageDiagnostics = getTaskLineageDiagnostics(selectedResumableTask);
                    const resumePlan = buildTaskResumeBoundaryPlan(
                      selectedResumableTask.sessionId,
                      selectedResumableTask.request,
                      getTaskResumeTrail(selectedResumableTask.id).toolCalls,
                    );
                    const completedSteps = lineageDiagnostics.completedStepNames
                      .slice(0, 3)
                      .map(formatLineageCompletedStep)
                      .join(" · ");
                    const sessionScope = formatLineageSessionScope(lineageDiagnostics.sessionIds, sessionLookup);
                    const resumeOutcomeRollup = formatLineageResumeOutcomeRollup(
                      lineageDiagnostics.resumeOutcomeRollup,
                      { compact: true },
                    );

                    return (
                      <>
                        <p className={styles.ownershipLensHint}>
                          {`CHAIN::${lineageDiagnostics.segmentCount} · SESSIONS::${lineageDiagnostics.sessionCount} · INHERITS::${
                            lineageDiagnostics.inheritedSegmentCount
                          } · READY::${
                            completedSteps.length > 0 ? completedSteps : "FRESH EXECUTION"
                          }`}
                        </p>
                        <p className={styles.ownershipLensHint}>{summarizeTaskResumeBoundaryPlan(resumePlan)}</p>
                        <p className={styles.ownershipLensHint}>{resumeOutcomeRollup}</p>
                        {lineageDiagnostics.sessionCount > 1 && (
                          <p className={styles.ownershipLensHint}>{`SESSION SCOPE::${sessionScope}`}</p>
                        )}
                      </>
                    );
                  })()}
                  <div className={styles.opyCopilotProposalActions}>
                    <button
                      type="button"
                      className={styles.toolbarButton}
                      onClick={handleResumeInterruptedLifecycle}
                      disabled={isRunning}
                    >
                      RESUME TASK
                    </button>
                    <button
                      type="button"
                      className={styles.ownershipLensToggleButton}
                      onClick={handleDismissInterruptedLifecycle}
                      disabled={isRunning}
                    >
                      DISMISS TASK
                    </button>
                  </div>
                </section>
              )}
              {pendingLifecycleConfirmation && pendingLifecycleRequest
                && agentLifecycle.stage === "awaiting_confirmation" && (
                <section className={styles.opyCopilotPlanCard} aria-label="OPY pending confirmation">
                  <div className={styles.opyCopilotProposalHeader}>
                    <span>{`CONFIRM::${pendingLifecycleRequest.label}`}</span>
                    <span>AWAITING OPERATOR</span>
                  </div>
                  <div className={styles.opyCopilotProposalActions}>
                    <button
                      type="button"
                      className={styles.toolbarButton}
                      onClick={() => {
                        void handleConfirmPendingLifecycleAction();
                      }}
                      disabled={agentLifecycle.stage !== "awaiting_confirmation"}
                    >
                      CONFIRM ACTION
                    </button>
                    <button
                      type="button"
                      className={styles.ownershipLensToggleButton}
                      onClick={handleCancelPendingLifecycleAction}
                      disabled={agentLifecycle.stage !== "awaiting_confirmation"}
                    >
                      CANCEL ACTION
                    </button>
                  </div>
                  <div className={styles.opyCopilotPlanActionList}>
                    {pendingLifecycleConfirmation.confirmationLines
                      .filter((line) =>
                        line.trim().length > 0
                      )
                      .map((line, index) => (
                        <article
                          key={`${pendingLifecycleRequest.id}-confirm-${index}`}
                          className={styles.opyCopilotProposalItem}
                        >
                          <p>{line}</p>
                        </article>
                      ))}
                  </div>
                </section>
              )}
              {activeTasks.length > 0 && (
                <section className={styles.opyCopilotPlanCard} aria-label="OPY task history">
                  <div className={styles.opyCopilotProposalHeader}>
                    <span>TASK HISTORY</span>
                    <span>{`${filteredTaskHistoryEntries.length} SHOWN · ${activeTasks.length} RECORDED`}</span>
                  </div>
                  <p className={styles.opyCopilotProposalSummary}>
                    PERSISTED TASKS, TOOL CALLS, AND ARTIFACTS FOR THIS SESSION.
                  </p>
                  <div className={styles.formInlineRow}>
                    <div className={styles.inputGrow}>
                      <TacticalSelect
                        id="opy-task-history-chain-filter"
                        ariaLabel="Filter OPY task history by continuity chain"
                        value={taskHistoryChainFilter}
                        options={taskHistoryChainOptions}
                        onChange={(value) => {
                          setTaskHistoryChainFilter(value);
                          commitTaskHistoryFilterState({
                            chain: value,
                            boundary: taskHistoryBoundaryFilter,
                          });
                        }}
                      />
                    </div>
                    <div className={styles.inputGrow}>
                      <TacticalSelect
                        id="opy-task-history-boundary-filter"
                        ariaLabel="Filter OPY task history by resume boundary state"
                        value={taskHistoryBoundaryFilter}
                        options={TASK_HISTORY_BOUNDARY_OPTIONS}
                        onChange={(value) => {
                          const nextBoundary = value as OpyTaskHistoryBoundaryFilter;
                          setTaskHistoryBoundaryFilter(nextBoundary);
                          commitTaskHistoryFilterState({
                            chain: taskHistoryChainFilter,
                            boundary: nextBoundary,
                          });
                        }}
                      />
                    </div>
                  </div>
                  <p className={styles.ownershipLensHint}>
                    {`FILTER::CHAIN ${
                      taskHistoryChainFilter === TASK_HISTORY_CHAIN_FILTER_ALL ? "ALL" : "TARGETED"
                    } · BOUNDARY::${
                      taskHistoryBoundaryFilter === TASK_HISTORY_BOUNDARY_FILTER_ALL
                        ? "ALL"
                        : taskHistoryBoundaryFilter.toUpperCase().replaceAll("-", " ")
                    }`}
                  </p>
                  <div className={styles.opyCopilotTaskTimeline}>
                    {filteredTaskHistoryEntries.slice(0, 6).map((entry) => {
                      const { task, toolCalls, artifacts, lineageDiagnostics, resumePlan, persistedResumeOutcome } = entry;
                      const isExpanded = expandedTaskIds.includes(task.id);
                      const isLoading = taskDetailLoadingByTaskId[task.id] === true;
                      const isResumable = agentLifecycle.resumableTaskId === task.id;
                      const resumableChainTask = resumableTaskByContinuityKey.get(lineageDiagnostics.continuityKey) ?? null;
                      const resumeDiagnosticsSummary = persistedResumeOutcome
                        ? summarizePersistedResumeBoundaryOutcome(persistedResumeOutcome)
                        : summarizeTaskResumeBoundaryPlan(resumePlan);
                      const completedStepPreview = lineageDiagnostics.completedStepNames
                        .slice(0, 2)
                        .map(formatLineageCompletedStep)
                        .join(" · ");
                      const sessionScope = formatLineageSessionScope(lineageDiagnostics.sessionIds, sessionLookup);
                      const lineageResumeOutcomeRollup = formatLineageResumeOutcomeRollup(
                        lineageDiagnostics.resumeOutcomeRollup,
                        { compact: true },
                      );

                      return (
                        <article
                          key={task.id}
                          className={styles.opyCopilotTaskCard}
                          data-status={task.status}
                          data-expanded={isExpanded ? "true" : "false"}
                          ref={(node) => {
                            taskHistoryCardRefs.current[task.id] = node;
                          }}
                        >
                          <button
                            type="button"
                            className={styles.opyCopilotTaskToggle}
                            aria-expanded={isExpanded}
                            onClick={() => {
                              toggleExpandedTask(task.id);
                            }}
                          >
                            <span className={styles.opyCopilotTaskToggleMain}>
                              <span>{`${task.request.label} :: ${TASK_STATUS_LABEL[task.status]}`}</span>
                              <span>{`STAGE::${formatTaskStageLabel(task.stage)}`}</span>
                              <span>{formatTaskLineageSummary({
                                artifactCount: lineageDiagnostics.artifactKinds.length,
                                completedStepCount: lineageDiagnostics.completedStepNames.length,
                                segmentCount: lineageDiagnostics.segmentCount,
                              })}</span>
                              {lineageDiagnostics.sessionCount > 1 && (
                                <span>{`SESSIONS::${lineageDiagnostics.sessionCount}`}</span>
                              )}
                              {lineageDiagnostics.inheritedSegmentCount > 0 && (
                                <span>{`INHERITS::${lineageDiagnostics.inheritedSegmentCount}`}</span>
                              )}
                              {lineageDiagnostics.crossSessionSegmentCount > 0 && (
                                <span>{`CROSS-SESSION::${lineageDiagnostics.crossSessionSegmentCount}`}</span>
                              )}
                              {completedStepPreview.length > 0 && (
                                <span>{`READY::${completedStepPreview}`}</span>
                              )}
                              <span>{lineageResumeOutcomeRollup}</span>
                              <span>{resumeDiagnosticsSummary}</span>
                              {isResumable && <span>RESUMABLE</span>}
                            </span>
                            <span className={styles.opyCopilotTaskMeta}>
                              {`${formatClockTime(task.updatedAt)} · ${task.id.slice(0, 8)}`}
                            </span>
                          </button>
                          <div className={styles.opyCopilotProposalActions}>
                            <button
                              type="button"
                              className={styles.ownershipLensToggleButton}
                              onClick={() => {
                                handleOpenTaskHistoryDetail(task.id);
                              }}
                            >
                              OPEN DETAIL
                            </button>
                            <button
                              type="button"
                              className={styles.ownershipLensToggleButton}
                              onClick={() => {
                                handleOpenTaskHistoryChain(task);
                              }}
                              disabled={!resumableChainTask || isRunning}
                            >
                              {resumableChainTask ? "OPEN CHAIN" : "NO CHAIN"}
                            </button>
                            <button
                              type="button"
                              className={styles.ownershipLensToggleButton}
                              onClick={() => {
                                handleOpenTaskHistoryFocusSection(entry);
                              }}
                            >
                              {formatTaskHistoryFocusLabel(task)}
                            </button>
                          </div>
                          {isExpanded && (
                            <div className={styles.opyCopilotTaskDetail}>
                              <p className={styles.ownershipLensHint}>
                                {`TASK::${task.id} · MODE::${task.request.mode.toUpperCase()} · KIND::${task.request.kind.toUpperCase()}`}
                              </p>
                              <p className={styles.ownershipLensHint}>
                                {`CONTINUITY::${lineageDiagnostics.continuityKey} · LINEAGE::${lineageDiagnostics.lineageKey} · SEGMENTS::${
                                  lineageDiagnostics.segmentCount
                                } · SESSIONS::${lineageDiagnostics.sessionCount} · INHERITED::${
                                  lineageDiagnostics.inheritedSegmentCount
                                }`}
                              </p>
                              <p className={styles.ownershipLensHint}>
                                {formatLineageResumeOutcomeRollup(lineageDiagnostics.resumeOutcomeRollup)}
                              </p>
                              <p className={styles.ownershipLensHint}>{`RESUME PLAN::${summarizeTaskResumeBoundaryPlan(resumePlan)}`}</p>
                              {persistedResumeOutcome && (
                                <p className={styles.ownershipLensHint}>
                                  {`RESUME OUTCOME::${summarizePersistedResumeBoundaryOutcome(persistedResumeOutcome)}`}
                                </p>
                              )}
                              {lineageDiagnostics.sessionCount > 1 && (
                                <p className={styles.ownershipLensHint}>{`SESSION SCOPE::${sessionScope}`}</p>
                              )}
                              {lineageDiagnostics.completedStepNames.length > 0 && (
                                <p className={styles.ownershipLensHint}>
                                  {`READY BOUNDARIES::${
                                    lineageDiagnostics.completedStepNames.map(formatLineageCompletedStep).join(" · ")
                                  }`}
                                </p>
                              )}
                              {task.errorSummary && (
                                <p className={styles.opyCopilotError}>{`TASK ERROR:: ${task.errorSummary}`}</p>
                              )}
                              {isLoading ? <p className={styles.ownershipLensHint}>TRACE::LOADING</p> : (
                                <>
                                  <div className={styles.opyCopilotTaskTraceGrid}>
                                    {toolCalls.length > 0
                                      ? toolCalls.map((toolCall) => (
                                        <article
                                          key={toolCall.id}
                                          className={styles.opyCopilotTaskTraceItem}
                                          data-status={toolCall.status}
                                        >
                                          <p>
                                            {`${toolCall.name.toUpperCase()} :: ${
                                              TOOL_CALL_STATUS_LABEL[toolCall.status]
                                            }`}
                                          </p>
                                          {toolCall.inputSummary && (
                                            <p className={styles.ownershipLensHint}>
                                              {`INPUT::${toolCall.inputSummary}`}
                                            </p>
                                          )}
                                          {toolCall.outputSummary && (
                                            <p className={styles.ownershipLensHint}>
                                              {`OUTPUT::${toolCall.outputSummary}`}
                                            </p>
                                          )}
                                          {toolCall.errorSummary && (
                                            <p className={styles.opyCopilotError}>
                                              {`TRACE ERROR:: ${toolCall.errorSummary}`}
                                            </p>
                                          )}
                                        </article>
                                      ))
                                      : (
                                        <p className={styles.ownershipLensHint}>
                                          NO TOOL CALL TRACE CAPTURED FOR THIS TASK.
                                        </p>
                                      )}
                                  </div>
                                  <div className={styles.opyCopilotTaskArtifactStack}>
                                    {artifacts.length > 0
                                      ? artifacts.map((artifact) => (
                                        <article key={artifact.id} className={styles.opyCopilotTaskTraceItem}>
                                          <p>{`${artifact.kind.toUpperCase()} :: ${artifact.summary}`}</p>
                                          <pre className={styles.opyCopilotTaskArtifactPayload}>
                                          {JSON.stringify(artifact.payload, null, 2)}
                                          </pre>
                                        </article>
                                      ))
                                      : (
                                        <p className={styles.ownershipLensHint}>NO ARTIFACTS CAPTURED FOR THIS TASK.</p>
                                      )}
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })}
                    {filteredTaskHistoryEntries.length === 0 && (
                      <p className={styles.ownershipLensHint}>
                        NO TASKS MATCH THE CURRENT CHAIN / BOUNDARY FILTER.
                      </p>
                    )}
                  </div>
                </section>
              )}
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="opy-session-select">
                  Session
                </label>
                <div className={styles.formInlineRow}>
                  <div className={styles.inputGrow}>
                    <TacticalSelect
                      id="opy-session-select"
                      ariaLabel="Select OPY chat session"
                      value={selectedSessionId}
                      options={sessionOptions}
                      disabled={isSessionLoading || sessionOptions.length === 0}
                      onChange={handleSelectSession}
                    />
                  </div>
                </div>
                {selectedSession && (
                  <p className={styles.ownershipLensHint}>
                    {`RESUME::${
                      formatClockTime(
                        selectedSession.lastMessageAt ?? selectedSession.updatedAt,
                      )
                    } · NODES::${nodeCount} · EDGES::${edgeCount}`}
                  </p>
                )}
                <div className={styles.ownershipLensToggleRow}>
                  <button
                    type="button"
                    className={styles.ownershipLensToggleButton}
                    onClick={handleCreateSession}
                    disabled={isRunning || isSessionLoading}
                  >
                    NEW SESSION
                  </button>
                </div>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="opy-session-title">
                  Session Name
                </label>
                <div className={styles.formInlineRow}>
                  <input
                    id="opy-session-title"
                    type="text"
                    className={`${styles.input} ${styles.inputGrow}`}
                    value={sessionTitleDraft}
                    onChange={(event) => {
                      setSessionTitleDraft(event.target.value);
                      if (runtimeError) {
                        setRuntimeError(null);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleRenameSession();
                      }
                    }}
                    disabled={isSessionLoading || selectedSessionId.length === 0}
                    placeholder="Session title"
                  />
                  <button
                    type="button"
                    className={styles.ownershipLensToggleButton}
                    onClick={handleRenameSession}
                    disabled={isRunning || isSessionLoading || selectedSessionId.length === 0}
                  >
                    SAVE NAME
                  </button>
                </div>
              </div>
              <section
                className={`${styles.opyCopilotModeBanner} ${
                  actionModeSurface.tone === "critical"
                    ? styles.opyCopilotModeBannerCritical
                    : actionModeSurface.tone === "warning"
                    ? styles.opyCopilotModeBannerWarning
                    : styles.opyCopilotModeBannerReady
                }`}
                aria-label="OPY action mode boundary"
              >
                <div className={styles.opyCopilotProposalHeader}>
                  <span>{`MODE POLICY::${actionMode.toUpperCase()}`}</span>
                  <span>{actionModeSurface.label}</span>
                </div>
                <p className={styles.opyCopilotProposalHint}>{actionModeSurface.detail}</p>
              </section>
            </>
          ),
        })}
        {latestDiagnosticsSurface && (
          renderViewportSection({
            keyId: "diagnostics",
            title: `DIAGNOSTICS::${latestDiagnosticsSurface.title}`,
            meta: diagnosticsSectionMeta,
            summary: diagnosticsSectionSummary,
            tone: diagnosticsSectionTone,
            isUnseen: viewportSectionsUnseen.diagnostics,
            children: (
              <section
                ref={(node) => {
                  diagnosticsCardRef.current = node;
                }}
                className={styles.opyCopilotDiagnosticsCard}
                aria-label="Latest OPY diagnostics"
              >
                <div className={styles.opyCopilotProposalHeader}>
                  <span>{`DIAGNOSTICS::${latestDiagnosticsSurface.title}`}</span>
                  <span>{formatClockTime(latestDiagnosticsSurface.respondedAtMs)}</span>
                </div>
                <p className={styles.opyCopilotProposalSummary}>{latestDiagnosticsSurface.summary}</p>
                <p className={styles.opyCopilotProposalHint}>{latestDiagnosticsSurface.detail}</p>
                <div className={styles.opyCopilotProposalStats}>
                  <span>{`CONFIDENCE::${formatConfidence(latestDiagnosticsSurface.context.confidence)}`}</span>
                  <span>{`SOURCES::${latestDiagnosticsSurface.context.citations.length}`}</span>
                  <span>{`MODEL::${latestDiagnosticsSurface.model}`}</span>
                  <span>{`PROVIDER::${latestDiagnosticsSurface.provider}`}</span>
                  <span>
                    {latestDiagnosticsSurface.run
                      ? `RUN::${RUN_STATUS_LABEL[latestDiagnosticsSurface.run.status]}`
                      : "RUN::UNTRACKED"}
                  </span>
                  <span>
                    {latestDiagnosticsSurface.run
                      ? `STAGE::${RUN_STAGE_LABEL[latestDiagnosticsSurface.run.stage]}`
                      : "STAGE::N/A"}
                  </span>
                </div>
                <details className={styles.opyCopilotDiagnosticsDisclosure}>
                  <summary className={styles.opyCopilotDiagnosticsSummary}>
                    {`PROVENANCE::${latestDiagnosticsSurface.context.citations.length} SOURCE(S)`}
                  </summary>
                  <p className={styles.opyCopilotProposalHint}>
                    {`CONFIDENCE REASON:: ${latestDiagnosticsSurface.context.confidenceReason}`}
                  </p>
                  <div className={styles.opyCopilotEvidenceList}>
                    {latestDiagnosticsSurface.context.citations.map((citation) => (
                      <article key={citation.id} className={styles.opyCopilotEvidenceItem}>
                        <div className={styles.opyCopilotProposalItemMeta}>
                          <span>{citation.tool.toUpperCase()}</span>
                          <span>{citation.label}</span>
                        </div>
                        <p className={styles.opyCopilotProposalHint}>{citation.detail}</p>
                      </article>
                    ))}
                  </div>
                </details>
                <details className={styles.opyCopilotDiagnosticsDisclosure}>
                  <summary className={styles.opyCopilotDiagnosticsSummary}>RUN DIAGNOSTICS</summary>
                  {latestDiagnosticsSurface.run
                    ? (
                      <div className={styles.opyCopilotDiagnosticsMetaGrid}>
                        <span>{`RUN ID::${latestDiagnosticsSurface.run.id.slice(0, 8)}`}</span>
                        <span>{`INTENT::${RUN_INTENT_LABEL[latestDiagnosticsSurface.run.intent]}`}</span>
                        <span>{`STATUS::${RUN_STATUS_LABEL[latestDiagnosticsSurface.run.status]}`}</span>
                        <span>{`STAGE::${RUN_STAGE_LABEL[latestDiagnosticsSurface.run.stage]}`}</span>
                        <span>{`STARTED::${formatClockTime(latestDiagnosticsSurface.run.startedAt)}`}</span>
                        <span>
                          {latestDiagnosticsSurface.run.completedAt
                            ? `ENDED::${formatClockTime(latestDiagnosticsSurface.run.completedAt)}`
                            : "ENDED::PENDING"}
                        </span>
                      </div>
                    )
                    : (
                      <p className={styles.opyCopilotProposalHint}>
                        RUN ENVELOPE UNAVAILABLE FOR THIS RESPONSE.
                      </p>
                    )}
                  {latestDiagnosticsSurface.run?.errorSummary && (
                    <p className={styles.opyCopilotProposalHint}>
                      {`ERROR:: ${latestDiagnosticsSurface.run.errorSummary}`}
                    </p>
                  )}
                </details>
              </section>
            ),
          })
        )}
        {activeCheckpoints.length > 0 && latestCheckpoint && (
          renderViewportSection({
            keyId: "checkpoints",
            title: "CHECKPOINT HISTORY",
            meta: checkpointsSectionMeta,
            summary: checkpointsSectionSummary,
            tone: checkpointsSectionTone,
            isUnseen: viewportSectionsUnseen.checkpoints,
            children: (
              <section className={styles.opyCopilotPlanCard} aria-label="OPY checkpoint history">
                <div className={styles.opyCopilotProposalHeader}>
                  <span>{`CHECKPOINTS::${activeCheckpoints.length}`}</span>
                  <span>{`LATEST::${latestCheckpoint.id.slice(0, 8)}`}</span>
                </div>
                <p className={styles.opyCopilotProposalHint}>
                  RESTORABLE PRE-APPLY SNAPSHOTS CAPTURED BEFORE CONFIRMED OPY BOARD MUTATIONS.
                </p>
                <div className={styles.opyCopilotProposalStats}>
                  <span>{`LATEST BOARD::${latestCheckpoint.snapshot.name}`}</span>
                  <span>{`LATEST CREATED::${formatClockTime(latestCheckpoint.createdAt)}`}</span>
                  <span>{`LATEST PROPOSAL::${formatClockTime(latestCheckpoint.proposalRespondedAtMs)}`}</span>
                </div>
                <details className={styles.opyCopilotDiagnosticsDisclosure}>
                  <summary className={styles.opyCopilotDiagnosticsSummary}>
                    {`RESTORE TARGETS::${activeCheckpoints.length}`}
                  </summary>
                  <div className={styles.opyCopilotPlanActionList}>
                    {activeCheckpoints.map((checkpoint, index) => {
                      const checkpointProposal = findProposalForCheckpoint(checkpoint, activeProposalHistory);
                      const checkpointPreview = checkpointRestorePreviewById.get(checkpoint.id) ?? null;
                      return (
                        <article
                          key={checkpoint.id}
                          ref={(node) => {
                            checkpointCardRefs.current[checkpoint.id] = node;
                          }}
                          className={styles.opyCopilotProposalItem}
                        >
                          <div className={styles.opyCopilotProposalItemMeta}>
                            <span>{`CHECKPOINT::${checkpoint.id.slice(0, 8)}`}</span>
                            <span>{index === 0 ? "LATEST" : checkpoint.checkpointType.toUpperCase()}</span>
                          </div>
                          <p>{formatOpyRollbackSummary(checkpoint)}</p>
                          <div className={styles.opyCopilotProposalStats}>
                            <span>{`BOARD::${checkpoint.snapshot.name}`}</span>
                            <span>{`CREATED::${formatClockTime(checkpoint.createdAt)}`}</span>
                            <span>{`PROPOSAL::${formatClockTime(checkpoint.proposalRespondedAtMs)}`}</span>
                            <span>{`NODES::${checkpoint.snapshot.nodes.length}`}</span>
                            <span>{`EDGES::${checkpoint.snapshot.edges.length}`}</span>
                          </div>
                          {checkpointPreview
                            ? (
                              <>
                                <div className={styles.opyCopilotProposalStats}>
                                  <span>{`RESTORE NODES::${checkpointPreview.counts.restoreNodes}`}</span>
                                  <span>{`REVERT NODES::${checkpointPreview.counts.revertNodes}`}</span>
                                  <span>{`REMOVE NODES::${checkpointPreview.counts.removeNodes}`}</span>
                                  <span>{`RESTORE EDGES::${checkpointPreview.counts.restoreEdges}`}</span>
                                  <span>{`REVERT EDGES::${checkpointPreview.counts.revertEdges}`}</span>
                                  <span>{`REMOVE EDGES::${checkpointPreview.counts.removeEdges}`}</span>
                                </div>
                                <details className={styles.opyCopilotDiagnosticsDisclosure}>
                                  <summary className={styles.opyCopilotDiagnosticsSummary}>
                                    {checkpointPreview.hasChanges
                                      ? `RESTORE DIFF::${checkpointPreview.impactedEntities.length} CHANGE(S)`
                                      : "RESTORE DIFF::NO CHANGES"}
                                  </summary>
                                  {checkpointPreview.hasChanges
                                    ? (
                                      <div className={styles.opyCopilotPlanImpactList}>
                                        {checkpointPreview.impactedEntities.map((impact) => (
                                          <article key={impact.id} className={styles.opyCopilotProposalItem}>
                                            <div className={styles.opyCopilotProposalItemMeta}>
                                              <span>{impact.category.toUpperCase()}</span>
                                              <span className={restoreImpactBadgeClassName(impact.status)}>
                                                {RESTORE_IMPACT_LABEL[impact.status]}
                                              </span>
                                            </div>
                                            <p>{impact.title}</p>
                                            <p className={styles.opyCopilotProposalHint}>{impact.detail}</p>
                                          </article>
                                        ))}
                                      </div>
                                    )
                                    : (
                                      <p className={styles.opyCopilotProposalHint}>
                                        CHECKPOINT SNAPSHOT ALREADY MATCHES THE CURRENT BOARD STATE.
                                      </p>
                                    )}
                                </details>
                              </>
                            )
                            : (
                              <p className={styles.opyCopilotProposalHint}>
                                RESTORE DIFF PREVIEW UNAVAILABLE UNTIL A NORMALIZED BOARD SUMMARY IS ACTIVE.
                              </p>
                            )}
                          {checkpointProposal
                            ? (
                              <>
                                <p className={styles.opyCopilotProposalSummary}>
                                  {`PROPOSAL:: ${checkpointProposal.proposal.summary}`}
                                </p>
                                <p className={styles.opyCopilotProposalHint}>
                                  {`SOURCE:: ${checkpointProposal.command.description}`}
                                </p>
                                <p className={styles.opyCopilotProposalHint}>
                                  {`PLAN::${PLAN_DECISION_LABEL[checkpointProposal.decisionStatus]} · CONFIDENCE::${
                                    formatConfidence(checkpointProposal.context.confidence)
                                  }`}
                                </p>
                              </>
                            )
                            : (
                              <p className={styles.opyCopilotProposalHint}>
                                PROPOSAL PROVENANCE UNAVAILABLE FOR THIS CHECKPOINT IN CURRENT SESSION HISTORY.
                              </p>
                            )}
                          <div className={styles.opyCopilotPlanDecisionRow}>
                            <button
                              type="button"
                              className={styles.toolbarButton}
                              onClick={() => {
                                void handleRestoreCheckpoint(checkpoint);
                              }}
                              disabled={isRunning || actionMode !== "apply-with-confirmation"}
                            >
                              {isRunning ? "RESTORING..." : index === 0 ? "ROLLBACK LATEST" : "RESTORE CHECKPOINT"}
                            </button>
                            <p className={styles.opyCopilotProposalHint}>
                              {actionMode === "apply-with-confirmation"
                                ? index === 0
                                  ? "RESTORE THE MOST RECENT CONFIRMED OPY CHECKPOINT THROUGH THE SAVE BOUNDARY."
                                  : "RESTORE THIS HISTORICAL CHECKPOINT DELIBERATELY THROUGH THE SAVE BOUNDARY."
                                : "SWITCH ACTION MODE TO APPLY-WITH-CONFIRMATION TO EXECUTE RESTORE."}
                            </p>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </details>
              </section>
            ),
          })
        )}
        {activeBoardReview && (
          renderViewportSection({
            keyId: "review",
            title: "BOARD REVIEW",
            meta: reviewSectionMeta,
            summary: reviewSectionSummary,
            tone: reviewSectionTone,
            isUnseen: viewportSectionsUnseen.review,
            children: (
              <section
                ref={(node) => {
                  reviewCardRef.current = node;
                }}
                className={styles.opyCopilotProposalCard}
                aria-label="Latest OPY board review"
              >
                <div className={styles.opyCopilotProposalHeader}>
                  <span>REVIEW::C4</span>
                  <span>{formatClockTime(activeBoardReview.review.respondedAtMs)}</span>
                </div>
                <p className={styles.opyCopilotProposalSummary}>{activeBoardReview.review.summary}</p>
                <p className={styles.opyCopilotProposalHint}>
                  {`CONFIDENCE:: ${
                    formatConfidence(activeBoardReview.context.confidence)
                  } · ${activeBoardReview.context.confidenceReason}`}
                </p>
                <p className={styles.ownershipLensHint}>
                  {`FOCUS:: ${formatReviewFocus(activeBoardReview.command.focus)}`}
                </p>
                {boardSummary && (
                  <div className={styles.opyCopilotProposalStats}>
                    <span>{`BOARD::${boardSummary.nodeCount}N/${boardSummary.edgeCount}E`}</span>
                    <span>{`STRENGTHS::${activeBoardReview.review.strengths.length}`}</span>
                    <span>{`RISKS::${activeBoardReview.review.risks.length}`}</span>
                    <span>{`AMBIGUITIES::${activeBoardReview.review.ambiguities.length}`}</span>
                    <span>{`RECOMMEND::${activeBoardReview.review.recommendedChanges.length}`}</span>
                  </div>
                )}
                <div className={styles.opyCopilotEvidenceList}>
                  {activeBoardReview.context.citations.map((citation) => (
                    <article key={citation.id} className={styles.opyCopilotEvidenceItem}>
                      <div className={styles.opyCopilotProposalItemMeta}>
                        <span>{citation.tool.toUpperCase()}</span>
                        <span>{citation.label}</span>
                      </div>
                      <p className={styles.opyCopilotProposalHint}>{citation.detail}</p>
                    </article>
                  ))}
                </div>
                <div className={styles.opyCopilotProposalColumns}>
                  <div className={styles.opyCopilotProposalColumn}>
                    <div className={styles.opyCopilotProposalHeader}>
                      <span>{`STRENGTHS::${activeBoardReview.review.strengths.length}`}</span>
                      <span>READ ONLY</span>
                    </div>
                    {activeBoardReview.review.strengths.length > 0
                      ? activeBoardReview.review.strengths.map((strength, index) => (
                        <article
                          key={`${strength.title}-${index}`}
                          className={styles.opyCopilotProposalItem}
                        >
                          <div className={styles.opyCopilotProposalItemMeta}>
                            <span>STRENGTH</span>
                          </div>
                          <p>{strength.title}</p>
                          <p className={styles.opyCopilotProposalHint}>{strength.detail}</p>
                        </article>
                      ))
                      : (
                        <article className={styles.opyCopilotProposalItem}>
                          <p>NO MAJOR STRENGTHS CALLED OUT.</p>
                        </article>
                      )}
                  </div>
                  <div className={styles.opyCopilotProposalColumn}>
                    <div className={styles.opyCopilotProposalHeader}>
                      <span>{`RISKS::${activeBoardReview.review.risks.length}`}</span>
                      <span>{activeBoardReview.review.model}</span>
                    </div>
                    {activeBoardReview.review.risks.length > 0
                      ? activeBoardReview.review.risks.map((risk, index) => (
                        <article
                          key={`${risk.title}-${index}`}
                          className={styles.opyCopilotProposalItem}
                        >
                          <div className={styles.opyCopilotProposalItemMeta}>
                            <span>RISK</span>
                            <span
                              className={`${styles.opyCopilotProposalBadge} ${
                                risk.severity === "high"
                                  ? styles.opyCopilotReviewBadgeHigh
                                  : risk.severity === "medium"
                                  ? styles.opyCopilotReviewBadgeMedium
                                  : styles.opyCopilotReviewBadgeLow
                              }`}
                            >
                              {risk.severity.toUpperCase()}
                            </span>
                          </div>
                          <p>{risk.title}</p>
                          <p className={styles.opyCopilotProposalHint}>{risk.detail}</p>
                        </article>
                      ))
                      : (
                        <article className={styles.opyCopilotProposalItem}>
                          <p>NO MATERIAL RISKS IDENTIFIED.</p>
                        </article>
                      )}
                  </div>
                  <div className={styles.opyCopilotProposalColumn}>
                    <div className={styles.opyCopilotProposalHeader}>
                      <span>{`AMBIGUITIES::${activeBoardReview.review.ambiguities.length}`}</span>
                      <span>GAPS</span>
                    </div>
                    {activeBoardReview.review.ambiguities.length > 0
                      ? activeBoardReview.review.ambiguities.map((ambiguity, index) => (
                        <article
                          key={`${ambiguity.title}-${index}`}
                          className={styles.opyCopilotProposalItem}
                        >
                          <div className={styles.opyCopilotProposalItemMeta}>
                            <span>AMBIGUITY</span>
                          </div>
                          <p>{ambiguity.title}</p>
                          <p className={styles.opyCopilotProposalHint}>{ambiguity.detail}</p>
                        </article>
                      ))
                      : (
                        <article className={styles.opyCopilotProposalItem}>
                          <p>NO MAJOR AMBIGUITIES IDENTIFIED.</p>
                        </article>
                      )}
                    {activeBoardReview.review.missingNodes.length > 0 && (
                      <div className={styles.opyCopilotProposalWarnings}>
                        {activeBoardReview.review.missingNodes.map((node, index) => (
                          <p key={`${node}-${index}`}>{`MISSING NODE:: ${node}`}</p>
                        ))}
                      </div>
                    )}
                    {activeBoardReview.review.missingEdges.length > 0 && (
                      <div className={styles.opyCopilotProposalWarnings}>
                        {activeBoardReview.review.missingEdges.map((edge, index) => (
                          <p key={`${edge}-${index}`}>{`MISSING EDGE:: ${edge}`}</p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className={styles.opyCopilotProposalColumn}>
                    <div className={styles.opyCopilotProposalHeader}>
                      <span>{`RECOMMEND::${activeBoardReview.review.recommendedChanges.length}`}</span>
                      <span>NEXT</span>
                    </div>
                    {activeBoardReview.review.recommendedChanges.length > 0
                      ? activeBoardReview.review.recommendedChanges.map((change, index) => (
                        <article
                          key={`${change.title}-${index}`}
                          className={styles.opyCopilotProposalItem}
                        >
                          <div className={styles.opyCopilotProposalItemMeta}>
                            <span>CHANGE</span>
                            <span
                              className={`${styles.opyCopilotProposalBadge} ${
                                change.priority === "high"
                                  ? styles.opyCopilotReviewBadgeHigh
                                  : change.priority === "medium"
                                  ? styles.opyCopilotReviewBadgeMedium
                                  : styles.opyCopilotReviewBadgeLow
                              }`}
                            >
                              {change.priority.toUpperCase()}
                            </span>
                          </div>
                          <p>{change.title}</p>
                          <p className={styles.opyCopilotProposalHint}>{change.rationale}</p>
                        </article>
                      ))
                      : (
                        <article className={styles.opyCopilotProposalItem}>
                          <p>NO IMMEDIATE STRUCTURAL CHANGES RECOMMENDED.</p>
                        </article>
                      )}
                  </div>
                </div>
                <div className={styles.opyCopilotProposalActions}>
                  <p className={styles.opyCopilotProposalHint}>
                    {"REVIEW MODE ONLY. USE /diagram TO REQUEST A TARGETED C4 CHANGE PROPOSAL."}
                  </p>
                </div>
              </section>
            ),
          })
        )}
        {activeDiagramProposal && (
          renderViewportSection({
            keyId: "proposal",
            title: "DIAGRAM PROPOSAL",
            meta: proposalSectionMeta,
            summary: proposalSectionSummary,
            tone: proposalSectionTone,
            isUnseen: viewportSectionsUnseen.proposal,
            children: (
              <section
                ref={(node) => {
                  proposalCardRef.current = node;
                }}
                className={styles.opyCopilotProposalCard}
                aria-label="Latest OPY diagram proposal"
              >
                <div className={styles.opyCopilotProposalHeader}>
                  <span>PROPOSAL::C4</span>
                  <span>{formatClockTime(activeDiagramProposal.proposal.respondedAtMs)}</span>
                </div>
                <p className={styles.opyCopilotProposalSummary}>{activeDiagramProposal.proposal.summary}</p>
                <p className={styles.opyCopilotProposalRationale}>{activeDiagramProposal.proposal.rationale}</p>
                <p className={styles.opyCopilotProposalHint}>
                  {`CONFIDENCE:: ${
                    formatConfidence(activeDiagramProposal.context.confidence)
                  } · ${activeDiagramProposal.context.confidenceReason}`}
                </p>
                <p className={styles.ownershipLensHint}>
                  {`SOURCE:: ${activeDiagramProposal.command.description}`}
                </p>
                {activeProposalSummary && (
                  <p className={styles.opyCopilotProposalHint}>
                    {activeProposalSummary.canApply
                      ? activeProposalSummary.hasChanges
                        ? `APPLY READY:: +${activeProposalSummary.newNodes} NODE(S) · +${activeProposalSummary.newEdges} EDGE(S) · REUSE ${activeProposalSummary.existingNodes} NODE(S) / ${activeProposalSummary.existingEdges} EDGE(S).`
                        : "APPLY NO-OP:: PROPOSAL ALREADY MATCHES THE CURRENT BOARD."
                      : `APPLY BLOCKED:: ${activeProposalSummary.ambiguousNodes} AMBIGUOUS NODE(S) · ${activeProposalSummary.ambiguousEdges} AMBIGUOUS EDGE(S).`}
                  </p>
                )}
                {boardSummary && activeGroundedProposal && activeProposalSummary && (
                  <div className={styles.opyCopilotProposalStats}>
                    <span>{`BOARD::${boardSummary.nodeCount}N/${boardSummary.edgeCount}E`}</span>
                    <span>
                      {`NODE DIFF::${activeProposalSummary.newNodes} NEW · ${activeProposalSummary.existingNodes} MATCH · ${activeProposalSummary.ambiguousNodes} AMBIG`}
                    </span>
                    <span>
                      {`EDGE DIFF::${activeProposalSummary.newEdges} NEW · ${activeProposalSummary.existingEdges} MATCH · ${activeProposalSummary.ambiguousEdges} AMBIG`}
                    </span>
                  </div>
                )}
                {activeMutationPlan && activePlanDecision && (
                  <section
                    ref={(node) => {
                      proposalPlanCardRef.current = node;
                    }}
                    className={styles.opyCopilotPlanCard}
                    aria-label="Typed mutation plan"
                  >
                    <div className={styles.opyCopilotProposalHeader}>
                      <span>{`PLAN::${PLAN_DECISION_LABEL[activePlanDecision.status]}`}</span>
                      <span>{activeMutationPlan.canApprove ? "SAFE TO APPROVE" : "BLOCKED"}</span>
                    </div>
                    <p className={styles.opyCopilotProposalHint}>
                      {formatPlanDecisionHint(activePlanDecision.status)}
                    </p>
                    <div className={styles.opyCopilotProposalStats}>
                      <span>{`ACTIONS::${activeMutationPlan.plan.totalActions}`}</span>
                      <span>{`CREATE NODES::${activeMutationPlan.plan.totalNodesCreated}`}</span>
                      <span>{`CREATE EDGES::${activeMutationPlan.plan.totalEdgesCreated}`}</span>
                      <span>{`LAYOUT::${activeMutationPlan.plan.totalLayoutOperations}`}</span>
                      <span>{`RISK::${activeMutationPlan.plan.highestRisk.toUpperCase()}`}</span>
                      <span>{`ISSUES::${activeMutationPlan.issues.length}`}</span>
                    </div>
                    {activeMutationPlan.issues.length > 0 && (
                      <div className={styles.opyCopilotPlanIssueList}>
                        {activeMutationPlan.issues.map((issue) => (
                          <article key={issue.id} className={styles.opyCopilotProposalItem}>
                            <div className={styles.opyCopilotProposalItemMeta}>
                              <span>{issue.kind.toUpperCase()}</span>
                              <span
                                className={`${styles.opyCopilotProposalBadge} ${styles.opyCopilotProposalBadgeAmbiguous}`}
                              >
                                BLOCKED
                              </span>
                            </div>
                            <p>{issue.title}</p>
                            <p className={styles.opyCopilotProposalHint}>{issue.detail}</p>
                          </article>
                        ))}
                      </div>
                    )}
                    <details className={styles.opyCopilotDiagnosticsDisclosure}>
                      <summary className={styles.opyCopilotDiagnosticsSummary}>
                        {`IMPACTED ENTITIES::${activeMutationPlan.impactedEntities.length}`}
                      </summary>
                      <div className={styles.opyCopilotPlanImpactList}>
                        {activeMutationPlan.impactedEntities.map((entity) => (
                          <article key={entity.id} className={styles.opyCopilotProposalItem}>
                            <div className={styles.opyCopilotProposalItemMeta}>
                              <span>{`${entity.category.toUpperCase()} · ${entity.status.toUpperCase()}`}</span>
                              <span
                                className={`${styles.opyCopilotProposalBadge} ${
                                  entity.status === "create"
                                    ? styles.opyCopilotProposalBadgeNew
                                    : entity.status === "reuse"
                                    ? styles.opyCopilotProposalBadgeExisting
                                    : styles.opyCopilotProposalBadgeAmbiguous
                                }`}
                              >
                                {entity.status.toUpperCase()}
                              </span>
                            </div>
                            <p>{entity.title}</p>
                            <p className={styles.opyCopilotProposalHint}>{entity.detail}</p>
                          </article>
                        ))}
                      </div>
                    </details>
                    <details className={styles.opyCopilotDiagnosticsDisclosure}>
                      <summary className={styles.opyCopilotDiagnosticsSummary}>
                        {`MUTATION ACTIONS::${activeMutationPlan.plan.actions.length}`}
                      </summary>
                      <div className={styles.opyCopilotPlanActionList}>
                        {activeMutationPlan.plan.actions.map((action, index) => (
                          <article key={`${action.tool}-${index}`} className={styles.opyCopilotProposalItem}>
                            <div className={styles.opyCopilotProposalItemMeta}>
                              <span>{action.tool.toUpperCase()}</span>
                              <span>{summarizeRigToolPolicy(action.policy)}</span>
                            </div>
                            <p>{formatMutationActionSummary(action)}</p>
                          </article>
                        ))}
                      </div>
                    </details>
                    <div className={styles.opyCopilotPlanDecisionRow}>
                      <button
                        type="button"
                        className={styles.ownershipLensToggleButton}
                        data-selected={activePlanDecision.status === "approved" ? "true" : undefined}
                        onClick={() => {
                          void handleSetPlanDecision("approved");
                        }}
                        disabled={isRunning || !activeMutationPlan.canApprove || !activeMutationPlan.hasChanges}
                      >
                        APPROVE PLAN
                      </button>
                      <button
                        type="button"
                        className={styles.ownershipLensToggleButton}
                        data-selected={activePlanDecision.status === "rejected" ? "true" : undefined}
                        onClick={() => {
                          void handleSetPlanDecision("rejected");
                        }}
                        disabled={isRunning || !activeMutationPlan.hasChanges}
                      >
                        REJECT PLAN
                      </button>
                      <p className={styles.opyCopilotProposalHint}>
                        {`DECISION::${PLAN_DECISION_LABEL[activePlanDecision.status]} · ${
                          activeMutationPlan.canApprove ? "READY FOR REVIEW" : "BLOCKERS PRESENT"
                        }`}
                      </p>
                    </div>
                  </section>
                )}
                {activeDiagramProposal.proposal.warnings.length > 0 && (
                  <div className={styles.opyCopilotProposalWarnings}>
                    {activeDiagramProposal.proposal.warnings.map((warning, index) => (
                      <p key={`${warning}-${index}`}>{`WARNING:: ${warning}`}</p>
                    ))}
                  </div>
                )}
                <div className={styles.opyCopilotEvidenceList}>
                  {activeDiagramProposal.context.citations.map((citation) => (
                    <article key={citation.id} className={styles.opyCopilotEvidenceItem}>
                      <div className={styles.opyCopilotProposalItemMeta}>
                        <span>{citation.tool.toUpperCase()}</span>
                        <span>{citation.label}</span>
                      </div>
                      <p className={styles.opyCopilotProposalHint}>{citation.detail}</p>
                    </article>
                  ))}
                </div>
                <div className={styles.opyCopilotProposalColumns}>
                  <div className={styles.opyCopilotProposalColumn}>
                    <div className={styles.opyCopilotProposalHeader}>
                      <span>{`NODES::${activeDiagramProposal.proposal.nodes.length}`}</span>
                      <span>{activeDiagramProposal.proposal.model}</span>
                    </div>
                    {(activeGroundedProposal?.nodeDiffs ?? activeDiagramProposal.proposal.nodes.map((node) => ({
                      node,
                      status: "new" as const,
                      matches: [],
                    }))).map((nodeDiff) => (
                      <article key={nodeDiff.node.key} className={styles.opyCopilotProposalItem}>
                        <div className={styles.opyCopilotProposalItemMeta}>
                          <span>{nodeDiff.node.nodeType.toUpperCase()}</span>
                          <span
                            className={`${styles.opyCopilotProposalBadge} ${
                              nodeDiff.status === "new"
                                ? styles.opyCopilotProposalBadgeNew
                                : nodeDiff.status === "existing"
                                ? styles.opyCopilotProposalBadgeExisting
                                : styles.opyCopilotProposalBadgeAmbiguous
                            }`}
                          >
                            {DIFF_STATUS_LABEL[nodeDiff.status]}
                          </span>
                        </div>
                        <p>{nodeDiff.node.label}</p>
                        <p className={styles.opyCopilotProposalHint}>{`KEY:: ${nodeDiff.node.key}`}</p>
                        {nodeDiff.node.description && <p>{nodeDiff.node.description}</p>}
                        {nodeDiff.matches.length > 0 && (
                          <p className={styles.opyCopilotProposalHint}>
                            {`${nodeDiff.status === "existing" ? "MATCH" : "CANDIDATES"}:: ${
                              formatNodeMatchSummary(nodeDiff.matches)
                            }`}
                          </p>
                        )}
                      </article>
                    ))}
                  </div>
                  <div className={styles.opyCopilotProposalColumn}>
                    <div className={styles.opyCopilotProposalHeader}>
                      <span>{`EDGES::${activeDiagramProposal.proposal.edges.length}`}</span>
                      <span>PREVIEW ONLY</span>
                    </div>
                    {(activeGroundedProposal?.edgeDiffs ?? activeDiagramProposal.proposal.edges.map((edge) => ({
                      edge,
                      status: "new" as const,
                      matches: [],
                      sourceNode: null,
                      targetNode: null,
                    }))).map((edgeDiff, index) => (
                      <article
                        key={`${edgeDiff.edge.sourceKey}-${edgeDiff.edge.targetKey}-${index}`}
                        className={styles.opyCopilotProposalItem}
                      >
                        <div className={styles.opyCopilotProposalItemMeta}>
                          <span>{`${edgeDiff.edge.sourceKey} -> ${edgeDiff.edge.targetKey}`}</span>
                          <span
                            className={`${styles.opyCopilotProposalBadge} ${
                              edgeDiff.status === "new"
                                ? styles.opyCopilotProposalBadgeNew
                                : edgeDiff.status === "existing"
                                ? styles.opyCopilotProposalBadgeExisting
                                : styles.opyCopilotProposalBadgeAmbiguous
                            }`}
                          >
                            {DIFF_STATUS_LABEL[edgeDiff.status]}
                          </span>
                        </div>
                        <p>{edgeDiff.edge.label}</p>
                        {edgeDiff.sourceNode && edgeDiff.targetNode && (
                          <p className={styles.opyCopilotProposalHint}>
                            {`LINK:: ${edgeDiff.sourceNode.label} -> ${edgeDiff.targetNode.label}`}
                          </p>
                        )}
                        {edgeDiff.matches.length > 0 && (
                          <p className={styles.opyCopilotProposalHint}>
                            {`${edgeDiff.status === "existing" ? "MATCH" : "CANDIDATES"}:: ${
                              formatEdgeMatchSummary(edgeDiff.matches)
                            }`}
                          </p>
                        )}
                      </article>
                    ))}
                  </div>
                </div>
                <div className={styles.opyCopilotProposalActions}>
                  {actionMode === "apply-with-confirmation"
                    ? activeProposalSummary && activeMutationPlan && activePlanDecision
                      ? (
                        <>
                          <button
                            type="button"
                            className={styles.toolbarButton}
                            onClick={() => {
                              void handleApplyActiveProposal();
                            }}
                            disabled={isRunning
                              || !activeProposalSummary.canApply
                              || !activeProposalSummary.hasChanges
                              || !activeMutationPlan.canApprove
                              || activePlanDecision.status !== "approved"}
                          >
                            {isRunning ? "APPLYING..." : "APPLY PROPOSAL"}
                          </button>
                          <p className={styles.opyCopilotProposalHint}>
                            {activePlanDecision.status === "approved"
                              ? "APPROVED PLAN READY FOR CONFIRMED APPLY."
                              : activePlanDecision.status === "rejected"
                              ? "PLAN REJECTED. APPROVE A NEW OR UPDATED PLAN TO APPLY."
                              : "APPROVE PLAN TO ENABLE APPLY."}
                          </p>
                        </>
                      )
                      : (
                        <p className={styles.opyCopilotProposalHint}>
                          {"GROUNDING OR PLAN DATA UNAVAILABLE FOR THIS PROPOSAL."}
                        </p>
                      )
                    : (
                      <p className={styles.opyCopilotProposalHint}>
                        {"SWITCH ACTION MODE TO APPLY-WITH-CONFIRMATION TO EXECUTE THIS PROPOSAL."}
                      </p>
                    )}
                </div>
              </section>
            ),
          })
        )}
      </div>
      <div className={styles.opyCopilotConversation}>
        <div ref={transcriptRef} className={styles.opyCopilotTranscript} role="log" aria-live="polite">
          {isMessageLoading
            ? <p className={styles.ownershipLensHint}>LOADING SESSION TRANSCRIPT...</p>
            : messages.map((message) => {
              const roleClassName = message.role === "user"
                ? styles.opyCopilotMessageUser
                : message.role === "assistant"
                ? styles.opyCopilotMessageAssistant
                : styles.opyCopilotMessageSystem;
              const parsedDiagnostics = message.role === "assistant"
                ? parseOpyTranscriptDiagnostics(message.content)
                : null;
              const messageBody = parsedDiagnostics?.body ?? message.content;
              const hasDiagnostics = Boolean(
                parsedDiagnostics
                  && (parsedDiagnostics.confidence !== null || parsedDiagnostics.citations.length > 0),
              );

              return (
                <article key={message.id} className={`${styles.opyCopilotMessage} ${roleClassName}`}>
                  <div className={styles.opyCopilotMessageMeta}>
                    <span>{ROLE_LABEL[message.role]}</span>
                    <span>{formatClockTime(message.createdAt)}</span>
                  </div>
                  <p>{messageBody}</p>
                  {hasDiagnostics && parsedDiagnostics && (
                    <details className={styles.opyCopilotMessageDiagnostics}>
                      <summary className={styles.opyCopilotDiagnosticsSummary}>
                        {`SOURCES::${parsedDiagnostics.citations.length} · ${
                          parsedDiagnostics.confidence
                            ? `CONF::${parsedDiagnostics.confidence.split("·")[0]?.trim()}`
                            : "CONF::UNKNOWN"
                        }`}
                      </summary>
                      {parsedDiagnostics.confidence && (
                        <p className={styles.opyCopilotProposalHint}>
                          {`CONFIDENCE:: ${parsedDiagnostics.confidence}`}
                        </p>
                      )}
                      <div className={styles.opyCopilotDiagnosticsCitationStack}>
                        {parsedDiagnostics.citations.map((citation, index) => (
                          <p key={`${message.id}-citation-${index}`} className={styles.opyCopilotProposalHint}>
                            {citation}
                          </p>
                        ))}
                      </div>
                    </details>
                  )}
                </article>
              );
            })}
        </div>
        <div className={styles.opyCopilotComposer}>
          <CopilotChatConfigurationProvider
            agentId="opy-9000"
            labels={copilotChatLabels}
          >
            <CopilotChatInput
              className={styles.opyCopilotInput}
              value={draftPrompt}
              onChange={setDraftPrompt}
              isRunning={composerRunning}
              onSubmitMessage={handleCopilotSubmitMessage}
              onStop={handleCopilotStop}
              autoFocus={false}
            />
          </CopilotChatConfigurationProvider>
          <div className={styles.opyCopilotActions}>
            <button
              type="button"
              className={styles.toolbarButton}
              onClick={onOpenAiSettings}
            >
              OPEN AI SETTINGS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
