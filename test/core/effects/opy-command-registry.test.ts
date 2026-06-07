import {
  detectOpyCommandToken,
  formatOpyStructuredCommandDraft,
  getOpyCommandAvailabilityForOption,
  getOpyDraftCommandFeedback,
  getOpySlashCommandSuggestions,
  getOpyStructuredCommandDraft,
  OPY_COMMAND_CONTROL_HINTS,
  parseOpyCommand,
} from "@/core/effects/opy-command-registry";
import { describe, expect, it } from "vitest";

describe("opy-command-registry", () => {
  it("parses diagram aliases into the canonical proposal command", () => {
    expect(parseOpyCommand("/diagram event-driven payments with service bus")).toEqual({
      type: "diagram-proposal",
      proposal: {
        kind: "plan-c4-diagram",
        description: "event-driven payments with service bus",
      },
    });

    expect(parseOpyCommand("/plan event-driven payments with cosmos db")).toEqual({
      type: "diagram-proposal",
      proposal: {
        kind: "plan-c4-diagram",
        description: "event-driven payments with cosmos db",
      },
    });
  });

  it("parses review and add-node commands with normalized payloads", () => {
    expect(parseOpyCommand('/review "payments boundary"')).toEqual({
      type: "board-review",
      review: {
        kind: "review-c4-board",
        focus: "payments boundary",
      },
    });

    expect(parseOpyCommand('/add external-system "Azure Service Bus"')).toEqual({
      type: "action",
      action: {
        kind: "add-node",
        nodeType: "externalSystem",
        label: "Azure Service Bus",
      },
    });
  });

  it("returns stable validation errors for unsupported or incomplete commands", () => {
    expect(parseOpyCommand("/add")).toEqual({
      type: "invalid",
      reason: "MISSING LABEL. USE /add <type> <label>.",
    });

    expect(parseOpyCommand("/add queue broker")).toEqual({
      type: "invalid",
      reason: "UNSUPPORTED TYPE 'queue'. USE person/system/external/container/component.",
    });
  });

  it("detects the canonical active command token across aliases", () => {
    expect(detectOpyCommandToken("/plan event-driven system")).toBe("/diagram");
    expect(detectOpyCommandToken("/review auth")).toBe("/review");
    expect(detectOpyCommandToken("/add component Policy Engine")).toBe("/add");
    expect(detectOpyCommandToken("hello world")).toBeNull();
  });

  it("filters slash suggestions from the typed registry", () => {
    expect(getOpySlashCommandSuggestions("/").map((option) => option.id)).toEqual([
      "diagram",
      "review",
      "add-person",
      "add-system",
      "add-external",
      "add-container",
      "add-component",
    ]);

    expect(getOpySlashCommandSuggestions("/pla").map((option) => option.id)).toEqual(["diagram"]);
    expect(getOpySlashCommandSuggestions("/add ext").map((option) => option.id)).toContain("add-external");
  });

  it("derives action-mode availability for each command option", () => {
    const [diagramOption] = getOpySlashCommandSuggestions("/diagram");
    const externalAddOption = getOpySlashCommandSuggestions("/add ext").find((option) => option.id === "add-external");

    expect(diagramOption).toBeDefined();
    expect(externalAddOption).toBeDefined();

    expect(
      getOpyCommandAvailabilityForOption(diagramOption!, {
        actionMode: "read-only",
        domain: "c4",
      }),
    ).toMatchObject({
      state: "blocked",
      tone: "critical",
      label: "MODE READ-ONLY",
    });

    expect(
      getOpyCommandAvailabilityForOption(externalAddOption!, {
        actionMode: "propose",
        domain: "c4",
      }),
    ).toMatchObject({
      state: "propose-only",
      tone: "caution",
      label: "PROPOSAL ONLY",
    });
  });

  it("produces inline draft feedback for incomplete and blocked commands", () => {
    expect(
      getOpyDraftCommandFeedback("/add component", {
        actionMode: "apply-with-confirmation",
        domain: "c4",
      }),
    ).toEqual({
      tone: "caution",
      label: "INPUT REQUIRED",
      detail: "MISSING LABEL. USE /add <type> <label>.",
    });

    expect(
      getOpyDraftCommandFeedback("/diagram event mesh over cosmos", {
        actionMode: "read-only",
        domain: "c4",
      }),
    ).toEqual({
      tone: "critical",
      label: "MODE READ-ONLY",
      detail: "Switch to PROPOSE or APPLY-WITH-CONFIRMATION to run grounded diagram proposals.",
    });

    expect(
      getOpyDraftCommandFeedback("/review payment failures", {
        actionMode: "disabled",
        domain: "c4",
      }),
    ).toEqual({
      tone: "ready",
      label: "READY TO SUBMIT",
      detail: "Review stays available across all action modes because it does not mutate the board.",
    });
  });

  it("parses structured drafts for active commands", () => {
    expect(getOpyStructuredCommandDraft("/plan event-driven payments")).toEqual({
      kind: "diagram-proposal",
      token: "/diagram",
      prefix: "/plan",
      description: "event-driven payments",
    });

    expect(getOpyStructuredCommandDraft('/add external-system "Azure Service Bus"')).toEqual({
      kind: "action",
      token: "/add",
      typeToken: "external",
      label: "Azure Service Bus",
      typeOptions: [
        { value: "", label: "SELECT TYPE" },
        { value: "person", label: "PERSON" },
        { value: "system", label: "SYSTEM" },
        { value: "external", label: "EXTERNAL" },
        { value: "container", label: "CONTAINER" },
        { value: "component", label: "COMPONENT" },
      ],
    });
  });

  it("preserves unsupported add types in the structured draft rail", () => {
    expect(getOpyStructuredCommandDraft("/add queue broker")).toEqual({
      kind: "action",
      token: "/add",
      typeToken: "queue",
      label: "broker",
      typeOptions: [
        { value: "queue", label: "UNSUPPORTED::QUEUE" },
        { value: "", label: "SELECT TYPE" },
        { value: "person", label: "PERSON" },
        { value: "system", label: "SYSTEM" },
        { value: "external", label: "EXTERNAL" },
        { value: "container", label: "CONTAINER" },
        { value: "component", label: "COMPONENT" },
      ],
    });
  });

  it("formats structured drafts back into raw slash prompts", () => {
    expect(
      formatOpyStructuredCommandDraft({
        kind: "board-review",
        token: "/review",
        focus: "payments boundary",
      }),
    ).toBe("/review payments boundary");

    expect(
      formatOpyStructuredCommandDraft({
        kind: "diagram-proposal",
        token: "/diagram",
        prefix: "/plan",
        description: "event-driven payments",
      }),
    ).toBe("/plan event-driven payments");

    expect(
      formatOpyStructuredCommandDraft({
        kind: "action",
        token: "/add",
        typeToken: "component",
        label: "Policy Engine",
        typeOptions: [],
      }),
    ).toBe("/add component Policy Engine");
  });

  it("derives the operator control hints from the same registry", () => {
    expect(OPY_COMMAND_CONTROL_HINTS).toEqual([
      "/add person|system|external|container|component <label>",
      "/diagram <architecture description>",
      "/review [focus area]",
    ]);
  });
});
