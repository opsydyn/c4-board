import { Effect } from "effect";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildOpyReplayEvalDashboard } from "../../../core/effects/opy-agent.evals";
import type { OpyAgentArtifact, OpyAgentToolCall } from "../../../core/effects/opy-agent.trace";
import type { OpyAnomalyAssessment } from "../../../core/effects/opy-anomaly";
import {
  listAllOpyAgentArtifacts,
  listAllOpyAgentTasks,
  listAllOpyAgentToolCalls,
  listAllOpyChatSessions,
  listAllOpyDiagramProposals,
  type OpyAgentTask,
  type OpyChatSession,
  type OpyPersistedDiagramProposal,
} from "../../../core/effects/opy-chat.persistence";
import { assessOpyReleaseReadiness } from "../../../core/effects/opy-release-readiness";
import { useDatabase } from "../../../core/effects/useDatabase";
import * as styles from "../../../styles/pages/settings.css";

interface AgentAuditSnapshot {
  readonly artifacts: ReadonlyArray<OpyAgentArtifact>;
  readonly sessions: ReadonlyArray<OpyChatSession>;
  readonly tasks: ReadonlyArray<OpyAgentTask>;
  readonly toolCalls: ReadonlyArray<OpyAgentToolCall>;
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

interface PersistedAnomalyAssessmentPayload {
  readonly assessment: OpyAnomalyAssessment;
  readonly requestText: string;
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

  return `${session.title.toUpperCase()} · ${session.domain.toUpperCase()}${
    session.diagramId ? ` · ${session.diagramId}` : ""
  }`;
};

const formatDuration = (durationMs: number | null): string => {
  if (durationMs === null || !Number.isFinite(durationMs) || durationMs < 0) {
    return "N/A";
  }

  if (durationMs < 1_000) {
    return `${Math.round(durationMs)}MS`;
  }
  if (durationMs < 60_000) {
    return `${(durationMs / 1_000).toFixed(1)}S`;
  }

  return `${(durationMs / 60_000).toFixed(1)}M`;
};

const formatPercent = (value: number | null): string =>
  value === null || !Number.isFinite(value)
    ? "N/A"
    : `${Math.round(value * 100)}%`;

const isAnomalySeverity = (
  value: unknown,
): value is OpyAnomalyAssessment["severity"] => value === "none" || value === "caution" || value === "critical";

const isAnomalySignalKind = (value: unknown): value is OpyAnomalyAssessment["signals"][number]["kind"] =>
  value === "prompt-injection"
  || value === "secret-exfiltration"
  || value === "policy-evasion"
  || value === "destructive-mutation";

const isOpyAnomalyAssessment = (value: unknown): value is OpyAnomalyAssessment => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<OpyAnomalyAssessment>;
  return (
    (candidate.requestKind === "chat"
      || candidate.requestKind === "review"
      || candidate.requestKind === "proposal"
      || candidate.requestKind === "action")
    && isAnomalySeverity(candidate.severity)
    && typeof candidate.blocked === "boolean"
    && typeof candidate.score === "number"
    && typeof candidate.summary === "string"
    && typeof candidate.recommendedAction === "string"
    && Array.isArray(candidate.signals)
    && candidate.signals.every((signal) =>
      signal
      && typeof signal === "object"
      && isAnomalySignalKind((signal as { kind?: unknown }).kind)
      && (
        (signal as { severity?: unknown }).severity === "caution"
        || (signal as { severity?: unknown }).severity === "critical"
      )
      && typeof (signal as { evidence?: unknown }).evidence === "string"
    )
  );
};

const isPersistedAnomalyAssessmentPayload = (
  value: unknown,
): value is PersistedAnomalyAssessmentPayload => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PersistedAnomalyAssessmentPayload>;
  return isOpyAnomalyAssessment(candidate.assessment)
    && typeof candidate.requestText === "string";
};

const decodePersistedAnomalyArtifact = (
  artifact: OpyAgentArtifact,
): PersistedAnomalyAssessmentPayload | null => (
  artifact.kind === "anomaly_assessment" && isPersistedAnomalyAssessmentPayload(artifact.payload)
    ? artifact.payload
    : null
);

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

