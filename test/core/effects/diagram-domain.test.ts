import { DIAGRAM_DOMAINS, isDiagramDomain } from "@/core/effects/node-operations";
import { describe, expect, it } from "vitest";

/**
 * ADR-016 Phase 1. The discriminator, widened to admit Event Storming.
 *
 * `domain` was a two-value assumption spread across the machine, persistence,
 * the OPY chat and two SQLite CHECK constraints. Phase 1 widens it and adds no
 * node types, so that the thing everything else keys off is known to hold before
 * anything depends on it.
 */

describe("DIAGRAM_DOMAINS", () => {
  it("lists the three domains", () => {
    expect(DIAGRAM_DOMAINS).toEqual(["c4", "ddd", "eventStorming"]);
  });

  it("matches the values the database will accept", () => {
    // Migration 034 widened both CHECK constraints to exactly these. A value
    // here that SQLite rejects is a runtime failure on save, not a type error.
    expect([...DIAGRAM_DOMAINS].sort()).toEqual(["c4", "ddd", "eventStorming"].sort());
  });
});

describe("isDiagramDomain", () => {
  it("accepts every domain it claims to support", () => {
    for (const domain of DIAGRAM_DOMAINS) {
      expect(isDiagramDomain(domain), `${domain} rejected`).toBe(true);
    }
  });

  it("rejects a value the database would refuse", () => {
    for (const value of ["storm", "eventstorming", "", null, undefined, 3]) {
      expect(isDiagramDomain(value), `${String(value)} accepted`).toBe(false);
    }
  });

  it("is case sensitive, because the CHECK constraint is", () => {
    expect(isDiagramDomain("EventStorming")).toBe(false);
  });
});

describe("the domain has one definition", () => {
  /**
   * It had five. `DiagramDomain`, `OpyChatDomain` and two `NodeDomain`s were
   * separate string unions that happened to agree, so widening one changed
   * nothing and the compiler said nothing. They alias the source now, and this
   * guards against a sixth: the failure is silent, and only shows up as a CHECK
   * constraint violation when someone saves.
   */
  it("is not redeclared anywhere", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");

    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((entry) => {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) return walk(path);
        return /\.tsx?$/.test(entry) ? [path] : [];
      });

    const redeclared = walk("src").filter((file) => {
      const source = readFileSync(file, "utf8");
      // A domain union that is not the canonical one, and not the ambient tone
      // (which includes "azure" and is about colour, not domain).
      return /=\s*"c4"\s*\|\s*"ddd"\s*;/.test(source);
    });

    expect(redeclared, "domain redeclared instead of aliasing node-operations").toEqual([]);
  });
});
