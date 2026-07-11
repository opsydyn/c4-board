import { dagreLayoutStrategy } from "./dagre-layout-strategy";
import { elkLayeredLayoutStrategy } from "./elk-layered-layout-strategy";
import { hexagonalLayoutStrategy } from "./hexagonal-layout-strategy";
import { hubSpokeLayoutStrategy } from "./hub-spoke-layout-strategy";
import type { LayoutDiagnostic, LayoutStrategy, SynchronousLayoutStrategy } from "./layout.types";
import { systemContextLayoutStrategy } from "./system-context-layout-strategy";

const synchronousStrategies = new Map<string, SynchronousLayoutStrategy>([
  [dagreLayoutStrategy.id, dagreLayoutStrategy],
  [hubSpokeLayoutStrategy.id, hubSpokeLayoutStrategy],
  [systemContextLayoutStrategy.id, systemContextLayoutStrategy],
  [hexagonalLayoutStrategy.id, hexagonalLayoutStrategy],
]);

const strategies = new Map<string, LayoutStrategy>([
  ...synchronousStrategies,
  [elkLayeredLayoutStrategy.id, elkLayeredLayoutStrategy],
]);

export interface ResolvedLayoutStrategy {
  strategy: SynchronousLayoutStrategy;
  diagnostics: LayoutDiagnostic[];
}

export function resolveSynchronousLayoutStrategy(
  requestedId: string | undefined,
): ResolvedLayoutStrategy {
  if (!requestedId) return { strategy: dagreLayoutStrategy, diagnostics: [] };

  const strategy = synchronousStrategies.get(requestedId);
  if (strategy) return { strategy, diagnostics: [] };

  return {
    strategy: dagreLayoutStrategy,
    diagnostics: [{
      code: "layout-strategy-fallback",
      severity: "warning",
      message: `Layout strategy '${requestedId}' is unavailable; Dagre was used instead.`,
    }],
  };
}

export function getSynchronousLayoutStrategies(): SynchronousLayoutStrategy[] {
  return [...synchronousStrategies.values()];
}

export function resolveLayoutStrategy(requestedId: string): LayoutStrategy | undefined {
  return strategies.get(requestedId);
}

export function getLayoutStrategies(): LayoutStrategy[] {
  return [...strategies.values()];
}
