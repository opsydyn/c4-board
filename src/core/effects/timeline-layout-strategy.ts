/**
 * The timeline layout, as a registered strategy.
 *
 * ADR-016. Wrapping `timelineLayout` in the strategy interface is what makes it
 * selectable alongside the dependency layouts — and `analyse` is what keeps them
 * apart: a storm should never be ranked by its edges, and a C4 diagram should
 * never be laid out as a timeline.
 */

import { EVENT_STORMING_STICKIES } from "./event-storming";
import { evaluateLayoutQuality } from "./layout-metrics";
import type { LayoutAnalysis, LayoutInput, LayoutResult, SynchronousLayoutStrategy } from "./layout.types";
import { timelineLayout } from "./timeline-layout";

export const TIMELINE_STRATEGY_ID = "event-storming-timeline";

const STICKY_TYPES = new Set(EVENT_STORMING_STICKIES.map((sticky) => sticky.type as string));

/**
 * A board is a storm when its stickies are the ones a storm is made of. Judged
 * by content rather than by the diagram's domain flag, so the strategy stays
 * usable on its own and a mislabelled board still lays out sensibly.
 */
export const analyseTimeline = (input: LayoutInput): LayoutAnalysis => {
  const topLevel = input.nodes.filter((node) => !node.parentId);
  if (topLevel.length === 0) {
    return { applicable: false, score: 0, reasons: ["There are no nodes to lay out."] };
  }

  const stickies = topLevel.filter((node) => STICKY_TYPES.has(node.type ?? ""));
  const share = stickies.length / topLevel.length;

  if (share < 0.5) {
    return {
      applicable: false,
      score: share,
      reasons: [
        "This board is not made of event storming stickies, and a timeline would order it by position rather than dependency.",
      ],
    };
  }

  return {
    applicable: true,
    score: share,
    reasons: [`${stickies.length} of ${topLevel.length} nodes are event storming stickies.`],
  };
};

export const layoutTimeline = (input: LayoutInput): LayoutResult => {
  // Edges are passed through untouched: in this format they annotate the story
  // rather than describing its order.
  const nodes = timelineLayout(input.nodes, input.edges);

  return {
    nodes,
    edges: input.edges,
    strategyId: TIMELINE_STRATEGY_ID,
    engine: "custom",
    // Reported for comparability with the other strategies, though edge-based
    // measures mean little here: crossings are not a fault in a storm.
    quality: evaluateLayoutQuality(nodes, input.edges, input.nodes),
    diagnostics: [],
  };
};

export const timelineLayoutStrategy: SynchronousLayoutStrategy = {
  id: TIMELINE_STRATEGY_ID,
  engine: "custom",
  analyse: analyseTimeline,
  layout: layoutTimeline,
};
