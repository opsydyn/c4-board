import {
  assembleRigAgentContextWithTools,
  formatRigAgentCitationBlock,
  mergeRigAgentContextWithRetrieval,
  scoreRigAgentGroundingConfidence,
} from "@/core/effects/agent-context";
import { executeRigReadTool } from "@/core/effects/agent-tools/read-tools";
import type { RigC4BoardSummary } from "@/core/effects/ai-agent.runtime";
import type { OpyBoardContextRegistry } from "@/core/effects/opy-board-context";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const createBoardSummary = (): RigC4BoardSummary => ({
  diagramId: "diagram-1",
  diagramName: "Payments Context",
  nodeCount: 3,
  edgeCount: 2,
  nodes: [
    {
      id: "person-customer",
      label: "Customer",
      nodeType: "person",
      description: null,
      technology: null,
      teamOwnership: null,
    },
    {
      id: "system-payments",
      label: "Payments API",
      nodeType: "system",
      description: "Accepts payment requests",
      technology: "Rust",
      teamOwnership: "Core Platform",
    },
    {
      id: "system-ledger",
      label: "Ledger Service",
      nodeType: "system",
      description: null,
      technology: "Postgres",
      teamOwnership: "Core Platform",
    },
  ],
  edges: [
    {
      id: "edge-customer-payments",
      sourceId: "person-customer",
      targetId: "system-payments",
      sourceLabel: "Customer",
      targetLabel: "Payments API",
      label: "uses",
    },
    {
      id: "edge-payments-ledger",
      sourceId: "system-payments",
      targetId: "system-ledger",
      sourceLabel: "Payments API",
      targetLabel: "Ledger Service",
      label: "records",
    },
  ],
});

const createBoardContext = (): OpyBoardContextRegistry => ({
  diagramId: "diagram-1",
  diagramName: "Payments Context",
  nodeCount: 3,
  edgeCount: 2,
  ownershipTeamCount: 1,
  selectedNode: {
    id: "system-payments",
    label: "Payments API",
    nodeType: "system",
    relationshipCount: 2,
    teamOwnership: "Core Platform",
    description: "Accepts payment requests",
    technology: "Rust",
  },
  hotspotNode: {
    id: "system-payments",
    label: "Payments API",
    nodeType: "system",
    relationshipCount: 2,
    teamOwnership: "Core Platform",
    description: "Accepts payment requests",
    technology: "Rust",
  },
  scopes: [],
  promptContext: "",
});

