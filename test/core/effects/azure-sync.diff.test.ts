/**
 * The Azure sync diff.
 *
 * This module decides what an apply will create, change, and remove, and it had
 * no tests. The `archive` set is the dangerous one: today every entry in it is
 * hard-deleted from the board and from SQLite, so a bug here is data loss
 * rather than a wrong number on a panel.
 */

import { diffAzureSyncEntities } from "@/core/effects/azure-sync.diff";
import { describe, expect, it } from "vitest";

const entity = (id: string, fingerprint: string) => ({ id, fingerprint });

const ids = (entities: ReadonlyArray<{ id: string }>) => entities.map((each) => each.id).sort();

describe("diffAzureSyncEntities", () => {
  it("creates entities that are new to the board", () => {
    const result = diffAzureSyncEntities([], [entity("a", "f1")]);

    expect(ids(result.create)).toEqual(["a"]);
    expect(result.update).toEqual([]);
    expect(result.archive).toEqual([]);
  });

  it("reports a matching fingerprint as unchanged, not as an update", () => {
    const result = diffAzureSyncEntities([entity("a", "f1")], [entity("a", "f1")]);

    expect(ids(result.unchanged)).toEqual(["a"]);
    expect(result.update).toEqual([]);
  });

  it("updates an entity whose fingerprint moved", () => {
    const result = diffAzureSyncEntities([entity("a", "f1")], [entity("a", "f2")]);

    expect(ids(result.update)).toEqual(["a"]);
    expect(result.unchanged).toEqual([]);
  });

  it("archives what the board has and Azure no longer reports", () => {
    const result = diffAzureSyncEntities([entity("a", "f1"), entity("b", "f2")], [entity("a", "f1")]);

    expect(ids(result.archive)).toEqual(["b"]);
  });

  it("archives everything when the incoming snapshot is empty", () => {
    // This is the shape of a scope typo, a zero-result query, and a truncated
    // page. The diff cannot tell them apart from a genuinely emptied
    // subscription, which is why the caller must not act on it unguarded.
    const result = diffAzureSyncEntities([entity("a", "f1"), entity("b", "f2")], []);

    expect(ids(result.archive)).toEqual(["a", "b"]);
    expect(result.create).toEqual([]);
  });

  it("puts every entity in exactly one bucket", () => {
    const existing = [entity("keep", "f1"), entity("change", "f1"), entity("gone", "f1")];
    const incoming = [entity("keep", "f1"), entity("change", "f2"), entity("new", "f1")];

    const result = diffAzureSyncEntities(existing, incoming);
    const everything = [
      ...ids(result.create),
      ...ids(result.update),
      ...ids(result.archive),
      ...ids(result.unchanged),
    ];

    expect(everything.sort()).toEqual(["change", "gone", "keep", "new"]);
    expect(new Set(everything).size).toBe(everything.length);
  });

  it("does not care what order entities arrive in", () => {
    const existing = [entity("a", "f1"), entity("b", "f2")];
    const incoming = [entity("b", "f2"), entity("a", "f9")];

    const forward = diffAzureSyncEntities(existing, incoming);
    const reversed = diffAzureSyncEntities([...existing].reverse(), [...incoming].reverse());

    expect(ids(forward.update)).toEqual(ids(reversed.update));
    expect(ids(forward.unchanged)).toEqual(ids(reversed.unchanged));
    expect(ids(forward.archive)).toEqual(ids(reversed.archive));
  });
});
