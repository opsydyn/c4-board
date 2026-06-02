import { Schema } from "effect";
import {
  RigC4BoardSummarySchema,
  RigReadBoardSummaryInputSchema,
  RigReadBoardSummaryResultSchema,
  RigReadEdgeLookupInputSchema,
  RigReadEdgeLookupResultSchema,
  RigReadNodeLookupInputSchema,
  RigReadNodeLookupResultSchema,
  type RigC4BoardEdge,
  type RigC4BoardNode,
  type RigC4BoardSummary,
  type RigReadToolInputByName,
  type RigReadToolName,
  type RigReadToolResultByName,
} from "./contracts";

export class RigReadToolContractError extends Error {
  readonly tool: RigReadToolName;

  constructor(tool: RigReadToolName, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RigReadToolContractError";
    this.tool = tool;
  }
}

interface RigReadToolContext {
  readonly boardSummary: RigC4BoardSummary;
}

interface RigReadToolDefinition<
  TTool extends RigReadToolName,
  TInput extends RigReadToolInputByName[TTool],
  TResult extends RigReadToolResultByName[TTool],
> {
  readonly tool: TTool;
  readonly description: string;
  readonly execute: (input: TInput, context: RigReadToolContext) => TResult;
  readonly decodeInput: (input: unknown) => TInput;
  readonly decodeOutput: (output: unknown) => TResult;
}

const decodeBoardSummary = (payload: unknown): RigC4BoardSummary =>
  Schema.decodeUnknownSync(RigC4BoardSummarySchema)(payload);

const normalizeLookupId = (tool: RigReadToolName, field: string, value: string): string => {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new RigReadToolContractError(tool, `${tool} requires a non-empty ${field}.`);
  }
  return normalized;
};

const sortEdgesById = (edges: ReadonlyArray<RigC4BoardEdge>): ReadonlyArray<RigC4BoardEdge> =>
  [...edges].sort((left, right) => left.id.localeCompare(right.id));

const sortNodesByLabel = (nodes: ReadonlyArray<RigC4BoardNode>): ReadonlyArray<RigC4BoardNode> =>
  [...nodes].sort((left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id));

const getOwnershipTeams = (boardSummary: RigC4BoardSummary): ReadonlyArray<string> =>
  [...new Set(
    boardSummary.nodes
      .map((node) => node.teamOwnership?.trim())
      .filter((value): value is string => Boolean(value)),
  )].sort((left, right) => left.localeCompare(right));

const buildNodeIndex = (boardSummary: RigC4BoardSummary): ReadonlyMap<string, RigC4BoardNode> =>
  new Map(boardSummary.nodes.map((node) => [node.id, node] as const));

const findConnectedEdges = (
  boardSummary: RigC4BoardSummary,
  nodeId: string,
): ReadonlyArray<RigC4BoardEdge> =>
  sortEdgesById(
    boardSummary.edges.filter((edge) => edge.sourceId === nodeId || edge.targetId === nodeId),
  );

const boardSummaryTool: RigReadToolDefinition<"board_summary", RigReadToolInputByName["board_summary"], RigReadToolResultByName["board_summary"]> = {
  tool: "board_summary",
  description: "Return the current board snapshot with stable ownership metadata.",
  decodeInput: (input) => Schema.decodeUnknownSync(RigReadBoardSummaryInputSchema)(input),
  decodeOutput: (output) => Schema.decodeUnknownSync(RigReadBoardSummaryResultSchema)(output),
  execute: (_input, context) => {
    const boardSummary = context.boardSummary;
    return {
      diagramId: boardSummary.diagramId,
      diagramName: boardSummary.diagramName,
      nodeCount: boardSummary.nodeCount,
      edgeCount: boardSummary.edgeCount,
      ownershipTeams: getOwnershipTeams(boardSummary),
      nodes: sortNodesByLabel(boardSummary.nodes),
      edges: sortEdgesById(boardSummary.edges),
    };
  },
};

