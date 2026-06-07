import { Effect } from "effect";
import type { RigAgentRetrievalBundle, RigAgentRetrievalHit } from "./agent-retrieval";
import type {
  AgentError,
  RigC4BoardSummary,
  RigReadToolInputByName,
  RigReadToolName,
  RigReadToolResultByName,
} from "./ai-agent.runtime";
import { runRigReadTool } from "./ai-agent.runtime";
import type { OpyBoardContextRegistry } from "./opy-board-context";
import type { RedactionMode } from "./settings.types";

export type RigAgentContextConfidence = "high" | "medium" | "low";

export interface RigAgentCitation {
  readonly id: string;
  readonly tool: RigReadToolName;
  readonly label: string;
  readonly detail: string;
  readonly sourceId: string | null;
}

export interface RigAgentContextBundle {
  readonly promptContext: string;
  readonly citations: ReadonlyArray<RigAgentCitation>;
  readonly confidence: RigAgentContextConfidence;
  readonly confidenceReason: string;
  readonly retrievalHits?: ReadonlyArray<RigAgentRetrievalHit>;
  readonly retrievalPromptContext?: string;
}

interface AssembleRigAgentContextInput {
  readonly boardSummary: RigC4BoardSummary | null;
  readonly boardContext: OpyBoardContextRegistry | null;
  readonly focus: string | null;
  readonly redactionMode?: RedactionMode;
}

interface AssembleRigAgentContextWithToolsInput extends AssembleRigAgentContextInput {
  readonly runReadTool: <TTool extends RigReadToolName>(
    tool: TTool,
    input: RigReadToolInputByName[TTool],
    boardSummary: RigC4BoardSummary,
  ) => Effect.Effect<RigReadToolResultByName[TTool], AgentError>;
}

const focusLabel = (focus: string | null): string => {
  const normalized = focus?.trim() ?? "";
  return normalized.length > 0 ? normalized : "WHOLE BOARD";
};

const redactMetadata = (
  value: string | null | undefined,
  mode: RedactionMode,
  strictPlaceholder: string,
): string => {
  const normalized = (value ?? "").trim();
  if (normalized.length === 0) {
    return "";
  }

  return mode === "strict" ? strictPlaceholder : normalized;
};

const toConfidence = (citationCount: number): {
  readonly confidence: RigAgentContextConfidence;
  readonly reason: string;
} => {
  if (citationCount >= 3) {
    return {
      confidence: "high",
      reason: "Multiple board sources resolved through typed read tools.",
    };
  }

  if (citationCount >= 1) {
    return {
      confidence: "medium",
      reason: "Board summary evidence is available, but scope-specific evidence is limited.",
    };
  }

  return {
    confidence: "low",
    reason: "No board evidence was available for this request.",
  };
};

const formatCitationLine = (citation: RigAgentCitation): string =>
  `[${citation.tool.toUpperCase()}] ${citation.label} :: ${citation.detail}`;

const formatRetrievalCitationLine = (hit: RigAgentRetrievalHit): string => {
  const preview = hit.contentPreview.trim();
  return preview.length > 0
    ? `[RETRIEVAL/${hit.source.toUpperCase()}] ${hit.label} :: ${hit.detail} :: ${preview}`
    : `[RETRIEVAL/${hit.source.toUpperCase()}] ${hit.label} :: ${hit.detail}`;
};

const createBoardSummaryCitation = (
  result: RigReadToolResultByName["board_summary"],
  redactionMode: RedactionMode,
): RigAgentCitation => ({
  id: `board:${result.diagramId ?? "unsaved"}`,
  tool: "board_summary",
  label: result.diagramName?.trim() || "UNTITLED BOARD",
  detail: `${result.nodeCount} nodes · ${result.edgeCount} edges · ${result.ownershipTeams.length} teams`,
  sourceId: redactionMode === "off" ? result.diagramId : null,
});

const createNodeCitation = (
  result: RigReadToolResultByName["node_lookup"],
  role: "selected" | "hotspot",
  redactionMode: RedactionMode,
): RigAgentCitation | null => {
  if (!result.found || !result.node) {
    return null;
  }

  return {
    id: `${role}:${result.node.id}`,
    tool: "node_lookup",
    label: `${role.toUpperCase()} · ${result.node.nodeType.toUpperCase()} ${result.node.label}`,
    detail: `${result.relationshipCount} links${
      result.node.teamOwnership
        ? ` · team ${redactMetadata(result.node.teamOwnership, redactionMode, "[REDACTED TEAM]")}`
        : ""
    }`,
    sourceId: redactionMode === "off" ? result.node.id : null,
  };
};

const createEdgeCitation = (
  result: RigReadToolResultByName["edge_lookup"],
  role: "selected-edge" | "hotspot-edge",
  redactionMode: RedactionMode,
): RigAgentCitation | null => {
  if (!result.found || !result.edge) {
    return null;
  }

  return {
    id: `${role}:${result.edge.id}`,
    tool: "edge_lookup",
    label: `${role.toUpperCase()} · ${result.edge.sourceLabel} -> ${result.edge.targetLabel}`,
    detail: result.edge.label?.trim() || "(no label)",
    sourceId: redactionMode === "off" ? result.edge.id : null,
  };
};

