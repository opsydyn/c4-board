import { Schema } from "effect";
import {
  pickHigherRigToolRisk,
  type RigToolPolicyMetadata,
  RigToolPolicyMetadataSchema,
  type RigToolRisk,
} from "../agent-policy";
import { ALL_LAYOUT_PRESETS, type LayoutPresetName } from "../layout";
import { RigC4BoardNodeTypeSchema } from "./contracts";

export const RigMutationToolNameSchema = Schema.Literal(
  "create_nodes",
  "update_nodes",
  "create_edges",
  "apply_layout",
);
export type RigMutationToolName = Schema.Schema.Type<typeof RigMutationToolNameSchema>;

export const RigMutationNodeRefKindSchema = Schema.Literal("board-node", "plan-node");
export type RigMutationNodeRefKind = Schema.Schema.Type<typeof RigMutationNodeRefKindSchema>;

export const RigMutationNodeRefSchema = Schema.Struct({
  kind: RigMutationNodeRefKindSchema,
  value: Schema.String,
});
export type RigMutationNodeRef = Schema.Schema.Type<typeof RigMutationNodeRefSchema>;

export const RigMutationCreateNodeSchema = Schema.Struct({
  key: Schema.String,
  nodeType: RigC4BoardNodeTypeSchema,
  label: Schema.String,
  description: Schema.NullOr(Schema.String),
  technology: Schema.NullOr(Schema.String),
  teamOwnership: Schema.NullOr(Schema.String),
});
export type RigMutationCreateNode = Schema.Schema.Type<typeof RigMutationCreateNodeSchema>;

export const RigCreateNodesInputSchema = Schema.Struct({
  nodes: Schema.Array(RigMutationCreateNodeSchema),
});
export type RigCreateNodesInput = Schema.Schema.Type<typeof RigCreateNodesInputSchema>;

export const RigMutationUpdateNodeSchema = Schema.Struct({
  nodeId: Schema.String,
  label: Schema.optional(Schema.NullOr(Schema.String)),
  description: Schema.optional(Schema.NullOr(Schema.String)),
  technology: Schema.optional(Schema.NullOr(Schema.String)),
  teamOwnership: Schema.optional(Schema.NullOr(Schema.String)),
});
export type RigMutationUpdateNode = Schema.Schema.Type<typeof RigMutationUpdateNodeSchema>;

export const RigUpdateNodesInputSchema = Schema.Struct({
  nodes: Schema.Array(RigMutationUpdateNodeSchema),
});
export type RigUpdateNodesInput = Schema.Schema.Type<typeof RigUpdateNodesInputSchema>;

export const RigMutationCreateEdgeSchema = Schema.Struct({
  sourceRef: RigMutationNodeRefSchema,
  targetRef: RigMutationNodeRefSchema,
  label: Schema.NullOr(Schema.String),
});
export type RigMutationCreateEdge = Schema.Schema.Type<typeof RigMutationCreateEdgeSchema>;

export const RigCreateEdgesInputSchema = Schema.Struct({
  edges: Schema.Array(RigMutationCreateEdgeSchema),
});
export type RigCreateEdgesInput = Schema.Schema.Type<typeof RigCreateEdgesInputSchema>;

export const RigApplyLayoutTargetSchema = Schema.Literal("all", "selection");
export type RigApplyLayoutTarget = Schema.Schema.Type<typeof RigApplyLayoutTargetSchema>;

export const RigApplyLayoutInputSchema = Schema.Struct({
  preset: Schema.String,
  target: Schema.optionalWith(RigApplyLayoutTargetSchema, {
    default: () => "all" as const,
  }),
  nodeIds: Schema.optionalWith(Schema.Array(Schema.String), {
    default: () => [],
  }),
});
export type RigApplyLayoutInput = Schema.Schema.Type<typeof RigApplyLayoutInputSchema>;

export interface RigMutationToolInputByName {
  readonly create_nodes: RigCreateNodesInput;
  readonly update_nodes: RigUpdateNodesInput;
  readonly create_edges: RigCreateEdgesInput;
  readonly apply_layout: RigApplyLayoutInput;
}

export const RigCreateNodesValidationSummarySchema = Schema.Struct({
  nodeCount: Schema.Number,
  nodeKeys: Schema.Array(Schema.String),
  labels: Schema.Array(Schema.String),
});
export type RigCreateNodesValidationSummary = Schema.Schema.Type<typeof RigCreateNodesValidationSummarySchema>;

