import type { Edge, Node } from "@xyflow/react";
import { type ArchitectureSemanticRole, isRoleAllowedForPattern } from "./architecture-role-classification";

export type ClientServerRoleEvalCategory =
  | "canonical-typed-path"
  | "label-only"
  | "grounded-topology"
  | "ambiguous-generic"
  | "misleading-label"
  | "missing-tier"
  | "external-directionality"
  | "explicit-role-control";

export interface ClientServerRoleEvalCase {
  readonly id: string;
  readonly category: ClientServerRoleEvalCategory;
  readonly nodes: ReadonlyArray<Node>;
  readonly edges: ReadonlyArray<Edge>;
  readonly expectedRoles: Readonly<Record<string, ArchitectureSemanticRole>>;
  readonly thresholdEligible: boolean;
  readonly rationale?: string;
}

export interface ClientServerRoleEvalCorpusValidationError {
  readonly _tag: "ClientServerRoleEvalCorpusValidationError";
  readonly caseId: string | null;
  readonly problem:
    | "duplicate-case-id"
    | "duplicate-node-id"
    | "missing-expected-role"
    | "unknown-expected-node"
    | "child-only-expected-node"
    | "disallowed-role"
    | "threshold-eligible-explicit-role"
    | "unknown-edge-endpoint"
    | "no-threshold-eligible-assignments";
  readonly message: string;
}

export type ClientServerRoleEvalCorpusValidationResult =
  | { readonly status: "valid" }
  | { readonly status: "validation-failure"; readonly error: ClientServerRoleEvalCorpusValidationError };

const node = (id: string, type: string, label: string, data: Record<string, unknown> = {}): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: { label, ...data },
  style: { width: 180, height: 80 },
});

const edge = (id: string, source: string, target: string, label: string): Edge => ({
  id,
  source,
  target,
  label,
});

