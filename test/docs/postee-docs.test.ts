import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The Postee guide describes behaviour that lives in Rust, and the two can drift
 * apart silently — a stale doc reads exactly like a current one.
 *
 * Two claims are worth binding to the code rather than trusting. The load test's
 * defaults, because someone changing `default_concurrency` has no reason to think
 * about a markdown file. And the warning that a run cannot be cancelled, because
 * that one is load-bearing: it is why the guide tells you to start short. If a
 * stop command is ever added, that warning becomes wrong in the direction that
 * makes the tool look more dangerous than it is, and this test says so.
 */

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

const guide = () => read("docs/src/content/docs/guides/postee.md");
const loadTestConfig = () => read("src-tauri/src/load_test/config.rs");
const commands = () => read("src-tauri/src/lib.rs");

describe("the load test guide matches the engine", () => {
  /** Reads a `fn default_x() -> T { N }` literal out of the Rust source. */
  const defaultOf = (fnName: string): string => {
    const match = loadTestConfig().match(
      new RegExp(`fn ${fnName}\\(\\)[^{]*\\{\\s*([0-9]+)`),
    );
    expect(match?.[1], `${fnName} is not a plain numeric default any more`).toBeDefined();
    return match![1]!;
  };

  it("documents the real default duration", () => {
    expect(guide()).toContain(`\`${defaultOf("default_duration_secs")}\``);
  });

  it("documents the real default concurrency", () => {
    expect(guide()).toContain(`\`${defaultOf("default_concurrency")}\``);
  });

  it("documents the real default timeout", () => {
    expect(guide()).toContain(`\`${defaultOf("default_timeout_ms")}\``);
  });
});

describe("the cancellation warning tracks reality", () => {
  const CANCEL_COMMAND = /stop_load_test|cancel_load_test|abort_load_test/;

  it("warns that a run cannot be cancelled, for exactly as long as that is true", () => {
    const cancellable = CANCEL_COMMAND.test(commands());

    if (cancellable) {
      expect(
        guide(),
        "a stop command exists now — the guide still says a run cannot be cancelled",
      ).not.toMatch(/cannot be cancelled/i);
      return;
    }

    expect(
      guide(),
      "no stop command exists — the guide must warn before someone starts an hour-long run",
    ).toMatch(/cannot be cancelled/i);
  });
});

describe("the credential boundary is stated where users will read it", () => {
  /**
   * ADR-012's redaction rules are the most surprising thing about Postee: values
   * you entered are deliberately not shown back to you. Undocumented, that reads
   * as a bug and invites someone to "fix" it.
   */
  it("says environment variable values do not leave the process", () => {
    expect(guide()).toMatch(/environment variable values never leave the process/i);
  });

  it("says header values are withheld by default", () => {
    expect(guide()).toMatch(/header values are withheld/i);
  });

  it("points at the ADR that decided it", () => {
    expect(guide()).toContain("012-opy-in-postee.md");
  });
});
