export type OpyAgentLifecycleStage =
  | "idle"
  | "planning"
  | "contextualizing"
  | "proposing"
  | "awaiting_confirmation"
  | "applying"
  | "verifying"
  | "completed"
  | "failed";

export type OpyAgentLifecycleNonTerminalStage = Exclude<OpyAgentLifecycleStage, "idle" | "completed" | "failed">;

export type OpyAgentLifecycleMode = "read" | "action";
export type OpyAgentLifecycleStatus = "completed" | "cancelled" | "failed" | null;
export type OpyAgentLifecycleFailurePhase = "invoke" | "apply" | "verify" | "persist";

export interface OpyAgentLifecycleConfirmation {
  readonly cancelMessage: string;
  readonly confirmationLines: ReadonlyArray<string>;
  readonly failurePrefix: string;
  readonly sessionId: string;
}

export type OpyAgentLifecycleReplay =
  | {
    readonly kind: "chat";
    readonly prompt: string;
    readonly sessionId: string;
  }
  | {
    readonly description: string;
    readonly kind: "proposal";
    readonly sessionId: string;
  }
  | {
    readonly focus: string | null;
    readonly kind: "review";
    readonly sessionId: string;
  }
  | {
    readonly kind: "add-node";
    readonly label: string;
    readonly nodeType: "person" | "system" | "externalSystem" | "container" | "component";
    readonly sessionId: string;
  }
  | {
    readonly kind: "apply-proposal";
    readonly proposalRespondedAtMs: number;
    readonly sessionId: string;
  }
  | {
    readonly checkpointId: string;
    readonly kind: "rollback";
    readonly sessionId: string;
  };

export interface OpyAgentLifecycleRequest {
  readonly confirmation: OpyAgentLifecycleConfirmation | null;
  readonly id: string;
  readonly mode: OpyAgentLifecycleMode;
  readonly kind: "chat" | "review" | "proposal" | "add-node" | "apply-proposal" | "rollback";
  readonly label: string;
  readonly requiresConfirmation: boolean;
  readonly replay: OpyAgentLifecycleReplay;
}
