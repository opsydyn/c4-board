/**
 * The imperative shell for the Postee agent — ADR-012.
 *
 * Everything crossing into Rust has already been through the redaction boundary;
 * this only carries it. Context assembly and redaction stay in the functional core
 * so there is one place where the rules live.
 */

import { invoke } from "@tauri-apps/api/core";
import type { PosteeRequestProposal } from "./agent-proposal";
import type { PosteeAgentContext } from "./agent-redaction";

export interface ProposePosteeRequestInput {
  readonly description: string;
  readonly context: PosteeAgentContext;
  readonly model?: string;
  readonly maxTokens?: number;
}

/** The command flattens the proposal alongside its provenance and token usage. */
export interface ProposePosteeRequestPayload extends PosteeRequestProposal {
  readonly provider: string;
  readonly model: string;
  readonly usage: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly totalTokens: number;
  };
}

export const proposePosteeRequest = async (
  input: ProposePosteeRequestInput,
): Promise<ProposePosteeRequestPayload> => {
  const payload = await invoke<ProposePosteeRequestPayload>("rig_agent_propose_postee_request", {
    input,
  });
  return payload;
};
