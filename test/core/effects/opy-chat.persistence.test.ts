import { DatabaseError, DatabaseService } from "@/core/effects/database.base";
import type { OpyAgentArtifact, OpyAgentToolCall } from "@/core/effects/opy-agent.trace";
import {
  createOpyAgentArtifact,
  createOpyAgentCheckpoint,
  interruptOpyAgentToolCalls,
  interruptOpyAgentTasks,
  getOpyAgentCheckpoint,
  listAllOpyAgentTasks,
  listAllOpyChatSessions,
  listAllOpyDiagramProposals,
  listOpyAgentArtifacts,
  listOpyAgentTasks,
  listOpyAgentToolCalls,
  listOpyAgentCheckpoints,
  listOpyDiagramProposals,
  type OpyAgentTask,
  type OpyAgentCheckpoint,
  type OpyPersistedDiagramProposal,
  upsertOpyAgentTask,
  upsertOpyAgentToolCall,
  upsertOpyDiagramProposal,
} from "@/core/effects/opy-chat.persistence";
import { Cause, Effect, Layer, Option } from "effect";
import { describe, expect, it, vi } from "vitest";

const createPersistedProposal = (
  overrides?: Partial<OpyPersistedDiagramProposal>,
): OpyPersistedDiagramProposal => ({
  sessionId: "session-1",
  commandDescription: "Add a ledger service downstream from Payments API",
  proposal: {
    summary: "Add Ledger Service",
    rationale: "Separate accounting concerns from the Payments API.",
    warnings: [],
    nodes: [
      {
        key: "ledger-service",
        nodeType: "system",
        label: "Ledger Service",
        description: "Records financial events",
      },
    ],
    edges: [
      {
        sourceKey: "payments-api",
        targetKey: "ledger-service",
        label: "records",
      },
    ],
    provider: "openai",
    model: "gpt-5",
    respondedAtMs: 2_000,
  },
  context: {
    promptContext: "FOCUS=Ledger\nCONFIDENCE=HIGH",
    citations: [
      {
        id: "board:payments",
        tool: "board_summary",
        label: "Payments Context",
        detail: "4 nodes · 3 edges · 2 teams",
        sourceId: "diagram-1",
      },
    ],
    confidence: "high",
    confidenceReason: "Multiple board sources resolved through typed read tools.",
  },
  decisionStatus: "pending",
  decidedAt: 2_100,
  ...overrides,
});

const createCheckpoint = (
  overrides?: Partial<OpyAgentCheckpoint>,
): OpyAgentCheckpoint => ({
  id: "checkpoint-1",
  sessionId: "session-1",
  diagramId: "diagram-1",
  proposalRespondedAtMs: 2_000,
  checkpointType: "pre-apply",
  snapshot: {
    id: "diagram-1",
    name: "Payments Context",
    description: "Tracks payment orchestration",
    nodes: [{ id: "node-1", position: { x: 0, y: 0 }, data: {} }],
    edges: [{ id: "edge-1", source: "node-1", target: "node-2" }],
    savedAt: 1_900,
  },
  createdAt: 2_100,
  ...overrides,
});

const createTask = (
  overrides?: Partial<OpyAgentTask>,
): OpyAgentTask => ({
  id: "task-1",
  sessionId: "session-1",
  request: {
    confirmation: null,
    id: "request-1",
    mode: "read",
    kind: "review",
    label: "REVIEW",
    requiresConfirmation: false,
    replay: {
      kind: "review",
      focus: "Payments API",
      sessionId: "session-1",
    },
  },
  lineageKey: "review:session-1:payments api",
  parentTaskId: null,
  stage: "planning",
  status: "running",
  createdAt: 2_000,
  updatedAt: 2_050,
  completedAt: null,
  errorSummary: null,
  ...overrides,
});

const createToolCall = (
  overrides?: Partial<OpyAgentToolCall>,
): OpyAgentToolCall => ({
  id: "tool-1",
  taskId: "task-1",
  sessionId: "session-1",
  name: "invoke_agent",
  status: "running",
  startedAt: 2_020,
  updatedAt: 2_050,
  completedAt: null,
  inputSummary: "Invoke board review.",
  outputSummary: null,
  errorSummary: null,
  ...overrides,
});

