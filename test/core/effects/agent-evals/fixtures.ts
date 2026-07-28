import type {
  RigC4BoardEdge,
  RigC4BoardNode,
  RigC4BoardSummary,
  RigC4DiagramProposal,
  RigC4ProposalEdge,
  RigC4ProposalNode,
} from "@/core/effects/ai-agent.runtime";
import { ZERO_RIG_USAGE } from "../rig-usage.fixture";

export interface RigAgentEvalScenario {
  readonly id: "mono-team" | "cross-team" | "unknown-ownership" | "azure-heavy";
  readonly title: string;
  readonly selectedNodeId: string;
  readonly boardSummary: RigC4BoardSummary;
  readonly proposal: RigC4DiagramProposal;
  readonly expectedOwnershipTeams: number;
}

const makeNode = (
  id: string,
  label: string,
  nodeType: RigC4BoardNode["nodeType"],
  teamOwnership: string | null,
  technology: string | null = null,
  description: string | null = null,
): RigC4BoardNode => ({
  id,
  label,
  nodeType,
  description,
  technology,
  teamOwnership,
});

const makeEdge = (
  id: string,
  source: RigC4BoardNode,
  target: RigC4BoardNode,
  label: string | null,
): RigC4BoardEdge => ({
  id,
  sourceId: source.id,
  targetId: target.id,
  sourceLabel: source.label,
  targetLabel: target.label,
  label,
});

const makeBoardSummary = (
  diagramId: string,
  diagramName: string,
  nodes: ReadonlyArray<RigC4BoardNode>,
  edges: ReadonlyArray<RigC4BoardEdge>,
): RigC4BoardSummary => ({
  diagramId,
  diagramName,
  nodeCount: nodes.length,
  edgeCount: edges.length,
  nodes,
  edges,
});

const makeProposalNode = (
  key: string,
  label: string,
  nodeType: RigC4ProposalNode["nodeType"],
  description: string | null = null,
): RigC4ProposalNode => ({
  key,
  label,
  nodeType,
  description,
});

const makeProposalEdge = (
  sourceKey: string,
  targetKey: string,
  label: string,
): RigC4ProposalEdge => ({
  sourceKey,
  targetKey,
  label,
});

const makeProposal = (
  summary: string,
  rationale: string,
  nodes: ReadonlyArray<RigC4ProposalNode>,
  edges: ReadonlyArray<RigC4ProposalEdge>,
  warnings: ReadonlyArray<string> = [],
  respondedAtMs = 1_700_000_000_000,
): RigC4DiagramProposal => ({
  summary,
  rationale,
  warnings: [...warnings],
  nodes: [...nodes],
  edges: [...edges],
  provider: "openai",
  model: "gpt-4.1-mini",
  respondedAtMs,
  usage: ZERO_RIG_USAGE,
});

const monoApi = makeNode("mono-api", "API Gateway", "system", "team-platform", "TypeScript");
const monoCore = makeNode("mono-core", "Core Service", "system", "team-platform", "TypeScript");
const monoDb = makeNode("mono-db", "Data Service", "container", "team-platform", "Postgres");
const monoWorker = makeNode("mono-worker", "Worker", "component", "team-platform", "Bun");
const monoAudit = makeProposalNode("mono-audit", "Audit Worker", "component", "Captures audit trails.");

const crossEdge = makeNode("cross-edge", "Edge API", "system", "team-experience", "TypeScript");
const crossCatalog = makeNode("cross-catalog", "Catalog Service", "container", "team-commerce", "Go");
const crossPayments = makeNode("cross-payments", "Payments Service", "container", "team-finance", "Rust");
const crossOps = makeNode("cross-ops", "Ops Console", "system", "team-platform", "React");
const crossFraud = makeProposalNode("cross-fraud", "Fraud Service", "container", "Screens risky payments.");

const unknownIngress = makeNode("unknown-ingress", "Ingress", "system", "team-platform", "NGINX");
const unknownServiceA = makeNode("unknown-service-a", "Service A", "container", null, "TypeScript");
const unknownServiceB = makeNode("unknown-service-b", "Service B", "container", null, "TypeScript");
const unknownLedger = makeNode("unknown-ledger", "Ledger", "container", "team-finance", "Postgres");
const unknownResolver = makeProposalNode("unknown-resolver", "Ownership Resolver", "component", "Maps ownership gaps.");

const azureApim = makeNode("azure-apim", "API Management", "externalSystem", "team-platform", "Azure API Management");
const azureFunction = makeNode("azure-function", "Orders Function", "container", "team-payments", "Azure Functions");
const azureServiceBus = makeNode(
  "azure-service-bus",
  "Service Bus",
  "externalSystem",
  "team-platform",
  "Azure Service Bus",
);
const azureCosmos = makeNode("azure-cosmos", "Cosmos DB", "externalSystem", "team-data", "Azure Cosmos DB");
const azureKeyVault = makeNode("azure-key-vault", "Key Vault", "externalSystem", "team-platform", "Azure Key Vault");
const azureMonitor = makeProposalNode(
  "azure-monitor",
  "App Insights",
  "externalSystem",
  "Captures traces and metrics.",
);

