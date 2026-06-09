import type { OpyAgentLifecycleRequest } from "@/core/effects/opy-agent.lifecycle";
import {
  createOpyStageTransitionPayload,
  deriveOpyStageTransitionMilestone,
  formatOpyStageTransitionSummary,
} from "@/core/effects/opy-agent.stage-transitions";
import { describe, expect, it } from "vitest";

const createRequest = (
  overrides?: Partial<OpyAgentLifecycleRequest>,
): OpyAgentLifecycleRequest => ({
  confirmation: null,
  id: "request-1",
  mode: "action",
  kind: "apply-proposal",
  label: "APPLY PROPOSAL",
  requiresConfirmation: true,
  replay: {
    kind: "apply-proposal",
    proposalRespondedAtMs: 2_000,
    sessionId: "session-1",
  },
  ...overrides,
});

describe("opy-agent.stage-transitions", () => {
  it("maps lifecycle stages to deterministic roadmap milestones", () => {
    expect(deriveOpyStageTransitionMilestone({
      requestKind: "proposal",
      toStage: "contextualizing",
      status: "running",
    })).toBe("planned");
    expect(deriveOpyStageTransitionMilestone({
      requestKind: "proposal",
      toStage: "awaiting_confirmation",
      status: "running",
    })).toBe("proposed");
    expect(deriveOpyStageTransitionMilestone({
      requestKind: "apply-proposal",
      toStage: "applying",
      status: "running",
    })).toBe("confirmed");
    expect(deriveOpyStageTransitionMilestone({
      requestKind: "apply-proposal",
      toStage: "verifying",
      status: "running",
    })).toBe("applied");
    expect(deriveOpyStageTransitionMilestone({
      requestKind: "apply-proposal",
      toStage: "completed",
      status: "completed",
    })).toBe("verified");
    expect(deriveOpyStageTransitionMilestone({
      requestKind: "rollback",
      toStage: "completed",
      status: "completed",
    })).toBe("rolled_back");
  });

  it("captures stable transition keys, attempt numbers, and audit summary text", () => {
    const payload = createOpyStageTransitionPayload({
      request: createRequest(),
      fromStage: "awaiting_confirmation",
      toStage: "applying",
      status: "running",
      failureStage: null,
      failurePhase: null,
      errorSummary: null,
      attempt: 2,
      occurredAt: 2_500,
    });

    expect(payload).toMatchObject({
      version: 1,
      requestId: "request-1",
      requestKind: "apply-proposal",
      milestone: "confirmed",
      attempt: 2,
      occurredAt: 2_500,
      transitionKey: "request-1:attempt-2:awaiting_confirmation->applying:running:none:none:confirmed",
    });
    expect(formatOpyStageTransitionSummary(payload)).toBe(
      "FLOW :: APPLY PROPOSAL :: CONFIRMED :: AWAITING_CONFIRMATION->APPLYING",
    );
  });

  it("preserves failure phase evidence on failed transitions", () => {
    const payload = createOpyStageTransitionPayload({
      request: createRequest({ kind: "proposal", label: "DIAGRAM PROPOSAL", requiresConfirmation: false }),
      fromStage: "proposing",
      toStage: "failed",
      status: "failed",
      failureStage: "proposing",
      failurePhase: "invoke",
      errorSummary: "Provider rejected edge source.",
      attempt: 0,
      occurredAt: 3_000,
    });

    expect(payload.milestone).toBe("failed");
    expect(payload.attempt).toBe(1);
    expect(payload.failureStage).toBe("proposing");
    expect(payload.failurePhase).toBe("invoke");
    expect(payload.errorSummary).toBe("Provider rejected edge source.");
  });
});
