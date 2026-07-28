import { invoke } from "@tauri-apps/api/core";
import { Data, Effect, Option, pipe, Schema } from "effect";
import {
  type RigC4BoardEdge,
  type RigC4BoardNode,
  type RigC4BoardNodeType,
  RigC4BoardNodeTypeSchema,
  type RigC4BoardSummary,
  RigReadBoardSummaryResultSchema,
  RigReadEdgeLookupResultSchema,
  RigReadNodeLookupResultSchema,
  type RigReadToolInputByName,
  type RigReadToolName,
  RigReadToolNameSchema,
  type RigReadToolResultByName,
} from "./agent-tools/contracts";

export type AgentRunStage = "invoke" | "persist" | "complete";

interface AgentErrorShape {
  readonly message: string;
  readonly runId: string | null;
  readonly stage: AgentRunStage;
  readonly recoverable: boolean;
  readonly recommendedAction: string;
  readonly cause?: unknown;
}

export class AgentConfigError extends Data.TaggedError("AgentConfigError")<AgentErrorShape> {}
export class AgentRuntimeError extends Data.TaggedError("AgentRuntimeError")<AgentErrorShape> {}
export class AgentPolicyError extends Data.TaggedError("AgentPolicyError")<AgentErrorShape> {}

export type AgentError = AgentConfigError | AgentRuntimeError | AgentPolicyError;

/**
 * Provider token usage, normalized by `rig_runtime.rs` (Rig 0.40).
 *
 * Required rather than optional: a provider that reports nothing emits zeros, so
 * an absent envelope means the response contract drifted, not that the run was
 * free. Extractor usage covers the final successful attempt only — Rig discards
 * usage from failed parse attempts, so a retried extraction under-reports spend.
 */
const RigUsageMetadataSchema = Schema.Struct({
  inputTokens: Schema.Number,
  outputTokens: Schema.Number,
  totalTokens: Schema.Number,
  cachedInputTokens: Schema.Number,
  cacheCreationInputTokens: Schema.Number,
  toolUsePromptTokens: Schema.Number,
  reasoningTokens: Schema.Number,
});

export type RigUsageMetadata = Schema.Schema.Type<typeof RigUsageMetadataSchema>;

const RigUsageCarrierSchema = Schema.Struct({
  usage: RigUsageMetadataSchema,
});

/**
 * Reads the usage envelope off a command result that may or may not carry one.
 *
 * The OPY lifecycle runner is generic over its result: a chat, proposal, or
 * review answer carries usage, while a read-tool or rollback result does not.
 * `None` means this result never reported usage — not that the run was free.
 * A partially-shaped envelope is `None` as well; half a measurement cannot be
 * summed into a budget.
 */
export const readRigUsage = (value: unknown): Option.Option<RigUsageMetadata> =>
  pipe(
    Schema.decodeUnknownOption(RigUsageCarrierSchema)(value),
    Option.map((carrier) => carrier.usage),
  );

const RigHelloResponseSchema = Schema.Struct({
  message: Schema.String,
  provider: Schema.String,
  model: Schema.String,
  prompt: Schema.String,
  temperature: Schema.Number,
  maxTokens: Schema.Number,
  respondedAtMs: Schema.Number,
  usage: RigUsageMetadataSchema,
});

export type RigHelloResponse = Schema.Schema.Type<typeof RigHelloResponseSchema>;

export const RigC4ProposalNodeTypeSchema = RigC4BoardNodeTypeSchema;
export type RigC4ProposalNodeType = RigC4BoardNodeType;

const RigC4ProposalNodeSchema = Schema.Struct({
  key: Schema.String,
  nodeType: RigC4ProposalNodeTypeSchema,
  label: Schema.String,
  description: Schema.NullOr(Schema.String),
});

const RigC4ProposalEdgeSchema = Schema.Struct({
  sourceKey: Schema.String,
  targetKey: Schema.String,
  label: Schema.String,
});

const RigC4DiagramProposalSchema = Schema.Struct({
  summary: Schema.String,
  rationale: Schema.String,
  warnings: Schema.Array(Schema.String),
  nodes: Schema.Array(RigC4ProposalNodeSchema),
  edges: Schema.Array(RigC4ProposalEdgeSchema),
  provider: Schema.String,
  model: Schema.String,
  respondedAtMs: Schema.Number,
  usage: RigUsageMetadataSchema,
});

export type RigC4ProposalNode = Schema.Schema.Type<typeof RigC4ProposalNodeSchema>;
export type RigC4ProposalEdge = Schema.Schema.Type<typeof RigC4ProposalEdgeSchema>;
export type RigC4DiagramProposal = Schema.Schema.Type<typeof RigC4DiagramProposalSchema>;

