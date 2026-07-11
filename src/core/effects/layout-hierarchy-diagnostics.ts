import type { Edge, Node } from "@xyflow/react";
import type { LayoutDiagnostic } from "./layout.types";

export function buildHierarchyDiagnostics(input: {
  strategyId: string;
  strategyLabel: string;
  childNodes: Node[];
  edges: Edge[];
  includedEdges: Edge[];
}): LayoutDiagnostic[] {
  const diagnostics: LayoutDiagnostic[] = [];

  if (input.childNodes.length > 0) {
    diagnostics.push({
      code: `${input.strategyId}-child-positions-preserved`,
      severity: "info",
      message: `${input.childNodes.length} child node position(s) were preserved by ${input.strategyLabel}.`,
      nodeIds: input.childNodes.map((node) => node.id),
    });
  }

  if (input.includedEdges.length < input.edges.length) {
    const includedEdgeIds = new Set(input.includedEdges.map((edge) => edge.id));
    const excludedEdges = input.edges.filter((edge) => !includedEdgeIds.has(edge.id));
    diagnostics.push({
      code: `${input.strategyId}-hierarchy-edges-excluded`,
      severity: "warning",
      message: `${excludedEdges.length} hierarchy-crossing edge(s) did not influence ${input.strategyLabel}.`,
      edgeIds: excludedEdges.map((edge) => edge.id),
    });
  }

  return diagnostics;
}
