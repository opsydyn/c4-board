import {
  DEFAULT_MERMAID_DIALECT,
  exportMermaidForDialect,
  MERMAID_DIALECTS,
} from "@/core/effects/export-mermaid-dialect";
import type { C4Type } from "@/core/effects/node-operations";
import type { Edge, Node } from "@xyflow/react";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

/**
 * ADR-014 Phase 2. Which Mermaid dialect an export produces.
 *
 * The two are not better and worse versions of each other. Flowchart is the
 * lossless one — `import-mermaid.ts` reads back the `@pos` comments it emits — and
 * C4 is the readable one, which cannot round-trip because Mermaid C4 has no layout
 * algorithm. Picking the wrong default would quietly break the import path, so the
 * default is pinned here rather than left to the call site.
 */

const node = (id: string, c4Type: C4Type): Node => ({
  id,
  position: { x: 320, y: 180 },
  width: 220,
  height: 120,
  data: { label: id, description: "", technology: "", c4Type },
});

const nodes = [node("api", "container"), node("user", "person")];
const edges: Edge[] = [{ id: "e1", source: "user", target: "api", label: "uses" }];

const run = (dialect: (typeof MERMAID_DIALECTS)[number]["id"]) =>
  Effect.runSync(exportMermaidForDialect(dialect, nodes, edges, {}));

describe("exportMermaidForDialect", () => {
  it("defaults to the dialect that can be imported back", () => {
    // Anyone exporting today gets what they get now.
    expect(DEFAULT_MERMAID_DIALECT).toBe("flowchart");
  });

  it("emits a flowchart for the flowchart dialect", () => {
    expect(run("flowchart")).toContain("flowchart TB");
  });

  it("emits a C4 diagram for the c4 dialect", () => {
    expect(run("c4").split("\n")[0]).toBe("C4Container");
  });

  it("keeps the round-trip metadata only in the dialect that round-trips", () => {
    expect(run("flowchart")).toContain("@pos(");
    // Emitting positions here would read as a guarantee C4 cannot honour.
    expect(run("c4")).not.toContain("@pos(");
  });

  it("passes the title through to either dialect", () => {
    for (const dialect of ["flowchart", "c4"] as const) {
      expect(
        Effect.runSync(exportMermaidForDialect(dialect, nodes, edges, { title: "Payments" })),
        `${dialect} dropped the title`,
      ).toContain("Payments");
    }
  });
});

describe("MERMAID_DIALECTS", () => {
  it("offers exactly the two dialects, flowchart first", () => {
    expect(MERMAID_DIALECTS.map((dialect) => dialect.id)).toEqual(["flowchart", "c4"]);
  });

  it("marks C4 experimental, because Mermaid does", () => {
    // Mermaid's own docs: "the syntax and properties can change in future
    // releases". A user pasting this into a doc should know that.
    const c4 = MERMAID_DIALECTS.find((dialect) => dialect.id === "c4");

    expect(c4?.isExperimental).toBe(true);
    expect(MERMAID_DIALECTS.find((dialect) => dialect.id === "flowchart")?.isExperimental)
      .toBe(false);
  });

  it("says what each dialect is for, not just what it is called", () => {
    for (const dialect of MERMAID_DIALECTS) {
      expect(dialect.label.length, `${dialect.id} has no label`).toBeGreaterThan(0);
      expect(dialect.hint.length, `${dialect.id} has no hint`).toBeGreaterThan(0);
    }

    expect(MERMAID_DIALECTS.find((dialect) => dialect.id === "flowchart")?.hint)
      .toMatch(/re-?import|round-?trip/i);
  });
});
