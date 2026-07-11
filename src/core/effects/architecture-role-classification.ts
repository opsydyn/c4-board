import type { Edge, Node } from "@xyflow/react";
import { pipe, Schema } from "effect";

export const ArchitecturePatternSchema = Schema.Literal(
  "hexagonal",
  "event-driven",
  "client-server",
);
export type ArchitecturePattern = Schema.Schema.Type<typeof ArchitecturePatternSchema>;

export const ArchitectureSemanticRoleSchema = Schema.Literal(
  "core",
  "inbound-port",
  "outbound-port",
  "inbound-adapter",
  "outbound-adapter",
  "infrastructure",
  "publisher",
  "event-bus",
  "processor",
  "subscriber",
  "client",
  "service",
  "domain",
  "persistence",
  "external-dependency",
  "unclassified",
);
export type ArchitectureSemanticRole = Schema.Schema.Type<typeof ArchitectureSemanticRoleSchema>;

const ROLES_BY_PATTERN: Record<ArchitecturePattern, ReadonlySet<ArchitectureSemanticRole>> = {
  hexagonal: new Set([
    "core",
    "inbound-port",
    "outbound-port",
    "inbound-adapter",
    "outbound-adapter",
    "infrastructure",
    "unclassified",
  ]),
  "event-driven": new Set([
    "publisher",
    "event-bus",
    "processor",
    "subscriber",
    "infrastructure",
    "external-dependency",
    "unclassified",
  ]),
  "client-server": new Set([
    "client",
    "service",
    "domain",
    "persistence",
    "external-dependency",
    "unclassified",
  ]),
};

export const isRoleAllowedForPattern = (
  pattern: ArchitecturePattern,
  role: ArchitectureSemanticRole,
): boolean => ROLES_BY_PATTERN[pattern].has(role);

export const getRolesForPattern = (
  pattern: ArchitecturePattern,
): ArchitectureSemanticRole[] => [...ROLES_BY_PATTERN[pattern]];

export const isArchitectureSemanticRole = (value: unknown): value is ArchitectureSemanticRole =>
  typeof value === "string" && ArchitectureSemanticRoleSchema.literals.includes(value as ArchitectureSemanticRole);

const ConfidenceSchema = pipe(
  Schema.Number,
  Schema.filter((value) => Number.isFinite(value) && value >= 0 && value <= 1, {
    message: () => "Semantic role confidence must be between 0 and 1",
  }),
);

export const ArchitectureRoleAssignmentSchema = pipe(
  Schema.Struct({
    nodeId: Schema.String,
    pattern: ArchitecturePatternSchema,
    role: ArchitectureSemanticRoleSchema,
    confidence: ConfidenceSchema,
    source: Schema.Literal("explicit", "node-type", "label", "topology", "fallback"),
    evidence: Schema.Array(Schema.String),
  }),
  Schema.filter(
    (assignment) => isRoleAllowedForPattern(assignment.pattern, assignment.role),
    { message: () => "Semantic role is not valid for the declared architecture pattern" },
  ),
);
export type ArchitectureRoleAssignment = Schema.Schema.Type<typeof ArchitectureRoleAssignmentSchema>;

export const ArchitectureRoleDiagnosticSchema = Schema.Struct({
  code: Schema.Literal("semantic-role-pattern-mismatch", "semantic-role-ambiguous"),
  severity: Schema.Literal("warning"),
  message: Schema.String,
  nodeIds: Schema.Array(Schema.String),
});

export const ArchitectureRoleClassificationSchema = Schema.Struct({
  pattern: ArchitecturePatternSchema,
  assignments: Schema.Array(ArchitectureRoleAssignmentSchema),
  diagnostics: Schema.Array(ArchitectureRoleDiagnosticSchema),
});
export type ArchitectureRoleClassification = Schema.Schema.Type<typeof ArchitectureRoleClassificationSchema>;

const HEXAGONAL_ROLES = ROLES_BY_PATTERN.hexagonal;
const EVENT_DRIVEN_ROLES = ROLES_BY_PATTERN["event-driven"];

const ALL_ROLES = new Set<ArchitectureSemanticRole>(ArchitectureSemanticRoleSchema.literals);

interface NodeTopology {
  inbound: Set<string>;
  outbound: Set<string>;
}

