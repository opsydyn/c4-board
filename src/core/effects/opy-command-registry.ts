import type { OpyC4NodeType } from "./opy-action.runtime";
import type { AiActionMode } from "./settings.types";

export interface OpyDiagramProposalCommand {
  readonly kind: "plan-c4-diagram";
  readonly description: string;
}

export interface OpyBoardReviewCommand {
  readonly kind: "review-c4-board";
  readonly focus: string | null;
}

export interface OpyAddNodeCommand {
  readonly kind: "add-node";
  readonly nodeType: OpyC4NodeType;
  readonly label: string;
}

export type OpySlashCommandToken = "/add" | "/diagram" | "/review";

export interface OpySlashCommandOption {
  readonly id: string;
  readonly command: OpySlashCommandToken;
  readonly template: string;
  readonly example: string;
  readonly detail: string;
  readonly keywords: ReadonlyArray<string>;
}

interface OpySlashCommandDefinitionBase extends OpySlashCommandOption {
  readonly aliases: ReadonlyArray<string>;
}

interface OpyDiagramCommandDefinition extends OpySlashCommandDefinitionBase {
  readonly kind: "diagram-proposal";
}

interface OpyBoardReviewCommandDefinition extends OpySlashCommandDefinitionBase {
  readonly kind: "board-review";
}

interface OpyAddNodeCommandDefinition extends OpySlashCommandDefinitionBase {
  readonly kind: "action";
  readonly nodeType: OpyC4NodeType;
  readonly typeToken: string;
  readonly typeAliases: ReadonlyArray<string>;
}

type OpySlashCommandDefinition =
  | OpyDiagramCommandDefinition
  | OpyBoardReviewCommandDefinition
  | OpyAddNodeCommandDefinition;

export type ParseOpyCommandResult =
  | { readonly type: "none" }
  | { readonly type: "invalid"; readonly reason: string }
  | { readonly type: "action"; readonly action: OpyAddNodeCommand }
  | { readonly type: "diagram-proposal"; readonly proposal: OpyDiagramProposalCommand }
  | { readonly type: "board-review"; readonly review: OpyBoardReviewCommand };

export interface OpyCommandAvailabilityContext {
  readonly actionMode: AiActionMode;
  readonly domain: "c4" | "ddd";
}

export interface OpyCommandAvailability {
  readonly state: "ready" | "propose-only" | "blocked";
  readonly tone: "ready" | "caution" | "critical";
  readonly label: string;
  readonly detail: string;
}

export interface OpyDraftCommandFeedback {
  readonly tone: "ready" | "caution" | "critical";
  readonly label: string;
  readonly detail: string;
}

export interface OpyStructuredCommandOption {
  readonly value: string;
  readonly label: string;
}

export interface OpyAddNodeCommandDraft {
  readonly kind: "action";
  readonly token: "/add";
  readonly typeToken: string;
  readonly label: string;
  readonly typeOptions: ReadonlyArray<OpyStructuredCommandOption>;
}

export interface OpyDiagramProposalCommandDraft {
  readonly kind: "diagram-proposal";
  readonly token: "/diagram";
  readonly prefix: "/diagram" | "/plan";
  readonly description: string;
}

export interface OpyBoardReviewCommandDraft {
  readonly kind: "board-review";
  readonly token: "/review";
  readonly focus: string;
}

export type OpyStructuredCommandDraft =
  | OpyAddNodeCommandDraft
  | OpyDiagramProposalCommandDraft
  | OpyBoardReviewCommandDraft;

const OPY_DIAGRAM_COMMAND: OpyDiagramCommandDefinition = {
  id: "diagram",
  kind: "diagram-proposal",
  command: "/diagram",
  aliases: ["/plan"],
  template: "/diagram ",
  example: "/diagram <architecture description>",
  detail: "Generate a grounded C4 proposal from natural language.",
  keywords: ["diagram", "plan", "proposal", "architecture"],
};

