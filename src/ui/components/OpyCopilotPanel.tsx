import { CopilotChatConfigurationProvider, CopilotChatInput } from "@copilotkit/react-core/v2";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { runRigHello } from "../../core/effects/ai-agent.runtime";
import {
  appendOpyChatMessage,
  createOpyChatSession,
  listOpyChatMessages,
  listOpyChatSessions,
  type OpyChatMessage,
  type OpyChatRole,
  type OpyChatSession,
  renameOpyChatSession,
} from "../../core/effects/opy-chat.persistence";
import { useDatabase } from "../../core/effects/useDatabase";
import * as styles from "./styles.css";
import { TacticalSelect } from "./TacticalSelect";

interface OpyCopilotPanelProps {
  readonly hasOpenAiApiKey: boolean;
  readonly domain: "c4" | "ddd";
  readonly diagramId: string | null;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly onOpenAiSettings: () => void;
}

const createMessageId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `opy-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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

const buildBootstrapMessage = (hasOpenAiApiKey: boolean): { role: OpyChatRole; content: string } =>
  hasOpenAiApiKey
    ? {
      role: "assistant",
      content: "OPY::9000 online. Ask about architecture, ownership, or coupling on this board.",
    }
    : {
      role: "system",
      content: "OpenAI key not configured. Add it in SETTINGS to enable OPY::9000 responses.",
    };

const sortSessionsByRecency = (sessions: readonly OpyChatSession[]): OpyChatSession[] =>
  [...sessions].sort((left, right) => right.updatedAt - left.updatedAt);

export function OpyCopilotPanel({
  hasOpenAiApiKey,
  domain,
  diagramId,
  nodeCount,
  edgeCount,
  onOpenAiSettings,
}: OpyCopilotPanelProps) {
  const { runEffect } = useDatabase();
  const [draftPrompt, setDraftPrompt] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [isMessageLoading, setIsMessageLoading] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ReadonlyArray<OpyChatSession>>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [sessionTitleDraft, setSessionTitleDraft] = useState("");
  const [messages, setMessages] = useState<ReadonlyArray<OpyChatMessage>>([]);
  const selectedSessionIdRef = useRef<string>("");

  const promptContext = useMemo(() => {
    const diagramLabel = diagramId ?? "unsaved";
    return `DOMAIN=${domain.toUpperCase()} | DIAGRAM=${diagramLabel} | NODES=${nodeCount} | EDGES=${edgeCount}`;
  }, [diagramId, domain, edgeCount, nodeCount]);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, sessions],
  );

  useEffect(() => {
    selectedSessionIdRef.current = selectedSessionId;
  }, [selectedSessionId]);

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
        const loadedMessages = await runEffect(listOpyChatMessages(sessionId));
        setMessages(loadedMessages);
      } catch (error) {
        setRuntimeError(`FAILED TO LOAD TRANSCRIPT: ${toErrorMessage(error)}`);
        setMessages([]);
      } finally {
        setIsMessageLoading(false);
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
  }, [diagramId, domain, hasOpenAiApiKey, runEffect]);

  useEffect(() => {
    let isCancelled = false;

    const hydrate = async () => {
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
        }
      } catch (error) {
        if (!isCancelled) {
          setRuntimeError(`SESSION LOAD FAILED: ${toErrorMessage(error)}`);
          setSessions([]);
          setSelectedSessionId("");
          setMessages([]);
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
  }, [diagramId, domain, hasOpenAiApiKey, hydrateMessagesForSession, runEffect]);

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

      if (!hasOpenAiApiKey) {
        await appendAndPersistMessage(
          sessionId,
          "system",
          "OPENAI KEY REQUIRED. Navigate to SETTINGS > AI AGENT and configure your key.",
        );
        return;
      }

      setIsRunning(true);
      try {
        const response = await runEffect(
          runRigHello({
            prompt: [
              "You are OPY::9000, an architecture copilot for OPSYDYN.",
              "Respond with concise, actionable architecture guidance.",
              `Board context: ${promptContext}.`,
              `Operator request: ${trimmed}`,
            ].join("\n"),
          }),
        );
        await appendAndPersistMessage(sessionId, "assistant", response.message);
      } catch (error) {
        const message = toErrorMessage(error);
        setRuntimeError(message);
        await appendAndPersistMessage(
          sessionId,
          "system",
          `AGENT RUNTIME ERROR: ${message}`,
        );
      } finally {
        setIsRunning(false);
      }
    },
    [
      appendAndPersistMessage,
      hasOpenAiApiKey,
      isRunning,
      promptContext,
      runEffect,
      selectedSessionId,
    ],
  );

  const statusText = hasOpenAiApiKey ? "KEY::CONFIGURED" : "KEY::MISSING";

  return (
    <div className={styles.opyCopilotShell}>
      <div className={styles.ownershipLensStats}>
        <span>MODE::ASSIST</span>
        <span>{statusText}</span>
        <span>{`SESSIONS::${sessions.length}`}</span>
        <span>{`ACTIVE::${selectedSession ? "ONLINE" : "NONE"}`}</span>
      </div>
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
      <CopilotChatConfigurationProvider
        agentId="opy-9000"
        labels={{
          chatInputPlaceholder: hasOpenAiApiKey
            ? "Ask OPY::9000 about this architecture..."
            : "Configure OpenAI key in Settings to enable OPY::9000",
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
