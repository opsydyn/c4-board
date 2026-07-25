import {
  buildPosteeAgentContext,
  type PosteeAgentContextInput,
  type PosteeRedactionPolicy,
  summariseGraphqlSchema,
} from "@/core/effects/postee/agent-redaction";
import { describe, expect, it } from "vitest";

/**
 * ADR-012 Phase 2b. Workspace scope — collections and the cached GraphQL schema.
 *
 * Collections are a new leak surface: every saved request carries a URL and header
 * set of its own, so a boundary that only redacts the *active* request would emit
 * credentials for every other one. Same adversarial approach as Phase 1.
 */

const SECRETS = {
  savedUrlToken: "saved-url-token-4f7a21",
  savedHeader: "saved-header-secret-9c03bb",
  schemaEndpointToken: "schema-endpoint-token-771ade",
} as const;

const introspection = JSON.stringify({
  __schema: {
    queryType: { name: "Query" },
    mutationType: { name: "Mutation" },
    types: [
      { kind: "OBJECT", name: "Query", fields: [{ name: "systems" }, { name: "account" }] },
      { kind: "OBJECT", name: "Mutation", fields: [{ name: "createAccount" }] },
      { kind: "OBJECT", name: "Account", fields: [{ name: "id" }] },
      { kind: "OBJECT", name: "__Directive", fields: [{ name: "hidden" }] },
    ],
  },
});

const input = (): PosteeAgentContextInput => ({
  request: { name: "Active", method: "GET", url: "https://api.example.test/x", headers: [], bodyMode: "json", body: null },
  collections: [
    {
      name: "Accounts",
      requests: [
        {
          name: "List accounts",
          method: "GET",
          url: `https://api.example.test/accounts?token=${SECRETS.savedUrlToken}`,
          headers: [{ id: "h1", key: "Authorization", value: `Bearer ${SECRETS.savedHeader}`, enabled: true }],
        },
      ],
    },
  ],
  graphqlSchema: {
    endpointUrl: `https://api.example.test/graphql?key=${SECRETS.schemaEndpointToken}`,
    capturedAt: 1_700_000_000_000,
    introspectionJson: introspection,
  },
});

const policy = (over: Partial<PosteeRedactionPolicy> = {}): PosteeRedactionPolicy => ({
  mode: "strict",
  includeHeaderValues: false,
  includeBodies: false,
  ...over,
});

const assertNoSecrets = (context: unknown) => {
  const serialised = JSON.stringify(context);
  for (const [name, secret] of Object.entries(SECRETS)) {
    expect(serialised, `leaked ${name}`).not.toContain(secret);
  }
};

describe("workspace-scoped Postee agent context", () => {
  it("leaks nothing from saved requests or the schema endpoint", () => {
    assertNoSecrets(buildPosteeAgentContext(input(), policy()));
  });

  it("redacts saved request URLs, not only the active one", () => {
    const context = buildPosteeAgentContext(input(), policy());

    const saved = context.collections[0]?.requests[0];
    expect(saved?.url).toBe("https://api.example.test/accounts");
    expect(saved?.name).toBe("List accounts");
    expect(saved?.method).toBe("GET");
  });

  it("reports saved header names without their values", () => {
    const context = buildPosteeAgentContext(input(), policy());

    // Knowing a request sends Authorization is useful; knowing the token is not.
    expect(context.collections[0]?.requests[0]?.headerKeys).toEqual(["Authorization"]);
  });

  it("keeps saved header values out even when the active request opts in", () => {
    // Opting into the request you are looking at must not opt into every other one.
    const context = buildPosteeAgentContext(input(), policy({ includeHeaderValues: true }));

    expect(JSON.stringify(context.collections)).not.toContain(SECRETS.savedHeader);
  });

  it("redacts the schema endpoint URL", () => {
    const context = buildPosteeAgentContext(input(), policy());

    expect(context.graphqlSchema?.endpointUrl).toBe("https://api.example.test/graphql");
  });

  it("summarises the schema rather than passing introspection through whole", () => {
    const context = buildPosteeAgentContext(input(), policy());

    expect(context.graphqlSchema?.queryFields).toEqual(["account", "systems"]);
    expect(context.graphqlSchema?.mutationFields).toEqual(["createAccount"]);
    expect(context.graphqlSchema?.typeNames).toContain("Account");
    // Raw introspection is enormous and mostly noise for authoring.
    expect(JSON.stringify(context.graphqlSchema)).not.toContain("__schema");
  });

  it("omits GraphQL introspection meta types", () => {
    const context = buildPosteeAgentContext(input(), policy());

    expect(context.graphqlSchema?.typeNames.some((name) => name.startsWith("__"))).toBe(false);
  });

  it("has no collections or schema when none were supplied", () => {
    const context = buildPosteeAgentContext(
      { request: { name: "", method: "GET", url: "", headers: [], bodyMode: "json", body: null } },
      policy(),
    );

    expect(context.collections).toEqual([]);
    expect(context.graphqlSchema).toBeNull();
  });
});

describe("summariseGraphqlSchema", () => {
  it("returns nothing usable for a schema it cannot parse", () => {
    expect(summariseGraphqlSchema("not json")).toBeNull();
    expect(summariseGraphqlSchema("")).toBeNull();
  });

  it("accepts a payload still wrapped in its data envelope", () => {
    const wrapped = JSON.stringify({ data: JSON.parse(introspection) });

    expect(summariseGraphqlSchema(wrapped)?.queryFields).toEqual(["account", "systems"]);
  });

  it("tolerates a schema with no mutations", () => {
    const queryOnly = JSON.stringify({
      __schema: { queryType: { name: "Query" }, types: [{ kind: "OBJECT", name: "Query", fields: [{ name: "ping" }] }] },
    });

    const summary = summariseGraphqlSchema(queryOnly);
    expect(summary?.queryFields).toEqual(["ping"]);
    expect(summary?.mutationFields).toEqual([]);
  });
});
