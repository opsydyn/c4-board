import { describe, expect, test } from "vitest";
import { createActor } from "xstate";
import { createOpyAgentMachine, type OpyAgentLifecycleRequest } from "./opy-agent.machine";

const createReadRequest = (): OpyAgentLifecycleRequest => ({
  confirmation: null,
  id: "read-1",
  mode: "read",
  kind: "chat",
  label: "CHAT",
  requiresConfirmation: false,
  replay: {
    kind: "chat",
    prompt: "hello",
    sessionId: "session-1",
  },
});

const createActionRequest = (): OpyAgentLifecycleRequest => ({
  confirmation: {
    cancelMessage: "ACTION CANCELLED BY OPERATOR.",
    confirmationLines: [
      "Apply OPY board action?",
      "ADD COMPONENT \"Ledger Service\"",
    ],
    failurePrefix: "BOARD ACTION FAILED",
    sessionId: "session-1",
  },
  id: "action-1",
  mode: "action",
  kind: "apply-proposal",
  label: "APPLY",
  requiresConfirmation: true,
  replay: {
    kind: "apply-proposal",
    proposalRespondedAtMs: 123,
    sessionId: "session-1",
  },
});

describe("opyAgentMachine", () => {
  test("advances a read flow through explicit lifecycle stages", () => {
    const actor = createActor(createOpyAgentMachine());
    actor.start();

    actor.send({ type: "START_READ", request: createReadRequest() });
    expect(actor.getSnapshot().value).toBe("contextualizing");

    actor.send({ type: "CONTEXT_READY" });
    expect(actor.getSnapshot().value).toBe("planning");

    actor.send({ type: "RESULT_READY" });
    expect(actor.getSnapshot().value).toBe("proposing");

    actor.send({ type: "PERSIST_READY" });
    expect(actor.getSnapshot().value).toBe("verifying");

    actor.send({ type: "COMPLETE" });
    const snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe("completed");
    expect(snapshot.context.lastTerminalStatus).toBe("completed");
    expect(snapshot.context.activeRequest).toBeNull();
    expect(snapshot.context.lastRequest?.kind).toBe("chat");
  });

  test("supports confirmed action flow with cancellation and retry semantics", () => {
    const actor = createActor(createOpyAgentMachine());
    actor.start();

    actor.send({ type: "START_ACTION", request: createActionRequest() });
    let snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe("awaiting_confirmation");
    expect(snapshot.context.activeRequest?.confirmation?.sessionId).toBe("session-1");

    actor.send({ type: "CANCEL" });
    snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe("completed");
    expect(snapshot.context.lastTerminalStatus).toBe("cancelled");
    expect(snapshot.context.activeRequest).toBeNull();

    actor.send({ type: "RETRY" });
    expect(actor.getSnapshot().value).toBe("awaiting_confirmation");

    actor.send({ type: "CONFIRM" });
    expect(actor.getSnapshot().value).toBe("applying");

    actor.send({ type: "VERIFY_READY" });
    expect(actor.getSnapshot().value).toBe("verifying");

    actor.send({ type: "COMPLETE" });
    snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe("completed");
    expect(snapshot.context.lastTerminalStatus).toBe("completed");
    expect(snapshot.context.lastRequest?.kind).toBe("apply-proposal");
  });

  test("clears pending confirmation context on reset", () => {
    const actor = createActor(createOpyAgentMachine());
    actor.start();

    actor.send({ type: "START_ACTION", request: createActionRequest() });
    expect(actor.getSnapshot().value).toBe("awaiting_confirmation");
    expect(actor.getSnapshot().context.activeRequest?.confirmation).not.toBeNull();

    actor.send({ type: "RESET" });
    const snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe("idle");
    expect(snapshot.context.activeRequest).toBeNull();
    expect(snapshot.context.lastRequest).toBeNull();
    expect(snapshot.context.lastTerminalStatus).toBeNull();
  });

  test("records failure stage and re-enters the correct stage on retry", () => {
    const actor = createActor(createOpyAgentMachine());
    actor.start();

    actor.send({ type: "START_READ", request: createReadRequest() });
    actor.send({ type: "CONTEXT_READY" });
    actor.send({
      type: "FAIL",
      message: "planner offline",
      phase: "invoke",
      stage: "planning",
    });

    let snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe("failed");
    expect(snapshot.context.lastTerminalStatus).toBe("failed");
    expect(snapshot.context.lastError).toBe("planner offline");
    expect(snapshot.context.lastFailureStage).toBe("planning");
    expect(snapshot.context.lastFailurePhase).toBe("invoke");

    actor.send({ type: "RETRY" });
    snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe("contextualizing");
    expect(snapshot.context.lastError).toBeNull();
    expect(snapshot.context.lastFailurePhase).toBeNull();
    expect(snapshot.context.lastFailureStage).toBeNull();
  });

  test("records action failure provenance separately from lifecycle stage", () => {
    const actor = createActor(createOpyAgentMachine());
    actor.start();

    actor.send({ type: "START_ACTION", request: createActionRequest() });
    actor.send({ type: "CONFIRM" });
    actor.send({ type: "VERIFY_READY" });
    actor.send({
      type: "FAIL",
      message: "assistant confirmation could not be stored",
      phase: "persist",
      stage: "verifying",
    });

    const snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe("failed");
    expect(snapshot.context.lastFailureStage).toBe("verifying");
    expect(snapshot.context.lastFailurePhase).toBe("persist");
  });

  test("hydrates and resumes an interrupted request", () => {
    const actor = createActor(createOpyAgentMachine());
    actor.start();

    actor.send({
      type: "HYDRATE_RESUMABLE",
      request: createActionRequest(),
      stage: "awaiting_confirmation",
      taskId: "task-1",
      updatedAt: 500,
    });

    let snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe("idle");
    expect(snapshot.context.resumableTaskId).toBe("task-1");
    expect(snapshot.context.resumableStage).toBe("awaiting_confirmation");
    expect(snapshot.context.resumableRequest?.id).toBe("action-1");

    actor.send({ type: "RESUME" });
    snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe("awaiting_confirmation");
    expect(snapshot.context.activeRequest?.id).toBe("action-1");
    expect(snapshot.context.resumableRequest).toBeNull();
    expect(snapshot.context.resumableTaskId).toBeNull();
  });

  test.each(["applying", "verifying"] as const)(
    "resumes a confirmed action directly into applying when interrupted during %s",
    (stage) => {
      const actor = createActor(createOpyAgentMachine());
      actor.start();

      actor.send({
        type: "HYDRATE_RESUMABLE",
        request: createActionRequest(),
        stage,
        taskId: "task-2",
        updatedAt: 750,
      });

      actor.send({ type: "RESUME" });
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("applying");
      expect(snapshot.context.activeRequest?.id).toBe("action-1");
      expect(snapshot.context.resumableRequest).toBeNull();
      expect(snapshot.context.resumableTaskId).toBeNull();
    },
  );
});
