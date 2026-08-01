import { Effect } from "effect";
import type { RigAgentRetrievalBundle, RigAgentRetrievalHit } from "./agent-retrieval";
import {
  azureResourceLookup,
  azureSyncSummary,
  buildAzureResourceCitation,
  buildAzureSyncCitation,
  type RigAzureToolContext,
  type RigAzureToolName,
} from "./agent-tools/azure-tools";
import type {
  AgentError,
  RigC4BoardSummary,
  RigReadToolInputByName,
  RigReadToolName,
  RigReadToolResultByName,
} from "./ai-agent.runtime";
import { runRigReadTool } from "./ai-agent.runtime";
import type { OpyBoardContextRegistry } from "./opy-board-context";
import type { OpyGroundedProposalSummary } from "./opy-c4-proposals";
import type { RedactionMode } from "./settings.types";

export type RigAgentContextConfidence = "high" | "medium" | "low";

export interface RigAgentCitation {
  readonly id: string;
  /**
   * Azure tools widen this beyond the Rust-executed read tools (Gate 5). Azure
   * evidence lives in SQLite rather than in a board summary, so its tools run
   * in the functional core — but a citation is a citation, and an operator
   * checking a claim should not care which side produced it.
   */
  readonly tool: RigReadToolName | RigAzureToolName;
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

export type RigAgentGroundingSurface = "chat" | "review" | "proposal";

export interface RigAgentReviewGroundingEvidence {
  readonly riskCount: number;
  readonly ambiguityCount: number;
  readonly recommendedChangeCount: number;
  readonly missingNodeCount: number;
  readonly missingEdgeCount: number;
}

export interface RigAgentGroundingConfidenceScore {
  readonly confidence: RigAgentContextConfidence;
  readonly score: number;
  readonly citationCount: number;
  readonly retrievalHitCount: number;
  readonly boardCitationCount: number;
  readonly scopeCitationCount: number;
  readonly outputEvidenceCount: number;
  readonly ambiguousOutputCount: number;
  readonly lowCoverage: boolean;
  readonly reason: string;
  readonly reasons: ReadonlyArray<string>;
}

export interface ScoreRigAgentGroundingConfidenceInput {
  readonly context: RigAgentContextBundle;
  readonly surface?: RigAgentGroundingSurface;
  readonly proposalSummary?: OpyGroundedProposalSummary | null;
  readonly reviewEvidence?: RigAgentReviewGroundingEvidence | null;
}

interface AssembleRigAgentContextInput {
  readonly boardSummary: RigC4BoardSummary | null;
  readonly boardContext: OpyBoardContextRegistry | null;
  readonly focus: string | null;
  readonly redactionMode?: RedactionMode;
  /** Azure evidence, when the board has any (Gate 5). */
  readonly azure?: RigAzureToolContext;
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

const clampScore = (score: number): number => Math.max(0, Math.min(100, Math.round(score)));

const summarizeConfidenceReasons = (reasons: ReadonlyArray<string>): string =>
  reasons.length > 0 ? reasons.join(" · ") : "No grounding evidence was available.";

export const scoreRigAgentGroundingConfidence = (
  input: ScoreRigAgentGroundingConfidenceInput,
): RigAgentGroundingConfidenceScore => {
  const surface = input.surface ?? "chat";
  const citationCount = input.context.citations.length;
  const retrievalHitCount = input.context.retrievalHits?.length ?? 0;
  const boardCitationCount = input.context.citations.filter((citation) => citation.tool === "board_summary").length;
  const scopeCitationCount =
    input.context.citations.filter((citation) => citation.tool === "node_lookup" || citation.tool === "edge_lookup")
      .length;
  const proposalSummary = input.proposalSummary ?? null;
  const reviewEvidence = input.reviewEvidence ?? null;
  const proposalOutputEvidenceCount = proposalSummary
    ? proposalSummary.newNodes
      + proposalSummary.existingNodes
      + proposalSummary.newEdges
      + proposalSummary.existingEdges
    : 0;
  const reviewOutputEvidenceCount = reviewEvidence
    ? reviewEvidence.riskCount
      + reviewEvidence.ambiguityCount
      + reviewEvidence.recommendedChangeCount
      + reviewEvidence.missingNodeCount
      + reviewEvidence.missingEdgeCount
    : 0;
  const outputEvidenceCount = Math.max(proposalOutputEvidenceCount, reviewOutputEvidenceCount);
  const ambiguousOutputCount = proposalSummary
    ? proposalSummary.ambiguousNodes + proposalSummary.ambiguousEdges
    : reviewEvidence
    ? reviewEvidence.ambiguityCount + reviewEvidence.missingNodeCount + reviewEvidence.missingEdgeCount
    : 0;

  const evidenceSurfaceRequiresCoverage = surface === "proposal" || surface === "review";
  const lowCoverage = citationCount === 0
    || (evidenceSurfaceRequiresCoverage && citationCount < 2 && retrievalHitCount === 0);

  const score = clampScore(
    (boardCitationCount > 0 ? 35 : 0)
      + Math.min(scopeCitationCount, 3) * 18
      + Math.min(retrievalHitCount, 3) * 8
      + Math.min(outputEvidenceCount, 4) * 5
      - Math.min(ambiguousOutputCount, 4) * 12
      - (lowCoverage ? 20 : 0),
  );

  const confidence: RigAgentContextConfidence = lowCoverage || score < 35
    ? "low"
    : score >= 70 && citationCount >= 3 && ambiguousOutputCount === 0
    ? "high"
    : "medium";

  const reasons = [
    `CITATIONS::${citationCount}`,
    `SCOPE::${scopeCitationCount}`,
    `RETRIEVAL::${retrievalHitCount}`,
    outputEvidenceCount > 0 ? `OUTPUT::${outputEvidenceCount}` : null,
    ambiguousOutputCount > 0 ? `AMBIGUOUS::${ambiguousOutputCount}` : null,
    lowCoverage ? "LOW COVERAGE" : null,
    `SCORE::${score}`,
  ].filter((reason): reason is string => reason !== null);

  return {
    confidence,
    score,
    citationCount,
    retrievalHitCount,
    boardCitationCount,
    scopeCitationCount,
    outputEvidenceCount,
    ambiguousOutputCount,
    lowCoverage,
    reason: summarizeConfidenceReasons(reasons),
    reasons,
  };
};

const replacePromptContextConfidence = (
  promptContext: string,
  confidenceScore: RigAgentGroundingConfidenceScore,
): string => {
  const lines = promptContext.split("\n");
  const nextLines = lines.map((line) => {
    if (line.startsWith("CONFIDENCE=")) {
      return `CONFIDENCE=${confidenceScore.confidence.toUpperCase()}`;
    }

    if (line.startsWith("CONFIDENCE_REASON=")) {
      return `CONFIDENCE_REASON=${confidenceScore.reason}`;
    }

    return line;
  });

  if (!nextLines.some((line) => line.startsWith("GROUNDING_SCORE="))) {
    nextLines.push(`GROUNDING_SCORE=${confidenceScore.score}`);
  }

  return nextLines.join("\n");
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

export const formatRigAgentCitationBlock = (bundle: RigAgentContextBundle): string =>
  [
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

  const mergedBundle = {
    ...bundle,
    retrievalHits: retrieval.hits,
    retrievalPromptContext: retrieval.promptContext,
    promptContext: `${bundle.promptContext}\n${retrieval.promptContext}`,
  };
  const confidenceScore = scoreRigAgentGroundingConfidence({
    context: mergedBundle,
    surface: "chat",
  });

  return {
    ...mergedBundle,
    confidence: confidenceScore.confidence,
    confidenceReason: confidenceScore.reason,
    promptContext: replacePromptContextConfidence(mergedBundle.promptContext, confidenceScore),
  };
};

export const assembleRigAgentContextWithTools = (
  input: AssembleRigAgentContextWithToolsInput,
): Effect.Effect<RigAgentContextBundle, AgentError> =>
  Effect.gen(function*() {
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

    // Azure evidence, cited the same way board evidence is. Runs only when the
    // board actually has Azure on it, so a purely hand-drawn board is not told
    // about a sync that never happened.
    if (input.azure && (input.azure.nodes.length > 0 || input.azure.runs.length > 0)) {
      pushCitation(
        citations,
        buildAzureSyncCitation(azureSyncSummary({}, input.azure), redactionMode),
      );
      pushCitation(
        citations,
        buildAzureResourceCitation(
          azureResourceLookup({ query: focus }, input.azure),
          redactionMode,
        ),
      );
    }

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

    const baseBundle: RigAgentContextBundle = {
      promptContext: "",
      citations,
      confidence: "low",
      confidenceReason: "",
    };
    const confidence = scoreRigAgentGroundingConfidence({
      context: baseBundle,
      surface: "chat",
    });

    return {
      promptContext: [
        `FOCUS=${focusLabel(focus)}`,
        `CONFIDENCE=${confidence.confidence.toUpperCase()}`,
        `CONFIDENCE_REASON=${confidence.reason}`,
        `GROUNDING_SCORE=${confidence.score}`,
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
