import { Schema } from "effect";

export const RigC4BoardNodeTypeSchema = Schema.Literal(
  "person",
  "system",
  "externalSystem",
  "container",
  "component",
);
export type RigC4BoardNodeType = Schema.Schema.Type<typeof RigC4BoardNodeTypeSchema>;

export const RigC4BoardNodeSchema = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  nodeType: RigC4BoardNodeTypeSchema,
  description: Schema.NullOr(Schema.String),
  technology: Schema.NullOr(Schema.String),
  teamOwnership: Schema.NullOr(Schema.String),
});
export type RigC4BoardNode = Schema.Schema.Type<typeof RigC4BoardNodeSchema>;

export const RigC4BoardEdgeSchema = Schema.Struct({
  id: Schema.String,
  sourceId: Schema.String,
  targetId: Schema.String,
  sourceLabel: Schema.String,
  targetLabel: Schema.String,
  label: Schema.NullOr(Schema.String),
});
export type RigC4BoardEdge = Schema.Schema.Type<typeof RigC4BoardEdgeSchema>;

export const RigC4BoardSummarySchema = Schema.Struct({
  diagramId: Schema.NullOr(Schema.String),
  diagramName: Schema.NullOr(Schema.String),
  nodeCount: Schema.Number,
  edgeCount: Schema.Number,
  nodes: Schema.Array(RigC4BoardNodeSchema),
  edges: Schema.Array(RigC4BoardEdgeSchema),
});
export type RigC4BoardSummary = Schema.Schema.Type<typeof RigC4BoardSummarySchema>;

export const RigReadToolNameSchema = Schema.Literal(
  "board_summary",
  "node_lookup",
  "edge_lookup",
);
export type RigReadToolName = Schema.Schema.Type<typeof RigReadToolNameSchema>;

export const RigReadBoardSummaryInputSchema = Schema.Struct({});
export type RigReadBoardSummaryInput = Schema.Schema.Type<typeof RigReadBoardSummaryInputSchema>;

export const RigReadNodeLookupInputSchema = Schema.Struct({
  nodeId: Schema.String,
});
export type RigReadNodeLookupInput = Schema.Schema.Type<typeof RigReadNodeLookupInputSchema>;

export const RigReadEdgeLookupInputSchema = Schema.Struct({
  edgeId: Schema.String,
});
export type RigReadEdgeLookupInput = Schema.Schema.Type<typeof RigReadEdgeLookupInputSchema>;

export const RigReadBoardSummaryResultSchema = Schema.Struct({
  diagramId: Schema.NullOr(Schema.String),
  diagramName: Schema.NullOr(Schema.String),
  nodeCount: Schema.Number,
  edgeCount: Schema.Number,
  ownershipTeams: Schema.Array(Schema.String),
  nodes: Schema.Array(RigC4BoardNodeSchema),
  edges: Schema.Array(RigC4BoardEdgeSchema),
});
export type RigReadBoardSummaryResult = Schema.Schema.Type<typeof RigReadBoardSummaryResultSchema>;

export const RigReadNodeLookupResultSchema = Schema.Struct({
  found: Schema.Boolean,
  node: Schema.NullOr(RigC4BoardNodeSchema),
  relationshipCount: Schema.Number,
  connectedEdges: Schema.Array(RigC4BoardEdgeSchema),
});
export type RigReadNodeLookupResult = Schema.Schema.Type<typeof RigReadNodeLookupResultSchema>;

export const RigReadEdgeLookupResultSchema = Schema.Struct({
  found: Schema.Boolean,
  edge: Schema.NullOr(RigC4BoardEdgeSchema),
  sourceNode: Schema.NullOr(RigC4BoardNodeSchema),
  targetNode: Schema.NullOr(RigC4BoardNodeSchema),
});
export type RigReadEdgeLookupResult = Schema.Schema.Type<typeof RigReadEdgeLookupResultSchema>;

export interface RigReadToolInputByName {
  readonly board_summary: RigReadBoardSummaryInput;
  readonly node_lookup: RigReadNodeLookupInput;
  readonly edge_lookup: RigReadEdgeLookupInput;
}

export interface RigReadToolResultByName {
  readonly board_summary: RigReadBoardSummaryResult;
  readonly node_lookup: RigReadNodeLookupResult;
  readonly edge_lookup: RigReadEdgeLookupResult;
}