const pushCitation = (
  target: RigAgentCitation[],
  nextCitation: RigAgentCitation | null,
): void => {
  if (!nextCitation) {
    return;
  }

  if (target.some((citation) => citation.id === nextCitation.id)) {
    return;
  }

  target.push(nextCitation);
};

export const formatRigAgentCitationBlock = (bundle: RigAgentContextBundle): string => [
  `CONFIDENCE::${bundle.confidence.toUpperCase()} · ${bundle.confidenceReason}`,
  ...bundle.citations.map((citation) => `CITATION::${formatCitationLine(citation)}`),
  ...(bundle.retrievalHits ?? []).map((hit) => `CITATION::${formatRetrievalCitationLine(hit)}`),
].join("\n");

export const mergeRigAgentContextWithRetrieval = (
  bundle: RigAgentContextBundle,
  retrieval: RigAgentRetrievalBundle,
): RigAgentContextBundle => {
  if (retrieval.hits.length === 0 || retrieval.promptContext.length === 0) {
    return bundle;
  }

  return {
    ...bundle,
    retrievalHits: retrieval.hits,
    retrievalPromptContext: retrieval.promptContext,
    promptContext: `${bundle.promptContext}\n${retrieval.promptContext}`,
  };
};

export const assembleRigAgentContextWithTools = (
  input: AssembleRigAgentContextWithToolsInput,
): Effect.Effect<RigAgentContextBundle, AgentError> =>
  Effect.gen(function* () {
    const { boardSummary, boardContext, focus, runReadTool } = input;
    const redactionMode = input.redactionMode ?? "strict";

    if (!boardSummary || boardSummary.nodeCount === 0) {
      const emptyBundle: RigAgentContextBundle = {
        promptContext: [
          `FOCUS=${focusLabel(focus)}`,
          "BOARD_EVIDENCE=UNAVAILABLE",
          "CONFIDENCE=LOW",
          "CONFIDENCE_REASON=No board snapshot was available for this request.",
        ].join("\n"),
        citations: [],
        confidence: "low",
        confidenceReason: "No board snapshot was available for this request.",
      };
      return emptyBundle;
    }

    const boardSummaryResult = yield* runReadTool("board_summary", {}, boardSummary);
    const citations: RigAgentCitation[] = [createBoardSummaryCitation(boardSummaryResult, redactionMode)];

    let selectedNodeResult: RigReadToolResultByName["node_lookup"] | null = null;
    if (boardContext?.selectedNode?.id) {
      selectedNodeResult = yield* runReadTool(
        "node_lookup",
        { nodeId: boardContext.selectedNode.id },
        boardSummary,
      );
      pushCitation(citations, createNodeCitation(selectedNodeResult, "selected", redactionMode));
    }

    if (selectedNodeResult?.found && selectedNodeResult.connectedEdges[0]) {
      const selectedEdgeResult = yield* runReadTool(
        "edge_lookup",
        { edgeId: selectedNodeResult.connectedEdges[0].id },
        boardSummary,
      );
      pushCitation(citations, createEdgeCitation(selectedEdgeResult, "selected-edge", redactionMode));
    }

    if (
      boardContext?.hotspotNode?.id
      && boardContext.hotspotNode.id !== boardContext.selectedNode?.id
    ) {
      const hotspotNodeResult = yield* runReadTool(
        "node_lookup",
        { nodeId: boardContext.hotspotNode.id },
        boardSummary,
      );
      pushCitation(citations, createNodeCitation(hotspotNodeResult, "hotspot", redactionMode));

      if (hotspotNodeResult.found && hotspotNodeResult.connectedEdges[0]) {
        const hotspotEdgeResult = yield* runReadTool(
          "edge_lookup",
          { edgeId: hotspotNodeResult.connectedEdges[0].id },
          boardSummary,
        );
        pushCitation(citations, createEdgeCitation(hotspotEdgeResult, "hotspot-edge", redactionMode));
      }
    }

    const confidence = toConfidence(citations.length);

    return {
      promptContext: [
        `FOCUS=${focusLabel(focus)}`,
        `CONFIDENCE=${confidence.confidence.toUpperCase()}`,
        `CONFIDENCE_REASON=${confidence.reason}`,
        ...citations.map((citation) => `SOURCE=${formatCitationLine(citation)}`),
      ].join("\n"),
      citations,
      confidence: confidence.confidence,
      confidenceReason: confidence.reason,
    };
  });

export const assembleRigAgentContext = (
  input: AssembleRigAgentContextInput,
): Effect.Effect<RigAgentContextBundle, AgentError> =>
  assembleRigAgentContextWithTools({
    ...input,
    runReadTool: (tool, toolInput, boardSummary) => runRigReadTool(tool, toolInput, boardSummary),
  });