const describeTaskStatus = (task: OpyAgentTask): string => `${task.status.toUpperCase()} · ${task.stage.toUpperCase()}`;

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

  const anomalyEntries = snapshot.artifacts.flatMap((artifact) => {
    const payload = decodePersistedAnomalyArtifact(artifact);
    if (!payload || payload.assessment.severity === "none") {
      return [];
    }

    return [{
      id: `artifact:${artifact.id}`,
      at: artifact.createdAt,
      who: "OPY GUARD",
      what: `ANOMALY ${payload.assessment.severity.toUpperCase()}`,
      status: payload.assessment.blocked
        ? "PREFLIGHT · BLOCKED"
        : "PREFLIGHT · CAUTION",
      why: payload.assessment.summary,
      sourceSession: formatSessionLabel(sessionById.get(artifact.sessionId)),
      detail:
        `REQUEST ${payload.assessment.requestKind.toUpperCase()} · SCORE ${payload.assessment.score} · ${payload.requestText}`,
    }] satisfies ReadonlyArray<AgentAuditEntry>;
  });

  return [...taskEntries, ...proposalEntries, ...anomalyEntries].sort((left, right) => right.at - left.at);
};

const toErrorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);

export function AgentAuditPanel() {
  const { runEffect } = useDatabase();
  const [snapshot, setSnapshot] = useState<AgentAuditSnapshot>({
    artifacts: [],
    sessions: [],
    tasks: [],
    toolCalls: [],
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
        artifacts: listAllOpyAgentArtifacts(),
        sessions: listAllOpyChatSessions(),
        tasks: listAllOpyAgentTasks(),
        toolCalls: listAllOpyAgentToolCalls(),
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
  const cancelledTaskCount = useMemo(
    () => snapshot.tasks.filter((task) => task.status === "cancelled").length,
    [snapshot.tasks],
  );
  const failedTaskCount = useMemo(
    () => snapshot.tasks.filter((task) => task.status === "failed").length,
    [snapshot.tasks],
  );
  const anomalyArtifacts = useMemo(
    () =>
      snapshot.artifacts
        .map((artifact) => ({
          artifact,
          payload: decodePersistedAnomalyArtifact(artifact),
        }))
        .filter((entry): entry is {
          readonly artifact: OpyAgentArtifact;
          readonly payload: PersistedAnomalyAssessmentPayload;
        } => entry.payload !== null && entry.payload.assessment.severity !== "none"),
    [snapshot.artifacts],
  );
  const anomalyCount = useMemo(
    () => anomalyArtifacts.length,
    [anomalyArtifacts],
  );
  const blockedAnomalyCount = useMemo(
    () => anomalyArtifacts.filter((entry) => entry.payload.assessment.blocked).length,
    [anomalyArtifacts],
  );
  const decisionCount = useMemo(
    () => snapshot.proposals.filter((proposal) => proposal.decisionStatus !== "pending").length,
    [snapshot.proposals],
  );
  const replayEvalDashboard = useMemo(
    () =>
      buildOpyReplayEvalDashboard({
        tasks: snapshot.tasks,
        artifacts: snapshot.artifacts,
        toolCalls: snapshot.toolCalls,
      }),
    [snapshot.artifacts, snapshot.tasks, snapshot.toolCalls],
  );
  const releaseReadiness = useMemo(
    () =>
      assessOpyReleaseReadiness({
        tasks: snapshot.tasks,
        artifacts: snapshot.artifacts,
        toolCalls: snapshot.toolCalls,
        proposals: snapshot.proposals,
      }),
    [snapshot.artifacts, snapshot.proposals, snapshot.tasks, snapshot.toolCalls],
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
          <span className={styles.settingsMetricLabel}>Anomalies</span>
          <span className={styles.settingsMetricValue}>{anomalyCount}</span>
        </div>
        <div className={styles.settingsMetricTile}>
          <span className={styles.settingsMetricLabel}>Blocked</span>
          <span className={styles.settingsMetricValue}>{blockedAnomalyCount}</span>
        </div>
        <div className={styles.settingsMetricTile}>
          <span className={styles.settingsMetricLabel}>Confirmations</span>
          <span className={styles.settingsMetricValue}>{confirmationCount}</span>
        </div>
        <div className={styles.settingsMetricTile}>
          <span className={styles.settingsMetricLabel}>Cancelled</span>
          <span className={styles.settingsMetricValue}>{cancelledTaskCount}</span>
        </div>
        <div className={styles.settingsMetricTile}>
          <span className={styles.settingsMetricLabel}>Failures</span>
          <span className={styles.settingsMetricValue}>{failedTaskCount}</span>
        </div>
        <div className={styles.settingsMetricTile}>
          <span className={styles.settingsMetricLabel}>Decisions</span>
          <span className={styles.settingsMetricValue}>{decisionCount}</span>
        </div>
        <div className={styles.settingsMetricTile}>
          <span className={styles.settingsMetricLabel}>Avg Duration</span>
          <span className={styles.settingsMetricValue}>
            {formatDuration(replayEvalDashboard.taskLatency.averageMs)}
          </span>
        </div>
        <div className={styles.settingsMetricTile}>
          <span className={styles.settingsMetricLabel}>Task p50</span>
          <span className={styles.settingsMetricValue}>{formatDuration(replayEvalDashboard.taskLatency.p50Ms)}</span>
        </div>
        <div className={styles.settingsMetricTile}>
          <span className={styles.settingsMetricLabel}>Task p95</span>
          <span className={styles.settingsMetricValue}>{formatDuration(replayEvalDashboard.taskLatency.p95Ms)}</span>
        </div>
        <div className={styles.settingsMetricTile}>
          <span className={styles.settingsMetricLabel}>Tool p95</span>
          <span className={styles.settingsMetricValue}>
            {formatDuration(replayEvalDashboard.toolCallLatency.p95Ms)}
          </span>
        </div>
        <div className={styles.settingsMetricTile}>
          <span className={styles.settingsMetricLabel}>Tool Success</span>
          <span className={styles.settingsMetricValue}>{formatPercent(replayEvalDashboard.toolSuccessRate)}</span>
        </div>
        <div className={styles.settingsMetricTile}>
          <span className={styles.settingsMetricLabel}>Replayable</span>
          <span className={styles.settingsMetricValue}>{replayEvalDashboard.replayableTaskCount}</span>
        </div>
        <div className={styles.settingsMetricTile}>
          <span className={styles.settingsMetricLabel}>Replay Partial</span>
          <span className={styles.settingsMetricValue}>{replayEvalDashboard.partialTaskCount}</span>
        </div>
        <div className={styles.settingsMetricTile}>
          <span className={styles.settingsMetricLabel}>Replay Blocked</span>
          <span className={styles.settingsMetricValue}>{replayEvalDashboard.blockedTaskCount}</span>
        </div>
      </div>
      <div className={styles.settingsRow}>
        <div className={styles.settingsRowLabel}>
          <span>Release Readiness</span>
          <span className={styles.settingsRowHint}>
            Whether the persisted evidence supports widening mutation defaults. Advisory only — it changes nothing on
            its own.
          </span>
        </div>
        <span className={styles.settingsRowValue}>
          {releaseReadiness.verdict.toUpperCase()}
        </span>
      </div>
      <div className={styles.settingsAuditList}>
        {releaseReadiness.signals.map((signal) => (
          <section key={signal.id} className={styles.settingsAuditEntry}>
            <div className={styles.settingsAuditEntryHeader}>
              <h3 className={styles.settingsAuditEntryTitle}>{signal.id.toUpperCase()}</h3>
              <div className={styles.settingsAuditEntryMeta}>
                <span className={styles.settingsRowValue}>{signal.verdict.toUpperCase()}</span>
                <span className={styles.settingsRowValue}>{`n=${signal.sampleSize}`}</span>
              </div>
            </div>
            <p className={styles.settingsAuditEntryBody}>{signal.summary}</p>
          </section>
        ))}
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
