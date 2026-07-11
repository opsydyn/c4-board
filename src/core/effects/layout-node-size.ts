import type { Node } from "@xyflow/react";

export interface NodeDimensions {
  width: number;
  height: number;
}

export function getNodeDimensions(node: Node): NodeDimensions {
  const styleWidth = typeof node.style?.width === "number" ? node.style.width : undefined;
  const styleHeight = typeof node.style?.height === "number" ? node.style.height : undefined;

  return {
    width: node.measured?.width || styleWidth || getDefaultNodeWidth(node.type),
    height: node.measured?.height || styleHeight || getDefaultNodeHeight(node.type),
  };
}

export function getDefaultNodeWidth(nodeType: string | undefined): number {
  switch (nodeType) {
    case "person":
      return 220;
    case "system":
    case "externalSystem":
      return 240;
    case "container":
      return 280;
    case "component":
      return 200;
    case "boundedContext":
      return 500;
    case "aggregate":
      return 320;
    case "domainEvent":
      return 180;
    case "entity":
      return 220;
    case "valueObject":
    case "command":
    case "query":
      return 180;
    case "domainService":
    case "repository":
    case "factory":
      return 200;
    case "applicationService":
      return 240;
    case "integrationEvent":
      return 200;
    case "antiCorruptionLayer":
      return 280;
    case "saga":
      return 300;
    default:
      return 220;
  }
}

export function getDefaultNodeHeight(nodeType: string | undefined): number {
  switch (nodeType) {
    case "person":
      return 160;
    case "system":
    case "externalSystem":
    case "valueObject":
    case "integrationEvent":
      return 140;
    case "container":
    case "antiCorruptionLayer":
    case "saga":
      return 200;
    case "component":
    case "domainEvent":
    case "command":
    case "query":
      return 120;
    case "boundedContext":
      return 400;
    case "aggregate":
      return 240;
    case "entity":
      return 160;
    case "domainService":
    case "repository":
    case "factory":
      return 150;
    case "applicationService":
      return 170;
    default:
      return 140;
  }
}
