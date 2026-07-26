import { exportC4ToMermaidC4 } from "@/core/effects/export-mermaid-c4";
import type { C4Type } from "@/core/effects/node-operations";
import type { Edge, Node } from "@xyflow/react";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

/**
 * ADR-014 Phase 1. The C4 dialect, as opposed to the flowchart one.
 *
 * The flowchart export encodes a C4 type as a *shape* — a container becomes a
 * cylinder, which reads as a datastore — and concatenates technology and
 * description into one HTML label. Mermaid C4 has argument slots for exactly
 * those fields, so the point of this emitter is that the semantics survive the
 * export instead of living only in this codebase.
 *
 * Mermaid's element signatures are not uniform, and that asymmetry is the thing
 * most likely to be got wrong:
 *
 *   Person(alias, label, ?descr)
 *   System(alias, label, ?descr)
 *   Container(alias, label, ?techn, ?descr)
 *   Component(alias, label, ?techn, ?descr)
 *   Rel(from, to, label, ?techn)
 *
 * Person and System have no `techn` slot at all.
 */

const node = (
  id: string,
  c4Type: C4Type,
  over: { label?: string; technology?: string; description?: string } = {},
): Node => ({
  id,
  position: { x: 0, y: 0 },
  data: {
    label: over.label ?? id,
    description: over.description ?? "",
    technology: over.technology ?? "",
    c4Type,
  },
});

const run = (nodes: Node[], edges: Edge[] = []) => Effect.runSync(exportC4ToMermaidC4(nodes, edges));

