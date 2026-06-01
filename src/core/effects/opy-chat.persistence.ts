import { Effect } from "effect";
import { DatabaseService } from "./database.base";

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

const isOpyChatRole = (value: unknown): value is OpyChatRole =>
  value === "assistant" || value === "user" || value === "system";

const isOpyAgentRunAgent = (value: unknown): value is OpyAgentRunAgent => value === "opy-net";

const isOpyAgentRunIntent = (value: unknown): value is OpyAgentRunIntent =>
  value === "chat" || value === "plan-c4-diagram" || value === "review-c4-board";

const isOpyAgentRunStage = (value: unknown): value is OpyAgentRunStage =>
  value === "invoke" || value === "persist" || value === "complete";

const isOpyAgentRunStatus = (value: unknown): value is OpyAgentRunStatus =>
  value === "running" || value === "completed" || value === "failed" || value === "cancelled";

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

const sortSessionsByRecency = (sessions: readonly OpyChatSession[]): OpyChatSession[] =>
  [...sessions].sort((left, right) => right.updatedAt - left.updatedAt);

const sortRunsByRecency = (runs: readonly OpyAgentRun[]): OpyAgentRun[] =>
  [...runs].sort((left, right) => right.startedAt - left.startedAt);

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