const buildTopology = (nodes: ReadonlyArray<Node>, edges: ReadonlyArray<Edge>) => {
  const topology = new Map(nodes.map((node) => [
    node.id,
    { inbound: new Set<string>(), outbound: new Set<string>() } satisfies NodeTopology,
  ]));
  for (const edge of edges) {
    topology.get(edge.source)?.outbound.add(edge.target);
    topology.get(edge.target)?.inbound.add(edge.source);
  }
  return topology;
};

const nodeLabel = (node: Node) =>
  typeof node.data?.label === "string" ? node.data.label.toLowerCase() : node.id.toLowerCase();

const nodeType = (node: Node) => {
  if (typeof node.data?.dddType === "string") return node.data.dddType;
  if (typeof node.data?.c4Type === "string") return node.data.c4Type;
  return node.type ?? "";
};

const explicitRole = (node: Node): ArchitectureSemanticRole | null => {
  const value = node.data?.layoutRole;
  return isArchitectureSemanticRole(value) && ALL_ROLES.has(value)
    ? value as ArchitectureSemanticRole
    : null;
};

const inferCoreId = (nodes: ReadonlyArray<Node>, topology: Map<string, NodeTopology>): string | null => {
  const ranked = [...nodes].sort((left, right) => {
    const score = (node: Node) => {
      const label = nodeLabel(node);
      const type = nodeType(node);
      const degree = (topology.get(node.id)?.inbound.size ?? 0) + (topology.get(node.id)?.outbound.size ?? 0);
      return (/(^|[-_\s])(domain-?)?core($|[-_\s])/.test(label) ? 100 : 0)
        + (["aggregate", "domainService", "entity", "valueObject"].includes(type) ? 50 : 0)
        + degree;
    };
    return score(right) - score(left) || left.id.localeCompare(right.id);
  });
  return ranked[0]?.id ?? null;
};

interface InferredRole {
  role: ArchitectureSemanticRole;
  confidence: number;
  source: ArchitectureRoleAssignment["source"];
  evidence: string[];
  patternMismatch?: ArchitectureSemanticRole;
}

const inferHexagonalRole = (
  node: Node,
  coreId: string | null,
  topology: Map<string, NodeTopology>,
): InferredRole => {
  const explicit = explicitRole(node);
  if (explicit && HEXAGONAL_ROLES.has(explicit)) {
    return { role: explicit, confidence: 1, source: "explicit", evidence: [`Explicit role '${explicit}'.`] };
  }

  const mismatch = explicit && !HEXAGONAL_ROLES.has(explicit) ? explicit : undefined;
  const label = nodeLabel(node);
  const type = nodeType(node);
  const relation = topology.get(node.id);
  const pointsToCore = coreId !== null && relation?.outbound.has(coreId) === true;
  const receivesFromCore = coreId !== null && relation?.inbound.has(coreId) === true;

  if (
    node.id === coreId && (/(^|[-_\s])(domain-?)?core($|[-_\s])/.test(label)
      || ["aggregate", "domainService", "entity", "valueObject"].includes(type))
  ) {
    return {
      role: "core",
      confidence: 0.95,
      source: "label",
      evidence: ["Core label or domain node type."],
      ...(mismatch && { patternMismatch: mismatch }),
    };
  }

  if (/port/.test(label)) {
    if (/(repository|database|output|outbound|driven)/.test(label) || receivesFromCore) {
      return {
        role: "outbound-port",
        confidence: 0.9,
        source: "label",
        evidence: ["Port label and outbound dependency direction."],
        ...(mismatch && { patternMismatch: mismatch }),
      };
    }
    if (/(input|inbound|driving|command|query)/.test(label) || pointsToCore) {
      return {
        role: "inbound-port",
        confidence: 0.9,
        source: "label",
        evidence: ["Port label and inbound interaction direction."],
        ...(mismatch && { patternMismatch: mismatch }),
      };
    }
  }

  if (/adapter/.test(label)) {
    if (/(database|db|email|repository|external|queue|broker|outbound)/.test(label)) {
      return {
        role: "outbound-adapter",
        confidence: 0.9,
        source: "label",
        evidence: ["Adapter label identifies an outbound dependency."],
        ...(mismatch && { patternMismatch: mismatch }),
      };
    }
    if (/(rest|http|api|ui|controller|event|consumer|inbound)/.test(label) || pointsToCore) {
      return {
        role: "inbound-adapter",
        confidence: 0.85,
        source: "label",
        evidence: ["Adapter label or edge direction identifies an inbound driver."],
        ...(mismatch && { patternMismatch: mismatch }),
      };
    }
    if (receivesFromCore) {
      return {
        role: "outbound-adapter",
        confidence: 0.75,
        source: "topology",
        evidence: ["Adapter receives an outbound dependency from the core."],
        ...(mismatch && { patternMismatch: mismatch }),
      };
    }
  }

  if (type === "repository") {
    return {
      role: "outbound-port",
      confidence: 0.85,
      source: "node-type",
      evidence: ["DDD repository represents an outbound domain port."],
      ...(mismatch && { patternMismatch: mismatch }),
    };
  }
  if (type === "externalSystem") {
    return {
      role: "outbound-adapter",
      confidence: 0.8,
      source: "node-type",
      evidence: ["External system is an outbound adapter dependency."],
      ...(mismatch && { patternMismatch: mismatch }),
    };
  }
  if (["command", "query"].includes(type)) {
    return {
      role: "inbound-port",
      confidence: 0.8,
      source: "node-type",
      evidence: [`DDD ${type} represents an inbound use-case port.`],
      ...(mismatch && { patternMismatch: mismatch }),
    };
  }
  if (["aggregate", "domainService", "entity", "valueObject"].includes(type)) {
    return {
      role: "core",
      confidence: 0.8,
      source: "node-type",
      evidence: [`DDD ${type} belongs to the domain core.`],
      ...(mismatch && { patternMismatch: mismatch }),
    };
  }

  return {
    role: "unclassified",
    confidence: 0.25,
    source: "fallback",
    evidence: ["No grounded Hexagonal role evidence was found."],
    ...(mismatch && { patternMismatch: mismatch }),
  };
};