/**
 * A proposal's content, without the provider usage envelope.
 *
 * Consumers that reason about nodes, edges, and rationale take this rather than
 * the full response, so a live proposal and one rehydrated from a row written
 * before usage capture both fit. Requiring the envelope in a diff signature
 * would be asking for a measurement the function does not read.
 */
export type RigC4DiagramProposalContent = Omit<RigC4DiagramProposal, "usage">;
export type { RigC4BoardEdge, RigC4BoardNode, RigC4BoardNodeType, RigC4BoardSummary };
export type { RigReadToolInputByName, RigReadToolName, RigReadToolResultByName };

const RigC4ReviewPrioritySchema = Schema.Literal("low", "medium", "high");
export type RigC4ReviewPriority = Schema.Schema.Type<typeof RigC4ReviewPrioritySchema>;

const RigC4ReviewNoteSchema = Schema.Struct({
  title: Schema.String,
  detail: Schema.String,
});

const RigC4ReviewRiskSchema = Schema.Struct({
  title: Schema.String,
  detail: Schema.String,
  severity: RigC4ReviewPrioritySchema,
});

const RigC4RecommendedChangeSchema = Schema.Struct({
  title: Schema.String,
  rationale: Schema.String,
  priority: RigC4ReviewPrioritySchema,
});

const RigC4BoardReviewSchema = Schema.Struct({
  summary: Schema.String,
  strengths: Schema.Array(RigC4ReviewNoteSchema),
  risks: Schema.Array(RigC4ReviewRiskSchema),
  ambiguities: Schema.Array(RigC4ReviewNoteSchema),
  missingNodes: Schema.Array(Schema.String),
  missingEdges: Schema.Array(Schema.String),
  recommendedChanges: Schema.Array(RigC4RecommendedChangeSchema),
  provider: Schema.String,
  model: Schema.String,
  respondedAtMs: Schema.Number,
  usage: RigUsageMetadataSchema,
});

export type RigC4ReviewNote = Schema.Schema.Type<typeof RigC4ReviewNoteSchema>;
export type RigC4ReviewRisk = Schema.Schema.Type<typeof RigC4ReviewRiskSchema>;
export type RigC4RecommendedChange = Schema.Schema.Type<typeof RigC4RecommendedChangeSchema>;
export type RigC4BoardReview = Schema.Schema.Type<typeof RigC4BoardReviewSchema>;

const RigSecretSourceSchema = Schema.Literal("keychain", "settings-db", "env", "none");
export type RigSecretSource = Schema.Schema.Type<typeof RigSecretSourceSchema>;

const RigSecretStatusResponseSchema = Schema.Struct({
  configured: Schema.Boolean,
  source: RigSecretSourceSchema,
  warning: Schema.NullOr(Schema.String),
  resolutionOrder: Schema.Array(Schema.String),
});
export type RigSecretStatusResponse = Schema.Schema.Type<typeof RigSecretStatusResponseSchema>;

export interface RigHelloInput {
  readonly prompt?: string;
  readonly model?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
}

export interface RigC4DiagramPlanInput {
  readonly description: string;
  readonly diagramContext?: string;
  readonly boardSummary?: RigC4BoardSummary;
  readonly model?: string;
  readonly maxTokens?: number;
}

export interface RigC4BoardReviewInput {
  readonly focus?: string;
  readonly diagramContext?: string;
  readonly boardSummary: RigC4BoardSummary;
  readonly model?: string;
  readonly maxTokens?: number;
}

const RigReadToolResponseSchema = Schema.Struct({
  tool: RigReadToolNameSchema,
  result: Schema.Unknown,
});

type RigReadToolResponse = Schema.Schema.Type<typeof RigReadToolResponseSchema>;

const DEFAULT_CONFIG_RECOMMENDED_ACTION = "Configure the AI agent in Settings and retry.";
const DEFAULT_RUNTIME_RECOMMENDED_ACTION = "Retry the request. If it keeps failing, inspect provider and runtime logs.";
const DEFAULT_POLICY_RECOMMENDED_ACTION = "Adjust the current mode or request scope and retry.";
const OPENAI_KEY_RECOMMENDED_ACTION =
  "Configure an OpenAI key in Settings > AI Agent or set OPSYDYN_OPENAI_API_KEY / OPENAI_API_KEY.";

