import { Effect, Layer } from "effect";
import { describe, expect, test } from "vitest";
import { DatabaseService } from "./database.base";
import type { OpyAgentLifecycleRequest } from "./opy-agent.lifecycle";
import type { OpyAgentArtifact, OpyAgentToolCall } from "./opy-agent.trace";
import {
  createOpyAgentArtifact,
  createOpyAgentRun,
  listOpyAgentArtifacts,
  listOpyAgentToolCalls,
  type OpyAgentRun,
  type OpyAgentTask,
  restoreInterruptedOpyAgentSessionState,
  upsertOpyAgentTask,
  upsertOpyAgentToolCall,
} from "./opy-chat.persistence";

interface AgentRunRecord {
  id: string;
  session_id: string;
  agent: string;
  intent: string;
  stage: string;
  status: string;
  started_at: number;
  completed_at: number | null;
  error_summary: string | null;
}

interface AgentTaskRecord {
  id: string;
  session_id: string;
  request_json: string;
  lineage_key: string | null;
  parent_task_id: string | null;
  lifecycle_metadata_json: string | null;
  snapshot_ref_json: string | null;
  stage: string;
  status: string;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
  error_summary: string | null;
}

interface AgentToolCallRecord {
  id: string;
  task_id: string;
  session_id: string;
  name: string;
  status: string;
  started_at: number;
  updated_at: number;
  completed_at: number | null;
  input_summary: string | null;
  output_summary: string | null;
  error_summary: string | null;
}

interface AgentArtifactRecord {
  id: string;
  task_id: string;
  session_id: string;
  tool_call_id: string | null;
  kind: string;
  summary: string;
  payload_json: string;
  created_at: number;
}

const createReadRequest = (sessionId: string): OpyAgentLifecycleRequest => ({
  confirmation: null,
  id: "chat-1",
  mode: "read",
  kind: "chat",
  label: "CHAT",
  requiresConfirmation: false,
  replay: {
    kind: "chat",
    prompt: "review the recovery path",
    sessionId,
  },
});

