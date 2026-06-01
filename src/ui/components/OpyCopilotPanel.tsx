import { CopilotChatConfigurationProvider, CopilotChatInput } from "@copilotkit/react-core/v2";
import { Effect } from "effect";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  formatAgentError,
  getRigSecretStatus,
  makeAgentConfigError,
  makeAgentPolicyError,
  makeAgentRuntimeError,
  planRigC4Diagram,
  reviewRigC4Board,
  summarizeAgentError,
  type RigC4BoardEdge,
  type RigC4BoardNode,
  type RigC4BoardReview,
  type RigC4BoardSummary,
  type RigC4DiagramProposal,
  runRigHello,
  withAgentErrorContext,
} from "../../core/effects/ai-agent.runtime";
import { emitOpyAgentRunTelemetry } from "../../core/effects/opy-agent.telemetry";
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
  listOpyAgentRuns,
  listOpyChatMessages,
  listOpyChatSessions,
  type OpyAgentRun,
  type OpyAgentRunIntent,
  type OpyChatMessage,
  type OpyChatRole,
  type OpyChatSession,
  renameOpyChatSession,
  updateOpyAgentRun,
} from "../../core/effects/opy-chat.persistence";
import type { AiActionMode } from "../../core/effects/settings.types";
import { useDatabase } from "../../core/effects/useDatabase";
import * as styles from "./styles.css";
import { TacticalSelect } from "./TacticalSelect";

type OpyC4NodeType = "person" | "system" | "externalSystem" | "container" | "component";

export interface OpyBoardAddNodeAction {
  readonly kind: "add-node";
  readonly nodeType: OpyC4NodeType;
  readonly label: string;
}

export interface OpyBoardApplyC4ProposalAction {
  readonly kind: "apply-c4-proposal";
  readonly proposal: RigC4DiagramProposal;
}

export type OpyBoardAction = OpyBoardAddNodeAction | OpyBoardApplyC4ProposalAction;

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
}

interface OpySessionBoardReview {
  readonly command: OpyBoardReviewCommand;
  readonly review: RigC4BoardReview;
}

