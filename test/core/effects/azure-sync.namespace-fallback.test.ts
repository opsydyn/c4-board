import { mapAzureSnapshotToC4Graph } from "@/core/effects/azure-sync.mapper";
import type { AzureGraphSnapshot } from "@/core/effects/azure-sync.types";
import { describe, expect, it } from "vitest";

/**
 * ADR-017, second tier. Coverage the exact table cannot reach.
 *
 * `az provider list` reports 4,654 distinct resource types across 316 registered
 * providers. The exact lookup table added in the first pass holds 19 of them —
 * 0.4%. Everything else fell to a depth heuristic that answers `system` for any
 * top-level type, so a SQL server, a Key Vault and a Redis cache all rendered as
 * systems.
 *
 * An exact table can never be the primary mechanism at that ratio. The provider
 * namespace carries most of the signal — a resource under `microsoft.storage` or
 * `microsoft.keyvault` is a store whatever its leaf name is — so the namespace
 * becomes the second tier, consulted after the exact table and before depth.
 *
 * The type strings below were read from `az provider list` rather than invented,
 * because a plausible-looking type that does not exist tests nothing. The
 * `microsoft.web/sites` near-miss in the first pass is what that mistake costs.
 */

const SUBSCRIPTION = "00000000-0000-4000-8000-000000000001";

const snapshotOf = (azureType: string): AzureGraphSnapshot =>
  ({
    collectedAt: 0,
    scope: { subscriptionIds: [SUBSCRIPTION] },
    resources: [{
      resourceId: `/subscriptions/${SUBSCRIPTION}/resourceGroups/rg/providers/${azureType}/thing`,
      type: azureType,
      name: "thing",
      location: "westeurope",
      subscriptionId: SUBSCRIPTION,
      resourceGroup: "rg",
      tags: {},
    }],
    relationships: [],
    warnings: [],
  }) as unknown as AzureGraphSnapshot;

const mappedTypeFor = (azureType: string): string | undefined =>
  mapAzureSnapshotToC4Graph(snapshotOf(azureType))
    .nodes.find((node) => node.sourceResourceType === azureType)?.type;

/** Real types, none of them in the exact table. */
const STORES: ReadonlyArray<string> = [
  "microsoft.sql/servers",
  "microsoft.keyvault/vaults",
  "microsoft.documentdb/databaseaccounts",
  "microsoft.cache/redis",
  "microsoft.eventhub/namespaces",
  "microsoft.servicebus/namespaces",
];

describe("provider namespace as the second tier", () => {
  for (const azureType of STORES) {
    it(`treats ${azureType} as a store rather than a system`, () => {
      expect(mappedTypeFor(azureType)).toBe("container");
    });
  }

  it("treats an API Management service as a platform", () => {
    expect(mappedTypeFor("microsoft.apimanagement/service")).toBe("system");
  });

  it("treats unlisted network resources as components", () => {
    // A public IP or load balancer acts; it is not a boundary. The vnet override
    // in the exact table still wins over this namespace default.
    expect(mappedTypeFor("microsoft.network/publicipaddresses")).toBe("component");
    expect(mappedTypeFor("microsoft.network/loadbalancers")).toBe("component");
  });
});

describe("tier precedence", () => {
  it("lets the exact table beat its own namespace default", () => {
    // microsoft.network defaults to component, but a vnet is a boundary.
    expect(mappedTypeFor("microsoft.network/virtualnetworks")).toBe("container");
    // microsoft.web defaults to component, but a static site faces outward.
    expect(mappedTypeFor("microsoft.web/staticsites")).toBe("externalSystem");
  });

  it("falls back to depth only for namespaces it has no opinion on", () => {
    expect(mappedTypeFor("microsoft.invented/widgets")).toBe("system");
    expect(mappedTypeFor("microsoft.invented/widgets/parts")).toBe("component");
  });

  it("applies the namespace default to child types too", () => {
    // A SQL database is inside a server, but it is still a store — the namespace
    // rule should outrank the "child means component" heuristic.
    expect(mappedTypeFor("microsoft.sql/servers/databases")).toBe("container");
  });
});

describe("coverage is materially better than the exact table alone", () => {
  it("classifies these real types as something other than system", () => {
    const notSystem = STORES.filter((azureType) => mappedTypeFor(azureType) !== "system");

    expect(notSystem).toHaveLength(STORES.length);
  });
});
