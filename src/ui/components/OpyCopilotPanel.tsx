import { CopilotChatConfigurationProvider, CopilotChatInput } from "@copilotkit/react-core/v2";
import { Effect } from "effect";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createOpyAddNodeActionFlowDescriptor,
  resolveOpyApplyProposalActionFlow,
  resolveOpyExecutableAddNodeActionFlow,
  resolveOpyRollbackActionFlow,
  type OpyActionFlowDescriptor,
  type OpyActionFlowIssue,
  type OpyBoardAction,
  type OpyC4NodeType,
} from "../../core/effects/opy-action.runtime";
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
import { emitOpyAgentRunTelemetry } from "../../core/effects/opy-agent.telemetry";
import type { OpyBoardContextRegistry } from "../../core/effects/opy-board-context";
import {
  buildGroundedProposalDiff,
  type OpyProposalDiffStatus,
  summarizeGroundedProposalDiff,
} from "../../core/effects/opy-c4-proposals";
import {
  appendOpyChatMessage,
  createOpyAgentRun,
  createOpyChatSession,
  finalizeInterruptedOpyAgentRuns,
  listOpyAgentCheckpoints,
  listOpyAgentRuns,
  listOpyChatMessages,
  listOpyChatSessions,
  listOpyDiagramProposals,
  type OpyAgentCheckpoint,
  type OpyAgentRun,
  type OpyAgentRunIntent,
  type OpyChatMessage,
  type OpyChatRole,
  type OpyChatSession,
  type OpyPersistedDiagramProposal,
  type OpyPlanDecisionStatus,
  renameOpyChatSession,
  updateOpyAgentRun,
  upsertOpyDiagramProposal,
} from "../../core/effects/opy-chat.persistence";
import type { AiActionMode, OpyViewportSectionKey, OpyViewportSections } from "../../core/effects/settings.types";
import { useOpyAgentMachine } from "../hooks/useOpyAgentMachine";
import type { OpyAgentLifecycleRequest, OpyAgentLifecycleStage } from "../machines/opy-agent.machine";
import { useDatabase } from "../../core/effects/useDatabase";
import {
  compareOpyWidgetChromeTone,
  type OpyWidgetChromeFocusRequest,
  type OpyWidgetChromeSignal,
  type OpyWidgetChromeStatus,
  type OpyWidgetChromeTone,
  pickHigherOpyWidgetChromeTone,
} from "./opyChromeStatus";
import * as styles from "./styles.css";
import { TacticalSelect } from "./TacticalSelect";

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

interface OpyPendingLifecycleConfirmation {
  readonly request: OpyAgentLifecycleRequest;
  readonly sessionId: string;
  readonly confirmationLines: ReadonlyArray<string>;
  readonly cancelMessage: string;
  readonly failurePrefix: string;
}

const EMPTY_VIEWPORT_SECTION_STATE: OpyViewportSections = {
  control: false,
  diagnostics: false,
  checkpoints: false,
  review: false,
  proposal: false,
};

const collapseWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

const summarizeInlineText = (value: string, fallback: string): string => {
  const normalized = collapseWhitespace(value);
  return normalized.length > 0 ? normalized : fallback;
};

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

const LIFECYCLE_TERMINAL_STATUS_LABEL: Record<NonNullable<ReturnType<typeof useOpyAgentMachine>["lastTerminalStatus"]>, string> = {
  completed: "COMPLETE",
  cancelled: "CANCELLED",
  failed: "FAILED",
};

const sortRunsByRecency = (runs: readonly OpyAgentRun[]): OpyAgentRun[] =>
  [...runs].sort((left, right) => right.startedAt - left.startedAt);