const hasEventBusLabel = (label: string): boolean => {
  const tokens = label.split(/[^a-z0-9]+/).filter(Boolean);
  const hasStreamFlowRole = tokens.some((token) =>
    ["processor", "subscriber", "consumer", "publisher", "producer"].includes(token)
  );
  return tokens.some((token) => ["broker", "queue", "topic", "bus"].includes(token))
    || (tokens.includes("stream") && !hasStreamFlowRole);
};

const isEventBus = (node: Node): boolean => {
  const explicit = explicitRole(node);
  if (explicit !== null && EVENT_DRIVEN_ROLES.has(explicit)) {
    return explicit === "event-bus";
  }
  return hasEventBusLabel(nodeLabel(node));
};

const continuesEventFlow = (nodeId: string, edges: ReadonlyArray<Edge>): boolean =>
  edges.some(
    (edge) =>
      edge.source === nodeId
      && typeof edge.label === "string"
      && /\b(event|command|message|publish(?:es|ed|ing)?|emit(?:s|ted|ting)?)\b/.test(edge.label.toLowerCase()),
  );

const inferEventDrivenRole = (
  node: Node,
  busIds: ReadonlySet<string>,
  topology: Map<string, NodeTopology>,
  edges: ReadonlyArray<Edge>,
): InferredRole => {
  const explicit = explicitRole(node);
  if (explicit && EVENT_DRIVEN_ROLES.has(explicit)) {
    return { role: explicit, confidence: 1, source: "explicit", evidence: [`Explicit role '${explicit}'.`] };
  }

  const mismatch = explicit && !EVENT_DRIVEN_ROLES.has(explicit) ? explicit : undefined;
  const label = nodeLabel(node);
  const type = nodeType(node);
  const relation = topology.get(node.id);
  const publishesToBus = [...(relation?.outbound ?? [])].some((id) => busIds.has(id));
  const consumesFromBus = [...(relation?.inbound ?? [])].some((id) => busIds.has(id));
  const continuesFlow = continuesEventFlow(node.id, edges);

  if (busIds.has(node.id)) {
    return {
      role: "event-bus",
      confidence: 0.95,
      source: "label",
      evidence: ["Event bus, broker, queue, topic, or stream label."],
      ...(mismatch && { patternMismatch: mismatch }),
    };
  }
  if (/(database|db|cache|telemetry|logging|metrics|monitoring)/.test(label)) {
    return {
      role: "infrastructure",
      confidence: 0.85,
      source: "label",
      evidence: ["Infrastructure label."],
      ...(mismatch && { patternMismatch: mismatch }),
    };
  }
  if (/(publisher|producer|event[-_\s]?source)/.test(label) || publishesToBus) {
    const hasPublisherLabel = /(publisher|producer|event[-_\s]?source)/.test(label);
    return {
      role: "publisher",
      confidence: hasPublisherLabel ? 0.85 : 0.8,
      source: hasPublisherLabel ? "label" : "topology",
      evidence: [hasPublisherLabel ? "Publisher label." : "Node publishes to an event bus."],
      ...(mismatch && { patternMismatch: mismatch }),
    };
  }
  if (/(processor|transformer|projector|workflow)/.test(label)) {
    return {
      role: "processor",
      confidence: 0.8,
      source: "label",
      evidence: ["Processor label."],
      ...(mismatch && { patternMismatch: mismatch }),
    };
  }
  if (consumesFromBus && continuesFlow) {
    return {
      role: "processor",
      confidence: 0.85,
      source: "topology",
      evidence: ["Consumes from an event bus and emits an event-flow continuation."],
      ...(mismatch && { patternMismatch: mismatch }),
    };
  }
  if (consumesFromBus && !continuesFlow) {
    return {
      role: "subscriber",
      confidence: 0.85,
      source: "topology",
      evidence: ["Consumes from an event bus without an event-flow continuation."],
      ...(mismatch && { patternMismatch: mismatch }),
    };
  }
  if (/(subscriber|consumer|listener|sink)/.test(label) && !continuesFlow) {
    return {
      role: "subscriber",
      confidence: 0.8,
      source: "label",
      evidence: ["Subscriber label with no event-flow continuation."],
      ...(mismatch && { patternMismatch: mismatch }),
    };
  }
  if (type === "externalSystem") {
    return {
      role: "external-dependency",
      confidence: 0.8,
      source: "node-type",
      evidence: ["External system is an external dependency outside the event flow."],
      ...(mismatch && { patternMismatch: mismatch }),
    };
  }
  return {
    role: "unclassified",
    confidence: 0.25,
    source: "fallback",
    evidence: ["No grounded Event-Driven role evidence was found."],
    ...(mismatch && { patternMismatch: mismatch }),
  };
};