const toCauseMessage = (cause: unknown): string => {
  if (typeof cause === "string") {
    return cause;
  }
  if (cause instanceof Error) {
    return cause.message;
  }
  if (typeof cause === "object" && cause !== null && "message" in cause) {
    const candidate = cause as { message?: unknown };
    if (typeof candidate.message === "string") {
      return candidate.message;
    }
  }
  return String(cause);
};

const toAgentMessage = (message: string): string => message.trim().replace(/\s+/g, " ");

const isAgentError = (error: unknown): error is AgentError =>
  typeof error === "object"
  && error !== null
  && "_tag" in error
  && (
    (error as { _tag: unknown })._tag === "AgentConfigError"
    || (error as { _tag: unknown })._tag === "AgentRuntimeError"
    || (error as { _tag: unknown })._tag === "AgentPolicyError"
  );

const isConfigFailureMessage = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return normalized.includes("requires an openai key")
    || normalized.includes("openai key cannot be empty")
    || normalized.includes("configure your key")
    || normalized.includes("settings > ai agent");
};

const buildAgentConfigError = (input: {
  readonly message: string;
  readonly runId?: string | null;
  readonly stage?: AgentRunStage;
  readonly recoverable?: boolean;
  readonly recommendedAction?: string;
  readonly cause?: unknown;
}): AgentConfigError =>
  new AgentConfigError({
    message: toAgentMessage(input.message),
    runId: input.runId ?? null,
    stage: input.stage ?? "invoke",
    recoverable: input.recoverable ?? true,
    recommendedAction: input.recommendedAction ?? DEFAULT_CONFIG_RECOMMENDED_ACTION,
    cause: input.cause,
  });

const buildAgentRuntimeError = (input: {
  readonly message: string;
  readonly runId?: string | null;
  readonly stage?: AgentRunStage;
  readonly recoverable?: boolean;
  readonly recommendedAction?: string;
  readonly cause?: unknown;
}): AgentRuntimeError =>
  new AgentRuntimeError({
    message: toAgentMessage(input.message),
    runId: input.runId ?? null,
    stage: input.stage ?? "invoke",
    recoverable: input.recoverable ?? true,
    recommendedAction: input.recommendedAction ?? DEFAULT_RUNTIME_RECOMMENDED_ACTION,
    cause: input.cause,
  });

const buildAgentPolicyError = (input: {
  readonly message: string;
  readonly runId?: string | null;
  readonly stage?: AgentRunStage;
  readonly recoverable?: boolean;
  readonly recommendedAction?: string;
  readonly cause?: unknown;
}): AgentPolicyError =>
  new AgentPolicyError({
    message: toAgentMessage(input.message),
    runId: input.runId ?? null,
    stage: input.stage ?? "invoke",
    recoverable: input.recoverable ?? true,
    recommendedAction: input.recommendedAction ?? DEFAULT_POLICY_RECOMMENDED_ACTION,
    cause: input.cause,
  });

const classifyAgentInvokeFailure = (input: {
  readonly message: string;
  readonly cause?: unknown;
}): AgentError => {
  if (isConfigFailureMessage(input.message)) {
    return buildAgentConfigError({
      message: input.message,
      stage: "invoke",
      recommendedAction: OPENAI_KEY_RECOMMENDED_ACTION,
      cause: input.cause,
    });
  }

  return buildAgentRuntimeError({
    message: input.message,
    stage: "invoke",
    recommendedAction: DEFAULT_RUNTIME_RECOMMENDED_ACTION,
    cause: input.cause,
  });
};

const rebuildAgentError = (
  error: AgentError,
  overrides: Partial<Omit<AgentErrorShape, "message">> = {},
): AgentError => {
  const nextShape = {
    message: error.message,
    runId: overrides.runId ?? error.runId,
    stage: overrides.stage ?? error.stage,
    recoverable: overrides.recoverable ?? error.recoverable,
    recommendedAction: overrides.recommendedAction ?? error.recommendedAction,
    cause: overrides.cause ?? error.cause,
  };

  switch (error._tag) {
    case "AgentConfigError":
      return new AgentConfigError(nextShape);
    case "AgentRuntimeError":
      return new AgentRuntimeError(nextShape);
    case "AgentPolicyError":
      return new AgentPolicyError(nextShape);
  }
};

export const makeAgentConfigError = buildAgentConfigError;
export const makeAgentRuntimeError = buildAgentRuntimeError;
export const makeAgentPolicyError = buildAgentPolicyError;

export const withAgentErrorContext = (
  error: unknown,
  overrides: Partial<Omit<AgentErrorShape, "message">> = {},
): AgentError => {
  if (isAgentError(error)) {
    return rebuildAgentError(error, overrides);
  }

  return rebuildAgentError(
    classifyAgentInvokeFailure({
      message: toCauseMessage(error),
      cause: error,
    }),
    overrides,
  );
};

