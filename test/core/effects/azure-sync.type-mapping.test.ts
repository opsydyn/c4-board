import { mapAzureSnapshotToC4Graph } from "@/core/effects/azure-sync.mapper";
import type { AzureGraphSnapshot } from "@/core/effects/azure-sync.types";
import { describe, expect, it } from "vitest";

/**
 * ADR-017. What a real subscription actually maps to.
 *
 * The type list below is the set of distinct resource types found in a live
 * subscription the first time Azure sync was exercised end to end. Every one of
 * them mapped to `system`, because `inferC4Type` tested four substring patterns
 * and none of the four appeared in the estate — so the board rendered 20
 * identical boxes.
 *
 * These are the types real subscriptions contain, rather than the ones that
 * happened to be easy to write a branch for, which is why they are the fixture.
 */

const SUBSCRIPTION = "00000000-0000-4000-8000-000000000001";

/** Distinct types observed in the live estate, with the C4 type each should get. */
const OBSERVED: ReadonlyArray<readonly [azureType: string, c4Type: string]> = [
  // Hosting platforms are boundaries that other things run inside.
  ["microsoft.app/managedenvironments", "container"],
  ["microsoft.operationalinsights/workspaces", "container"],
  ["microsoft.storage/storageaccounts", "container"],
  ["microsoft.containerregistry/registries", "container"],
  // Things that run or act.
  ["microsoft.app/containerapps", "component"],
  ["microsoft.network/networkwatchers", "component"],
  ["microsoft.managedidentity/userassignedidentities", "component"],
  // Publicly reachable surface.
  ["microsoft.web/staticsites", "externalSystem"],
  // Top-level platforms.
  ["microsoft.cognitiveservices/accounts", "system"],
];

const resource = (azureType: string, name: string) => ({
  resourceId: `/subscriptions/${SUBSCRIPTION}/resourceGroups/rg-one/providers/${azureType}/${name}`,
  type: azureType,
  name,
  location: "westeurope",
  subscriptionId: SUBSCRIPTION,
  resourceGroup: "rg-one",
  tags: {},
});

const snapshotOf = (types: ReadonlyArray<string>): AzureGraphSnapshot =>
  ({
    collectedAt: 0,
    scope: { subscriptionIds: [SUBSCRIPTION] },
    resources: types.map((azureType, index) => resource(azureType, `res-${index}`)),
    relationships: [],
    warnings: [],
  }) as unknown as AzureGraphSnapshot;

const mappedTypeFor = (azureType: string): string | undefined => {
  const graph = mapAzureSnapshotToC4Graph(snapshotOf([azureType]));
  return graph.nodes.find((node) => node.sourceResourceType === azureType)?.type;
};

describe("C4 type inference over a real estate", () => {
  for (const [azureType, expected] of OBSERVED) {
    it(`maps ${azureType} to ${expected}`, () => {
      expect(mappedTypeFor(azureType)).toBe(expected);
    });
  }

  it("does not collapse a whole subscription into one type", () => {
    // The defect this ADR exists for: nine distinct types, one output type.
    const graph = mapAzureSnapshotToC4Graph(snapshotOf(OBSERVED.map(([type]) => type)));
    const resourceNodes = graph.nodes.filter((node) => node.sourceResourceType);
    const distinct = new Set(resourceNodes.map((node) => node.type));

    expect(distinct.size).toBeGreaterThan(1);
  });
});

describe("types the table does not know", () => {
  /**
   * The fallback has to stay predictable, because the table will always trail
   * Azure's catalogue. A reader should be able to guess what an unmapped
   * resource looks like without reading the code.
   */
  it("treats an unknown top-level type as a system", () => {
    expect(mappedTypeFor("microsoft.invented/widgets")).toBe("system");
  });

  it("treats an unknown child type as a component", () => {
    // A child segment means it lives inside something else.
    expect(mappedTypeFor("microsoft.invented/widgets/parts")).toBe("component");
  });

  it("still emits a node rather than dropping the resource", () => {
    const graph = mapAzureSnapshotToC4Graph(snapshotOf(["microsoft.invented/widgets"]));

    expect(graph.nodes.some((node) => node.sourceResourceType === "microsoft.invented/widgets"))
      .toBe(true);
  });
});

describe("near-miss type names", () => {
  it("does not treat staticsites as sites", () => {
    // The original substring test read `microsoft.web/sites`, which does not
    // appear in `microsoft.web/staticsites` — a near match that silently missed.
    expect(mappedTypeFor("microsoft.web/staticsites"))
      .not.toBe(mappedTypeFor("microsoft.web/sites"));
  });

  it("still maps web sites to a component", () => {
    expect(mappedTypeFor("microsoft.web/sites")).toBe("component");
  });

  it("keeps the mappings ADR-007 already relied on", () => {
    expect(mappedTypeFor("microsoft.network/virtualnetworks")).toBe("container");
    expect(mappedTypeFor("microsoft.compute/virtualmachines")).toBe("container");
    expect(mappedTypeFor("microsoft.containerservice/managedclusters")).toBe("system");
  });
});
