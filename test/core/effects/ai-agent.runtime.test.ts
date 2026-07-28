/**
 * The Effect boundary for the three Rig commands (ADR-008, Rig 0.40 gate).
 *
 * Rig 0.40 reports provider token usage, and `rig_runtime.rs` normalizes it into
 * a required `usage` envelope on every command response. These tests prove the
 * envelope survives the crossing into TypeScript, and that a malformed one is
 * rejected at the boundary rather than flowing into OPY as `NaN` token counts.
 */

import type { AgentError } from "@/core/effects/ai-agent.runtime";
import { Effect, Either } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

const { planRigC4Diagram, reviewRigC4Board, runRigHello } = await import(
  "@/core/effects/ai-agent.runtime"
);

const usage = {
  inputTokens: 12,
  outputTokens: 4,
  totalTokens: 16,
  cachedInputTokens: 0,
  cacheCreationInputTokens: 0,
  toolUsePromptTokens: 0,
  reasoningTokens: 0,
};

const helloResponse = {
  message: "ready",
  provider: "openai",
  model: "gpt-4o-mini",
  prompt: "hello",
  temperature: 0.2,
  maxTokens: 1024,
  respondedAtMs: 99,
  usage,
};

const proposalResponse = {
  summary: "A single service",
  rationale: "The description named one service",
  warnings: [],
  nodes: [{ key: "svc", nodeType: "container", label: "Service", description: null }],
  edges: [],
  provider: "openai",
  model: "gpt-4o-mini",
  respondedAtMs: 99,
  usage,
};

const reviewResponse = {
  summary: "The board is coherent",
  strengths: [{ title: "Clear boundaries", detail: "Containers map to teams" }],
  risks: [],
  ambiguities: [],
  missingNodes: [],
  missingEdges: [],
  recommendedChanges: [],
  provider: "openai",
  model: "gpt-4o-mini",
  respondedAtMs: 99,
  usage,
};

const boardSummary = {
  diagramId: "diagram-1",
  diagramName: "System",
  diagramLevel: "container",
  nodes: [],
  edges: [],
} as never;

const failureOf = async (effect: Effect.Effect<unknown, AgentError>): Promise<AgentError> => {
  const result = await Effect.runPromise(Effect.either(effect));
  if (Either.isRight(result)) {
    throw new Error("Expected the Rig command boundary to fail");
  }
  return result.left;
};

describe("Rig provider usage metadata", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("decodes provider usage returned by the hello command", async () => {
    invokeMock.mockResolvedValue(helloResponse);

    const response = await Effect.runPromise(runRigHello({ prompt: "hello" }));

    expect(response.usage).toEqual(usage);
  });

  it("decodes provider usage returned by the diagram proposal command", async () => {
    invokeMock.mockResolvedValue(proposalResponse);

    const response = await Effect.runPromise(planRigC4Diagram({ description: "one service" }));

    expect(response.usage).toEqual(usage);
  });

  it("decodes provider usage returned by the board review command", async () => {
    invokeMock.mockResolvedValue(reviewResponse);

    const response = await Effect.runPromise(reviewRigC4Board({ boardSummary }));

    expect(response.usage).toEqual(usage);
  });

  it("preserves a provider that reports no usage as zeros rather than as absence", async () => {
    const zeroUsage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cachedInputTokens: 0,
      cacheCreationInputTokens: 0,
      toolUsePromptTokens: 0,
      reasoningTokens: 0,
    };
    invokeMock.mockResolvedValue({ ...helloResponse, usage: zeroUsage });

    const response = await Effect.runPromise(runRigHello({ prompt: "hello" }));

    expect(response.usage).toEqual(zeroUsage);
  });

  it("rejects a malformed usage envelope at the boundary", async () => {
    invokeMock.mockResolvedValue({ ...helloResponse, usage: { inputTokens: "twelve" } });

    const error = await failureOf(runRigHello({ prompt: "hello" }));

    expect(error._tag).toBe("AgentRuntimeError");
    expect(error.stage).toBe("complete");
    expect(error.recoverable).toBe(false);
  });

  it("rejects a response that omits usage entirely", async () => {
    const { usage: _omitted, ...withoutUsage } = helloResponse;
    invokeMock.mockResolvedValue(withoutUsage);

    const error = await failureOf(runRigHello({ prompt: "hello" }));

    expect(error._tag).toBe("AgentRuntimeError");
    expect(error.stage).toBe("complete");
  });
});
