/**
 * Deterministic grounding facts.
 *
 * OPY was asked what was in Azure on a board and answered: "41 nodes,
 * planetnik-env is dependent on planetnik-runtime". The board had 19 Azure
 * nodes, and the dependency runs the other way — the container app carries
 * `environmentId` pointing at the environment.
 *
 * Both are facts we hold exactly. Asking prose to carry them is what created
 * the opportunity to get them wrong, so they are rendered instead: stated once,
 * unambiguously, from the same data the answer is checked against.
 */

import { buildAzureGroundingFacts, formatGroundingFactsForPrompt } from "@/core/effects/agent-grounding-facts";
import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";

const azureNode = (id: string, label: string, type = "microsoft.app/containerapps"): Node => ({
  id,
  position: { x: 0, y: 0 },
  type: "container",
  data: {
    label,
    c4Type: "container",
    sourceProvider: "azure",
    sourceResourceId: id.replace("azure:", ""),
    sourceResourceType: type,
  },
});

const azureEdge = (id: string, source: string, target: string): Edge => ({
  id,
  source,
  target,
  data: { sourceProvider: "azure", relationshipType: "depends_on", confidence: "high" },
});

const board = () => ({
  nodes: [
    azureNode("azure:app", "planetnik-app"),
    azureNode("azure:runtime", "planetnik-runtime"),
    azureNode("azure:env", "planetnik-env", "microsoft.app/managedenvironments"),
    { id: "manual-1", position: { x: 0, y: 0 }, data: { label: "Hand drawn" } } as Node,
  ],
  edges: [
    azureEdge("azure-edge:1", "azure:runtime", "azure:env"),
    azureEdge("azure-edge:2", "azure:app", "azure:env"),
  ],
});

describe("buildAzureGroundingFacts", () => {
  it("counts Azure nodes exactly, and separately from the rest of the board", () => {
    const facts = buildAzureGroundingFacts(board());

    expect(facts.azureNodeCount).toBe(3);
    expect(facts.boardNodeCount).toBe(4);
  });

  it("states each relationship with its direction, not as an undirected pair", () => {
    // The observed failure: prose inverted "app depends on environment".
    const facts = buildAzureGroundingFacts(board());
    const relationship = facts.relationships.find((entry) => entry.fromLabel === "planetnik-runtime");

    expect(relationship?.toLabel).toBe("planetnik-env");
    expect(relationship?.fromLabel).toBe("planetnik-runtime");
  });

  it("never reports a relationship in both directions", () => {
    const facts = buildAzureGroundingFacts(board());

    for (const relationship of facts.relationships) {
      const inverse = facts.relationships.find((other) =>
        other.fromLabel === relationship.toLabel && other.toLabel === relationship.fromLabel
      );
      expect(inverse).toBeUndefined();
    }
  });

  it("counts what points at a node, so 'has 2 links' is answerable without guessing", () => {
    const facts = buildAzureGroundingFacts(board());
    const environment = facts.nodes.find((node) => node.label === "planetnik-env");

    expect(environment?.incomingCount).toBe(2);
    expect(environment?.outgoingCount).toBe(0);
  });

  it("ignores hand-drawn nodes and edges, which Azure did not put there", () => {
    const facts = buildAzureGroundingFacts({
      nodes: [{ id: "manual-1", position: { x: 0, y: 0 }, data: { label: "Manual" } } as Node],
      edges: [{ id: "manual-edge", source: "manual-1", target: "manual-1" } as Edge],
    });

    expect(facts.azureNodeCount).toBe(0);
    expect(facts.relationships).toEqual([]);
  });
});

describe("formatGroundingFactsForPrompt", () => {
  it("renders counts as stated facts rather than leaving them to be inferred", () => {
    const rendered = formatGroundingFactsForPrompt(buildAzureGroundingFacts(board()));

    expect(rendered).toContain("AZURE_NODE_COUNT=3");
    expect(rendered).toContain("BOARD_NODE_COUNT=4");
  });

  it("renders direction in words, because an arrow is what got inverted", () => {
    const rendered = formatGroundingFactsForPrompt(buildAzureGroundingFacts(board()));

    expect(rendered).toContain("planetnik-runtime depends on planetnik-env");
    expect(rendered).not.toContain("planetnik-env depends on planetnik-runtime");
  });

  it("tells the model these numbers are the only ones it may state", () => {
    const rendered = formatGroundingFactsForPrompt(buildAzureGroundingFacts(board()));

    expect(rendered.toUpperCase()).toContain("DO NOT");
  });

  it("says plainly when there is no Azure on the board", () => {
    const rendered = formatGroundingFactsForPrompt(
      buildAzureGroundingFacts({ nodes: [], edges: [] }),
    );

    expect(rendered).toContain("AZURE_NODE_COUNT=0");
  });

  it("bounds what it renders so a large estate cannot crowd out the question", () => {
    const many = {
      nodes: Array.from({ length: 400 }, (_, index) => azureNode(`azure:n${index}`, `node-${index}`)),
      edges: Array.from(
        { length: 400 },
        (_, index) => azureEdge(`azure-edge:${index}`, `azure:n${index}`, "azure:n0"),
      ),
    };

    const rendered = formatGroundingFactsForPrompt(buildAzureGroundingFacts(many));

    // The counts stay exact even though the listing is truncated — a capped
    // list must not become a wrong total.
    expect(rendered).toContain("AZURE_NODE_COUNT=400");
    expect(rendered.length).toBeLessThan(6_000);
  });
});