const edgeLookupTool: RigReadToolDefinition<"edge_lookup", RigReadToolInputByName["edge_lookup"], RigReadToolResultByName["edge_lookup"]> = {
  tool: "edge_lookup",
  description: "Return one board edge plus its resolved source and target nodes.",
  decodeInput: (input) => {
    const decoded = Schema.decodeUnknownSync(RigReadEdgeLookupInputSchema)(input);
    return {
      edgeId: normalizeLookupId("edge_lookup", "edgeId", decoded.edgeId),
    };
  },
  decodeOutput: (output) => Schema.decodeUnknownSync(RigReadEdgeLookupResultSchema)(output),
  execute: (input, context) => {
    const edge = context.boardSummary.edges.find((candidate) => candidate.id === input.edgeId) ?? null;
    if (!edge) {
      return {
        found: false,
        edge: null,
        sourceNode: null,
        targetNode: null,
      };
    }

    const nodeIndex = buildNodeIndex(context.boardSummary);
    return {
      found: true,
      edge,
      sourceNode: nodeIndex.get(edge.sourceId) ?? null,
      targetNode: nodeIndex.get(edge.targetId) ?? null,
    };
  },
};

const nodeLookupTool: RigReadToolDefinition<"node_lookup", RigReadToolInputByName["node_lookup"], RigReadToolResultByName["node_lookup"]> = {
  tool: "node_lookup",
  description: "Return one board node plus its directly connected edges.",
  decodeInput: (input) => {
    const decoded = Schema.decodeUnknownSync(RigReadNodeLookupInputSchema)(input);
    return {
      nodeId: normalizeLookupId("node_lookup", "nodeId", decoded.nodeId),
    };
  },
  decodeOutput: (output) => Schema.decodeUnknownSync(RigReadNodeLookupResultSchema)(output),
  execute: (input, context) => {
    const node = context.boardSummary.nodes.find((candidate) => candidate.id === input.nodeId) ?? null;
    if (!node) {
      return {
        found: false,
        node: null,
        relationshipCount: 0,
        connectedEdges: [],
      };
    }

    const connectedEdges = findConnectedEdges(context.boardSummary, node.id)
      .map((edge) => edgeLookupTool.execute({ edgeId: edge.id }, context).edge)
      .filter((edge): edge is RigC4BoardEdge => edge !== null);

    return {
      found: true,
      node,
      relationshipCount: connectedEdges.length,
      connectedEdges,
    };
  },
};

const rigReadToolRegistry = {
  board_summary: boardSummaryTool,
  node_lookup: nodeLookupTool,
  edge_lookup: edgeLookupTool,
} satisfies {
  readonly [TTool in RigReadToolName]: RigReadToolDefinition<
    TTool,
    RigReadToolInputByName[TTool],
    RigReadToolResultByName[TTool]
  >;
};

export const getRigReadToolDefinition = <TTool extends RigReadToolName>(
  tool: TTool,
): RigReadToolDefinition<TTool, RigReadToolInputByName[TTool], RigReadToolResultByName[TTool]> =>
  rigReadToolRegistry[tool] as unknown as RigReadToolDefinition<
    TTool,
    RigReadToolInputByName[TTool],
    RigReadToolResultByName[TTool]
  >;

export const listRigReadToolDefinitions = (): ReadonlyArray<{
  readonly tool: RigReadToolName;
  readonly description: string;
}> =>
  Object.values(rigReadToolRegistry).map((definition) => ({
    tool: definition.tool,
    description: definition.description,
  }));

export const executeRigReadTool = <TTool extends RigReadToolName>(
  tool: TTool,
  input: unknown,
  boardSummary: unknown,
): RigReadToolResultByName[TTool] => {
  const definition = getRigReadToolDefinition(tool);
  const decodedBoardSummary = decodeBoardSummary(boardSummary);
  const decodedInput = definition.decodeInput(input);
  const result = definition.execute(decodedInput, {
    boardSummary: decodedBoardSummary,
  });
  return definition.decodeOutput(result);
};