export const RigUpdateNodesValidationSummarySchema = Schema.Struct({
  nodeCount: Schema.Number,
  nodeIds: Schema.Array(Schema.String),
  fieldCount: Schema.Number,
});
export type RigUpdateNodesValidationSummary = Schema.Schema.Type<typeof RigUpdateNodesValidationSummarySchema>;

export const RigCreateEdgesValidationSummarySchema = Schema.Struct({
  edgeCount: Schema.Number,
  connectionRefs: Schema.Array(Schema.String),
});
export type RigCreateEdgesValidationSummary = Schema.Schema.Type<typeof RigCreateEdgesValidationSummarySchema>;

export const RigApplyLayoutValidationSummarySchema = Schema.Struct({
  preset: Schema.String,
  target: RigApplyLayoutTargetSchema,
  nodeCount: Schema.Number,
});
export type RigApplyLayoutValidationSummary = Schema.Schema.Type<typeof RigApplyLayoutValidationSummarySchema>;

export interface RigMutationToolSummaryByName {
  readonly create_nodes: RigCreateNodesValidationSummary;
  readonly update_nodes: RigUpdateNodesValidationSummary;
  readonly create_edges: RigCreateEdgesValidationSummary;
  readonly apply_layout: RigApplyLayoutValidationSummary;
}

export class RigMutationToolContractError extends Error {
  readonly tool: RigMutationToolName;

  constructor(tool: RigMutationToolName, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RigMutationToolContractError";
    this.tool = tool;
  }
}

interface RigMutationToolDefinition<
  TTool extends RigMutationToolName,
  TInput extends RigMutationToolInputByName[TTool],
  TSummary extends RigMutationToolSummaryByName[TTool],
> {
  readonly tool: TTool;
  readonly description: string;
  readonly policy: RigToolPolicyMetadata;
  readonly decodeInput: (input: unknown) => TInput;
  readonly summarize: (input: TInput) => TSummary;
}

export interface RigValidatedMutationAction<TTool extends RigMutationToolName = RigMutationToolName> {
  readonly tool: TTool;
  readonly description: string;
  readonly policy: RigToolPolicyMetadata;
  readonly input: RigMutationToolInputByName[TTool];
  readonly summary: RigMutationToolSummaryByName[TTool];
}

export interface RigValidatedMutationPlan {
  readonly actions: ReadonlyArray<RigValidatedMutationAction>;
  readonly totalActions: number;
  readonly highestRisk: RigToolRisk;
  readonly requiresConfirmation: boolean;
  readonly totalNodesCreated: number;
  readonly totalNodesUpdated: number;
  readonly totalEdgesCreated: number;
  readonly totalLayoutOperations: number;
}

const countNodesCreated = (action: RigValidatedMutationAction): number =>
  action.tool === "create_nodes"
    ? (action.input as RigCreateNodesInput).nodes.length
    : 0;

const countNodesUpdated = (action: RigValidatedMutationAction): number =>
  action.tool === "update_nodes"
    ? (action.input as RigUpdateNodesInput).nodes.length
    : 0;

const countEdgesCreated = (action: RigValidatedMutationAction): number =>
  action.tool === "create_edges"
    ? (action.input as RigCreateEdgesInput).edges.length
    : 0;

const countLayoutOperations = (action: RigValidatedMutationAction): number => action.tool === "apply_layout" ? 1 : 0;

const layoutPresetNames = new Set<string>(Object.keys(ALL_LAYOUT_PRESETS));

const normalizeRequiredString = (tool: RigMutationToolName, field: string, value: string): string => {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new RigMutationToolContractError(tool, `${tool} requires a non-empty ${field}.`);
  }
  return normalized;
};

const normalizeOptionalString = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const normalizeNodeRef = (tool: RigMutationToolName, ref: RigMutationNodeRef): RigMutationNodeRef => ({
  kind: ref.kind,
  value: normalizeRequiredString(tool, `${ref.kind} value`, ref.value),
});

const formatNodeRef = (ref: RigMutationNodeRef): string => `${ref.kind}:${ref.value}`;

const createNodesTool: RigMutationToolDefinition<
  "create_nodes",
  RigMutationToolInputByName["create_nodes"],
  RigMutationToolSummaryByName["create_nodes"]