const OPY_REVIEW_COMMAND: OpyBoardReviewCommandDefinition = {
  id: "review",
  kind: "board-review",
  command: "/review",
  aliases: [],
  template: "/review ",
  example: "/review [focus area]",
  detail: "Run a read-only architecture review of the active C4 board.",
  keywords: ["review", "diagnostics", "risk", "focus"],
};

const OPY_ADD_NODE_COMMANDS: ReadonlyArray<OpyAddNodeCommandDefinition> = [
  {
    id: "add-person",
    kind: "action",
    command: "/add",
    aliases: [],
    typeToken: "person",
    typeAliases: ["people"],
    nodeType: "person",
    template: "/add person ",
    example: "/add person <label>",
    detail: "Add a person node directly on the current C4 board.",
    keywords: ["add", "person", "actor", "node"],
  },
  {
    id: "add-system",
    kind: "action",
    command: "/add",
    aliases: [],
    typeToken: "system",
    typeAliases: [],
    nodeType: "system",
    template: "/add system ",
    example: "/add system <label>",
    detail: "Add a system node directly on the current C4 board.",
    keywords: ["add", "system", "service", "node"],
  },
  {
    id: "add-external",
    kind: "action",
    command: "/add",
    aliases: [],
    typeToken: "external",
    typeAliases: ["external-system", "externalsystem"],
    nodeType: "externalSystem",
    template: "/add external ",
    example: "/add external <label>",
    detail: "Add an external system node directly on the current C4 board.",
    keywords: ["add", "external", "system", "node"],
  },
  {
    id: "add-container",
    kind: "action",
    command: "/add",
    aliases: [],
    typeToken: "container",
    typeAliases: [],
    nodeType: "container",
    template: "/add container ",
    example: "/add container <label>",
    detail: "Add a container node directly on the current C4 board.",
    keywords: ["add", "container", "runtime", "node"],
  },
  {
    id: "add-component",
    kind: "action",
    command: "/add",
    aliases: [],
    typeToken: "component",
    typeAliases: [],
    nodeType: "component",
    template: "/add component ",
    example: "/add component <label>",
    detail: "Add a component node directly on the current C4 board.",
    keywords: ["add", "component", "module", "node"],
  },
];

const OPY_SLASH_COMMAND_DEFINITIONS: ReadonlyArray<OpySlashCommandDefinition> = [
  OPY_DIAGRAM_COMMAND,
  OPY_REVIEW_COMMAND,
  ...OPY_ADD_NODE_COMMANDS,
];

const OPY_SLASH_COMMAND_DEFINITION_BY_ID: Readonly<Record<string, OpySlashCommandDefinition>> = Object.fromEntries(
  OPY_SLASH_COMMAND_DEFINITIONS.map((command) => [command.id, command]),
);

const OPY_COMMAND_PREFIXES: ReadonlyArray<{
  readonly prefix: string;
  readonly token: OpySlashCommandToken;
}> = [
  { prefix: OPY_DIAGRAM_COMMAND.command, token: OPY_DIAGRAM_COMMAND.command },
  ...OPY_DIAGRAM_COMMAND.aliases.map((alias) => ({ prefix: alias, token: OPY_DIAGRAM_COMMAND.command })),
  { prefix: OPY_REVIEW_COMMAND.command, token: OPY_REVIEW_COMMAND.command },
  { prefix: "/add", token: "/add" },
];

export const OPY_SLASH_COMMAND_OPTIONS: ReadonlyArray<OpySlashCommandOption> = OPY_SLASH_COMMAND_DEFINITIONS;

export const OPY_COMMAND_CONTROL_HINTS: ReadonlyArray<string> = [
  `/add ${OPY_ADD_NODE_COMMANDS.map((command) => command.typeToken).join("|")} <label>`,
  OPY_DIAGRAM_COMMAND.example,
  OPY_REVIEW_COMMAND.example,
];

