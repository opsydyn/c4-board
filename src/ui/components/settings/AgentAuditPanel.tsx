import { Effect } from "effect";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listAllOpyAgentTasks,
  listAllOpyChatSessions,
  listAllOpyDiagramProposals,
  type OpyAgentTask,
  type OpyChatSession,
  type OpyPersistedDiagramProposal,
} from "../../../core/effects/opy-chat.persistence";
import { useDatabase } from "../../../core/effects/useDatabase";
import * as styles from "../../../pages/settings.css";

interface AgentAuditSnapshot {
  readonly sessions: ReadonlyArray<OpyChatSession>;
  readonly tasks: ReadonlyArray<OpyAgentTask>;
  readonly proposals: ReadonlyArray<OpyPersistedDiagramProposal>;
}

interface AgentAuditEntry {
  readonly id: string;
  readonly at: number;
  readonly who: string;
  readonly what: string;
  readonly status: string;
  readonly why: string;
  readonly sourceSession: string;
  readonly detail: string;
}

const formatTimestamp = (timestamp: number): string =>
  new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(timestamp);

const formatSessionLabel = (session: OpyChatSession | undefined): string => {
  if (!session) {
    return "UNKNOWN SESSION";
  }

  return `${session.title.toUpperCase()} · ${session.domain.toUpperCase()}${session.diagramId ? ` · ${session.diagramId}` : ""}`;
};

const describeTaskWhat = (task: OpyAgentTask): string => {
  switch (task.request.replay.kind) {
    case "chat":
      return "CHAT";
    case "review":
      return "BOARD REVIEW";
    case "proposal":
      return "DIAGRAM PROPOSAL";
    case "add-node":
      return `ADD ${task.request.replay.nodeType.toUpperCase()}`;
    case "apply-proposal":
      return "APPLY PROPOSAL";
    case "rollback":
      return "ROLLBACK CHECKPOINT";
  }
};

const describeTaskWhy = (task: OpyAgentTask): string => {
  switch (task.request.replay.kind) {
    case "chat":
      return task.request.replay.prompt;
    case "review":
      return task.request.replay.focus ?? "WHOLE BOARD";
    case "proposal":
      return task.request.replay.description;
    case "add-node":
      return `${task.request.replay.nodeType.toUpperCase()} :: ${task.request.replay.label}`;
    case "apply-proposal":
      return `RESPONDED AT ${task.request.replay.proposalRespondedAtMs}`;
    case "rollback":
      return `CHECKPOINT ${task.request.replay.checkpointId}`;
  }
};

const describeTaskWho = (task: OpyAgentTask): string =>
  task.request.requiresConfirmation
    ? "OPY NET + OPERATOR"
    : "OPY NET";

const describeTaskStatus = (task: OpyAgentTask): string =>
  `${task.status.toUpperCase()} · ${task.stage.toUpperCase()}`;

