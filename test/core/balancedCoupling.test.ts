import {
  buildBalancedCouplingModel,
  getBalancedCouplingModelVersion,
  setBalancedCouplingModelVersion,
} from "@/core/balancedCoupling";
import type { EdgeMetadata } from "@/core/effects/edge-operations";
import type { NodeData } from "@/core/effects/node-operations";
import type { Edge, Node } from "@xyflow/react";
import { afterEach, describe, expect, it } from "vitest";

const createNode = (
  id: string,
  overrides: Partial<Node<NodeData>> = {},
): Node<NodeData> => {
  const baseData: NodeData = {
    label: id,
    description: "",
    technology: "",
    c4Type: "system",
    subdomainType: "core",
    integrationType: "contract",
    couplingProfile: {
      strength: 8,
      distance: 3,
      volatility: 6,
    },
    teamOwnership: "team-core",
  };

  return {
    id,
    type: "system",
    position: { x: 0, y: 0 },
    ...overrides,
    data: {
      ...baseData,
      ...(overrides.data ?? {}),
    },
  } as Node<NodeData>;
};

const createEdge = (
  id: string,
  source: string,
  target: string,
  metadata?: EdgeMetadata,
): Edge => ({
  id,
  source,
  target,
  type: "default",
  data: metadata ? { metadata } : {},
});

const getSnapshot = (
  model: ReturnType<typeof buildBalancedCouplingModel>,
  nodeId: string,
) => {
  const snapshot = model.snapshots.find((item) => item.id === nodeId);
  expect(snapshot).toBeDefined();
  return snapshot;
};

const edges: Edge[] = [];

afterEach(() => {
  setBalancedCouplingModelVersion("v2");
});