const OPY_ADD_NODE_TYPE_OPTIONS: ReadonlyArray<OpyStructuredCommandOption> = [
  {
    value: "",
    label: "SELECT TYPE",
  },
  ...OPY_ADD_NODE_COMMANDS.map((command) => ({
    value: command.typeToken,
    label: command.typeToken.toUpperCase(),
  })),
];

const normalizeNodeTypeToken = (value: string): string => value.trim().toLowerCase();

const stripWrappingQuotes = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
};

const matchesCommandPrefix = (value: string, prefix: string): boolean =>
  value === prefix || value.startsWith(`${prefix} `);

const resolveDiagramCommandPrefix = (value: string): "/diagram" | "/plan" =>
  matchesCommandPrefix(value.trim().toLowerCase(), "/plan") ? "/plan" : "/diagram";

const resolveCommandDefinitionByToken = (
  token: OpySlashCommandToken,
  value: string,
): OpySlashCommandDefinition | null => {
  if (token === "/add") {
    const payload = value.trim().slice("/add".length).trim();
    const typeToken = payload.split(/\s+/, 1)[0] ?? "";
    return resolveAddNodeCommandDefinition(typeToken) ?? OPY_ADD_NODE_COMMANDS[0] ?? null;
  }

  if (token === "/review") {
    return OPY_REVIEW_COMMAND;
  }

  return OPY_DIAGRAM_COMMAND;
};

const resolveAddNodeCommandDefinition = (value: string): OpyAddNodeCommandDefinition | null => {
  const normalized = normalizeNodeTypeToken(value);
  return OPY_ADD_NODE_COMMANDS.find((command) =>
    command.typeToken === normalized || command.typeAliases.includes(normalized)
  ) ?? null;
};

export const parseOpyCommand = (value: string): ParseOpyCommandResult => {
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) {
    return { type: "none" };
  }

  const normalized = trimmed.toLowerCase();
  if (matchesCommandPrefix(normalized, OPY_REVIEW_COMMAND.command)) {
    const focus = stripWrappingQuotes(trimmed.slice(OPY_REVIEW_COMMAND.command.length).trim());
    return {
      type: "board-review",
      review: {
        kind: "review-c4-board",
        focus: focus.length > 0 ? focus : null,
      },
    };
  }

  if (
    matchesCommandPrefix(normalized, OPY_DIAGRAM_COMMAND.command)
    || OPY_DIAGRAM_COMMAND.aliases.some((alias) => matchesCommandPrefix(normalized, alias))
  ) {
    const matchedPrefix = matchesCommandPrefix(normalized, OPY_DIAGRAM_COMMAND.command)
      ? OPY_DIAGRAM_COMMAND.command
      : OPY_DIAGRAM_COMMAND.aliases.find((alias) => matchesCommandPrefix(normalized, alias))
        ?? OPY_DIAGRAM_COMMAND.command;
    const payload = trimmed.slice(matchedPrefix.length).trim();

    if (payload.length === 0) {
      return {
        type: "invalid",
        reason: "MISSING DESCRIPTION. USE /diagram <architecture description>.",
      };
    }

    return {
      type: "diagram-proposal",
      proposal: {
        kind: "plan-c4-diagram",
        description: payload,
      },
    };
  }

  if (!matchesCommandPrefix(normalized, "/add")) {
    return {
      type: "invalid",
      reason:
        "UNKNOWN COMMAND. USE /add <person|system|external|container|component> <label>, /diagram <description>, OR /review [focus].",
    };
  }

  const payload = trimmed.slice("/add".length).trim();
  const separator = payload.indexOf(" ");
  if (separator < 1) {
    return {
      type: "invalid",
      reason: "MISSING LABEL. USE /add <type> <label>.",
    };
  }

  const rawType = payload.slice(0, separator);
  const rawLabel = payload.slice(separator + 1);
  const command = resolveAddNodeCommandDefinition(rawType);
  if (!command) {
    return {
      type: "invalid",
      reason: `UNSUPPORTED TYPE '${rawType}'. USE person/system/external/container/component.`,
    };
  }

  const label = stripWrappingQuotes(rawLabel);
  if (label.length === 0) {
    return {
      type: "invalid",
      reason: "LABEL CANNOT BE EMPTY.",
    };
  }

  return {
    type: "action",
    action: {
      kind: "add-node",
      nodeType: command.nodeType,
      label,
    },
  };
};