const AGENT_ERROR_KIND_LABEL: Record<AgentError["_tag"], string> = {
  AgentConfigError: "CONFIG",
  AgentRuntimeError: "RUNTIME",
  AgentPolicyError: "POLICY",
};

export const summarizeAgentError = (error: AgentError): string => {
  const label = AGENT_ERROR_KIND_LABEL[error._tag];
  return `${label}::${error.stage.toUpperCase()}::${error.message} ACTION::${error.recommendedAction}`;
};

export const formatAgentError = (error: AgentError): string => {
  const label = AGENT_ERROR_KIND_LABEL[error._tag];
  const runLabel = error.runId ? `::RUN ${error.runId.slice(0, 8)}` : "";
  const recoverableLabel = error.recoverable ? "RECOVERABLE" : "TERMINAL";
  return `${label}::${error.stage.toUpperCase()}${runLabel}::${recoverableLabel}::${error.message} ACTION::${error.recommendedAction}`;
};

const decodeRigC4DiagramProposal = (payload: unknown): RigC4DiagramProposal => {
  try {
    return Schema.decodeUnknownSync(RigC4DiagramProposalSchema)(payload);
  } catch (cause) {
    throw buildAgentRuntimeError({
      message: "Invalid rig C4 diagram proposal payload",
      stage: "complete",
      recoverable: false,
      recommendedAction: "Check the Rig diagram proposal response contract.",
      cause,
    });
  }
};

const decodeRigC4BoardReview = (payload: unknown): RigC4BoardReview => {
  try {
    return Schema.decodeUnknownSync(RigC4BoardReviewSchema)(payload);
  } catch (cause) {
    throw buildAgentRuntimeError({
      message: "Invalid rig C4 board review payload",
      stage: "complete",
      recoverable: false,
      recommendedAction: "Check the Rig board review response contract.",
      cause,
    });
  }
};

const decodeRigHelloResponse = (payload: unknown): RigHelloResponse => {
  try {
    return Schema.decodeUnknownSync(RigHelloResponseSchema)(payload);
  } catch (cause) {
    throw buildAgentRuntimeError({
      message: "Invalid rig hello response payload",
      stage: "complete",
      recoverable: false,
      recommendedAction: "Check the Rig hello response contract.",
      cause,
    });
  }
};

const decodeRigSecretStatusResponse = (payload: unknown): RigSecretStatusResponse => {
  try {
    return Schema.decodeUnknownSync(RigSecretStatusResponseSchema)(payload);
  } catch (cause) {
    throw buildAgentRuntimeError({
      message: "Invalid rig secret status payload",
      stage: "complete",
      recoverable: false,
      recommendedAction: "Check the Rig secret status response contract.",
      cause,
    });
  }
};

const decodeRigReadToolResponse = (payload: unknown): RigReadToolResponse => {
  try {
    return Schema.decodeUnknownSync(RigReadToolResponseSchema)(payload);
  } catch (cause) {
    throw buildAgentRuntimeError({
      message: "Invalid rig read tool response payload",
      stage: "complete",
      recoverable: false,
      recommendedAction: "Check the Rig read tool response contract.",
      cause,
    });
  }
};

const decodeRigReadToolResult = <TTool extends RigReadToolName>(
  tool: TTool,
  payload: unknown,
): RigReadToolResultByName[TTool] => {
  try {
    switch (tool) {
      case "board_summary":
        return Schema.decodeUnknownSync(RigReadBoardSummaryResultSchema)(payload) as RigReadToolResultByName[TTool];
      case "node_lookup":
        return Schema.decodeUnknownSync(RigReadNodeLookupResultSchema)(payload) as RigReadToolResultByName[TTool];
      case "edge_lookup":
        return Schema.decodeUnknownSync(RigReadEdgeLookupResultSchema)(payload) as RigReadToolResultByName[TTool];
    }
  } catch (cause) {
    throw buildAgentRuntimeError({
      message: `Invalid rig read tool result payload for ${tool}`,
      stage: "complete",
      recoverable: false,
      recommendedAction: "Check the Rig read tool contracts and output schema alignment.",
      cause,
    });
  }
};