export const rigAgentEvalScenarios: ReadonlyArray<RigAgentEvalScenario> = [
  {
    id: "mono-team",
    title: "Mono-Team Platform",
    selectedNodeId: monoCore.id,
    expectedOwnershipTeams: 1,
    boardSummary: makeBoardSummary(
      "mono-team-board",
      "Mono-Team Platform",
      [monoApi, monoCore, monoDb, monoWorker],
      [
        makeEdge("mono-edge-1", monoApi, monoCore, "routes"),
        makeEdge("mono-edge-2", monoCore, monoDb, "reads"),
        makeEdge("mono-edge-3", monoCore, monoWorker, "dispatches"),
      ],
    ),
    proposal: makeProposal(
      "Add an Audit Worker behind the core service.",
      "This extends the platform without crossing ownership boundaries.",
      [
        makeProposalNode("mono-api", "API Gateway", "system"),
        makeProposalNode("mono-core", "Core Service", "system"),
        makeProposalNode("mono-db", "Data Service", "container"),
        monoAudit,
      ],
      [
        makeProposalEdge("mono-api", "mono-core", "routes"),
        makeProposalEdge("mono-core", "mono-db", "reads"),
        makeProposalEdge("mono-core", "mono-audit", "emits audit events"),
      ],
    ),
  },
  {
    id: "cross-team",
    title: "Cross-Team Commerce Chain",
    selectedNodeId: crossPayments.id,
    expectedOwnershipTeams: 4,
    boardSummary: makeBoardSummary(
      "cross-team-board",
      "Cross-Team Commerce Chain",
      [crossEdge, crossCatalog, crossPayments, crossOps],
      [
        makeEdge("cross-edge-1", crossEdge, crossCatalog, "routes"),
        makeEdge("cross-edge-2", crossCatalog, crossPayments, "authorizes"),
        makeEdge("cross-edge-3", crossPayments, crossOps, "reports"),
        makeEdge("cross-edge-4", crossOps, crossEdge, "alerts"),
      ],
    ),
    proposal: makeProposal(
      "Add a Fraud Service spanning checkout and operations flows.",
      "This creates one new bounded context and two new relationships across team boundaries.",
      [
        makeProposalNode("cross-edge", "Edge API", "system"),
        makeProposalNode("cross-catalog", "Catalog Service", "container"),
        makeProposalNode("cross-payments", "Payments Service", "container"),
        makeProposalNode("cross-ops", "Ops Console", "system"),
        crossFraud,
      ],
      [
        makeProposalEdge("cross-edge", "cross-catalog", "routes"),
        makeProposalEdge("cross-catalog", "cross-payments", "authorizes"),
        makeProposalEdge("cross-payments", "cross-fraud", "screens"),
        makeProposalEdge("cross-fraud", "cross-ops", "raises incidents"),
      ],
    ),
  },
  {
    id: "unknown-ownership",
    title: "Unknown Ownership Hotspots",
    selectedNodeId: unknownServiceA.id,
    expectedOwnershipTeams: 2,
    boardSummary: makeBoardSummary(
      "unknown-ownership-board",
      "Unknown Ownership Hotspots",
      [unknownIngress, unknownServiceA, unknownServiceB, unknownLedger],
      [
        makeEdge("unknown-edge-1", unknownIngress, unknownServiceA, "routes"),
        makeEdge("unknown-edge-2", unknownServiceA, unknownServiceB, "calls"),
        makeEdge("unknown-edge-3", unknownServiceB, unknownLedger, "writes"),
      ],
    ),
    proposal: makeProposal(
      "Add an Ownership Resolver component to clarify ownership boundaries.",
      "This proposes one new component plus one explicit relationship from Service A.",
      [
        makeProposalNode("unknown-ingress", "Ingress", "system"),
        makeProposalNode("unknown-service-a", "Service A", "container"),
        makeProposalNode("unknown-service-b", "Service B", "container"),
        makeProposalNode("unknown-ledger", "Ledger", "container"),
        unknownResolver,
      ],
      [
        makeProposalEdge("unknown-ingress", "unknown-service-a", "routes"),
        makeProposalEdge("unknown-service-a", "unknown-service-b", "calls"),
        makeProposalEdge("unknown-service-a", "unknown-resolver", "emits ownership events"),
        makeProposalEdge("unknown-service-b", "unknown-ledger", "writes"),
      ],
    ),
  },
  {
    id: "azure-heavy",
    title: "Azure Event Processing Stack",
    selectedNodeId: azureServiceBus.id,
    expectedOwnershipTeams: 3,
    boardSummary: makeBoardSummary(
      "azure-heavy-board",
      "Azure Event Processing Stack",
      [azureApim, azureFunction, azureServiceBus, azureCosmos, azureKeyVault],
      [
        makeEdge("azure-edge-1", azureApim, azureFunction, "invokes"),
        makeEdge("azure-edge-2", azureFunction, azureServiceBus, "publishes"),
        makeEdge("azure-edge-3", azureFunction, azureCosmos, "stores"),
        makeEdge("azure-edge-4", azureFunction, azureKeyVault, "reads secrets"),
      ],
    ),
    proposal: makeProposal(
      "Add App Insights to improve Azure diagnostics.",
      "This introduces one new Azure platform dependency with one relationship from the function app.",
      [
        makeProposalNode("azure-apim", "API Management", "externalSystem"),
        makeProposalNode("azure-function", "Orders Function", "container"),
        makeProposalNode("azure-service-bus", "Service Bus", "externalSystem"),
        makeProposalNode("azure-cosmos", "Cosmos DB", "externalSystem"),
        makeProposalNode("azure-key-vault", "Key Vault", "externalSystem"),
        azureMonitor,
      ],
      [
        makeProposalEdge("azure-apim", "azure-function", "invokes"),
        makeProposalEdge("azure-function", "azure-service-bus", "publishes"),
        makeProposalEdge("azure-function", "azure-cosmos", "stores"),
        makeProposalEdge("azure-function", "azure-key-vault", "reads secrets"),
        makeProposalEdge("azure-function", "azure-monitor", "emits telemetry"),
      ],
    ),
  },
];
