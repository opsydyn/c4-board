import { describe, expect, it } from "vitest";
import {
  buildLayoutHistoryArtifact,
  createLayoutHistoryFilename,
  serializeLayoutHistoryArtifact,
  verifyLayoutHistoryArtifactFingerprint,
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
  it("builds a summarized, fingerprinted, newest-first review artifact", async () => {
    const artifact = await buildLayoutHistoryArtifact({
      diagramId: "diagram-1",
      diagramName: "Checkout Platform",
      exportedAt: 500,
      audits: [audit(100), audit(300)],
    });

    expect(artifact).toEqual({
      schema: "opsydyn.layout-history",
      version: 2,
      exportedAt: 500,
      diagram: { id: "diagram-1", name: "Checkout Platform" },
      retention: { limit: 100, exportedCount: 2 },
      summary: {
        applicationCount: 2,
        firstAppliedAt: 100,
        lastAppliedAt: 300,
        variants: { single: 0, original: 0, recommended: 2 },
        engines: { dagre: 0, elk: 2, custom: 0 },
      },
      audits: [audit(300), audit(100)],
      fingerprint: {
        algorithm: "SHA-256",
        value: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    });
    expect(JSON.parse(serializeLayoutHistoryArtifact(artifact))).toEqual(artifact);
    expect(await verifyLayoutHistoryArtifactFingerprint(artifact)).toBe(true);
  });

  it("creates a filesystem-safe descriptive filename", () => {
    expect(createLayoutHistoryFilename("Checkout / Payments: v2")).toBe(
      "checkout-payments-v2-layout-history.json",
    );
    expect(createLayoutHistoryFilename("***")).toBe("diagram-layout-history.json");
  });

  it("rejects unsupported versions and inconsistent export counts", async () => {
    const artifact = await buildLayoutHistoryArtifact({
      diagramId: "diagram-1",
      diagramName: "Checkout Platform",
      exportedAt: 500,
      audits: [audit(100)],
    });

    expect(() => serializeLayoutHistoryArtifact({ ...artifact, version: 3 } as never)).toThrow();
    expect(() =>
      serializeLayoutHistoryArtifact({
        ...artifact,
        retention: { ...artifact.retention, exportedCount: 99 },
      })
    ).toThrow();
  });

  it("detects changes to fingerprinted evidence", async () => {
    const artifact = await buildLayoutHistoryArtifact({
      diagramId: "diagram-1",
      diagramName: "Checkout Platform",
      exportedAt: 500,
      audits: [audit(100)],
    });

    expect(
      await verifyLayoutHistoryArtifactFingerprint({
        ...artifact,
        diagram: { ...artifact.diagram, name: "Changed" },
      }),
    ).toBe(false);
  });
});
