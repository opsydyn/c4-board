import {
  appendLayoutAudit,
  clearLayoutAudits,
  deleteLayoutAudit,
  getLayoutAudits,
  LAYOUT_AUDIT_RETENTION_LIMIT,
} from "@/core/effects/canvas-persistence";
import { DatabaseService } from "@/core/effects/database.base";
import type { LayoutApplicationAudit } from "@/core/effects/layout.types";
import { Effect, Layer } from "effect";
import { describe, expect, it, vi } from "vitest";

const audit = (appliedAt: number): LayoutApplicationAudit => ({
  version: 1,
  appliedAt,
  preset: "elkLayered",
  strategyId: "elk-layered",
  engine: "elk",
  selectedVariant: "recommended",
  comparisonMetrics: [],
});

const run = <A, E>(
  effect: Effect.Effect<A, E, DatabaseService>,
  service: typeof DatabaseService.Service,
) => Effect.runPromise(effect.pipe(Effect.provide(Layer.succeed(DatabaseService, service))));

describe("layout audit persistence", () => {
  it("appends a diagram-owned immutable audit", async () => {
    const execute = vi.fn(() => Effect.void);
    const service: typeof DatabaseService.Service = {
      execute,
      query: () => Effect.succeed([]),
      transaction: (effect) => effect,
    };

    await run(appendLayoutAudit("diagram-empty", audit(123)), service);

    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT OR IGNORE INTO layout_audits"),
      ["diagram-empty:123", "diagram-empty", 1, 123, JSON.stringify(audit(123))],
    );
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM layout_audits"),
      ["diagram-empty", "diagram-empty", LAYOUT_AUDIT_RETENTION_LIMIT],
    );
    expect(execute.mock.invocationCallOrder[0]).toBeLessThan(execute.mock.invocationCallOrder[1]!);
  });

  it("uses a bounded per-diagram retention policy", () => {
    expect(LAYOUT_AUDIT_RETENTION_LIMIT).toBe(100);
  });

  it("deletes one audit only within its diagram", async () => {
    const execute = vi.fn(() => Effect.void);
    const service: typeof DatabaseService.Service = {
      execute,
      query: () => Effect.succeed([]),
      transaction: (effect) => effect,
    };

    await run(deleteLayoutAudit("diagram-a", 123), service);

    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM layout_audits"),
      ["diagram-a", 123],
    );
  });

  it("clears audit history only within its diagram", async () => {
    const execute = vi.fn(() => Effect.void);
    const service: typeof DatabaseService.Service = {
      execute,
      query: () => Effect.succeed([]),
      transaction: (effect) => effect,
    };

    await run(clearLayoutAudits("diagram-a"), service);

    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM layout_audits WHERE diagram_id = ?"),
      ["diagram-a"],
    );
  });

  it("loads newest-first history and ignores malformed rows", async () => {
    const rows = [
      { audit_json: JSON.stringify(audit(300)) },
      { audit_json: "not-json" },
      { audit_json: JSON.stringify({ version: 99, appliedAt: 200 }) },
      { audit_json: JSON.stringify(audit(100)) },
    ];
    const query = vi.fn();
    const service: typeof DatabaseService.Service = {
      execute: () => Effect.void,
      query: <T>(sql: string, bindValues?: unknown[]) => {
        query(sql, bindValues);
        return Effect.succeed(rows as T[]);
      },
      transaction: (effect) => effect,
    };

    const result = await run(getLayoutAudits("diagram-empty"), service);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("ORDER BY applied_at DESC"),
      ["diagram-empty"],
    );
    expect(result.map(({ appliedAt }) => appliedAt)).toEqual([300, 100]);
  });
});