const createArtifact = (
  overrides?: Partial<OpyAgentArtifact>,
): OpyAgentArtifact => ({
  id: "artifact-1",
  taskId: "task-1",
  sessionId: "session-1",
  toolCallId: "tool-1",
  kind: "context_bundle",
  summary: "Context bundle ready.",
  payload: {
    confidence: "high",
    citations: 3,
  },
  createdAt: 2_060,
  ...overrides,
});

const runWithDatabaseService = async <A, E>(
  effect: Effect.Effect<A, E, DatabaseService>,
  handlers: {
    readonly query?: (sql: string, bindValues?: unknown[]) => unknown[];
    readonly execute?: (sql: string, bindValues?: unknown[]) => void;
  },
): Promise<A> => {
  const layer = Layer.succeed(DatabaseService, {
    query: <T>(sql: string, bindValues?: unknown[]) =>
      Effect.try({
        try: () => (handlers.query?.(sql, bindValues) ?? []) as T[],
        catch: (cause) => new DatabaseError({ message: String(cause), cause }),
      }),
    execute: (sql: string, bindValues?: unknown[]) =>
      Effect.try({
        try: () => {
          handlers.execute?.(sql, bindValues);
        },
        catch: (cause) => new DatabaseError({ message: String(cause), cause }),
      }),
    transaction: <R, A2, E2>(inner: Effect.Effect<A2, E2, R>) => inner,
  });

  return Effect.runPromise(effect.pipe(Effect.provide(layer)));
};

const runExitWithDatabaseService = async <A, E>(
  effect: Effect.Effect<A, E, DatabaseService>,
  handlers: {
    readonly query?: (sql: string, bindValues?: unknown[]) => unknown[];
    readonly execute?: (sql: string, bindValues?: unknown[]) => void;
  },
) => {
  const layer = Layer.succeed(DatabaseService, {
    query: <T>(sql: string, bindValues?: unknown[]) =>
      Effect.try({
        try: () => (handlers.query?.(sql, bindValues) ?? []) as T[],
        catch: (cause) => new DatabaseError({ message: String(cause), cause }),
      }),
    execute: (sql: string, bindValues?: unknown[]) =>
      Effect.try({
        try: () => {
          handlers.execute?.(sql, bindValues);
        },
        catch: (cause) => new DatabaseError({ message: String(cause), cause }),
      }),
    transaction: <R, A2, E2>(inner: Effect.Effect<A2, E2, R>) => inner,
  });

  return Effect.runPromiseExit(effect.pipe(Effect.provide(layer)));
};