const createInMemoryDatabaseLayer = () => {
  const runs = new Map<string, AgentRunRecord>();
  const tasks = new Map<string, AgentTaskRecord>();
  const toolCalls = new Map<string, AgentToolCallRecord>();
  const artifacts = new Map<string, AgentArtifactRecord>();

  const service = {
    query: <T>(sql: string, bindValues: unknown[] = []) =>
      Effect.sync(() => {
        if (sql.includes("FROM opy_agent_runs") && sql.includes("status = 'running'")) {
          const sessionId = String(bindValues[0] ?? "");
          return [...runs.values()]
            .filter((run) => run.session_id === sessionId && run.status === "running")
            .sort((left, right) => right.started_at - left.started_at)
            .map((run) => ({
              id: run.id,
              sessionId: run.session_id,
              agent: run.agent,
              intent: run.intent,
              stage: run.stage,
              status: run.status,
              startedAt: run.started_at,
              completedAt: run.completed_at,
              errorSummary: run.error_summary,
            })) as T[];
        }

        if (sql.includes("FROM opy_agent_runs")) {
          const sessionId = String(bindValues[0] ?? "");
          return [...runs.values()]
            .filter((run) => run.session_id === sessionId)
            .sort((left, right) => right.started_at - left.started_at)
            .map((run) => ({
              id: run.id,
              sessionId: run.session_id,
              agent: run.agent,
              intent: run.intent,
              stage: run.stage,
              status: run.status,
              startedAt: run.started_at,
              completedAt: run.completed_at,
              errorSummary: run.error_summary,
            })) as T[];
        }

        if (sql.includes("FROM opy_agent_tasks") && sql.includes("status = 'running'")) {
          const sessionId = String(bindValues[0] ?? "");
          return [...tasks.values()]
            .filter((task) => task.session_id === sessionId && task.status === "running")
            .sort((left, right) => right.updated_at - left.updated_at || right.created_at - left.created_at)
            .map((task) => ({
              id: task.id,
              sessionId: task.session_id,
              requestJson: task.request_json,
              lineageKey: task.lineage_key,
              parentTaskId: task.parent_task_id,
              lifecycleMetadataJson: task.lifecycle_metadata_json,
              snapshotRefJson: task.snapshot_ref_json,
              stage: task.stage,
              status: task.status,
              createdAt: task.created_at,
              updatedAt: task.updated_at,
              completedAt: task.completed_at,
              errorSummary: task.error_summary,
            })) as T[];
        }

        if (sql.includes("FROM opy_agent_tasks")) {
          const sessionId = String(bindValues[0] ?? "");
          return [...tasks.values()]
            .filter((task) => task.session_id === sessionId)
            .sort((left, right) => right.updated_at - left.updated_at || right.created_at - left.created_at)
            .map((task) => ({
              id: task.id,
              sessionId: task.session_id,
              requestJson: task.request_json,
              lineageKey: task.lineage_key,
              parentTaskId: task.parent_task_id,
              lifecycleMetadataJson: task.lifecycle_metadata_json,
              snapshotRefJson: task.snapshot_ref_json,
              stage: task.stage,
              status: task.status,
              createdAt: task.created_at,
              updatedAt: task.updated_at,
              completedAt: task.completed_at,
              errorSummary: task.error_summary,
            })) as T[];
        }

        if (sql.includes("FROM opy_agent_tool_calls") && sql.includes("status = 'running'")) {
          const sessionId = String(bindValues[0] ?? "");
          return [...toolCalls.values()]
            .filter((toolCall) => toolCall.session_id === sessionId && toolCall.status === "running")
            .sort((left, right) => left.started_at - right.started_at || left.updated_at - right.updated_at)
            .map((toolCall) => ({
              id: toolCall.id,
              taskId: toolCall.task_id,
              sessionId: toolCall.session_id,
              name: toolCall.name,
              status: toolCall.status,
              startedAt: toolCall.started_at,
              updatedAt: toolCall.updated_at,
              completedAt: toolCall.completed_at,
              inputSummary: toolCall.input_summary,
              outputSummary: toolCall.output_summary,
              errorSummary: toolCall.error_summary,
            })) as T[];
        }

        if (sql.includes("FROM opy_agent_tool_calls")) {
          const taskId = String(bindValues[0] ?? "");
          return [...toolCalls.values()]
            .filter((toolCall) => toolCall.task_id === taskId)
            .sort((left, right) => left.started_at - right.started_at || left.updated_at - right.updated_at)
            .map((toolCall) => ({
              id: toolCall.id,
              taskId: toolCall.task_id,
              sessionId: toolCall.session_id,
              name: toolCall.name,
              status: toolCall.status,
              startedAt: toolCall.started_at,
              updatedAt: toolCall.updated_at,
              completedAt: toolCall.completed_at,
              inputSummary: toolCall.input_summary,
              outputSummary: toolCall.output_summary,
              errorSummary: toolCall.error_summary,
            })) as T[];
        }

        if (sql.includes("FROM opy_agent_artifacts")) {
          const taskId = String(bindValues[0] ?? "");
          return [...artifacts.values()]
            .filter((artifact) => artifact.task_id === taskId)
            .sort((left, right) => left.created_at - right.created_at)
            .map((artifact) => ({
              id: artifact.id,
              taskId: artifact.task_id,
              sessionId: artifact.session_id,
              toolCallId: artifact.tool_call_id,
              kind: artifact.kind,
              summary: artifact.summary,
              payloadJson: artifact.payload_json,
              createdAt: artifact.created_at,
            })) as T[];
        }

        throw new Error(`Unhandled query SQL in test database: ${sql}`);
      }),
    execute: (sql: string, bindValues: unknown[] = []) =>
      Effect.sync(() => {
        if (sql.includes("INSERT INTO opy_agent_runs")) {
          runs.set(String(bindValues[0]), {
            id: String(bindValues[0]),
            session_id: String(bindValues[1]),
            agent: String(bindValues[2]),
            intent: String(bindValues[3]),
            stage: String(bindValues[4]),
            status: String(bindValues[5]),
            started_at: Number(bindValues[6]),
            completed_at: bindValues[7] === null ? null : Number(bindValues[7]),
            error_summary: bindValues[8] === null ? null : String(bindValues[8]),
          });
          return;
        }

        if (sql.includes("INSERT INTO opy_agent_tasks")) {
          tasks.set(String(bindValues[0]), {
            id: String(bindValues[0]),
            session_id: String(bindValues[1]),
            request_json: String(bindValues[2]),
            lineage_key: bindValues[3] === null ? null : String(bindValues[3]),
            parent_task_id: bindValues[4] === null ? null : String(bindValues[4]),
            lifecycle_metadata_json: bindValues[5] === null ? null : String(bindValues[5]),
            snapshot_ref_json: bindValues[6] === null ? null : String(bindValues[6]),
            stage: String(bindValues[7]),
            status: String(bindValues[8]),
            created_at: Number(bindValues[9]),
            updated_at: Number(bindValues[10]),
            completed_at: bindValues[11] === null ? null : Number(bindValues[11]),
            error_summary: bindValues[12] === null ? null : String(bindValues[12]),
          });
          return;
        }

        if (sql.includes("INSERT INTO opy_agent_tool_calls")) {
          toolCalls.set(String(bindValues[0]), {
            id: String(bindValues[0]),
            task_id: String(bindValues[1]),
            session_id: String(bindValues[2]),
            name: String(bindValues[3]),
            status: String(bindValues[4]),
            started_at: Number(bindValues[5]),
            updated_at: Number(bindValues[6]),
            completed_at: bindValues[7] === null ? null : Number(bindValues[7]),
            input_summary: bindValues[8] === null ? null : String(bindValues[8]),
            output_summary: bindValues[9] === null ? null : String(bindValues[9]),
            error_summary: bindValues[10] === null ? null : String(bindValues[10]),
          });
          return;
        }

        if (sql.includes("INSERT INTO opy_agent_artifacts")) {
          artifacts.set(String(bindValues[0]), {
            id: String(bindValues[0]),
            task_id: String(bindValues[1]),
            session_id: String(bindValues[2]),
            tool_call_id: bindValues[3] === null ? null : String(bindValues[3]),
            kind: String(bindValues[4]),
            summary: String(bindValues[5]),
            payload_json: String(bindValues[6]),
            created_at: Number(bindValues[7]),
          });
          return;
        }

        if (sql.includes("UPDATE opy_agent_runs")) {
          const sessionId = String(bindValues[2] ?? bindValues[5]);
          for (const run of runs.values()) {
            if (run.session_id !== sessionId || run.status !== "running") {
              continue;
            }

            if (sql.includes("status = 'failed'")) {
              run.status = "failed";
              run.completed_at = Number(bindValues[0]);
              run.error_summary = run.error_summary ?? String(bindValues[1]);
            } else {
              run.stage = String(bindValues[0]);
              run.status = String(bindValues[1]);
              run.completed_at = bindValues[2] === null ? null : Number(bindValues[2]);
              run.error_summary = bindValues[3] === null ? null : String(bindValues[3]);
            }
          }
          return;
        }

        if (sql.includes("UPDATE opy_agent_tasks")) {
          const sessionId = String(bindValues[2]);
          for (const task of tasks.values()) {
            if (task.session_id !== sessionId || task.status !== "running") {
              continue;
            }

            task.status = "interrupted";
            task.updated_at = Number(bindValues[0]);
            task.error_summary = task.error_summary ?? String(bindValues[1]);
          }
          return;
        }

        if (sql.includes("UPDATE opy_agent_tool_calls")) {
          const sessionId = String(bindValues[2]);
          for (const toolCall of toolCalls.values()) {
            if (toolCall.session_id !== sessionId || toolCall.status !== "running") {
              continue;
            }

            toolCall.status = "interrupted";
            toolCall.updated_at = Number(bindValues[0]);
            toolCall.error_summary = toolCall.error_summary ?? String(bindValues[1]);
          }
          return;
        }

        throw new Error(`Unhandled execute SQL in test database: ${sql}`);
      }),
    transaction: <A, E, R>(effect: Effect.Effect<A, E, R>) => effect,
  };

  return Layer.succeed(DatabaseService, service);
};