const upsertSessionRun = (
  runs: readonly OpyAgentRun[],
  nextRun: OpyAgentRun,
): ReadonlyArray<OpyAgentRun> =>
  sortRunsByRecency([
    nextRun,
    ...runs.filter((run) => run.id !== nextRun.id),
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
  onApplyBoardAction,
  onOpenAiSettings,
  onChromeStatusChange,
  chromeSectionRequest,
}: OpyCopilotPanelProps) {
  const { runEffect } = useDatabase();
  const pendingViewportBaselineRef = useRef(true);
  const pendingLifecycleExecutionRef = useRef<{
    readonly execute: () => Promise<string>;
    readonly onAfterApplied?: () => Promise<void> | void;
  } | null>(null);
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
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const [viewportSectionsOpen, setViewportSectionsOpen] = useState<OpyViewportSections>(
    viewportSections,
  );
  const [viewportSectionsUnseen, setViewportSectionsUnseen] = useState<OpyViewportSections>(
    EMPTY_VIEWPORT_SECTION_STATE,
  );
  const [pendingLifecycleConfirmation, setPendingLifecycleConfirmation] = useState<OpyPendingLifecycleConfirmation | null>(
    null,
  );
  const agentLifecycle = useOpyAgentMachine();
  const isRunning = agentLifecycle.isBusy;

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, sessions],
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
        const loadedMessages = await runEffect(listOpyChatMessages(sessionId));
        const loadedRuns = await runEffect(listOpyAgentRuns(sessionId));
        const loadedProposals = await runEffect(listOpyDiagramProposals(sessionId));
        const loadedCheckpoints = await runEffect(listOpyAgentCheckpoints(sessionId));
        setMessages(loadedMessages);
        setRunsBySessionId((current) => ({
          ...current,
          [sessionId]: loadedRuns,
        }));
        setDiagramProposalHistoryBySessionId((current) => ({
          ...current,
          [sessionId]: loadedProposals.map(toSessionDiagramProposal),
        }));
        setCheckpointsBySessionId((current) => ({
          ...current,
          [sessionId]: loadedCheckpoints,
        }));
      } catch (error) {
        setRuntimeError(`FAILED TO LOAD TRANSCRIPT: ${toErrorMessage(error)}`);
        setMessages([]);
        setRunsBySessionId((current) => ({
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
      } finally {
        setIsMessageLoading(false);
      }
    },
    [runEffect],
  );

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

  const appendAndPersistMessage = useCallback(
    async (
      sessionId: string,
      role: OpyChatRole,
      content: string,
    ): Promise<OpyChatMessage | null> => {
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
        return message;
      } catch (error) {
        setRuntimeError(`MESSAGE SAVE FAILED: ${toErrorMessage(error)}`);
        return null;
      }
    },
    [runEffect],
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

  useEffect(() => {
    if (agentLifecycle.stage === "awaiting_confirmation") {
      return;
    }

    pendingLifecycleExecutionRef.current = null;
    setPendingLifecycleConfirmation((current) => current === null ? current : null);
  }, [agentLifecycle.stage]);

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
        readonly onAfterPersisted?: (result: T) => void | Promise<void>;
      },
    ): Promise<T | null> => {
      if (input.manageLifecycleStart !== false) {
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
        agentLifecycle.failActiveRequest(formatAgentError(envelopeError), "contextualizing");
        return null;
      }

      let currentRun = run;
      try {
        const context = await input.contextualize();
        agentLifecycle.markContextReady();

        const result = await input.execute(context);
        agentLifecycle.markResultReady();
        currentRun = await transitionAgentRun(currentRun, {
          stage: "persist",
        });

        const persistedMessage = await appendAndPersistMessage(
          input.sessionId,
          "assistant",
          input.assistantMessage(result),
        );

        if (!persistedMessage) {
          const persistError = makeAgentRuntimeError({
            message: "Assistant response could not be persisted.",
            runId: currentRun.id,
            stage: "persist",
            recommendedAction: "Check local database runtime status and retry.",
          });
          currentRun = await transitionAgentRun(currentRun, {
            status: "failed",
            completedAt: Date.now(),
            errorSummary: summarizeAgentError(persistError),
          });
          setRuntimeError(formatAgentError(persistError));
          agentLifecycle.failActiveRequest(formatAgentError(persistError), "proposing");
          return null;
        }

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
        agentLifecycle.failActiveRequest(
          formatAgentError(agentError),
          agentLifecycle.stage === "planning"
            ? "planning"
            : agentLifecycle.stage === "proposing"
            ? "proposing"
            : "contextualizing",
        );
        return null;
      }
    },
    [agentLifecycle, appendAndPersistMessage, beginAgentRun, transitionAgentRun],
  );

  const executeBoardActionLifecycle = useCallback(
    async (input: {
      readonly lifecycleRequest: OpyAgentLifecycleRequest;
      readonly manageLifecycleStart?: boolean;
      readonly sessionId: string;
      readonly confirmationMessage: string;
      readonly cancelMessage: string;
      readonly failurePrefix: string;
      readonly execute: () => Promise<string>;
      readonly onAfterApplied?: () => Promise<void> | void;
    }): Promise<string | null> => {
      if (input.manageLifecycleStart !== false) {
        agentLifecycle.startActionRequest(input.lifecycleRequest);
      }

      if (input.lifecycleRequest.requiresConfirmation) {
        pendingLifecycleExecutionRef.current = input.onAfterApplied
          ? {
            execute: input.execute,
            onAfterApplied: input.onAfterApplied,
          }
          : {
            execute: input.execute,
          };
        setPendingLifecycleConfirmation({
          request: input.lifecycleRequest,
          sessionId: input.sessionId,
          confirmationLines: input.confirmationMessage.split("\n"),
          cancelMessage: input.cancelMessage,
          failurePrefix: input.failurePrefix,
        });
        return null;
      }

      agentLifecycle.confirmActiveRequest();
      try {
        const actionResult = await input.execute();
        agentLifecycle.markVerifyReady();
        await input.onAfterApplied?.();
        await appendAndPersistMessage(input.sessionId, "assistant", actionResult);
        agentLifecycle.completeActiveRequest();
        return actionResult;
      } catch (error) {
        const message = toErrorMessage(error);
        setRuntimeError(message);
        await appendAndPersistMessage(
          input.sessionId,
          "system",
          `${input.failurePrefix}: ${message}`,
        );
        agentLifecycle.failActiveRequest(message, agentLifecycle.stage === "verifying" ? "verifying" : "applying");
        return null;
      }
    },
    [agentLifecycle, appendAndPersistMessage],
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
  }, [agentLifecycle, agentSecretStatus, diagramId, domain, hasOpenAiApiKey, hydrateMessagesForSession, runEffect]);

  const handleCreateSession = useCallback(() => {
    if (isRunning || isSessionLoading) {
      return;
    }

    agentLifecycle.resetLifecycle();
    setRuntimeError(null);
    setIsSessionLoading(true);
    void createAndActivateSession()
      .catch((error) => {
        setRuntimeError(`SESSION CREATE FAILED: ${toErrorMessage(error)}`);
      })
      .finally(() => {
        setIsSessionLoading(false);
      });
  }, [createAndActivateSession, isRunning, isSessionLoading]);

  const handleSelectSession = useCallback(
    (nextSessionId: string) => {
      if (isRunning || isSessionLoading || nextSessionId === selectedSessionId) {
        return;
      }

      agentLifecycle.resetLifecycle();
      setSelectedSessionId(nextSessionId);
      setRuntimeError(null);
      void hydrateMessagesForSession(nextSessionId);
    },
    [agentLifecycle, hydrateMessagesForSession, isRunning, isSessionLoading, selectedSessionId],
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

  const executeOpyActionFlow = useCallback(
    async (input: {
      readonly descriptor: OpyActionFlowDescriptor;
      readonly lifecycleRequest?: OpyAgentLifecycleRequest;
      readonly manageLifecycleStart?: boolean;
      readonly replay: OpyAgentLifecycleRequest["replay"];
    }): Promise<string | null> =>
      executeBoardActionLifecycle({
        lifecycleRequest: input.lifecycleRequest ?? createLifecycleRequest({
          id: createMessageId(),
          mode: "action",
          kind: input.descriptor.requestKind,
          label: input.descriptor.requestLabel,
          requiresConfirmation: true,
          replay: input.replay,
        }),
        sessionId: input.descriptor.sessionId,
        confirmationMessage: input.descriptor.confirmationMessage,
        cancelMessage: input.descriptor.cancelMessage,
        failurePrefix: input.descriptor.failurePrefix,
        execute: () => onApplyBoardAction(input.descriptor.boardAction),
        ...(typeof input.manageLifecycleStart === "boolean"
          ? { manageLifecycleStart: input.manageLifecycleStart }
          : {}),
        ...(input.descriptor.refreshCheckpointsAfterApply
          ? {
            onAfterApplied: async () => {
              await refreshCheckpointsForSession(input.descriptor.sessionId);
            },
          }
          : {}),
      }),
    [executeBoardActionLifecycle, onApplyBoardAction, refreshCheckpointsForSession],
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
    await executeOpyActionFlow({
      descriptor: resolution.value,
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
          {
            const resolution = resolveOpyExecutableAddNodeActionFlow({
              actionMode,
              domain,
              sessionId: replay.sessionId,
              nodeType: replay.nodeType,
              label: replay.label,
            });
            if (!resolution.ok) {
              await handleOpyActionFlowIssue(replay.sessionId, resolution.issue);
              return false;
            }
            return true;
          }
        case "apply-proposal": {
          const resolution = resolveOpyApplyProposalActionFlow({
            actionMode,
            boardSummary,
            proposalRecord: findPersistedProposalForReplay(replay.sessionId, replay.proposalRespondedAtMs),
            sessionId: replay.sessionId,
          });
          if (!resolution.ok) {
            await handleOpyActionFlowIssue(replay.sessionId, resolution.issue);
            return false;
          }
          return true;
        }
        case "rollback":
          {
            const resolution = resolveOpyRollbackActionFlow({
              actionMode,
              checkpoint: findCheckpointForReplay(replay.sessionId, replay.checkpointId),
              sessionId: replay.sessionId,
            });
            if (!resolution.ok) {
              await handleOpyActionFlowIssue(replay.sessionId, resolution.issue);
              return false;
            }
            return true;
          }
      }
    },
    [
      actionMode,
      appendAgentNotice,
      boardSummary,
      domain,
      findCheckpointForReplay,
      findPersistedProposalForReplay,
      hasOpenAiApiKey,
      handleOpyActionFlowIssue,
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
          await executeOpyActionFlow({
            descriptor: createOpyAddNodeActionFlowDescriptor({
              sessionId: replay.sessionId,
              nodeType: replay.nodeType,
              label: replay.label,
            }),
            lifecycleRequest: request,
            manageLifecycleStart: false,
            replay,
          });
          return;
        case "apply-proposal": {
          const resolution = resolveOpyApplyProposalActionFlow({
            actionMode,
            boardSummary,
            proposalRecord: findPersistedProposalForReplay(replay.sessionId, replay.proposalRespondedAtMs),
            sessionId: replay.sessionId,
          });
          if (!resolution.ok) {
            await handleOpyActionFlowIssue(replay.sessionId, resolution.issue);
            return;
          }
          await executeOpyActionFlow({
            descriptor: resolution.value.descriptor,
            lifecycleRequest: request,
            manageLifecycleStart: false,
            replay,
          });
          return;
        }
        case "rollback": {
          const resolution = resolveOpyRollbackActionFlow({
            actionMode,
            checkpoint: findCheckpointForReplay(replay.sessionId, replay.checkpointId),
            sessionId: replay.sessionId,
          });
          if (!resolution.ok) {
            await handleOpyActionFlowIssue(replay.sessionId, resolution.issue);
            return;
          }
          await executeOpyActionFlow({
            descriptor: resolution.value,
            lifecycleRequest: request,
            manageLifecycleStart: false,
            replay,
          });
        }
      }
    },
    [
      actionMode,
      boardSummary,
      executeOpyActionFlow,
      executeRigRun,
      findCheckpointForReplay,
      findPersistedProposalForReplay,
      handleOpyActionFlowIssue,
      resolveRigAgentContext,
      runEffect,
    ],
  );

  const handleConfirmPendingLifecycleAction = useCallback(async () => {
    const pending = pendingLifecycleConfirmation;
    const execution = pendingLifecycleExecutionRef.current;
    if (!pending || !execution || agentLifecycle.stage !== "awaiting_confirmation") {
      return;
    }

    setPendingLifecycleConfirmation(null);
    pendingLifecycleExecutionRef.current = null;
    setRuntimeError(null);
    agentLifecycle.confirmActiveRequest();
    try {
      const actionResult = await execution.execute();
      agentLifecycle.markVerifyReady();
      await execution.onAfterApplied?.();
      await appendAndPersistMessage(pending.sessionId, "assistant", actionResult);
      agentLifecycle.completeActiveRequest();
    } catch (error) {
      const message = toErrorMessage(error);
      setRuntimeError(message);
      await appendAndPersistMessage(
        pending.sessionId,
        "system",
        `${pending.failurePrefix}: ${message}`,
      );
      agentLifecycle.failActiveRequest(message, "applying");
    }
  }, [agentLifecycle, appendAndPersistMessage, pendingLifecycleConfirmation]);

  const handleCancelPendingLifecycleAction = useCallback(() => {
    const pending = pendingLifecycleConfirmation;
    if (!pending || agentLifecycle.stage !== "awaiting_confirmation") {
      return;
    }

    setPendingLifecycleConfirmation(null);
    pendingLifecycleExecutionRef.current = null;
    void appendAndPersistMessage(
      pending.sessionId,
      "system",
      pending.cancelMessage,
    );
    agentLifecycle.cancelActiveRequest();
  }, [agentLifecycle, appendAndPersistMessage, pendingLifecycleConfirmation]);

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
  useEffect(() => {
    if (!chromeSectionRequest) {
      return;
    }

    const targetSection = chromeSectionRequest.section;
    if (!viewportSectionsOpen[targetSection]) {
      clearViewportSectionUnseen(targetSection);
      commitViewportSections((current) => ({
        ...current,
        [targetSection]: true,
      }));
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const node = viewportSectionRefs.current[targetSection];
        if (!node) {
          return;
        }

        node.scrollIntoView({
          block: "start",
          behavior: "smooth",
        });
      });
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [
    chromeSectionRequest,
    clearViewportSectionUnseen,
    commitViewportSections,
    viewportSectionsOpen,
  ]);
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
  const controlSectionMeta = `${sessions.length} SESSION(S) · ${boardContextHints.length} CONTEXT(S)`;
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
  const lastLifecycleText = agentLifecycle.lastTerminalStatus && agentLifecycle.lastRequest && agentLifecycle.lastCompletedAt
    ? `LAST FLOW::${agentLifecycle.lastRequest.label} · ${
      LIFECYCLE_TERMINAL_STATUS_LABEL[agentLifecycle.lastTerminalStatus]
    } · ${formatClockTime(agentLifecycle.lastCompletedAt)}`
    : null;
  const controlSectionSummary = summarizeInlineText(
    agentLifecycle.stage !== "idle"
      ? `FLOW::${agentLifecycle.activeRequest?.label ?? "OPY"} · ${LIFECYCLE_STAGE_LABEL[agentLifecycle.stage]} · BOARD::${currentBoardLabel}`
      : lastLifecycleText ?? `BOARD::${currentBoardLabel} · SESSION::${selectedSession?.title ?? "NONE"} · ACTION::${actionMode.toUpperCase()}`,
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
              {agentLifecycle.stage === "idle" && lastLifecycleText && (
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
                  {`LAST FLOW FAILURE::${agentLifecycle.lastFailureStage?.toUpperCase() ?? "UNKNOWN"} · ${agentLifecycle.lastError}`}
                </p>
              )}
              {pendingLifecycleConfirmation && agentLifecycle.stage === "awaiting_confirmation" && (
                <section className={styles.opyCopilotPlanCard} aria-label="OPY pending confirmation">
                  <div className={styles.opyCopilotProposalHeader}>
                    <span>{`CONFIRM::${pendingLifecycleConfirmation.request.label}`}</span>
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
                      .filter((line) => line.trim().length > 0)
                      .map((line, index) => (
                        <article
                          key={`${pendingLifecycleConfirmation.request.id}-confirm-${index}`}
                          className={styles.opyCopilotProposalItem}
                        >
                          <p>{line}</p>
                        </article>
                      ))}
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
              <section className={styles.opyCopilotDiagnosticsCard} aria-label="Latest OPY diagnostics">
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
                        <article key={checkpoint.id} className={styles.opyCopilotProposalItem}>
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
              <section className={styles.opyCopilotProposalCard} aria-label="Latest OPY board review">
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
              <section className={styles.opyCopilotProposalCard} aria-label="Latest OPY diagram proposal">
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
                  <section className={styles.opyCopilotPlanCard} aria-label="Typed mutation plan">
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
