import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The Azure docs were written by pasting real `az` output into markdown. That was
 * fine while the repo was private; it is not now. `azure-credentials-reference.md`
 * carried a live subscription id, tenant id, tenant domain and a personal email
 * address, and `azure-graph-sample-data.md` carried 492 lines of one tenant's
 * actual resource inventory.
 *
 * None of it is an access-granting secret, which is exactly why it is easy to
 * leave in place. They are still account identifiers in a public repository, and
 * a page titled "Credentials Reference" is an invitation to add something worse.
 *
 * This guards the shape rather than the specific values — writing the leaked ids
 * into an assertion would just republish them here.
 */

const GUIDES = "docs/src/content/docs/guides";

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

const azureGuides = (): string[] => readdirSync(join(process.cwd(), GUIDES)).filter((name) => name.startsWith("azure"));

/** Any 8-4-4-4-12 hex run. Subscription ids, tenant ids and resource ids all match. */
const GUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;

describe("the Azure docs carry no real account identity", () => {
  it("has Azure guides to check", () => {
    expect(azureGuides().length).toBeGreaterThan(0);
  });

  for (const name of azureGuides()) {
    it(`${name} contains no GUID`, () => {
      const match = read(`${GUIDES}/${name}`).match(GUID);
      expect(match?.[0] ?? null, `${name} still contains a real-looking id`).toBeNull();
    });

    it(`${name} contains no email address`, () => {
      const match = read(`${GUIDES}/${name}`).match(EMAIL);
      expect(match?.[0] ?? null, `${name} still contains an address`).toBeNull();
    });
  }
});

describe("the Azure capability is documented as something you can run", () => {
  /**
   * The feature shells out to the Azure CLI (src-tauri/src/azure_sync.rs), so a
   * reader needs the CLI, a login, and the resource-graph extension before the
   * panel does anything. None of that was written down — the README described the
   * capability and linked a roadmap.
   */
  const guide = () => read(`${GUIDES}/azure-sync.md`);

  it("states the Azure CLI login step", () => {
    expect(guide()).toMatch(/az login/);
  });

  it("tells a reader the resource-graph extension is no longer needed", () => {
    // It was required while queries ran through `az graph query`. Since ADR-018
    // Phase 1 they go straight to the REST API, and someone arriving from the
    // old instructions needs to be told that rather than left to wonder.
    const text = guide();

    expect(text).toMatch(/no longer|not required|unused/i);
    expect(text).toMatch(/REST API/i);
    // The install command must not read as a live instruction any more.
    expect(text).not.toMatch(/^\s*az extension add[^\n]*resource-graph\s*$/m);
  });

  it("says how to find your own subscription id, since the panel needs one", () => {
    expect(guide()).toMatch(/az account (show|list)/);
  });

  it("documents the pagination environment variables", () => {
    expect(guide()).toContain("OPSYDYN_AZURE_GRAPH_PAGE_SIZE");
    expect(guide()).toContain("OPSYDYN_AZURE_GRAPH_MAX_PAGES");
  });
});

describe("the README points at it", () => {
  it("lists the Azure CLI as a prerequisite for the Azure panel", () => {
    expect(read("README.md")).toMatch(/Azure CLI/);
  });

  it("links the guide rather than only the roadmap", () => {
    expect(read("README.md")).toMatch(/guides\/azure-sync\.md/);
  });
});