const CLIENT_SERVER_ROLE_EVAL_CASES: ReadonlyArray<ClientServerRoleEvalCase> = [
  {
    id: "canonical-typed",
    category: "canonical-typed-path",
    thresholdEligible: true,
    nodes: [
      node("typed-client", "person", "Customer"),
      node("typed-service", "applicationService", "Checkout Application"),
      node("typed-domain", "aggregate", "Order Aggregate"),
      node("typed-store", "repository", "Order Repository"),
      node("typed-external", "externalSystem", "Payment Provider"),
      node("typed-worker", "component", "Worker"),
    ],
    edges: [
      edge("typed-request", "typed-client", "typed-service", "request"),
      edge("typed-command", "typed-service", "typed-domain", "command"),
      edge("typed-data", "typed-domain", "typed-store", "data"),
      edge("typed-provider", "typed-service", "typed-external", "provider"),
    ],
    expectedRoles: {
      "typed-client": "client",
      "typed-service": "service",
      "typed-domain": "domain",
      "typed-store": "persistence",
      "typed-external": "external-dependency",
      "typed-worker": "unclassified",
    },
  },
  {
    id: "label-only",
    category: "label-only",
    thresholdEligible: true,
    nodes: [
      node("label-client", "component", "Web Browser"),
      node("label-service", "component", "Orders API"),
      node("label-domain", "component", "Business Rules"),
      node("label-store", "component", "Orders Database"),
      node("label-external", "component", "Payment Provider"),
    ],
    edges: [],
    expectedRoles: {
      "label-client": "client",
      "label-service": "service",
      "label-domain": "domain",
      "label-store": "persistence",
      "label-external": "external-dependency",
    },
  },
  {
    id: "grounded-topology",
    category: "grounded-topology",
    thresholdEligible: true,
    nodes: [
      node("topology-client", "component", "Portal"),
      node("topology-client-target", "applicationService", "Entry Application"),
      node("topology-service", "component", "Coordinator"),
      node("topology-service-target", "aggregate", "Target Aggregate"),
      node("topology-domain-source", "applicationService", "Domain Application"),
      node("topology-domain", "component", "Rules Engine"),
      node("topology-domain-store", "repository", "Domain Repository"),
      node("topology-persistence-source", "aggregate", "Ledger Aggregate"),
      node("topology-persistence", "component", "Ledger Store"),
    ],
    edges: [
      edge("topology-client-calls", "topology-client", "topology-client-target", "calls"),
      edge("topology-service-calls", "topology-service", "topology-service-target", "calls"),
      edge("topology-domain-command", "topology-domain-source", "topology-domain", "command"),
      edge("topology-domain-reads", "topology-domain", "topology-domain-store", "reads"),
      edge("topology-persistence-stores", "topology-persistence-source", "topology-persistence", "stores"),
    ],
    expectedRoles: {
      "topology-client": "client",
      "topology-client-target": "service",
      "topology-service": "service",
      "topology-service-target": "domain",
      "topology-domain-source": "service",
      "topology-domain": "domain",
      "topology-domain-store": "persistence",
      "topology-persistence-source": "domain",
      "topology-persistence": "persistence",
    },
  },
  {
    id: "ambiguous-generic",
    category: "ambiguous-generic",
    thresholdEligible: true,
    nodes: [
      node("generic-a", "component", "Worker"),
      node("generic-b", "container", "Coordinator"),
      node("generic-c", "system", "Platform"),
    ],
    edges: [],
    expectedRoles: {
      "generic-a": "unclassified",
      "generic-b": "unclassified",
      "generic-c": "unclassified",
    },
  },
  {
    id: "misleading-labels",
    category: "misleading-label",
    thresholdEligible: true,
    nodes: [
      node("misleading-client", "person", "Orders Database"),
      node("misleading-domain", "aggregate", "Public API"),
      node("misleading-store", "repository", "Browser Client"),
    ],
    edges: [],
    expectedRoles: {
      "misleading-client": "client",
      "misleading-domain": "domain",
      "misleading-store": "persistence",
    },
  },
  {
    id: "missing-tier",
    category: "missing-tier",
    thresholdEligible: true,
    nodes: [
      node("missing-client", "person", "Operator"),
      node("missing-store", "repository", "Archive"),
      node("missing-external", "externalSystem", "Archive Provider"),
    ],
    edges: [
      edge("missing-client-reads", "missing-client", "missing-store", "reads"),
      edge("missing-store-calls", "missing-store", "missing-external", "calls"),
    ],
    expectedRoles: {
      "missing-client": "client",
      "missing-store": "persistence",
      "missing-external": "external-dependency",
    },
  },
  {
    id: "external-directionality",
    category: "external-directionality",
    thresholdEligible: true,
    nodes: [
      node("direction-client", "component", "Partner Caller"),
      node("direction-service", "applicationService", "Partner Application"),
      node("direction-external-a", "externalSystem", "Identity Provider"),
      node("direction-external-b", "externalSystem", "Tax Provider"),
    ],
    edges: [
      edge("direction-client-calls-service", "direction-client", "direction-service", "calls"),
      edge("direction-service-calls-identity", "direction-service", "direction-external-a", "calls"),
      edge("direction-service-calls-tax", "direction-service", "direction-external-b", "calls"),
      edge("direction-client-calls-identity", "direction-client", "direction-external-a", "calls"),
    ],
    expectedRoles: {
      "direction-client": "client",
      "direction-service": "service",
      "direction-external-a": "external-dependency",
      "direction-external-b": "external-dependency",
    },
  },
  {
    id: "explicit-controls",
    category: "explicit-role-control",
    thresholdEligible: false,
    nodes: [
      node("explicit-domain", "component", "Worker", { layoutRole: "domain" }),
      node("mismatch-client", "person", "Operator", { layoutRole: "publisher" }),
    ],
    edges: [],
    expectedRoles: {
      "explicit-domain": "domain",
      "mismatch-client": "client",
    },
  },
];

const compareById = <T extends { readonly id: string }>(left: T, right: T): number => left.id.localeCompare(right.id);

const validationFailure = (
  problem: ClientServerRoleEvalCorpusValidationError["problem"],
  caseId: string | null,
  message: string,
): ClientServerRoleEvalCorpusValidationResult => ({
  status: "validation-failure",
  error: { _tag: "ClientServerRoleEvalCorpusValidationError", caseId, problem, message },
});

