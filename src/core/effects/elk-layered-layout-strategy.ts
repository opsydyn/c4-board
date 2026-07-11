import type { ElkNode } from "elkjs/lib/elk-api";

import type { ElkLayoutClientOptions } from "./elk-layout-client";
import { runElkWorkerLayout } from "./elk-layout-client";
import { buildElkLayeredGraph, mapElkLayeredResult } from "./elk-layout-mapper";
import type { LayoutInput, LayoutResult, LayoutStrategy } from "./layout.types";

export interface ElkLayeredExecutionOptions extends ElkLayoutClientOptions {
  execute?: (graph: ElkNode, options: ElkLayoutClientOptions) => Promise<ElkNode>;
}

export const elkLayeredLayoutStrategy: LayoutStrategy = {
  id: "elk-layered",
  engine: "elk",
  analyse: ({ nodes, edges }) => {
    const hasHierarchy = nodes.some((node) => node.parentId);
    return {
      applicable: nodes.length > 0,
      score: hasHierarchy ? 1 : edges.length > 0 ? 0.8 : 0.4,
      reasons: [
        hasHierarchy
          ? "ELK Layered supports compound nodes and hierarchy-crossing edges."
          : "ELK Layered provides orthogonal edge routing for directed graphs.",
      ],
    };
  },
  layout: layoutWithElk,
};

export async function layoutWithElk(
  input: LayoutInput,
  executionOptions: ElkLayeredExecutionOptions = {},
): Promise<LayoutResult> {
  const graph = buildElkLayeredGraph(input);
  const execute = executionOptions.execute ?? runElkWorkerLayout;
  const result = await execute(graph, executionOptions);
  return mapElkLayeredResult(input, result, elkLayeredLayoutStrategy.id);
}