const buildClassification = (
  pattern: ArchitecturePattern,
  inferred: ReadonlyArray<{ node: Node; result: InferredRole }>,
  patternName: string,
): ArchitectureRoleClassification => {
  const sortedInferred = [...inferred].sort(({ node: left }, { node: right }) => left.id.localeCompare(right.id));
  const assignments = sortedInferred.map(({ node, result }) => ({
    nodeId: node.id,
    pattern,
    role: result.role,
    confidence: result.confidence,
    source: result.source,
    evidence: result.evidence,
  }));
  const diagnostics = sortedInferred.flatMap(({ node, result }) => {
    const entries: Array<Schema.Schema.Type<typeof ArchitectureRoleDiagnosticSchema>> = [];
    if (result.patternMismatch) {
      entries.push({
        code: "semantic-role-pattern-mismatch",
        severity: "warning",
        message: `Explicit role '${result.patternMismatch}' is not valid for ${patternName} classification.`,
        nodeIds: [node.id],
      });
    }
    if (result.confidence < 0.65) {
      entries.push({
        code: "semantic-role-ambiguous",
        severity: "warning",
        message: `Node '${node.id}' has no confident ${patternName} role assignment.`,
        nodeIds: [node.id],
      });
    }
    return entries;
  });

  return Schema.decodeUnknownSync(ArchitectureRoleClassificationSchema)({
    pattern,
    assignments,
    diagnostics,
  });
};

export function inferHexagonalRoles(
  nodes: ReadonlyArray<Node>,
  edges: ReadonlyArray<Edge>,
): ArchitectureRoleClassification {
  const sortedNodes = [...nodes].sort((left, right) => left.id.localeCompare(right.id));
  const topology = buildTopology(sortedNodes, edges);
  const coreId = inferCoreId(sortedNodes, topology);
  const inferred = sortedNodes.map((node) => ({ node, result: inferHexagonalRole(node, coreId, topology) }));
  return buildClassification("hexagonal", inferred, "Hexagonal");
}

export function inferEventDrivenRoles(
  nodes: ReadonlyArray<Node>,
  edges: ReadonlyArray<Edge>,
): ArchitectureRoleClassification {
  const sortedNodes = [...nodes].sort((left, right) => left.id.localeCompare(right.id));
  const topology = buildTopology(sortedNodes, edges);
  const busIds = new Set(sortedNodes.filter(isEventBus).map(({ id }) => id));
  const inferred = sortedNodes.map((node) => ({
    node,
    result: inferEventDrivenRole(node, busIds, topology, edges),
  }));
  return buildClassification("event-driven", inferred, "Event-Driven");
}