const buildAuditEntries = (
  snapshot: AgentAuditSnapshot,
): ReadonlyArray<AgentAuditEntry> => {
  const sessionById = new Map(snapshot.sessions.map((session) => [session.id, session] as const));

  const taskEntries = snapshot.tasks.map((task) => ({
    id: `task:${task.id}`,
    at: task.completedAt ?? task.updatedAt,
    who: describeTaskWho(task),
    what: describeTaskWhat(task),
    status: describeTaskStatus(task),
    why: describeTaskWhy(task),
    sourceSession: formatSessionLabel(sessionById.get(task.sessionId)),
    detail: task.errorSummary ?? `REQUEST ${task.request.id.toUpperCase()} · MODE ${task.request.mode.toUpperCase()}`,
  }));

  const proposalEntries = snapshot.proposals.map((proposal) => ({
    id: `proposal:${proposal.sessionId}:${proposal.proposal.respondedAtMs}`,
    at: proposal.decidedAt,
    who: proposal.decisionStatus === "pending" ? "OPY NET" : "OPERATOR",
    what: `PLAN ${proposal.decisionStatus.toUpperCase()}`,
    status: `PROPOSAL · ${proposal.decisionStatus.toUpperCase()}`,
    why: proposal.commandDescription,
    sourceSession: formatSessionLabel(sessionById.get(proposal.sessionId)),
    detail: proposal.proposal.summary,
  }));

  return [...taskEntries, ...proposalEntries].sort((left, right) => right.at - left.at);
};

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export function AgentAuditPanel() {
  const { runEffect } = useDatabase();
  const [snapshot, setSnapshot] = useState<AgentAuditSnapshot>({
    sessions: [],
    tasks: [],
    proposals: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const loadAuditTrail = useCallback(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void runEffect(
      Effect.all({
        sessions: listAllOpyChatSessions(),
        tasks: listAllOpyAgentTasks(),
        proposals: listAllOpyDiagramProposals(),
      }),
    )
      .then((nextSnapshot) => {
        if (cancelled) {
          return;
        }

        setSnapshot(nextSnapshot);
        setLastUpdatedAt(Date.now());
        setIsLoading(false);
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        setError(toErrorMessage(loadError));
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [runEffect]);

  useEffect(() => {
    const cleanup = loadAuditTrail();
    return cleanup;
  }, [loadAuditTrail]);

  const auditEntries = useMemo(() => buildAuditEntries(snapshot), [snapshot]);
  const confirmationCount = useMemo(
    () => snapshot.tasks.filter((task) => task.request.requiresConfirmation).length,
    [snapshot.tasks],
  );
  const decisionCount = useMemo(
    () => snapshot.proposals.filter((proposal) => proposal.decisionStatus !== "pending").length,
    [snapshot.proposals],
  );

  return (
    <article id="agent-audit" className={`${styles.settingsCard} ${styles.settingsCardWide}`}>
      <h2 className={styles.settingsCardTitle}>Agent Audit</h2>
      <p className={styles.settingsCardDescription}>
        Cross-session operational trail for OPY tasks, proposal decisions, and confirmation paths.
      </p>
      <div className={styles.settingsRow}>
        <div className={styles.settingsRowLabel}>
          <span>Audit Coverage</span>
          <span className={styles.settingsRowHint}>
            Sessions, tasks, proposals, and operator decisions
          </span>
        </div>
        <div className={styles.settingsInlineActions}>
          <span className={styles.settingsRowValue}>
            {isLoading
              ? "REFRESHING"
              : lastUpdatedAt === null
              ? "NOT LOADED"
              : `UPDATED ${formatTimestamp(lastUpdatedAt)}`}
          </span>
          <button
            type="button"
            className={styles.settingsActionButton}
            onClick={loadAuditTrail}
            disabled={isLoading}
          >
            REFRESH
          </button>
        </div>
      </div>
      <div className={styles.settingsMetricsGrid}>
        <div className={styles.settingsMetricTile}>
          <span className={styles.settingsMetricLabel}>Sessions</span>
          <span className={styles.settingsMetricValue}>{snapshot.sessions.length}</span>
        </div>
        <div className={styles.settingsMetricTile}>
          <span className={styles.settingsMetricLabel}>Tasks</span>
          <span className={styles.settingsMetricValue}>{snapshot.tasks.length}</span>
        </div>
        <div className={styles.settingsMetricTile}>
          <span className={styles.settingsMetricLabel}>Confirmations</span>
          <span className={styles.settingsMetricValue}>{confirmationCount}</span>
        </div>
        <div className={styles.settingsMetricTile}>
          <span className={styles.settingsMetricLabel}>Decisions</span>
          <span className={styles.settingsMetricValue}>{decisionCount}</span>
        </div>
      </div>
      {error && <p className={styles.settingsErrorText}>{error}</p>}
      {!error && !isLoading && auditEntries.length === 0 && (
        <p className={styles.settingsNotice}>
          No persisted OPY audit events found yet.
        </p>
      )}
      {auditEntries.length > 0 && (
        <div className={styles.settingsAuditList}>
          {auditEntries.slice(0, 12).map((entry) => (
            <section key={entry.id} className={styles.settingsAuditEntry}>
              <div className={styles.settingsAuditEntryHeader}>
                <h3 className={styles.settingsAuditEntryTitle}>{entry.what}</h3>
                <div className={styles.settingsAuditEntryMeta}>
                  <span className={styles.settingsRowValue}>{entry.status}</span>
                  <span className={styles.settingsRowValue}>{entry.who}</span>
                  <span className={styles.settingsRowValue}>{formatTimestamp(entry.at)}</span>
                </div>
              </div>
              <p className={styles.settingsAuditEntryBody}>{`WHY :: ${entry.why}`}</p>
              <p className={styles.settingsAuditEntryBody}>{`SOURCE :: ${entry.sourceSession}`}</p>
              <p className={styles.settingsAuditEntryBody}>{`DETAIL :: ${entry.detail}`}</p>
            </section>
          ))}
        </div>
      )}
    </article>
  );
}