export const runRigHello = (
  input: RigHelloInput,
): Effect.Effect<RigHelloResponse, AgentError> =>
  Effect.tryPromise({
    try: async () => {
      const payload = await invoke("rig_agent_hello", { input });
      return decodeRigHelloResponse(payload);
    },
    catch: (cause) => {
      if (isAgentError(cause)) {
        return cause;
      }

      return classifyAgentInvokeFailure({
        message: `Rig hello request failed: ${toCauseMessage(cause)}`,
        cause,
      });
    },
  });

export const planRigC4Diagram = (
  input: RigC4DiagramPlanInput,
): Effect.Effect<RigC4DiagramProposal, AgentError> =>
  Effect.tryPromise({
    try: async () => {
      const payload = await invoke("rig_agent_plan_c4_diagram", { input });
      return decodeRigC4DiagramProposal(payload);
    },
    catch: (cause) => {
      if (isAgentError(cause)) {
        return cause;
      }

      return classifyAgentInvokeFailure({
        message: `Rig C4 diagram proposal request failed: ${toCauseMessage(cause)}`,
        cause,
      });
    },
  });

export const reviewRigC4Board = (
  input: RigC4BoardReviewInput,
): Effect.Effect<RigC4BoardReview, AgentError> =>
  Effect.tryPromise({
    try: async () => {
      const payload = await invoke("rig_agent_review_c4_board", { input });
      return decodeRigC4BoardReview(payload);
    },
    catch: (cause) => {
      if (isAgentError(cause)) {
        return cause;
      }

      return classifyAgentInvokeFailure({
        message: `Rig C4 board review request failed: ${toCauseMessage(cause)}`,
        cause,
      });
    },
  });

export const runRigReadTool = <TTool extends RigReadToolName>(
  tool: TTool,
  input: RigReadToolInputByName[TTool],
  boardSummary: RigC4BoardSummary,
): Effect.Effect<RigReadToolResultByName[TTool], AgentError> =>
  Effect.tryPromise({
    try: async () => {
      const payload = await invoke("rig_agent_run_read_tool", {
        input: {
          tool,
          input,
          boardSummary,
        },
      });
      const response = decodeRigReadToolResponse(payload);
      if (response.tool !== tool) {
        throw buildAgentRuntimeError({
          message: `Rig read tool response mismatch: expected ${tool} but received ${response.tool}`,
          stage: "complete",
          recoverable: false,
          recommendedAction: "Check the Rig read tool dispatcher response envelope.",
        });
      }
      return decodeRigReadToolResult(tool, response.result);
    },
    catch: (cause) => {
      if (isAgentError(cause)) {
        return cause;
      }

      return buildAgentRuntimeError({
        message: `Rig read tool request failed for ${tool}: ${toCauseMessage(cause)}`,
        stage: "invoke",
        recommendedAction:
          "Retry the read tool request. If it keeps failing, inspect the board snapshot and tool contract.",
        cause,
      });
    },
  });

export const getRigSecretStatus = (): Effect.Effect<RigSecretStatusResponse, AgentError> =>
  Effect.tryPromise({
    try: async () => {
      const payload = await invoke("rig_agent_secret_status");
      return decodeRigSecretStatusResponse(payload);
    },
    catch: (cause) => {
      if (isAgentError(cause)) {
        return cause;
      }

      return buildAgentRuntimeError({
        message: `Rig secret status request failed: ${toCauseMessage(cause)}`,
        stage: "invoke",
        recommendedAction: "Retry the secret status check. If it keeps failing, inspect keychain/runtime access.",
        cause,
      });
    },
  });

export const storeRigOpenAiApiKey = (
  secret: string,
): Effect.Effect<RigSecretStatusResponse, AgentError> =>
  Effect.tryPromise({
    try: async () => {
      const payload = await invoke("rig_agent_store_openai_api_key", { secret });
      return decodeRigSecretStatusResponse(payload);
    },
    catch: (cause) => {
      if (isAgentError(cause)) {
        return cause;
      }

      return classifyAgentInvokeFailure({
        message: `Rig secret store request failed: ${toCauseMessage(cause)}`,
        cause,
      });
    },
  });

export const clearRigOpenAiApiKey = (): Effect.Effect<
  RigSecretStatusResponse,
  AgentError
> =>
  Effect.tryPromise({
    try: async () => {
      const payload = await invoke("rig_agent_clear_openai_api_key");
      return decodeRigSecretStatusResponse(payload);
    },
    catch: (cause) => {
      if (isAgentError(cause)) {
        return cause;
      }

      return buildAgentRuntimeError({
        message: `Rig secret clear request failed: ${toCauseMessage(cause)}`,
        stage: "invoke",
        recommendedAction: "Retry the secret clear request. If it keeps failing, inspect keychain/runtime access.",
        cause,
      });
    },
  });