describe("agent-context", () => {
  it("builds a high-confidence citation bundle from read tools", async () => {
    const boardSummary = createBoardSummary();
    const context = await Effect.runPromise(
      assembleRigAgentContextWithTools({
        boardSummary,
        boardContext: createBoardContext(),
        focus: "payments",
        redactionMode: "off",
        runReadTool: (tool, input, snapshot) =>
          Effect.succeed(executeRigReadTool(tool, input as never, snapshot) as never),
      }),
    );

    expect(context.confidence).toBe("high");
    expect(context.citations.length).toBeGreaterThanOrEqual(3);
    expect(formatRigAgentCitationBlock(context)).toContain("CITATION::[BOARD_SUMMARY]");
    expect(formatRigAgentCitationBlock(context)).toContain("CONFIDENCE::HIGH");
  });

  it("drops to low confidence when no board evidence exists", async () => {
    const context = await Effect.runPromise(
      assembleRigAgentContextWithTools({
        boardSummary: null,
        boardContext: null,
        focus: null,
        redactionMode: "strict",
        runReadTool: () => Effect.die("should not be called"),
      }),
    );

    expect(context.confidence).toBe("low");
    expect(context.citations).toHaveLength(0);
    expect(context.promptContext).toContain("CONFIDENCE=LOW");
  });

  it("redacts sensitive node citation metadata in strict mode", async () => {
    const boardSummary = createBoardSummary();
    const context = await Effect.runPromise(
      assembleRigAgentContextWithTools({
        boardSummary,
        boardContext: createBoardContext(),
        focus: "payments",
        redactionMode: "strict",
        runReadTool: (tool, input, snapshot) =>
          Effect.succeed(executeRigReadTool(tool, input as never, snapshot) as never),
      }),
    );

    const selectedCitation = context.citations.find((citation) => citation.id.startsWith("selected:"));
    expect(selectedCitation?.detail).toContain("[REDACTED TEAM]");
    expect(selectedCitation?.sourceId).toBeNull();
  });

  it("includes retrieval hits in the formatted citation block", () => {
    const citationBlock = formatRigAgentCitationBlock({
      promptContext: "",
      citations: [],
      confidence: "medium",
      confidenceReason: "Retrieval evidence complements board sources.",
      retrievalHits: [
        {
          id: "settings:c4",
          scope: "governance",
          source: "settings",
          label: "OPERATOR SETTINGS SURFACE",
          detail: "PRESENCE MISSION · TELEMETRY ON · RETENTION 30D",
          contentPreview: "opy visible on · explainability on · autosave 1500ms",
          createdAt: null,
          score: 0.02,
        },
      ],
      retrievalPromptContext: "RETRIEVAL=[GOVERNANCE/SETTINGS] OPERATOR SETTINGS SURFACE",
    });

    expect(citationBlock).toContain("CITATION::[RETRIEVAL/SETTINGS]");
    expect(citationBlock).toContain("OPERATOR SETTINGS SURFACE");
    expect(citationBlock).toContain("autosave 1500ms");
  });

  it("keeps under-cited proposals at low confidence even when they contain changes", async () => {
    const boardSummary = createBoardSummary();
    const context = await Effect.runPromise(
      assembleRigAgentContextWithTools({
        boardSummary,
        boardContext: null,
        focus: "serverless events",
        redactionMode: "off",
        runReadTool: (tool, input, snapshot) =>
          Effect.succeed(executeRigReadTool(tool, input as never, snapshot) as never),
      }),
    );

    const score = scoreRigAgentGroundingConfidence({
      context,
      surface: "proposal",
      proposalSummary: {
        newNodes: 2,
        existingNodes: 0,
        ambiguousNodes: 0,
        newEdges: 1,
        existingEdges: 0,
        ambiguousEdges: 0,
        canApply: true,
        hasChanges: true,
      },
    });

    expect(context.citations).toHaveLength(1);
    expect(score.confidence).toBe("low");
    expect(score.lowCoverage).toBe(true);
    expect(score.reason).toContain("LOW COVERAGE");
  });

  it("recalculates context confidence when retrieval evidence is merged", () => {
    const mergedContext = mergeRigAgentContextWithRetrieval(
      {
        promptContext: [
          "FOCUS=WHOLE BOARD",
          "CONFIDENCE=LOW",
          "CONFIDENCE_REASON=Board summary evidence is available, but scope-specific evidence is limited.",
        ].join("\n"),
        citations: [
          {
            id: "board:diagram-1",
            tool: "board_summary",
            label: "Payments Context",
            detail: "3 nodes · 2 edges · 1 teams",
            sourceId: "diagram-1",
          },
        ],
        confidence: "low",
        confidenceReason: "Board summary evidence is available, but scope-specific evidence is limited.",
      },
      {
        domain: "c4",
        query: "serverless event driven architecture",
        diagramScope: "current-diagram",
        redactionMode: "off",
        hits: [
          {
            id: "settings:c4",
            scope: "governance",
            source: "settings",
            label: "OPERATOR SETTINGS SURFACE",
            detail: "PRESENCE MISSION · TELEMETRY ON · RETENTION 30D",
            contentPreview: "opy visible on · explainability on · autosave 1500ms",
            createdAt: null,
            score: 0.02,
          },
          {
            id: "history:diagram",
            scope: "task",
            source: "task",
            label: "RECENT DIAGRAM PROPOSAL",
            detail: "APPLIED · 3 nodes",
            contentPreview: "serverless event driven architecture",
            createdAt: 1,
            score: 0.03,
          },
        ],
        promptContext: "RETRIEVAL=[GOVERNANCE/SETTINGS] OPERATOR SETTINGS SURFACE",
      },
    );

    expect(mergedContext.confidence).toBe("medium");
    expect(mergedContext.confidenceReason).toContain("RETRIEVAL::2");
    expect(mergedContext.promptContext).toContain("CONFIDENCE=MEDIUM");
    expect(mergedContext.promptContext).toContain("GROUNDING_SCORE=");
  });
});