> = {
  tool: "create_nodes",
  description: "Create new C4 nodes as a proposal-only mutation batch.",
  policy: Schema.decodeUnknownSync(RigToolPolicyMetadataSchema)({
    capability: "mutate",
    risk: "medium",
    scope: "c4",
    requiresConfirmation: true,
  }),
  decodeInput: (input) => {
    const decoded = Schema.decodeUnknownSync(RigCreateNodesInputSchema)(input);
    if (decoded.nodes.length === 0) {
      throw new RigMutationToolContractError("create_nodes", "create_nodes requires at least one node.");
    }

    return {
      nodes: decoded.nodes.map((node) => ({
        key: normalizeRequiredString("create_nodes", "node key", node.key),
        nodeType: node.nodeType,
        label: normalizeRequiredString("create_nodes", "node label", node.label),
        description: normalizeOptionalString(node.description),
        technology: normalizeOptionalString(node.technology),
        teamOwnership: normalizeOptionalString(node.teamOwnership),
      })),
    };
  },
  summarize: (input) => ({
    nodeCount: input.nodes.length,
    nodeKeys: input.nodes.map((node) => node.key),
    labels: input.nodes.map((node) => node.label),
  }),
};

const updateNodesTool: RigMutationToolDefinition<
  "update_nodes",
  RigMutationToolInputByName["update_nodes"],
  RigMutationToolSummaryByName["update_nodes"]
> = {
  tool: "update_nodes",
  description: "Update existing C4 node fields without applying them immediately.",
  policy: Schema.decodeUnknownSync(RigToolPolicyMetadataSchema)({
    capability: "mutate",
    risk: "medium",
    scope: "c4",
    requiresConfirmation: true,
  }),
  decodeInput: (input) => {
    const decoded = Schema.decodeUnknownSync(RigUpdateNodesInputSchema)(input);
    if (decoded.nodes.length === 0) {
      throw new RigMutationToolContractError("update_nodes", "update_nodes requires at least one node patch.");
    }

    return {
      nodes: decoded.nodes.map((node) => {
        const normalizedNodeId = normalizeRequiredString("update_nodes", "nodeId", node.nodeId);
        const normalizedPatch = {
          nodeId: normalizedNodeId,
          label: normalizeOptionalString(node.label),
          description: normalizeOptionalString(node.description),
          technology: normalizeOptionalString(node.technology),
          teamOwnership: normalizeOptionalString(node.teamOwnership),
        };
        const hasAnyPatch = [
          normalizedPatch.label,
          normalizedPatch.description,
          normalizedPatch.technology,
          normalizedPatch.teamOwnership,
        ].some((value) => value !== null);

        if (!hasAnyPatch) {
          throw new RigMutationToolContractError(
            "update_nodes",
            `update_nodes requires at least one field update for node ${normalizedNodeId}.`,
          );
        }

        return normalizedPatch;
      }),
    };
  },
  summarize: (input) => ({
    nodeCount: input.nodes.length,
    nodeIds: input.nodes.map((node) => node.nodeId),
    fieldCount: input.nodes.reduce((count, node) =>
      count + [
        node.label,
        node.description,
        node.technology,
        node.teamOwnership,
      ].filter((value) => value !== null).length, 0),
  }),
};

const createEdgesTool: RigMutationToolDefinition<
  "create_edges",
  RigMutationToolInputByName["create_edges"],
  RigMutationToolSummaryByName["create_edges"]
> = {
  tool: "create_edges",
  description: "Create new C4 edges with explicit endpoint references.",
  policy: Schema.decodeUnknownSync(RigToolPolicyMetadataSchema)({
    capability: "mutate",
    risk: "high",
    scope: "c4",
    requiresConfirmation: true,
  }),
  decodeInput: (input) => {
    const decoded = Schema.decodeUnknownSync(RigCreateEdgesInputSchema)(input);
    if (decoded.edges.length === 0) {
      throw new RigMutationToolContractError("create_edges", "create_edges requires at least one edge.");
    }

    return {
      edges: decoded.edges.map((edge) => {
        const sourceRef = normalizeNodeRef("create_edges", edge.sourceRef);
        const targetRef = normalizeNodeRef("create_edges", edge.targetRef);
        if (sourceRef.kind === targetRef.kind && sourceRef.value === targetRef.value) {
          throw new RigMutationToolContractError(
            "create_edges",
            `create_edges cannot connect ${formatNodeRef(sourceRef)} to itself.`,
          );
        }
        return {
          sourceRef,
          targetRef,
          label: normalizeOptionalString(edge.label),
        };
      }),
    };
  },
  summarize: (input) => ({
    edgeCount: input.edges.length,
    connectionRefs: input.edges.map((edge) =>
      `${formatNodeRef(edge.sourceRef)} -> ${formatNodeRef(edge.targetRef)}${edge.label ? ` (${edge.label})` : ""}`
    ),
  }),
};

