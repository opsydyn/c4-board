import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The ADR index has to agree with the ADRs.
 *
 * Nine ADRs read "Proposed" while at least five had shipped — Azure sync had
 * been exercised against a live subscription, settings were in daily use, the
 * mud threshold was a validated setting with a default. Asked what was left to
 * build, the index was the natural place to look and it answered wrongly.
 *
 * That is the same defect as a stale sample-data doc: a record that disagrees
 * with the code, stated confidently. The index is worse, because its entire job
 * is to be the answer to that question.
 *
 * These compare the row to the ADR's own Status line rather than judging whether
 * an ADR is "really" done. Keeping two statements of the same fact in step is
 * something a test can do; deciding the fact is not.
 */

const ADR_DIR = "docs/src/content/docs/architecture/adr";

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

/** Every numbered ADR file, by its number. */
const adrFiles = (): ReadonlyArray<{ number: string; file: string }> =>
  readdirSync(join(process.cwd(), ADR_DIR))
    // 000 is the template; its "status" is the literal menu of allowed values.
    .filter((name) => /^\d{3}-.*\.md$/.test(name) && !name.startsWith("000-"))
    .map((file) => ({ number: file.slice(0, 3), file }))
    .sort((left, right) => left.number.localeCompare(right.number));

/** The `**Status**: X` line inside an ADR. */
const statusOf = (file: string): string => {
  // Both `**Status**: X` and `- **Status:** X` appear in the corpus. The point of
  // this file is that the two records agree, not that they agree on punctuation.
  const match = read(`${ADR_DIR}/${file}`).match(/^[-*]?\s*\*\*Status:?\*\*:?\s*(.+)$/m);
  expect(match, `${file} has no Status line`).not.toBeNull();
  return (match?.[1] ?? "").trim();
};

/** The status column of an ADR's row in the index table. */
const indexStatusOf = (number: string): string | null => {
  const row = read(`${ADR_DIR}/index.md`)
    .split("\n")
    .find((line) => line.includes(`[ADR-${number}]`));
  if (row === undefined) return null;

  const cells = row.split("|").map((cell) => cell.trim());
  // | link | title | status | date |
  return cells[3] ?? null;
};

describe("every ADR is listed in the index", () => {
  for (const { number, file } of adrFiles()) {
    it(`lists ADR-${number}`, () => {
      expect(indexStatusOf(number), `${file} is missing from the index`).not.toBeNull();
    });
  }
});

describe("the index status matches the ADR's own status", () => {
  for (const { number, file } of adrFiles()) {
    it(`agrees about ADR-${number}`, () => {
      const inFile = statusOf(file);
      const inIndex = indexStatusOf(number);

      // A qualified status ("Accepted (phases 1-4)") is fine; the index carries
      // the first word, the ADR carries the detail.
      expect(inIndex, `index says "${inIndex}", ${file} says "${inFile}"`)
        .toBe(inFile.split("(")[0]?.trim());
    });
  }
});

describe("statuses are ones the process defines", () => {
  const ALLOWED = ["Proposed", "Accepted", "Superseded", "Deprecated"];

  for (const { number, file } of adrFiles()) {
    it(`ADR-${number} uses a defined status`, () => {
      expect(ALLOWED).toContain(statusOf(file).split("(")[0]?.trim());
    });
  }
});