export const getClientServerRoleEvalCases =
  (): ClientServerRoleEvalCase[] => [...structuredClone(CLIENT_SERVER_ROLE_EVAL_CASES)];

export const validateClientServerRoleEvalCases = (
  cases: ReadonlyArray<ClientServerRoleEvalCase>,
): ClientServerRoleEvalCorpusValidationResult => {
  const sortedCases = [...cases].sort(compareById);
  for (const [index, roleEvalCase] of sortedCases.entries()) {
    if (index > 0 && sortedCases[index - 1]!.id === roleEvalCase.id) {
      return validationFailure(
        "duplicate-case-id",
        roleEvalCase.id,
        `Client-server role evaluation case '${roleEvalCase.id}' is duplicated.`,
      );
    }
  }

  let thresholdEligibleAssignmentCount = 0;
  for (const roleEvalCase of sortedCases) {
    const sortedNodes = [...roleEvalCase.nodes].sort(compareById);
    const nodeIds = new Set<string>();
    for (const node of sortedNodes) {
      if (nodeIds.has(node.id)) {
        return validationFailure(
          "duplicate-node-id",
          roleEvalCase.id,
          `Node '${node.id}' is duplicated in case '${roleEvalCase.id}'.`,
        );
      }
      nodeIds.add(node.id);
    }

    if (roleEvalCase.thresholdEligible) {
      for (const node of sortedNodes) {
        if (node.data.layoutRole !== undefined) {
          return validationFailure(
            "threshold-eligible-explicit-role",
            roleEvalCase.id,
            `Threshold-eligible node '${node.id}' has an explicit layout role in case '${roleEvalCase.id}'.`,
          );
        }
      }
    }

    for (const nodeId of Object.keys(roleEvalCase.expectedRoles).sort((left, right) => left.localeCompare(right))) {
      const node = sortedNodes.find(({ id }) => id === nodeId);
      if (!node) {
        return validationFailure(
          "unknown-expected-node",
          roleEvalCase.id,
          `Expected role references unknown node '${nodeId}' in case '${roleEvalCase.id}'.`,
        );
      }
      if (node.parentId !== undefined) {
        return validationFailure(
          "child-only-expected-node",
          roleEvalCase.id,
          `Expected role references child node '${nodeId}' in case '${roleEvalCase.id}'.`,
        );
      }
      const expectedRole = roleEvalCase.expectedRoles[nodeId]!;
      if (!isRoleAllowedForPattern("client-server", expectedRole)) {
        return validationFailure(
          "disallowed-role",
          roleEvalCase.id,
          `Expected role '${expectedRole}' is not allowed for client-server case '${roleEvalCase.id}'.`,
        );
      }
    }

    const topLevelNodes = sortedNodes.filter(({ parentId }) => parentId === undefined);
    for (const node of topLevelNodes) {
      if (!(node.id in roleEvalCase.expectedRoles)) {
        return validationFailure(
          "missing-expected-role",
          roleEvalCase.id,
          `Top-level node '${node.id}' has no expected role in case '${roleEvalCase.id}'.`,
        );
      }
    }

    const sortedEdges = [...roleEvalCase.edges].sort(compareById);
    for (const edge of sortedEdges) {
      if (!nodeIds.has(edge.source)) {
        return validationFailure(
          "unknown-edge-endpoint",
          roleEvalCase.id,
          `Edge '${edge.id}' has unknown source '${edge.source}' in case '${roleEvalCase.id}'.`,
        );
      }
      if (!nodeIds.has(edge.target)) {
        return validationFailure(
          "unknown-edge-endpoint",
          roleEvalCase.id,
          `Edge '${edge.id}' has unknown target '${edge.target}' in case '${roleEvalCase.id}'.`,
        );
      }
    }

    if (roleEvalCase.thresholdEligible) thresholdEligibleAssignmentCount += topLevelNodes.length;
  }

  return thresholdEligibleAssignmentCount === 0
    ? validationFailure(
      "no-threshold-eligible-assignments",
      null,
      "Client-server role evaluation corpus has no threshold-eligible assignments.",
    )
    : { status: "valid" };
};
