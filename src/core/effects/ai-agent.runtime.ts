import { invoke } from "@tauri-apps/api/core";
import { Data, Effect, Schema } from "effect";

export class AiAgentRuntimeError extends Data.TaggedError("AiAgentRuntimeError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

const RigHelloResponseSchema = Schema.Struct({
  message: Schema.String,
  provider: Schema.String,
  model: Schema.String,
  prompt: Schema.String,
  temperature: Schema.Number,
  maxTokens: Schema.Number,
  respondedAtMs: Schema.Number,
});

export type RigHelloResponse = Schema.Schema.Type<typeof RigHelloResponseSchema>;

const RigC4ProposalNodeTypeSchema = Schema.Literal(
  "person",
  "system",
  "externalSystem",
  "container",
  "component",
);
export type RigC4ProposalNodeType = Schema.Schema.Type<typeof RigC4ProposalNodeTypeSchema>;
export type RigC4BoardNodeType = RigC4ProposalNodeType;

const RigC4BoardNodeSchema = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  nodeType: RigC4ProposalNodeTypeSchema,
  description: Schema.NullOr(Schema.String),
  technology: Schema.NullOr(Schema.String),
  teamOwnership: Schema.NullOr(Schema.String),
});

const RigC4BoardEdgeSchema = Schema.Struct({
  id: Schema.String,
  sourceId: Schema.String,
  targetId: Schema.String,
  sourceLabel: Schema.String,
  targetLabel: Schema.String,
  label: Schema.NullOr(Schema.String),
});

const RigC4BoardSummarySchema = Schema.Struct({
  diagramId: Schema.NullOr(Schema.String),
  diagramName: Schema.NullOr(Schema.String),
  nodeCount: Schema.Number,
  edgeCount: Schema.Number,
  nodes: Schema.Array(RigC4BoardNodeSchema),
  edges: Schema.Array(RigC4BoardEdgeSchema),
});

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
});

export type RigC4ProposalNode = Schema.Schema.Type<typeof RigC4ProposalNodeSchema>;
export type RigC4ProposalEdge = Schema.Schema.Type<typeof RigC4ProposalEdgeSchema>;
export type RigC4DiagramProposal = Schema.Schema.Type<typeof RigC4DiagramProposalSchema>;
export type RigC4BoardNode = Schema.Schema.Type<typeof RigC4BoardNodeSchema>;
export type RigC4BoardEdge = Schema.Schema.Type<typeof RigC4BoardEdgeSchema>;
export type RigC4BoardSummary = Schema.Schema.Type<typeof RigC4BoardSummarySchema>;

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

const decodeRigC4DiagramProposal = (payload: unknown): RigC4DiagramProposal => {
  try {
    return Schema.decodeUnknownSync(RigC4DiagramProposalSchema)(payload);
  } catch (cause) {
    throw new AiAgentRuntimeError({
      message: "Invalid rig C4 diagram proposal payload",
      cause,
    });
  }
};

const decodeRigHelloResponse = (payload: unknown): RigHelloResponse => {
  try {
    return Schema.decodeUnknownSync(RigHelloResponseSchema)(payload);
  } catch (cause) {
    throw new AiAgentRuntimeError({
      message: "Invalid rig hello response payload",
      cause,
    });
  }
};

const decodeRigSecretStatusResponse = (payload: unknown): RigSecretStatusResponse => {
  try {
    return Schema.decodeUnknownSync(RigSecretStatusResponseSchema)(payload);
  } catch (cause) {
    throw new AiAgentRuntimeError({
      message: "Invalid rig secret status payload",
      cause,
    });
  }
};

export const runRigHello = (
  input: RigHelloInput,
): Effect.Effect<RigHelloResponse, AiAgentRuntimeError> =>
  Effect.tryPromise({
    try: async () => {
      const payload = await invoke("rig_agent_hello", { input });
      return decodeRigHelloResponse(payload);
    },
    catch: (cause) =>
      new AiAgentRuntimeError({
        message: `Rig hello request failed: ${toCauseMessage(cause)}`,
        cause,
      }),
  });

export const planRigC4Diagram = (
  input: RigC4DiagramPlanInput,
): Effect.Effect<RigC4DiagramProposal, AiAgentRuntimeError> =>
  Effect.tryPromise({
    try: async () => {
      const payload = await invoke("rig_agent_plan_c4_diagram", { input });
      return decodeRigC4DiagramProposal(payload);
    },
    catch: (cause) =>
      new AiAgentRuntimeError({
        message: `Rig C4 diagram proposal request failed: ${toCauseMessage(cause)}`,
        cause,
      }),
  });

export const getRigSecretStatus = (): Effect.Effect<RigSecretStatusResponse, AiAgentRuntimeError> =>
  Effect.tryPromise({
    try: async () => {
      const payload = await invoke("rig_agent_secret_status");
      return decodeRigSecretStatusResponse(payload);
    },
    catch: (cause) =>
      new AiAgentRuntimeError({
        message: `Rig secret status request failed: ${toCauseMessage(cause)}`,
        cause,
      }),
  });