interface OpyCopilotPanelProps {
  readonly domain: "c4" | "ddd";
  readonly diagramId: string | null;
  readonly diagramName: string;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly boardSummary: RigC4BoardSummary | null;
  readonly actionMode: AiActionMode;
  readonly onApplyBoardAction: (action: OpyBoardAction) => Promise<string>;
  readonly onOpenAiSettings: () => void;
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
  | { readonly type: "action"; readonly action: OpyBoardAddNodeAction }
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

const formatNodeMatchSummary = (matches: ReadonlyArray<RigC4BoardNode>): string =>
  matches
    .map((match) => `${match.nodeType.toUpperCase()} ${match.label}`)
    .join(" | ");

const formatEdgeMatchSummary = (matches: ReadonlyArray<RigC4BoardEdge>): string =>
  matches
    .map((match) => `${match.sourceLabel} -> ${match.targetLabel}${match.label ? ` (${match.label})` : ""}`)
    .join(" | ");

export function OpyCopilotPanel({
  domain,
  diagramId,
  diagramName,
  nodeCount,
  edgeCount,
  boardSummary,
  actionMode,
  onApplyBoardAction,
  onOpenAiSettings,
}: OpyCopilotPanelProps) {
  const { runEffect } = useDatabase();
  const [draftPrompt, setDraftPrompt] = useState("");
  const [isRunning, setIsRunning] = useState(false);
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
  const [diagramProposalsBySessionId, setDiagramProposalsBySessionId] = useState<
    Readonly<Record<string, OpySessionDiagramProposal | undefined>>
  >({});
  const [boardReviewsBySessionId, setBoardReviewsBySessionId] = useState<
    Readonly<Record<string, OpySessionBoardReview | undefined>>
  >({});
  const selectedSessionIdRef = useRef<string>("");

  const promptContext = useMemo(() => {
    const diagramLabel = diagramId ?? "unsaved";
    const normalizedDiagramName = diagramName.trim().length > 0 ? diagramName.trim() : "untitled";
    return `DOMAIN=${domain.toUpperCase()} | DIAGRAM=${diagramLabel} | NAME=${normalizedDiagramName} | NODES=${nodeCount} | EDGES=${edgeCount}`;
  }, [diagramId, diagramName, domain, edgeCount, nodeCount]);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, sessions],
  );

  const activeDiagramProposal = useMemo(
    () => diagramProposalsBySessionId[selectedSessionId] ?? null,
    [diagramProposalsBySessionId, selectedSessionId],
  );
  const activeBoardReview = useMemo(
    () => boardReviewsBySessionId[selectedSessionId] ?? null,
    [boardReviewsBySessionId, selectedSessionId],
  );
  const activeRuns = useMemo(
    () => runsBySessionId[selectedSessionId] ?? [],
    [runsBySessionId, selectedSessionId],
  );
  const activeRun = useMemo(
    () => activeRuns.find((run) => run.status === "running") ?? null,
    [activeRuns],
  );
  const latestRun = useMemo(
    () => activeRuns[0] ?? null,
    [activeRuns],
  );
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

  useEffect(() => {
    selectedSessionIdRef.current = selectedSessionId;
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
        setMessages(loadedMessages);
        setRunsBySessionId((current) => ({
          ...current,
          [sessionId]: loadedRuns,
        }));
      } catch (error) {
        setRuntimeError(`FAILED TO LOAD TRANSCRIPT: ${toErrorMessage(error)}`);
        setMessages([]);
        setRunsBySessionId((current) => ({
          ...current,
          [sessionId]: [],
        }));
      } finally {
        setIsMessageLoading(false);
      }
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

  const executeRigRun = useCallback(
    async <T,>(
      input: {
        readonly sessionId: string;
        readonly intent: OpyAgentRunIntent;
        readonly invoke: () => Promise<T>;
        readonly assistantMessage: (result: T) => string;
        readonly failurePrefix: string;
        readonly onAfterPersisted?: (result: T) => void;
      },
    ): Promise<T | null> => {
      setIsRunning(true);
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
        setIsRunning(false);
        return null;
      }

      let currentRun = run;
      try {
        const result = await input.invoke();
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
          return null;
        }

        input.onAfterPersisted?.(result);
        await transitionAgentRun(currentRun, {
          stage: "complete",
          status: "completed",
          completedAt: Date.now(),
          errorSummary: null,
        });
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
        return null;
      } finally {
        setIsRunning(false);
      }
    },
    [appendAndPersistMessage, beginAgentRun, transitionAgentRun],
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
  }, [diagramId, domain, hasOpenAiApiKey, runEffect]);

  useEffect(() => {
    let isCancelled = false;

    const hydrate = async () => {
      if (agentSecretStatus === "loading") {
        return;
      }

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
        }
      } catch (error) {
        if (!isCancelled) {
          setRuntimeError(`SESSION LOAD FAILED: ${toErrorMessage(error)}`);
          setSessions([]);
          setSelectedSessionId("");
          setMessages([]);
          setRunsBySessionId({});
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
  }, [agentSecretStatus, diagramId, domain, hasOpenAiApiKey, hydrateMessagesForSession, runEffect]);

  const handleCreateSession = useCallback(() => {
    if (isRunning || isSessionLoading) {
      return;
    }

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
      setSelectedSessionId(nextSessionId);
      setRuntimeError(null);
      void hydrateMessagesForSession(nextSessionId);
    },
    [hydrateMessagesForSession],
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

        if (
          !window.confirm(
            `Apply OPY board action?\n\nADD ${opyCommand.action.nodeType.toUpperCase()} "${opyCommand.action.label}"`,
          )
        ) {
          await appendAndPersistMessage(
            sessionId,
            "system",
            "ACTION CANCELLED BY OPERATOR.",
          );
          return;
        }

        try {
          const actionResult = await onApplyBoardAction(opyCommand.action);
          await appendAndPersistMessage(
            sessionId,
            "assistant",
            actionResult,
          );
        } catch (error) {
          const message = toErrorMessage(error);
          setRuntimeError(message);
          await appendAndPersistMessage(
            sessionId,
            "system",
            `BOARD ACTION FAILED: ${message}`,
          );
        }
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
          sessionId,
          intent: "plan-c4-diagram",
          invoke: () =>
            runEffect(
              planRigC4Diagram({
                description: opyCommand.proposal.description,
                diagramContext: promptContext,
                ...(boardSummary ? { boardSummary } : {}),
              }),
            ),
          assistantMessage: (proposal) =>
            `PROPOSAL READY:: ${proposal.summary}\nNO BOARD CHANGES WERE APPLIED.`,
          failurePrefix: "DIAGRAM PROPOSAL FAILED",
          onAfterPersisted: (proposal) => {
            setDiagramProposalsBySessionId((current) => ({
              ...current,
              [sessionId]: {
                command: opyCommand.proposal,
                proposal,
              },
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

        await executeRigRun({
          sessionId,
          intent: "review-c4-board",
          invoke: () =>
            runEffect(
              reviewRigC4Board({
                ...(opyCommand.review.focus ? { focus: opyCommand.review.focus } : {}),
                diagramContext: promptContext,
                boardSummary,
              }),
            ),
          assistantMessage: (review) =>
            `REVIEW READY:: ${review.summary}\nNO BOARD CHANGES WERE APPLIED.`,
          failurePrefix: "BOARD REVIEW FAILED",
          onAfterPersisted: (review) => {
            setBoardReviewsBySessionId((current) => ({
              ...current,
              [sessionId]: {
                command: opyCommand.review,
                review,
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
        sessionId,
        intent: "chat",
        invoke: () =>
          runEffect(
            runRigHello({
              prompt: [
                "You are OPY Net, an architecture copilot for OPSYDYN.",
                "Respond with concise, actionable architecture guidance.",
                `Board context: ${promptContext}.`,
                `Operator request: ${trimmed}`,
              ].join("\n"),
            }),
          ),
        assistantMessage: (response) => response.message,
        failurePrefix: "AGENT RUNTIME ERROR",
      });
    },
    [
      actionMode,
      appendAndPersistMessage,
      appendAgentNotice,
      boardSummary,
      domain,
      executeRigRun,
      hasOpenAiApiKey,
      isRunning,
      onApplyBoardAction,
      promptContext,
      selectedSessionId,
    ],
  );

  const handleApplyActiveProposal = useCallback(async () => {
    const sessionId = selectedSessionId;
    if (
      sessionId.length === 0
      || !activeDiagramProposal
      || !activeGroundedProposal
      || !activeProposalSummary
      || isRunning
    ) {
      return;
    }

    if (actionMode !== "apply-with-confirmation") {
      await appendAgentNotice(
        sessionId,
        makeAgentPolicyError({
          message: `Proposal apply blocked by mode ${actionMode.toUpperCase()}.`,
          recommendedAction: "Switch to APPLY-WITH-CONFIRMATION.",
        }),
      );
      return;
    }

    if (!activeProposalSummary.canApply) {
      await appendAgentNotice(
        sessionId,
        makeAgentPolicyError({
          message: `Proposal apply blocked by ${activeProposalSummary.ambiguousNodes} ambiguous node(s) and ${activeProposalSummary.ambiguousEdges} ambiguous edge(s).`,
          recommendedAction: "Resolve proposal ambiguity before applying.",
        }),
      );
      return;
    }

    if (!activeProposalSummary.hasChanges) {
      await appendAndPersistMessage(
        sessionId,
        "assistant",
        "NO NEW CHANGES TO APPLY. PROPOSAL ALREADY MATCHES THE BOARD.",
      );
      return;
    }

    if (
      !window.confirm(
        [
          "Apply OPY diagram proposal?",
          "",
          `Create ${activeProposalSummary.newNodes} node(s)`,
          `Create ${activeProposalSummary.newEdges} edge(s)`,
          `Reuse ${activeProposalSummary.existingNodes} node(s)`,
          `Reuse ${activeProposalSummary.existingEdges} edge(s)`,
          "",
          "This will update and save the current board.",
        ].join("\n"),
      )
    ) {
      await appendAndPersistMessage(
        sessionId,
        "system",
        "PROPOSAL APPLY CANCELLED BY OPERATOR.",
      );
      return;
    }

    setRuntimeError(null);
    setIsRunning(true);
    try {
      const actionResult = await onApplyBoardAction({
        kind: "apply-c4-proposal",
        proposal: activeDiagramProposal.proposal,
      });
      await appendAndPersistMessage(sessionId, "assistant", actionResult);
    } catch (error) {
      const message = toErrorMessage(error);
      setRuntimeError(message);
      await appendAndPersistMessage(
        sessionId,
        "system",
        `PROPOSAL APPLY FAILED: ${message}`,
      );
    } finally {
      setIsRunning(false);
    }
  }, [
    actionMode,
    activeDiagramProposal,
    activeGroundedProposal,
    activeProposalSummary,
    appendAgentNotice,
    appendAndPersistMessage,
    isRunning,
    onApplyBoardAction,
    selectedSessionId,
  ]);

  const statusText =
    agentSecretStatus === "loading"
      ? "KEY::CHECKING"
      : agentSecretStatus === "error"
        ? "KEY::ERROR"
        : hasOpenAiApiKey
          ? "KEY::CONFIGURED"
          : "KEY::MISSING";
  const runText = activeRun
    ? `RUN::${RUN_INTENT_LABEL[activeRun.intent]}::${RUN_STAGE_LABEL[activeRun.stage]}`
    : latestRun
      ? `LAST::${RUN_STATUS_LABEL[latestRun.status]}::${RUN_STAGE_LABEL[latestRun.stage]}`
      : "RUN::IDLE";
  const actionModeText = `ACTION::${actionMode.toUpperCase()}`;
  const activeCommandToken = detectCommandToken(draftPrompt);

  return (
    <div className={styles.opyCopilotShell}>
      <div className={styles.ownershipLensStats}>
        <span>MODE::ASSIST</span>
        <span>{statusText}</span>
        <span>{runText}</span>
        <span>{actionModeText}</span>
        <span>{`SESSIONS::${sessions.length}`}</span>
        <span>{`ACTIVE::${selectedSession ? "ONLINE" : "NONE"}`}</span>
      </div>
      <p className={styles.ownershipLensHint}>
        {"COMMAND::/add person|system|external|container|component <label>"}
      </p>
      <p className={styles.ownershipLensHint}>
        {"COMMAND::/diagram <architecture description>"}
      </p>
      <p className={styles.ownershipLensHint}>
        {"COMMAND::/review [focus area]"}
      </p>
      {activeCommandToken && (
        <p className={styles.ownershipLensHint}>
          {"TOOL TOKEN ACTIVE:: "}
          <span className={styles.opyCopilotCommandToken}>{activeCommandToken}</span>
        </p>
      )}
      {activeRun && (
        <p className={styles.ownershipLensHint}>
          {`ACTIVE RUN::${activeRun.id.slice(0, 8)} · ${RUN_INTENT_LABEL[activeRun.intent]} · ${RUN_STAGE_LABEL[activeRun.stage]} · ${formatClockTime(activeRun.startedAt)}`}
        </p>
      )}
      {!activeRun && latestRun?.status === "failed" && latestRun.errorSummary && (
        <p className={styles.ownershipLensHint}>
          {`LAST FAILURE::${RUN_STAGE_LABEL[latestRun.stage]} · ${latestRun.errorSummary}`}
        </p>
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
      {runtimeError && <p className={styles.opyCopilotError}>{`ERROR:: ${runtimeError}`}</p>}
      <div className={styles.opyCopilotTranscript} role="log" aria-live="polite">
        {isMessageLoading
          ? <p className={styles.ownershipLensHint}>LOADING SESSION TRANSCRIPT...</p>
          : messages.map((message) => {
            const roleClassName = message.role === "user"
              ? styles.opyCopilotMessageUser
              : message.role === "assistant"
              ? styles.opyCopilotMessageAssistant
              : styles.opyCopilotMessageSystem;

            return (
              <article key={message.id} className={`${styles.opyCopilotMessage} ${roleClassName}`}>
                <div className={styles.opyCopilotMessageMeta}>
                  <span>{ROLE_LABEL[message.role]}</span>
                  <span>{formatClockTime(message.createdAt)}</span>
                </div>
                <p>{message.content}</p>
              </article>
            );
          })}
      </div>
      {activeBoardReview && (
        <section className={styles.opyCopilotProposalCard} aria-label="Latest OPY board review">
          <div className={styles.opyCopilotProposalHeader}>
            <span>REVIEW::C4</span>
            <span>{formatClockTime(activeBoardReview.review.respondedAtMs)}</span>
          </div>
          <p className={styles.opyCopilotProposalSummary}>{activeBoardReview.review.summary}</p>
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
      )}
      {activeDiagramProposal && (
        <section className={styles.opyCopilotProposalCard} aria-label="Latest OPY diagram proposal">
          <div className={styles.opyCopilotProposalHeader}>
            <span>PROPOSAL::C4</span>
            <span>{formatClockTime(activeDiagramProposal.proposal.respondedAtMs)}</span>
          </div>
          <p className={styles.opyCopilotProposalSummary}>{activeDiagramProposal.proposal.summary}</p>
          <p className={styles.opyCopilotProposalRationale}>{activeDiagramProposal.proposal.rationale}</p>
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
          {activeDiagramProposal.proposal.warnings.length > 0 && (
            <div className={styles.opyCopilotProposalWarnings}>
              {activeDiagramProposal.proposal.warnings.map((warning, index) => (
                <p key={`${warning}-${index}`}>{`WARNING:: ${warning}`}</p>
              ))}
            </div>
          )}
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
              ? activeProposalSummary
                ? (
                  <button
                    type="button"
                    className={styles.toolbarButton}
                    onClick={() => {
                      void handleApplyActiveProposal();
                    }}
                    disabled={isRunning || !activeProposalSummary.canApply || !activeProposalSummary.hasChanges}
                  >
                    {isRunning ? "APPLYING..." : "APPLY PROPOSAL"}
                  </button>
                )
                : (
                  <p className={styles.opyCopilotProposalHint}>
                    {"GROUNDING DATA UNAVAILABLE FOR THIS PROPOSAL."}
                  </p>
                )
              : (
                <p className={styles.opyCopilotProposalHint}>
                  {"SWITCH ACTION MODE TO APPLY-WITH-CONFIRMATION TO EXECUTE THIS PROPOSAL."}
                </p>
              )}
          </div>
        </section>
      )}
      <CopilotChatConfigurationProvider
        agentId="opy-9000"
        labels={{
          chatInputPlaceholder:
            agentSecretStatus === "loading"
              ? "Checking OPY Net secret resolver..."
              : hasOpenAiApiKey
                ? "Ask OPY Net, use /review, or use /diagram for a C4 proposal..."
                : "Configure OpenAI key in Settings to enable OPY Net",
        }}
      >
        <CopilotChatInput
          className={styles.opyCopilotInput}
          value={draftPrompt}
          onChange={setDraftPrompt}
          isRunning={isRunning}
          onSubmitMessage={(value) => {
            void handleSubmitPrompt(value);
          }}
          onStop={() => {
            setIsRunning(false);
          }}
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
  );
}
