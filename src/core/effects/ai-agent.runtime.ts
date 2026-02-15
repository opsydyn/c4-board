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
  respondedAtMs: Schema.Number,
});

export type RigHelloResponse = Schema.Schema.Type<typeof RigHelloResponseSchema>;

export interface RigHelloInput {
  readonly prompt?: string;
  readonly model?: string;
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
