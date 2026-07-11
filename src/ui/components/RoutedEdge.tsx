import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from "@xyflow/react";

import type { EdgeData } from "../../core/effects/edge-operations";

export function RoutedEdge({
  data,
  label,
  labelBgStyle,
  labelStyle,
  markerEnd,
  style,
}: EdgeProps) {
  const sections = (data as EdgeData | undefined)?.layoutRoute ?? [];
  const points = sections.flatMap((section) => [section.start, ...section.bends, section.end]);
  const path = buildRoutedEdgePath(sections);
  const labelPoint = points[Math.floor(points.length / 2)];

  if (!path) return null;

  return (
    <>
      <BaseEdge path={path} style={style} {...(markerEnd && { markerEnd })} />
      {label && labelPoint && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelPoint.x}px, ${labelPoint.y}px)`,
              pointerEvents: "all",
              padding: "2px 4px",
              ...labelBgStyle,
              ...labelStyle,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export function buildRoutedEdgePath(
  sections: NonNullable<EdgeData["layoutRoute"]>,
): string {
  return sections.map((section) => {
    const sectionPoints = [section.start, ...section.bends, section.end];
    return sectionPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  }).join(" ");
}
