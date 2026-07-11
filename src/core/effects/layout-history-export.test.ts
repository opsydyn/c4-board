import { describe, expect, it } from "vitest";
import {
  buildLayoutHistoryArtifact,
  createLayoutHistoryFilename,
  serializeLayoutHistoryArtifact,
} from "./layout-history-export";
import type { LayoutApplicationAudit } from "./layout.types";

const audit = (appliedAt: number): LayoutApplicationAudit => ({
  version: 1,
  appliedAt,
  preset: "elkLayered",
  strategyId: "elk-layered",
  engine: "elk",
  selectedVariant: "recommended",
  comparisonMetrics: [],
});

describe("layout history export", () => {
  it("builds a versioned newest-first review artifact", () => {
    const artifact = buildLayoutHistoryArtifact({
      diagramId: "diagram-1",
      diagramName: "Checkout Platform",
      exportedAt: 500,
      audits: [audit(100), audit(300)],
    });

    expect(artifact).toEqual({
      schema: "opsydyn.layout-history",
      version: 1,
      exportedAt: 500,
      diagram: { id: "diagram-1", name: "Checkout Platform" },
      retention: { limit: 100, exportedCount: 2 },
      audits: [audit(300), audit(100)],
    });
    expect(JSON.parse(serializeLayoutHistoryArtifact(artifact))).toEqual(artifact);
  });

  it("creates a filesystem-safe descriptive filename", () => {
    expect(createLayoutHistoryFilename("Checkout / Payments: v2")).toBe(
      "checkout-payments-v2-layout-history.json",
    );
    expect(createLayoutHistoryFilename("***")).toBe("diagram-layout-history.json");
  });
});
