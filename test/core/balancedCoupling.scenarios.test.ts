import { buildBalancedCouplingModel } from "@/core/balancedCoupling";
import { describe, expect, it } from "vitest";
import { teamTopologyScenarios } from "../../tests/fixtures/teamTopologyScenarios";

const getScenario = (
  id: (typeof teamTopologyScenarios)[number]["id"],
) => {
  const scenario = teamTopologyScenarios.find((item) => item.id === id);
  expect(scenario).toBeDefined();
  if (!scenario) {
    throw new Error(`Missing fixture scenario: ${id}`);
  }
  return scenario;
};

describe("balancedCoupling scenario fixtures", () => {
  it("mono-team fixture avoids organizational penalties", () => {
    const scenario = getScenario("mono-team");
    const model = buildBalancedCouplingModel(scenario.nodes, scenario.edges, {
      version: "v2",
    });

    const hasOrganizationalContributor = model.snapshots.some((snapshot) =>
      (snapshot.contributors ?? []).some((contributor) => contributor.id === "organizational"));

    expect(model.snapshots.length).toBeGreaterThan(0);
    expect(hasOrganizationalContributor).toBe(false);
  });

  it("multi-team fixture surfaces organizational pressure", () => {
    const scenario = getScenario("multi-team");
    const model = buildBalancedCouplingModel(scenario.nodes, scenario.edges, {
      version: "v2",
    });

    const organizationalContributors = model.snapshots.flatMap((snapshot) =>
      (snapshot.contributors ?? []).filter((contributor) => contributor.id === "organizational"));

    expect(model.snapshots.length).toBeGreaterThan(0);
    expect(organizationalContributors.length).toBeGreaterThan(0);
    expect(
      organizationalContributors.some((contributor) => contributor.volatility > 0),
    ).toBe(true);
  });

  it("unknown-ownership fixture raises unknown-team organizational volatility", () => {
    const scenario = getScenario("unknown-ownership");
    const model = buildBalancedCouplingModel(scenario.nodes, scenario.edges, {
      version: "v2",
    });

    const unknownNodeSnapshot = model.snapshots.find((snapshot) =>
      snapshot.id === "unknown-service-a");
    expect(unknownNodeSnapshot).toBeDefined();
    if (!unknownNodeSnapshot) {
      return;
    }

    const organizational = (unknownNodeSnapshot.contributors ?? []).find(
      (contributor) => contributor.id === "organizational",
    );
    expect(organizational).toBeDefined();
    expect(organizational?.volatility ?? 0).toBeGreaterThan(0);
  });
});