describe("opy-chat.persistence", () => {
  it("lists all OPY chat sessions across domains for audit views", async () => {
    const sessions = await runWithDatabaseService(
      listAllOpyChatSessions(),
      {
        query: () => [
          {
            id: "session-older",
            title: "Legacy board",
            domain: "ddd",
            diagramId: null,
            createdAt: 500,
            updatedAt: 1_000,
            lastMessageAt: 950,
          },
          {
            id: "session-1",
            title: "Payments board",
            domain: "c4",
            diagramId: "diagram-1",
            createdAt: 1_000,
            updatedAt: 2_000,
            lastMessageAt: 1_900,
          },
        ],
      },
    );

    expect(sessions).toHaveLength(2);
    expect(sessions[0]?.id).toBe("session-1");
    expect(sessions[1]?.domain).toBe("ddd");
  });

  it("loads persisted diagram proposals ordered by latest proposal timestamp", async () => {
    const newestProposal = createPersistedProposal();
    const olderProposal = createPersistedProposal({
      proposal: {
        ...createPersistedProposal().proposal,
        summary: "Reuse existing board only",
        respondedAtMs: 1_000,
      },
      decidedAt: 1_050,
      decisionStatus: "approved",
    });

    const result = await runWithDatabaseService(
      listOpyDiagramProposals("session-1"),
      {
        query: () => [
          {
            sessionId: olderProposal.sessionId,
            commandDescription: olderProposal.commandDescription,
            proposalJson: JSON.stringify(olderProposal.proposal),
            contextJson: JSON.stringify(olderProposal.context),
            decisionStatus: olderProposal.decisionStatus,
            decidedAt: olderProposal.decidedAt,
          },
          {
            sessionId: newestProposal.sessionId,
            commandDescription: newestProposal.commandDescription,
            proposalJson: JSON.stringify(newestProposal.proposal),
            contextJson: JSON.stringify(newestProposal.context),
            decisionStatus: newestProposal.decisionStatus,
            decidedAt: newestProposal.decidedAt,
          },
          {
            sessionId: "session-1",
            commandDescription: "bad row",
            proposalJson: "{}",
            contextJson: "{}",
            decisionStatus: "pending",
            decidedAt: 99,
          },
        ],
      },
    );

    expect(result).toHaveLength(2);
    expect(result[0]?.proposal.respondedAtMs).toBe(2_000);
    expect(result[0]?.decisionStatus).toBe("pending");
    expect(result[1]?.proposal.respondedAtMs).toBe(1_000);
    expect(result[1]?.decisionStatus).toBe("approved");
  });

  it("lists diagram proposals across sessions for audit views", async () => {
    const listed = await runWithDatabaseService(
      listAllOpyDiagramProposals(),
      {
        query: () => [
          {
            sessionId: "session-2",
            commandDescription: "Refine downstream billing context",
            proposalJson: JSON.stringify({
              ...createPersistedProposal().proposal,
              summary: "Refine Billing",
              respondedAtMs: 1_500,
            }),
            contextJson: JSON.stringify(createPersistedProposal().context),
            decisionStatus: "approved",
            decidedAt: 1_600,
          },
          {
            sessionId: "session-1",
            commandDescription: "Add a ledger service downstream from Payments API",
            proposalJson: JSON.stringify(createPersistedProposal().proposal),
            contextJson: JSON.stringify(createPersistedProposal().context),
            decisionStatus: "pending",
            decidedAt: 2_100,
          },
        ],
      },
    );

    expect(listed).toHaveLength(2);
    expect(listed[0]?.sessionId).toBe("session-1");
    expect(listed[1]?.decisionStatus).toBe("approved");
  });

  it("upserts diagram proposal artifacts with serialized proposal and context", async () => {
    const execute = vi.fn();
    const proposal = createPersistedProposal({
      decisionStatus: "approved",
      decidedAt: 2_500,
    });

    const result = await runWithDatabaseService(
      upsertOpyDiagramProposal(proposal),
      { execute },
    );

    expect(result).toEqual(proposal);
    expect(execute).toHaveBeenCalledTimes(1);

    const [sql, values] = execute.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("INSERT INTO opy_diagram_proposals");
    expect(values[0]).toBe("session-1");
    expect(values[1]).toBe(2_000);
    expect(values[2]).toBe(proposal.commandDescription);
    expect(JSON.parse(String(values[3]))).toEqual(proposal.proposal);
    expect(JSON.parse(String(values[4]))).toEqual(proposal.context);
    expect(values[5]).toBe("approved");
    expect(values[6]).toBe(2_500);
  });

  it("creates and lists pre-apply checkpoints with serialized board snapshots", async () => {
    const execute = vi.fn();
    const checkpoint = createCheckpoint();

    const createResult = await runWithDatabaseService(
      createOpyAgentCheckpoint(checkpoint),
      { execute },
    );

    expect(createResult).toEqual(checkpoint);
    const [insertSql, insertValues] = execute.mock.calls[0] as [string, unknown[]];
    expect(insertSql).toContain("INSERT INTO opy_agent_checkpoints");
    expect(insertValues[0]).toBe("checkpoint-1");
    expect(insertValues[1]).toBe("session-1");
    expect(insertValues[2]).toBe("diagram-1");
    expect(insertValues[3]).toBe(2_000);
    expect(insertValues[4]).toBe("pre-apply");
    expect(JSON.parse(String(insertValues[5]))).toEqual(checkpoint.snapshot);
    expect(insertValues[6]).toBe(2_100);

    const listed = await runWithDatabaseService(
      listOpyAgentCheckpoints("session-1"),
      {
        query: () => [
          {
            id: "checkpoint-older",
            sessionId: "session-1",
            diagramId: "diagram-1",
            proposalRespondedAtMs: 1_000,
            checkpointType: "pre-apply",
            snapshotJson: JSON.stringify({
              id: "diagram-1",
              name: "Payments Context",
              nodes: [],
              edges: [],
              savedAt: null,
            }),
            createdAt: 1_100,
          },
          {
            id: "checkpoint-1",
            sessionId: "session-1",
            diagramId: "diagram-1",
            proposalRespondedAtMs: 2_000,
            checkpointType: "pre-apply",
            snapshotJson: JSON.stringify(checkpoint.snapshot),
            createdAt: 2_100,
          },
        ],
      },
    );

    expect(listed).toHaveLength(2);
    expect(listed[0]?.id).toBe("checkpoint-1");
    expect(listed[0]?.snapshot.name).toBe("Payments Context");
    expect(listed[1]?.id).toBe("checkpoint-older");
  });

  it("loads a checkpoint by id and rejects when it is missing", async () => {
    const checkpoint = createCheckpoint();

    const loaded = await runWithDatabaseService(
      getOpyAgentCheckpoint("checkpoint-1"),
      {
        query: () => [
          {
            id: checkpoint.id,
            sessionId: checkpoint.sessionId,
            diagramId: checkpoint.diagramId,
            proposalRespondedAtMs: checkpoint.proposalRespondedAtMs,
            checkpointType: checkpoint.checkpointType,
            snapshotJson: JSON.stringify(checkpoint.snapshot),
            createdAt: checkpoint.createdAt,
          },
        ],
      },
    );

    expect(loaded).toEqual(checkpoint);

    const exit = await runExitWithDatabaseService(
      getOpyAgentCheckpoint("missing"),
      {
        query: () => [],
      },
    );

    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      const failure = Cause.failureOption(exit.cause);
      expect(Option.isSome(failure)).toBe(true);
      if (Option.isSome(failure)) {
        expect(failure.value).toMatchObject({
          _tag: "NotFoundError",
          entity: "opy_agent_checkpoint",
          id: "missing",
        });
      }
    }
  });

  it("upserts and lists persisted OPY agent tasks", async () => {
    const execute = vi.fn();
    const task = createTask();

    const persistedTask = await runWithDatabaseService(
      upsertOpyAgentTask(task),
      { execute },
    );

    expect(persistedTask).toEqual(task);
    const [upsertSql, upsertValues] = execute.mock.calls[0] as [string, unknown[]];
    expect(upsertSql).toContain("INSERT INTO opy_agent_tasks");
    expect(upsertValues[0]).toBe("task-1");
    expect(upsertValues[1]).toBe("session-1");
    expect(JSON.parse(String(upsertValues[2]))).toEqual(task.request);
    expect(upsertValues[3]).toBe("review:session-1:payments api");
    expect(upsertValues[4]).toBeNull();
    expect(upsertValues[5]).toBe("planning");
    expect(upsertValues[6]).toBe("running");

    const listed = await runWithDatabaseService(
      listOpyAgentTasks("session-1"),
      {
        query: () => [
          {
            id: "task-older",
            sessionId: "session-1",
            requestJson: JSON.stringify({
              confirmation: null,
              id: "request-older",
              mode: "read",
              kind: "chat",
              label: "CHAT",
              requiresConfirmation: false,
              replay: {
                kind: "chat",
                prompt: "older",
                sessionId: "session-1",
              },
            }),
            lineageKey: "chat:session-1:older",
            parentTaskId: null,
            stage: "contextualizing",
            status: "interrupted",
            createdAt: 1_000,
            updatedAt: 1_050,
            completedAt: null,
            errorSummary: "INTERRUPTED",
          },
          {
            id: task.id,
            sessionId: task.sessionId,
            requestJson: JSON.stringify(task.request),
            lineageKey: task.lineageKey,
            parentTaskId: task.parentTaskId,
            stage: task.stage,
            status: task.status,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt,
            completedAt: task.completedAt,
            errorSummary: task.errorSummary,
          },
        ],
      },
    );

    expect(listed).toHaveLength(2);
    expect(listed[0]?.id).toBe("task-1");
    expect(listed[0]?.request.label).toBe("REVIEW");
    expect(listed[0]?.lineageKey).toBe("review:session-1:payments api");
    expect(listed[1]?.status).toBe("interrupted");
  });

  it("lists persisted OPY agent tasks across sessions for audit views", async () => {
    const task = createTask();

    const listed = await runWithDatabaseService(
      listAllOpyAgentTasks(),
      {
        query: () => [
          {
            id: "task-other",
            sessionId: "session-2",
            requestJson: JSON.stringify({
              confirmation: null,
              id: "request-other",
              mode: "action",
              kind: "add-node",
              label: "ADD NODE",
              requiresConfirmation: true,
              replay: {
                kind: "add-node",
                label: "Billing API",
                nodeType: "system",
                sessionId: "session-2",
              },
            }),
            lineageKey: "add-node:session-2:billing api",
            parentTaskId: null,
            stage: "awaiting_confirmation",
            status: "running",
            createdAt: 1_500,
            updatedAt: 1_700,
            completedAt: null,
            errorSummary: null,
          },
          {
            id: task.id,
            sessionId: task.sessionId,
            requestJson: JSON.stringify(task.request),
            lineageKey: task.lineageKey,
            parentTaskId: task.parentTaskId,
            stage: task.stage,
            status: task.status,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt,
            completedAt: task.completedAt,
            errorSummary: task.errorSummary,
          },
        ],
      },
    );

    expect(listed).toHaveLength(2);
    expect(listed[0]?.id).toBe("task-1");
    expect(listed[1]?.sessionId).toBe("session-2");
  });

  it("interrupts running OPY agent tasks on resume hydration", async () => {
    const task = createTask();
    const execute = vi.fn();

    const interrupted = await runWithDatabaseService(
      interruptOpyAgentTasks({
        sessionId: "session-1",
        errorSummary: "INTERRUPTED DURING PREVIOUS SESSION.",
        updatedAt: 3_000,
      }),
      {
        query: () => [
          {
            id: task.id,
            sessionId: task.sessionId,
            requestJson: JSON.stringify(task.request),
            lineageKey: task.lineageKey,
            parentTaskId: task.parentTaskId,
            stage: task.stage,
            status: task.status,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt,
            completedAt: task.completedAt,
            errorSummary: task.errorSummary,
          },
        ],
        execute,
      },
    );

    expect(interrupted).toHaveLength(1);
    expect(interrupted[0]).toMatchObject({
      id: "task-1",
      status: "interrupted",
      updatedAt: 3_000,
      errorSummary: "INTERRUPTED DURING PREVIOUS SESSION.",
    });

    const [updateSql, updateValues] = execute.mock.calls[0] as [string, unknown[]];
    expect(updateSql).toContain("UPDATE opy_agent_tasks");
    expect(updateValues[0]).toBe(3_000);
    expect(updateValues[1]).toBe("INTERRUPTED DURING PREVIOUS SESSION.");
    expect(updateValues[2]).toBe("session-1");
  });

  it("upserts and lists persisted OPY agent tool calls", async () => {
    const execute = vi.fn();
    const toolCall = createToolCall();

    const persistedToolCall = await runWithDatabaseService(
      upsertOpyAgentToolCall(toolCall),
      { execute },
    );

    expect(persistedToolCall).toEqual(toolCall);
    const [upsertSql, upsertValues] = execute.mock.calls[0] as [string, unknown[]];
    expect(upsertSql).toContain("INSERT INTO opy_agent_tool_calls");
    expect(upsertValues[0]).toBe("tool-1");
    expect(upsertValues[1]).toBe("task-1");
    expect(upsertValues[2]).toBe("session-1");
    expect(upsertValues[3]).toBe("invoke_agent");

    const listed = await runWithDatabaseService(
      listOpyAgentToolCalls("task-1"),
      {
        query: () => [
          {
            id: "tool-older",
            taskId: "task-1",
            sessionId: "session-1",
            name: "assemble_context",
            status: "completed",
            startedAt: 2_000,
            updatedAt: 2_010,
            completedAt: 2_010,
            inputSummary: "Build context.",
            outputSummary: "CONFIDENCE::HIGH",
            errorSummary: null,
          },
          {
            id: toolCall.id,
            taskId: toolCall.taskId,
            sessionId: toolCall.sessionId,
            name: toolCall.name,
            status: toolCall.status,
            startedAt: toolCall.startedAt,
            updatedAt: toolCall.updatedAt,
            completedAt: toolCall.completedAt,
            inputSummary: toolCall.inputSummary,
            outputSummary: toolCall.outputSummary,
            errorSummary: toolCall.errorSummary,
          },
        ],
      },
    );

    expect(listed).toHaveLength(2);
    expect(listed[0]?.id).toBe("tool-older");
    expect(listed[1]?.id).toBe("tool-1");
  });

  it("creates and lists persisted OPY agent artifacts", async () => {
    const execute = vi.fn();
    const artifact = createArtifact();

    const persistedArtifact = await runWithDatabaseService(
      createOpyAgentArtifact(artifact),
      { execute },
    );

    expect(persistedArtifact).toEqual(artifact);
    const [insertSql, insertValues] = execute.mock.calls[0] as [string, unknown[]];
    expect(insertSql).toContain("INSERT INTO opy_agent_artifacts");
    expect(insertValues[0]).toBe("artifact-1");
    expect(insertValues[1]).toBe("task-1");
    expect(insertValues[4]).toBe("context_bundle");
    expect(JSON.parse(String(insertValues[6]))).toEqual(artifact.payload);

    const listed = await runWithDatabaseService(
      listOpyAgentArtifacts("task-1"),
      {
        query: () => [
          {
            id: artifact.id,
            taskId: artifact.taskId,
            sessionId: artifact.sessionId,
            toolCallId: artifact.toolCallId,
            kind: artifact.kind,
            summary: artifact.summary,
            payloadJson: JSON.stringify(artifact.payload),
            createdAt: artifact.createdAt,
          },
        ],
      },
    );

    expect(listed).toHaveLength(1);
    expect(listed[0]).toEqual(artifact);
  });

  it("interrupts running OPY agent tool calls on resume hydration", async () => {
    const toolCall = createToolCall();
    const execute = vi.fn();

    const interrupted = await runWithDatabaseService(
      interruptOpyAgentToolCalls({
        sessionId: "session-1",
        errorSummary: "INTERRUPTED DURING PREVIOUS SESSION.",
        updatedAt: 3_100,
      }),
      {
        query: () => [
          {
            id: toolCall.id,
            taskId: toolCall.taskId,
            sessionId: toolCall.sessionId,
            name: toolCall.name,
            status: toolCall.status,
            startedAt: toolCall.startedAt,
            updatedAt: toolCall.updatedAt,
            completedAt: toolCall.completedAt,
            inputSummary: toolCall.inputSummary,
            outputSummary: toolCall.outputSummary,
            errorSummary: toolCall.errorSummary,
          },
        ],
        execute,
      },
    );

    expect(interrupted).toHaveLength(1);
    expect(interrupted[0]).toMatchObject({
      id: "tool-1",
      status: "interrupted",
      updatedAt: 3_100,
      errorSummary: "INTERRUPTED DURING PREVIOUS SESSION.",
    });

    const [updateSql, updateValues] = execute.mock.calls[0] as [string, unknown[]];
    expect(updateSql).toContain("UPDATE opy_agent_tool_calls");
    expect(updateValues[0]).toBe(3_100);
    expect(updateValues[1]).toBe("INTERRUPTED DURING PREVIOUS SESSION.");
    expect(updateValues[2]).toBe("session-1");
  });
});
