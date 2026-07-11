import { createNode, DatabaseService } from "@/core/effects/database";
import { Effect, Layer } from "effect";
import { describe, expect, it, vi } from "vitest";

describe("C4 node persistence", () => {
  it("keeps node INSERT columns and values aligned with semantic roles", async () => {
    const execute = vi.fn((_sql: string, _values?: unknown[]) => Effect.void);
    const service: typeof DatabaseService.Service = {
      execute,
      query: () => Effect.succeed([]),
      transaction: (effect) => effect,
    };

    const result = await Effect.runPromise(
      createNode({
        id: "node-role",
        diagram_id: "diagram-1",
        domain: "c4",
        type: "component",
        label: "Domain core",
        position_x: 10,
        position_y: 20,
        semantic_role: "core",
      }).pipe(Effect.provide(Layer.succeed(DatabaseService, service))),
    );

    const [sql, values = []] = execute.mock.calls[0]!;
    expect(sql.match(/\?/g)).toHaveLength(values.length);
    expect(sql).toContain("semantic_role");
    expect(values).toContain("core");
    expect(result.semantic_role).toBe("core");
  });
});
