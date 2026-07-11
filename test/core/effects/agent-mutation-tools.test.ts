import {
  createRigValidatedMutationAction,
  listRigMutationToolDefinitions,
  RigMutationToolContractError,
  validateRigMutationPlan,
} from "@/core/effects/agent-tools/mutation-tools";
import { describe, expect, it } from "vitest";

describe("agent mutation tools", () => {
  it("lists typed mutation tools with policy metadata", () => {
    const definitions = listRigMutationToolDefinitions();

    expect(definitions.map((definition) => definition.tool)).toEqual([
      "create_nodes",
      "update_nodes",
      "create_edges",
      "apply_layout",
    ]);
    expect(definitions.find((definition) => definition.tool === "create_edges")?.policy.risk).toBe("high");
    expect(definitions.every((definition) => definition.policy.requiresConfirmation)).toBe(true);
  });

  it("validates a mutation plan without applying it and attaches risk metadata", () => {
    const plan = validateRigMutationPlan([
      {
        tool: "create_nodes",
        input: {
          nodes: [
            {
              key: "payments-api",
              nodeType: "system",
              label: "Payments API",
              description: "Accepts payment requests",
              technology: "Rust",
              teamOwnership: "Core Platform",
            },
            {
              key: "ledger-service",
              nodeType: "system",
              label: "Ledger Service",
              description: null,
              technology: "Postgres",
              teamOwnership: "Core Platform",
            },
          ],
        },
      },
      {
        tool: "create_edges",
        input: {
          edges: [
            {
              sourceRef: { kind: "plan-node", value: "payments-api" },
              targetRef: { kind: "plan-node", value: "ledger-service" },
              label: "records",
            },
          ],
        },
      },
      {
        tool: "apply_layout",
        input: {
          preset: "layered",
          target: "selection",
          nodeIds: ["payments-api", "ledger-service"],
        },
      },
    ]);

    expect(plan.totalActions).toBe(3);
    expect(plan.totalNodesCreated).toBe(2);
    expect(plan.totalEdgesCreated).toBe(1);
    expect(plan.totalLayoutOperations).toBe(1);
    expect(plan.highestRisk).toBe("high");
    expect(plan.requiresConfirmation).toBe(true);
    expect(plan.actions[0]?.policy.scope).toBe("c4");
    expect(plan.actions[1]?.summary).toMatchObject({
      edgeCount: 1,
    });
  });

  it("rejects update actions that do not change any fields", () => {
    expect(() =>
      createRigValidatedMutationAction("update_nodes", {
        nodes: [
          {
            nodeId: "payments-api",
            label: "   ",
            description: null,
            technology: null,
            teamOwnership: null,
          },
        ],
      })
    ).toThrow(RigMutationToolContractError);
  });

  it("rejects unknown layout presets", () => {
    expect(() =>
      createRigValidatedMutationAction("apply_layout", {
        preset: "non-existent-layout",
      })
    ).toThrow(RigMutationToolContractError);
  });
});