describe("balancedCoupling phase 1 + phase 2", () => {
  it("defaults to v2 model with formula explanation", () => {
    const model = buildBalancedCouplingModel([createNode("module-a")], edges);
    const snapshot = model.snapshots[0];

    expect(model.version).toBe("v2");
    expect(snapshot?.modelVersion).toBe("v2");
    expect(snapshot?.formulaExplanation).toBeDefined();
  });

  it("respects internal version selector when no explicit version is provided", () => {
    setBalancedCouplingModelVersion("v1");

    expect(getBalancedCouplingModelVersion()).toBe("v1");

    const model = buildBalancedCouplingModel([createNode("module-a")], edges);
    const snapshot = model.snapshots[0];

    expect(model.version).toBe("v1");
    expect(snapshot?.modelVersion).toBe("v1");
    expect(snapshot?.formulaExplanation).toBeUndefined();
  });

  it("applies Khononov formula semantics in v2", () => {
    const model = buildBalancedCouplingModel(
      [createNode("module-a")],
      edges,
      { version: "v2" },
    );
    const snapshot = model.snapshots[0];
    const explanation = snapshot?.formulaExplanation;

    expect(explanation).toBeDefined();
    if (!snapshot || !explanation) {
      return;
    }

    const expectedXor = Number(
      (10 - Math.abs(explanation.dimensions.strength - explanation.dimensions.distance))
        .toFixed(1),
    );
    const expectedNotVolatility = Number(
      (11 - explanation.dimensions.volatility).toFixed(1),
    );
    const expectedBalance = Number(
      Math.max(expectedXor, expectedNotVolatility).toFixed(1),
    );
    const expectedRisk = Number((11 - expectedBalance).toFixed(1));

    expect(explanation.xorBalance).toBe(expectedXor);
    expect(explanation.notVolatility).toBe(expectedNotVolatility);
    expect(explanation.balance).toBe(expectedBalance);
    expect(explanation.systemicRisk).toBe(expectedRisk);
    expect(snapshot.balance).toBe(explanation.balance);
    expect(snapshot.systemicRisk).toBe(explanation.systemicRisk);
  });

  it("keeps legacy v1 scoring available for comparison", () => {
    const node = createNode("module-a");

    const v1 = buildBalancedCouplingModel([node], edges, { version: "v1" });
    const v2 = buildBalancedCouplingModel([node], edges, { version: "v2" });

    expect(v1.version).toBe("v1");
    expect(v2.version).toBe("v2");
    expect(v1.snapshots[0]?.formulaExplanation).toBeUndefined();
    expect(v2.snapshots[0]?.formulaExplanation).toBeDefined();
    expect(v1.snapshots[0]?.systemicRisk).not.toBe(v2.snapshots[0]?.systemicRisk);
  });

  it("raises volatility for cycle-heavy topology", () => {
    const nodes = [
      createNode("a"),
      createNode("b"),
      createNode("c"),
      createNode("d"),
      createNode("isolated"),
    ];
    const topologyEdges = [
      createEdge("e1", "a", "b"),
      createEdge("e2", "b", "c"),
      createEdge("e3", "c", "a"),
      createEdge("e4", "a", "d"),
    ];
    const model = buildBalancedCouplingModel(nodes, topologyEdges, { version: "v2" });
    const cycleNode = getSnapshot(model, "a");
    const isolatedNode = getSnapshot(model, "isolated");

    expect(cycleNode?.formulaExplanation?.dimensions.volatility).toBeGreaterThan(
      isolatedNode?.formulaExplanation?.dimensions.volatility ?? 0,
    );
  });

  it("uses edge metadata to increase operational pressure", () => {
    const nodes = [
      createNode("rich-a", {
        data: {
          subdomainType: "generic",
          integrationType: "functional",
          couplingProfile: {
            strength: 3,
            distance: 3,
            volatility: 3,
          },
        },
      }),
      createNode("rich-b", {
        data: {
          subdomainType: "generic",
          integrationType: "functional",
          couplingProfile: {
            strength: 3,
            distance: 3,
            volatility: 3,
          },
        },
      }),
      createNode("plain-a", {
        data: {
          subdomainType: "generic",
          integrationType: "functional",
          couplingProfile: {
            strength: 3,
            distance: 3,
            volatility: 3,
          },
        },
      }),
      createNode("plain-b", {
        data: {
          subdomainType: "generic",
          integrationType: "functional",
          couplingProfile: {
            strength: 3,
            distance: 3,
            volatility: 3,
          },
        },
      }),
    ];
    const topologyEdges = [
      createEdge("rich-edge", "rich-a", "rich-b", {
        communicationStyle: "synchronous",
        protocol: "kafka",
        requestVolume: 5_000,
        latency: 1_200,
      }),
      createEdge("plain-edge", "plain-a", "plain-b"),
    ];
    const model = buildBalancedCouplingModel(nodes, topologyEdges, { version: "v2" });
    const rich = getSnapshot(model, "rich-a");
    const plain = getSnapshot(model, "plain-a");

    expect(rich?.formulaExplanation?.dimensions.strength).toBeGreaterThan(
      plain?.formulaExplanation?.dimensions.strength ?? 0,
    );
    expect(rich?.formulaExplanation?.dimensions.distance).toBeGreaterThan(
      plain?.formulaExplanation?.dimensions.distance ?? 0,
    );
    expect(rich?.formulaExplanation?.dimensions.volatility).toBeGreaterThan(
      plain?.formulaExplanation?.dimensions.volatility ?? 0,
    );
  });

  it("adds organizational pressure for missing or cross-team ownership", () => {
    const nodes = [
      createNode("unowned", {
        data: {
          teamOwnership: "",
          integrationType: "intrusive",
        },
      }),
      createNode("platform", {
        data: {
          teamOwnership: "team-platform",
        },
      }),
      createNode("owned", {
        data: {
          teamOwnership: "team-core",
          integrationType: "intrusive",
        },
      }),
      createNode("owned-peer", {
        data: {
          teamOwnership: "team-core",
        },
      }),
      createNode("cross-team", {
        data: {
          teamOwnership: "team-a",
          integrationType: "intrusive",
        },
      }),
      createNode("cross-team-peer", {
        data: {
          teamOwnership: "team-b",
        },
      }),
    ];
    const topologyEdges = [
      createEdge("org-1", "unowned", "platform"),
      createEdge("org-2", "owned", "owned-peer"),
      createEdge("org-3", "cross-team", "cross-team-peer"),
    ];
    const model = buildBalancedCouplingModel(nodes, topologyEdges, { version: "v2" });
    const unowned = getSnapshot(model, "unowned");
    const owned = getSnapshot(model, "owned");
    const crossTeam = getSnapshot(model, "cross-team");

    expect(unowned?.formulaExplanation?.dimensions.volatility).toBeGreaterThan(
      owned?.formulaExplanation?.dimensions.volatility ?? 0,
    );
    expect(crossTeam?.formulaExplanation?.dimensions.volatility).toBeGreaterThan(
      owned?.formulaExplanation?.dimensions.volatility ?? 0,
    );
  });

  it("applies override precedence across auto, hybrid, and manual score modes", () => {
    const buildSnapshotForMode = (
      mode: "auto" | "hybrid" | "manual",
      overrides: Partial<NodeData["couplingOverrides"]> = {},
    ) => {
      const node = createNode(`${mode}-module`, {
        data: {
          couplingScoreMode: mode,
          couplingOverrides: overrides,
          subdomainType: "generic",
          integrationType: "functional",
          couplingProfile: {
            strength: 3,
            distance: 3,
            volatility: 3,
          },
        },
      });
      const peer = createNode(`${mode}-peer`, {
        data: {
          subdomainType: "generic",
          integrationType: "functional",
          couplingProfile: {
            strength: 3,
            distance: 3,
            volatility: 3,
          },
        },
      });
      const model = buildBalancedCouplingModel(
        [node, peer],
        [
          createEdge(`${mode}-edge`, node.id, peer.id, {
            communicationStyle: "synchronous",
            protocol: "kafka",
            requestVolume: 8_000,
            latency: 1_000,
          }),
        ],
        { version: "v2" },
      );

      return getSnapshot(model, node.id);
    };

    const auto = buildSnapshotForMode("auto");
    const hybrid = buildSnapshotForMode("hybrid", { strength: 9 });
    const manual = buildSnapshotForMode("manual", { strength: 9 });

    expect(auto?.formulaExplanation?.dimensions.volatility).toBeGreaterThan(3);
    expect(hybrid?.formulaExplanation?.dimensions.strength).toBe(9);
    expect(hybrid?.formulaExplanation?.dimensions.distance).toBe(
      auto?.formulaExplanation?.dimensions.distance,
    );
    expect(manual?.formulaExplanation?.dimensions.strength).toBe(9);
    expect(manual?.formulaExplanation?.dimensions.distance).toBe(3);
    expect(manual?.formulaExplanation?.dimensions.volatility).toBe(3);
  });

  it("applies integration and subdomain overrides only in hybrid or manual mode", () => {
    const autoNode = createNode("auto-taxonomy", {
      data: {
        couplingScoreMode: "auto",
        integrationType: "functional",
        subdomainType: "generic",
        couplingOverrides: {
          integrationType: "intrusive",
          subdomainType: "core",
        },
      },
    });
    const hybridNode = createNode("hybrid-taxonomy", {
      data: {
        couplingScoreMode: "hybrid",
        integrationType: "functional",
        subdomainType: "generic",
        couplingOverrides: {
          integrationType: "intrusive",
          subdomainType: "core",
        },
      },
    });

    const model = buildBalancedCouplingModel([autoNode, hybridNode], [], {
      version: "v2",
    });
    const autoSnapshot = getSnapshot(model, "auto-taxonomy");
    const hybridSnapshot = getSnapshot(model, "hybrid-taxonomy");

    expect(autoSnapshot?.integrationType).toBe("functional");
    expect(autoSnapshot?.subdomainType).toBe("generic");
    expect(hybridSnapshot?.integrationType).toBe("intrusive");
    expect(hybridSnapshot?.subdomainType).toBe("core");
  });
});
