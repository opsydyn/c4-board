export type OpyAgentToolCallName =
  | "assemble_context"
  | "invoke_agent"
  | "invoke_analyst"
  | "invoke_planner"
  | "invoke_verifier"
  | "persist_assistant_message"
  | "resolve_action"
  | "execute_board_action"
  | "refresh_checkpoints";

export type OpyAgentToolCallStatus =
  | "running"
  | "interrupted"
  | "completed"
  | "failed"
  | "cancelled";

export interface OpyAgentToolCall {
  readonly id: string;
  readonly taskId: string;
  readonly sessionId: string;
  readonly name: OpyAgentToolCallName;
  readonly status: OpyAgentToolCallStatus;
  readonly startedAt: number;
  readonly updatedAt: number;
  readonly completedAt: number | null;
  readonly inputSummary: string | null;
  readonly outputSummary: string | null;
  readonly errorSummary: string | null;
}

export type OpyAgentArtifactKind =
  | "context_bundle"
  | "anomaly_assessment"
  | "chat_response"
  | "diagram_proposal"
  | "board_review"
  | "action_descriptor"
  | "action_result"
  | "resume_boundary_outcome"
  | "mutation_plan"
  | "stage_transition"
  | "checkpoint_restore_preview";

export interface OpyAgentArtifact {
  readonly id: string;
  readonly taskId: string;
  readonly sessionId: string;
  readonly toolCallId: string | null;
  readonly kind: OpyAgentArtifactKind;
  readonly summary: string;
  readonly payload: unknown;
  readonly createdAt: number;
}
