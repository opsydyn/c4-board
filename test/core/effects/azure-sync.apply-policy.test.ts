/**
 * The gate between a dry-run and a destructive apply (ADR-020).
 *
 * The failure this exists to prevent: a scope typo, a paged-out snapshot, or a
 * zero-result query producing an archive set that the diff cannot distinguish
 * from a genuinely emptied subscription. Each of those looks like a routine
 * apply right up until the board is gone.
 */

import { type AzureApplyPolicy, resolveAzureApplyDecision } from "@/core/effects/azure-sync.apply-policy";
import type { AzureSyncDiffResult } from "@/core/effects/azure-sync.diff";
import { describe, expect, it } from "vitest";

const entities = (count: number, prefix: string) =>
  Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index}`,
    fingerprint: `f${index}`,
  }));

const diff = (counts: {
  create?: number;
  update?: number;
  archive?: number;
  unchanged?: number;
}): AzureSyncDiffResult => ({
  create: entities(counts.create ?? 0, "create"),
  update: entities(counts.update ?? 0, "update"),
  archive: entities(counts.archive ?? 0, "archive"),
  unchanged: entities(counts.unchanged ?? 0, "unchanged"),
});

const policy: AzureApplyPolicy = {
  archiveMissing: false,
  maxApplyOperations: 100,
};

const decide = (overrides?: {
  policy?: Partial<AzureApplyPolicy>;
  nodeDiff?: AzureSyncDiffResult;
  edgeDiff?: AzureSyncDiffResult;
  resourceCount?: number;
  warnings?: ReadonlyArray<string>;
  acknowledgedUntrustedSnapshot?: boolean;
}) =>
  resolveAzureApplyDecision({
    policy: { ...policy, ...overrides?.policy },
    nodeDiff: overrides?.nodeDiff ?? diff({ create: 2, update: 1, unchanged: 5 }),
    edgeDiff: overrides?.edgeDiff ?? diff({ create: 1, unchanged: 3 }),
    resourceCount: overrides?.resourceCount ?? 8,
    warnings: overrides?.warnings ?? [],
    acknowledgedUntrustedSnapshot: overrides?.acknowledgedUntrustedSnapshot ?? false,
  });

describe("resolveAzureApplyDecision", () => {
  it("allows an ordinary additive apply", () => {
    const decision = decide();

    expect(decision.ok).toBe(true);
    expect(decision.plan.totalOperations).toBe(4);
    expect(decision.plan.destructive).toBe(false);
  });

  it("retains what Azure stopped reporting when archiving is off", () => {
    const decision = decide({ nodeDiff: diff({ create: 1, archive: 7 }) });

    expect(decision.ok).toBe(true);
    expect(decision.plan.nodesToArchive).toBe(0);
    expect(decision.plan.nodesRetained).toBe(7);
    expect(decision.plan.destructive).toBe(false);
  });

  it("archives only when the operator turned archiving on, and says so", () => {
    const decision = decide({
      policy: { archiveMissing: true },
      nodeDiff: diff({ create: 1, archive: 7 }),
    });

    expect(decision.plan.nodesToArchive).toBe(7);
    expect(decision.plan.nodesRetained).toBe(0);
    expect(decision.plan.destructive).toBe(true);
    expect(decision.plan.requiresConfirmation).toBe(true);
  });

  it("does not ask for confirmation when nothing is destroyed", () => {
    const decision = decide({ policy: { archiveMissing: true } });

    expect(decision.plan.destructive).toBe(false);
    expect(decision.plan.requiresConfirmation).toBe(false);
  });

  it("blocks a truncated snapshot, because it looks identical to mass deletion", () => {
    const decision = decide({
      warnings: ["Azure Resource Graph paging guardrail reached; results are partial"],
    });

    expect(decision.ok).toBe(false);
    expect(decision.blocked.map((entry) => entry.reason)).toContain("untrusted-snapshot");
  });

  it("blocks a zero-resource snapshot even with no warnings attached", () => {
    const decision = decide({ resourceCount: 0 });

    expect(decision.ok).toBe(false);
    expect(decision.blocked.map((entry) => entry.reason)).toContain("untrusted-snapshot");
  });

  it("lets the operator override an untrusted snapshot deliberately", () => {
    const decision = decide({
      resourceCount: 0,
      acknowledgedUntrustedSnapshot: true,
    });

    expect(decision.ok).toBe(true);
  });

  it("blocks an apply over the operation cap", () => {
    const decision = decide({
      policy: { maxApplyOperations: 3 },
      nodeDiff: diff({ create: 10 }),
    });

    expect(decision.ok).toBe(false);
    expect(decision.blocked.map((entry) => entry.reason)).toContain("operation-limit");
  });

  it("does not let a snapshot acknowledgement wave through an oversized apply", () => {
    // The cap is a standing policy the operator can raise in settings. A
    // per-run acknowledgement about snapshot trust must not double as consent
    // to exceed it.
    const decision = decide({
      policy: { maxApplyOperations: 3 },
      nodeDiff: diff({ create: 10 }),
      resourceCount: 0,
      acknowledgedUntrustedSnapshot: true,
    });

    expect(decision.ok).toBe(false);
    expect(decision.blocked.map((entry) => entry.reason)).toEqual(["operation-limit"]);
  });

  it("counts retained entities as no work, so retention never trips the cap", () => {
    const decision = decide({
      policy: { maxApplyOperations: 3 },
      nodeDiff: diff({ create: 1, archive: 500 }),
      edgeDiff: diff({}),
    });

    expect(decision.ok).toBe(true);
    expect(decision.plan.totalOperations).toBe(1);
  });

  it("explains every block in words an operator can act on", () => {
    const decision = decide({
      policy: { maxApplyOperations: 1 },
      nodeDiff: diff({ create: 10 }),
      resourceCount: 0,
    });

    expect(decision.ok).toBe(false);
    expect(decision.blocked).toHaveLength(2);
    for (const entry of decision.blocked) {
      expect(entry.message.length).toBeGreaterThan(0);
      expect(entry.recommendedAction.length).toBeGreaterThan(0);
    }
  });
});