export const detectOpyCommandToken = (value: string): OpySlashCommandToken | null => {
  const trimmed = value.trimStart().toLowerCase();
  const match = OPY_COMMAND_PREFIXES.find(({ prefix }) => matchesCommandPrefix(trimmed, prefix));
  return match?.token ?? null;
};

export const getOpyStructuredCommandDraft = (value: string): OpyStructuredCommandDraft | null => {
  const trimmed = value.trim();
  const token = detectOpyCommandToken(value);
  if (!token) {
    return null;
  }

  if (token === "/review") {
    const focus = trimmed.slice("/review".length).trim();
    return {
      kind: "board-review",
      token,
      focus,
    };
  }

  if (token === "/diagram") {
    const prefix = resolveDiagramCommandPrefix(trimmed);
    const description = trimmed.slice(prefix.length).trim();
    return {
      kind: "diagram-proposal",
      token,
      prefix,
      description,
    };
  }

  const payload = trimmed.slice("/add".length).trim();
  const separator = payload.indexOf(" ");
  const rawType = separator >= 0 ? payload.slice(0, separator).trim() : payload;
  const rawLabel = separator >= 0 ? payload.slice(separator + 1).trim() : "";
  const command = resolveAddNodeCommandDefinition(rawType);
  const typeOptions = !command && rawType.length > 0
    ? [
      {
        value: rawType,
        label: `UNSUPPORTED::${rawType.toUpperCase()}`,
      },
      ...OPY_ADD_NODE_TYPE_OPTIONS,
    ]
    : OPY_ADD_NODE_TYPE_OPTIONS;

  return {
    kind: "action",
    token,
    typeToken: command?.typeToken ?? rawType,
    label: stripWrappingQuotes(rawLabel),
    typeOptions,
  };
};

export const formatOpyStructuredCommandDraft = (draft: OpyStructuredCommandDraft): string => {
  switch (draft.kind) {
    case "board-review": {
      const focus = draft.focus.trim();
      return focus.length > 0 ? `${draft.token} ${focus}` : draft.token;
    }
    case "diagram-proposal": {
      const description = draft.description.trim();
      return description.length > 0 ? `${draft.prefix} ${description}` : `${draft.prefix} `;
    }
    case "action": {
      const nextType = draft.typeToken.trim();
      const nextLabel = draft.label.trim();
      if (nextType.length === 0) {
        return nextLabel.length > 0 ? `${draft.token} ${nextLabel}` : `${draft.token} `;
      }
      return nextLabel.length > 0 ? `${draft.token} ${nextType} ${nextLabel}` : `${draft.token} ${nextType} `;
    }
  }
};