describe("element mapping", () => {
  it("maps each C4 type to its Mermaid element", () => {
    const out = run([
      node("p", "person", { label: "Operator" }),
      node("s", "system", { label: "Board" }),
      node("x", "externalSystem", { label: "Identity Provider" }),
      node("c", "container", { label: "Payments API" }),
      node("m", "component", { label: "Ledger" }),
    ]);

    expect(out).toContain("Person(operator, \"Operator\"");
    expect(out).toContain("System(board, \"Board\"");
    expect(out).toContain("System_Ext(identity_provider, \"Identity Provider\"");
    expect(out).toContain("Container(payments_api, \"Payments API\"");
    expect(out).toContain("Component(ledger, \"Ledger\"");
  });

  it("puts technology and description in their own arguments, not the label", () => {
    const out = run([
      node("c", "container", {
        label: "Payments API",
        technology: "Rust + Axum",
        description: "Settles transactions",
      }),
    ]);

    expect(out).toContain(
      "Container(payments_api, \"Payments API\", \"Rust + Axum\", \"Settles transactions\")",
    );
    // The flowchart dialect's way of carrying these must not leak in.
    expect(out).not.toContain("<br/>");
    expect(out).not.toContain("<em>");
  });

  it("keeps a person's technology rather than dropping it on the floor", () => {
    // Person has no techn slot. Silently discarding a field the user filled in is
    // worse than folding it into the description, so it is folded.
    const out = run([
      node("p", "person", { label: "Operator", technology: "Browser", description: "Runs the board" }),
    ]);

    expect(out).toContain("Browser");
    expect(out).toContain("Runs the board");
    expect(out).toMatch(/Person\(operator, "Operator", "[^"]*"\)/);
  });

  it("omits absent optional arguments rather than emitting empty strings", () => {
    const out = run([node("s", "system", { label: "Board" })]);

    expect(out).toContain("System(board, \"Board\")");
    expect(out).not.toContain("\"\"");
  });
});

describe("diagram type", () => {
  it("uses C4Component when any component is present", () => {
    const out = run([node("c", "container"), node("m", "component"), node("s", "system")]);

    expect(out.split("\n").find((line) => line.startsWith("C4"))).toBe("C4Component");
  });

  it("uses C4Container when containers are the most specific element", () => {
    const out = run([node("c", "container"), node("s", "system")]);

    expect(out.split("\n").find((line) => line.startsWith("C4"))).toBe("C4Container");
  });

  it("falls back to C4Context for people and systems alone", () => {
    const out = run([node("p", "person"), node("s", "system")]);

    expect(out.split("\n").find((line) => line.startsWith("C4"))).toBe("C4Context");
  });
});

describe("relationships", () => {
  it("emits Rel between two C4 elements", () => {
    const out = run(
      [node("p", "person"), node("s", "system")],
      [{ id: "e1", source: "p", target: "s", label: "settles via" }],
    );

    expect(out).toContain("Rel(p, s, \"settles via\")");
  });

  it("carries the protocol as the relationship technology", () => {
    const out = run(
      [node("p", "person"), node("s", "system")],
      [{
        id: "e1",
        source: "p",
        target: "s",
        label: "settles via",
        data: { metadata: { protocol: "https" } },
      }],
    );

    expect(out).toContain("Rel(p, s, \"settles via\", \"https\")");
  });

  it("labels an unlabelled relationship rather than emitting an empty one", () => {
    const out = run(
      [node("p", "person"), node("s", "system")],
      [{ id: "e1", source: "p", target: "s" }],
    );

    expect(out).toContain("Rel(p, s, \"uses\")");
  });

  it("drops a relationship whose endpoints are not both C4 elements", () => {
    const out = run(
      [node("p", "person")],
      [{ id: "e1", source: "p", target: "missing", label: "x" }],
    );

    expect(out).not.toContain("Rel(");
  });
});

describe("escaping and identifiers", () => {
  it("does not let a quote in a label break the macro", () => {
    const out = run([node("s", "system", { label: "The \"Big\" Board" })]);

    expect(out).toContain("System(the_big_board,");
    // One opening and one closing quote for the argument, and nothing in between
    // that would terminate it early.
    expect(out).toMatch(/System\(the_big_board, "[^"]*"\)/);
    expect(out).toContain("Big");
  });

  it("flattens newlines, which would otherwise split the statement", () => {
    const out = run([node("s", "system", { description: "line one\nline two" })]);

    const statement = out.split("\n").find((line) => line.includes("System(s,")) ?? "";
    expect(statement).toContain("line one");
    expect(statement).toContain("line two");
  });

  it("names elements after their label, since the point of this dialect is reading it", () => {
    // Node ids are nanoids. `Person(person_2APJt5Nbv87k, "Operator")` is valid and
    // unreadable, which defeats a format meant for sharing.
    const out = run([node("person_2APJt5Nbv87k", "container", { label: "Payments API" })]);

    expect(out).toContain("Container(payments_api, \"Payments API\")");
  });

  it("keeps aliases unique when two elements share a label", () => {
    const out = run([
      node("a", "system", { label: "Gateway" }),
      node("b", "system", { label: "Gateway" }),
    ]);

    expect(out).toContain("System(gateway,");
    expect(out).toContain("System(gateway_2,");
  });

  it("falls back to the id when a label yields no usable alias", () => {
    const out = run([node("node-with-dashes", "system", { label: "!!!" })]);

    expect(out).toContain("System(node_with_dashes,");
  });

  it("uses the same aliases in relationships as in elements", () => {
    const out = run(
      [node("id1", "person", { label: "Operator" }), node("id2", "container", { label: "Payments API" })],
      [{ id: "e1", source: "id1", target: "id2", label: "settles via" }],
    );

    expect(out).toContain("Person(operator,");
    expect(out).toContain("Container(payments_api,");
    expect(out).toContain("Rel(operator, payments_api, \"settles via\")");
  });
});

describe("the whole document", () => {
  it("declares the diagram type on the first line", () => {
    // Mermaid documents comments only within the diagram body, and says nothing
    // about whether they may precede the type declaration. Leading with the type
    // removes any question about detection.
    expect(run([node("s", "system")]).split("\n")[0]).toBe("C4Context");
  });

  it("says that layout is not preserved, because Mermaid C4 has none", () => {
    // Not decoration: someone exporting this as a backup would otherwise expect
    // their board to come back the way they left it.
    expect(run([node("s", "system")])).toMatch(/layout is not preserved/i);
  });

  it("emits a valid empty diagram for a board with no C4 nodes", () => {
    const out = run([]);

    expect(out).toContain("C4Context");
    expect(out).not.toContain("undefined");
  });

  it("ignores nodes that are not C4 elements", () => {
    const ddd = { id: "d", position: { x: 0, y: 0 }, data: { label: "Domain", dddType: "domain" } };

    expect(run([ddd as unknown as Node, node("s", "system")])).not.toContain("Domain");
  });

  it("accepts a title", () => {
    expect(Effect.runSync(exportC4ToMermaidC4([node("s", "system")], [], { title: "Payments" })))
      .toContain("title Payments");
  });
});
