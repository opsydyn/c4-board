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
