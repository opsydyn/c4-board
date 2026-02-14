import type { Node as ReactFlowNode } from "@xyflow/react";
import { describe, expect, it, vi } from "vitest";
import { dbNodeToReactFlow, reactFlowNodeToDb } from "./canvas-persistence";
import type { Node as DbNode } from "./database";
import { DEFAULT_ICON_BY_TYPE, type NodeIconId } from "./node-operations";

describe("reactFlowNodeToDb", () => {
  it("preserves an explicit iconId from the node data", () => {
    const reactNode: ReactFlowNode = {
      id: "node-1",
      type: "system",
      position: { x: 10, y: 20 },
      data: {
        label: "API Gateway",
        c4Type: "system",
        iconId: "phosphor:cloud-duotone",
      },
    };

    const result = reactFlowNodeToDb(reactNode, "diagram-1");

    expect(result.icon_id).toBe("phosphor:cloud-duotone");
  });

  it("applies the default icon for the node type when none is provided", () => {
    const reactNode: ReactFlowNode = {
      id: "node-2",
      type: "container",
      position: { x: 0, y: 0 },
      data: {
        label: "Web App",
        c4Type: "container",
      },
    };

    const result = reactFlowNodeToDb(reactNode, "diagram-1");

    expect(result.icon_id).toBe(DEFAULT_ICON_BY_TYPE.container);
  });

  it("serializes coupling state to versioned JSON", () => {
    const reactNode: ReactFlowNode = {
      id: "node-coupling-1",
      type: "container",
      position: { x: 10, y: 20 },
      data: {
        label: "Payments API",
        c4Type: "container",
        couplingScoreMode: "hybrid",
        integrationType: "contract",
        subdomainType: "core",
        couplingProfile: {
          strength: 7,
          distance: 4,
          volatility: 6,
        },
        couplingOverrides: {
          strength: 8,
          integrationType: "intrusive",
        },
      },
    };

    const result = reactFlowNodeToDb(reactNode, "diagram-1");

    expect(result.coupling_state_version).toBe(1);
    expect(result.coupling_state_json).not.toBeNull();
    expect(JSON.parse(result.coupling_state_json ?? "{}")).toEqual({
      couplingScoreMode: "hybrid",
      integrationType: "contract",
      subdomainType: "core",
      couplingProfile: {
        strength: 7,
        distance: 4,
        volatility: 6,
      },
      couplingOverrides: {
        strength: 8,
        integrationType: "intrusive",
      },
    });
  });

  it("normalizes and persists team ownership when provided", () => {
    const reactNode: ReactFlowNode = {
      id: "node-team-1",
      type: "system",
      position: { x: 20, y: 30 },
      data: {
        label: "Core API",
        c4Type: "system",
        teamOwnership: "  Team-Platform  ",
      },
    };

    const result = reactFlowNodeToDb(reactNode, "diagram-1");

    expect(result.team_ownership).toBe("Team-Platform");
  });

  it("omits team ownership when the input is blank", () => {
    const reactNode: ReactFlowNode = {
      id: "node-team-2",
      type: "system",
      position: { x: 20, y: 30 },
      data: {
        label: "Core API",
        c4Type: "system",
        teamOwnership: "   ",
      },
    };

    const result = reactFlowNodeToDb(reactNode, "diagram-1");

    expect(result.team_ownership).toBeUndefined();
  });
});

describe("dbNodeToReactFlow", () => {
  it("falls back to the default icon when the database value is null", () => {
    const dbNode: Partial<DbNode> = {
      id: "node-3",
      diagram_id: "diagram-1",
      type: "component",
      label: "Telemetry Worker",
      technology: null,
      description: null,
      position_x: 100,
      position_y: 200,
      width: null,
      height: null,
      parent_id: null,
      extent: null,
      expand_parent: 0,
      icon_id: null,
      created_at: 1,
      updated_at: 2,
    };

    const result = dbNodeToReactFlow(dbNode as DbNode);

    expect(result.data?.iconId).toBe(DEFAULT_ICON_BY_TYPE.component);
  });

  it("hydrates the iconId from the database value when present", () => {
    const iconId = "phosphor:user-duotone" as NodeIconId;
    const dbNode: Partial<DbNode> = {
      id: "node-4",
      diagram_id: "diagram-1",
      type: "person",
      label: "Operator",
      technology: null,
      description: null,
      position_x: 42,
      position_y: 24,
      width: null,
      height: null,
      parent_id: null,
      extent: null,
      expand_parent: 0,
      icon_id: iconId,
      created_at: 1,
      updated_at: 2,
    };

    const result = dbNodeToReactFlow(dbNode as DbNode);

    expect(result.data?.iconId).toBe(iconId);
  });

  it("hydrates coupling state from persisted JSON", () => {
    const dbNode: Partial<DbNode> = {
      id: "node-coupling-2",
      diagram_id: "diagram-1",
      type: "system",
      label: "Core Domain",
      technology: null,
      description: null,
      position_x: 12,
      position_y: 34,
      width: null,
      height: null,
      parent_id: null,
      extent: null,
      expand_parent: 0,
      icon_id: null,
      coupling_state_version: 1,
      coupling_state_json: JSON.stringify({
        couplingScoreMode: "manual",
        integrationType: "functional",
        subdomainType: "supporting",
        couplingOverrides: {
          distance: 9,
        },
      }),
      created_at: 1,
      updated_at: 2,
    };

    const result = dbNodeToReactFlow(dbNode as DbNode);

    expect(result.data?.couplingScoreMode).toBe("manual");
    expect(result.data?.integrationType).toBe("functional");
    expect(result.data?.subdomainType).toBe("supporting");
    expect(
      (result.data?.couplingOverrides as Record<string, unknown> | undefined)
        ?.distance,
    ).toBe(9);
  });

  it("hydrates team ownership from persisted node metadata", () => {
    const dbNode: Partial<DbNode> = {
      id: "node-team-3",
      diagram_id: "diagram-1",
      type: "system",
      label: "Core Domain",
      technology: null,
      description: null,
      position_x: 12,
      position_y: 34,
      width: null,
      height: null,
      parent_id: null,
      extent: null,
      expand_parent: 0,
      icon_id: null,
      team_ownership: "team-platform",
      created_at: 1,
      updated_at: 2,
    };

    const result = dbNodeToReactFlow(dbNode as DbNode);

    expect(result.data?.teamOwnership).toBe("team-platform");
  });

  it("ignores invalid coupling state JSON", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const dbNode: Partial<DbNode> = {
      id: "node-coupling-3",
      diagram_id: "diagram-1",
      type: "system",
      label: "Core Domain",
      technology: null,
      description: null,
      position_x: 0,
      position_y: 0,
      width: null,
      height: null,
      parent_id: null,
      extent: null,
      expand_parent: 0,
      icon_id: null,
      coupling_state_version: 1,
      coupling_state_json: "{invalid-json",
      created_at: 1,
      updated_at: 2,
    };

    const result = dbNodeToReactFlow(dbNode as DbNode);

    expect(result.data?.couplingScoreMode).toBeUndefined();
    expect(result.data?.couplingOverrides).toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