const resolveCommandAvailability = (
  command: OpySlashCommandDefinition,
  context: OpyCommandAvailabilityContext,
): OpyCommandAvailability => {
  if (context.domain !== "c4") {
    return {
      state: "blocked",
      tone: "critical",
      label: "C4 ONLY",
      detail: "This OPY command currently requires the C4 board surface.",
    };
  }

  if (command.kind === "board-review") {
    return {
      state: "ready",
      tone: "ready",
      label: "READ PATH",
      detail: "Review stays available across all action modes because it does not mutate the board.",
    };
  }

  if (command.kind === "diagram-proposal") {
    if (context.actionMode === "disabled" || context.actionMode === "read-only") {
      return {
        state: "blocked",
        tone: "critical",
        label: `MODE ${context.actionMode.toUpperCase()}`,
        detail: "Switch to PROPOSE or APPLY-WITH-CONFIRMATION to run grounded diagram proposals.",
      };
    }

    return {
      state: "ready",
      tone: "ready",
      label: "PROPOSAL PATH",
      detail: "This command generates a grounded C4 proposal without directly applying mutations.",
    };
  }

  if (context.actionMode === "disabled" || context.actionMode === "read-only") {
    return {
      state: "blocked",
      tone: "critical",
      label: `MODE ${context.actionMode.toUpperCase()}`,
      detail: "Switch to APPLY-WITH-CONFIRMATION to execute direct board actions.",
    };
  }

  if (context.actionMode === "propose") {
    return {
      state: "propose-only",
      tone: "caution",
      label: "PROPOSAL ONLY",
      detail: "Submit will stage this node add as a proposal notice, not execute the board mutation.",
    };
  }

  return {
    state: "ready",
    tone: "ready",
    label: "EXECUTABLE",
    detail: "Submit can open confirmation and then execute this board action.",
  };
};

export const getOpyCommandAvailabilityForOption = (
  option: OpySlashCommandOption,
  context: OpyCommandAvailabilityContext,
): OpyCommandAvailability => {
  const command = OPY_SLASH_COMMAND_DEFINITION_BY_ID[option.id];
  return resolveCommandAvailability(command ?? OPY_DIAGRAM_COMMAND, context);
};

const isInputRequiredReason = (reason: string): boolean =>
  reason.startsWith("MISSING ") || reason === "LABEL CANNOT BE EMPTY.";

export const getOpyDraftCommandFeedback = (
  value: string,
  context: OpyCommandAvailabilityContext,
): OpyDraftCommandFeedback | null => {
  const token = detectOpyCommandToken(value);
  if (!token) {
    return null;
  }

  const parsed = parseOpyCommand(value);
  if (parsed.type === "none") {
    return null;
  }

  if (parsed.type === "invalid") {
    return {
      tone: isInputRequiredReason(parsed.reason) ? "caution" : "critical",
      label: isInputRequiredReason(parsed.reason) ? "INPUT REQUIRED" : "COMMAND ERROR",
      detail: parsed.reason,
    };
  }

  const command = resolveCommandDefinitionByToken(token, value);
  const availability = resolveCommandAvailability(command ?? OPY_DIAGRAM_COMMAND, context);
  return {
    tone: availability.tone,
    label: availability.state === "ready" ? "READY TO SUBMIT" : availability.label,
    detail: availability.detail,
  };
};

const getSlashCommandQuery = (value: string): string | null => {
  const trimmed = value.trimStart().toLowerCase();
  if (!trimmed.startsWith("/")) {
    return null;
  }
  return trimmed.slice(1).trim();
};

const getSlashCommandSearchCandidates = (command: OpySlashCommandDefinition): ReadonlyArray<string> => {
  const baseCandidates = [
    command.command.slice(1),
    command.example.slice(1).toLowerCase(),
    ...command.aliases.map((alias) => alias.slice(1)),
    ...command.keywords,
  ];

  return command.kind === "action"
    ? [...baseCandidates, command.typeToken, ...command.typeAliases]
    : baseCandidates;
};

export const getOpySlashCommandSuggestions = (value: string): ReadonlyArray<OpySlashCommandOption> => {
  const query = getSlashCommandQuery(value);
  if (query === null) {
    return [];
  }

  if (query.length === 0) {
    return OPY_SLASH_COMMAND_OPTIONS;
  }

  return OPY_SLASH_COMMAND_DEFINITIONS.filter((command) =>
    getSlashCommandSearchCandidates(command).some((candidate) =>
      candidate.startsWith(query) || candidate.includes(query)
    )
  );
};