const applyLayoutTool: RigMutationToolDefinition<
  "apply_layout",
  RigMutationToolInputByName["apply_layout"],
  RigMutationToolSummaryByName["apply_layout"]
> = {
  tool: "apply_layout",
  description: "Apply an existing layout preset as a proposed visual mutation.",
  policy: Schema.decodeUnknownSync(RigToolPolicyMetadataSchema)({
    capability: "mutate",
    risk: "low",
    scope: "c4",
    requiresConfirmation: true,
  }),
  decodeInput: (input) => {
    const decoded = Schema.decodeUnknownSync(RigApplyLayoutInputSchema)(input);
    const preset = normalizeRequiredString("apply_layout", "preset", decoded.preset);
    if (!layoutPresetNames.has(preset)) {
      throw new RigMutationToolContractError(
        "apply_layout",
        `apply_layout preset '${preset}' is not a known layout preset.`,
      );
    }

    const nodeIds = decoded.nodeIds.map((nodeId) => normalizeRequiredString("apply_layout", "nodeId", nodeId));
    if (decoded.target === "selection" && nodeIds.length === 0) {
      throw new RigMutationToolContractError(
        "apply_layout",
        "apply_layout target 'selection' requires at least one nodeId.",
      );
    }

    return {
      preset,
      target: decoded.target,
      nodeIds,
    };
  },
  summarize: (input) => ({
    preset: input.preset as LayoutPresetName,
    target: input.target,
    nodeCount: input.target === "selection" ? input.nodeIds.length : 0,
  }),
};

const rigMutationToolRegistry = {
  create_nodes: createNodesTool,
  update_nodes: updateNodesTool,
  create_edges: createEdgesTool,
  apply_layout: applyLayoutTool,
} satisfies {
  readonly [TTool in RigMutationToolName]: RigMutationToolDefinition<
    TTool,
    RigMutationToolInputByName[TTool],
    RigMutationToolSummaryByName[TTool]
  >;
};

export const getRigMutationToolDefinition = <TTool extends RigMutationToolName>(
  tool: TTool,
): RigMutationToolDefinition<
  TTool,
  RigMutationToolInputByName[TTool],
  RigMutationToolSummaryByName[TTool]
> =>
  rigMutationToolRegistry[tool] as unknown as RigMutationToolDefinition<
    TTool,
    RigMutationToolInputByName[TTool],
    RigMutationToolSummaryByName[TTool]
  >;

export const listRigMutationToolDefinitions = (): ReadonlyArray<{
  readonly tool: RigMutationToolName;
  readonly description: string;
  readonly policy: RigToolPolicyMetadata;
}> =>
  Object.values(rigMutationToolRegistry).map((definition) => ({
    tool: definition.tool,
    description: definition.description,
    policy: definition.policy,
  }));

export const createRigValidatedMutationAction = <TTool extends RigMutationToolName>(
  tool: TTool,
  input: unknown,
): RigValidatedMutationAction<TTool> => {
  const definition = getRigMutationToolDefinition(tool);
  const decodedInput = definition.decodeInput(input);
  return {
    tool,
    description: definition.description,
    policy: definition.policy,
    input: decodedInput,
    summary: definition.summarize(decodedInput),
  };
};

export const validateRigMutationPlan = (
  plan: ReadonlyArray<{
    readonly tool: RigMutationToolName;
    readonly input: unknown;
  }>,
): RigValidatedMutationPlan => {
  const actions = plan.map((item) => createRigValidatedMutationAction(item.tool, item.input));

  return {
    actions,
    totalActions: actions.length,
    highestRisk: actions.reduce<RigToolRisk>(
      (current, action) => pickHigherRigToolRisk(current, action.policy.risk),
      "low",
    ),
    requiresConfirmation: actions.some((action) => action.policy.requiresConfirmation),
    totalNodesCreated: actions.reduce((count, action) => count + countNodesCreated(action), 0),
    totalNodesUpdated: actions.reduce((count, action) => count + countNodesUpdated(action), 0),
    totalEdgesCreated: actions.reduce((count, action) => count + countEdgesCreated(action), 0),
    totalLayoutOperations: actions.reduce((count, action) => count + countLayoutOperations(action), 0),
  };
};