describe("opy agent persistence restart recovery", () => {
  test("restores interrupted runtime state as resumable data after restart", async () => {
    const sessionId = "session-restart";
    const request = createReadRequest(sessionId);
    const layer = createInMemoryDatabaseLayer();
    const runWithDb = <A, E>(effect: Effect.Effect<A, E, DatabaseService>) =>
      Effect.runPromise(effect.pipe(Effect.provide(layer)));

    const run: OpyAgentRun = {
      id: "run-1",
      sessionId,
      agent: "opy-net",
      intent: "chat",
      stage: "invoke",
      status: "running",
      startedAt: 100,
      completedAt: null,
      errorSummary: null,
      usage: null,
      provider: "openai",
      model: "gpt-4o-mini",
    };
    const task: OpyAgentTask = {
      id: "task-1",
      sessionId,
      request,
      stage: "planning",
      status: "running",
      createdAt: 101,
      updatedAt: 102,
      completedAt: null,
      errorSummary: null,
      lineageKey: null,
      parentTaskId: null,
    };
    const toolCall: OpyAgentToolCall = {
      id: "tool-1",
      taskId: task.id,
      sessionId,
      name: "assemble_context",
      status: "running",
      startedAt: 103,
      updatedAt: 104,
      completedAt: null,
      inputSummary: "Collect board context",
      outputSummary: null,
      errorSummary: null,
    };
    const artifact: OpyAgentArtifact = {
      id: "artifact-1",
      taskId: task.id,
      sessionId,
      toolCallId: null,
      kind: "context_bundle",
      summary: "Persisted context bundle",
      payload: {
        board: {
          diagramId: "diagram-1",
          diagramName: "Recovery Board",
          domain: "c4",
          summary: null,
          nodes: [],
          edges: [],
        },
        citations: [],
        nodeCount: 0,
        edgeCount: 0,
      },
      createdAt: 105,
    };

    await runWithDb(createOpyAgentRun(run));
    await runWithDb(upsertOpyAgentTask(task));
    await runWithDb(upsertOpyAgentToolCall(toolCall));
    await runWithDb(createOpyAgentArtifact(artifact));

    const restored = await runWithDb(
      restoreInterruptedOpyAgentSessionState({
        sessionId,
        completedAt: 200,
        updatedAt: 201,
        runErrorSummary: "INTERRUPTED DURING PREVIOUS SESSION.",
        taskErrorSummary: "INTERRUPTED DURING PREVIOUS SESSION.",
        toolCallErrorSummary: "INTERRUPTED DURING PREVIOUS SESSION.",
      }),
    );

    expect(restored.finalizedRuns).toHaveLength(1);
    expect(restored.finalizedRuns[0]?.status).toBe("failed");
    expect(restored.finalizedRuns[0]?.completedAt).toBe(200);

    expect(restored.interruptedTasks).toHaveLength(1);
    expect(restored.interruptedTasks[0]?.status).toBe("interrupted");
    expect(restored.interruptedTasks[0]?.stage).toBe("planning");
    expect(restored.interruptedTasks[0]?.request.replay.kind).toBe("chat");

    expect(restored.interruptedToolCalls).toHaveLength(1);
    expect(restored.interruptedToolCalls[0]?.status).toBe("interrupted");
    expect(restored.interruptedToolCalls[0]?.name).toBe("assemble_context");

    expect(restored.runs.map((item) => item.status)).toEqual(["failed"]);
    expect(restored.tasks.map((item) => item.status)).toEqual(["interrupted"]);

    const restoredToolCalls = await runWithDb(listOpyAgentToolCalls(task.id));
    expect(restoredToolCalls.map((item) => item.status)).toEqual(["interrupted"]);

    const restoredArtifacts = await runWithDb(listOpyAgentArtifacts(task.id));
    expect(restoredArtifacts).toHaveLength(1);
    expect(restoredArtifacts[0]?.kind).toBe("context_bundle");
    expect(restoredArtifacts[0]?.summary).toBe("Persisted context bundle");
  });
});
